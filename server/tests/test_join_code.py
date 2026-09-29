"""Joining a team with the code the leader shares, instead of an email invitation."""

from datetime import UTC, datetime, timedelta

from conftest import college_profile, kiet_profile, school_profile


def join(api, code: str):
    return api.post("/teams/join", {"code": code})


def test_join_with_code(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader)
    joiner = student("b@kiet.edu", kiet_profile(department="EC"))  # any KIET department

    code = team["join_code"]
    response = join(joiner, code.lower().replace("-", " "))  # case, spaces and dashes don't matter
    assert response.status_code == 200
    assert {m["role"] for m in response.json()["members"]} == {"leader", "member"}
    assert joiner.get("/me/team").json()["id"] == team["id"]


def test_join_code_errors(student, team_of, as_user):
    leader = student("a@kiet.edu")
    team = team_of(leader)
    code = team["join_code"]
    joiner = student("b@kiet.edu")

    assert "8-character" in join(joiner, "IT26-0001").json()["detail"]  # the public team ID is not the code
    assert join(joiner, "ABCD-EFGH").status_code == 404
    assert as_user("new@kiet.edu").post("/teams/join", {"code": code}).status_code == 403  # no profile yet
    assert "already in this team" in join(leader, code).json()["detail"]

    busy = student("busy@kiet.edu")
    team_of(busy, name="Other Team")
    assert "already part of a team" in join(busy, code).json()["detail"]


def test_join_code_respects_team_rules(student, team_of):
    kiet_team = team_of(student("a@kiet.edu"))
    college = student("c@gmail.com", college_profile())
    assert "same college or school" in join(college, kiet_team["join_code"]).json()["detail"]

    first_years = team_of(student("f@kiet.edu", kiet_profile(year=1)), name="Freshers", category=6)
    senior = student("s@kiet.edu", kiet_profile(year=3))
    assert "first-year" in join(senior, first_years["join_code"]).json()["detail"]

    school_team = team_of(student("k@gmail.com", school_profile()), name="School Team", category=5)
    other_school = student("o@gmail.com", school_profile(institution="Another School"))
    assert join(other_school, school_team["join_code"]).status_code == 422


def test_full_team_and_pending_invitations(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader, [student(f"m{i}@kiet.edu") for i in range(3)])
    invited = student("invited@kiet.edu")
    leader.post(f"/teams/{team['id']}/invitations", {"email": invited.email})
    # 4 members + 1 pending invitation: the last place is held for the invited student...
    assert "full" in join(student("x@kiet.edu"), team["join_code"]).json()["detail"]
    # ...who can also take it with the code, which accepts their invitation.
    assert join(invited, team["join_code"]).status_code == 200
    final = leader.get("/me/team").json()
    assert len(final["members"]) == 5 and final["invitations"] == []


def test_joining_declines_other_invitations(student, team_of):
    a, b, joiner = student("a@kiet.edu"), student("b@kiet.edu"), student("c@kiet.edu")
    team_a, team_b = team_of(a, name="Alpha"), team_of(b, name="Beta")
    a.post(f"/teams/{team_a['id']}/invitations", {"email": joiner.email})
    assert join(joiner, team_b["join_code"]).status_code == 200
    assert a.get("/me/team").json()["invitations"] == []


def test_submitted_team_cannot_be_joined(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader, [student("b@kiet.edu")])
    leader.post(f"/teams/{team['id']}/submit")
    assert "no longer accepting" in join(student("c@kiet.edu"), team["join_code"]).json()["detail"]


def test_leader_resets_code(student, team_of):
    leader, member = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader, [member])
    old = team["join_code"]
    assert member.post(f"/teams/{team['id']}/join-code/reset").status_code == 403
    new = leader.post(f"/teams/{team['id']}/join-code/reset").json()["join_code"]
    assert new != old
    assert join(student("c@kiet.edu"), old).status_code == 404
    assert join(student("d@kiet.edu"), new).status_code == 200


def test_join_code_only_visible_to_members(student, team_of):
    leader, invitee = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader)
    leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email})
    invitation = invitee.get("/me/invitations").json()[0]
    assert "join_code" not in invitation


def test_join_after_registration_closes(student, team_of, settings):
    team = team_of(student("a@kiet.edu"))
    joiner = student("b@kiet.edu")
    settings.force_registration_open = False
    settings.registration_opens = datetime.now(UTC) - timedelta(days=10)
    settings.registration_closes = datetime.now(UTC) - timedelta(minutes=1)
    assert join(joiner, team["join_code"]).status_code == 403
