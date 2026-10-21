"""The sandbox: off unless switched on, its access-code sign-in, and a reset that never touches real data."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services import sandbox as sandbox_service
from conftest import Api, token

CODE = "correct-horse-battery-staple"
PRESENTER = "tejasvi.demo@kiet.edu"
SECOND = "second.person@gmail.com"


@pytest.fixture
def sandbox(settings):
    sandbox_service._FAILURES.clear()
    settings.sandbox_mode = True
    settings.sandbox_access_code = CODE
    settings.super_admin_emails = [PRESENTER, SECOND]
    # Registration has closed, so the department round can open.
    settings.force_registration_open = False
    settings.registration_opens = datetime.now(UTC) - timedelta(days=10)
    settings.registration_closes = datetime.now(UTC) - timedelta(days=1)
    yield settings
    sandbox_service._FAILURES.clear()


def sign_in(client, email=PRESENTER, code=CODE):
    return client.post("/sandbox/token", json={"email": email, "code": code})


def test_the_sandbox_does_not_exist_unless_it_is_switched_on(client, as_user, settings):
    assert sign_in(client).status_code == 404
    assert as_user("root@kiet.edu").post("/sandbox/reset").status_code == 404


def test_the_settings_refuse_an_unsafe_sandbox():
    for extra in ({"sandbox_access_code": "short"}, {"super_admin_emails": ""}, {"email_backend": "ses", "ses_region": "ap-south-1"}):
        values = {"environment": "test", "sandbox_mode": True, "sandbox_access_code": CODE, "super_admin_emails": PRESENTER} | extra
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **values)


def test_signing_in_needs_the_code_and_an_organiser_or_judge(client, sandbox):
    assert sign_in(client, code="wrong").status_code == 403
    assert sign_in(client, email="stranger@kiet.edu").status_code == 403
    response = sign_in(client)
    assert response.status_code == 200, response.text
    me = client.get("/admin/me", headers={"Authorization": f"Bearer {response.json()['token']}"})
    assert me.status_code == 200 and me.json()["role"] == "super_admin"


def test_too_many_wrong_codes_pause_the_sign_in(client, sandbox):
    for _ in range(sandbox_service._FAILURE_LIMIT):
        assert sign_in(client, code="wrong").status_code == 403
    assert sign_in(client, code="wrong").status_code == 429
    assert sign_in(client).status_code == 429


def test_reset_fills_the_sandbox_and_a_second_reset_starts_over(client, sandbox):
    presenter = Api(client, PRESENTER)
    assert Api(client, "root@kiet.edu").post("/sandbox/reset").status_code == 403  # not a super admin here
    made = presenter.post("/sandbox/reset")
    assert made.status_code == 200, made.text
    assert (made.json()["teams"], made.json()["judges"]) == (10, 2)
    assert made.json()["note"] == "Scoring is open."

    teams = presenter.get("/admin/teams", params={"page_size": 100}).json()
    assert teams["total"] == 10
    assert {(t["status"], t["department"]) for t in teams["items"]} == {("submitted", "IT")}
    me = presenter.get("/admin/me").json()
    assert (me["role"], me["judge"]) == ("super_admin", True)

    # The presenter is the room's own judge: they see the ten teams and can save marks.
    view = presenter.get("/judge").json()
    room = view["panels"][0]
    assert len(room["teams"]) == 10
    first = room["teams"][0]
    assert first["my_score"] is None
    scored = presenter.put(f"/judge/panels/{room['id']}/teams/{first['id']}/score", {"marks": [3, 3, 3, 3, 3, 3, 3, 3, 5], "remarks": ""})
    assert scored.status_code == 200, scored.text

    # Starting over: marks are gone, the teams are back, and the numbers begin again.
    assert presenter.post("/sandbox/reset").status_code == 200
    again = presenter.get("/admin/teams", params={"page_size": 100, "sort": "code"}).json()
    assert again["total"] == 10 and again["items"][0]["code"] == "IT26-0001"
    room = presenter.get("/judge").json()["panels"][0]
    assert all(t["my_score"] is None for t in room["teams"])


def test_reset_refuses_a_database_with_real_data(client, sandbox, student):
    # A student registers while registration is open; then the sandbox is switched on against the same database.
    sandbox.force_registration_open = True
    student("real.student@kiet.edu")
    sandbox.force_registration_open = False
    presenter = Api(client, PRESENTER)
    refused = presenter.post("/sandbox/reset")
    assert refused.status_code == 409 and "real event data" in refused.json()["detail"]
    # Nothing was wiped.
    assert client.get("/me", headers={"Authorization": f"Bearer {token('real.student@kiet.edu')}"}).status_code == 200
