"""Application settings, read from environment variables (or a .env file in development)."""

from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _split(value: object) -> object:
    """Accepts "a,b" or a JSON-free list so comma-separated env vars work."""
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "production"
    database_url: str = "postgresql+psycopg://localhost/innotech_dev"
    # Browser origins allowed to call the API: the student portal and the admin panel.
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # Amazon Cognito user pool that signs the ID tokens (Google is its identity provider).
    cognito_region: str = ""
    cognito_user_pool_id: str = ""
    # App client IDs whose tokens are accepted (student portal and admin panel may use separate clients).
    cognito_client_ids: Annotated[list[str], NoDecode] = Field(default_factory=list)
    # Only accept accounts that signed in through Google, never a username/password user in the pool.
    require_google_identity: bool = True
    # Requires Google's email_verified to be mapped onto the Cognito email_verified attribute.
    require_email_verified: bool = True

    # Development only: accept HS256 tokens signed with this secret instead of Cognito tokens.
    dev_jwt_secret: str = ""

    # These accounts are always super admins, so the first admin can sign in and add the others.
    super_admin_emails: Annotated[list[str], NoDecode] = Field(default_factory=list)

    registration_opens: datetime = datetime.fromisoformat("2026-10-03T00:00:00+05:30")
    registration_closes: datetime = datetime.fromisoformat("2026-10-12T23:59:59+05:30")
    # Testing only: treat registration as open regardless of the dates above.
    force_registration_open: bool = False

    # Invitation emails: "ses" sends through Amazon SES, "log" only writes them to the log.
    email_backend: Literal["ses", "log"] = "log"
    email_sender: str = "InnoTech'26 <no-reply@innotech.kiet.edu>"
    ses_region: str = ""
    portal_url: str = "https://innotech.kiet.edu"

    # Limits abuse of the invitation emails: invitations a team can send in 24 hours.
    invitations_per_team_per_day: int = 20

    @field_validator("cors_origins", "cognito_client_ids", "super_admin_emails", mode="before")
    @classmethod
    def split_lists(cls, value: object) -> object:
        return _split(value)

    @field_validator("super_admin_emails")
    @classmethod
    def lower_emails(cls, value: list[str]) -> list[str]:
        return [email.lower() for email in value]

    @model_validator(mode="after")
    def check_safe_for_production(self) -> "Settings":
        if self.environment == "production":
            if self.dev_jwt_secret:
                raise ValueError("DEV_JWT_SECRET must not be set in production.")
            if self.force_registration_open:
                raise ValueError("FORCE_REGISTRATION_OPEN must not be set in production.")
            if not (self.cognito_region and self.cognito_user_pool_id and self.cognito_client_ids):
                raise ValueError("COGNITO_REGION, COGNITO_USER_POOL_ID and COGNITO_CLIENT_IDS are required in production.")
            if "*" in self.cors_origins:
                raise ValueError("CORS_ORIGINS must list the exact frontend origins in production.")
        if self.registration_opens.tzinfo is None or self.registration_closes.tzinfo is None:
            raise ValueError("Registration dates must include a timezone offset, e.g. +05:30.")
        return self

    @property
    def cognito_issuer(self) -> str:
        return f"https://cognito-idp.{self.cognito_region}.amazonaws.com/{self.cognito_user_pool_id}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
