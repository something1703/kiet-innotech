"""After the Grand Finale: feedback from the thank-you letter, and the Grand Finale certificates."""

from test_admin import publish, world  # noqa: F401  (fixture)
from test_finale_section import FULL, entries, finale_panel, finale_teams
from test_judging import judging, score  # noqa: F401  (fixture)

from conftest import Api


def test_anyone_sends_feedback_and_only_super_admins_read_it(judging, as_user):  # noqa: F811
    client, root = judging["root"].client, judging["root"]
    guest = {
        "name": "  Asha  Verma ",
        "email": "Asha@Example.com",
        "role": "parent",
        "rating": 5,
        "liked": "Wonderful projects!",
        "improve": "More seating",
    }
    assert client.post("/feedback", json=guest).status_code == 204
    # A guest gives a name and a real email; ratings are 1 to 5.
    assert client.post("/feedback", json={**guest, "name": ""}).status_code == 422
    assert client.post("/feedback", json={**guest, "email": "not-an-email"}).status_code == 422
    assert client.post("/feedback", json={**guest, "rating": 0}).status_code == 422
    # A signed-in student: name, email, phone and team come from the account, whatever the form says.
    student = as_user("a@kiet.edu")
    assert (
        student.post(
            "/feedback", {"name": "Someone Else", "email": "x@y.z", "role": "guest", "rating": 4, "liked": "Great day"}
        ).status_code
        == 204
    )

    assert judging["cse"].get("/admin/feedback").status_code == 403
    listed = root.get("/admin/feedback").json()
    assert listed["average"] == 4.5 and listed["ratings"] == {"1": 0, "2": 0, "3": 0, "4": 1, "5": 1}
    by_role = {item["role"]: item for item in listed["items"]}
    assert (by_role["parent"]["name"], by_role["parent"]["email"], by_role["parent"]["signed_in"]) == (
        "Asha Verma",
        "asha@example.com",
        False,
    )
    mine = by_role["student"]
    assert mine["signed_in"] is True and mine["email"] == "a@kiet.edu" and mine["name"] != "Someone Else"
    assert mine["team_code"] == judging["teams"]["cse_a"]["code"] and mine["team_name"]


def test_grand_finale_certificates_go_to_registered_students(judging, settings, as_user):  # noqa: F811
    from app.db import get_sessionmaker
    from app.models import CertificateTemplate

    teams = finale_teams(judging, settings)
    root, judge = judging["root"], judging["external"]
    school = teams["school"]
    entries(root, {"team_id": school["id"], "octonorm": "G6-06"})
    panel = finale_panel(judging)
    assert root.post("/admin/judging/final/open").status_code == 200
    for key in ("cse_a", "cse_b", "school"):
        assert score(judge, panel, teams[key], FULL).status_code == 200

    # The school's leader registers at the desk; the other member does not.
    assert root.post("/admin/admins", {"email": "volunteer@kiet.edu", "name": "Desk Volunteer", "role": "desk"}).status_code == 201
    desk = Api(root.client, "volunteer@kiet.edu")
    team = desk.get("/desk/teams", params={"q": "G6-06"}).json()[0]
    leader = next(m["user_id"] for m in team["members"] if m["role"] == "leader")
    assert desk.put(f"/desk/teams/{school['id']}/registration", {"members": [{"user_id": leader, "present": True}]}).status_code == 200

    k, other = as_user("k@gmail.com"), as_user("l@gmail.com")
    before = k.get("/me/certificates").json()
    assert before["certificates"] == [] and "publish" in before["message"]

    assert root.post("/admin/finale/results/publish", {"confirm": "PUBLISH"}).status_code == 200
    # Published, but the Grand Finale designs are not ready yet.
    assert k.get("/me/certificates").json()["certificates"] == []
    with get_sessionmaker()() as db:
        for kind in ("institute_participation", "institute_winner", "institute_judge"):
            db.add(
                CertificateTemplate(
                    type=kind,
                    scope="institute",
                    kind=kind.split("_")[1],
                    name=kind,
                    pdf_data=b"%PDF",
                    page_width_pt=842,
                    page_height_pt=595,
                    is_published=True,
                )
            )
        db.commit()
    # The school won its section, so its registered student gets the winner certificate; the unregistered one gets none.
    assert [c["type"] for c in k.get("/me/certificates").json()["certificates"]] == ["institute_winner"]
    missing = other.get("/me/certificates").json()
    assert missing["certificates"] == [] and "registered at the Grand Finale desk" in missing["message"]
    assert other.get("/me/certificates/institute_participation.pdf").status_code == 404
    # The winners' card celebrates; nobody sees marks.
    card = next(c for c in k.get("/me/results").json()["cards"] if c["round"] == "final")
    assert card["status"] == "winner" and "Congratulations" in card["message"] and "50" not in card["message"]
    # The judge who marked Grand Finale teams gets the Grand Finale judge certificate.
    assert "institute_judge" in [c["type"] for c in judge.get("/judge/certificates").json()["certificates"] if c["available"]]
