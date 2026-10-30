"""
Outside judges at the Grand Finale sign in with their email and a password instead of Google.

- Passwords are made here and checked against a scrypt hash. They are also kept sealed (encrypted with a key derived
  from the server's session secret), so a super admin can look them up again on the Logins page, and the database alone
  does not reveal them. An account whose password was made before this existed has only the hash: give it a new one.
  A password starts with a word from the judge's email, so it is easy to tell whose it is, then has random digits:
  "cool.arunesh@gmail.com" gets e.g. "Arunesh@48217".
- Signing in (POST /auth/judge) issues the usual admin-panel session, marked as a password session, which opens the
  judge's own judging page only (auth.py). Wrong passwords are rate limited per email and per address.
- Judges appointed for the department round keep signing in with Google; a password is optional for anyone.
- Registration desk volunteers (admins with role "desk") sign in the same way; their session opens the registration desk
  only. A super admin makes their password when adding them, or a new one later.
"""

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import Identity, issue_session
from ..config import Settings, get_settings
from ..errors import ApiError
from ..models import Admin, Juror, Panel, PanelJuror, utcnow
from ..schemas import (
    CredentialOut,
    CredentialResetInput,
    CredentialResetOut,
    JudgeImportInput,
    JudgeImportOut,
    JudgeImportRow,
    JurorPasswordOut,
)
from . import audit, limits

# scrypt: 16 MiB of memory per hash, a few tens of milliseconds. Stored as "scrypt$n$r$p$salt$hash" (base64).
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
PASSWORD_DIGITS = 5
WRONG = "Wrong email or password."
# A hash of a random password, checked when the email is unknown so both cases take as long.
_DUMMY: str | None = None


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def check_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def _fernet() -> Fernet:
    secret = get_settings().session_secret.encode()
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"innotech-sealed-passwords-v1:" + secret).digest()))


def seal(password: str) -> str:
    return _fernet().encrypt(password.encode()).decode()


def unseal(sealed: str | None) -> str | None:
    """The password, or None when there is none kept (or the session secret has changed since it was sealed)."""
    if not sealed:
        return None
    try:
        return _fernet().decrypt(sealed.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def store_password(account: Admin | Juror, password: str, by: str, at: datetime | None = None) -> None:
    """Makes `password` the account's sign-in password: the hash that is checked, and the sealed copy for super admins."""
    account.password_hash, account.password_sealed = hash_password(password), seal(password)
    account.password_set_at, account.password_set_by = at or utcnow(), by


def clear_password(account: Admin | Juror) -> None:
    account.password_hash = account.password_sealed = account.password_set_at = account.password_set_by = None


def _dummy_hash() -> str:
    global _DUMMY
    if _DUMMY is None:
        _DUMMY = hash_password(secrets.token_hex(16))
    return _DUMMY


def email_word(email: str) -> str:
    """The longest run of letters in the email's local part ("cool.arunesh" -> "Arunesh"), or "Judge"."""
    words = re.findall(r"[a-z]+", email.split("@", 1)[0].lower())
    word = max(words, key=len, default="")
    return word[:12].capitalize() if len(word) >= 3 else "Judge"


def new_password(email: str) -> str:
    """A password related to the judge's email, with random digits: "Arunesh@48217"."""
    digits = "".join(secrets.choice("0123456789") for _ in range(PASSWORD_DIGITS))
    return f"{email_word(email)}@{digits}"


# ---------- Signing in ----------


def sign_in(db: Session, email: str, password: str, settings: Settings, address: str) -> dict[str, str]:
    email = email.strip().lower()
    # Per email (someone guessing one judge's password) and per address (someone trying many judges).
    limits.hit(f"judge-login:{email}", 10, timedelta(minutes=10), "Too many attempts. Wait ten minutes and try again.")
    limits.hit(f"judge-login-ip:{address}", 40, timedelta(minutes=10), "Too many attempts. Wait ten minutes and try again.")
    juror = db.get(Juror, email)
    if juror is not None and juror.password_hash and check_password(password, juror.password_hash):
        return issue_session(Identity(email=juror.email, name=juror.name, password=True), "admin", settings)
    desk = db.get(Admin, email)
    if desk is not None and desk.role == "desk" and desk.password_hash and check_password(password, desk.password_hash):
        return issue_session(Identity(email=desk.email, name=desk.name, desk=True), "admin", settings)
    if not (juror is not None and juror.password_hash) and not (desk is not None and desk.password_hash):
        # Unknown email: check a password anyway, so it takes as long as a wrong password.
        check_password(password, _dummy_hash())
    raise ApiError(WRONG, 401)


# ---------- Super admins: passwords and the list of judges ----------


def _require_super(admin: Admin) -> None:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can manage judges' passwords.", 403)


def set_password(db: Session, admin: Admin, email: str) -> JurorPasswordOut:
    """Gives a judge a new password (the old one stops working) and returns it once, to hand to the judge."""
    _require_super(admin)
    juror = db.scalar(select(Juror).where(Juror.email == email.strip().lower()).with_for_update())
    if juror is None:
        raise ApiError("No judge with this email exists.", 404)
    password = new_password(juror.email)
    store_password(juror, password, admin.email)
    audit.record(db, admin.email, "judging.judge_password_set", detail=f"New sign-in password for {juror.email}")
    db.commit()
    return JurorPasswordOut(email=juror.email, name=juror.name, password=password)


def set_desk_password(db: Session, admin: Admin, email: str) -> JurorPasswordOut:
    """A new sign-in password for a registration desk volunteer (the old one stops working), returned once."""
    _require_super(admin)
    desk = db.scalar(select(Admin).where(Admin.email == email.strip().lower()).with_for_update())
    if desk is None or desk.role != "desk":
        raise ApiError("No registration desk volunteer with this email exists.", 404)
    password = new_password(desk.email)
    store_password(desk, password, admin.email)
    audit.record(db, admin.email, "admin.desk_password_set", detail=f"New sign-in password for {desk.email}")
    db.commit()
    return JurorPasswordOut(email=desk.email, name=desk.name, password=password)


def remove_password(db: Session, admin: Admin, email: str) -> None:
    """The judge can no longer sign in with a password (Google still works for a @kiet.edu judge)."""
    _require_super(admin)
    juror = db.scalar(select(Juror).where(Juror.email == email.strip().lower()).with_for_update())
    if juror is None:
        raise ApiError("No judge with this email exists.", 404)
    if juror.password_hash:
        clear_password(juror)
        audit.record(db, admin.email, "judging.judge_password_removed", detail=f"Password sign-in turned off for {juror.email}")
        db.commit()


def import_judges(db: Session, admin: Admin, data: JudgeImportInput) -> JudgeImportOut:
    """
    Appoints outside judges in one go, each with a new password, and returns the passwords once. A judge who already exists
    is left as they are, unless they have no password yet: they get one. Rows are checked first, so nothing is saved when
    one is wrong.
    """
    _require_super(admin)
    seen: set[str] = set()
    for row in data.judges:
        if row.email in seen:
            raise ApiError(f"{row.email} is listed twice.", 422)
        seen.add(row.email)
    existing = {j.email: j for j in db.scalars(select(Juror).where(Juror.email.in_(seen)).with_for_update())}
    out: list[JudgeImportRow] = []
    now = utcnow()
    for row in data.judges:
        juror = existing.get(row.email)
        if juror is not None and juror.password_hash:
            out.append(JudgeImportRow(email=juror.email, name=juror.name, status="exists", password=None))
            continue
        password = new_password(row.email)
        if juror is None:
            juror = Juror(
                email=row.email,
                name=row.name,
                kind="external",
                department=None,
                organisation=row.organisation or "Outside expert",
                phone=row.phone,
                created_by=admin.email,
            )
            db.add(juror)
            status = "created"
        else:
            status = "password_added"
        store_password(juror, password, admin.email, now)
        out.append(JudgeImportRow(email=row.email, name=juror.name, status=status, password=password))
    created = sum(1 for r in out if r.status == "created")
    audit.record(
        db,
        admin.email,
        "judging.judges_imported",
        detail=f"{created} outside judges appointed, {sum(1 for r in out if r.status == 'password_added')} given a password, "
        f"{sum(1 for r in out if r.status == 'exists')} already had one",
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError("A judge was just added by someone else. Reload and import again.", 409) from exc
    return JudgeImportOut(judges=out)


# ---------- Super admins: every login they made, with its password ----------


def _credential(account: Admin | Juror, panels: dict[str, list[str]] | None = None) -> CredentialOut:
    juror = isinstance(account, Juror)
    return CredentialOut(
        email=account.email,
        name=account.name,
        kind="judge" if juror else "desk",
        detail=(account.organisation or account.department or "") if juror else "Registration desk",
        phone=account.phone if juror else "",
        password=unseal(account.password_sealed),
        has_password=account.password_hash is not None,
        password_set_at=account.password_set_at,
        password_set_by=account.password_set_by,
        panels=(panels or {}).get(account.email, []) if juror else [],
    )


def credentials(db: Session, admin: Admin) -> list[CredentialOut]:
    """
    Every outside judge, every judge with a password and every registration desk volunteer, with the password when it is
    kept. Super admins only; reading is not logged (the page is for looking things up at any time), but handing out new
    passwords is.
    """
    _require_super(admin)
    judges = db.scalars(
        select(Juror).where((Juror.kind == "external") | (Juror.password_hash.is_not(None))).order_by(Juror.name, Juror.email)
    )
    desk = db.scalars(select(Admin).where(Admin.role == "desk").order_by(Admin.name, Admin.email))
    return [_credential(a, _finale_panels(db)) for a in [*judges, *desk]]


def _finale_panels(db: Session) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for email, name in db.execute(
        select(PanelJuror.juror_email, Panel.name)
        .join(Panel, Panel.id == PanelJuror.panel_id)
        .where(Panel.round == "final")
        .order_by(Panel.name)
    ):
        out.setdefault(email, []).append(name)
    return out


def reset_passwords(db: Session, admin: Admin, data: CredentialResetInput) -> CredentialResetOut:
    """New passwords for many accounts at once (the old ones stop working), returned with the accounts' details."""
    _require_super(admin)
    refs = sorted({(r.email.strip().lower(), r.kind) for r in data.accounts})
    done: list[Juror | Admin] = []
    skipped: list[str] = []
    now = utcnow()
    for email, kind in refs:  # sorted, so two super admins resetting overlapping lists lock rows in the same order
        if kind == "judge":
            account: Juror | Admin | None = db.scalar(select(Juror).where(Juror.email == email).with_for_update())
        else:
            account = db.scalar(select(Admin).where(Admin.email == email, Admin.role == "desk").with_for_update())
        if account is None:
            skipped.append(email)
            continue
        store_password(account, new_password(account.email), admin.email, now)
        done.append(account)
    if done:
        audit.record(
            db,
            admin.email,
            "credentials.reset",
            detail=f"New sign-in passwords for {len(done)} accounts: {', '.join(a.email for a in done[:20])}",
        )
    db.commit()
    panels = _finale_panels(db)
    return CredentialResetOut(credentials=[_credential(a, panels) for a in done], skipped=skipped)
