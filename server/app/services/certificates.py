import json
import uuid
from pathlib import Path

import pymupdf as fitz
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import rules
from ..errors import ApiError
from ..models import (
    Attendance,
    Award,
    CertificateFont,
    CertificateTemplate,
    Juror,
    Panel,
    PanelJuror,
    Profile,
    Score,
    Team,
    TeamMember,
    User,
)
from . import judging, release

CERT_TYPES = [
    "dept_judge",
    "dept_participation",
    "dept_winner",
    "institute_judge",
    "institute_participation",
    "institute_winner",
]

MAX_SHRINK_PT = 6

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
BUILTIN_FONTS = {
    "Montserrat": "Montserrat-Regular.ttf",
    "Montserrat SemiBold": "Montserrat-SemiBold.ttf",
    "Montserrat Bold": "Montserrat-Bold.ttf",
}


def _get_fonts(db: Session) -> dict[str, bytes]:
    fonts = {name: (FONT_DIR / filename).read_bytes() for name, filename in BUILTIN_FONTS.items()}
    for font in db.scalars(select(CertificateFont)):
        fonts[font.name] = font.data
    return fonts


def _published(db: Session, cert_type: str) -> bool:
    tmpl = db.scalar(select(CertificateTemplate).where(CertificateTemplate.type == cert_type))
    return bool(tmpl and tmpl.is_published)


def _is_present(db: Session, user_id: uuid.UUID, round_: str) -> bool:
    return (
        db.scalar(
            select(Attendance).where(
                Attendance.user_id == user_id,
                Attendance.round == round_,
                Attendance.status == "present",
            )
        )
        is not None
    )


# What a certificate says about the organisers. One place to change it.
ORGANISER_LINE = "DEPARTMENT OF IT & CSE - CS"

NOT_RELEASED = "Certificates appear here once the organisers release the department round results."
NOT_PRESENT = (
    "Certificates are given to students who were marked present at the department round. If you attended and are not marked "
    "present, please tell your department coordinator."
)
NOT_TAKING_PART = "Your team did not take part in the department round, so there is no certificate."
NOT_READY = "Your certificate is being prepared. Please check back soon."


def _student_team(db: Session, user: User) -> Team | None:
    member = db.scalar(select(TeamMember).where(TeamMember.user_id == user.id))
    return db.get(Team, member.team_id) if member else None


def _took_part(db: Session, team: Team | None) -> bool:
    """A KIET department-route team that was judged in the department round (submitted and not rejected or disqualified)."""
    return (
        team is not None
        and team.route == "department"
        and db.scalar(select(Team.id).where(Team.id == team.id, judging._eligible_condition("department"))) is not None
    )


def _winning_award(db: Session, team: Team) -> Award | None:
    """The team's department award, once winners are shown to students."""
    if not release.awards_published(db):
        return None
    return db.scalar(select(Award).where(Award.team_id == team.id, Award.round == "department", Award.place.in_([1, 2])))


def student_certificate_status(db: Session, user: User) -> tuple[str | None, str | None]:
    """The one certificate this student can download now, or why there is none: (type, None) or (None, message)."""
    profile = db.get(Profile, user.id)
    team = _student_team(db, user)
    if profile is None or not _took_part(db, team) or user.banned_at is not None:
        return None, NOT_TAKING_PART
    assert team is not None
    award = _winning_award(db, team)
    if not release.is_released(db) and award is None:
        return None, NOT_RELEASED
    if not _is_present(db, user.id, "department"):
        return None, NOT_PRESENT
    # A winning team's students get the winner certificate; everyone else who was present gets the participation one.
    kind = "dept_winner" if award is not None else "dept_participation"
    if kind == "dept_participation" and not release.is_released(db):
        return None, NOT_RELEASED
    if not _published(db, kind):
        return None, NOT_READY
    return kind, None


def get_student_certificates(db: Session, user: User) -> tuple[list, str | None]:
    kind, message = student_certificate_status(db, user)
    if kind is None:
        return [], message
    return [{"type": kind, "available": True, "reason": None}], None


def judge_certificate_status(db: Session, juror: Juror) -> tuple[bool, str | None]:
    """A judge who judged: sat in a department room and scored a team there, or was marked present in it."""
    if not release.is_released(db):
        return False, NOT_RELEASED
    judged = _judged(db, juror)
    if not judged:
        return False, "No judging was recorded for you in the department round, so there is no certificate."
    if not _published(db, "dept_judge"):
        return False, NOT_READY
    return True, None


def get_judge_certificates(db: Session, juror: Juror) -> list:
    ok, reason = judge_certificate_status(db, juror)
    return [{"type": "dept_judge", "available": ok, "reason": reason}]


def recipient_counts(db: Session, winner_team_ids: set) -> dict:
    """How many students and judges the release would give a certificate to, for the confirmation screen."""
    teams = select(Team.id).where(Team.route == "department", judging._eligible_condition("department"))
    marks = {
        user_id: status
        for user_id, status in db.execute(select(Attendance.user_id, Attendance.status).where(Attendance.round == "department")).tuples()
    }
    students = present = absent = not_marked = winner_students = 0
    for user_id, team_id, banned in db.execute(
        select(TeamMember.user_id, TeamMember.team_id, User.banned_at)
        .join(User, User.id == TeamMember.user_id)
        .where(TeamMember.team_id.in_(teams))
    ).tuples():
        students += 1
        state = marks.get(user_id, "not_marked")
        if state == "present" and banned is None:
            present += 1
            winner_students += team_id in winner_team_ids
        elif state == "absent":
            absent += 1
        elif state != "present":
            not_marked += 1
    judges = sum(1 for j in db.scalars(select(Juror)) if _judged(db, j))
    templates = {
        row.type: row.is_published
        for row in db.scalars(select(CertificateTemplate))
        if row.type in ("dept_participation", "dept_winner", "dept_judge")
    }
    return {
        "students": students,
        "present": present,
        "absent": absent,
        "not_marked": not_marked,
        "winner_students": winner_students,
        "participation_students": present - winner_students,
        "judges": judges,
        "templates": {t: templates.get(t, False) for t in ("dept_participation", "dept_winner", "dept_judge")},
    }


def _judged(db: Session, juror: Juror) -> bool:
    return bool(
        db.scalar(
            select(func.count())
            .select_from(PanelJuror)
            .join(Panel, Panel.id == PanelJuror.panel_id)
            .where(PanelJuror.juror_email == juror.email, Panel.round == "department", PanelJuror.present_at.is_not(None))
        )
        or db.scalar(select(func.count()).select_from(Score).where(Score.juror_email == juror.email, Score.round == "department"))
    )


def _build_student_data(db: Session, user: User, team: Team, award: Award | None = None) -> dict:
    profile = db.get(Profile, user.id)
    data = {
        "recipient_name": profile.full_name if profile else user.name,
        "team_name": team.name,
        "team_code": team.code,
        "department": team.department or (profile.department if profile else "") or "",
        "category": rules.CATEGORIES[team.category].title if team.category in rules.CATEGORIES else "",
        "project_title": team.project_title,
        "organisation": ORGANISER_LINE,
    }
    if award:
        data["place"] = "1st" if award.place == 1 else "2nd"
        data["award_amount"] = str(award.amount) if award.amount else ""
    return data


def _build_judge_data(juror: Juror) -> dict:
    return {"recipient_name": juror.name, "department": juror.department or "", "organisation": ORGANISER_LINE}


def _hex_to_rgb(hex_color: str):
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return (0.0, 0.0, 0.0)
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def render_certificate(db: Session, template_type: str, recipient_data: dict, *, require_published: bool = True) -> bytes:
    tmpl = db.scalar(select(CertificateTemplate).where(CertificateTemplate.type == template_type))
    if not tmpl:
        raise ApiError("Certificate template not found", 404)
    if require_published and not tmpl.is_published:
        raise ApiError("Certificate not available", 404)

    fonts = _get_fonts(db)
    fields = json.loads(tmpl.fields_json) if tmpl.fields_json else []

    doc = fitz.open(stream=tmpl.pdf_data, filetype="pdf")
    page = doc[0]
    inserted: dict[str, str] = {}  # each font goes into the file once, however many boxes use it

    for field in fields:
        label = field.get("label") or field.get("source_key") or ""
        text = ""
        if label in recipient_data:
            text = str(recipient_data[label]) if recipient_data[label] is not None else ""
        elif field.get("default_text"):
            text = field.get("default_text", "")
        if not text:
            continue
        font_name = field.get("font", "Montserrat")
        font_name = font_name if font_name in fonts else "Montserrat"
        if font_name not in inserted:
            inserted[font_name] = f"certfont{len(inserted)}"
            page.insert_font(fontname=inserted[font_name], fontbuffer=fonts[font_name])
        alias = inserted[font_name]
        color = _hex_to_rgb(field.get("color", "#000000"))
        align = field.get("align", 1)
        rotation = field.get("rotation", 0)
        size = float(field.get("fontsize", 24))
        x = float(field["x_pt"])
        y = float(field["y_pt"])
        w = float(field["w_pt"])
        h = float(field["h_pt"])

        if rotation in (90, 270):
            point = fitz.Point(x + w / 2, y + h)
            page.insert_text(
                point,
                text,
                fontname=alias,
                fontsize=size,
                color=color,
                rotate=rotation,
            )
            continue

        rect = fitz.Rect(x, y, x + w, y + h)
        fitted = size
        placed = False
        while fitted >= MAX_SHRINK_PT:
            remaining = page.insert_textbox(
                rect,
                text,
                fontname=alias,
                fontsize=fitted,
                color=color,
                align=align,
                rotate=rotation,
            )
            if remaining >= 0:
                placed = True
                break
            fitted -= 1
        # A name too long for its box even at the smallest size is cut with an ellipsis, so a certificate is always produced.
        shortened = text
        while not placed and len(shortened) > 4:
            shortened = shortened[: max(4, len(shortened) - 3)].rstrip() + "…"
            placed = (
                page.insert_textbox(rect, shortened, fontname=alias, fontsize=MAX_SHRINK_PT, color=color, align=align, rotate=rotation) >= 0
            )
        if not placed:
            raise ApiError(f"The text {label!r} does not fit its box.", 400)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def generate_preview_png(pdf_data: bytes, dpi: int = 150) -> tuple[bytes, float, float]:
    doc = fitz.open(stream=pdf_data, filetype="pdf")
    page = doc[0]
    width_pt, height_pt = page.rect.width, page.rect.height
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    doc.close()
    return png_bytes, width_pt, height_pt


def student_certificate_data(db: Session, user: User, cert_type: str) -> dict:
    kind, _ = student_certificate_status(db, user)
    if kind is None or kind != cert_type:
        raise ApiError("Certificate not available.", 404)
    team = _student_team(db, user)
    assert team is not None
    return _build_student_data(db, user, team, _winning_award(db, team) if kind == "dept_winner" else None)


def judge_certificate_data(db: Session, juror: Juror, cert_type: str) -> dict:
    ok, _ = judge_certificate_status(db, juror)
    if cert_type != "dept_judge" or not ok:
        raise ApiError("Certificate not available.", 404)
    return _build_judge_data(juror)
