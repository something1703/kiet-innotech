"""The sandbox's own sign-in (an access code) and its reset. Every route answers 404 unless SANDBOX_MODE is on."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import EmailStr, Field
from sqlalchemy.orm import Session

from ..auth import SuperAdmin
from ..config import Settings, get_settings
from ..db import get_db
from ..schemas import Input, SandboxOut, SessionOut
from ..services import sandbox

router = APIRouter(prefix="/sandbox", tags=["sandbox"])

Db = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


class SandboxTokenInput(Input):
    email: EmailStr
    code: str = Field(min_length=1, max_length=200)


@router.post("/token")
def token(data: SandboxTokenInput, db: Db, settings: AppSettings) -> SessionOut:
    """Signs an organiser or judge in to the admin panel with the sandbox's access code."""
    return SessionOut(**sandbox.sign_in_with_code(db, settings, str(data.email), data.code))


@router.post("/reset")
def reset(admin: SuperAdmin, db: Db, settings: AppSettings) -> SandboxOut:
    """Super admin: wipes the sandbox and fills it with ten made-up teams in one room, scoring open."""
    return sandbox.reset(db, settings)
