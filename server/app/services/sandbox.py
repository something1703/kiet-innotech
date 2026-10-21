"""
A practice copy of the event, for showing the organisers' and judges' screens without touching real data.

It runs only as its own deployment (SANDBOX_MODE=true, its own database). `reset` wipes that database and fills it with ten
made-up IT department teams in one room with two judges and scoring open, so the people signed in can mark teams, lock marks,
mark attendance and look at the rankings, then start again. It refuses to touch a database that holds real data: such a
database is empty, or was seeded by this module (the marker row).
"""

import secrets
import time
from collections import deque
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .. import rules
from ..auth import Identity, sign_in
from ..config import Settings
from ..db import Base
from ..errors import ApiError
from ..models import Admin, AppState, Juror, Panel, Profile, Team, User, utcnow
from ..schemas import AdminTeamInput, JurorInput, PanelInput, PanelJurorInput, PanelJurorsInput, PanelTeamsInput, SandboxOut
from . import admin as admin_service
from . import judging

MARKER = "sandbox"
DEPARTMENT = "IT"
ROOM = {"building": "CSIT Block", "name": "Practice Room", "location": "Sandbox: practice data only"}

# Wrong access codes in the last five minutes, across everyone: past the limit the sign-in pauses, so a code cannot be guessed.
_FAILURES: deque[float] = deque()
_FAILURE_WINDOW = 300
_FAILURE_LIMIT = 20


@dataclass(frozen=True)
class _Project:
    team: str
    category: int
    domain: str
    title: str
    abstract: str
    # Years of study of the members, the leader first.
    years: tuple[int, ...]


PROJECTS = [
    _Project(
        "Pixel Pioneers",
        1,
        "Smart Cities, Infrastructure & Green Mobility",
        "Pothole spotter: report road damage from a phone photo",
        "Citizens photograph a pothole and the app locates it, estimates its size with a small vision model and files a complaint with the "
        "municipal portal. A dashboard ranks the worst stretches so repair crews can plan their week.",
        (3, 3, 2),
    ),
    _Project(
        "Neural Ninjas",
        2,
        "Artificial Intelligence & Machine Learning",
        "Invoice reader that fills the accounts sheet by itself",
        "Small shops still key in supplier invoices by hand. Our pipeline reads photographed invoices, extracts the line items with a "
        "document model and posts them to a spreadsheet, flagging anything it is unsure about for a person to check.",
        (4, 3),
    ),
    _Project(
        "Circuit Breakers",
        3,
        "IoT, Robotics & Automation",
        "Soil-aware irrigation controller for small farms",
        "An ESP32 node reads soil moisture and the weather forecast, then switches the pump only when the field needs water. It is "
        "solar powered and sends SMS alerts, so farmers without smartphones can follow it.",
        (3, 2, 2),
    ),
    _Project(
        "Byte Builders",
        4,
        "Healthcare, Biomedical Devices & Biotechnology",
        "Low-cost pulse oximeter for village clinics",
        "A prototype pulse oximeter built from off-the-shelf parts, calibrated against a hospital unit. It stores readings per patient "
        "and syncs them when the clinic gets a connection, so health workers can follow a patient over weeks.",
        (4, 4, 3),
    ),
    _Project(
        "Green Gridders",
        5,
        "Renewable Energy & Sustainable Engineering",
        "Pay-per-use rooftop solar for hostels",
        "A start-up plan to install rooftop solar in student hostels and sell the energy per unit. We worked out the payback period, the "
        "billing app and a pilot in two blocks of a hostel, with a first-year revenue target.",
        (3, 3),
    ),
    _Project(
        "Gen Z Innovators",
        6,
        "Other / not listed",
        "Smart dustbin that tells the cleaner when it is full",
        "A dustbin with an ultrasonic sensor and a small display. When it is nearly full it sends a message to the cleaner, so bins are "
        "emptied when needed instead of on a fixed round. We built and tested one in our corridor.",
        (1, 1, 1),
    ),
    _Project(
        "Eco Visionaries",
        7,
        "Disaster Management & Environmental Solutions",
        "Poster: what happens to a campus flood, hour by hour",
        "A poster that maps the low-lying parts of the campus and the roads that fill first, with a simple alert ladder and the "
        "contacts for each stage. It is meant to be printed and put up in every block.",
        (2, 2, 2, 2),
    ),
    _Project(
        "Cyber Sentinels",
        8,
        "Cyber Security, Privacy & Trustworthy AI",
        "Phishing mail detector for student inboxes",
        "A browser extension that scores incoming mails for phishing signs, such as look-alike domains and urgent wording, and shows a "
        "plain warning. We tested it on a set of real campus phishing mails and report how many it caught.",
        (3, 2),
    ),
    _Project(
        "Quantum Quokkas",
        2,
        "Big Data, Cloud, 5G/6G & Quantum Technologies",
        "Timetable maker that resolves clashes by itself",
        "Our scheduler takes the subjects, teachers and rooms of a department and builds a clash-free timetable, then repairs it when a "
        "teacher is absent. We compare its output with last semester's hand-made timetable.",
        (3, 3, 2),
    ),
    _Project(
        "Robo Rangers",
        3,
        "IoT, Robotics & Automation",
        "Line-following cart that carries lab samples",
        "A small robot cart that follows a taped line between the lab and the store room carrying sample trays, stops for people and "
        "reports its battery level. It replaces a daily walk for the lab assistants.",
        (4, 3),
    ),
]

FIRST_NAMES = [
    "Aarav", "Diya", "Kabir", "Ananya", "Arjun", "Tanvi", "Rohan", "Sneha", "Ishaan", "Meera", "Vihaan", "Saanvi", "Aditya", "Kavya",
    "Yash", "Riya", "Dev", "Pooja", "Harsh", "Neha", "Manav", "Ira", "Kunal", "Sara", "Veer", "Aisha", "Rahul", "Nikita", "Dhruv", "Simran",
]  # fmt: skip
LAST_NAMES = [
    "Sharma", "Verma", "Singh", "Rao", "Nair", "Arora", "Mehta", "Kapoor", "Jain", "Gupta", "Malhotra", "Bansal", "Chauhan", "Tyagi",
    "Saxena",
]  # fmt: skip


def _enabled(settings: Settings) -> None:
    # Fails closed: without SANDBOX_MODE these endpoints do not exist as far as anyone can tell.
    if not settings.sandbox_mode:
        raise ApiError("Not found.", 404)


def sign_in_with_code(db: Session, settings: Settings, email: str, code: str) -> dict[str, str]:
    """An organiser or judge signs in to the admin panel with the sandbox's access code instead of Google."""
    _enabled(settings)
    now = time.monotonic()
    while _FAILURES and now - _FAILURES[0] > _FAILURE_WINDOW:
        _FAILURES.popleft()
    if len(_FAILURES) >= _FAILURE_LIMIT:
        raise ApiError("Too many wrong access codes. Please wait a few minutes and try again.", 429)
    if not secrets.compare_digest(code.encode(), settings.sandbox_access_code.encode()):
        _FAILURES.append(now)
        raise ApiError("That access code is not right.", 403)
    email = email.strip().lower()
    return sign_in(db, Identity(email=email, name=email.split("@")[0].replace(".", " ").title()), "admin", settings)


def _holds_real_data(db: Session) -> bool:
    """True unless the database is empty or was filled by this module: then `reset` must not wipe it."""
    if db.get(AppState, MARKER) is not None:
        return False
    return any(db.scalar(select(model).limit(1)) is not None for model in (User, Team, Juror, Admin))


def _wipe(db: Session) -> None:
    """Empties every application table (not the migration history) and restarts the team numbers."""
    quote = db.get_bind().dialect.identifier_preparer.quote
    names = ", ".join(quote(table.name) for table in Base.metadata.sorted_tables)
    # The names come from our own table definitions, never from a request.
    db.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))


def _students(db: Session, count: int) -> list[User]:
    users = []
    for index in range(count):
        first, last = FIRST_NAMES[index % len(FIRST_NAMES)], LAST_NAMES[(index * 7 + index // len(FIRST_NAMES)) % len(LAST_NAMES)]
        email = f"{first}.{last}.{index + 1:02d}@kiet.edu".lower()
        user = User(email=email, name=f"{first} {last}")
        db.add(user)
        users.append(user)
    db.flush()
    return users


def _profile(user: User, year: int, index: int) -> Profile:
    batch = 26 - year
    return Profile(
        user_id=user.id,
        full_name=user.name,
        phone=f"98765{index:05d}",
        participant_type="kiet",
        institution=rules.KIET_INSTITUTION,
        institution_key=rules.institution_key("kiet", rules.KIET_INSTITUTION, rules.KIET_CITY),
        city=rules.KIET_CITY,
        department=DEPARTMENT,
        course="B.Tech",
        year=year,
        roll_number=f"{batch}00290130{index + 1:03d}",
    )


def _faculty(settings: Settings) -> list[JurorInput]:
    """
    A department room has two judges: the parent department judge (IT) and one from another department. The first person
    signed in with a KIET email is the IT judge and the second, if any, the other one; the rest of the pair is made up.
    Judges need KIET emails, so anyone else stays an organiser only.
    """
    emails = [email for email in settings.super_admin_emails if rules.is_kiet_email(email)]

    def judge(email: str, department: str) -> JurorInput:
        return JurorInput(email=email, name=email.split("@")[0].replace(".", " ").title(), kind="faculty", department=department)

    own = (
        judge(emails[0], DEPARTMENT)
        if emails
        else JurorInput(email="demo.judge.it@kiet.edu", name="Dr Vikram Nair", kind="faculty", department=DEPARTMENT)
    )
    other = (
        judge(emails[1], "CSE")
        if len(emails) > 1
        else JurorInput(email="demo.judge.cse@kiet.edu", name="Dr Anita Sharma", kind="faculty", department="CSE")
    )
    return [own, other]


def reset(db: Session, settings: Settings) -> SandboxOut:
    """Wipes the sandbox database and fills it again. Refuses on a database that holds real data."""
    _enabled(settings)
    if _holds_real_data(db):
        raise ApiError("This database holds real event data, so it will not be reset. The sandbox must have a database of its own.", 409)
    _wipe(db)
    db.commit()

    organiser = Admin(email=settings.super_admin_emails[0], name="Sandbox organiser", role="super_admin", created_by="sandbox")
    # A round-hour start (the room's slot, 12 hours long, began one to two hours ago) reads better than the exact minute.
    start = utcnow().replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    count = sum(len(p.years) for p in PROJECTS)
    users = _students(db, count)
    cursor = 0
    team_ids = []
    for project in PROJECTS:
        members = users[cursor : cursor + len(project.years)]
        for offset, (user, year) in enumerate(zip(members, project.years, strict=True)):
            db.add(_profile(user, year, cursor + offset))
        cursor += len(members)
        db.flush()
        created = admin_service.create_team(
            db,
            organiser,
            AdminTeamInput(
                name=project.team,
                category=project.category,
                domain=project.domain,
                project_title=project.title,
                abstract=project.abstract,
                leader_email=members[0].email,
                member_emails=[m.email for m in members[1:]],
                submit=True,
            ),
            settings,
        )
        team_ids.append(created.id)

    judges = _faculty(settings)
    for juror in judges:
        judging.add_juror(db, organiser, juror)
    # The slot began an hour or two ago and runs for twelve hours, so marks can be saved for at least ten hours after a reset.
    room = judging.create_panel(
        db,
        organiser,
        PanelInput(
            round="department",
            department=DEPARTMENT,
            slot_start=start,
            slot_end=start + timedelta(hours=12),
            buffer_minutes=15,
            **ROOM,
        ),
    )
    judging.set_panel_teams(db, organiser, room.id, PanelTeamsInput(team_ids=team_ids))
    judging.set_panel_jurors(db, organiser, room.id, PanelJurorsInput(jurors=[PanelJurorInput(email=j.email) for j in judges]))

    note = "Scoring is open."
    try:
        judging.open_round(db, organiser, settings, "department")
    except ApiError as error:
        note = f"Scoring is not open yet: {error.message}"
    db.merge(AppState(key=MARKER, value="seeded", updated_at=utcnow()))
    db.commit()
    return SandboxOut(teams=len(team_ids), judges=len(judges), room=judging.room_label(db.get(Panel, room.id)), note=note)
