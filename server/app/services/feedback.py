"""
Feedback from the thank-you letter on the home page. Anyone may send it: a signed-in student's name, email, phone, college
or school and team come from their account; anyone else gives their name and email. Only super admins read it.
"""

import re
from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errors import ApiError
from ..models import Admin, Feedback, Profile, Team, TeamMember, User
from ..schemas import FeedbackInput, FeedbackListOut, FeedbackOut
from . import limits

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _clean(value: str) -> str:
    return " ".join(value.split())


def submit(db: Session, data: FeedbackInput, user: User | None, address: str) -> None:
    limits.hit(
        f"feedback-ip:{address}", 10, timedelta(hours=1), "Thank you! You have sent a lot of feedback already; please try again later."
    )
    row = Feedback(
        rating=data.rating,
        liked=data.liked.strip(),
        improve=data.improve.strip(),
        role=data.role,
        name=_clean(data.name),
        email=data.email.strip().lower(),
        phone=_clean(data.phone),
        institution=_clean(data.institution),
    )
    if user is not None:
        limits.hit(f"feedback-user:{user.id}", 5, timedelta(hours=1), "Thank you! You have sent feedback several times already.")
        profile = db.get(Profile, user.id)
        team = db.scalar(select(Team).join(TeamMember, TeamMember.team_id == Team.id).where(TeamMember.user_id == user.id))
        row.user_id, row.email, row.role = user.id, user.email, "student"
        row.name = (profile.full_name if profile else "") or user.name or row.name
        if profile is not None:
            row.phone = profile.phone
            row.institution = profile.institution if profile.participant_type != "kiet" else f"KIET {profile.department or ''}".strip()
        row.team_code = team.code if team else ""
    if len(row.name) < 2:
        raise ApiError("Please tell us your name.", 422)
    if not EMAIL.match(row.email):
        raise ApiError("Please give a valid email, so we can reach you if needed.", 422)
    db.add(row)
    db.commit()


def listing(db: Session, admin: Admin) -> FeedbackListOut:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can read the feedback.", 403)
    rows = list(db.scalars(select(Feedback).order_by(Feedback.created_at.desc())))
    teams = {
        t.code: t.name
        for t in db.scalars(select(Team).where(Team.number.in_([int(r.team_code[5:]) for r in rows if r.team_code[5:].isdigit()])))
    }
    counts = Counter(r.rating for r in rows)
    return FeedbackListOut(
        items=[
            FeedbackOut(
                id=r.id,
                created_at=r.created_at,
                name=r.name,
                email=r.email,
                phone=r.phone,
                role=r.role,
                institution=r.institution,
                team_code=r.team_code,
                team_name=teams.get(r.team_code, ""),
                signed_in=r.user_id is not None,
                rating=r.rating,
                liked=r.liked,
                improve=r.improve,
            )
            for r in rows
        ],
        average=round(sum(r.rating for r in rows) / len(rows), 2) if rows else None,
        ratings={n: counts.get(n, 0) for n in range(1, 6)},
    )
