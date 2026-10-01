"""
InnoTech26 registration rules. The server is the authority; client/lib/rules.ts mirrors these
for guidance in the browser, so keep the two in step.
"""

import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from zoneinfo import ZoneInfo

ParticipantType = Literal["kiet", "college", "school"]

IST = ZoneInfo("Asia/Kolkata")

KIET_EMAIL_DOMAIN = "kiet.edu"
KIET_INSTITUTION = "KIET Deemed to be University"
KIET_CITY = "Ghaziabad"

TEAM_MIN_SIZE = 2
TEAM_MAX_SIZE = 5

# Departments allowed two finalist teams in Categories 1 to 4. CSE(CS) is deliberately not included.
DOUBLE_QUOTA_DEPARTMENTS = {"CSE", "CS", "CSE(AI)", "CSE(AIML)"}

DEPARTMENTS = [
    "CSE", "CS", "IT", "CSIT", "CSE(AI)", "CSE(AIML)", "CSE(DS)", "CSE(CS)",
    "EN", "EC", "ELCE", "ME", "VLSI", "AM", "MCA", "KSOM", "KSOP",
]  # fmt: skip

KIET_COURSES = ["B.Tech", "M.Tech", "MCA", "MBA", "B.Pharm", "M.Pharm", "Diploma", "Other"]
COLLEGE_COURSES = ["B.Tech / B.E.", "M.Tech", "BCA", "MCA", "B.Sc", "M.Sc", "BBA", "MBA", "B.Pharm", "Diploma", "Other"]
COLLEGE_YEARS = [1, 2, 3, 4]
SCHOOL_CLASSES = [6, 7, 8, 9, 10, 11, 12]

DOMAINS = [
    "Artificial Intelligence & Machine Learning",
    "Agentic AI & Generative AI",
    "Cyber Security, Privacy & Trustworthy AI",
    "IoT, Robotics & Automation",
    "Blockchain & Digital Transformation",
    "Renewable Energy & Sustainable Engineering",
    "Smart Cities, Infrastructure & Green Mobility",
    "Healthcare, Biomedical Devices & Biotechnology",
    "AR/VR, Digital Twins & Industry 4.0",
    "Big Data, Cloud, 5G/6G & Quantum Technologies",
    "Affordable Technology for Rural Development",
    "Disaster Management & Environmental Solutions",
    "Start-up & Revenue Generation Solutions",
    "Other / not listed",
]


@dataclass(frozen=True)
class Category:
    number: int
    title: str
    open_to_schools: bool = False
    first_year_only: bool = False


CATEGORIES = {
    c.number: c
    for c in [
        Category(1, "Smart Solutions, Smarter Society"),
        Category(2, "AI Solutions for Automation"),
        Category(3, "Automation and Robotics"),
        Category(4, "From Concept to Reality"),
        Category(5, "Start Small, Scale Big, Sustain Always", open_to_schools=True),
        Category(6, "Gen Z to Budding Innovators", first_year_only=True),
        Category(7, "Creative Visions for a Sustainable Future", open_to_schools=True),
        Category(8, "CyberShield"),
    ]
}

TEAM_NAME_LENGTH = (3, 40)
PROJECT_TITLE_LENGTH = (5, 120)
ABSTRACT_LENGTH = (100, 1500)


def is_kiet_email(email: str) -> bool:
    return email.strip().lower().endswith(f"@{KIET_EMAIL_DOMAIN}")


def allowed_participant_types(email: str) -> list[ParticipantType]:
    """A @kiet.edu account registers as KIET; any other account as another college or a school."""
    return ["kiet"] if is_kiet_email(email) else ["college", "school"]


# Common short forms students type, so "ABES Engg. College" and "ABES Engineering College" compare equal.
INSTITUTION_ABBREVIATIONS = {
    "engg": "engineering",
    "engr": "engineering",
    "eng": "engineering",
    "coll": "college",
    "clg": "college",
    "univ": "university",
    "uni": "university",
    "inst": "institute",
    "instt": "institute",
    "tech": "technology",
    "mgmt": "management",
    "sr": "senior",
    "sec": "secondary",
    "sch": "school",
    "vidyalay": "vidyalaya",
    "and": "",
    "of": "",
    "the": "",
}


def normalise_institution(name: str) -> str:
    """So "K.I.E.T. Group", "kiet group" and "Kiet Grp" style variants compare equal. Empty if nothing comparable."""
    # Dots and apostrophes join letters ("K.I.E.T." is "kiet"); anything else separates words.
    words = re.sub(r"[^a-z0-9]+", " ", re.sub(r"[.'’]", "", name.lower())).split()
    return " ".join(w for w in (INSTITUTION_ABBREVIATIONS.get(word, word) for word in words) if w)[:200]


def institution_key(participant_type: str, institution: str, city: str) -> str:
    """Teams must share this key. Schools often share a name across cities (e.g. Delhi Public School), so add the city."""
    key = normalise_institution(institution)
    if participant_type == "school":
        key = f"{key} | {normalise_institution(city)}"
    return key[:200]


def normalise_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        return digits[1:]
    return digits


def is_valid_phone(phone: str) -> bool:
    return re.fullmatch(r"[6-9]\d{9}", normalise_phone(phone)) is not None


def normalise_team_name(name: str) -> str:
    """Key used to keep team names unique regardless of case and spacing."""
    return re.sub(r"\s+", " ", name.strip()).lower()


def category_error(category: int, participant_type: str, years: list[int]) -> str | None:
    """Why a team with members of these years cannot compete in `category`, or None if it can."""
    info = CATEGORIES.get(category)
    if info is None:
        return "Unknown category."
    if participant_type == "school" and not info.open_to_schools:
        return "School teams can only enter the poster categories (5 and 7)."
    if info.first_year_only and any(year != 1 for year in years):
        return "Only teams where every member is a first-year student can enter this category."
    return None


def finalist_quota(department: str, category: int) -> int:
    return 2 if department in DOUBLE_QUOTA_DEPARTMENTS and category <= 4 else 1


RegistrationState = Literal["upcoming", "open", "closed"]


def window_state(opens: datetime, closes: datetime, now: datetime | None = None) -> RegistrationState:
    now = now or datetime.now(UTC)
    if now < opens:
        return "upcoming"
    if now > closes:
        return "closed"
    return "open"


# ---------- Team join codes ----------

# No 0/O or 1/I, so codes read out loud or copied by hand stay unambiguous. 32^8 codes make guessing impractical.
JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_join_code() -> str:
    code = "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(8))
    return f"{code[:4]}-{code[4:]}"


def normalise_join_code(code: str) -> str | None:
    """ "k7pq 3xm9" -> "K7PQ-3XM9"; None if it cannot be a join code."""
    chars = re.sub(r"[\s-]", "", code).upper()
    if len(chars) != 8 or any(c not in JOIN_CODE_ALPHABET for c in chars):
        return None
    return f"{chars[:4]}-{chars[4:]}"
