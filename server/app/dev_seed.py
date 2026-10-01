"""
Development only: `python -m app.dev_seed` adds the demo students shown on the frontends' development
sign-in pickers, plus one existing team, so the local stack behaves like the mock.
"""

import sys

from sqlalchemy import select

from . import rules
from .config import get_settings
from .db import get_sessionmaker
from .models import Admin, Profile, Team, TeamMember, User

KIET = ("kiet", rules.KIET_INSTITUTION, rules.KIET_CITY, "B.Tech")
ABES = ("college", "ABES Engineering College", "Ghaziabad", "B.Tech / B.E.")
DPS = ("school", "Delhi Public School, Ghaziabad", "Ghaziabad", "School")

# email, name, (type, institution, city, course), department, year, roll number, phone
STUDENTS = [
    ("aarav.sharma@kiet.edu", "Aarav Sharma", KIET, "CSE", 3, "2300290100012", "9876500012"),
    ("diya.verma@kiet.edu", "Diya Verma", KIET, "CSE(AIML)", 3, "2300290120031", "9876500031"),
    ("kabir.singh@kiet.edu", "Kabir Singh", KIET, "IT", 1, "2500290130007", "9876500007"),
    ("ananya.rao@kiet.edu", "Ananya Rao", KIET, "EC", 1, "2500290310044", "9876500044"),
    ("arjun.nair@kiet.edu", "Arjun Nair", KIET, "IT", 2, "2400290130021", "9876500021"),
    ("tanvi.arora@kiet.edu", "Tanvi Arora", KIET, "IT", 2, "2400290130058", "9876500058"),
    ("rohan.mehta@gmail.com", "Rohan Mehta", ABES, None, 2, "ABES24CS118", "9812300118"),
    ("sneha.kapoor@gmail.com", "Sneha Kapoor", ABES, None, 2, "ABES24CS141", "9812300141"),
    ("ishaan.jain@gmail.com", "Ishaan Jain", DPS, None, 11, "", "9811203344"),
]


# Department admins shown on the admin panel's development picker. superadmin@kiet.edu comes from SUPER_ADMIN_EMAILS.
ADMINS = [
    ("cse.coordinator@kiet.edu", "Amit Kumar", "CSE"),
    ("it.coordinator@kiet.edu", "Sonal Gupta", "IT"),
]


def main() -> None:
    settings = get_settings()
    if settings.environment == "production":
        sys.exit("Refusing to seed demo data in production.")

    with get_sessionmaker()() as db:
        users: dict[str, User] = {}
        for email, name, (kind, institution, city, course), department, year, roll, phone in STUDENTS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, name=name)
                db.add(user)
                db.flush()
            users[email] = user
            if db.get(Profile, user.id) is None:
                db.add(
                    Profile(
                        user_id=user.id,
                        full_name=name,
                        phone=phone,
                        participant_type=kind,
                        institution=institution,
                        institution_key=rules.institution_key(kind, institution, city),
                        city=city,
                        department=department,
                        course=course,
                        year=year,
                        roll_number=roll,
                    )
                )
        db.flush()

        if db.scalar(select(Team).where(Team.name_key == "circuit breakers")) is None:
            leader, member = users["arjun.nair@kiet.edu"], users["tanvi.arora@kiet.edu"]
            team = Team(
                name="Circuit Breakers",
                name_key="circuit breakers",
                category=3,
                domain="IoT, Robotics & Automation",
                project_title="Smart irrigation controller for small farms",
                abstract=(
                    "A low-cost soil moisture and weather aware irrigation controller that cuts water use for small farms, "
                    "built on an ESP32 with a solar power supply and SMS alerts for farmers without smartphones."
                ),
                participant_type="kiet",
                institution=rules.KIET_INSTITUTION,
                institution_key=rules.institution_key("kiet", rules.KIET_INSTITUTION, rules.KIET_CITY),
                department="IT",
                route="department",
                leader_id=leader.id,
            )
            db.add(team)
            db.flush()
            db.add_all(
                [
                    TeamMember(team_id=team.id, user_id=leader.id, role="leader"),
                    TeamMember(team_id=team.id, user_id=member.id, role="member"),
                ]
            )
        for email, name, department in ADMINS:
            if db.get(Admin, email) is None:
                db.add(Admin(email=email, name=name, role="admin", department=department, created_by="dev_seed"))
        db.commit()
    print(f"Seeded {len(STUDENTS)} demo students, the Circuit Breakers team and {len(ADMINS)} department admins.")


if __name__ == "__main__":
    main()
