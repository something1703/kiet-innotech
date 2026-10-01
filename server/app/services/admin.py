"""
Admin panel logic. Scoping is applied inside every query: a department admin only ever reads or changes
KIET teams and students of their own department; a super admin sees everything.
"""

import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field
from sqlalchemy import ColumnElement, String, and_, cast, delete, exists, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import rules
from ..config import Settings
from ..errors import ApiError
from ..models import Admin, AppState, AuditEntry, FinalistNomination, Invitation, Profile, Team, TeamMember, User, utcnow
from ..schemas import (
    AdminInput,
    AdminMemberOut,
    AdminOut,
    AdminStudentOut,
    AdminTeamOut,
    AuditOut,
    CategoryStats,
    DepartmentStats,
    DomainStats,
    FinalistBoardOut,
    FinalistCategoryOut,
    FinalistSummaryOut,
    InstitutionStats,
    MatrixCell,
    MatrixRow,
    NominationsInput,
    PublishOut,
    SizeStats,
    StatsOut,
    StatusCounts,
    StudentTeamRef,
    TeamSummaryOut,
    TimelinePoint,
    TypeStats,
    YearStats,
)
from . import audit, schedule
from .serializers import invitation_out, profile_out

RESULTS_KEY = "results_published"
STATUSES = ("draft", "submitted", "withdrawn", "disqualified")


def _is_super(admin: Admin) -> bool:
    return admin.role == "super_admin"


def _escape_like(text: str) -> str:
    return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def check_department(admin: Admin, department: str | None) -> None:
    if department is None:
        return
    if department not in rules.DEPARTMENTS:
        raise ApiError(f'Unknown department "{department}".', 422)
    if not _is_super(admin) and department != admin.department:
        raise ApiError(f"You can only view {admin.department} data.", 403)


# ---------- Scope ----------


def team_scope(admin: Admin) -> ColumnElement[bool]:
    if _is_super(admin):
        return Team.id.is_not(None)
    return and_(Team.participant_type == "kiet", Team.department == admin.department)


def student_scope(admin: Admin) -> ColumnElement[bool]:
    if _is_super(admin):
        return Profile.user_id.is_not(None)
    return and_(Profile.participant_type == "kiet", Profile.department == admin.department)


def _visible_team(db: Session, admin: Admin, team_id: uuid.UUID, lock: bool = False) -> Team:
    statement = select(Team).where(Team.id == team_id)
    if lock:
        statement = statement.with_for_update().execution_options(populate_existing=True)
    team = db.scalar(statement)
    if team is None:
        raise ApiError("Team not found.", 404)
    if not _is_super(admin) and not (team.participant_type == "kiet" and team.department == admin.department):
        raise ApiError(f"This team is not in {admin.department}.", 403)
    return team


# ---------- Serialising many teams at once ----------


def _leader_names(db: Session, teams: list[Team]) -> dict[uuid.UUID, str]:
    ids = {t.leader_id for t in teams}
    if not ids:
        return {}
    return dict(db.execute(select(Profile.user_id, Profile.full_name).where(Profile.user_id.in_(ids))).tuples().all())


def _member_counts(db: Session, team_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not team_ids:
        return {}
    rows = db.execute(select(TeamMember.team_id, func.count()).where(TeamMember.team_id.in_(team_ids)).group_by(TeamMember.team_id))
    return dict(rows.tuples().all())


def summaries(db: Session, teams: list[Team]) -> list[TeamSummaryOut]:
    leaders = _leader_names(db, teams)
    counts = _member_counts(db, [t.id for t in teams])
    return [
        TeamSummaryOut(
            id=t.id,
            code=t.code,
            name=t.name,
            category=t.category,
            participant_type=t.participant_type,
            institution=t.institution,
            department=t.department,
            route=t.route,
            status=t.status,
            result=t.result,
            leader_name=leaders.get(t.leader_id, ""),
            member_count=counts.get(t.id, 0),
            project_title=t.project_title,
            submitted_at=t.submitted_at,
        )
        for t in teams
    ]


def admin_teams(db: Session, teams: list[Team]) -> list[AdminTeamOut]:
    """Full team details for a list of teams, in three queries however long the list is."""
    ids = [t.id for t in teams]
    if not ids:
        return []
    members: dict[uuid.UUID, list[AdminMemberOut]] = defaultdict(list)
    rows = db.execute(
        select(TeamMember, Profile, User.email)
        .join(Profile, Profile.user_id == TeamMember.user_id)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id.in_(ids))
        .order_by(TeamMember.joined_at)
    ).all()
    for member, profile, email in rows:
        members[member.team_id].append(
            AdminMemberOut(
                user_id=member.user_id,
                full_name=profile.full_name,
                email=email,
                department=profile.department,
                course=profile.course,
                year=profile.year,
                role=member.role,
                joined_at=member.joined_at,
                phone=profile.phone,
                roll_number=profile.roll_number,
                institution=profile.institution,
            )
        )
    pending: dict[uuid.UUID, list[Invitation]] = defaultdict(list)
    for invitation in db.scalars(
        select(Invitation).where(Invitation.team_id.in_(ids), Invitation.status == "pending").order_by(Invitation.created_at)
    ):
        pending[invitation.team_id].append(invitation)
    leaders = _leader_names(db, teams)

    return [
        AdminTeamOut(
            id=t.id,
            code=t.code,
            join_code=t.join_code,
            name=t.name,
            category=t.category,
            domain=t.domain,
            project_title=t.project_title,
            abstract=t.abstract,
            participant_type=t.participant_type,
            institution=t.institution,
            department=t.department,
            route=t.route,
            leader_id=t.leader_id,
            members=sorted(members[t.id], key=lambda m: m.role != "leader"),
            invitations=[invitation_out(i, t, leaders.get(t.leader_id, "")) for i in pending[t.id]],
            status=t.status,
            result=t.result,
            created_at=t.created_at,
            submitted_at=t.submitted_at,
        )
        for t in teams
    ]


# ---------- Teams ----------


class Paging(BaseModel):
    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=25, ge=1, le=100)


class TeamFilters(Paging):
    department: str | None = None
    category: int | None = Field(default=None, ge=1, le=8)
    status: Literal["draft", "submitted", "withdrawn", "disqualified"] | None = None
    type: rules.ParticipantType | None = None
    route: Literal["department", "finale"] | None = None
    q: str | None = Field(default=None, max_length=100)
    sort: Literal["code", "name", "category", "department", "status", "members", "submitted_at"] = "code"
    order: Literal["asc", "desc"] = "asc"


def _team_query(admin: Admin, f: TeamFilters):
    check_department(admin, f.department)
    conditions = [team_scope(admin)]
    if f.department:
        conditions.append(Team.department == f.department)
    if f.category:
        conditions.append(Team.category == f.category)
    if f.status:
        conditions.append(Team.status == f.status)
    if f.type:
        conditions.append(Team.participant_type == f.type)
    if f.route:
        conditions.append(Team.route == f.route)
    if f.q and f.q.strip():
        pattern = _escape_like(f.q.strip())
        digits = cast(Team.number, String)
        # Same format as Team.code: at least four digits, never truncated.
        code = func.concat("IT26-", func.lpad(digits, func.greatest(4, func.length(digits)), "0"))
        member_match = exists(
            select(TeamMember.user_id)
            .join(Profile, Profile.user_id == TeamMember.user_id)
            .join(User, User.id == TeamMember.user_id)
            .where(
                TeamMember.team_id == Team.id,
                or_(Profile.full_name.ilike(pattern, escape="\\"), User.email.ilike(pattern, escape="\\")),
            )
        )
        conditions.append(
            or_(
                Team.name.ilike(pattern, escape="\\"),
                code.ilike(pattern, escape="\\"),
                Team.institution.ilike(pattern, escape="\\"),
                member_match,
            )
        )

    member_count = select(func.count()).where(TeamMember.team_id == Team.id).scalar_subquery()
    sort_column = {
        "code": Team.number,
        "name": Team.name_key,
        "category": Team.category,
        "department": func.coalesce(Team.department, Team.institution),
        "status": Team.status,
        "members": member_count,
        "submitted_at": Team.submitted_at,
    }[f.sort]
    ordered = sort_column.desc().nulls_last() if f.order == "desc" else sort_column.asc().nulls_last()
    tie = Team.number.desc() if f.order == "desc" else Team.number.asc()
    return select(Team).where(*conditions).order_by(ordered, tie), conditions


def list_teams(db: Session, admin: Admin, f: TeamFilters) -> tuple[list[AdminTeamOut], int]:
    statement, conditions = _team_query(admin, f)
    total = db.scalar(select(func.count()).select_from(Team).where(*conditions)) or 0
    teams = list(db.scalars(statement.offset((f.page - 1) * f.page_size).limit(f.page_size)))
    return admin_teams(db, teams), total


def export_teams(db: Session, admin: Admin, f: TeamFilters) -> list[AdminTeamOut]:
    statement, _ = _team_query(admin, f)
    return admin_teams(db, list(db.scalars(statement)))


def get_team(db: Session, admin: Admin, team_id: uuid.UUID) -> AdminTeamOut:
    return admin_teams(db, [_visible_team(db, admin, team_id)])[0]


def _require_super(admin: Admin, what: str) -> None:
    if not _is_super(admin):
        raise ApiError(f"Only a super admin can {what}.", 403)


def _results_published(db: Session) -> AppState | None:
    return db.get(AppState, RESULTS_KEY)


def change_status(
    db: Session, admin: Admin, team_id: uuid.UUID, action: Literal["withdraw", "disqualify", "restore"], reason: str
) -> AdminTeamOut:
    if action in ("disqualify", "restore"):
        _require_super(admin, f"{action} teams")
    team = _visible_team(db, admin, team_id, lock=True)

    published = _results_published(db) is not None
    if action == "restore":
        if team.status not in ("withdrawn", "disqualified"):
            raise ApiError("Only withdrawn or disqualified teams can be restored.", 409)
        # Members of a withdrawn team may have left to join other teams.
        leader_still_in = db.scalar(select(TeamMember.user_id).where(TeamMember.team_id == team.id, TeamMember.user_id == team.leader_id))
        member_count = _member_counts(db, [team.id]).get(team.id, 0)
        if leader_still_in is None or (team.submitted_at and member_count < rules.TEAM_MIN_SIZE):
            raise ApiError("Members have left this team since it was withdrawn, so it cannot be restored.", 409)
        team.status = "submitted" if team.submitted_at else "draft"
        team.status_reason = None
        if published and team.route == "department" and team.status == "submitted":
            nominated = db.get(FinalistNomination, team.id) is not None
            team.result = "finalist" if nominated else "not_selected"
        audit.record(db, admin.email, "team.restored", team, reason)
    else:
        if team.status not in ("draft", "submitted"):
            raise ApiError(f"This team is already {team.status}.", 409)
        team.status = "withdrawn" if action == "withdraw" else "disqualified"
        team.status_reason = reason
        db.execute(
            update(Invitation)
            .where(Invitation.team_id == team.id, Invitation.status == "pending")
            .values(status="cancelled", responded_at=utcnow())
        )
        if published:
            # Nominations are locked after publishing; keep the record so a restore brings the result back.
            if team.route == "department" and team.result == "finalist":
                team.result = "not_selected"
        else:
            # Frees the nomination so the department can pick another team.
            db.execute(delete(FinalistNomination).where(FinalistNomination.team_id == team.id))
        audit.record(db, admin.email, f"team.{team.status}", team, reason)
    db.commit()
    return admin_teams(db, [team])[0]


# ---------- Students ----------


class StudentFilters(Paging):
    department: str | None = None
    type: rules.ParticipantType | None = None
    year: int | None = Field(default=None, ge=1, le=12)
    in_team: Literal["yes", "no"] | None = None
    q: str | None = Field(default=None, max_length=100)
    sort: Literal["name", "email", "department", "year", "institution", "created_at"] = "name"
    order: Literal["asc", "desc"] = "asc"


def _student_query(admin: Admin, f: StudentFilters):
    check_department(admin, f.department)
    conditions = [student_scope(admin)]
    if f.department:
        conditions.append(Profile.department == f.department)
    if f.type:
        conditions.append(Profile.participant_type == f.type)
    if f.year:
        conditions.append(Profile.year == f.year)
    in_team = exists(select(TeamMember.user_id).where(TeamMember.user_id == Profile.user_id))
    if f.in_team == "yes":
        conditions.append(in_team)
    elif f.in_team == "no":
        conditions.append(~in_team)
    if f.q and f.q.strip():
        pattern = _escape_like(f.q.strip())
        conditions.append(
            or_(
                *(
                    column.ilike(pattern, escape="\\")
                    for column in (Profile.full_name, User.email, Profile.roll_number, Profile.institution, Profile.phone)
                )
            )
        )
    sort_column = {
        "name": func.lower(Profile.full_name),
        "email": User.email,
        "department": func.coalesce(Profile.department, Profile.institution),
        "year": Profile.year,
        "institution": Profile.institution,
        "created_at": Profile.created_at,
    }[f.sort]
    ordered = sort_column.desc() if f.order == "desc" else sort_column.asc()
    statement = (
        select(Profile, User.email, TeamMember, Team)
        .join(User, User.id == Profile.user_id)
        .outerjoin(TeamMember, TeamMember.user_id == Profile.user_id)
        .outerjoin(Team, Team.id == TeamMember.team_id)
        .where(*conditions)
        .order_by(ordered, Profile.user_id)
    )
    count = select(func.count()).select_from(Profile).join(User, User.id == Profile.user_id).where(*conditions)
    return statement, count


def _student_rows(rows) -> list[AdminStudentOut]:
    result = []
    for profile, email, membership, team in rows:
        base = profile_out(profile, email).model_dump()
        ref = (
            StudentTeamRef(id=team.id, code=team.code, name=team.name, status=team.status, department=team.department, role=membership.role)
            if team is not None
            else None
        )
        result.append(AdminStudentOut(**base, team=ref))
    return result


def list_students(db: Session, admin: Admin, f: StudentFilters) -> tuple[list[AdminStudentOut], int]:
    statement, count = _student_query(admin, f)
    total = db.scalar(count) or 0
    return _student_rows(db.execute(statement.offset((f.page - 1) * f.page_size).limit(f.page_size)).all()), total


def export_students(db: Session, admin: Admin, f: StudentFilters) -> list[AdminStudentOut]:
    statement, _ = _student_query(admin, f)
    return _student_rows(db.execute(statement).all())


# ---------- Stats ----------


def _counts(statuses: list[str]) -> dict[str, int]:
    tally = Counter(statuses)
    return {"total": len(statuses), **{status: tally.get(status, 0) for status in STATUSES}}


IST = ZoneInfo("Asia/Kolkata")
ACTIVE = ("draft", "submitted")
# A guard on the timeline length, should the registration dates ever be misconfigured.
TIMELINE_MAX_DAYS = 120


def _ist_day(moment: datetime) -> date:
    return moment.astimezone(IST).date()


def _timeline(
    window: schedule.Schedule, profile_times: list[datetime], team_times: list[datetime], submit_times: list[datetime]
) -> list[TimelinePoint]:
    """Daily counts in IST, from registration opening (or the first record) to today, with empty days filled in."""
    students = Counter(_ist_day(t) for t in profile_times)
    teams = Counter(_ist_day(t) for t in team_times)
    submitted = Counter(_ist_day(t) for t in submit_times)
    days = set(students) | set(teams) | set(submitted)
    start = min([_ist_day(window.opens), *days])
    end = max([min(_ist_day(utcnow()), _ist_day(window.closes)), *days])
    if end < start:
        return []
    start = max(start, end - timedelta(days=TIMELINE_MAX_DAYS - 1))
    return [
        TimelinePoint(date=day, students=students[day], teams=teams[day], submitted=submitted[day])
        for day in (start + timedelta(days=offset) for offset in range((end - start).days + 1))
    ]


def stats(db: Session, admin: Admin, settings: Settings) -> StatsOut:
    window = schedule.load(db, settings)
    teams = db.execute(
        select(
            Team.id,
            Team.status,
            Team.category,
            Team.participant_type,
            Team.department,
            Team.domain,
            Team.institution_key,
            Team.created_at,
            Team.submitted_at,
        ).where(team_scope(admin))
    ).all()
    students = db.execute(
        select(
            Profile.participant_type,
            Profile.department,
            exists(select(TeamMember.user_id).where(TeamMember.user_id == Profile.user_id)).label("in_team"),
            Profile.year,
            Profile.institution,
            Profile.institution_key,
            Profile.city,
            Profile.created_at,
        ).where(student_scope(admin))
    ).all()
    sizes = dict(
        db.execute(
            select(TeamMember.team_id, func.count())
            .join(Team, Team.id == TeamMember.team_id)
            .where(team_scope(admin))
            .group_by(TeamMember.team_id)
        ).all()
    )
    pending = db.scalar(
        select(func.count())
        .select_from(Invitation)
        .join(Team, Team.id == Invitation.team_id)
        .where(Invitation.status == "pending", team_scope(admin))
    )
    recent = list(db.scalars(select(Team).where(team_scope(admin), Team.status == "submitted").order_by(Team.submitted_at.desc()).limit(8)))
    published = _results_published(db)
    is_super = _is_super(admin)
    active = [t for t in teams if t.status in ACTIVE]

    return StatsOut(
        department=None if is_super else admin.department,
        students=len(students),
        students_in_teams=sum(1 for s in students if s.in_team),
        pending_invitations=pending or 0,
        teams=StatusCounts(**_counts([t.status for t in teams])),
        by_type=[
            TypeStats(
                type=kind,
                students=sum(1 for s in students if s.participant_type == kind),
                teams=sum(1 for t in teams if t.participant_type == kind),
                submitted=sum(1 for t in teams if t.participant_type == kind and t.status == "submitted"),
            )
            for kind in ("kiet", "college", "school")
        ]
        if is_super
        else None,
        by_category=[
            CategoryStats(category=number, **_counts([t.status for t in teams if t.category == number])) for number in rules.CATEGORIES
        ],
        by_department=[
            DepartmentStats(
                department=department,
                students=sum(1 for s in students if s.participant_type == "kiet" and s.department == department),
                **_counts([t.status for t in teams if t.participant_type == "kiet" and t.department == department]),
            )
            for department in rules.DEPARTMENTS
        ]
        if is_super
        else None,
        recent_submissions=summaries(db, recent),
        results_published_at=published.updated_at if published else None,
        timeline=_timeline(
            window, [s.created_at for s in students], [t.created_at for t in teams], [t.submitted_at for t in teams if t.submitted_at]
        ),
        schedule=schedule.to_out(window, settings),
        by_year=[
            YearStats(participant_type=kind, year=year, students=count)
            for (kind, year), count in sorted(Counter((s.participant_type, s.year) for s in students).items())
        ],
        team_sizes=[
            SizeStats(size=size, teams=sum(1 for t in active if sizes.get(t.id, 0) == size)) for size in range(1, rules.TEAM_MAX_SIZE + 1)
        ],
        by_domain=[
            DomainStats(domain=domain, teams=count)
            for domain, count in sorted(Counter(t.domain for t in active).items(), key=lambda item: (-item[1], item[0]))
        ],
        top_institutions=_top_institutions(students, teams) if is_super else None,
    )


def _top_institutions(students: list, teams: list, limit: int = 10) -> list[InstitutionStats]:
    """Other colleges and schools with the most students. Spellings vary, so they are grouped by the matching key."""
    groups: dict[tuple[str, str], list] = defaultdict(list)
    for student in students:
        if student.participant_type != "kiet" and student.institution_key:
            groups[(student.participant_type, student.institution_key)].append(student)
    team_counts = Counter((t.participant_type, t.institution_key) for t in teams if t.status in ACTIVE)
    rows = [
        InstitutionStats(
            # The spelling most of its students used.
            institution=Counter(s.institution for s in members).most_common(1)[0][0],
            participant_type=kind,
            city=Counter(s.city for s in members).most_common(1)[0][0],
            students=len(members),
            teams=team_counts[(kind, key)],
        )
        for (kind, key), members in groups.items()
    ]
    rows.sort(key=lambda row: (-row.students, -row.teams, row.institution.lower()))
    return rows[:limit]


# ---------- Finalists ----------


def _eligible(db: Session, department: str | None = None, lock: bool = False) -> list[Team]:
    statement = select(Team).where(Team.route == "department", Team.status == "submitted").order_by(Team.number)
    if department:
        statement = statement.where(Team.department == department)
    if lock:
        # Waits for a concurrent withdrawal, then re-checks the status, so a withdrawn team is never nominated.
        statement = statement.with_for_update().execution_options(populate_existing=True)
    return list(db.scalars(statement))


def _board_access(admin: Admin, department: str) -> None:
    if department not in rules.DEPARTMENTS:
        raise ApiError(f'Unknown department "{department}".', 404)
    if not _is_super(admin) and department != admin.department:
        raise ApiError(f"You can only nominate finalists for {admin.department}.", 403)


def finalist_board(db: Session, admin: Admin, department: str, settings: Settings) -> FinalistBoardOut:
    _board_access(admin, department)
    window = schedule.load(db, settings)
    eligible = _eligible(db, department)
    eligible_ids = {t.id for t in eligible}
    nominated = [
        n for n in db.scalars(select(FinalistNomination).where(FinalistNomination.department == department)) if n.team_id in eligible_ids
    ]
    updated = db.get(AppState, f"finalists:{department}")
    published = _results_published(db)
    return FinalistBoardOut(
        department=department,
        nominations_deadline=window.nominations_deadline,
        nominations_locked=window.nominations_closed() and not _is_super(admin),
        published_at=published.updated_at if published else None,
        updated_at=updated.updated_at if updated else None,
        updated_by=updated.value if updated else None,
        categories=[
            FinalistCategoryOut(
                category=number,
                quota=rules.finalist_quota(department, number),
                teams=summaries(db, [t for t in eligible if t.category == number]),
                nominated=[n.team_id for n in nominated if n.category == number],
            )
            for number in rules.CATEGORIES
        ],
    )


def _lock_state(db: Session, key: str, default: str = "") -> AppState:
    """Creates the row if needed, then locks it. Serialises nomination edits and publishing."""
    db.execute(insert(AppState).values(key=key, value=default, updated_at=utcnow()).on_conflict_do_nothing(index_elements=["key"]))
    return db.scalar(select(AppState).where(AppState.key == key).with_for_update().execution_options(populate_existing=True))  # type: ignore[return-value]


def save_finalists(db: Session, admin: Admin, department: str, data: NominationsInput, settings: Settings) -> FinalistBoardOut:
    _board_access(admin, department)
    window = schedule.load(db, settings)
    if window.nominations_closed() and not _is_super(admin):
        raise ApiError(
            f"The nomination deadline passed on {window.nominations_deadline.astimezone(rules.IST):%d %B %Y, %I:%M %p} IST. "  # type: ignore[union-attr]
            "Ask a super admin to change the nominations.",
            403,
        )
    # Same lock as publishing, so nominations cannot change while results are being published.
    _lock_state(db, f"{RESULTS_KEY}_lock")
    if _results_published(db):
        raise ApiError("Results have been published, so nominations can no longer change.", 409)
    state = _lock_state(db, f"finalists:{department}")

    eligible = {t.id: t for t in _eligible(db, department, lock=True)}
    seen_categories: set[int] = set()
    for entry in data.nominations:
        if entry.category not in rules.CATEGORIES:
            raise ApiError(f"Unknown category {entry.category}.", 422)
        if entry.category in seen_categories:
            raise ApiError(f"Category {entry.category} is listed twice.", 422)
        seen_categories.add(entry.category)
        team_ids = list(dict.fromkeys(entry.team_ids))
        quota = rules.finalist_quota(department, entry.category)
        if len(team_ids) > quota:
            raise ApiError(
                f"{department} can nominate at most {quota} {'team' if quota == 1 else 'teams'} in Category {entry.category}.", 422
            )
        for team_id in team_ids:
            team = eligible.get(team_id)
            if team is None or team.category != entry.category:
                raise ApiError(f"A nominated team is not a submitted {department} team in Category {entry.category}.", 422)

        db.execute(
            delete(FinalistNomination).where(FinalistNomination.department == department, FinalistNomination.category == entry.category)
        )
        for team_id in team_ids:
            db.add(FinalistNomination(team_id=team_id, department=department, category=entry.category, nominated_by=admin.email))

    state.value = admin.email
    state.updated_at = utcnow()
    audit.record(db, admin.email, "finalists.updated", detail=f"{department}: categories {sorted(seen_categories)}", department=department)
    db.commit()
    return finalist_board(db, admin, department, settings)


def finalist_summary(db: Session, admin: Admin) -> FinalistSummaryOut:
    _require_super(admin, "see every department's finalists")
    eligible = _eligible(db)
    eligible_count = Counter((t.department, t.category) for t in eligible)
    eligible_ids = {t.id for t in eligible}
    nominated_count = Counter((n.department, n.category) for n in db.scalars(select(FinalistNomination)) if n.team_id in eligible_ids)
    published = _results_published(db)
    direct = list(db.scalars(select(Team).where(Team.route == "finale", Team.status == "submitted").order_by(Team.number)))
    return FinalistSummaryOut(
        published_at=published.updated_at if published else None,
        published_by=published.value if published else None,
        matrix=[
            MatrixRow(
                department=department,
                categories=[
                    MatrixCell(
                        category=number,
                        quota=rules.finalist_quota(department, number),
                        nominated=nominated_count[(department, number)],
                        eligible=eligible_count[(department, number)],
                    )
                    for number in rules.CATEGORIES
                ],
            )
            for department in rules.DEPARTMENTS
        ],
        direct_teams=summaries(db, direct),
    )


def publish_results(db: Session, admin: Admin) -> PublishOut:
    _require_super(admin, "publish results")
    _lock_state(db, f"{RESULTS_KEY}_lock")
    if _results_published(db):
        raise ApiError("Results have already been published.", 409)

    nominated = set(db.scalars(select(FinalistNomination.team_id)))
    finalists = not_selected = 0
    for team in db.scalars(select(Team).where(Team.route == "department", Team.status == "submitted").with_for_update()):
        if team.id in nominated:
            team.result = "finalist"
            finalists += 1
        else:
            team.result = "not_selected"
            not_selected += 1

    now = utcnow()
    db.add(AppState(key=RESULTS_KEY, value=admin.email, updated_at=now))
    audit.record(db, admin.email, "results.published", detail=f"{finalists} finalists, {not_selected} not selected")
    db.commit()
    return PublishOut(published_at=now, finalists=finalists, not_selected=not_selected)


# ---------- Admins ----------


def admin_out(admin: Admin) -> AdminOut:
    return AdminOut(
        email=admin.email,
        name=admin.name,
        role=admin.role,
        department=admin.department,
        added_at=admin.created_at,
        added_by=admin.created_by,
    )


def list_admins(db: Session, admin: Admin, settings: Settings) -> list[AdminOut]:
    _require_super(admin, "manage admins")
    stored = list(db.scalars(select(Admin).order_by(Admin.role.desc(), Admin.email)))
    known = {a.email for a in stored}
    configured = [
        AdminOut(email=email, name=email.split("@")[0], role="super_admin", department=None, added_by="server configuration")
        for email in settings.super_admin_emails
        if email not in known
    ]
    return configured + [admin_out(a) for a in stored]


def add_admin(db: Session, admin: Admin, data: AdminInput, settings: Settings) -> AdminOut:
    _require_super(admin, "manage admins")
    if db.get(Admin, data.email) or data.email in settings.super_admin_emails:
        raise ApiError("This email is already an admin.", 409)
    new = Admin(email=data.email, name=data.name, role=data.role, department=data.department, created_by=admin.email)
    db.add(new)
    audit.record(
        db,
        admin.email,
        "admin.added",
        detail=f"{data.email} ({data.role}{', ' + data.department if data.department else ''})",
        department=data.department,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        # Another super admin added the same email a moment earlier.
        db.rollback()
        raise ApiError("This email is already an admin.", 409) from exc
    return admin_out(new)


def remove_admin(db: Session, admin: Admin, email: str, settings: Settings) -> None:
    _require_super(admin, "manage admins")
    email = email.strip().lower()
    if email == admin.email:
        raise ApiError("You cannot remove your own admin access.", 409)
    if email in settings.super_admin_emails:
        raise ApiError("This super admin is set in the server configuration and cannot be removed here.", 409)
    # Lock every super admin, not just the target, so two super admins removing each other cannot both succeed.
    db.execute(select(Admin.email).where(Admin.role == "super_admin").with_for_update())
    target = db.scalar(select(Admin).where(Admin.email == email).with_for_update())
    if target is None:
        raise ApiError("No admin with this email exists.", 404)
    if target.role == "super_admin" and not settings.super_admin_emails:
        others = db.scalar(select(func.count()).select_from(Admin).where(Admin.role == "super_admin", Admin.email != email))
        if not others:
            raise ApiError("At least one super admin must remain.", 409)
    db.delete(target)
    audit.record(db, admin.email, "admin.removed", detail=email, department=target.department)
    db.commit()


# ---------- Audit ----------


def audit_log(db: Session, admin: Admin, team_id: uuid.UUID | None, limit: int) -> list[AuditOut]:
    statement = select(AuditEntry).order_by(AuditEntry.at.desc(), AuditEntry.id.desc()).limit(limit)
    if team_id:
        if db.get(Team, team_id) is not None:
            _visible_team(db, admin, team_id)
        statement = statement.where(AuditEntry.team_id == team_id)
    if not _is_super(admin):
        statement = statement.where(AuditEntry.department == admin.department)
    return [
        AuditOut(
            id=str(entry.id),
            at=entry.at,
            actor_email=entry.actor_email,
            action=entry.action,
            team_id=entry.team_id,
            team_code=entry.team_code,
            department=entry.department,
            detail=entry.detail,
        )
        for entry in db.scalars(statement)
    ]
