"""Judging: judges, rooms and panels, allotments, tents, the lock, scores, rankings and attendance sheets."""

from datetime import UTC, datetime, timedelta

import pytest
from test_admin import publish, world  # noqa: F401  (fixture)

from app import rules
from conftest import Api, token

FULL = [5, 5, 5, 5, 5, 5, 5, 5, 10]


def marks(total_parts: list[int]) -> dict:
    return {"marks": total_parts, "remarks": ""}


@pytest.fixture
def judging(world, settings):  # noqa: F811
    """Registration closed, three judges (IT faculty, CSE faculty, external) and a CSE room."""
    settings.force_registration_open = False
    settings.registration_opens = datetime.now(UTC) - timedelta(days=10)
    settings.registration_closes = datetime.now(UTC) - timedelta(days=1)
    root = world["root"]
    for body in (
        {"email": "it.prof@kiet.edu", "name": "IT Professor", "kind": "faculty", "department": "IT"},
        {"email": "cse.prof@kiet.edu", "name": "CSE Professor", "kind": "faculty", "department": "CSE"},
        {"email": "judge@industry.com", "name": "Industry Judge", "kind": "external", "organisation": "Acme Labs"},
    ):
        response = root.post("/admin/jurors", body)
        assert response.status_code == 201, response.text
    room = root.post("/admin/panels", {"round": "department", "name": "Room 304", "location": "CSIT block", "department": "CSE"})
    assert room.status_code == 201, room.text
    client = root.client
    return world | {
        "room": room.json(),
        "it_prof": Api(client, "it.prof@kiet.edu"),
        "cse_prof": Api(client, "cse.prof@kiet.edu"),
        "external": Api(client, "judge@industry.com"),
    }


def set_room(j, teams=("cse_a", "cse_b", "cse_c"), jurors=(("it.prof@kiet.edu", True), ("judge@industry.com", False))):
    root, room = j["root"], j["room"]
    response = root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": [j["teams"][k]["id"] for k in teams]})
    assert response.status_code == 200, response.text
    response = root.put(f"/admin/panels/{room['id']}/jurors", {"jurors": [{"email": e, "chair": c} for e, c in jurors]})
    assert response.status_code == 200, response.text
    return response.json()


def score(judge, room, team, parts):
    return judge.put(f"/judge/panels/{room['id']}/teams/{team['id']}/score", marks(parts))


# ---------- Judges ----------


def test_judges_sign_in_and_see_only_their_page(judging, client):
    me = judging["it_prof"].get("/admin/me").json()
    assert (me["role"], me["judge"], me["department"]) == ("judge", True, "IT")
    # A judge is not an organiser: every admin endpoint refuses them.
    assert judging["it_prof"].get("/admin/teams").status_code == 403
    assert judging["it_prof"].get("/admin/stats").status_code == 403
    assert judging["it_prof"].get("/judge").json()["panels"] == []
    # Students and strangers are not judges.
    assert Api(client, "a@kiet.edu").get("/judge").status_code == 403
    # A portal token never opens the judge page.
    assert client.get("/judge", headers={"Authorization": f"Bearer {token('it.prof@kiet.edu')}"}).status_code == 401


def test_an_admin_who_is_also_a_judge(judging):
    judging["root"].post("/admin/jurors", {"email": "it.admin@kiet.edu", "name": "IT Admin", "kind": "faculty", "department": "IT"})
    me = judging["it"].get("/admin/me").json()
    assert (me["role"], me["judge"]) == ("admin", True)


def test_judge_management_is_for_super_admins(judging):
    cse = judging["cse"]
    assert cse.get("/admin/jurors").status_code == 403
    assert (
        cse.post("/admin/jurors", {"email": "x@kiet.edu", "name": "Xavier", "kind": "external", "organisation": "Y Labs"}).status_code
        == 403
    )
    assert cse.post("/admin/panels", {"round": "department", "name": "Room 1", "department": "CSE"}).status_code == 403
    root = judging["root"]
    assert (
        root.post("/admin/jurors", {"email": "it.prof@kiet.edu", "name": "Again", "kind": "faculty", "department": "IT"}).status_code == 409
    )
    assert root.post("/admin/jurors", {"email": "f@kiet.edu", "name": "No Dept", "kind": "faculty"}).status_code == 422
    assert root.post("/admin/jurors", {"email": "e@x.com", "name": "No Org", "kind": "external"}).status_code == 422
    listed = {j["email"]: j for j in root.get("/admin/jurors").json()}
    assert listed["cse.prof@kiet.edu"]["organisation"] == rules.KIET_INSTITUTION


# ---------- Rooms ----------


def test_rooms_follow_the_rules(judging):
    root, room = judging["root"], judging["room"]
    # Same name twice in a round is refused; the finale may reuse it.
    assert root.post("/admin/panels", {"round": "department", "name": "room 304", "department": "IT"}).status_code == 409
    assert root.post("/admin/panels", {"round": "final", "name": "Room 304"}).status_code == 201
    assert root.post("/admin/panels", {"round": "department", "name": "No Dept"}).status_code == 422
    # Only submitted teams of the room's department.
    it_team = judging["teams"]["it_a"]["id"]
    assert root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": [it_team]}).status_code == 422
    assert root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": [judging["teams"]["college"]["id"]]}).status_code == 422
    # Faculty never judge their own department.
    refused = root.put(f"/admin/panels/{room['id']}/jurors", {"jurors": [{"email": "cse.prof@kiet.edu"}]})
    assert refused.status_code == 422 and "another department" in refused.json()["detail"]
    assert root.put(f"/admin/panels/{room['id']}/jurors", {"jurors": [{"email": "nobody@kiet.edu"}]}).status_code == 422
    two_chairs = [{"email": "it.prof@kiet.edu", "chair": True}, {"email": "judge@industry.com", "chair": True}]
    assert root.put(f"/admin/panels/{room['id']}/jurors", {"jurors": two_chairs}).status_code == 422
    panel = set_room(judging)
    assert panel["jurors"][0]["email"] == "it.prof@kiet.edu" and panel["jurors"][0]["chair"]
    assert len(panel["teams"]) == 3


def test_a_team_sits_in_one_room_per_round(judging):
    root = judging["root"]
    set_room(judging)
    other = root.post("/admin/panels", {"round": "department", "name": "Room 305", "department": "CSE"}).json()
    clash = root.put(f"/admin/panels/{other['id']}/teams", {"team_ids": [judging["teams"]["cse_a"]["id"]]})
    assert clash.status_code == 409 and "Room 304" in clash.json()["detail"]
    overview = root.get("/admin/judging/department").json()
    # Every CSE team has a room; the super admin also sees other departments' teams still waiting.
    assert {t["name"] for t in overview["unallotted"]} == {"IT Alpha"} and len(overview["panels"]) == 2


def test_department_admins_see_their_rooms_read_only(judging):
    set_room(judging)
    judging["root"].post("/admin/panels", {"round": "department", "name": "IT Room", "department": "IT"})
    cse = judging["cse"].get("/admin/judging/department").json()
    assert [p["name"] for p in cse["panels"]] == ["Room 304"] and cse["can_manage"] is False
    it = judging["it"].get("/admin/judging/department").json()
    assert [p["name"] for p in it["panels"]] == ["IT Room"]
    assert {t["name"] for t in it["unallotted"]} == {"IT Alpha"}
    assert judging["cse"].get("/admin/judging/final").status_code == 403
    assert judging["cse"].get("/admin/judging/department/attendance", params={"panel_id": judging["room"]["id"]}).status_code == 200
    assert judging["it"].get("/admin/judging/department/attendance", params={"panel_id": judging["room"]["id"]}).status_code == 403


# ---------- The lock ----------


def test_judging_is_locked_until_a_super_admin_opens_it(judging, settings):
    root, room = judging["root"], judging["room"]
    set_room(judging)
    team = judging["teams"]["cse_a"]
    locked = score(judging["it_prof"], room, team, FULL)
    assert locked.status_code == 423 and "locked" in locked.json()["detail"]
    # Judges already see their room and teams while it is locked.
    view = judging["it_prof"].get("/judge").json()
    assert view["panels"][0]["open"] is False and len(view["panels"][0]["teams"]) == 3
    assert judging["cse"].post("/admin/judging/department/open").status_code == 403

    # Not while registration is open.
    settings.registration_closes = datetime.now(UTC) + timedelta(days=1)
    blocked = root.post("/admin/judging/department/open")
    assert blocked.status_code == 409 and "registration has closed" in blocked.json()["detail"]
    settings.registration_closes = datetime.now(UTC) - timedelta(days=1)

    opened = root.post("/admin/judging/department/open")
    assert opened.status_code == 200 and opened.json()["open"] is True
    assert root.post("/admin/judging/department/open").status_code == 409
    assert score(judging["it_prof"], room, team, FULL).status_code == 200
    assert root.post("/admin/judging/department/lock").json()["open"] is False
    assert score(judging["it_prof"], room, team, FULL).status_code == 423


def test_a_room_with_teams_needs_judges_before_opening(judging):
    root, room = judging["root"], judging["room"]
    root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": [judging["teams"]["cse_a"]["id"]]})
    refused = root.post("/admin/judging/department/open")
    assert refused.status_code == 409 and "no judges" in refused.json()["detail"]


def test_the_finale_opens_after_results_are_published(judging, settings):
    root = judging["root"]
    blocked = root.post("/admin/judging/final/open")
    assert blocked.status_code == 409 and "published" in blocked.json()["detail"]


# ---------- Scores ----------


def test_scores_are_validated_and_scoped(judging):
    root, room = judging["root"], judging["room"]
    set_room(judging)
    root.post("/admin/judging/department/open")
    team = judging["teams"]["cse_a"]
    judge = judging["it_prof"]
    for bad in ([6, 5, 5, 5, 5, 5, 5, 5, 10], [5] * 8, [5, 5, 5, 5, 5, 5, 5, 5, 11], [-1, 5, 5, 5, 5, 5, 5, 5, 10]):
        assert score(judge, room, team, bad).status_code == 422, bad
    saved = score(judge, room, team, [4, 3, 5, 2, 1, 0, 5, 5, 7])
    assert saved.status_code == 200 and saved.json()["total"] == 32
    # Saving again replaces the marks.
    assert score(judge, room, team, [5, 5, 5, 5, 5, 5, 5, 5, 9]).json()["total"] == 49
    mine = judge.get("/judge").json()["panels"][0]["teams"]
    assert next(t for t in mine if t["id"] == team["id"])["my_score"]["total"] == 49
    # Not on this panel, a team from another room, a withdrawn team.
    assert score(judging["cse_prof"], room, team, FULL).status_code == 403
    assert score(judge, room, judging["teams"]["it_a"], FULL).status_code == 403
    root.post(f"/admin/teams/{judging['teams']['cse_c']['id']}/withdraw", {"reason": "Left the event"})
    assert score(judge, room, judging["teams"]["cse_c"], FULL).status_code == 409
    # The scores show up for organisers, never for other judges.
    panel = root.get("/admin/judging/department").json()["panels"][0]
    assert next(t for t in panel["teams"] if t["id"] == team["id"])["average"] == 49
    other = judging["external"].get("/judge").json()["panels"][0]["teams"]
    assert next(t for t in other if t["id"] == team["id"])["my_score"] is None


def test_scored_teams_and_judges_cannot_be_removed(judging):
    root, room = judging["root"], judging["room"]
    set_room(judging)
    root.post("/admin/judging/department/open")
    score(judging["it_prof"], room, judging["teams"]["cse_a"], FULL)
    assert root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": [judging["teams"]["cse_b"]["id"]]}).status_code == 409
    assert root.put(f"/admin/panels/{room['id']}/jurors", {"jurors": [{"email": "judge@industry.com"}]}).status_code == 409
    assert root.delete(f"/admin/panels/{room['id']}").status_code == 409
    assert root.delete("/admin/jurors/it.prof@kiet.edu").status_code == 409
    # An unscored team and an unassigned judge can go.
    keep = [judging["teams"][k]["id"] for k in ("cse_a", "cse_b")]
    assert root.put(f"/admin/panels/{room['id']}/teams", {"team_ids": keep}).status_code == 200
    assert root.delete("/admin/jurors/cse.prof@kiet.edu").status_code == 204


# ---------- Rankings ----------


def test_rankings_use_the_tie_breakers(judging):
    root, room = judging["root"], judging["room"]
    set_room(judging)
    root.post("/admin/judging/department/open")
    a, b, c = (judging["teams"][k] for k in ("cse_a", "cse_b", "cse_c"))
    # Category 1 uses the software rubric: criterion 2 (Innovation & Novelty) breaks ties first.
    # a and b both total 40; b scores higher on innovation, so b ranks first.
    score(judging["it_prof"], room, a, [5, 5, 3, 3, 5, 5, 4, 4, 6])
    score(judging["it_prof"], room, b, [3, 3, 5, 5, 5, 5, 4, 4, 6])
    # c: same total and innovation as a, lower Query Addressing.
    score(judging["it_prof"], room, c, [5, 5, 3, 3, 5, 5, 5, 5, 4])
    ranking = root.get("/admin/judging/department/rankings").json()
    group = ranking["groups"][0]
    assert group["department"] == "CSE" and group["category"] == 1
    order = [(t["team"]["name"], t["position"], t["tied"]) for t in group["teams"]]
    assert order == [("CSE Beta", 1, False), ("CSE Alpha", 2, False), ("CSE Gamma", 3, False)]
    assert group["teams"][0]["scores"] == 1 and group["teams"][0]["judges"] == 2

    # A full tie on all three: the chair decides, flagged, still no shared position.
    score(judging["it_prof"], room, c, [5, 5, 3, 3, 5, 5, 4, 4, 6])
    group = root.get("/admin/judging/department/rankings").json()["groups"][0]
    tied = [t for t in group["teams"] if t["team"]["name"] in ("CSE Alpha", "CSE Gamma")]
    assert [t["position"] for t in tied] == [2, 3] and tied[1]["tied"] is True

    # Department admins see their own rankings only; outside admins none.
    assert judging["cse"].get("/admin/judging/department/rankings").json()["groups"][0]["department"] == "CSE"
    assert judging["it"].get("/admin/judging/department/rankings").json()["groups"] == []


# ---------- Tents and the finale ----------


def test_tents_for_the_finale(judging, settings):
    root = judging["root"]
    college, school, cse_a = (judging["teams"][k] for k in ("college", "school", "cse_a"))
    # Before results, only the direct teams go to the finale.
    overview = root.get("/admin/judging/final").json()
    assert {r["team"]["name"] for r in overview["tents"]} == {"ABES Team", "DPS Team"}
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": cse_a["id"], "tent": "T-1"}]}).status_code == 422
    duplicate = [{"team_id": college["id"], "tent": "t-1"}, {"team_id": school["id"], "tent": "T-1"}]
    assert root.put("/admin/judging/final/tents", {"tents": duplicate}).status_code == 422
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": college["id"], "tent": "T 1!"}]}).status_code == 422
    saved = root.put(
        "/admin/judging/final/tents", {"tents": [{"team_id": college["id"], "tent": " t-1 "}, {"team_id": school["id"], "tent": "T-2"}]}
    )
    assert saved.status_code == 200
    assert {r["team"]["name"]: r["tent"] for r in saved.json()["tents"]} == {"ABES Team": "T-1", "DPS Team": "T-2"}
    # Swapping two tents in one save works; taking another team's tent does not.
    swap = [{"team_id": college["id"], "tent": "T-2"}, {"team_id": school["id"], "tent": "T-1"}]
    assert root.put("/admin/judging/final/tents", {"tents": swap}).status_code == 200
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": college["id"], "tent": "T-1"}]}).status_code == 409

    # After publishing, the finalist joins; the attendance sheet follows tent order.
    root.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [cse_a["id"]]}]})
    assert publish(root, settings).status_code == 200
    assert root.put("/admin/judging/final/tents", {"tents": [{"team_id": cse_a["id"], "tent": "T-10"}]}).status_code == 200
    sheet = root.get("/admin/judging/final/attendance").json()
    assert [t["tent"] for t in sheet["teams"]] == ["T-1", "T-2", "T-10"]
    assert all(len(t["members"]) == 2 and t["members"][0]["role"] == "leader" for t in sheet["teams"])


def test_finale_rankings_group_schools_separately(judging, settings):
    root = judging["root"]
    panel = root.post("/admin/panels", {"round": "final", "name": "Panel A"}).json()
    college, school = judging["teams"]["college"], judging["teams"]["school"]
    root.put(f"/admin/panels/{panel['id']}/teams", {"team_ids": [college["id"], school["id"]]})
    root.put(f"/admin/panels/{panel['id']}/jurors", {"jurors": [{"email": "judge@industry.com", "chair": True}]})
    root.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [judging["teams"]["cse_a"]["id"]]}]})
    assert publish(root, settings).status_code == 200
    assert root.post("/admin/judging/final/open").status_code == 200
    assert score(judging["external"], panel, college, FULL).status_code == 200
    groups = {g["label"]: g for g in root.get("/admin/judging/final/rankings").json()["groups"]}
    assert set(groups) == {"Category 8: CyberShield", "Best School Project"}
    assert groups["Category 8: CyberShield"]["teams"][0]["average"] == 50
    assert groups["Best School Project"]["teams"][0]["position"] is None
    # With the finale under way, results can no longer be withdrawn.
    assert root.post("/admin/results/unpublish", {"confirm": "UNPUBLISH", "reason": "Published by mistake"}).status_code == 409


def test_attendance_sheet_for_a_room(judging):
    set_room(judging)
    sheet = judging["root"].get("/admin/judging/department/attendance", params={"panel_id": judging["room"]["id"]}).json()
    assert sheet["title"] == "Room 304 · CSE teams" and sheet["location"] == "CSIT block"
    assert sheet["jurors"] == ["IT Professor (chair)", "Industry Judge"]
    assert [t["code"] for t in sheet["teams"]] == [judging["teams"][k]["code"] for k in ("cse_a", "cse_b", "cse_c")]
    assert {m["roll_number"] for t in sheet["teams"] for m in t["members"]} != {""}
    assert judging["root"].get("/admin/judging/department/attendance").status_code == 422


def test_judging_actions_are_audited(judging):
    set_room(judging)
    judging["root"].post("/admin/judging/department/open")
    actions = {e["action"] for e in judging["root"].get("/admin/activity", params={"kind": "judging", "page_size": 100}).json()["items"]}
    assert {
        "judging.judge_added",
        "judging.panel_created",
        "judging.teams_allotted",
        "judging.judges_assigned",
        "judging.opened",
    } <= actions
