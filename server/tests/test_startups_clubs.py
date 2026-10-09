"""Startups (a single entry from any Google account), COE KIET / technical clubs, and the two admin roles that manage them."""

from conftest import college_profile, kiet_profile, team_input


def startup_profile(name: str = "Greenloop Labs", **overrides: object) -> dict:
    # Only these three things are asked of a startup; the rest is filled in by the server.
    return {"full_name": "Asha Verma", "phone": "9876501234", "participant_type": "startup", "institution": name, "year": 0, **overrides}


def club_profile(club: str = "Robotics Club", **overrides: object) -> dict:
    return kiet_profile(department="COE", club=club, **overrides)


# ---------- Startups: profile ----------


def test_startup_profile_needs_only_name_person_and_phone(as_user):
    for email in ("founder@gmail.com", "alumni@kiet.edu"):
        response = as_user(email).put("/me/profile", startup_profile(name=f"  Greenloop   Labs {email[:3]} "))
        assert response.status_code == 200, response.json()
        body = response.json()
        assert body["participant_type"] == "startup"
        assert body["institution"] == f"Greenloop Labs {email[:3]}"
        assert (body["department"], body["city"], body["course"], body["year"], body["roll_number"], body["club"]) == (
            None, "", "Startup", 0, "", ""
        )


def test_startup_profile_validation(as_user):
    api = as_user("founder@gmail.com")
    for body, message in [
        (startup_profile(name=" "), "name of your startup"),
        (startup_profile(name="A"), "name of your startup"),
        (startup_profile(name="!!!"), "English letters"),
        (startup_profile(phone="123"), "10-digit"),
        (startup_profile(full_name="Al"), "full name"),
    ]:
        response = api.put("/me/profile", body)
        assert response.status_code == 422 and message in response.json()["detail"], response.json()


def test_other_details_sent_with_a_startup_are_ignored(as_user):
    body = startup_profile(department="CSE", club="Some Club", roll_number="X1", course="B.Tech", city="Delhi", year=3)
    saved = as_user("founder@gmail.com").put("/me/profile", body).json()
    assert (saved["department"], saved["club"], saved["roll_number"], saved["course"], saved["city"], saved["year"]) == (None, "", "", "Startup", "", 0)


# ---------- Startups: one entry, no teammates ----------


def test_startup_creates_and_submits_a_team_of_one(as_user):
    api = as_user("founder@gmail.com")
    assert api.put("/me/profile", startup_profile()).status_code == 200
    created = api.post("/teams", team_input(name="Greenloop Labs", category=5))
    assert created.status_code == 201, created.json()
    team = created.json()
    assert (team["participant_type"], team["route"], team["department"], team["institution"]) == ("startup", "finale", None, "Greenloop Labs")
    assert len(team["members"]) == 1

    submitted = api.post(f"/teams/{team['id']}/submit")
    assert submitted.status_code == 200, submitted.json()
    assert api.get("/me/team").json()["status"] == "submitted"


def test_startup_cannot_add_teammates(as_user, student):
    api = as_user("founder@gmail.com")
    api.put("/me/profile", startup_profile())
    team = api.post("/teams", team_input(name="Greenloop Labs")).json()
    other = student("someone@gmail.com", startup_profile("Other Co", full_name="Other Person"))

    response = api.post(f"/teams/{team['id']}/invitations", {"email": other.email})
    assert response.status_code == 422 and "single entry" in response.json()["detail"]
    # Joining with the code is refused as well, even for another startup.
    joined = other.post("/teams/join", {"code": team["join_code"]})
    assert joined.status_code in (409, 422), joined.json()
    assert len(api.get("/me/team").json()["members"]) == 1


def test_startups_cannot_enter_the_first_year_category(as_user):
    api = as_user("founder@gmail.com")
    api.put("/me/profile", startup_profile())
    assert api.post("/teams", team_input(category=6)).status_code == 422


def test_student_cannot_join_a_startup_and_startup_cannot_join_a_team(as_user, student, team_of):
    founder = as_user("founder@gmail.com")
    founder.put("/me/profile", startup_profile())
    startup_team = founder.post("/teams", team_input(name="Greenloop Labs")).json()
    kiet_leader = student("lead@kiet.edu")
    kiet_team = team_of(kiet_leader, name="KIET Crew")
    kiet_member = student("member@kiet.edu")

    assert kiet_member.post("/teams/join", {"code": startup_team["join_code"]}).status_code in (409, 422)
    other_founder = as_user("founder2@gmail.com")
    other_founder.put("/me/profile", startup_profile("Second Startup"))
    assert other_founder.post("/teams/join", {"code": kiet_team["join_code"]}).status_code == 422


# ---------- COE KIET / technical clubs ----------


def test_coe_students_give_their_club(as_user):
    api = as_user("coe@kiet.edu")
    response = api.put("/me/profile", club_profile(club="  Robotics   Club "))
    assert response.status_code == 200, response.json()
    assert (response.json()["department"], response.json()["club"]) == ("COE", "Robotics Club")
    assert api.get("/me").json()["profile"]["club"] == "Robotics Club"


def test_coe_is_for_kiet_accounts_only_and_startups_for_any_account(as_user):
    # COE KIET is a KIET department, so it needs a @kiet.edu account; a startup can use any account.
    for email in ("someone@gmail.com", "x@kiet.edu.in", "x@notkiet.edu"):
        response = as_user(email).put("/me/profile", club_profile())
        assert response.status_code == 422 and "official @kiet.edu email" in response.json()["detail"], (email, response.json())
    assert as_user("coe@kiet.edu").put("/me/profile", club_profile()).status_code == 200
    for email in ("founder@gmail.com", "founder@outlook.com", "founder@kiet.edu"):
        assert as_user(email).put("/me/profile", startup_profile(name=f"Startup {email[:6]}")).status_code == 200


def test_coe_without_a_club_is_refused_and_other_departments_drop_it(as_user):
    for club in ("", " ", "A"):
        response = as_user("coe@kiet.edu").put("/me/profile", club_profile(club=club))
        assert response.status_code == 422 and "technical club" in response.json()["detail"]
    saved = as_user("cse@kiet.edu").put("/me/profile", kiet_profile(department="CSE", club="Robotics Club")).json()
    assert saved["club"] == ""


def test_coe_team_is_a_department_round_team_of_coe(student, team_of):
    leader = student("coe1@kiet.edu", club_profile())
    member = student("coe2@kiet.edu", club_profile(club="Coding Club"))
    team = team_of(leader, [member])
    assert (team["department"], team["route"]) == ("COE", "department")
    assert {m["club"] for m in team["members"]} == {"Robotics Club", "Coding Club"}


# ---------- Admins ----------


def make_admin(root, email: str, role: str, department: str | None = None):
    response = root.post("/admin/admins", {"email": email, "name": "Desk", "role": role, "department": department})
    assert response.status_code == 201, response.text
    return response.json()


def test_startup_admin_sees_only_startups(as_user, student, team_of):
    root = as_user("root@kiet.edu")
    founder = as_user("founder@gmail.com")
    founder.put("/me/profile", startup_profile())
    startup_team = founder.post("/teams", team_input(name="Greenloop Labs", category=5)).json()
    kiet_team = team_of(student("lead@kiet.edu"), name="KIET Crew")
    college = student("lead@abes.in", college_profile())
    team_of(college, name="ABES Crew")

    admin = make_admin(root, "startups@gmail.com", "startup_admin", "CSE")
    assert admin["department"] is None and admin["role"] == "startup_admin"
    desk = as_user("startups@gmail.com")
    me = desk.get("/admin/me").json()
    assert (me["role"], me["department"]) == ("startup_admin", None)

    assert {t["name"] for t in desk.get("/admin/teams").json()["items"]} == {"Greenloop Labs"}
    assert desk.get(f"/admin/teams/{startup_team['id']}").status_code == 200
    assert desk.get(f"/admin/teams/{kiet_team['id']}").status_code == 403
    students = desk.get("/admin/students", params={"page_size": 100}).json()["items"]
    assert {s["participant_type"] for s in students} == {"startup"}
    assert desk.get("/admin/admins").status_code == 403
    assert desk.get("/admin/finalists/summary").status_code == 403
    assert desk.get("/admin/stats").status_code == 200
    assert desk.get("/admin/judging/department").status_code == 403
    assert desk.get("/admin/judging/final").status_code == 200
    assert desk.get("/admin/judging/final/rankings").status_code == 403
    assert desk.get("/admin/audit").status_code == 200


def test_outside_admin_no_longer_sees_startups(as_user):
    root = as_user("root@kiet.edu")
    founder = as_user("founder@gmail.com")
    founder.put("/me/profile", startup_profile())
    founder.post("/teams", team_input(name="Greenloop Labs"))
    make_admin(root, "outside@gmail.com", "outside_admin")
    assert as_user("outside@gmail.com").get("/admin/teams").json()["items"] == []
    assert as_user("outside@gmail.com").get("/admin/students", params={"page_size": 100}).json()["items"] == []


def test_coe_admin_is_a_department_admin_for_coe(as_user, student, team_of):
    root = as_user("root@kiet.edu")
    coe_team = team_of(student("coe1@kiet.edu", club_profile()), [student("coe2@kiet.edu", club_profile())], name="Club Crew")
    cse_team = team_of(student("cse1@kiet.edu"), [student("cse2@kiet.edu")], name="CSE Crew")

    make_admin(root, "coe.admin@kiet.edu", "admin", "COE")
    desk = as_user("coe.admin@kiet.edu")
    assert {t["name"] for t in desk.get("/admin/teams").json()["items"]} == {"Club Crew"}
    assert desk.get(f"/admin/teams/{coe_team['id']}").status_code == 200
    assert desk.get(f"/admin/teams/{cse_team['id']}").status_code == 403
    detail = desk.get(f"/admin/teams/{coe_team['id']}").json()
    assert {m["club"] for m in detail["members"]} == {"Robotics Club"}
    students = desk.get("/admin/students", params={"page_size": 100}).json()["items"]
    assert {s["department"] for s in students} == {"COE"} and {s["club"] for s in students} == {"Robotics Club"}


def test_super_admin_stats_include_startups_and_coe(as_user, student, team_of):
    root = as_user("root@kiet.edu")
    founder = as_user("founder@gmail.com")
    founder.put("/me/profile", startup_profile())
    founder.post("/teams", team_input(name="Greenloop Labs"))
    team_of(student("coe1@kiet.edu", club_profile()), [student("coe2@kiet.edu", club_profile())], name="Club Crew")
    stats = root.get("/admin/stats").json()
    assert {t["type"]: t["students"] for t in stats["by_type"]}["startup"] == 1
    assert {d["department"] for d in stats["by_department"]} >= {"COE"}
    # A startup has no year of study: it is listed under year 0, and the rows still add up to the students.
    assert sum(row["students"] for row in stats["by_year"]) == stats["students"]
    assert {row["year"] for row in stats["by_year"] if row["participant_type"] == "startup"} == {0}


def test_organiser_can_register_a_startup_and_a_coe_student(as_user):
    root = as_user("root@kiet.edu")
    startup = root.post("/admin/students", {**startup_profile(), "email": "newfounder@gmail.com"})
    assert startup.status_code == 201, startup.json()
    assert startup.json()["participant_type"] == "startup"
    coe = root.post("/admin/students", {**club_profile(), "email": "club@kiet.edu"})
    assert coe.status_code == 201, coe.json()
    assert coe.json()["club"] == "Robotics Club"
    # A startup admin may only register startups.
    make_admin(root, "startups@gmail.com", "startup_admin")
    desk = as_user("startups@gmail.com")
    assert desk.post("/admin/students", {**club_profile(), "email": "club2@kiet.edu"}).status_code == 403
    assert desk.post("/admin/students", {**startup_profile("Second Co"), "email": "second@gmail.com"}).status_code == 201


def test_organiser_creates_and_submits_a_startup_entry(as_user):
    root = as_user("root@kiet.edu")
    as_user("founder@gmail.com").put("/me/profile", startup_profile())
    response = root.post("/admin/teams", {**team_input(name="Greenloop Labs"), "leader_email": "founder@gmail.com", "member_emails": [], "submit": True})
    assert response.status_code == 201, response.json()
    assert (response.json()["status"], response.json()["participant_type"]) == ("submitted", "startup")


def test_submitted_startups_join_the_grand_finale_judging_pool(as_user):
    root = as_user("root@kiet.edu")
    founder = as_user("founder@gmail.com")
    founder.put("/me/profile", startup_profile())
    team = founder.post("/teams", team_input(name="Greenloop Labs")).json()
    # A draft is not judged yet.
    assert root.get("/admin/judging/final").json()["unallotted"] == []
    assert founder.post(f"/teams/{team['id']}/submit").status_code == 200
    make_admin(root, "startups@gmail.com", "startup_admin")
    for who in (root, as_user("startups@gmail.com")):
        pool = who.get("/admin/judging/final").json()["unallotted"]
        assert [t["name"] for t in pool] == ["Greenloop Labs"]
