"""
Database tables.

Rules that must hold even under concurrent requests are also enforced by constraints:
one team per student (team_members.user_id is unique), unique team names, one pending
invitation per team and email, and at most one profile per KIET roll number.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import rules
from .db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


Timestamp = DateTime(timezone=True)


class User(Base):
    """Anyone who has signed in with Google through Cognito."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    # Cognito "sub"; unique per account in the user pool.
    cognito_sub: Mapped[str | None] = mapped_column(String(128), unique=True)
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)

    profile: Mapped["Profile | None"] = relationship(back_populates="user", uselist=False)
    membership: Mapped["TeamMember | None"] = relationship(back_populates="user", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("participant_type IN ('kiet', 'college', 'school')", name="participant_type"),
        # A KIET roll number belongs to one student; duplicates mean a typo or a second account.
        Index(
            "uq_profiles_kiet_roll_number",
            "roll_number",
            unique=True,
            postgresql_where=text("participant_type = 'kiet'"),
            sqlite_where=text("participant_type = 'kiet'"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(10))
    participant_type: Mapped[str] = mapped_column(String(10))
    institution: Mapped[str] = mapped_column(String(200))
    institution_key: Mapped[str] = mapped_column(String(200), index=True)
    city: Mapped[str] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(20), index=True)
    course: Mapped[str] = mapped_column(String(40))
    year: Mapped[int] = mapped_column(Integer)
    roll_number: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="profile")


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        CheckConstraint("category BETWEEN 1 AND 8", name="category"),
        CheckConstraint("status IN ('draft', 'submitted', 'withdrawn', 'disqualified')", name="status"),
        CheckConstraint("result IN ('pending', 'finalist', 'not_selected')", name="result"),
        CheckConstraint("route IN ('department', 'finale')", name="route"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Sequential number behind the human-friendly code, e.g. 42 -> "IT26-0042".
    number: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), Identity(), unique=True)
    name: Mapped[str] = mapped_column(String(40))
    name_key: Mapped[str] = mapped_column(String(40), unique=True)
    # Private code the leader shares so registered students can join without an email invitation.
    join_code: Mapped[str] = mapped_column(String(9), unique=True, default=rules.new_join_code)
    category: Mapped[int] = mapped_column(Integer, index=True)
    domain: Mapped[str] = mapped_column(String(80))
    project_title: Mapped[str] = mapped_column(String(120))
    abstract: Mapped[str] = mapped_column(Text)
    participant_type: Mapped[str] = mapped_column(String(10), index=True)
    institution: Mapped[str] = mapped_column(String(200))
    institution_key: Mapped[str] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(20), index=True)
    route: Mapped[str] = mapped_column(String(10))
    leader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(15), default="draft", index=True)
    status_reason: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str] = mapped_column(String(15), default="pending")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, onupdate=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(Timestamp)

    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan", order_by="TeamMember.joined_at")
    invitations: Mapped[list["Invitation"]] = relationship(back_populates="team", cascade="all, delete-orphan")

    @property
    def code(self) -> str:
        return f"IT26-{self.number:04d}"


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (CheckConstraint("role IN ('leader', 'member')", name="role"),)

    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    # Unique: a student can be in only one team.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, unique=True)
    role: Mapped[str] = mapped_column(String(10))
    joined_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)

    team: Mapped[Team] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="membership")


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted', 'declined', 'cancelled')", name="status"),
        Index(
            "uq_invitations_pending",
            "team_id",
            "email",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
        Index("ix_invitations_email_status", "email", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320))
    invited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(10), default="pending")
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(Timestamp)

    team: Mapped[Team] = relationship(back_populates="invitations")
    inviter: Mapped[User] = relationship()


class Admin(Base):
    """Organisers. Super admins see everything; admins are scoped to one KIET department."""

    __tablename__ = "admins"
    __table_args__ = (
        CheckConstraint("role IN ('super_admin', 'admin')", name="role"),
        CheckConstraint("role = 'super_admin' OR department IS NOT NULL", name="department"),
    )

    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(15))
    department: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)
    created_by: Mapped[str | None] = mapped_column(String(320))


class FinalistNomination(Base):
    """A KIET team a department has nominated for the Grand Finale."""

    __tablename__ = "finalist_nominations"

    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    department: Mapped[str] = mapped_column(String(20), index=True)
    category: Mapped[int] = mapped_column(Integer)
    nominated_by: Mapped[str] = mapped_column(String(320))
    nominated_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow)


class AppState(Base):
    """Single-row flags, e.g. when results were published."""

    __tablename__ = "app_state"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, onupdate=utcnow)


class AuditEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), Identity(), primary_key=True)
    at: Mapped[datetime] = mapped_column(Timestamp, default=utcnow, index=True)
    actor_email: Mapped[str] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(50))
    # No foreign key: the history of a deleted team is kept, along with its code.
    team_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    team_code: Mapped[str | None] = mapped_column(String(12))
    # KIET department the entry belongs to, so department admins see only their own history. Null = institute-wide.
    department: Mapped[str | None] = mapped_column(String(20), index=True)
    detail: Mapped[str] = mapped_column(Text, default="")
