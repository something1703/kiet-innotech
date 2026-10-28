"""The Grand Finale: locking the finalist list, outside judges who sign in with a password, and the event desk."""

import re

from test_admin import world  # noqa: F401  (fixture)
from test_certificates import AFTER, release_department
from test_judging import FULL, accept_direct, judging, score, set_room  # noqa: F401  (fixture)

from app.services import judging as judging_service
from conftest import Api


def lock(root, confirm="LOCK"):
    return root.post("/admin/finalists/lock", {"confirm": confirm})


def released(j, monkeypatch):
    """CSE Alpha and CSE Beta win CSE's two places in Category 1; CSE Gamma is scored lower."""
    set_room(j)
    assert j["root"].post("/admin/judging/department/open").status_code == 200
    for key, parts in (("cse_a", FULL), ("cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8]), ("cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])):
        for judge in ("it_prof", "cse_prof"):
            assert score(j[judge], j["room"], j["teams"][key], parts).status_code == 200
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release_department(j["root"]).status_code == 200


# ---------- Locking the finalist list ----------


def test_the_department_winners_become_the_locked_finalists(judging, as_user, monkeypatch):  # noqa: F811
    root, cse, teams = judging["root"], judging["cse"], judging["teams"]
    # Not before the department results are released.
    summary = root.get("/admin/finalists/summary").json()
    assert "Release the department results" in summary["lock_blocked"] and summary["locked_at"] is None
    assert lock(root).status_code == 409

    released(judging, monkeypatch)
    summary = root.get("/admin/finalists/summary").json()
    assert (summary["lock_blocked"], summary["lock_winners"], summary["lock_left_out"]) == (None, 2, 0)
    # Only a super admin, and only with the phrase.
    assert lock(cse).status_code == 403
    assert lock(root, "yes").status_code == 422

    done = lock(root)
    assert done.status_code == 200, done.text
    assert (done.json()["finalists"], done.json()["not_selected"], done.json()["left_out"]) == (2, 2, 0)  # CSE Gamma and IT Alpha
    assert lock(root).status_code == 409  # once

    # Published and locked: the department's board shows its winners as nominations and cannot change.
    board = cse.get("/admin/finalists").json()
    assert board["nominations_locked"] is True and board["locked_at"] and board["published_at"]
    assert set(board["categories"][0]["nominated"]) == {teams["cse_a"]["id"], teams["cse_b"]["id"]}
    assert cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": []}]}).status_code == 409
    summary = root.get("/admin/finalists/summary").json()
    assert summary["locked_by"] == "root@kiet.edu" and "locked" in summary["unpublish_blocked"]

    # Nothing can undo it: results stay published, the release stays, the department round stays locked.
    assert root.post("/admin/results/unpublish", {"confirm": "UNPUBLISH", "reason": "Trying to undo it"}).status_code == 409
    assert root.post("/admin/judging/department/release/withdraw", {"reason": "Trying to undo it"}).status_code == 409
    assert root.get("/admin/judging/department/release").json()["finalists_locked"] is True
    assert root.get("/admin/judging/department").json()["round"]["open"] is False
    reopen = root.post("/admin/judging/department/open")
    assert reopen.status_code == 409 and "locked" in reopen.json()["detail"]

    # The finalists are in the Grand Finale; the others are not.
    finale = {row["team"]["code"] for row in root.get("/admin/judging/final").json()["tents"]}
    assert finale == {teams["cse_a"]["code"], teams["cse_b"]["code"]}
    a, e = as_user("a@kiet.edu"), as_user("e@kiet.edu")
    finalist = next(c for c in a.get("/me/results").json()["cards"] if c["status"] == "finalist")
    assert "Watch this page for your stall number" in finalist["message"]
    assert "finalist" not in [c["status"] for c in e.get("/me/results").json()["cards"]]

    # With a stall, the finalist card and the pass name it.
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": teams["cse_a"]["id"], "tent": "3"}]}).status_code == 200
    finalist = next(c for c in a.get("/me/results").json()["cards"] if c["status"] == "finalist")
    assert "Your stall is 3." in finalist["message"]
    assert [r["tent"] for r in a.get("/me/pass").json()["rounds"] if r["round"] == "final"] == ["3"]


def test_a_winner_disqualified_after_the_release_is_left_out(judging, monkeypatch):  # noqa: F811
    root, teams = judging["root"], judging["teams"]
    released(judging, monkeypatch)
    assert root.post(f"/admin/teams/{teams['cse_b']['id']}/disqualify", {"reason": "Plagiarised project"}).status_code == 200
    assert root.get("/admin/finalists/summary").json()["lock_left_out"] == 1
    done = lock(root).json()
    assert (done["finalists"], done["left_out"]) == (1, 1)
    finale = {row["team"]["code"] for row in root.get("/admin/judging/final").json()["tents"]}
    assert finale == {teams["cse_a"]["code"]}


# ---------- Outside judges with a password ----------


def judge_login(client, email, password):
    return client.post("/auth/judge", json={"email": email, "password": password})


def bearer(response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_outside_judges_sign_in_with_a_password(world, client):  # noqa: F811
    root, cse = world["root"], world["cse"]
    body = {
        "judges": [
            {"name": "Mr. Arunesh Mishra", "email": "Cool.Arunesh@gmail.com"},
            {"name": "Dr Vineet Kumar", "email": "vineet.kumar@adnolgy.com", "organisation": "Adnolgy"},
        ]
    }
    assert cse.post("/admin/jurors/import", body).status_code == 403
    imported = root.post("/admin/jurors/import", body)
    assert imported.status_code == 200, imported.text
    rows = {r["email"]: r for r in imported.json()["judges"]}
    arunesh = rows["cool.arunesh@gmail.com"]
    assert arunesh["status"] == "created" and re.fullmatch(r"Arunesh@\d{5}", arunesh["password"])
    assert re.fullmatch(r"Vineet@\d{5}", rows["vineet.kumar@adnolgy.com"]["password"])
    # Importing again leaves them (and their passwords) as they are.
    again = root.post("/admin/jurors/import", body).json()["judges"]
    assert [r["status"] for r in again] == ["exists", "exists"] and all(r["password"] is None for r in again)
    jurors = {j["email"]: j for j in root.get("/admin/jurors").json()}
    assert jurors["cool.arunesh@gmail.com"]["has_password"] is True and jurors["cool.arunesh@gmail.com"]["kind"] == "external"
    assert "password" not in str(jurors["cool.arunesh@gmail.com"].get("password") or "")

    # Wrong password or unknown email: the same answer.
    assert judge_login(client, "cool.arunesh@gmail.com", "Arunesh@00000x").status_code == 401
    assert judge_login(client, "nobody@gmail.com", "whatever").json()["detail"] == "Wrong email or password."
    ok = judge_login(client, " COOL.ARUNESH@gmail.com ", arunesh["password"])
    assert ok.status_code == 200 and ok.json()["email"] == "cool.arunesh@gmail.com"
    me = client.get("/admin/me", headers=bearer(ok)).json()
    assert (me["role"], me["judge"]) == ("judge", True)
    assert client.get("/judge", headers=bearer(ok)).status_code == 200
    assert client.get("/admin/teams", headers=bearer(ok)).status_code == 403
    assert client.get("/desk", headers=bearer(ok)).status_code == 403

    # A new password replaces the old one; turning it off stops password sign-in.
    fresh = root.post("/admin/jurors/cool.arunesh@gmail.com/password").json()["password"]
    assert judge_login(client, "cool.arunesh@gmail.com", arunesh["password"]).status_code == 401
    assert judge_login(client, "cool.arunesh@gmail.com", fresh).status_code == 200
    assert cse.post("/admin/jurors/cool.arunesh@gmail.com/password").status_code == 403
    assert root.delete("/admin/jurors/cool.arunesh@gmail.com/password").status_code == 204
    assert judge_login(client, "cool.arunesh@gmail.com", fresh).status_code == 401


def test_a_password_session_never_opens_organiser_pages(world, client):  # noqa: F811
    root = world["root"]
    # The super admin is also appointed as an outside judge, with a password.
    added = root.post("/admin/jurors", {"email": "root@kiet.edu", "name": "Root Judge", "kind": "external", "organisation": "KIET"})
    assert added.status_code == 201 and re.fullmatch(r"Root@\d{5}", added.json()["password"])
    session = judge_login(client, "root@kiet.edu", added.json()["password"])
    assert session.status_code == 200
    # Signed in with the password: a judge only. Signed in with Google (the usual session): still a super admin.
    assert client.get("/admin/me", headers=bearer(session)).json()["role"] == "judge"
    assert client.get("/admin/stats", headers=bearer(session)).status_code == 403
    assert client.post("/admin/finalists/lock", headers=bearer(session), json={"confirm": "LOCK"}).status_code == 403
    assert root.get("/admin/me").json()["role"] == "super_admin" and root.get("/admin/stats").status_code == 200


def test_outside_judges_may_use_any_email_but_faculty_need_kiet(world):  # noqa: F811
    root = world["root"]
    faculty = root.post("/admin/jurors", {"email": "prof@gmail.com", "name": "A Professor", "kind": "faculty", "department": "IT"})
    assert faculty.status_code == 422
    kiet = root.post("/admin/jurors", {"email": "prof@kiet.edu", "name": "A Professor", "kind": "faculty", "department": "IT"})
    assert kiet.status_code == 201 and kiet.json()["password"] is None and kiet.json()["has_password"] is False


def test_wrong_passwords_are_rate_limited(world, client):  # noqa: F811
    root = world["root"]
    password = root.post(
        "/admin/jurors", {"email": "x@gmail.com", "name": "X Judge", "kind": "external", "organisation": "Xyz Labs"}
    ).json()["password"]
    for _ in range(10):
        assert judge_login(client, "x@gmail.com", "wrong").status_code == 401
    assert judge_login(client, "x@gmail.com", password).status_code == 429


# ---------- The event desk ----------


def test_the_event_desk_checks_in_and_gives_food_coupons(judging, as_user, monkeypatch):  # noqa: F811
    root, cse, teams, client = judging["root"], judging["cse"], judging["teams"], judging["root"].client
    accept_direct(judging)
    assert root.post("/admin/admins", {"email": "volunteer@kiet.edu", "name": "Desk Volunteer", "role": "desk"}).status_code == 201
    desk = Api(client, "volunteer@kiet.edu")
    me = desk.get("/admin/me").json()
    assert (me["role"], me["department"]) == ("desk", None)
    # A volunteer uses the desk only; department admins and judges do not use it.
    assert desk.get("/admin/teams").status_code == 403 and desk.get("/admin/stats").status_code == 403
    assert cse.get("/desk").status_code == 403 and judging["it_prof"].get("/desk").status_code == 403

    school = teams["school"]
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": school["id"], "tent": "154"}]}).status_code == 200
    # Found by stall, code, team name or a member's name; department teams that are not finalists are not at the finale.
    for q in ("154", school["code"], school["code"][-4:], "dps", "School Student"):
        assert [t["code"] for t in desk.get("/desk/teams", params={"q": q}).json()] == [school["code"]], q
    assert desk.get("/desk/teams", params={"q": "CSE Gamma"}).json() == []
    assert desk.post(f"/desk/teams/{teams['cse_c']['id']}/check-in", {"user_ids": [teams["cse_c"]["leader_id"]]}).status_code == 409

    team = desk.get("/desk/teams", params={"q": "154"}).json()[0]
    leader, member = (m["user_id"] for m in team["members"])
    assert team["tent"] == "154" and team["members"][0]["phone"].endswith("2233") and "98111" not in team["members"][0]["phone"]
    checked = desk.post(f"/desk/teams/{school['id']}/check-in", {"user_ids": [leader]})
    assert checked.status_code == 200 and checked.json()["members"][0]["checked_in_by"] == "volunteer@kiet.edu"
    assert desk.post(f"/desk/teams/{school['id']}/check-in", {"user_ids": [leader]}).status_code == 200  # twice is harmless

    # Meals: set up by a super admin, coupons only while open.
    coupons = lambda who, users, meal="lunch": who.post(f"/desk/teams/{school['id']}/coupons", {"meal": meal, "user_ids": users})  # noqa: E731
    assert coupons(desk, [leader]).status_code == 404
    assert desk.post("/desk/meals", {"label": "Lunch"}).status_code == 403
    overview = root.post("/desk/meals", {"label": "Lunch"}).json()
    assert [(m["key"], m["open"]) for m in overview["meals"]] == [("lunch", False)]
    assert root.post("/desk/meals", {"label": "lunch"}).status_code == 409
    assert coupons(desk, [leader]).status_code == 409  # not open yet
    assert root.put("/desk/meals/lunch", {"open": True}).json()["meals"][0]["open"] is True

    first = coupons(desk, [leader, member]).json()
    assert (first["given"], first["already"], first["not_checked_in"]) == (["School Student"], [], ["School Student"])
    desk.post(f"/desk/teams/{school['id']}/check-in", {"user_ids": [member]})
    second = coupons(desk, [leader, member]).json()
    assert (len(second["given"]), len(second["already"])) == (1, 1)
    assert all("lunch" in m["coupons"] for m in second["team"]["members"])

    overview = desk.get("/desk").json()
    assert (overview["teams_checked_in"], overview["students_checked_in"], overview["meals"][0]["given"]) == (1, 2, 2)
    assert overview["can_manage"] is False and root.get("/desk").json()["can_manage"] is True
    # The check-in is the Grand Finale attendance the judging pages see.
    sheet = root.get("/admin/judging/final/attendance").json()
    assert {m["state"] for t in sheet["teams"] if t["code"] == school["code"] for m in t["members"]} == {"present"}

    # Checking out needs a reason and keeps the coupon; only a super admin takes a coupon back.
    assert desk.post(f"/desk/teams/{school['id']}/check-out", {"user_id": member, "reason": "no"}).status_code == 422
    out = desk.post(f"/desk/teams/{school['id']}/check-out", {"user_id": member, "reason": "Ticked the wrong student"}).json()
    assert [m["checked_in_at"] is None for m in out["members"]] == [False, True] and "lunch" in out["members"][1]["coupons"]
    take_back = f"/desk/teams/{school['id']}/coupons/lunch/{member}/take-back"
    assert desk.post(take_back, {"reason": "Given by mistake"}).status_code == 403
    assert "lunch" not in root.post(take_back, {"reason": "Given by mistake"}).json()["members"][1]["coupons"]

    # Coupons for judges and guests, in bulk.
    extra = desk.post("/desk/extras", {"meal": "lunch", "quantity": 18, "recipient": "Judges corner"})
    assert extra.status_code == 201
    assert desk.get("/desk").json()["meals"][0]["extras"] == 18
    assert desk.delete(f"/desk/extras/{extra.json()['id']}").status_code == 403
    assert root.delete(f"/desk/extras/{extra.json()['id']}").status_code == 204
    # A meal with coupons cannot be deleted, only closed.
    assert root.delete("/desk/meals/lunch").status_code == 409
    assert root.put("/desk/meals/lunch", {"open": False}).status_code == 200
    assert coupons(desk, [leader]).status_code == 409

    export = desk.get("/desk/teams/export").json()
    assert {t["code"] for t in export} == {school["code"], teams["college"]["code"]}
