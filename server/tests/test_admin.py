import pytest

from conftest import college_profile, kiet_profile, school_profile, team_input


@pytest.fixture
def world(as_user, student, team_of):
    """A super admin, a CSE admin and an IT admin, with CSE, IT, college and school teams."""
    root = as_user("root@kiet.edu")  # super admin from SUPER_ADMIN_EMAILS
    for email, department in (("cse.admin@kiet.edu", "CSE"), ("it.admin@kiet.edu", "IT")):
        response = root.post("/admin/admins", {"email": email, "name": f"{department} Admin", "role": "admin", "department": department})
        assert response.status_code == 201, response.text

    cse_a = team_of(student("a@kiet.edu"), [student("b@kiet.edu", kiet_profile(department="IT"))], name="CSE Alpha", category=1)
    cse_b = team_of(student("c@kiet.edu"), [student("d@kiet.edu")], name="CSE Beta", category=1)
    cse_c = team_of(student("e@kiet.edu"), [student("f@kiet.edu")], name="CSE Gamma", category=1)
    it_a = team_of(
        student("g@kiet.edu", kiet_profile(department="IT")),
        [student("h@kiet.edu", kiet_profile(department="IT"))],
        name="IT Alpha",
        category=1,
    )
    college = team_of(student("r@gmail.com", college_profile()), [student("s@gmail.com", college_profile())], name="ABES Team", category=8)
    school = team_of(student("k@gmail.com", school_profile()), [student("l@gmail.com", school_profile())], name="DPS Team", category=5)
    leaders = {
        "cse_a": "a@kiet.edu",
        "cse_b": "c@kiet.edu",
        "cse_c": "e@kiet.edu",
        "it_a": "g@kiet.edu",
        "college": "r@gmail.com",
        "school": "k@gmail.com",
    }
    teams = {"cse_a": cse_a, "cse_b": cse_b, "cse_c": cse_c, "it_a": it_a, "college": college, "school": school}
    for key, team in teams.items():
        assert as_user(leaders[key]).post(f"/teams/{team['id']}/submit").status_code == 200
    return {"root": root, "cse": as_user("cse.admin@kiet.edu"), "it": as_user("it.admin@kiet.edu"), "teams": teams}


def test_non_admin_is_refused(as_user, student):
    student("a@kiet.edu")
    assert as_user("a@kiet.edu").get("/admin/me").status_code == 403
    assert as_user("a@kiet.edu").get("/admin/teams").status_code == 403


def test_admin_me(world):
    assert world["root"].get("/admin/me").json()["role"] == "super_admin"
    me = world["cse"].get("/admin/me").json()
    assert (me["role"], me["department"], me["added_by"]) == ("admin", "CSE", "root@kiet.edu")


def test_department_admin_sees_only_their_department(world):
    names = {t["name"] for t in world["cse"].get("/admin/teams").json()["items"]}
    assert names == {"CSE Alpha", "CSE Beta", "CSE Gamma"}
    assert world["cse"].get(f"/admin/teams/{world['teams']['it_a']['id']}").status_code == 403
    assert world["cse"].get(f"/admin/teams/{world['teams']['college']['id']}").status_code == 403
    assert world["cse"].get("/admin/teams", params={"department": "IT"}).status_code == 403
    assert world["root"].get("/admin/teams").json()["total"] == 6


def test_department_admin_sees_students_by_their_own_department(world):
    # b@kiet.edu is an IT student in a CSE team: IT's admin sees the student, CSE's does not.
    cse_emails = {s["email"] for s in world["cse"].get("/admin/students", params={"page_size": 100}).json()["items"]}
    it_emails = {s["email"] for s in world["it"].get("/admin/students", params={"page_size": 100}).json()["items"]}
    assert "b@kiet.edu" in it_emails and "b@kiet.edu" not in cse_emails
    b = next(s for s in world["it"].get("/admin/students", params={"q": "b@kiet"}).json()["items"])
    assert b["team"]["department"] == "CSE"


def test_team_filters_search_sort_and_paging(world):
    root = world["root"]
    assert root.get("/admin/teams", params={"type": "college"}).json()["total"] == 1
    assert root.get("/admin/teams", params={"route": "finale"}).json()["total"] == 2
    assert root.get("/admin/teams", params={"category": 1, "department": "CSE"}).json()["total"] == 3
    assert root.get("/admin/teams", params={"q": "IT26-0004"}).json()["items"][0]["name"] == "IT Alpha"
    assert root.get("/admin/teams", params={"q": "s@gmail.com"}).json()["items"][0]["name"] == "ABES Team"
    # LIKE wildcards in the search are treated as text.
    assert root.get("/admin/teams", params={"q": "%"}).json()["total"] == 0
    page = root.get("/admin/teams", params={"page": 2, "page_size": 4, "sort": "name", "order": "desc"}).json()
    assert (page["total"], len(page["items"]), page["page"]) == (6, 2, 2)
    assert root.get("/admin/teams", params={"page_size": 101}).status_code == 422
    assert root.get("/admin/teams", params={"sort": "password"}).status_code == 422
    members = root.get(f"/admin/teams/{world['teams']['cse_a']['id']}").json()["members"]
    assert {"phone", "roll_number", "institution"} <= set(members[0])
    assert len(root.get("/admin/teams/export", params={"department": "CSE"}).json()) == 3


def test_withdraw_disqualify_restore(world):
    cse, root = world["cse"], world["root"]
    team_id = world["teams"]["cse_a"]["id"]
    assert cse.post(f"/admin/teams/{team_id}/withdraw", {"reason": "no"}).status_code == 422  # reason too short
    assert cse.post(f"/admin/teams/{world['teams']['it_a']['id']}/withdraw", {"reason": "Member left"}).status_code == 403
    response = cse.post(f"/admin/teams/{team_id}/withdraw", {"reason": "A member withdrew."})
    assert response.json()["status"] == "withdrawn"
    assert cse.post(f"/admin/teams/{team_id}/withdraw", {"reason": "A member withdrew."}).status_code == 409

    assert cse.post(f"/admin/teams/{team_id}/restore", {"reason": "Mistake, restore"}).status_code == 403
    assert root.post(f"/admin/teams/{team_id}/restore", {"reason": "Mistake, restore"}).json()["status"] == "submitted"
    assert cse.post(f"/admin/teams/{team_id}/disqualify", {"reason": "Plagiarism found"}).status_code == 403
    assert root.post(f"/admin/teams/{team_id}/disqualify", {"reason": "Plagiarism found"}).json()["status"] == "disqualified"

    actions = [e["action"] for e in cse.get("/admin/audit", params={"team_id": team_id}).json()]
    assert actions[:3] == ["team.disqualified", "team.restored", "team.withdrawn"]


def test_finalist_quota_and_publish(world, as_user):
    cse, it, root = world["cse"], world["it"], world["root"]
    teams = world["teams"]
    board = cse.get("/admin/finalists", params={"department": "CSE"}).json()
    category_1 = board["categories"][0]
    assert category_1["quota"] == 2 and len(category_1["teams"]) == 3

    three = [teams["cse_a"]["id"], teams["cse_b"]["id"], teams["cse_c"]["id"]]
    assert cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": three}]}).status_code == 422
    assert cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [teams["it_a"]["id"]]}]}).status_code == 422
    assert cse.put("/admin/finalists/IT", {"nominations": []}).status_code == 403
    saved = cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": three[:2]}]}).json()
    assert len(saved["categories"][0]["nominated"]) == 2 and saved["updated_by"] == "cse.admin@kiet.edu"

    # IT is a one-team department; CSE(CS) too, despite the name.
    assert it.get("/admin/finalists").json()["categories"][0]["quota"] == 1
    assert root.get("/admin/finalists", params={"department": "CSE(CS)"}).json()["categories"][0]["quota"] == 1
    assert root.get("/admin/finalists", params={"department": "NOPE"}).status_code == 404

    assert cse.post("/admin/results/publish").status_code == 403
    summary = root.get("/admin/finalists/summary").json()
    assert {t["name"] for t in summary["direct_teams"]} == {"ABES Team", "DPS Team"}
    result = root.post("/admin/results/publish").json()
    assert (result["finalists"], result["not_selected"]) == (2, 2)
    assert root.post("/admin/results/publish").status_code == 409
    assert cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": []}]}).status_code == 409

    # Students see their result; direct-to-finale teams are unchanged.
    assert as_user("a@kiet.edu").get("/me/team").json()["result"] == "finalist"
    assert as_user("e@kiet.edu").get("/me/team").json()["result"] == "not_selected"
    assert as_user("r@gmail.com").get("/me/team").json()["result"] == "pending"


def test_withdrawn_team_loses_nomination(world):
    cse, teams = world["cse"], world["teams"]
    cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [teams["cse_a"]["id"]]}]})
    cse.post(f"/admin/teams/{teams['cse_a']['id']}/withdraw", {"reason": "A member withdrew."})
    assert cse.get("/admin/finalists").json()["categories"][0]["nominated"] == []


def test_manage_admins(world):
    root, cse = world["root"], world["cse"]
    assert cse.get("/admin/admins").status_code == 403
    assert cse.post("/admin/admins", {"email": "x@kiet.edu", "name": "X Y", "role": "super_admin"}).status_code == 403
    assert root.post("/admin/admins", {"email": "x@kiet.edu", "name": "X Y", "role": "admin"}).status_code == 422  # no department
    assert (
        root.post("/admin/admins", {"email": "CSE.Admin@kiet.edu", "name": "Dup", "role": "admin", "department": "CSE"}).status_code == 409
    )
    assert root.delete("/admin/admins/root@kiet.edu").status_code == 409  # yourself
    assert root.delete("/admin/admins/ghost@kiet.edu").status_code == 404
    assert root.delete("/admin/admins/it.admin@kiet.edu").status_code == 204
    assert world["it"].get("/admin/me").status_code == 403
    emails = {a["email"] for a in root.get("/admin/admins").json()}
    assert emails == {"root@kiet.edu", "cse.admin@kiet.edu"}


def test_stats_are_scoped(world):
    root = world["root"].get("/admin/stats").json()
    assert root["teams"]["submitted"] == 6 and root["department"] is None
    assert {t["type"]: t["teams"] for t in root["by_type"]} == {"kiet": 4, "college": 1, "school": 1}
    cse = world["cse"].get("/admin/stats").json()
    assert cse["department"] == "CSE" and cse["teams"]["total"] == 3
    assert cse["by_type"] is None and cse["by_department"] is None
    assert len(cse["recent_submissions"]) == 3


def test_audit_is_scoped(world):
    it_actions = world["it"].get("/admin/audit", params={"limit": 200}).json()
    assert it_actions and all(entry["department"] == "IT" for entry in it_actions)
    assert world["cse"].get("/admin/audit", params={"team_id": world["teams"]["it_a"]["id"]}).status_code == 403
    assert world["root"].get("/admin/audit", params={"limit": 500}).status_code == 422


def test_student_actions_blocked_on_withdrawn_team(world, as_user, student):
    team = world["teams"]["college"]
    world["root"].post(f"/admin/teams/{team['id']}/withdraw", {"reason": "Team asked to withdraw."})
    leader = as_user("r@gmail.com")
    student("z@gmail.com", college_profile())
    assert leader.post(f"/teams/{team['id']}/invitations", {"email": "z@gmail.com"}).status_code == 409
    assert leader.post("/teams", team_input(name="Fresh start")).status_code == 409


def test_withdraw_and_restore_after_publishing_keep_result_consistent(world, as_user):
    root, cse, teams = world["root"], world["cse"], world["teams"]
    cse.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [teams["cse_a"]["id"]]}]})
    root.post("/admin/results/publish")

    withdrawn = root.post(f"/admin/teams/{teams['cse_a']['id']}/withdraw", {"reason": "Team could not attend."}).json()
    assert (withdrawn["status"], withdrawn["result"]) == ("withdrawn", "not_selected")
    restored = root.post(f"/admin/teams/{teams['cse_a']['id']}/restore", {"reason": "They can attend after all."}).json()
    assert (restored["status"], restored["result"]) == ("submitted", "finalist")


def test_restore_blocked_after_members_left(world, as_user):
    root, team = world["root"], world["teams"]["cse_b"]
    root.post(f"/admin/teams/{team['id']}/withdraw", {"reason": "A member withdrew."})
    assert as_user("d@kiet.edu").post(f"/teams/{team['id']}/leave").status_code == 204
    response = root.post(f"/admin/teams/{team['id']}/restore", {"reason": "Restore request."})
    assert response.status_code == 409 and "left" in response.json()["detail"]
