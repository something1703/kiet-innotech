"""Edge cases found in the pre-launch review: each test pins one fix."""

from app import rules
from conftest import college_profile, kiet_profile, school_profile, team_input
from test_concurrency import parallel


def test_double_clicked_first_profile_save_never_errors(as_user):
    api = as_user("a@kiet.edu")
    codes = parallel(
        lambda: api.put("/me/profile", kiet_profile(roll="2300290100001")),
        lambda: api.put("/me/profile", kiet_profile(roll="2300290100001")),
    )
    assert codes == [200, 200]


def test_join_code_guessing_is_rate_limited(student, team_of):
    team_of(student("lead@kiet.edu"))
    guesser = student("guess@kiet.edu")
    codes = [guesser.post("/teams/join", {"code": "AAAA-AAAA"}).status_code for _ in range(11)]
    assert codes[:10] == [404] * 10
    assert codes[10] == 429


def test_institution_abbreviations_match():
    assert rules.normalise_institution("ABES Engg. College") == rules.normalise_institution("ABES Engineering College")
    assert rules.normalise_institution("Inst. of Tech & Mgmt") == rules.normalise_institution("Institute of Technology and Management")


def test_abbreviated_college_name_can_join(student, team_of):
    lead = student("lead@gmail.com", college_profile("ABES Engineering College"))
    team = team_of(lead)
    mate = student("mate@gmail.com", college_profile("A.B.E.S. Engg College"))
    assert mate.post("/teams/join", {"code": team["join_code"]}).status_code == 200


def test_institution_name_must_have_comparable_letters(as_user):
    response = as_user("a@gmail.com").put("/me/profile", college_profile("केंद्रीय विद्यालय"))
    assert response.status_code == 422
    assert "English letters" in response.json()["detail"]


def test_same_school_name_in_another_city_is_another_school(student, team_of):
    lead = student("lead@gmail.com", school_profile("Delhi Public School"))
    team = team_of(lead, category=5)
    other_city = student("other@gmail.com", {**school_profile("Delhi Public School"), "city": "Meerut"})
    same_city = student("same@gmail.com", school_profile("Delhi Public School"))
    assert other_city.post("/teams/join", {"code": team["join_code"]}).status_code == 422
    assert same_city.post("/teams/join", {"code": team["join_code"]}).status_code == 200


def test_nul_characters_are_rejected_not_500(as_user):
    response = as_user("a@kiet.edu").put("/me/profile", kiet_profile(full_name="Aarav\x00 Sharma"))
    assert response.status_code == 422


def test_team_name_that_grows_when_lowercased(student):
    response = student("a@kiet.edu").post("/teams", team_input(name="İ" * 40))
    assert response.status_code == 422


def test_invalid_invite_email_has_a_readable_message(student, team_of):
    lead = student("lead@kiet.edu")
    team = team_of(lead)
    response = lead.post(f"/teams/{team['id']}/invitations", {"email": "not an email"})
    assert response.status_code == 422
    assert response.json()["detail"] == "Enter a valid email address."


def test_adding_the_same_admin_twice_at_once(as_user):
    root = as_user("root@kiet.edu")
    body = {"email": "hod@kiet.edu", "name": "HOD", "role": "admin", "department": "IT"}
    codes = parallel(lambda: root.post("/admin/admins", body), lambda: root.post("/admin/admins", body))
    assert sorted(codes) == [201, 409]


def test_dotted_initials_match():
    assert rules.normalise_institution("K.I.E.T. Group") == rules.normalise_institution("KIET Group")
