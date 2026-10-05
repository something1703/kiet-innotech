from datetime import UTC, datetime, timedelta, timezone

from conftest import college_profile, kiet_profile, school_profile, team_input

# ---------- Profile ----------


def test_me_before_profile(as_user):
    response = as_user("new.student@kiet.edu").get("/me")
    assert response.status_code == 200
    body = response.json()
    assert (body["email"], body["name"], body["profile"]) == ("new.student@kiet.edu", "New Student", None)
    assert body["registration"]["state"] == "open"


def test_kiet_email_must_register_as_kiet(as_user):
    response = as_user("a@kiet.edu").put("/me/profile", college_profile())
    assert response.status_code == 422
    assert "@kiet.edu email register as KIET" in response.json()["detail"]


def test_other_email_cannot_register_as_kiet(as_user):
    response = as_user("someone@gmail.com").put("/me/profile", kiet_profile())
    assert response.status_code == 422
    assert "official @kiet.edu email" in response.json()["detail"]


def test_email_domain_check_is_exact(as_user):
    # Lookalike domains are not KIET.
    for email in ("x@kiet.edu.in", "x@notkiet.edu", "x@kiet.education"):
        assert as_user(email).put("/me/profile", kiet_profile()).status_code == 422


def test_profile_saved_and_normalised(as_user):
    api = as_user("a@kiet.edu")
    response = api.put("/me/profile", kiet_profile(phone="+91 91234 56780", full_name="  Aarav   Sharma "))
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "9123456780"
    assert body["full_name"] == "Aarav Sharma"
    assert body["institution"] == "KIET Deemed to be University"
    assert api.get("/me").json()["profile"]["department"] == "CSE"


def test_profile_validation_messages(as_user):
    api = as_user("a@kiet.edu")
    cases = [
        (kiet_profile(phone="12345"), "10-digit Indian mobile"),
        (kiet_profile(department="XYZ"), "Choose your department"),
        (kiet_profile(year=9), "year of study"),
        (kiet_profile(roll=" "), "roll number"),
        ({**kiet_profile(), "is_admin": True}, "is admin"),
    ]
    for body, message in cases:
        response = api.put("/me/profile", body)
        assert response.status_code == 422
        assert message in response.json()["detail"], response.json()


def test_school_profile_ignores_course_and_department(as_user):
    response = as_user("kid@gmail.com").put("/me/profile", {**school_profile(), "department": "CSE"})
    assert response.status_code == 200
    assert response.json()["department"] is None
    assert response.json()["course"] == "School"


def test_duplicate_kiet_roll_number_rejected(as_user):
    assert as_user("a@kiet.edu").put("/me/profile", kiet_profile(roll="2300290100012")).status_code == 200
    response = as_user("b@kiet.edu").put("/me/profile", kiet_profile(roll="2300290100012"))
    assert response.status_code == 409
    assert "roll number is already registered" in response.json()["detail"]


def test_kiet_roll_number_any_format(as_user):
    # MCA and MBA roll numbers differ from B.Tech ones, so any format is accepted; stored tidied (single spaces, upper case).
    cases = [
        ("mba@kiet.edu", {"department": "KSOM", "course": "MBA"}, "202510116100068", "202510116100068"),
        ("mca@kiet.edu", {"department": "MCA", "course": "MCA"}, "202510115100018", "202510115100018"),
        ("x@kiet.edu", {"department": "KSOM", "course": "MBA"}, "  kiet/mba/24 - 017 ", "KIET/MBA/24 - 017"),
        ("y@kiet.edu", {"department": "CSE", "course": "B.Tech"}, "cse-001", "CSE-001"),
        ("z@kiet.edu", {"department": "IT", "course": "B.Tech"}, "12345", "12345"),
    ]
    for email, fields, typed, stored in cases:
        response = as_user(email).put("/me/profile", kiet_profile(roll=typed, **fields))
        assert response.status_code == 200, response.json()
        assert response.json()["roll_number"] == stored


def test_kiet_roll_number_still_required_and_unique(as_user):
    response = as_user("a@kiet.edu").put("/me/profile", kiet_profile(department="KSOM", course="MBA", roll="   "))
    assert response.status_code == 422
    assert "roll number" in response.json()["detail"]
    assert as_user("b@kiet.edu").put("/me/profile", kiet_profile(department="MCA", course="MCA", roll="mca-001")).status_code == 200
    # The same number typed differently is still a duplicate.
    response = as_user("c@kiet.edu").put("/me/profile", kiet_profile(department="MCA", course="MCA", roll=" MCA-001 "))
    assert response.status_code == 409


def test_locked_profile_fields_in_team(student, team_of):
    leader = student("a@kiet.edu")
    team_of(leader)
    response = leader.put("/me/profile", kiet_profile(department="IT"))
    assert response.status_code == 409
    # Name and phone can still change.
    profile = leader.get("/me").json()["profile"]
    allowed = {k: profile[k] for k in ("participant_type", "department", "course", "year", "roll_number")}
    assert leader.put("/me/profile", {**allowed, "full_name": "New Name", "phone": "9000000001"}).status_code == 200


def test_new_profile_needs_open_registration(as_user, settings):
    settings.force_registration_open = False
    settings.registration_opens = datetime(2026, 10, 3, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    settings.registration_closes = settings.registration_opens + timedelta(days=9)
    if datetime.now(UTC) >= settings.registration_opens:
        settings.registration_opens = datetime.now(UTC) + timedelta(days=1)
    response = as_user("a@kiet.edu").put("/me/profile", kiet_profile())
    assert response.status_code == 403
    # The message follows the configured date (in IST), not a hard-coded one.
    assert f"opens on {settings.registration_opens.astimezone(timezone(timedelta(hours=5, minutes=30))).day} " in response.json()["detail"]


# ---------- Teams ----------


def test_team_endpoints_need_a_profile(as_user):
    api = as_user("a@kiet.edu")
    assert api.get("/me/team").status_code == 403
    assert api.post("/teams", team_input()).status_code == 403


def test_create_team(student):
    leader = student("a@kiet.edu")
    response = leader.post("/teams", team_input())
    assert response.status_code == 201
    team = response.json()
    assert team["code"] == "IT26-0001"
    assert team["route"] == "department"
    assert team["department"] == "CSE"
    assert [m["role"] for m in team["members"]] == ["leader"]
    assert leader.get("/me/team").json()["id"] == team["id"]


def test_one_team_per_student(student, team_of):
    leader = student("a@kiet.edu")
    team_of(leader)
    response = leader.post("/teams", team_input(name="Second"))
    assert response.status_code == 409


def test_team_names_unique_ignoring_case_and_spaces(student, team_of):
    team_of(student("a@kiet.edu"), name="Code Crafters")
    response = student("b@kiet.edu").post("/teams", team_input(name="  code   CRAFTERS "))
    assert response.status_code == 409
    assert "already uses this name" in response.json()["detail"]


def test_category_rules(student):
    school = student("kid@gmail.com", school_profile())
    # Schools may enter any category (only category 6, for first-year students, is out of reach).
    assert school.post("/teams", team_input(category=1)).status_code == 201
    for number, email in ((3, "kid3@gmail.com"), (8, "kid8@gmail.com"), (5, "kid5@gmail.com")):
        assert student(email, school_profile()).post("/teams", team_input(name=f"School {number}", category=number)).status_code == 201

    third_year = student("a@kiet.edu", kiet_profile(year=3))
    assert "first-year" in third_year.post("/teams", team_input(category=6)).json()["detail"]


def test_team_input_validation(student):
    leader = student("a@kiet.edu")
    assert "at least 100" in leader.post("/teams", team_input(abstract="too short")).json()["detail"]
    assert "domain" in leader.post("/teams", team_input(domain="Made up")).json()["detail"]
    assert leader.post("/teams", team_input(category=9)).status_code == 422
    assert leader.post("/teams", team_input(name="x" * 41)).status_code == 422


def test_full_lifecycle(student, team_of):
    leader, member = student("a@kiet.edu"), student("b@kiet.edu", kiet_profile(department="IT"))
    team = team_of(leader, [member])
    assert len(team["members"]) == 2
    assert member.get("/me/team").json()["id"] == team["id"]

    response = leader.post(f"/teams/{team['id']}/submit")
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"

    # Locked after submission.
    assert leader.patch(f"/teams/{team['id']}", team_input(name="Renamed")).status_code == 409
    assert member.post(f"/teams/{team['id']}/leave").status_code == 409
    assert leader.delete(f"/teams/{team['id']}").status_code == 409
    assert leader.delete(f"/teams/{team['id']}/members/{member.get('/me').json()['profile']['user_id']}").status_code == 409


def test_submit_checks(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader)
    assert "2 to 5 members" in leader.post(f"/teams/{team['id']}/submit").json()["detail"]

    joiner, waiting = student("b@kiet.edu"), student("c@kiet.edu")
    leader.post(f"/teams/{team['id']}/invitations", {"email": waiting.email})
    leader.post(f"/teams/{team['id']}/invitations", {"email": joiner.email})
    invitation = joiner.get("/me/invitations").json()[0]
    assert joiner.post(f"/invitations/{invitation['id']}/accept").status_code == 204
    # Two members now, but one invitation is still pending.
    assert "pending invitations" in leader.post(f"/teams/{team['id']}/submit").json()["detail"]


def test_only_leader_manages_team(student, team_of):
    leader, member = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader, [member])
    student("c@kiet.edu")
    assert member.post(f"/teams/{team['id']}/invitations", {"email": "c@kiet.edu"}).status_code == 403
    assert member.patch(f"/teams/{team['id']}", team_input()).status_code == 403
    assert member.post(f"/teams/{team['id']}/submit").status_code == 403


def test_other_teams_are_invisible(student, team_of):
    team = team_of(student("a@kiet.edu"))
    outsider = student("x@kiet.edu")
    assert outsider.patch(f"/teams/{team['id']}", team_input()).status_code == 404
    assert outsider.delete(f"/teams/{team['id']}").status_code == 404
    assert outsider.post(f"/teams/{team['id']}/leave").status_code == 404


def test_leave_remove_and_delete(student, team_of):
    leader, b, c = student("a@kiet.edu"), student("b@kiet.edu"), student("c@kiet.edu")
    team = team_of(leader, [b, c])
    assert leader.post(f"/teams/{team['id']}/leave").status_code == 409  # leader must delete instead
    assert b.post(f"/teams/{team['id']}/leave").status_code == 204
    assert b.get("/me/team").json() is None

    c_id = c.get("/me").json()["profile"]["user_id"]
    leader_id = leader.get("/me").json()["profile"]["user_id"]
    assert leader.delete(f"/teams/{team['id']}/members/{leader_id}").status_code == 409
    assert len(leader.delete(f"/teams/{team['id']}/members/{c_id}").json()["members"]) == 1

    assert leader.delete(f"/teams/{team['id']}").status_code == 204
    assert leader.get("/me/team").json() is None
    # The name is free again.
    assert c.post("/teams", team_input()).status_code == 201


# ---------- Invitations ----------


def test_invitation_rules(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader)
    invite = lambda email: leader.post(f"/teams/{team['id']}/invitations", {"email": email})  # noqa: E731

    assert "No registered student" in invite("ghost@kiet.edu").json()["detail"]
    assert invite("not-an-email").status_code == 422
    assert "already in this team" in invite("A@KIET.EDU").json()["detail"]

    student("other@gmail.com", college_profile())
    assert "same college or school" in invite("other@gmail.com").json()["detail"]

    busy = student("busy@kiet.edu")
    team_of(busy, name="Busy Team")
    assert "another team" in invite("busy@kiet.edu").json()["detail"]

    student("b@kiet.edu")
    assert invite("b@kiet.edu").status_code == 201
    assert "already been invited" in invite("b@kiet.edu").json()["detail"]


def test_other_college_teams_must_share_the_college(student, team_of):
    leader = student("r@gmail.com", college_profile(institution="ABES Engineering College"))
    same = student("s@gmail.com", college_profile(institution="abes engineering  college."))
    different = student("t@gmail.com", college_profile(institution="IMS Engineering College"))
    team = team_of(leader, [same])
    assert team["route"] == "finale"
    assert leader.post(f"/teams/{team['id']}/invitations", {"email": different.email}).status_code == 422


def test_first_year_category_checks_invitee(student, team_of):
    leader = student("a@kiet.edu", kiet_profile(year=1))
    team = team_of(leader, category=6)
    student("senior@kiet.edu", kiet_profile(year=2))
    response = leader.post(f"/teams/{team['id']}/invitations", {"email": "senior@kiet.edu"})
    assert "first-year" in response.json()["detail"]


def test_team_size_counts_pending_invitations(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader)
    for i in range(4):
        student(f"m{i}@kiet.edu")
        assert leader.post(f"/teams/{team['id']}/invitations", {"email": f"m{i}@kiet.edu"}).status_code == 201
    student("m5@kiet.edu")
    response = leader.post(f"/teams/{team['id']}/invitations", {"email": "m5@kiet.edu"})
    assert "at most 5" in response.json()["detail"]


def test_invitation_rate_limit(student, team_of, settings):
    settings.invitations_per_team_per_day = 3
    leader = student("a@kiet.edu")
    team = team_of(leader)
    student("b@kiet.edu")
    for _ in range(3):
        sent = leader.post(f"/teams/{team['id']}/invitations", {"email": "b@kiet.edu"}).json()
        leader.delete(f"/invitations/{sent['invitations'][0]['id']}")
    assert leader.post(f"/teams/{team['id']}/invitations", {"email": "b@kiet.edu"}).status_code == 429


def test_accepting_declines_other_invitations(student, team_of):
    a, b, invitee = student("a@kiet.edu"), student("b@kiet.edu"), student("c@kiet.edu")
    team_a = team_of(a, name="Alpha")
    team_b = team_of(b, name="Beta")
    a.post(f"/teams/{team_a['id']}/invitations", {"email": invitee.email})
    b.post(f"/teams/{team_b['id']}/invitations", {"email": invitee.email})
    invitations = invitee.get("/me/invitations").json()
    assert {i["team_name"] for i in invitations} == {"Alpha", "Beta"}

    first = next(i for i in invitations if i["team_name"] == "Alpha")
    second = next(i for i in invitations if i["team_name"] == "Beta")
    assert invitee.post(f"/invitations/{first['id']}/accept").status_code == 204
    assert invitee.get("/me/invitations").json() == []
    assert invitee.post(f"/invitations/{second['id']}/accept").status_code == 404
    assert b.get("/me/team").json()["invitations"] == []


def test_cancelled_invitation_cannot_be_accepted(student, team_of):
    leader, invitee = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader)
    sent = leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email}).json()
    invitation_id = sent["invitations"][0]["id"]
    assert leader.delete(f"/invitations/{invitation_id}").status_code == 200
    assert invitee.post(f"/invitations/{invitation_id}/accept").status_code == 404


def test_invitations_are_private(student, team_of):
    leader, invitee, stranger = student("a@kiet.edu"), student("b@kiet.edu"), student("c@kiet.edu")
    team = team_of(leader)
    invitation_id = leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email}).json()["invitations"][0]["id"]
    assert stranger.post(f"/invitations/{invitation_id}/accept").status_code == 404
    assert stranger.delete(f"/invitations/{invitation_id}").status_code == 404
    assert invitee.delete(f"/invitations/{invitation_id}").status_code == 404


def test_invitee_who_changed_college_cannot_accept(student, team_of):
    leader = student("r@gmail.com", college_profile(institution="ABES Engineering College"))
    invitee = student("s@gmail.com", college_profile(institution="ABES Engineering College"))
    team = team_of(leader)
    leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email})
    invitee.put("/me/profile", college_profile(institution="IMS Engineering College"))
    invitation = invitee.get("/me/invitations").json()[0]
    assert invitee.post(f"/invitations/{invitation['id']}/accept").status_code == 422


def test_decline_works_after_registration_closes(student, team_of, settings):
    leader, invitee = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader)
    leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email})
    invitation = invitee.get("/me/invitations").json()[0]

    settings.force_registration_open = False
    settings.registration_opens = datetime.now(UTC) - timedelta(days=10)
    settings.registration_closes = datetime.now(UTC) - timedelta(minutes=1)
    assert invitee.post(f"/invitations/{invitation['id']}/accept").status_code == 403
    assert invitee.post(f"/invitations/{invitation['id']}/decline").status_code == 204
    assert "closed" in leader.post("/teams", team_input(name="Late")).json()["detail"]


def test_kiet_team_can_mix_departments(student, team_of, as_user):
    leader = student("lead@kiet.edu", kiet_profile(department="CSE"))
    members = [student(f"{d.lower()}@kiet.edu", kiet_profile(department=d)) for d in ("IT", "EC", "ME")]
    team = team_of(leader, members)
    assert team["department"] == "CSE"  # the leader's department
    assert sorted(m["department"] for m in team["members"]) == ["CSE", "EC", "IT", "ME"]
    assert leader.post(f"/teams/{team['id']}/submit").json()["status"] == "submitted"

    root, it_admin = as_user("root@kiet.edu"), as_user("it.admin@kiet.edu")
    root.post("/admin/admins", {"email": it_admin.email, "name": "IT Admin", "role": "admin", "department": "IT"})
    board = root.get("/admin/finalists", params={"department": "CSE"}).json()
    assert [t["name"] for t in board["categories"][1]["teams"]] == ["Code Crafters"]
    # The IT admin sees their IT student, but the team belongs to CSE's round.
    assert it_admin.get("/admin/teams").json()["total"] == 0
    it_student = it_admin.get("/admin/students", params={"q": "it@kiet.edu"}).json()["items"][0]
    assert it_student["team"]["department"] == "CSE"


def test_first_year_category_with_mixed_departments(student, team_of):
    leader = student("lead@kiet.edu", kiet_profile(department="CSE", year=1))
    other = student("other@kiet.edu", kiet_profile(department="EN", year=1))
    team = team_of(leader, [other], category=6)
    assert {m["department"] for m in team["members"]} == {"CSE", "EN"}


def test_creating_a_team_declines_pending_invitations(student, team_of):
    leader, member, invitee = student("a@kiet.edu"), student("b@kiet.edu"), student("x@kiet.edu")
    team = team_of(leader, [member])
    leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email})
    assert invitee.post("/teams", team_input(name="My Own Team")).status_code == 201
    assert invitee.get("/me/invitations").json() == []
    # The first team is no longer blocked by an invitation that can never be accepted.
    assert leader.get("/me/team").json()["invitations"] == []
    assert leader.post(f"/teams/{team['id']}/submit").status_code == 200


def test_withdrawn_team_members_can_leave_and_join_another(student, team_of, as_user):
    leader, member = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader, [member])
    as_user("root@kiet.edu").post(f"/admin/teams/{team['id']}/withdraw", {"reason": "A member withdrew."})

    assert "withdrawn" in leader.post(f"/teams/{team['id']}/invitations", {"email": "c@kiet.edu"}).json()["detail"]
    assert member.post(f"/teams/{team['id']}/leave").status_code == 204
    assert leader.post(f"/teams/{team['id']}/leave").status_code == 204  # the leader too
    assert member.post("/teams", team_input(name="Second Chance")).status_code == 201


def test_disqualified_team_members_stay_locked(student, team_of, as_user):
    leader, member = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader, [member])
    as_user("root@kiet.edu").post(f"/admin/teams/{team['id']}/disqualify", {"reason": "Plagiarised project."})
    response = member.post(f"/teams/{team['id']}/leave")
    assert response.status_code == 409 and "disqualified" in response.json()["detail"]
