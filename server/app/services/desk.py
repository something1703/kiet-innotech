"""
The Grand Finale event desk: on-site registration (check-in) and food coupons.

- Registration: a volunteer finds a team by its code, stall, name, a member's name, roll number or phone, and checks in
  the members who are there. A check-in is the student's Grand Finale attendance (the attendance table, round "final"),
  so the judging pages and attendance sheets see it too. Only teams taking part in the Grand Finale can be checked in.
- Food coupons: super admins set up the meals (this year one: lunch) and open each one. A student gets one coupon per open
  meal; giving it checks them in too, since they are at the desk. The table's key makes a second one impossible, whoever
  tries and however fast. Coupons for people who are not students (judges, volunteers, start-ups, guests) are given in
  bulk with who they were for.

Super admins and desk volunteers (admins with role "desk") use the desk. Volunteers check in, mark coupons given or not
given (with a reason) and give bulk coupons; only a super admin sets up meals or takes bulk coupons back.
"""

import re
import uuid
from collections import defaultdict

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..errors import ApiError
from ..models import Admin, Attendance, FinaleHandout, FinalTent, Meal, MealCoupon, MealExtra, Profile, Team, TeamMember, User, utcnow
from ..schemas import (
    CheckInInput,
    CheckOutInput,
    CouponsInput,
    CouponsOut,
    DeskMemberOut,
    DeskOut,
    DeskTeamOut,
    MealExtraInput,
    MealExtraOut,
    MealInput,
    MealOut,
    MealUpdateInput,
    RegisterInput,
)
from . import audit, judging, sections

ROUND = "final"
DESK_NOTE = "Registration desk"
MAX_RESULTS = 25


def _eligible():
    return judging._eligible_condition(ROUND)


def _require_super(admin: Admin, what: str) -> None:
    if admin.role != "super_admin":
        raise ApiError(f"Only a super admin can {what}.", 403)


def _masked(phone: str) -> str:
    """Enough of a phone number to confirm it with the student, not to copy it."""
    return f"••••••{phone[-4:]}" if len(phone) >= 4 else ""


# ---------- Reading ----------


def _teams_out(db: Session, teams: list[Team]) -> list[DeskTeamOut]:
    ids = [t.id for t in teams]
    if not ids:
        return []
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent).where(FinalTent.team_id.in_(ids))).tuples().all())
    marks = {
        a.user_id: a
        for a in db.scalars(
            select(Attendance).where(Attendance.round == ROUND, Attendance.team_id.in_(ids), Attendance.status == "present")
        )
    }
    coupons: dict[uuid.UUID, dict[str, MealCoupon]] = defaultdict(dict)
    for coupon in db.scalars(select(MealCoupon).where(MealCoupon.team_id.in_(ids))):
        coupons[coupon.user_id][coupon.meal] = coupon
    handouts = {h.user_id: h for h in db.scalars(select(FinaleHandout).where(FinaleHandout.team_id.in_(ids)))}
    places = judging.finale_places(db, ids)
    section_of = sections.of_teams(db, teams)
    members: dict[uuid.UUID, list[DeskMemberOut]] = defaultdict(list)
    for member, profile, user in db.execute(
        select(TeamMember, Profile, User)
        .join(Profile, Profile.user_id == TeamMember.user_id)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id.in_(ids))
        .order_by(TeamMember.role != "leader", Profile.full_name)
    ).tuples():
        mark = marks.get(member.user_id)
        members[member.team_id].append(
            DeskMemberOut(
                user_id=member.user_id,
                full_name=profile.full_name,
                role=member.role,
                course=profile.course,
                year=profile.year,
                department=profile.department,
                roll_number=profile.roll_number,
                phone=_masked(profile.phone),
                banned=user.banned_at is not None,
                checked_in_at=mark.marked_at if mark else None,
                checked_in_by=mark.marked_by if mark else None,
                coupons={meal: c.issued_at for meal, c in coupons[member.user_id].items()},
                id_card_at=handouts[member.user_id].id_card_at if member.user_id in handouts else None,
                coupon_at=handouts[member.user_id].coupon_at if member.user_id in handouts else None,
            )
        )
    return [
        DeskTeamOut(
            id=t.id,
            code=t.code,
            name=t.name,
            category=t.category,
            project_title=t.project_title,
            participant_type=t.participant_type,
            institution=t.institution,
            department=t.department,
            route=t.route,
            tent=tents.get(t.id),
            place=places.get(t.id, ""),
            section=section_of[t.id],
            members=members[t.id],
        )
        for t in teams
    ]


def _order(db: Session, teams: list[Team]) -> list[Team]:
    """Stall order, as the stalls stand; teams without a stall last."""
    tents = dict(db.execute(select(FinalTent.team_id, FinalTent.tent).where(FinalTent.team_id.in_([t.id for t in teams]))).tuples().all())
    return sorted(teams, key=lambda t: (t.id not in tents, judging._natural(tents.get(t.id, "")), t.number))


def search(db: Session, q: str) -> list[DeskTeamOut]:
    """Grand Finale teams matching a team code or number, a stall, a team name, or a member's name, roll number or phone."""
    text = " ".join(q.split())
    if len(text) < 2 and not text.isdigit():
        return []
    conditions = []
    code = re.fullmatch(r"(?:IT26-?)?0*(\d{1,6})", text.upper())
    if code:
        conditions.append(Team.number == int(code.group(1)))
    conditions.append(Team.id.in_(select(FinalTent.team_id).where(FinalTent.tent == "".join(text.split()).upper())))
    if len(text) >= 2:
        like = "%" + text.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        conditions.append(func.lower(Team.name).like(like))
        member_match = or_(func.lower(Profile.full_name).like(like), func.lower(Profile.roll_number).like(like))
        digits = re.sub(r"\D", "", text)
        if len(digits) >= 4:
            member_match = or_(member_match, Profile.phone.like(f"%{digits}%"))
        conditions.append(Team.id.in_(select(TeamMember.team_id).join(Profile, Profile.user_id == TeamMember.user_id).where(member_match)))
        if not code:
            conditions.append(func.lower(Team.institution).like(like))
    teams = list(db.scalars(select(Team).where(_eligible(), or_(*conditions)).order_by(Team.number).limit(MAX_RESULTS * 4)))
    return _teams_out(db, _order(db, teams)[:MAX_RESULTS])


def all_teams(db: Session) -> list[DeskTeamOut]:
    """Every Grand Finale team in stall order, for the downloads."""
    return _teams_out(db, _order(db, list(db.scalars(select(Team).where(_eligible())))))


def _meals(db: Session) -> list[Meal]:
    return list(db.scalars(select(Meal).order_by(Meal.position, Meal.created_at)))


def overview(db: Session, admin: Admin) -> DeskOut:
    team_ids = select(Team.id).where(_eligible())
    students = db.scalar(select(func.count()).select_from(TeamMember).where(TeamMember.team_id.in_(team_ids))) or 0
    checked_in = (
        db.scalar(
            select(func.count())
            .select_from(Attendance)
            .join(TeamMember, and_(TeamMember.user_id == Attendance.user_id, TeamMember.team_id == Attendance.team_id))
            .where(Attendance.round == ROUND, Attendance.status == "present", Attendance.team_id.in_(team_ids))
        )
        or 0
    )
    teams = db.scalar(select(func.count()).select_from(Team).where(_eligible())) or 0
    teams_in = (
        db.scalar(
            select(func.count(func.distinct(Attendance.team_id))).where(
                Attendance.round == ROUND, Attendance.status == "present", Attendance.team_id.in_(team_ids)
            )
        )
        or 0
    )
    handouts = list(db.scalars(select(FinaleHandout).where(FinaleHandout.team_id.in_(team_ids))))
    given = dict(db.execute(select(MealCoupon.meal, func.count()).group_by(MealCoupon.meal)).tuples().all())
    extras = dict(db.execute(select(MealExtra.meal, func.sum(MealExtra.quantity)).group_by(MealExtra.meal)).tuples().all())
    recent = list(db.scalars(select(MealExtra).order_by(MealExtra.issued_at.desc()).limit(100)))
    return DeskOut(
        teams=teams,
        teams_checked_in=teams_in,
        students=students,
        students_checked_in=checked_in,
        id_cards=sum(1 for h in handouts if h.id_card_at),
        coupons=sum(1 for h in handouts if h.coupon_at),
        meals=[
            MealOut(key=m.key, label=m.label, open=m.open, given=given.get(m.key, 0), extras=int(extras.get(m.key) or 0))
            for m in _meals(db)
        ],
        extras=[_extra_out(e) for e in recent],
        can_manage=admin.role == "super_admin",
        server_time=utcnow(),
    )


def _extra_out(extra: MealExtra) -> MealExtraOut:
    return MealExtraOut(
        id=extra.id,
        meal=extra.meal,
        quantity=extra.quantity,
        recipient=extra.recipient,
        issued_at=extra.issued_at,
        issued_by=extra.issued_by,
    )


# ---------- Check-in ----------


def _team(db: Session, team_id: uuid.UUID) -> Team:
    team = db.scalar(select(Team).where(Team.id == team_id).with_for_update(read=True))
    if team is None:
        raise ApiError("Team not found.", 404)
    if not db.scalar(select(Team.id).where(Team.id == team.id, _eligible())):
        raise ApiError(f"{team.code} is not taking part in the Grand Finale (status: {team.status}). Send them to the help desk.", 409)
    return team


def _members(db: Session, team: Team, user_ids: list[uuid.UUID]) -> list[tuple[TeamMember, Profile, User]]:
    rows = (
        db.execute(
            select(TeamMember, Profile, User)
            .join(Profile, Profile.user_id == TeamMember.user_id)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team.id, TeamMember.user_id.in_(user_ids))
        )
        .tuples()
        .all()
    )
    if len(rows) != len(set(user_ids)):
        raise ApiError("One of these students is not in this team. Reload and try again.", 422)
    return list(rows)


def check_in(db: Session, admin: Admin, team_id: uuid.UUID, data: CheckInInput) -> DeskTeamOut:
    """Checks in the listed members (already checked in ones are left as they are). Suspended students are refused."""
    team = _team(db, team_id)
    rows = _members(db, team, data.user_ids)
    banned = [p.full_name for _, p, u in rows if u.banned_at is not None]
    if banned:
        raise ApiError(f"{banned[0]}'s account is suspended by the organisers. Do not check them in; send them to the help desk.", 409)
    now = utcnow()
    names = []
    for member, profile, _ in rows:
        statement = (
            insert(Attendance)
            .values(
                user_id=member.user_id,
                round=ROUND,
                team_id=team.id,
                marked_at=now,
                marked_by=admin.email,
                method="manual",
                note=DESK_NOTE,
                status="present",
            )
            .on_conflict_do_update(
                index_elements=["user_id", "round"],
                set_={"status": "present", "marked_at": now, "marked_by": admin.email, "method": "manual", "note": DESK_NOTE},
                where=Attendance.status != "present",
            )
            .returning(Attendance.user_id)
        )
        if db.execute(statement).first() is not None:
            names.append(profile.full_name)
    if names:
        audit.record(db, admin.email, "attendance.marked", team, f"Checked in at the Grand Finale registration desk: {', '.join(names)}")
    db.commit()
    return _teams_out(db, [team])[0]


def register(db: Session, admin: Admin, team_id: uuid.UUID, data: RegisterInput) -> DeskTeamOut:
    """
    The registration desk sets, for each listed member, whether they are here (registered: their Grand Finale attendance)
    and whether they got the paper ID card and lunch coupon. Only a registered student gets either; a student taken off
    the register loses the record of both. No time limit: the desk can correct this whenever it needs to.
    """
    team = _team(db, team_id)
    if len({m.user_id for m in data.members}) != len(data.members):
        raise ApiError("A student is listed twice. Reload and try again.", 422)
    rows = {member.user_id: (member, profile, user) for member, profile, user in _members(db, team, [m.user_id for m in data.members])}
    for item in data.members:
        _, profile, user = rows[item.user_id]
        if item.present and user.banned_at is not None:
            raise ApiError(
                f"{profile.full_name}'s account is suspended by the organisers. Do not register them; send them to the help desk.", 409
            )
        if not item.present and (item.id_card or item.coupon):
            raise ApiError(f"{profile.full_name} is not registered as present, so no ID card or lunch coupon can be recorded.", 422)
    now = utcnow()
    changes: list[str] = []
    for item in data.members:
        member, profile, _ = rows[item.user_id]
        mark = db.get(Attendance, (member.user_id, ROUND), with_for_update=True)
        here = mark is not None and mark.status == "present" and mark.team_id == team.id
        handout = db.get(FinaleHandout, member.user_id, with_for_update=True)
        done: list[str] = []
        if item.present and not here:
            if mark is None:
                db.add(
                    Attendance(
                        user_id=member.user_id,
                        round=ROUND,
                        team_id=team.id,
                        marked_at=now,
                        marked_by=admin.email,
                        method="manual",
                        note=DESK_NOTE,
                        status="present",
                    )
                )
            else:
                mark.team_id, mark.status, mark.marked_at, mark.marked_by, mark.method, mark.note = (
                    team.id,
                    "present",
                    now,
                    admin.email,
                    "manual",
                    DESK_NOTE,
                )
            done.append("registered")
        elif not item.present and here:
            db.delete(mark)
            done.append("taken off the register")
        if handout is None and (item.id_card or item.coupon):
            handout = FinaleHandout(user_id=member.user_id, team_id=team.id)
            db.add(handout)
        if handout is not None:
            handout.team_id = team.id
            if item.id_card and handout.id_card_at is None:
                handout.id_card_at, handout.id_card_by = now, admin.email
                done.append("ID card given")
            elif not item.id_card and handout.id_card_at is not None:
                handout.id_card_at = handout.id_card_by = None
                done.append("ID card marked not given")
            if item.coupon and handout.coupon_at is None:
                handout.coupon_at, handout.coupon_by = now, admin.email
                done.append("lunch coupon given")
            elif not item.coupon and handout.coupon_at is not None:
                handout.coupon_at = handout.coupon_by = None
                done.append("lunch coupon marked not given")
        if done:
            changes.append(f"{profile.full_name}: {', '.join(done)}")
    if changes:
        audit.record(db, admin.email, "desk.registration", team, "; ".join(changes))
    db.commit()
    return _teams_out(db, [team])[0]


def check_out(db: Session, admin: Admin, team_id: uuid.UUID, data: CheckOutInput) -> DeskTeamOut:
    """Takes a check-in back (e.g. the wrong student was ticked). Coupons already given stay given."""
    team = _team(db, team_id)
    (member, profile, _), *_ = _members(db, team, [data.user_id])
    mark = db.get(Attendance, (member.user_id, ROUND), with_for_update=True)
    if mark is None or mark.status != "present":
        raise ApiError(f"{profile.full_name} is not checked in.", 409)
    db.delete(mark)
    # Off the register: no ID card or coupon on record either.
    db.execute(delete(FinaleHandout).where(FinaleHandout.user_id == member.user_id))
    audit.record(
        db,
        admin.email,
        "attendance.unmarked",
        team,
        f"{profile.full_name} checked out at the registration desk (checked in by {mark.marked_by}). Reason: {data.reason}",
    )
    db.commit()
    return _teams_out(db, [team])[0]


# ---------- Food coupons ----------


def _open_meal(db: Session, key: str) -> Meal:
    meal = db.scalar(select(Meal).where(Meal.key == key).with_for_update(read=True))
    if meal is None:
        raise ApiError("This meal does not exist. Reload the page.", 404)
    if not meal.open:
        raise ApiError(f"Coupons for {meal.label} are not being given out right now.", 409)
    return meal


def give_coupons(db: Session, admin: Admin, team_id: uuid.UUID, data: CouponsInput) -> CouponsOut:
    """
    One coupon for the meal to each listed member who has not had one; a member who was not checked in yet is checked in
    too (they are at the desk). Members who already had one are reported. Suspended students are refused.
    """
    team = _team(db, team_id)
    meal = _open_meal(db, data.meal)
    rows = _members(db, team, data.user_ids)
    present = set(
        db.scalars(
            select(Attendance.user_id).where(
                Attendance.round == ROUND, Attendance.status == "present", Attendance.user_id.in_([m.user_id for m, _, _ in rows])
            )
        )
    )
    missing = [m.user_id for m, _, u in rows if m.user_id not in present]
    if missing:
        check_in(db, admin, team.id, CheckInInput(user_ids=missing))
    now = utcnow()
    given, already, not_checked_in = [], [], []
    for member, profile, _ in rows:
        statement = (
            insert(MealCoupon)
            .values(user_id=member.user_id, meal=meal.key, team_id=team.id, issued_at=now, issued_by=admin.email)
            .on_conflict_do_nothing(index_elements=["user_id", "meal"])
            .returning(MealCoupon.user_id)
        )
        if db.execute(statement).first() is not None:
            given.append(profile.full_name)
        else:
            already.append(profile.full_name)
    if given:
        audit.record(db, admin.email, "desk.coupons_given", team, f"{meal.label} coupons: {', '.join(given)}")
    db.commit()
    return CouponsOut(team=_teams_out(db, [team])[0], given=given, already=already, not_checked_in=not_checked_in)


def take_back_coupon(db: Session, admin: Admin, team_id: uuid.UUID, meal_key: str, user_id: uuid.UUID, reason: str) -> DeskTeamOut:
    """Marks a student's coupon as not given (e.g. ticked by mistake), so it can be given again. Super admins and desk volunteers."""
    team = _team(db, team_id)
    (_, profile, _), *_ = _members(db, team, [user_id])
    coupon = db.get(MealCoupon, (user_id, meal_key), with_for_update=True)
    if coupon is None:
        raise ApiError(f"{profile.full_name} has no coupon for this meal.", 404)
    db.delete(coupon)
    audit.record(
        db, admin.email, "desk.coupon_taken_back", team, f"{meal_key} coupon of {profile.full_name} marked not given. Reason: {reason}"
    )
    db.commit()
    return _teams_out(db, [team])[0]


def give_extras(db: Session, admin: Admin, data: MealExtraInput) -> MealExtraOut:
    """Coupons for people who are not students: judges, volunteers, guests. Recorded with who they were for."""
    meal = _open_meal(db, data.meal)
    extra = MealExtra(meal=meal.key, quantity=data.quantity, recipient=data.recipient, issued_by=admin.email)
    db.add(extra)
    audit.record(db, admin.email, "desk.extra_coupons", detail=f"{data.quantity} {meal.label} coupons for {data.recipient}")
    db.commit()
    return _extra_out(extra)


def remove_extra(db: Session, admin: Admin, extra_id: uuid.UUID) -> None:
    _require_super(admin, "take coupons back")
    extra = db.get(MealExtra, extra_id)
    if extra is None:
        raise ApiError("These coupons were already taken back.", 404)
    db.delete(extra)
    audit.record(
        db, admin.email, "desk.extra_coupons_removed", detail=f"{extra.quantity} {extra.meal} coupons for {extra.recipient} taken back"
    )
    db.commit()


# ---------- Meals (super admins) ----------


def _key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:40] or "meal"


def add_meal(db: Session, admin: Admin, data: MealInput) -> DeskOut:
    _require_super(admin, "set up meals")
    key = _key(data.label)
    if db.get(Meal, key) is not None or any(m.label.lower() == data.label.lower() for m in _meals(db)):
        raise ApiError(f'There is already a meal called "{data.label}".', 409)
    position = (db.scalar(select(func.max(Meal.position))) or 0) + 1
    db.add(Meal(key=key, label=data.label, position=position, open=False, created_by=admin.email))
    audit.record(db, admin.email, "desk.meal_added", detail=data.label)
    db.commit()
    return overview(db, admin)


def update_meal(db: Session, admin: Admin, key: str, data: MealUpdateInput) -> DeskOut:
    _require_super(admin, "set up meals")
    meal = db.scalar(select(Meal).where(Meal.key == key).with_for_update())
    if meal is None:
        raise ApiError("This meal does not exist. Reload the page.", 404)
    changes = []
    if data.label is not None and data.label != meal.label:
        changes.append(f'renamed "{meal.label}" to "{data.label}"')
        meal.label = data.label
    if data.open is not None and data.open != meal.open:
        changes.append("coupons opened" if data.open else "coupons closed")
        meal.open = data.open
    if changes:
        audit.record(db, admin.email, "desk.meal_updated", detail=f"{meal.label}: {', '.join(changes)}")
        db.commit()
    return overview(db, admin)


def delete_meal(db: Session, admin: Admin, key: str) -> DeskOut:
    _require_super(admin, "set up meals")
    meal = db.scalar(select(Meal).where(Meal.key == key).with_for_update())
    if meal is None:
        raise ApiError("This meal does not exist. Reload the page.", 404)
    used = (db.scalar(select(func.count()).select_from(MealCoupon).where(MealCoupon.meal == key)) or 0) + (
        db.scalar(select(func.count()).select_from(MealExtra).where(MealExtra.meal == key)) or 0
    )
    if used:
        raise ApiError(f"Coupons have been given for {meal.label}, so it cannot be deleted. Close it instead.", 409)
    db.execute(delete(Meal).where(Meal.key == key))
    audit.record(db, admin.email, "desk.meal_deleted", detail=meal.label)
    db.commit()
    return overview(db, admin)
