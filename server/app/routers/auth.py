"""Signing in: proof of an email address in, our session token out ({token, expires_at, email, name})."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.orm import Session

from ..auth import App, sign_in, verify_google_credential
from ..config import Settings, get_settings
from ..db import get_db
from ..schemas import Input, SessionOut

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleSignInInput(Input):
    # A Google ID token is a few kilobytes at most.
    credential: str = Field(min_length=20, max_length=8192)
    app: App = "portal"


@router.post("/google")
def google(
    data: GoogleSignInInput,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionOut:
    identity, google_sub = verify_google_credential(data.credential, settings)
    return SessionOut(**sign_in(db, identity, data.app, settings, google_sub=google_sub))
