"""
Judging, following the event document:

- Department round (22-24 October): KIET teams are judged in rooms, one department's teams per room, by faculty
  of another department. Each room has its own panel of judges.
- Grand Finale (30 October): finalists and teams from other colleges and schools exhibit in numbered tents and are
  judged by panels of external judges.
- Every category is scored out of 50 on its common rubric (rules.RUBRIC_PARTS). Ties are broken by the
  innovation/originality criterion, then Query Addressing, then the panel chair decides. No shared positions.

Super admins appoint judges, set up rooms and panels, allot teams and tents, and open or lock each round. Judging is
locked until they open it. A judge sees and scores only the teams of their own panels, and only while the round is
open. Department admins see their own department's rooms and rankings, read-only.
"""

import re
import uuid
from collections import defaultdict
from statistics import mean

from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import rules
from ..config import Settings
from ..db import violated_constraint
from ..errors import ApiError
from ..models import Admin, AppState, FinalTent, Juror, Panel, PanelJuror, PanelTeam, Profile, Score, Team, TeamMember, utcnow
from ..schemas import (
    AttendanceMember,
    AttendanceSheet,
    AttendanceTeam,
    JudgeMemberOut,
    JudgeOut,
    JudgePanelOut,
    JudgeTeamOut,
    JudgingOut,
    JurorInput,
    JurorOut,
    JurorPanelRef,
    PanelInput,
    PanelJurorOut,
    PanelJurorsInput,
    PanelOut,
    PanelTeamOut,
    PanelTeamsInput,
    PanelUpdateInput,
    RankedTeam,
    RankingGroup,
    RankingsOut,
    RoundOut,
    ScoreInput,
    ScoreOut,
    TentRowOut,
    TentsInput,
)
from . import admin as admin_service
from . import audit, schedule

ROUND_LABELS = {"department": "department round", "final": "Grand Finale"}


def _round_key(round_: str) -> str:
    return f"judging_open:{round_}"


def _check_round(round_: str) -> None:
    if round_ not in rules.JUDGING_ROUNDS:
        raise ApiError(f'Unknown round "{round_}".', 404)


def round_open(db: Session, round_: str) -> bool:
    """A round is open while its app_state row exists."""
    return db.get(AppState, _round_key(round_)) is not None


# ---------- Who can see what ----------


def _require_super(admin: Admin) -> None:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can manage judging.", 403)


def _check_view(admin: Admin, round_: str) -> None:
    """
    Super admins see both rounds; department admins their department's rooms; outside admins, startup admins and the
    COE KIET admin (whose teams skip the department round) the finale.
    """
    _check_round(round_)
    if admin.role == "admin" and admin.department == rules.CLUB_DEPARTMENT:
        if round_ != "final":
            raise ApiError("COE KIET teams skip the department round and are judged at the Grand Finale.", 403)
    elif admin.role == "admin" and round_ != "department":
        raise ApiError("Department admins can see the department round only.", 403)
    if admin.role in ("outside_admin", "startup_admin") and round_ != "final":
        raise ApiError("The department round is for KIET teams only.", 403)


def _panel_scope(admin: Admin, round_: str):
    conditions = [Panel.round == round_]
    if admin.role == "admin" and round_ == "department":
        conditions.append(Panel.department == admin.department)
    return conditions


# ---------- Eligibility ----------


def _eligible_condition(round_: str, department: str | None = None):
    """Teams that take part in a round: submitted department teams, or the Grand Finale's teams."""
    if round_ == "department":
        condition = (Team.route == "department") & (Team.status == "submitted")
        return condition & (Team.department == department) if department else condition
    # Startups and COE KIET teams qualify once an admin has accepted the entry as a legal one.
    accepted = or_(Team.approval_required.is_(False), Team.approved_at.is_not(None))
    return (Team.status == "submitted") & or_((Team.route == "finale") & accepted, (Team.route == "department") & (Team.result == "finalist"))


def _lock_panel(db: Session, panel_id: uuid.UUID) -> Panel:
    panel = db.scalar(select(Panel).where(Panel.id == panel_id).with_for_update().execution_options(populate_existing=True))
    if panel is None:
        raise ApiError("Room or panel not found.", 404)
    return panel


def _visible_panel(db: Session, admin: Admin, panel_id: uuid.UUID) -> Panel:
    panel = db.get(Panel, panel_id)
    if panel is None:
        raise ApiError("Room or panel not found.", 404)
    _check_view(admin, panel.round)
    if admin.role == "admin" and panel.round == "department" and panel.department != admin.department:
        raise ApiError(f"This room judges {panel.department} teams, not {admin.department}.", 403)
    return panel


# ---------- Overview ----------


def _tents(db: Session, team_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not team_ids:
        return {}
    return dict(db.execute(select(FinalTent.team_id, FinalTent.tent).where(FinalTent.team_id.in_(team_ids))).tuples().all())


def _panels_out(db: Session, panels: list[Panel], viewer: Admin | None = None) -> list[PanelOut]:
    ids = [p.id for p in panels]
    if not ids:
        return []
    jurors: dict[uuid.UUID, list[PanelJurorOut]] = defaultdict(list)
    for link, juror in db.execute(
        select(PanelJuror, Juror)
        .join(Juror, Juror.email == PanelJuror.juror_email)
        .where(PanelJuror.panel_id.in_(ids))
        .order_by(Juror.name)
    ).tuples():
        jurors[link.panel_id].append(
            PanelJurorOut(
                email=juror.email,
                name=juror.name,
                kind=juror.kind,
                department=juror.department,
                organisation=juror.organisation,
                chair=link.chair,
            )
        )
    links = (
        db.execute(
            select(PanelTeam.panel_id, Team)
            .join(Team, Team.id == PanelTeam.team_id)
            .where(PanelTeam.panel_id.in_(ids))
            .order_by(Team.number)
        )
        .tuples()
        .all()
    )
    if viewer is not None and viewer.role in ("startup_admin", "admin"):
        # Finale panels hold every kind of team; these admins see only their own.
        links = [(panel_id, team) for panel_id, team in links if admin_service.can_see_team(viewer, team)]
    teams = [team for _, team in links]
    summaries = {s.id: s for s in admin_service.summaries(db, teams)}
    tents = _tents(db, [t.id for t in teams])
    # Scores by the panel's own judges only.
    totals: dict[tuple[uuid.UUID, uuid.UUID], list[int]] = defaultdict(list)
    for panel_id, team_id, total in db.execute(
        select(PanelTeam.panel_id, Score.team_id, Score.total)
        .join(Panel, Panel.id == PanelTeam.panel_id)
        .join(Score, (Score.team_id == PanelTeam.team_id) & (Score.round == Panel.round))
        .join(PanelJuror, (PanelJuror.panel_id == PanelTeam.panel_id) & (PanelJuror.juror_email == Score.juror_email))
        .where(PanelTeam.panel_id.in_(ids))
    ).tuples():
        totals[(panel_id, team_id)].append(total)
    by_panel: dict[uuid.UUID, list[PanelTeamOut]] = defaultdict(list)
    for panel_id, team in links:
        marks = totals[(panel_id, team.id)]
        by_panel[panel_id].append(
            PanelTeamOut(
                **summaries[team.id].model_dump(),
                tent=tents.get(team.id),
                scores=len(marks),
                average=round(mean(marks), 2) if marks else None,
            )
        )
    return [
        PanelOut(
            id=p.id,
            round=p.round,
            name=p.name,
            location=p.location,
            department=p.department,
            jurors=sorted(jurors[p.id], key=lambda j: not j.chair),
            teams=by_panel[p.id],
        )
        for p in panels
    ]


def open_blocker(db: Session, settings: Settings, round_: str) -> str | None:
    """Why a round cannot be opened for scoring now, or None."""
    if round_ == "department":
        if schedule.load(db, settings).registration_state() != "closed":
            return "The department round can open once registration has closed, so every team is final."
    elif db.get(AppState, admin_service.RESULTS_KEY) is None:
        return "The Grand Finale round can open once results (the finalists) are published."
    panels = list(db.scalars(select(Panel).where(Panel.round == round_)))
    if not panels:
        return "Create the rooms or panels for this round first."
    team_counts = dict(
        db.execute(select(PanelTeam.panel_id, func.count()).where(PanelTeam.round == round_).group_by(PanelTeam.panel_id)).tuples().all()
    )
    juror_counts = dict(
        db.execute(
            select(PanelJuror.panel_id, func.count())
            .join(Panel, Panel.id == PanelJuror.panel_id)
            .where(Panel.round == round_)
            .group_by(PanelJuror.panel_id)
        )
        .tuples()
        .all()
    )
    if not any(team_counts.values()):
        return "Allot teams to the rooms or panels first."
    for panel in panels:
        if team_counts.get(panel.id) and not juror_counts.get(panel.id):
            return f"{panel.name} has teams but no judges. Appoint its judges first."
    return None


def round_out(db: Session, settings: Settings, round_: str) -> RoundOut:
    state = db.get(AppState, _round_key(round_))
    closed_state = db.get(AppState, f"judging_closed:{round_}")
    last = state or closed_state
    return RoundOut(
        round=round_,
        open=state is not None,
        changed_at=last.updated_at if last else None,
        changed_by=last.value if last else None,
        open_blocked=None if state else open_blocker(db, settings, round_),
    )


def overview(db: Session, admin: Admin, settings: Settings, round_: str) -> JudgingOut:
    _check_view(admin, round_)
    panels = list(db.scalars(select(Panel).where(*_panel_scope(admin, round_)).order_by(Panel.department.nullsfirst(), Panel.name_key)))
    allotted = select(PanelTeam.team_id).where(PanelTeam.round == round_)
    eligible = _eligible_condition(round_, admin.department if admin.role == "admin" and round_ == "department" else None)
    unallotted = list(
        db.scalars(select(Team).where(eligible, admin_service.team_scope(admin), Team.id.not_in(allotted)).order_by(Team.number))
    )
    tents = None
    if round_ == "final":
        finalists = list(db.scalars(select(Team).where(eligible, admin_service.team_scope(admin)).order_by(Team.category, Team.number)))
        assigned = _tents(db, [t.id for t in finalists])
        tents = [TentRowOut(team=s, tent=assigned.get(s.id)) for s in admin_service.summaries(db, finalists)]
    return JudgingOut(
        round=round_out(db, settings, round_),
        can_manage=admin.role == "super_admin",
        panels=_panels_out(db, panels, admin),
        unallotted=admin_service.summaries(db, unallotted),
        tents=tents,
    )


# ---------- Opening and locking a round ----------


def _set_round(db: Session, admin: Admin, settings: Settings, round_: str, open_: bool) -> RoundOut:
    _require_super(admin)
    _check_round(round_)
    # Serialise with publishing, which the final round depends on.
    admin_service._lock_state(db, f"{admin_service.RESULTS_KEY}_lock")
    key = _round_key(round_)
    state = db.get(AppState, key)
    if open_:
        if state is not None:
            raise ApiError("Judging is already open for this round.", 409)
        if blocked := open_blocker(db, settings, round_):
            raise ApiError(blocked, 409)
        db.add(AppState(key=key, value=admin.email, updated_at=utcnow()))
        db.execute(delete(AppState).where(AppState.key == f"judging_closed:{round_}"))
        audit.record(db, admin.email, "judging.opened", detail=f"Scoring opened for the {ROUND_LABELS[round_]}")
    else:
        if state is None:
            raise ApiError("Judging is already locked for this round.", 409)
        db.delete(state)
        db.merge(AppState(key=f"judging_closed:{round_}", value=admin.email, updated_at=utcnow()))
        audit.record(db, admin.email, "judging.locked", detail=f"Scoring locked for the {ROUND_LABELS[round_]}")
    db.commit()
    return round_out(db, settings, round_)


def open_round(db: Session, admin: Admin, settings: Settings, round_: str) -> RoundOut:
    return _set_round(db, admin, settings, round_, True)


def lock_round(db: Session, admin: Admin, settings: Settings, round_: str) -> RoundOut:
    return _set_round(db, admin, settings, round_, False)


# ---------- Judges ----------


def _juror_out(db: Session, jurors: list[Juror]) -> list[JurorOut]:
    emails = [j.email for j in jurors]
    panels: dict[str, list[JurorPanelRef]] = defaultdict(list)
    scores: dict[str, int] = {}
    if emails:
        for link, panel in db.execute(
            select(PanelJuror, Panel)
            .join(Panel, Panel.id == PanelJuror.panel_id)
            .where(PanelJuror.juror_email.in_(emails))
            .order_by(Panel.round, Panel.name_key)
        ).tuples():
            panels[link.juror_email].append(JurorPanelRef(id=panel.id, round=panel.round, name=panel.name, chair=link.chair))
        scores = dict(
            db.execute(select(Score.juror_email, func.count()).where(Score.juror_email.in_(emails)).group_by(Score.juror_email))
            .tuples()
            .all()
        )
    return [
        JurorOut(
            email=j.email,
            name=j.name,
            kind=j.kind,
            department=j.department,
            organisation=j.organisation,
            phone=j.phone,
            panels=panels[j.email],
            scores=scores.get(j.email, 0),
            added_at=j.created_at,
            added_by=j.created_by,
        )
        for j in jurors
    ]


def list_jurors(db: Session, admin: Admin) -> list[JurorOut]:
    _require_super(admin)
    return _juror_out(db, list(db.scalars(select(Juror).order_by(Juror.kind, Juror.name))))


def add_juror(db: Session, admin: Admin, data: JurorInput) -> JurorOut:
    _require_super(admin)
    if db.get(Juror, data.email) is not None:
        raise ApiError("This email is already a judge.", 409)
    juror = Juror(
        email=data.email,
        name=data.name,
        kind=data.kind,
        department=data.department,
        organisation=data.organisation,
        phone=data.phone,
        created_by=admin.email,
    )
    db.add(juror)
    where = data.department if data.kind == "faculty" else data.organisation
    audit.record(db, admin.email, "judging.judge_added", detail=f"{data.email} ({data.name}, {where})")
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError("This email is already a judge.", 409) from exc
    return _juror_out(db, [juror])[0]


def remove_juror(db: Session, admin: Admin, email: str) -> None:
    _require_super(admin)
    juror = db.scalar(select(Juror).where(Juror.email == email.strip().lower()).with_for_update())
    if juror is None:
        raise ApiError("No judge with this email exists.", 404)
    if db.scalar(select(func.count()).select_from(Score).where(Score.juror_email == juror.email)):
        raise ApiError("This judge has already scored teams, so they cannot be removed.", 409)
    if db.scalar(select(func.count()).select_from(PanelJuror).where(PanelJuror.juror_email == juror.email)):
        raise ApiError("Remove this judge from their rooms and panels first.", 409)
    db.delete(juror)
    audit.record(db, admin.email, "judging.judge_removed", detail=juror.email)
    db.commit()


# ---------- Rooms and panels ----------


def _panel_name_taken(exc: IntegrityError) -> bool:
    return "uq_panels_round_name_key" in violated_constraint(exc)


def create_panel(db: Session, admin: Admin, data: PanelInput) -> PanelOut:
    _require_super(admin)
    panel = Panel(
        round=data.round,
        name=data.name,
        name_key=data.name.lower(),
        location=data.location,
        department=data.department,
        created_by=admin.email,
    )
    db.add(panel)
    kind = f"Room for {data.department}" if data.round == "department" else "Finale panel"
    audit.record(
        db,
        admin.email,
        "judging.panel_created",
        detail=f"{kind}: {data.name}{', ' + data.location if data.location else ''}",
        department=data.department,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _panel_name_taken(exc):
            raise ApiError(f'"{data.name}" already exists in this round. Choose another name.', 409) from exc
        raise
    return _panels_out(db, [panel])[0]


def update_panel(db: Session, admin: Admin, panel_id: uuid.UUID, data: PanelUpdateInput) -> PanelOut:
    _require_super(admin)
    panel = _lock_panel(db, panel_id)
    name = " ".join(data.name.split())
    panel.name, panel.name_key, panel.location = name, name.lower(), data.location
    audit.record(
        db,
        admin.email,
        "judging.panel_updated",
        detail=f"{name}{', ' + data.location if data.location else ''}",
        department=panel.department,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _panel_name_taken(exc):
            raise ApiError(f'"{name}" already exists in this round. Choose another name.', 409) from exc
        raise
    return _panels_out(db, [panel])[0]


def _scored(db: Session, panel: Panel, *, team_ids: list[uuid.UUID] | None = None, juror_emails: list[str] | None = None) -> bool:
    """Whether this panel's judges have scored any of these teams (or these judges any of its teams) in its round."""
    panel_teams = select(PanelTeam.team_id).where(PanelTeam.panel_id == panel.id)
    panel_jurors = select(PanelJuror.juror_email).where(PanelJuror.panel_id == panel.id)
    statement = (
        select(func.count())
        .select_from(Score)
        .where(
            Score.round == panel.round,
            Score.team_id.in_(team_ids if team_ids is not None else panel_teams),
            Score.juror_email.in_(juror_emails if juror_emails is not None else panel_jurors),
        )
    )
    return bool(db.scalar(statement))


def delete_panel(db: Session, admin: Admin, panel_id: uuid.UUID) -> None:
    _require_super(admin)
    panel = _lock_panel(db, panel_id)
    if _scored(db, panel):
        raise ApiError("Teams in this room have already been scored, so it cannot be deleted.", 409)
    db.delete(panel)
    audit.record(db, admin.email, "judging.panel_deleted", detail=panel.name, department=panel.department)
    db.commit()


def set_panel_teams(db: Session, admin: Admin, panel_id: uuid.UUID, data: PanelTeamsInput) -> PanelOut:
    """Replaces the teams allotted to a room or panel."""
    _require_super(admin)
    panel = _lock_panel(db, panel_id)
    wanted = list(dict.fromkeys(data.team_ids))
    current = set(db.scalars(select(PanelTeam.team_id).where(PanelTeam.panel_id == panel.id)))
    removed = [t for t in current if t not in wanted]
    if removed and _scored(db, panel, team_ids=removed):
        raise ApiError("A team you removed has already been scored in this room, so it must stay here.", 409)

    added = [t for t in wanted if t not in current]
    if added:
        teams = {t.id: t for t in db.scalars(select(Team).where(Team.id.in_(added), _eligible_condition(panel.round, panel.department)))}
        for team_id in added:
            if team_id not in teams:
                raise ApiError(
                    f"Only submitted {panel.department} teams can be allotted to this room."
                    if panel.round == "department"
                    else "Only finalists and submitted teams from other colleges and schools take part in the Grand Finale.",
                    422,
                )
        elsewhere = db.execute(
            select(Team.number, Panel.name)
            .join(PanelTeam, PanelTeam.team_id == Team.id)
            .join(Panel, Panel.id == PanelTeam.panel_id)
            .where(PanelTeam.round == panel.round, PanelTeam.team_id.in_(added), PanelTeam.panel_id != panel.id)
        ).first()
        if elsewhere:
            raise ApiError(f"IT26-{elsewhere[0]:04d} is already allotted to {elsewhere[1]}. Remove it there first.", 409)

    db.execute(delete(PanelTeam).where(PanelTeam.panel_id == panel.id, PanelTeam.team_id.in_(removed)))
    for team_id in added:
        db.add(PanelTeam(panel_id=panel.id, team_id=team_id, round=panel.round))
    audit.record(
        db,
        admin.email,
        "judging.teams_allotted",
        detail=f"{panel.name}: {len(wanted)} teams ({len(added)} added, {len(removed)} removed)",
        department=panel.department,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "uq_panel_teams_round_team" in violated_constraint(exc):
            raise ApiError("One of these teams was just allotted to another room. Reload and try again.", 409) from exc
        raise
    return _panels_out(db, [panel])[0]


def set_panel_jurors(db: Session, admin: Admin, panel_id: uuid.UUID, data: PanelJurorsInput) -> PanelOut:
    """Replaces a room's or panel's judges. At most one is the chair, who settles ties."""
    _require_super(admin)
    panel = _lock_panel(db, panel_id)
    emails = [j.email for j in data.jurors]
    if len(set(emails)) != len(emails):
        raise ApiError("A judge is listed more than once.", 422)
    if sum(1 for j in data.jurors if j.chair) > 1:
        raise ApiError("Only one judge can chair a panel.", 422)
    jurors = {j.email: j for j in db.scalars(select(Juror).where(Juror.email.in_(emails)))}
    for email in emails:
        juror = jurors.get(email)
        if juror is None:
            raise ApiError(f"{email} is not an appointed judge. Add them under Judges first.", 422)
        if panel.round == "department" and juror.kind == "faculty" and juror.department == panel.department:
            raise ApiError(f"{juror.name} is from {juror.department}. Department teams are judged by faculty of another department.", 422)
    current = set(db.scalars(select(PanelJuror.juror_email).where(PanelJuror.panel_id == panel.id)))
    removed = [e for e in current if e not in emails]
    if removed and _scored(db, panel, juror_emails=removed):
        raise ApiError("A judge you removed has already scored teams in this room, so they must stay.", 409)

    db.execute(delete(PanelJuror).where(PanelJuror.panel_id == panel.id))
    db.flush()
    for entry in data.jurors:
        db.add(PanelJuror(panel_id=panel.id, juror_email=entry.email, chair=entry.chair))
    chair = next((jurors[j.email].name for j in data.jurors if j.chair), "none")
    audit.record(
        db,
        admin.email,
        "judging.judges_assigned",
        detail=f"{panel.name}: {', '.join(emails) or 'no judges'} (chair: {chair})",
        department=panel.department,
    )
    db.commit()
    return _panels_out(db, [panel])[0]


# ---------- Tents ----------


def _tent_label(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    label = "".join(value.split()).upper()
    if not all(c.isalnum() or c in "-/" for c in label):
        raise ApiError(f'"{value}" is not a stall number. Use letters, digits and dashes, e.g. S-12.', 422)
    return label


def set_tents(db: Session, admin: Admin, settings: Settings, data: TentsInput) -> JudgingOut:
    """Allots (or clears) Grand Finale tents for the listed teams; other teams keep theirs."""
    _require_super(admin)
    admin_service._lock_state(db, "tents_lock")
    wanted = {a.team_id: _tent_label(a.tent) for a in data.tents}
    labels = [t for t in wanted.values() if t]
    if len(set(labels)) != len(labels):
        duplicate = next(t for t in labels if labels.count(t) > 1)
        raise ApiError(f"Stall {duplicate} is given to more than one team.", 422)
    eligible = set(db.scalars(select(Team.id).where(Team.id.in_(list(wanted)), _eligible_condition("final"))))
    for team_id, tent in wanted.items():
        if tent and team_id not in eligible:
            raise ApiError("Stalls are only for finalists and submitted teams from other colleges and schools.", 422)
    clash = db.execute(
        select(FinalTent.tent, Team.number)
        .join(Team, Team.id == FinalTent.team_id)
        .where(FinalTent.tent.in_(labels), FinalTent.team_id.not_in(list(wanted)))
    ).first()
    if clash:
        raise ApiError(f"Stall {clash[0]} is already allotted to IT26-{clash[1]:04d}.", 409)

    db.execute(delete(FinalTent).where(FinalTent.team_id.in_(list(wanted))))
    db.flush()
    for team_id, tent in wanted.items():
        if tent:
            db.add(FinalTent(team_id=team_id, tent=tent, assigned_by=admin.email))
    audit.record(db, admin.email, "judging.tents_allotted", detail=f"{len(labels)} stalls allotted, {len(wanted) - len(labels)} cleared")
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError("Another organiser changed the stalls at the same time. Reload and try again.", 409) from exc
    return overview(db, admin, settings, "final")


# ---------- Attendance sheets ----------


def attendance(db: Session, admin: Admin, round_: str, panel_id: uuid.UUID | None) -> AttendanceSheet:
    """Teams and every member, for a room's (or panel's) attendance sheet, or every finale team in tent order."""
    _check_view(admin, round_)
    jurors: list[str] = []
    if panel_id:
        panel = _visible_panel(db, admin, panel_id)
        if panel.round != round_:
            raise ApiError("This room belongs to the other round.", 422)
        panel_teams = select(Team).join(PanelTeam, PanelTeam.team_id == Team.id).where(PanelTeam.panel_id == panel.id)
        if admin.role in ("startup_admin", "admin"):
            panel_teams = panel_teams.where(admin_service.team_scope(admin))
        teams = list(db.scalars(panel_teams.order_by(Team.number)))
        jurors = [
            f"{juror.name}{' (chair)' if link.chair else ''}"
            for link, juror in db.execute(
                select(PanelJuror, Juror)
                .join(Juror, Juror.email == PanelJuror.juror_email)
                .where(PanelJuror.panel_id == panel.id)
                .order_by(PanelJuror.chair.desc(), Juror.name)
            ).tuples()
        ]
        title = f"{panel.name}{' · ' + panel.department + ' teams' if panel.department else ''}"
        location = panel.location
    else:
        if round_ != "final":
            raise ApiError("Choose a room.", 422)
        teams = list(db.scalars(select(Team).where(_eligible_condition("final"), admin_service.team_scope(admin)).order_by(Team.number)))
        title, location = "Grand Finale · all teams", ""
    tents = _tents(db, [t.id for t in teams])
    if round_ == "final":
        # Tent order, as organisers walk the tents; teams without a tent last.
        teams.sort(key=lambda t: (tents.get(t.id) is None, _natural(tents.get(t.id) or ""), t.number))
    members: dict[uuid.UUID, list[AttendanceMember]] = defaultdict(list)
    if teams:
        for member, profile in db.execute(
            select(TeamMember, Profile)
            .join(Profile, Profile.user_id == TeamMember.user_id)
            .where(TeamMember.team_id.in_([t.id for t in teams]))
            .order_by(TeamMember.role != "leader", Profile.full_name)
        ).tuples():
            members[member.team_id].append(
                AttendanceMember(
                    full_name=profile.full_name,
                    role=member.role,
                    year=profile.year,
                    course=profile.course,
                    department=profile.department,
                    institution=profile.institution,
                    roll_number=profile.roll_number,
                    phone=profile.phone,
                )
            )
    return AttendanceSheet(
        round=round_,
        title=title,
        location=location,
        jurors=jurors,
        teams=[
            AttendanceTeam(
                code=t.code,
                name=t.name,
                category=t.category,
                project_title=t.project_title,
                status=t.status,
                tent=tents.get(t.id),
                institution=t.institution,
                department=t.department,
                members=members[t.id],
            )
            for t in teams
        ],
    )


def _natural(label: str) -> tuple:
    """ "T-2" before "T-10"."""
    return tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", label))


# ---------- Rankings ----------


def rankings(db: Session, admin: Admin, round_: str, department: str | None) -> RankingsOut:
    """Average of the panel judges' totals; ties broken by innovation, then Query Addressing, then the chair."""
    _check_round(round_)
    if admin.role in ("outside_admin", "startup_admin"):
        raise ApiError("Rankings are for super admins and department admins.", 403)
    _check_view(admin, round_)
    if admin.role == "admin":
        department = admin.department
    elif department is not None and department not in rules.DEPARTMENTS:
        raise ApiError(f'Unknown department "{department}".', 422)

    statement = (
        select(Team, Panel)
        .join(PanelTeam, PanelTeam.team_id == Team.id)
        .join(Panel, Panel.id == PanelTeam.panel_id)
        .where(PanelTeam.round == round_)
    )
    if department:
        statement = statement.where(Panel.department == department if round_ == "department" else Team.department == department)
    rows = db.execute(statement.order_by(Team.number)).tuples().all()
    teams = [team for team, _ in rows]
    panel_of = {team.id: panel for team, panel in rows}
    summaries = {s.id: s for s in admin_service.summaries(db, teams)}
    judges = (
        dict(
            db.execute(
                select(PanelJuror.panel_id, func.count())
                .where(PanelJuror.panel_id.in_({p.id for p in panel_of.values()}))
                .group_by(PanelJuror.panel_id)
            )
            .tuples()
            .all()
        )
        if panel_of
        else {}
    )
    marks: dict[uuid.UUID, list[list[int]]] = defaultdict(list)
    if teams:
        for team_id, team_marks in db.execute(
            select(Score.team_id, Score.marks)
            .join(PanelTeam, (PanelTeam.team_id == Score.team_id) & (PanelTeam.round == Score.round))
            .join(PanelJuror, (PanelJuror.panel_id == PanelTeam.panel_id) & (PanelJuror.juror_email == Score.juror_email))
            .where(Score.round == round_, Score.team_id.in_([t.id for t in teams]))
        ).tuples():
            marks[team_id].append(team_marks)

    groups: dict[tuple, list[Team]] = defaultdict(list)
    for team in teams:
        if round_ == "department":
            groups[(team.department, team.category)].append(team)
        elif team.participant_type == "school":
            groups[("school", 0)].append(team)
        else:
            groups[("category", team.category)].append(team)

    def ranked(group: list[Team]) -> list[RankedTeam]:
        entries = []
        for team in group:
            scores = marks[team.id]
            entries.append(
                (
                    team,
                    round(mean(sum(m) for m in scores), 2) if scores else None,
                    round(mean(rules.innovation_marks(team.category, m) for m in scores), 2) if scores else None,
                    round(mean(rules.query_marks(m) for m in scores), 2) if scores else None,
                )
            )
        entries.sort(key=lambda e: (e[1] is None, -(e[1] or 0), -(e[2] or 0), -(e[3] or 0), e[0].number))
        out: list[RankedTeam] = []
        previous = None
        for index, (team, average, innovation, query) in enumerate(entries):
            key = (average, innovation, query)
            panel = panel_of[team.id]
            out.append(
                RankedTeam(
                    position=index + 1 if average is not None else None,
                    team=summaries[team.id],
                    panel=panel.name,
                    scores=len(marks[team.id]),
                    judges=judges.get(panel.id, 0),
                    average=average,
                    innovation=innovation,
                    query=query,
                    tied=average is not None and key == previous,
                )
            )
            previous = key
        return out

    result = []
    for (first, second), group in sorted(groups.items(), key=lambda item: (str(item[0][0]) == "school", str(item[0][0]), item[0][1])):
        if round_ == "department":
            label, dep, category = f"{first} · Category {second}: {rules.CATEGORIES[second].title}", first, second
        elif first == "school":
            label, dep, category = "Best School Project", None, None
        else:
            label, dep, category = f"Category {second}: {rules.CATEGORIES[second].title}", None, second
        result.append(RankingGroup(key=f"{first}-{second}", label=label, department=dep, category=category, teams=ranked(group)))
    return RankingsOut(round=round_, groups=result)


# ---------- Judges' own view ----------


def find_juror(db: Session, email: str) -> Juror | None:
    return db.get(Juror, email)


def require_juror(db: Session, email: str) -> Juror:
    juror = find_juror(db, email)
    if juror is None:
        raise ApiError("This account is not an appointed InnoTech26 judge.", 403)
    return juror


def judge_view(db: Session, juror: Juror) -> JudgeOut:
    links = (
        db.execute(
            select(PanelJuror, Panel)
            .join(Panel, Panel.id == PanelJuror.panel_id)
            .where(PanelJuror.juror_email == juror.email)
            .order_by(Panel.round, Panel.name_key)
        )
        .tuples()
        .all()
    )
    panel_ids = [panel.id for _, panel in links]
    rows = (
        db.execute(
            select(PanelTeam.panel_id, Team)
            .join(Team, Team.id == PanelTeam.team_id)
            .where(PanelTeam.panel_id.in_(panel_ids))
            .order_by(Team.number)
        )
        .tuples()
        .all()
        if panel_ids
        else []
    )
    teams = [team for _, team in rows]
    team_ids = [t.id for t in teams]
    tents = _tents(db, team_ids)
    members: dict[uuid.UUID, list[JudgeMemberOut]] = defaultdict(list)
    mine: dict[tuple[str, uuid.UUID], Score] = {}
    if team_ids:
        for member, profile in db.execute(
            select(TeamMember, Profile)
            .join(Profile, Profile.user_id == TeamMember.user_id)
            .where(TeamMember.team_id.in_(team_ids))
            .order_by(TeamMember.role != "leader", Profile.full_name)
        ).tuples():
            members[member.team_id].append(
                JudgeMemberOut(full_name=profile.full_name, role=member.role, year=profile.year, course=profile.course)
            )
        for score in db.scalars(select(Score).where(Score.juror_email == juror.email, Score.team_id.in_(team_ids))):
            mine[(score.round, score.team_id)] = score
    open_rounds = {r for r in rules.JUDGING_ROUNDS if round_open(db, r)}
    by_panel: dict[uuid.UUID, list[JudgeTeamOut]] = defaultdict(list)
    round_of = {panel.id: panel.round for _, panel in links}
    for panel_id, team in rows:
        score = mine.get((round_of[panel_id], team.id))
        by_panel[panel_id].append(
            JudgeTeamOut(
                id=team.id,
                code=team.code,
                name=team.name,
                category=team.category,
                domain=team.domain,
                project_title=team.project_title,
                abstract=team.abstract,
                participant_type=team.participant_type,
                institution=team.institution,
                department=team.department,
                status=team.status,
                tent=tents.get(team.id),
                members=members[team.id],
                my_score=_score_out(score) if score else None,
            )
        )
    return JudgeOut(
        email=juror.email,
        name=juror.name,
        panels=[
            JudgePanelOut(
                id=panel.id,
                round=panel.round,
                name=panel.name,
                location=panel.location,
                department=panel.department,
                chair=link.chair,
                open=panel.round in open_rounds,
                teams=by_panel[panel.id],
            )
            for link, panel in links
        ],
    )


def _score_out(score: Score) -> ScoreOut:
    return ScoreOut(marks=list(score.marks), total=score.total, remarks=score.remarks, updated_at=score.updated_at)


def save_score(db: Session, juror: Juror, panel_id: uuid.UUID, team_id: uuid.UUID, data: ScoreInput) -> ScoreOut:
    """A judge's marks for a team of their own panel, while the round is open. Saving again replaces them."""
    link = db.scalar(select(PanelJuror).where(PanelJuror.panel_id == panel_id, PanelJuror.juror_email == juror.email))
    panel = db.get(Panel, panel_id)
    if link is None or panel is None:
        raise ApiError("You are not a judge on this panel.", 403)
    if db.scalar(select(PanelTeam.team_id).where(PanelTeam.panel_id == panel_id, PanelTeam.team_id == team_id)) is None:
        raise ApiError("This team is not allotted to your panel.", 403)
    # Locks the round state for the length of the save, so a lock by the organisers is never overtaken.
    if db.scalar(select(AppState).where(AppState.key == _round_key(panel.round)).with_for_update(read=True)) is None:
        raise ApiError("Judging is locked. Scores can be saved once the organisers open this round.", 423)
    team = db.get(Team, team_id)
    if team is None or team.status != "submitted":
        raise ApiError("This team has been withdrawn or disqualified, so it is not scored.", 409)

    now = utcnow()
    statement = (
        insert(Score)
        .values(
            id=uuid.uuid4(),
            round=panel.round,
            team_id=team_id,
            juror_email=juror.email,
            marks=data.marks,
            total=sum(data.marks),
            remarks=data.remarks,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_update(
            index_elements=["round", "team_id", "juror_email"],
            set_={"marks": data.marks, "total": sum(data.marks), "remarks": data.remarks, "updated_at": now},
        )
    )
    db.execute(statement)
    audit.record(db, juror.email, "judging.scored", team, f"{sum(data.marks)}/{rules.RUBRIC_TOTAL} in {panel.name}")
    db.commit()
    score = db.scalar(
        select(Score)
        .where(Score.round == panel.round, Score.team_id == team_id, Score.juror_email == juror.email)
        .execution_options(populate_existing=True)
    )
    assert score is not None
    return _score_out(score)
