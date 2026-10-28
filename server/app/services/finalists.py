"""
Locking the finalist list for the Grand Finale: one button, pressed once by a super admin after the department results are
released.

The department winners the release named (every winning place of every problem statement of every department) are the
finalists. Locking:
- makes them the department's nominations and publishes them: each becomes a "finalist" and every other submitted
  department team "not selected", exactly as publishing results does (if results were already published from
  nominations, those finalists stay as they are);
- locks the department round's judging if it is still open;
- and from then on nothing can change the list: the release cannot be withdrawn, results cannot be unpublished, the
  department round cannot be opened again, nominations and quotas cannot change.

A winner who was disqualified or withdrew after the release is not a finalist; the confirmation screen says how many.
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..errors import ApiError
from ..models import Admin, AppState, Award, FinalistNomination, Team, utcnow
from ..schemas import LockFinalistsInput, LockFinalistsOut
from . import admin as admin_service
from . import audit, judging, release

LOCK_PHRASE = "LOCK"
NOMINATED_BY = "finalist lock: "


def winners(db: Session) -> tuple[list[Team], list[Team]]:
    """The department winners still taking part, and those who no longer are (disqualified or withdrawn since)."""
    teams = list(db.scalars(select(Team).join(Award, Award.team_id == Team.id).where(Award.round == "department").order_by(Team.number)))
    taking_part = [t for t in teams if t.status == "submitted" and t.route == "department"]
    return taking_part, [t for t in teams if t not in taking_part]


def lock_blocker(db: Session) -> str | None:
    """Why the finalist list cannot be locked now, or None."""
    if admin_service.finalists_locked(db) is not None:
        return "The finalist list is already locked."
    if not release.is_released(db):
        return "Release the department results first (Leaderboard page): the department winners become the finalists."
    published = admin_service._results_published(db)
    if published is None and not winners(db)[0]:
        return "No department winner is still taking part, so there is nobody to lock in."
    return None


def lock(db: Session, admin: Admin, data: LockFinalistsInput) -> LockFinalistsOut:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can lock the finalist list.", 403)
    if data.confirm.strip().upper() != LOCK_PHRASE:
        raise ApiError(f"Type {LOCK_PHRASE} to confirm. The finalist list cannot be unlocked from the panel.", 422)
    # The same locks as publishing results, the release and department awards, in that order everywhere.
    admin_service._lock_state(db, f"{admin_service.RESULTS_KEY}_lock")
    admin_service._lock_state(db, "awards_lock:department")
    admin_service._lock_state(db, f"{release.RELEASE_KEY}_lock")
    if blocked := lock_blocker(db):
        raise ApiError(blocked, 409)

    now = utcnow()
    taking_part, gone = winners(db)
    finalists = not_selected = 0
    if admin_service._results_published(db) is None:
        # The winners become the nominations, then results are published from them.
        db.execute(delete(FinalistNomination))
        for team in taking_part:
            db.add(
                FinalistNomination(
                    team_id=team.id,
                    department=team.department or "",
                    category=team.category,
                    nominated_by=f"{NOMINATED_BY}{admin.email}",
                    nominated_at=now,
                )
            )
        winner_ids = {t.id for t in taking_part}
        for team in db.scalars(select(Team).where(Team.route == "department", Team.status == "submitted").with_for_update()):
            if team.id in winner_ids:
                team.result = "finalist"
                finalists += 1
            else:
                team.result = "not_selected"
                not_selected += 1
        db.add(AppState(key=admin_service.RESULTS_KEY, value=admin.email, updated_at=now))
        published_now = True
    else:
        finalists = len(list(db.scalars(select(Team.id).where(Team.route == "department", Team.result == "finalist"))))
        not_selected = len(list(db.scalars(select(Team.id).where(Team.route == "department", Team.result == "not_selected"))))
        published_now = False

    department_locked = False
    open_state = db.get(AppState, judging._round_key("department"))
    if open_state is not None:
        db.delete(open_state)
        db.merge(AppState(key="judging_closed:department", value=admin.email, updated_at=now))
        department_locked = True

    db.add(AppState(key=admin_service.FINALISTS_LOCK_KEY, value=admin.email, updated_at=now))
    audit.record(
        db,
        admin.email,
        "results.finalists_locked",
        detail=f"Finalist list locked: {finalists} finalists, {not_selected} not selected"
        + (" (the department winners, published now)" if published_now else " (as already published)")
        + (f"; {len(gone)} winner(s) no longer taking part left out" if gone and published_now else "")
        + ("; department round judging locked" if department_locked else ""),
    )
    db.commit()
    return LockFinalistsOut(locked_at=now, finalists=finalists, not_selected=not_selected, left_out=len(gone) if published_now else 0)
