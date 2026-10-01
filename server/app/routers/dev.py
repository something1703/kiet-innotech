"""
Development only: signs anyone in without Google, so the frontends can run against a local backend.
main.py registers this router only when ENVIRONMENT=development and DEV_SIGN_IN=true.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import EmailStr, Field
from sqlalchemy.orm import Session

from ..auth import App, Identity, sign_in
from ..config import Settings, get_settings
from ..db import get_db
from ..schemas import Input, SessionOut

router = APIRouter(prefix="/dev", tags=["development"])


class DevTokenInput(Input):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    app: App = "portal"


@router.post("/token")
def dev_token(
    data: DevTokenInput,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionOut:
    return SessionOut(**sign_in(db, Identity(email=str(data.email).lower(), name=data.name), data.app, settings))
