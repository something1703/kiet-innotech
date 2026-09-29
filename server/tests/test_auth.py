"""Token verification: the development HS256 path and the production Cognito RS256 path."""

import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import auth
from app.config import Settings
from app.errors import ApiError
from conftest import token


def test_missing_and_malformed_tokens(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Basic abc"}).status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer not-a-jwt"}).status_code == 401


def test_expired_and_forged_tokens(client):
    expired = token("a@kiet.edu", exp=int(time.time()) - 60)
    assert client.get("/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    forged = jwt.encode(
        {"email": "a@kiet.edu", "sub": "x", "exp": int(time.time()) + 60}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256"
    )
    assert client.get("/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_unverified_email_rejected(client):
    unverified = token("a@kiet.edu", email_verified=False)
    response = client.get("/me", headers={"Authorization": f"Bearer {unverified}"})
    assert response.status_code == 403


def test_email_is_case_insensitive_identity(client):
    first = client.get("/me", headers={"Authorization": f"Bearer {token('A.Student@KIET.edu', sub='same')}"})
    assert first.json()["email"] == "a.student@kiet.edu"


def test_account_relinked_when_cognito_user_recreated(as_user, client):
    as_user("a@kiet.edu").get("/me")  # creates the account
    recreated = token("a@kiet.edu", sub="new-sub")
    assert client.get("/me", headers={"Authorization": f"Bearer {recreated}"}).json()["email"] == "a@kiet.edu"


# ---------- Cognito (RS256) ----------

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
COGNITO = Settings(
    environment="production",
    cognito_region="ap-south-1",
    cognito_user_pool_id="ap-south-1_TEST",
    cognito_client_ids=["student-client", "admin-client"],
    cors_origins=["https://innotech.kiet.edu"],
    # Explicit, so the test environment's variables don't leak into this production configuration.
    dev_jwt_secret="",
    force_registration_open=False,
)


class FakeJwks:
    def get_signing_key_from_jwt(self, _token: str):
        return type("Key", (), {"key": KEY.public_key()})()


@pytest.fixture
def cognito(monkeypatch):
    monkeypatch.setattr(auth, "_jwks_client", lambda url: FakeJwks())


def cognito_token(**overrides: object) -> str:
    claims = {
        "iss": COGNITO.cognito_issuer,
        "aud": "student-client",
        "token_use": "id",
        "sub": "abc",
        "email": "a@kiet.edu",
        "email_verified": "true",
        "name": "Aarav Sharma",
        "identities": [{"providerName": "Google", "providerType": "Google"}],
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, KEY, algorithm="RS256")


def test_cognito_token_accepted(cognito):
    identity = auth.verify_token(cognito_token(), COGNITO)
    assert identity.email == "a@kiet.edu"
    assert auth.verify_token(cognito_token(aud="admin-client"), COGNITO).email == "a@kiet.edu"
    # Cognito sometimes sends identities as a JSON string.
    assert auth.verify_token(cognito_token(identities=json.dumps([{"providerName": "Google"}])), COGNITO)


@pytest.mark.parametrize(
    ("overrides", "status"),
    [
        ({"aud": "someone-else"}, 401),
        ({"iss": "https://cognito-idp.ap-south-1.amazonaws.com/other-pool"}, 401),
        ({"token_use": "access"}, 401),
        ({"exp": int(time.time()) - 3600}, 401),
        ({"email": None}, 401),
        ({"identities": None}, 403),  # username/password user in the pool
        ({"identities": [{"providerName": "Facebook"}]}, 403),
        ({"email_verified": "false"}, 403),
    ],
)
def test_cognito_token_rejected(cognito, overrides, status):
    with pytest.raises(ApiError) as error:
        auth.verify_token(cognito_token(**overrides), COGNITO)
    assert error.value.status == status


def test_hs256_token_not_accepted_in_production(cognito):
    # The development secret path must never apply in production, even if someone sends an HS256 token.
    with pytest.raises(ApiError):
        auth.verify_token(token("a@kiet.edu"), COGNITO)


def test_production_refuses_unsafe_settings():
    with pytest.raises(ValueError):
        Settings(environment="production", dev_jwt_secret="x", cognito_region="r", cognito_user_pool_id="p", cognito_client_ids=["c"])
    with pytest.raises(ValueError):
        Settings(
            environment="production",
            dev_jwt_secret="",
            force_registration_open=True,
            cognito_region="r",
            cognito_user_pool_id="p",
            cognito_client_ids=["c"],
        )
    with pytest.raises(ValueError):
        Settings(environment="production", dev_jwt_secret="", force_registration_open=False, cognito_client_ids=[])


def test_dev_token_endpoint_only_in_development(client, settings):
    # The test app runs with ENVIRONMENT=test, so the endpoint does not exist.
    assert client.post("/dev/token", json={"email": "a@kiet.edu", "name": "A"}).status_code == 404

    settings.environment = "development"
    from app.main import create_app

    with TestClient(create_app()) as dev_client:
        response = dev_client.post("/dev/token", json={"email": "A@kiet.edu", "name": "Aarav"})
        assert response.status_code == 200
        me = dev_client.get("/me", headers={"Authorization": f"Bearer {response.json()['id_token']}"})
        assert me.json()["email"] == "a@kiet.edu"
