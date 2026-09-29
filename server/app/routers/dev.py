"""
Development only: issues signed test tokens so the frontends can run against a local backend without
Cognito. main.py registers this router only when ENVIRONMENT=development and DEV_JWT_SECRET is set.
"""

import time
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends
from pydantic import EmailStr, Field

from ..config import Settings, get_settings
from ..schemas import Input

router = APIRouter(prefix="/dev", tags=["development"])


class DevTokenInput(Input):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)


@router.post("/token")
def dev_token(data: DevTokenInput, settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, str | int]:
    email = str(data.email).lower()
    expires_in = 8 * 3600
    claims = {"email": email, "email_verified": True, "name": data.name, "sub": f"dev-{email}", "exp": int(time.time()) + expires_in}
    if settings.cognito_client_ids:
        claims["aud"] = settings.cognito_client_ids[0]
    return {"id_token": jwt.encode(claims, settings.dev_jwt_secret, algorithm="HS256"), "expires_in": expires_in}
