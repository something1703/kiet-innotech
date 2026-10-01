"""Banning students and teams, and organisers registering students."""

from test_admin import world  # noqa: F401  (fixture)

from conftest import college_profile, kiet_profile, team_input


def students(api, **params):
    return {s["email"]: s for s in api.get("/admin/students", params={"page_size": 100, **params}).json()["items"]}


def test_a_banned_student_is_locked_out_and_can_be_let_back_in(world, as_user):  # noqa: F811
    root = world["root"]
    user_id = students(root)["b@kiet.edu"]["user_id"]
    assert world["cse"].post(f"/admin/students/{user_id}/ban", {"reason": "Fake identity"}).status_code == 403
    assert root.post(f"/admin/students/{user_id}/ban", {"reason": "x"}).status_code == 422
    banned = root.post(f"/admin/students/{user_id}/ban", {"reason": "Fake identity"})
    assert banned.status_code == 200 and banned.json()["banned_reason"] == "Fake identity"
    assert root.post(f"/admin/students/{user_id}/ban", {"reason": "Fake identity"}).status_code == 409
    me = as_user("b@kiet.edu").get("/me")
    assert me.status_code == 403 and "suspended" in me.json()["detail"]
    assert set(students(root, banned="yes")) == {"b@kiet.edu"}
    assert "b@kiet.edu" not in students(root, banned="no")
    assert root.get("/admin/activity", params={"kind": "student"}).json()["items"][0]["action"] == "student.banned"

    assert root.post(f"/admin/students/{user_id}/unban", {"reason": "Identity verified"}).status_code == 200
    assert as_user("b@kiet.edu").get("/me").status_code == 200


def test_banning_a_draft_team_member_frees_their_place(as_user, student, team_of):
    root = as_user("root@kiet.edu")
    leader, member = student("lead@kiet.edu"), student("mem@kiet.edu")
    team = team_of(leader, [member])
    user_id = students(root)["mem@kiet.edu"]["user_id"]
    response = root.post(f"/admin/students/{user_id}/ban", {"reason": "Misconduct at the help desk"})
    assert response.status_code == 200 and response.json()["team"] is None
    assert [m["email"] for m in leader.get("/me/team").json()["members"]] == ["lead@kiet.edu"]
    # A banned student cannot be invited or put in a team by an organiser.
    assert leader.post(f"/teams/{team['id']}/invitations", {"email": "mem@kiet.edu"}).status_code == 422
    body = {**team_input(name="Another Team"), "leader_email": "mem@kiet.edu", "member_emails": []}
    assert root.post("/admin/teams", body).status_code == 422


def test_banning_a_team_disqualifies_it_and_can_ban_its_members(world, as_user):  # noqa: F811
    root, team = world["root"], world["teams"]["cse_b"]
    assert world["cse"].post(f"/admin/teams/{team['id']}/ban", {"reason": "Plagiarised project"}).status_code == 403
    response = root.post(f"/admin/teams/{team['id']}/ban", {"reason": "Plagiarised project", "ban_members": True})
    assert response.status_code == 200 and response.json()["status"] == "disqualified"
    assert as_user("c@kiet.edu").get("/me").status_code == 403
    assert as_user("d@kiet.edu").get("/me").status_code == 403
    # Without banning members, a team that is already out is a conflict.
    assert root.post(f"/admin/teams/{team['id']}/ban", {"reason": "Plagiarised project"}).status_code == 409
    other = world["teams"]["cse_c"]
    assert root.post(f"/admin/teams/{other['id']}/ban", {"reason": "Plagiarised project"}).json()["status"] == "disqualified"
    assert as_user("e@kiet.edu").get("/me").status_code == 200


def test_organisers_register_students(world, as_user):  # noqa: F811
    root, cse = world["root"], world["cse"]
    body = {**kiet_profile(roll="2400290100777"), "email": "New.Student@kiet.edu"}
    created = cse.post("/admin/students", body)
    assert created.status_code == 201, created.text
    assert (created.json()["email"], created.json()["department"]) == ("new.student@kiet.edu", "CSE")
    # The student can sign in and use the portal straight away.
    assert as_user("new.student@kiet.edu").get("/me").json()["profile"]["roll_number"] == "2400290100777"
    assert cse.post("/admin/students", body).status_code == 409
    # Scope and email rules.
    assert cse.post("/admin/students", {**kiet_profile(department="IT"), "email": "it.new@kiet.edu"}).status_code == 403
    assert root.post("/admin/students", {**kiet_profile(), "email": "someone@gmail.com"}).status_code == 422
    assert root.post("/admin/students", {**college_profile(), "email": "someone@kiet.edu"}).status_code == 422
    assert root.post("/admin/students", {**kiet_profile(roll="2400290100777"), "email": "dup.roll@kiet.edu"}).status_code == 409
    college = root.post("/admin/students", {**college_profile(), "email": "college.kid@gmail.com"})
    assert college.status_code == 201 and college.json()["institution"] == "ABES Engineering College"
    assert root.get("/admin/activity", params={"kind": "student"}).json()["total"] == 2
