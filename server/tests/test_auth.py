"""Signing in with Google, our session tokens, and the production settings checks."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import auth
from app.config import Settings, get_settings
from conftest import token

CLIENT_ID = "test-client.apps.googleusercontent.com"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def bearer(value: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {value}"}


# ---------- Session tokens ----------


def test_missing_and_malformed_tokens(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Basic abc"}).status_code == 401
    assert client.get("/me", headers=bearer("not-a-jwt")).status_code == 401


def session_claims(**overrides: object) -> dict:
    now = int(time.time())
    return {"iss": auth.SESSION_ISSUER, "aud": "portal", "sub": "a@kiet.edu", "name": "A", "iat": now, "exp": now + 60, **overrides}


def test_expired_and_forged_tokens(client):
    secret = get_settings().session_secret
    expired = jwt.encode(session_claims(exp=int(time.time()) - 120), secret, algorithm="HS256")
    assert client.get("/me", headers=bearer(expired)).status_code == 401
    forged = jwt.encode(session_claims(), "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    assert client.get("/me", headers=bearer(forged)).status_code == 401
    wrong_issuer = jwt.encode(session_claims(iss="someone-else"), secret, algorithm="HS256")
    assert client.get("/me", headers=bearer(wrong_issuer)).status_code == 401


def test_portal_and_admin_tokens_are_not_interchangeable(client):
    # root@kiet.edu is a super admin (SUPER_ADMIN_EMAILS), but a portal token must not open the admin API.
    assert client.get("/admin/me", headers=bearer(token("root@kiet.edu"))).status_code == 401
    assert client.get("/admin/me", headers=bearer(token("root@kiet.edu", app="admin"))).status_code == 200
    assert client.get("/me", headers=bearer(token("root@kiet.edu", app="admin"))).status_code == 401


def test_email_is_case_insensitive_identity(client):
    first = client.get("/me", headers=bearer(token("A.Student@KIET.edu")))
    assert first.json()["email"] == "a.student@kiet.edu"


def test_me_reports_registration_window(as_user, settings):
    registration = as_user("a@kiet.edu").get("/me").json()["registration"]
    assert registration["state"] == "open"  # FORCE_REGISTRATION_OPEN in tests
    assert registration["opens"].startswith("2026-10-03")


# ---------- Google sign-in ----------


class FakeGoogleKeys:
    def get_signing_key_from_jwt(self, _token: str):
        return type("Key", (), {"key": GOOGLE_KEY.public_key()})()


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(auth, "_google_keys", lambda: FakeGoogleKeys())


def google_token(**overrides: object) -> str:
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "Aarav.Sharma@kiet.edu",
        "email_verified": True,
        "hd": "kiet.edu",
        "name": "Aarav Sharma",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, GOOGLE_KEY, algorithm="RS256")


def test_google_sign_in_issues_a_portal_session(client, google):
    response = client.post("/auth/google", json={"credential": google_token(), "app": "portal"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "aarav.sharma@kiet.edu"
    assert body["name"] == "Aarav Sharma"
    me = client.get("/me", headers=bearer(body["token"]))
    assert me.status_code == 200
    assert me.json()["name"] == "Aarav Sharma"


def test_google_sign_in_for_other_colleges(client, google):
    credential = google_token(email="rohan@gmail.com", hd=None)
    assert client.post("/auth/google", json={"credential": credential}).status_code == 200


@pytest.mark.parametrize(
    ("overrides", "status"),
    [
        ({"aud": "someone-else"}, 401),
        ({"iss": "https://evil.example.com"}, 401),
        ({"exp": int(time.time()) - 3600}, 401),
        ({"email": None}, 401),
        ({"email_verified": False}, 403),
        # A personal Google account created with a @kiet.edu address is not KIET's Workspace.
        ({"hd": None}, 403),
        ({"hd": "gmail.com"}, 403),
    ],
)
def test_google_credential_rejected(client, google, overrides, status):
    response = client.post("/auth/google", json={"credential": google_token(**overrides)})
    assert response.status_code == status, response.text


def test_admin_sign_in_only_for_organisers(client, google):
    student = client.post("/auth/google", json={"credential": google_token(), "app": "admin"})
    assert student.status_code == 403
    root = client.post("/auth/google", json={"credential": google_token(email="root@kiet.edu"), "app": "admin"})
    assert root.status_code == 200
    assert client.get("/admin/me", headers=bearer(root.json()["token"])).json()["role"] == "super_admin"


def test_configured_super_admin_wins_over_a_stored_department_admin(client, as_user):
    root = as_user("root@kiet.edu")
    added = root.post("/admin/admins", {"email": "dean@kiet.edu", "name": "Dean", "role": "admin", "department": "IT"})
    assert added.status_code == 201, added.text
    settings = get_settings()
    settings.super_admin_emails = [*settings.super_admin_emails, "dean@kiet.edu"]
    try:
        assert as_user("dean@kiet.edu").get("/admin/me").json()["role"] == "super_admin"
    finally:
        settings.super_admin_emails = ["root@kiet.edu"]


# ---------- Settings ----------


def production(**overrides: object) -> Settings:
    values = {
        "environment": "production",
        "session_secret": "x" * 40,
        "google_client_ids": [CLIENT_ID],
        "cors_origins": ["https://innotech.kiet.edu"],
        "email_backend": "log",
        "dev_sign_in": False,
        "force_registration_open": False,
        **overrides,
    }
    return Settings(**values)


def test_production_accepts_safe_settings():
    assert production().environment == "production"


@pytest.mark.parametrize(
    "overrides",
    [
        {"dev_sign_in": True},
        {"force_registration_open": True},
        {"session_secret": "short"},
        {"google_client_ids": []},
        {"cors_origins": ["*"]},
        {"email_backend": "ses", "ses_region": ""},
    ],
)
def test_production_refuses_unsafe_settings(overrides):
    with pytest.raises(ValueError):
        production(**overrides)


def test_production_requires_an_explicit_email_backend(monkeypatch):
    monkeypatch.delenv("EMAIL_BACKEND", raising=False)
    values = {"environment": "production", "session_secret": "x" * 40, "google_client_ids": [CLIENT_ID], "force_registration_open": False}
    with pytest.raises(ValueError):
        Settings(**values, _env_file=None)


def test_dev_token_endpoint_only_in_development(client, settings):
    # The test app runs with ENVIRONMENT=test, so the endpoint does not exist.
    assert client.post("/dev/token", json={"email": "a@kiet.edu", "name": "A"}).status_code == 404

    settings.environment = "development"
    settings.dev_sign_in = True
    from app.main import create_app

    with TestClient(create_app()) as dev_client:
        response = dev_client.post("/dev/token", json={"email": "A@kiet.edu", "name": "Aarav"})
        assert response.status_code == 200
        me = dev_client.get("/me", headers=bearer(response.json()["token"]))
        assert me.json()["email"] == "a@kiet.edu"
