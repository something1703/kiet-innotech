"""
Who is calling. Every request carries a Cognito ID token (Authorization: Bearer <token>).

The token must be signed by the configured user pool, issued to one of our app clients, unexpired,
an ID token (not an access token), from a Google sign-in and carry a verified email. That email is
the student's identity, which is what makes the @kiet.edu rule trustworthy.
"""

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .errors import ApiError
from .models import Admin, User, utcnow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Identity:
    email: str
    name: str
    sub: str


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    # Keys are cached; an unknown key id triggers one refetch, which handles Cognito key rotation.
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=5)


def _truthy(value: Any) -> bool:
    return value is True or (isinstance(value, str) and value.lower() == "true")


def _signed_in_with_google(claims: dict[str, Any]) -> bool:
    identities = claims.get("identities")
    if isinstance(identities, str):
        try:
            identities = json.loads(identities)
        except ValueError:
            return False
    if not isinstance(identities, list):
        return False
    return any(isinstance(i, dict) and i.get("providerName") == "Google" for i in identities)


def verify_token(token: str, settings: Settings) -> Identity:
    unauthorized = ApiError("Your session has expired. Please sign in again.", 401)
    try:
        if settings.dev_jwt_secret and settings.environment != "production":
            claims = jwt.decode(
                token,
                settings.dev_jwt_secret,
                algorithms=["HS256"],
                audience=settings.cognito_client_ids or None,
                options={"require": ["exp", "email", "sub"], "verify_aud": bool(settings.cognito_client_ids)},
            )
        else:
            key = _jwks_client(f"{settings.cognito_issuer}/.well-known/jwks.json").get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["RS256"],
                audience=settings.cognito_client_ids,
                issuer=settings.cognito_issuer,
                options={"require": ["exp", "iat", "iss", "aud", "sub", "email", "token_use"]},
                leeway=30,
            )
            if claims.get("token_use") != "id":
                raise unauthorized
            if settings.require_google_identity and not _signed_in_with_google(claims):
                raise ApiError("Please sign in with Google.", 403)
    except jwt.PyJWKClientConnectionError as exc:
        logger.error("Could not fetch Cognito signing keys: %s", exc)
        raise ApiError("Sign-in is temporarily unavailable. Please try again shortly.", 503) from exc
    except jwt.PyJWTError as exc:
        raise unauthorized from exc

    if settings.require_email_verified and not _truthy(claims.get("email_verified")):
        raise ApiError("Your Google account email is not verified.", 403)

    email = str(claims["email"]).strip().lower()
    if "@" not in email:
        raise unauthorized
    name = str(claims.get("name") or claims.get("given_name") or email.split("@")[0]).strip()[:200]
    return Identity(email=email, name=name, sub=str(claims["sub"]))


def get_identity(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> Identity:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError("Please sign in.", 401)
    return verify_token(authorization[7:].strip(), settings)


def get_current_user(
    identity: Annotated[Identity, Depends(get_identity)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """The signed-in student's account, created on their first request."""
    user = db.scalar(select(User).where(User.cognito_sub == identity.sub))
    if user is None:
        # First sign-in, or the Cognito account was recreated: link by the verified email.
        user = db.scalar(select(User).where(User.email == identity.email))
        if user is None:
            user = User(email=identity.email, name=identity.name, cognito_sub=identity.sub)
            db.add(user)
        else:
            user.cognito_sub = identity.sub
    elif user.email != identity.email:
        if db.scalar(select(User.id).where(User.email == identity.email, User.id != user.id)):
            raise ApiError("This email is linked to another account. Contact the help desk.", 409)
        user.email = identity.email

    user.name = identity.name or user.name
    user.last_seen_at = utcnow()
    try:
        db.commit()
    except IntegrityError:
        # Two first requests raced to create the same account; the other one won.
        db.rollback()
        user = db.scalar(select(User).where(User.email == identity.email))
        if user is None:
            raise
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_admin(
    identity: Annotated[Identity, Depends(get_identity)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Admin:
    if identity.email in settings.super_admin_emails:
        admin = db.get(Admin, identity.email)
        return admin or Admin(email=identity.email, name=identity.name, role="super_admin", department=None)
    admin = db.get(Admin, identity.email)
    if admin is None:
        raise ApiError("This Google account is not an InnoTech26 admin.", 403)
    return admin


CurrentAdmin = Annotated[Admin, Depends(get_current_admin)]


def require_super_admin(admin: CurrentAdmin) -> Admin:
    if admin.role != "super_admin":
        raise ApiError("Only a super admin can do this.", 403)
    return admin


SuperAdmin = Annotated[Admin, Depends(require_super_admin)]
