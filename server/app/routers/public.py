"""Endpoints that need no sign-in: what the public pages need to know before anyone logs in."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import verify_session
from ..config import Settings, get_settings
from ..db import get_db
from ..errors import ApiError
from ..models import User, utcnow
from ..schemas import FeedbackInput, PublicConfigOut, RegistrationOut
from ..services import feedback, schedule

router = APIRouter(tags=["public"])


@router.get("/config")
def public_config(db: Annotated[Session, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings)]) -> PublicConfigOut:
    """The registration window as the server enforces it, so the site never relies on a visitor's clock."""
    window = schedule.load(db, settings)
    now = utcnow()
    return PublicConfigOut(
        # Open while anyone can still register (other colleges and schools have a later deadline); the server decides per student.
        registration=RegistrationOut(state=window.latest_state(now), opens=window.opens, closes=window.closes_for(True)),
        server_time=now,
    )


@router.post("/feedback", status_code=status.HTTP_204_NO_CONTENT)
def send_feedback(
    data: FeedbackInput,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    """Feedback from the thank-you letter. A signed-in student's details come from their account; anyone else gives theirs."""
    user = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            identity = verify_session(authorization[7:].strip(), "portal", settings)
            user = db.scalar(select(User).where(User.email == identity.email))
        except ApiError:
            user = None  # an expired session still lets them send it, as a guest
    feedback.submit(db, data, user, request.client.host if request.client else "unknown")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
