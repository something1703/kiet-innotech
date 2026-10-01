"""Request and response bodies. JSON is snake_case; the frontends convert to camelCase."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, TypeAdapter, ValidationError, field_validator, model_validator

from . import rules


class Input(BaseModel):
    """Base for request bodies: unknown fields are rejected and strings are trimmed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("*", mode="after")
    @classmethod
    def no_nul_characters(cls, value: object) -> object:
        # PostgreSQL cannot store NUL in text; reject it here instead of failing at the database.
        if isinstance(value, str) and "\x00" in value:
            raise ValueError("Text cannot contain NUL characters.")
        return value


# ---------- Students ----------


class ProfileInput(Input):
    full_name: str = Field(max_length=120)
    phone: str = Field(max_length=20)
    participant_type: rules.ParticipantType
    institution: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=100)
    department: str | None = Field(default=None, max_length=20)
    course: str = Field(default="", max_length=40)
    year: int
    roll_number: str = Field(default="", max_length=40)

    @field_validator("full_name")
    @classmethod
    def check_name(cls, value: str) -> str:
        if len(value) < 3:
            raise ValueError("Enter your full name.")
        return " ".join(value.split())

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        if not rules.is_valid_phone(value):
            raise ValueError("Enter a 10-digit Indian mobile number.")
        return rules.normalise_phone(value)

    @model_validator(mode="after")
    def check_by_type(self) -> "ProfileInput":
        if self.participant_type == "kiet":
            if self.department not in rules.DEPARTMENTS:
                raise ValueError("Choose your department.")
            if self.course not in rules.KIET_COURSES:
                raise ValueError("Choose your course.")
            if self.year not in rules.COLLEGE_YEARS:
                raise ValueError("Choose your year of study.")
            if not self.roll_number.isdigit() or not 10 <= len(self.roll_number) <= 15:
                raise ValueError("Enter your university roll number (digits only).")
            self.institution, self.city = rules.KIET_INSTITUTION, rules.KIET_CITY
            return self

        label = "school" if self.participant_type == "school" else "college"
        if len(self.institution) < 3:
            raise ValueError(f"Enter the full name of your {label}.")
        if not rules.normalise_institution(self.institution):
            # Teams are matched on this name, so it needs letters or digits we can compare.
            raise ValueError(f"Enter the name of your {label} in English letters.")
        if len(self.city) < 2:
            raise ValueError("Enter the city.")
        self.department = None
        if self.participant_type == "college":
            if self.course not in rules.COLLEGE_COURSES:
                raise ValueError("Choose your course.")
            if self.year not in rules.COLLEGE_YEARS:
                raise ValueError("Choose your year of study.")
            if len(self.roll_number) < 3:
                raise ValueError("Enter your college enrolment or roll number.")
        else:
            if self.year not in rules.SCHOOL_CLASSES:
                raise ValueError("Choose your class.")
            self.course = "School"
        return self


class ProfileOut(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    phone: str
    participant_type: str
    institution: str
    city: str
    department: str | None
    course: str
    year: int
    roll_number: str
    created_at: datetime


class RegistrationOut(BaseModel):
    """The registration window as the server enforces it; the portal follows this, not the device clock."""

    state: rules.RegistrationState
    opens: datetime
    closes: datetime


class MeOut(BaseModel):
    email: str
    name: str
    profile: ProfileOut | None
    registration: RegistrationOut


class SessionOut(BaseModel):
    token: str
    expires_at: datetime
    email: str
    name: str


class TeamInput(Input):
    name: str = Field(max_length=rules.TEAM_NAME_LENGTH[1])
    category: int
    domain: str = Field(max_length=80)
    project_title: str = Field(max_length=rules.PROJECT_TITLE_LENGTH[1])
    abstract: str = Field(max_length=rules.ABSTRACT_LENGTH[1])

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < rules.TEAM_NAME_LENGTH[0]:
            raise ValueError(f"Team name must be at least {rules.TEAM_NAME_LENGTH[0]} characters.")
        # Lower-casing can lengthen some letters (e.g. "İ"); the uniqueness key must still fit its column.
        if len(rules.normalise_team_name(value)) > rules.TEAM_NAME_LENGTH[1]:
            raise ValueError("Team name contains characters we cannot use. Please choose another name.")
        return value

    @field_validator("category")
    @classmethod
    def check_category(cls, value: int) -> int:
        if value not in rules.CATEGORIES:
            raise ValueError("Choose a category.")
        return value

    @field_validator("domain")
    @classmethod
    def check_domain(cls, value: str) -> str:
        if value not in rules.DOMAINS:
            raise ValueError("Choose a domain from the list.")
        return value

    @field_validator("project_title")
    @classmethod
    def check_title(cls, value: str) -> str:
        if len(value) < rules.PROJECT_TITLE_LENGTH[0]:
            raise ValueError(f"Project title must be at least {rules.PROJECT_TITLE_LENGTH[0]} characters.")
        return value

    @field_validator("abstract")
    @classmethod
    def check_abstract(cls, value: str) -> str:
        if len(value) < rules.ABSTRACT_LENGTH[0]:
            raise ValueError(f"Abstract must be at least {rules.ABSTRACT_LENGTH[0]} characters.")
        return value


class InviteInput(Input):
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        try:
            return str(TypeAdapter(EmailStr).validate_python(value)).lower()
        except ValidationError:
            raise ValueError("Enter a valid email address.") from None


class JoinInput(Input):
    code: str = Field(max_length=20)


class MemberOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    department: str | None
    course: str
    year: int
    role: str
    joined_at: datetime


class InvitationOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    team_code: str
    team_name: str
    category: int
    leader_name: str
    email: str
    status: str
    created_at: datetime


class TeamOut(BaseModel):
    id: uuid.UUID
    code: str
    # Only ever sent to the team's own members (and admins).
    join_code: str
    name: str
    category: int
    domain: str
    project_title: str
    abstract: str
    participant_type: str
    institution: str
    department: str | None
    route: str
    leader_id: uuid.UUID
    members: list[MemberOut]
    invitations: list[InvitationOut]
    status: str
    result: str
    created_at: datetime
    submitted_at: datetime | None


# ---------- Admin ----------


class ReasonInput(Input):
    reason: str = Field(min_length=5, max_length=500)


class AdminInput(Input):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    role: Literal["super_admin", "admin"]
    department: str | None = None

    @field_validator("email")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.lower()

    @model_validator(mode="after")
    def check_department(self) -> "AdminInput":
        if self.role == "admin" and self.department not in rules.DEPARTMENTS:
            raise ValueError("Choose the department this admin manages.")
        if self.role == "super_admin":
            self.department = None
        return self


class NominationInput(Input):
    category: int
    team_ids: list[uuid.UUID] = Field(max_length=10)


class NominationsInput(Input):
    nominations: list[NominationInput] = Field(max_length=8)


class AdminOut(BaseModel):
    email: str
    name: str
    role: str
    department: str | None
    added_at: datetime | None = None
    added_by: str | None = None


class AdminMemberOut(MemberOut):
    phone: str
    roll_number: str
    institution: str


class AdminTeamOut(TeamOut):
    members: list[AdminMemberOut]  # type: ignore[assignment]


class TeamSummaryOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    category: int
    participant_type: str
    institution: str
    department: str | None
    route: str
    status: str
    result: str
    leader_name: str
    member_count: int
    project_title: str
    submitted_at: datetime | None


class StudentTeamRef(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    status: str
    department: str | None
    role: str


class AdminStudentOut(ProfileOut):
    team: StudentTeamRef | None


class TeamPage(BaseModel):
    items: list[AdminTeamOut]
    total: int
    page: int
    page_size: int


class StudentPage(BaseModel):
    items: list[AdminStudentOut]
    total: int
    page: int
    page_size: int


class StatusCounts(BaseModel):
    total: int = 0
    draft: int = 0
    submitted: int = 0
    withdrawn: int = 0
    disqualified: int = 0


class TypeStats(BaseModel):
    type: str
    students: int
    teams: int
    submitted: int


class CategoryStats(StatusCounts):
    category: int


class DepartmentStats(StatusCounts):
    department: str
    students: int


class StatsOut(BaseModel):
    department: str | None
    students: int
    students_in_teams: int
    pending_invitations: int
    teams: StatusCounts
    by_type: list[TypeStats] | None
    by_category: list[CategoryStats]
    by_department: list[DepartmentStats] | None
    recent_submissions: list[TeamSummaryOut]
    results_published_at: datetime | None


class FinalistCategoryOut(BaseModel):
    category: int
    quota: int
    teams: list[TeamSummaryOut]
    nominated: list[uuid.UUID]


class FinalistBoardOut(BaseModel):
    department: str
    published_at: datetime | None
    updated_at: datetime | None
    updated_by: str | None
    categories: list[FinalistCategoryOut]


class MatrixCell(BaseModel):
    category: int
    quota: int
    nominated: int
    eligible: int


class MatrixRow(BaseModel):
    department: str
    categories: list[MatrixCell]


class FinalistSummaryOut(BaseModel):
    published_at: datetime | None
    published_by: str | None
    matrix: list[MatrixRow]
    direct_teams: list[TeamSummaryOut]


class PublishOut(BaseModel):
    published_at: datetime
    finalists: int
    not_selected: int


class AuditOut(BaseModel):
    id: str
    at: datetime
    actor_email: str
    action: str
    team_id: uuid.UUID | None
    team_code: str | None
    department: str | None
    detail: str
