"""
The Grand Finale section (super admins): every finale team in one list, where it exhibits, the section it is ranked in,
the finale judges' switch, and publishing the results.

- Every team that takes part (department winners, Centres of Excellence, technical clubs, schools, other colleges,
  start-ups, wild cards) has an octonorm number (final_tents) and can be moved to a building and room instead
  (finale_entries). Its section is its own (services/sections.py) unless a super admin moved it.
- Publishing names 1st and 2nd of every section from the live rankings (teams scored by every judge of their panel), keeps
  winners a super admin declared by hand, locks Grand Finale judging and shows the results to students. From then on only
  a super admin can change marks, and the winners follow those changes at once (sync_awards). Withdrawing takes back the
  winners publishing named and hides the results again.
- Students see their octonorm only once the registration desk has registered them (services/desk.py).
"""

import uuid
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import rules
from ..errors import ApiError
from ..models import (
    Admin,
    AppState,
    Attendance,
    Award,
    FinaleEntry,
    FinaleHandout,
    FinalTent,
    Juror,
    Panel,
    PanelJuror,
    PanelTeam,
    Score,
    Team,
    TeamMember,
    User,
    utcnow,
)
from ..schemas import (
    FinaleAllotInput,
    FinaleAllotOut,
    FinaleAllotPanelOut,
    FinaleCardOut,
    FinaleEntriesInput,
    FinaleGroupOut,
    FinaleOut,
    FinalePreviewOut,
    FinalePublishInput,
    FinaleSettingsInput,
    FinaleTeamOut,
    FinaleUnpublishInput,
    FinaleWinnerOut,
)
from . import admin as admin_service
from . import audit, judging, sections

ROUND = "final"
PUBLISH_PHRASE = "PUBLISH"
# Awards publishing named (taken back on withdrawing, and worked out again after a super admin changes marks).
FINALE_MARK = "finale:"
PUBLISHED_KEY = judging._awards_key(ROUND)


def _require_super(admin: Admin) -> None:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can manage the Grand Finale.", 403)


def published(db: Session) -> AppState | None:
    return db.get(AppState, PUBLISHED_KEY)


def _finale_teams(db: Session) -> list[Team]:
    return list(db.scalars(select(Team).where(judging._eligible_condition(ROUND)).order_by(Team.number)))


# ---------- The list ----------


def overview(db: Session, admin: Admin) -> FinaleOut:
    _require_super(admin)
    teams = _finale_teams(db)
    ids = [t.id for t in teams]
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent)).tuples().all())
    entries = {e.team_id: e for e in db.scalars(select(FinaleEntry).where(FinaleEntry.team_id.in_(ids)))} if ids else {}
    section_of = sections.of_teams(db, teams)
    clubs = sections.clubs_of(db, teams)
    panel_of = dict(
        db.execute(select(PanelTeam.team_id, PanelTeam.panel_id).where(PanelTeam.round == ROUND, PanelTeam.team_id.in_(ids))).tuples().all()
    )
    panels = {p.id: p for p in db.scalars(select(Panel).where(Panel.round == ROUND))}
    judges = Counter(db.scalars(select(PanelJuror.panel_id).where(PanelJuror.panel_id.in_(list(panels)))))
    # Only marks of the team's own panel's judges count, as in the rankings.
    scores = Counter(
        db.scalars(
            select(Score.team_id)
            .join(PanelTeam, (PanelTeam.team_id == Score.team_id) & (PanelTeam.round == Score.round))
            .join(PanelJuror, (PanelJuror.panel_id == PanelTeam.panel_id) & (PanelJuror.juror_email == Score.juror_email))
            .where(Score.round == ROUND, Score.team_id.in_(ids))
        )
    )
    # Every judge with Grand Finale marks for the team, also ones no longer on its panel (e.g. a try-out).
    marked_by: dict[uuid.UUID, list[str]] = {}
    for team_id, email in db.execute(
        select(Score.team_id, Score.juror_email).where(Score.round == ROUND, Score.team_id.in_(ids)).order_by(Score.juror_email)
    ):
        marked_by.setdefault(team_id, []).append(email)
    members = Counter(db.scalars(select(TeamMember.team_id).where(TeamMember.team_id.in_(ids))))
    registered = Counter(
        db.scalars(
            select(Attendance.team_id)
            .join(TeamMember, (TeamMember.user_id == Attendance.user_id) & (TeamMember.team_id == Attendance.team_id))
            .where(Attendance.round == ROUND, Attendance.status == "present", Attendance.team_id.in_(ids))
        )
    )
    handouts = list(db.scalars(select(FinaleHandout).where(FinaleHandout.team_id.in_(ids))))
    id_cards = Counter(h.team_id for h in handouts if h.id_card_at)
    coupons = Counter(h.team_id for h in handouts if h.coupon_at)
    summaries = {s.id: s for s in admin_service.summaries(db, teams)}
    state = published(db)

    out = []
    for team in teams:
        entry = entries.get(team.id)
        panel = panels.get(panel_of[team.id]) if team.id in panel_of else None
        out.append(
            FinaleTeamOut(
                team=summaries[team.id],
                octonorm=tents.get(team.id),
                building=entry.building if entry else "",
                room=entry.room if entry else "",
                club=clubs.get(team.id, ""),
                section=section_of[team.id],
                default_section=sections.default_section(team),
                wildcard=bool(entry and entry.wildcard),
                panel_id=panel.id if panel else None,
                panel=judging.room_label(panel) if panel else None,
                judges=judges.get(panel.id, 0) if panel else 0,
                scores=scores.get(team.id, 0),
                marked_by=marked_by.get(team.id, []),
                members=members.get(team.id, 0),
                registered=registered.get(team.id, 0),
                id_cards=id_cards.get(team.id, 0),
                coupons=coupons.get(team.id, 0),
            )
        )
    out.sort(key=lambda t: (t.octonorm is None, judging._natural(t.octonorm or ""), t.team.code))
    return FinaleOut(
        teams=out,
        sections=rules.FINALE_SECTIONS,
        round_open=judging.round_open(db, ROUND),
        judges_can_edit=sections.judges_can_edit(db),
        published_at=state.updated_at if state else None,
        published_by=state.value if state else None,
    )


def save_entries(db: Session, admin: Admin, data: FinaleEntriesInput) -> FinaleOut:
    """
    Sets each listed team's octonorm, building and room, and section (other teams keep theirs). An octonorm belongs to one
    team; a building and room can hold several teams.
    """
    _require_super(admin)
    admin_service._lock_state(db, "tents_lock")
    wanted = {e.team_id: e for e in data.entries}
    if len(wanted) != len(data.entries):
        raise ApiError("A team is listed twice.", 422)
    labels = {team_id: judging._tent_label(e.octonorm) for team_id, e in wanted.items()}
    given = [label for label in labels.values() if label]
    if len(set(given)) != len(given):
        duplicate = next(label for label in given if given.count(label) > 1)
        raise ApiError(f"Octonorm {duplicate} is given to more than one team.", 422)
    teams = {t.id: t for t in db.scalars(select(Team).where(Team.id.in_(list(wanted)), judging._eligible_condition(ROUND)))}
    if len(teams) != len(wanted):
        raise ApiError("One of these teams is not taking part in the Grand Finale. Reload and try again.", 422)
    clash = db.execute(
        select(FinalTent.tent, Team.number)
        .join(Team, Team.id == FinalTent.team_id)
        .where(FinalTent.tent.in_(given), FinalTent.team_id.not_in(list(wanted)))
    ).first()
    if clash:
        raise ApiError(f"Octonorm {clash[0]} is already allotted to IT26-{clash[1]:04d}.", 409)

    tents = {t.team_id: t for t in db.scalars(select(FinalTent).where(FinalTent.team_id.in_(list(wanted))))}
    entries = {e.team_id: e for e in db.scalars(select(FinaleEntry).where(FinaleEntry.team_id.in_(list(wanted))).with_for_update())}
    now = utcnow()
    changes: list[str] = []
    # Clear the octonorms that change first, so two teams can swap numbers in one save.
    for team_id, label in labels.items():
        tent = tents.get(team_id)
        if tent is not None and tent.tent != label:
            db.delete(tent)
    db.flush()
    for team_id, item in wanted.items():
        team = teams[team_id]
        label, tent = labels[team_id], tents.get(team_id)
        before = tent.tent if tent else None
        if label and label != before:
            db.add(FinalTent(team_id=team_id, tent=label, assigned_by=admin.email))
        building, room = " ".join(item.building.split()), " ".join(item.room.split())
        section = None if item.section in (None, sections.default_section(team)) else item.section
        entry = entries.get(team_id)
        old = (entry.building, entry.room, entry.section) if entry else ("", "", None)
        if (building, room, section) != old:
            if entry is None:
                entry = FinaleEntry(team_id=team_id, updated_by=admin.email)
                db.add(entry)
            entry.building, entry.room, entry.section = building, room, section
            entry.updated_at, entry.updated_by = now, admin.email
        parts = []
        if label != before:
            parts.append(f"octonorm {before or 'none'} -> {label or 'none'}")
        if (building, room) != old[:2]:
            parts.append(f"place -> {judging.place_label(building, room) or 'its octonorm'}")
        if section != old[2]:
            parts.append(f"section -> {rules.FINALE_SECTIONS[section or sections.default_section(team)]}")
        if parts:
            changes.append(f"{team.code}: {', '.join(parts)}")
    if changes:
        audit.record(db, admin.email, "finale.entries_saved", detail="; ".join(changes)[:4000])
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError("Another organiser changed the octonorms at the same time. Reload and try again.", 409) from exc
    return overview(db, admin)


def set_settings(db: Session, admin: Admin, data: FinaleSettingsInput) -> FinaleOut:
    """The super admin's switch: whether Grand Finale judges may change marks they already saved."""
    _require_super(admin)
    state = db.get(AppState, sections.JUDGE_EDITS_OFF_KEY)
    if data.judges_can_edit and state is not None:
        db.delete(state)
        audit.record(db, admin.email, "finale.judge_edits", detail="Grand Finale judges can change their saved marks")
    elif not data.judges_can_edit and state is None:
        db.add(AppState(key=sections.JUDGE_EDITS_OFF_KEY, value=admin.email, updated_at=utcnow()))
        audit.record(db, admin.email, "finale.judge_edits", detail="Grand Finale judges can no longer change their saved marks")
    db.commit()
    return overview(db, admin)


def entry_for_new_team(db: Session, admin: Admin, team: Team, octonorm: str | None, building: str, room: str) -> None:
    """A wild card team just added by a super admin: its octonorm and place, in the same transaction."""
    label = judging._tent_label(octonorm)
    if label:
        holder = db.scalar(select(Team.number).join(FinalTent, FinalTent.team_id == Team.id).where(FinalTent.tent == label))
        if holder is not None:
            raise ApiError(f"Octonorm {label} is already allotted to IT26-{holder:04d}.", 409)
        db.add(FinalTent(team_id=team.id, tent=label, assigned_by=admin.email))
    db.add(
        FinaleEntry(
            team_id=team.id,
            building=" ".join(building.split()),
            room=" ".join(room.split()),
            wildcard=True,
            updated_by=admin.email,
        )
    )


# ---------- Results ----------


@dataclass
class _Group:
    key: str
    label: str
    teams: int = 0
    not_ranked: int = 0
    winners: list[tuple[int, object]] = field(default_factory=list)  # (place, RankedTeam)
    kept: bool = False
    tie_at_cut: bool = False


def _plan(db: Session, admin: Admin) -> list[_Group]:
    """1st and 2nd of every section as the rankings stand. Winners a super admin declared by hand are kept as declared."""
    ranked = judging.rankings(db, admin, ROUND, None)
    taking_part = {t.id for t in _finale_teams(db)}
    plan = []
    for group in ranked.groups:
        teams = [t for t in group.teams if t.team.id in taking_part]
        g = _Group(group.key, group.label, teams=len(teams), not_ranked=sum(1 for t in teams if not t.complete))
        by_hand = [t for t in teams if t.award is not None and not t.award.declared_by.startswith(FINALE_MARK)]
        if by_hand:
            g.kept = True
            g.winners = sorted(((t.award.place, t) for t in by_hand if t.award), key=lambda w: w[0])
        else:
            # Teams that left (withdrawn, disqualified) are skipped and the ones below move up.
            complete = [t for t in teams if t.position is not None]
            g.winners = [(i + 1, t) for i, t in enumerate(complete[: rules.FINALE_PLACES])]
            # Level teams (average, innovation, query addressing) among the named places or just after the last one:
            # the rankings cannot split them, so the organisers decide by declaring the places by hand.
            g.tie_at_cut = any(t.tied for t in complete[1 : rules.FINALE_PLACES + 1])
        plan.append(g)
    return plan


def _section_of_key(key: str) -> str:
    return key.rsplit("-", 1)[0]


def preview(db: Session, admin: Admin) -> FinalePreviewOut:
    _require_super(admin)
    state = published(db)
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent)).tuples().all())
    return FinalePreviewOut(
        published_at=state.updated_at if state else None,
        published_by=state.value if state else None,
        round_open=judging.round_open(db, ROUND),
        groups=[
            FinaleGroupOut(
                key=g.key,
                label=g.label,
                teams=g.teams,
                not_ranked=g.not_ranked,
                declared_by_hand=g.kept,
                tie_at_cut=g.tie_at_cut,
                winners=[
                    FinaleWinnerOut(
                        place=place,
                        team_id=t.team.id,
                        team_name=t.team.name,
                        team_code=t.team.code,
                        octonorm=tents.get(t.team.id),
                        average=t.average,
                        amount=rules.finale_prize(_section_of_key(g.key), t.team.category, place) or 0,
                    )
                    for place, t in g.winners
                ],
            )
            for g in _plan(db, admin)
        ],
    )


def _name_winners(db: Session, admin: Admin) -> int:
    """Replaces the winners publishing named with the ones the rankings give now. Returns how many it named."""
    db.execute(delete(Award).where(Award.round == ROUND, Award.declared_by.like(f"{FINALE_MARK}%")))
    db.flush()
    named = 0
    for g in _plan(db, admin):
        if g.kept:
            continue
        for place, ranked in g.winners:
            db.add(
                Award(
                    round=ROUND,
                    team_id=ranked.team.id,
                    group_key=g.key,
                    place=place,
                    amount=rules.finale_prize(_section_of_key(g.key), ranked.team.category, place) or 0,
                    declared_by=f"{FINALE_MARK}{admin.email}",
                )
            )
            named += 1
    return named


def publish(db: Session, admin: Admin, data: FinalePublishInput) -> FinalePreviewOut:
    """
    Super admin: names the winners, locks Grand Finale judging and shows the results to students. Afterwards only a super
    admin can change marks (and the winners follow).
    """
    _require_super(admin)
    if data.confirm.strip().upper() != PUBLISH_PHRASE:
        raise ApiError(f"Type {PUBLISH_PHRASE} to confirm.", 422)
    admin_service._lock_state(db, f"awards_lock:{ROUND}")
    if published(db) is not None:
        raise ApiError("The Grand Finale results are already published.", 409)
    named = _name_winners(db, admin)
    if not named and not db.scalar(select(func.count()).select_from(Award).where(Award.round == ROUND)):
        raise ApiError("No team has been scored by every judge of its panel yet, so there is nothing to publish.", 409)
    now = utcnow()
    closed = False
    open_state = db.get(AppState, judging._round_key(ROUND))
    if open_state is not None:
        db.delete(open_state)
        db.merge(AppState(key=f"judging_closed:{ROUND}", value=admin.email, updated_at=now))
        closed = True
    db.add(AppState(key=PUBLISHED_KEY, value=admin.email, updated_at=now))
    audit.record(
        db,
        admin.email,
        "finale.results_published",
        detail=f"Grand Finale results published: {named} winning places named" + ("; Grand Finale judging locked" if closed else ""),
    )
    db.commit()
    return preview(db, admin)


def unpublish(db: Session, admin: Admin, data: FinaleUnpublishInput) -> FinalePreviewOut:
    """Super admin: hides the results again and takes back the winners publishing named. Judging stays locked until reopened."""
    _require_super(admin)
    admin_service._lock_state(db, f"awards_lock:{ROUND}")
    state = published(db)
    if state is None:
        raise ApiError("The Grand Finale results are not published.", 409)
    db.execute(delete(Award).where(Award.round == ROUND, Award.declared_by.like(f"{FINALE_MARK}%")))
    db.delete(state)
    reason = " ".join(data.reason.split())
    audit.record(
        db, admin.email, "finale.results_withdrawn", detail="Grand Finale results hidden again" + (f". Reason: {reason}" if reason else "")
    )
    db.commit()
    return preview(db, admin)


def clear_marks(db: Session, admin: Admin, team_id: uuid.UUID) -> FinaleOut:
    """
    Removes every Grand Finale mark saved for one team, by any judge (e.g. marks given while trying the panel out), so it
    is judged afresh. Its department-round marks, octonorm, registration and room stay as they are. Recorded.
    """
    _require_super(admin)
    team = db.scalar(select(Team).where(Team.id == team_id, judging._eligible_condition(ROUND)))
    if team is None:
        raise ApiError("This team is not taking part in the Grand Finale.", 404)
    scores = list(
        db.scalars(select(Score).where(Score.round == ROUND, Score.team_id == team.id).order_by(Score.juror_email).with_for_update())
    )
    if scores:
        removed = "; ".join(f"{s.juror_email} {s.total}/{rules.RUBRIC_TOTAL}" for s in scores)
        for score in scores:
            db.delete(score)
        audit.record(db, admin.email, "judging.score_removed", team, f"All {len(scores)} Grand Finale marks removed ({removed})")
        db.flush()
        sync_awards(db, admin)
        db.commit()
    return overview(db, admin)


def split_evenly[T](items: list[T], parts: int) -> list[list[T]]:
    """Consecutive runs, in order, whose sizes differ by one at most (the first runs take the extra ones)."""
    size, extra = divmod(len(items), parts)
    runs, start = [], 0
    for index in range(parts):
        end = start + size + (1 if index < extra else 0)
        runs.append(items[start:end])
        start = end
    return runs


def share_judges(counts: list[int], judges: int) -> list[int]:
    """
    How many judges each venue gets, in proportion to its teams (largest remainder), at least one per venue and never
    more judges than teams. Needs at least as many judges as venues and as many teams as judges.
    """
    total = sum(counts)
    exact = [judges * c / total for c in counts]
    shares = [max(1, min(c, int(e))) for c, e in zip(counts, exact, strict=True)]
    while sum(shares) < judges:
        open_ = [i for i, c in enumerate(counts) if shares[i] < c]
        shares[max(open_, key=lambda i: (exact[i] - shares[i], counts[i]))] += 1
    while sum(shares) > judges:
        shares[max((i for i in range(len(counts)) if shares[i] > 1), key=lambda i: (shares[i] - exact[i], -counts[i]))] -= 1
    return shares


def allot(db: Session, admin: Admin, data: FinaleAllotInput) -> FinaleAllotOut:
    """
    Splits the chosen sections' teams, in stall (octonorm) order, into one consecutive run per judge, in the order the
    judges are given. When teams are placed in venues (a building, a floor, the badminton court), a panel never spans two:
    each venue gets judges in proportion to its teams, and its teams are shared out evenly among them ("G Block · Floor 3 ·
    Panel 9 · F3-01 to F3-12"). Teams already on a Grand Finale panel and teams without a stall are left out (and listed).
    With `apply`, the panels are made, each with its teams and its judge, all at once or not at all.
    """
    _require_super(admin)
    emails = [e.strip().lower() for e in data.judges]
    if len(set(emails)) != len(emails):
        raise ApiError("A judge is listed twice.", 422)
    if data.apply:
        admin_service._lock_state(db, "panels_lock")
    jurors = {j.email: j for j in db.scalars(select(Juror).where(Juror.email.in_(emails)).order_by(Juror.email).with_for_update())}
    missing = [e for e in emails if e not in jurors]
    if missing:
        raise ApiError(f"Not appointed as judges yet: {', '.join(missing)}. Add them under Judging, Judges first.", 422)
    seated = dict(
        db.execute(
            select(PanelJuror.juror_email, Panel.name)
            .join(Panel, Panel.id == PanelJuror.panel_id)
            .where(Panel.round == ROUND, PanelJuror.juror_email.in_(emails))
        ).all()
    )
    if seated:
        taken = ", ".join(f"{jurors[e].name} ({name})" for e, name in seated.items())
        raise ApiError(f"Already on a Grand Finale panel: {taken}. A judge sits on one panel only.", 409)

    teams = _finale_teams(db)
    section_of = sections.of_teams(db, teams)
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent)).tuples().all())
    on_panel = set(db.scalars(select(PanelTeam.team_id).where(PanelTeam.round == ROUND)))
    chosen = [t for t in teams if section_of[t.id] in data.sections]
    left_on_panel = [t.code for t in chosen if t.id in on_panel]
    no_octonorm = [t.code for t in chosen if t.id not in on_panel and not tents.get(t.id)]
    pool = sorted((t for t in chosen if t.id not in on_panel and tents.get(t.id)), key=lambda t: judging._natural(tents[t.id]))
    if len(pool) < len(emails):
        raise ApiError(f"Only {len(pool)} teams to share among {len(emails)} judges. Choose fewer judges or more sections.", 422)

    # Venues in the order of their first stall; teams without a venue form one group of their own.
    venue_of = dict(
        db.execute(select(FinaleEntry.team_id, FinaleEntry.building).where(FinaleEntry.team_id.in_([t.id for t in pool]))).tuples().all()
    )
    venues: dict[str, list[Team]] = {}
    for t in pool:
        venues.setdefault(venue_of.get(t.id) or "", []).append(t)
    if len(venues) > len(emails):
        raise ApiError(
            f"The teams are in {len(venues)} venues but only {len(emails)} judges are listed: a judge sits in one venue only.", 422
        )
    blocks = [
        (venue, run)
        for (venue, teams_there), share in zip(venues.items(), share_judges([len(v) for v in venues.values()], len(emails)), strict=True)
        for run in split_evenly(teams_there, share)
    ]
    runs = list(zip(emails, blocks, strict=True))
    names = {name.lower() for name in db.scalars(select(Panel.name).where(Panel.round == ROUND))}
    planned = []
    for number, (email, (venue, run)) in enumerate(runs, 1):
        first, last = tents[run[0].id], tents[run[-1].id]
        if venue:
            name = f"Panel {number} · {first} to {last}" if first != last else f"Panel {number} · {first}"
        else:
            name = f"Panel {number} · Octonorms {first}-{last}" if first != last else f"Panel {number} · Octonorm {first}"
        if name.lower() in names:
            raise ApiError(f"A Grand Finale panel called {name!r} exists already. Rename or remove it first.", 409)
        planned.append(
            FinaleAllotPanelOut(
                name=judging.place_label(venue, "") + f" · {name}" if venue else name,
                venue=venue,
                juror_email=email,
                juror_name=jurors[email].name,
                first=first,
                last=last,
                teams=len(run),
            )
        )

    if data.apply:
        for plan, (email, (venue, run)) in zip(planned, runs, strict=True):
            name = plan.name.removeprefix(f"{venue} · ") if venue else plan.name
            panel = Panel(round=ROUND, building=venue, name=name, name_key=name.lower(), created_by=admin.email)
            db.add(panel)
            db.flush()
            db.add_all(PanelTeam(panel_id=panel.id, team_id=t.id, round=ROUND) for t in run)
            db.add(PanelJuror(panel_id=panel.id, juror_email=email))
        audit.record(
            db,
            admin.email,
            "judging.panels_allotted",
            detail=f"{len(planned)} Grand Finale panels by octonorm: " + "; ".join(f"{p.name} to {p.juror_email}" for p in planned),
        )
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ApiError("Panels changed while allotting. Reload and try again.", 409) from exc
    return FinaleAllotOut(panels=planned, applied=data.apply, on_a_panel=left_on_panel, no_octonorm=no_octonorm)


def sync_awards(db: Session, admin: Admin) -> None:
    """After a super admin changes marks while the results are published: the winners follow (caller commits)."""
    if published(db) is not None:
        _name_winners(db, admin)


# ---------- A student's own card ----------


def student_card(db: Session, user: User, team: Team) -> FinaleCardOut | None:
    """Grand Finale teams only. The octonorm (and place) show once the registration desk has registered this student."""
    if db.scalar(select(Team.id).where(Team.id == team.id, judging._eligible_condition(ROUND))) is None:
        return None
    mark = db.get(Attendance, (user.id, ROUND))
    registered = mark is not None and mark.status == "present" and mark.team_id == team.id
    members = db.scalar(select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team.id)) or 0
    team_registered = (
        db.scalar(
            select(func.count())
            .select_from(Attendance)
            .join(TeamMember, (TeamMember.user_id == Attendance.user_id) & (TeamMember.team_id == Attendance.team_id))
            .where(Attendance.round == ROUND, Attendance.status == "present", Attendance.team_id == team.id)
        )
        or 0
    )
    tent = db.get(FinalTent, team.id) if registered else None
    entry = db.get(FinaleEntry, team.id) if registered else None
    return FinaleCardOut(
        registered=registered,
        registered_at=mark.marked_at if registered and mark else None,
        octonorm=tent.tent if tent else None,
        place=judging.place_label(entry.building, entry.room) if entry else "",
        team_members=members,
        team_registered=team_registered,
    )
