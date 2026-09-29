"""
Notification emails, sent after the request has committed (FastAPI background tasks).
A failed email is logged and never fails the student's action.
"""

import html
import logging
from dataclasses import dataclass
from functools import lru_cache

from .config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str


@lru_cache
def _ses_client(region: str):
    import boto3  # Imported lazily: only needed when EMAIL_BACKEND=ses.

    return boto3.client("sesv2", region_name=region or None)


def send(email: Email, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if settings.email_backend == "log":
        logger.info("Email to %s: %s", email.to, email.subject)
        return
    try:
        body_html = "<br>".join(html.escape(line) for line in email.text.splitlines())
        _ses_client(settings.ses_region).send_email(
            FromEmailAddress=settings.email_sender,
            Destination={"ToAddresses": [email.to]},
            Content={
                "Simple": {
                    "Subject": {"Data": email.subject, "Charset": "UTF-8"},
                    "Body": {
                        "Text": {"Data": email.text, "Charset": "UTF-8"},
                        "Html": {"Data": f"<p>{body_html}</p>", "Charset": "UTF-8"},
                    },
                }
            },
        )
    except Exception:
        logger.exception("Could not send email to %s", email.to)


def invitation(to: str, team_name: str, team_code: str, leader_name: str, settings: Settings | None = None) -> Email:
    settings = settings or get_settings()
    return Email(
        to=to,
        subject=f"{leader_name} invited you to join {team_name} at InnoTech'26",
        text=(
            f"{leader_name} has invited you to join the team {team_name} ({team_code}) for InnoTech'26.\n\n"
            f"Sign in to accept or decline the invitation: {settings.portal_url}/dashboard\n\n"
            "You can be part of only one team. If you were not expecting this email, you can ignore it."
        ),
    )


def team_submitted(to: str, team_name: str, team_code: str, settings: Settings | None = None) -> Email:
    settings = settings or get_settings()
    return Email(
        to=to,
        subject=f"{team_name} is registered for InnoTech'26",
        text=(
            f"Your team {team_name} ({team_code}) has been submitted for InnoTech'26. "
            "Members and category are now locked.\n\n"
            f"You can view your team at {settings.portal_url}/team"
        ),
    )
