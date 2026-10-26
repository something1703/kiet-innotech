"""
Releasing the department round's results: one button, pressed by a super admin.

Until it is pressed students and judges see nothing new. Pressing it:
- names the winners of every problem statement of every department from the live rankings: the teams placed within the
  problem statement's winning places (1, or 2 where the department has two; never more than 2), 1st place with the cash
  prize. Winners a department admin or super admin already declared by hand are kept as declared;
- shows the winners to students (the same switch as "Publish winners") and opens the certificates: the winner certificate
  for the winning teams, the participation certificate for everyone else, the judge certificate for judges who judged.
  Certificates only go to students marked present.

A problem statement gets no winner when no team in it was scored by every judge of its room (nobody scored, or the judges
did not finish) or when every team in it was absent. A team only ever ranks once all its judges scored it, so one that
scored nothing or whose students were all absent can never win.

Withdrawing hides it all again and takes back the winners this release named (not the ones declared by hand).
"""

from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import rules
from ..errors import ApiError
from ..models import AppState, Award, Panel, PanelJuror, Team, utcnow
from ..schemas import (
    ReleaseGroupOut,
    ReleaseInput,
    ReleaseOut,
    ReleaseReadinessOut,
    ReleaseWinnerOut,
    WithdrawReleaseInput,
)
from . import admin as admin_service
from . import audit, judging

RELEASE_KEY = "dept_results_released"
RELEASE_PHRASE = "RELEASE"
RELEASE_MARK = "release:"
MAX_WINNING_PLACES = 2  # awards.place is 1 or 2


def is_released(db: Session) -> bool:
    return db.get(AppState, RELEASE_KEY) is not None


def awards_published(db: Session) -> bool:
    return db.get(AppState, judging._awards_key("department")) is not None


@dataclass
class _Group:
    department: str
    category: int
    places: int
    winners: list[tuple[int, object]] = field(default_factory=list)  # (place, RankedTeam)
    kept: bool = False
    reason: str | None = None
    not_ranked: int = 0
    # The first team outside the winning places is level with the last winner on average, innovation and query addressing.
    tie_at_cut: bool = False
    # Why this problem statement cannot be released as it stands (a declared winner who is no longer taking part).
    blocker: str | None = None


def _require_super(admin) -> None:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can release the department results.", 403)


def _level(a, b) -> bool:
    """Two ranked teams are level: same average, innovation and query addressing."""
    return (a.average, a.innovation, a.query) == (b.average, b.innovation, b.query)


def _plan(db: Session, admin) -> list[_Group]:
    """
    Who wins each problem statement of each department, as it stands now. Only teams still taking part count: a team that was
    scored and then disqualified, withdrawn or rejected is skipped and the teams below it move up.
    """
    ranked = judging.rankings(db, admin, "department", None)
    quota = admin_service.quotas(db)
    taking_part = set(db.scalars(select(Team.id).where(judging._eligible_condition("department"))))
    groups: list[_Group] = []
    for group in ranked.groups:
        if group.department is None or group.category is None:
            continue
        places = min(
            MAX_WINNING_PLACES,
            max(1, quota.get((group.department, group.category), rules.finalist_quota(group.department, group.category))),
        )
        plan = _Group(group.department, group.category, places)
        teams = [t for t in group.teams if t.team.id in taking_part]
        plan.not_ranked = sum(1 for t in teams if not t.all_absent and not t.complete)
        declared = [t for t in group.teams if t.award is not None]
        gone = [t for t in declared if t.team.id not in taking_part]
        complete = sorted((t for t in teams if t.position is not None), key=lambda t: t.position or 0)
        if gone:
            plan.blocker = (
                f"{gone[0].team.name} ({gone[0].team.code}) was declared a winner but is no longer taking part: "
                "remove that winner on the Judging page first."
            )
        if declared and not gone:
            plan.kept = True
            plan.winners = sorted(((t.award.place, t) for t in declared if t.award), key=lambda w: w[0])
        elif complete:
            plan.winners = [(i + 1, t) for i, t in enumerate(complete[:places])]
            plan.tie_at_cut = len(complete) > len(plan.winners) and _level(complete[len(plan.winners) - 1], complete[len(plan.winners)])
        elif teams and all(t.all_absent for t in teams):
            plan.reason = "Every team in this problem statement was absent."
        elif not gone:
            plan.reason = "No team was scored by all the judges of its room, so none can be ranked."
        groups.append(plan)
    return groups


def _open_rooms(db: Session) -> int:
    now = judging.utcnow()
    count = 0
    for panel in db.scalars(select(Panel).where(Panel.round == "department", Panel.id.in_(select(PanelJuror.panel_id)))):
        closes = judging.scoring_window(panel)[1]
        if closes is not None and now <= closes:
            count += 1
    return count


def readiness(db: Session, admin) -> ReleaseReadinessOut:
    """What pressing the button would do, for the confirmation screen."""
    from . import certificates  # here: certificates imports this module for the switch

    _require_super(admin)
    plan = _plan(db, admin)
    winner_ids = {t.team.id for g in plan for _, t in g.winners}
    state = db.get(AppState, RELEASE_KEY)
    people = certificates.recipient_counts(db, winner_ids)
    return ReleaseReadinessOut(
        released=state is not None,
        released_by=state.value if state else None,
        released_at=state.updated_at if state else None,
        open_rooms=_open_rooms(db),
        groups=[
            ReleaseGroupOut(
                department=g.department,
                category=g.category,
                title=rules.CATEGORIES[g.category].title,
                places=g.places,
                winners=[
                    ReleaseWinnerOut(
                        place=place,
                        team_name=t.team.name,
                        team_code=t.team.code,
                        average=t.average,
                        prize=rules.prize("department", False, g.category, place) or 0,
                    )
                    for place, t in g.winners
                ],
                declared_by_hand=g.kept,
                reason=g.reason,
                not_ranked=g.not_ranked,
                tie_at_cut=g.tie_at_cut,
                blocker=g.blocker,
            )
            for g in plan
        ],
        winner_teams=len(winner_ids),
        groups_without_winner=sum(1 for g in plan if not g.winners),
        students=people["students"],
        present=people["present"],
        not_marked=people["not_marked"],
        absent=people["absent"],
        winner_students=people["winner_students"],
        participation_students=people["participation_students"],
        judges=people["judges"],
        templates=people["templates"],
    )


def release(db: Session, admin, data: ReleaseInput) -> ReleaseOut:
    _require_super(admin)
    if data.confirm.strip().upper() != RELEASE_PHRASE:
        raise ApiError(f"Type {RELEASE_PHRASE} to confirm.", 422)
    admin_service._lock_state(db, "awards_lock:department")
    admin_service._lock_state(db, f"{RELEASE_KEY}_lock")
    if db.get(AppState, RELEASE_KEY) is not None:
        raise ApiError("The department results are already released.", 409)
    if not judging.round_open(db, "department"):
        raise ApiError("The department round is not open for judging, so there is nothing to release.", 409)
    open_rooms = _open_rooms(db)
    if open_rooms and not data.release_with_open_rooms:
        raise ApiError(
            f"{open_rooms} room(s) are still open for judging. Release after their time is over, or choose to release anyway.", 409
        )
    plan = _plan(db, admin)
    blockers = [g.blocker for g in plan if g.blocker]
    if blockers:
        raise ApiError(blockers[0] + (f" ({len(blockers) - 1} more)" if len(blockers) > 1 else ""), 409)
    if not any(g.winners for g in plan):
        raise ApiError("No team has been scored by every judge of its room yet, so there is nothing to release.", 409)
    created = 0
    for g in plan:
        if g.kept:
            continue
        for place, ranked in g.winners:
            db.add(
                Award(
                    round="department",
                    team_id=ranked.team.id,
                    group_key=f"{g.department}-{g.category}",
                    place=place,
                    amount=rules.prize("department", False, g.category, place) or 0,
                    declared_by=f"{RELEASE_MARK}{admin.email}",
                )
            )
            created += 1
    now = utcnow()
    if db.get(AppState, judging._awards_key("department")) is None:
        db.add(AppState(key=judging._awards_key("department"), value=admin.email, updated_at=now))
    db.add(AppState(key=RELEASE_KEY, value=admin.email, updated_at=now))
    winners = sum(len(g.winners) for g in plan)
    without = sum(1 for g in plan if not g.winners)
    audit.record(
        db,
        admin.email,
        "judging.results_released",
        detail=f"Department results released: {winners} winning team(s), {without} problem statement(s) without a winner"
        + (f", {open_rooms} room(s) still open" if open_rooms else ""),
    )
    db.commit()
    return ReleaseOut(winners=winners, groups_without_winner=without, declared=created)


def withdraw(db: Session, admin, data: WithdrawReleaseInput) -> None:
    _require_super(admin)
    admin_service._lock_state(db, "awards_lock:department")
    admin_service._lock_state(db, f"{RELEASE_KEY}_lock")
    state = db.get(AppState, RELEASE_KEY)
    if state is None:
        raise ApiError("The department results are not released.", 409)
    db.execute(delete(Award).where(Award.round == "department", Award.declared_by.like(f"{RELEASE_MARK}%")))
    db.delete(state)
    awards_state = db.get(AppState, judging._awards_key("department"))
    if awards_state is not None:
        db.delete(awards_state)
    audit.record(
        db, admin.email, "judging.results_withdrawn", detail=f"Department results withdrawn. Reason: {' '.join(data.reason.split())}"
    )
    db.commit()
