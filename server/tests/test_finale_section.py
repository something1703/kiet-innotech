"""The Grand Finale section: octonorms and places, sections, the judges' switch, publishing, the registration desk, wild cards."""

from test_admin import publish, world  # noqa: F401  (fixture)
from test_finale import complete_team
from test_judging import FULL, accept_direct, judging, score  # noqa: F401  (fixture)

from conftest import Api

LOWER = [4, 4, 4, 4, 4, 4, 4, 4, 8]


def finale_teams(j, settings):
    """CSE Alpha and CSE Beta are department finalists; ABES (college) and DPS (school) are accepted."""
    accept_direct(j)
    root, teams = j["root"], j["teams"]
    root.put("/admin/finalists/CSE", {"nominations": [{"category": 1, "team_ids": [teams["cse_a"]["id"], teams["cse_b"]["id"]]}]})
    assert publish(root, settings).status_code == 200
    return teams


def entries(root, *items):
    return root.put("/admin/finale/entries", {"entries": [dict(item) for item in items]})


def finale_panel(j, keys=("cse_a", "cse_b", "college", "school")):
    root = j["root"]
    panel = root.post("/admin/panels", {"round": "final", "name": "Panel A"}).json()
    assert root.put(f"/admin/panels/{panel['id']}/teams", {"team_ids": [j["teams"][k]["id"] for k in keys]}).status_code == 200
    assert root.put(f"/admin/panels/{panel['id']}/jurors", {"jurors": [{"email": "expert@kiet.edu", "chair": True}]}).status_code == 200
    return panel


def test_every_finale_team_in_one_list_with_its_octonorm_place_and_section(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, cse = judging["root"], judging["cse"]
    assert cse.get("/admin/finale").status_code == 403
    data = root.get("/admin/finale").json()
    sections = {row["team"]["code"]: row["section"] for row in data["teams"]}
    assert sections == {
        teams["cse_a"]["code"]: "category",
        teams["cse_b"]["code"]: "category",
        teams["college"]["code"]: "college",
        teams["school"]["code"]: "school",
    }
    assert data["judges_can_edit"] is True and data["round_open"] is False and data["published_at"] is None

    a, b, college, school = (teams[k]["id"] for k in ("cse_a", "cse_b", "college", "school"))
    saved = entries(
        root,
        {"team_id": a, "octonorm": "3"},
        {"team_id": b, "octonorm": "4"},
        {"team_id": college, "octonorm": "164", "building": " B   Block ", "room": "204"},
        {"team_id": school, "octonorm": "154"},
    )
    assert saved.status_code == 200, saved.text
    rows = {row["team"]["id"]: row for row in saved.json()["teams"]}
    assert [row["octonorm"] for row in saved.json()["teams"]] == ["3", "4", "154", "164"]  # octonorm order
    assert (rows[college]["building"], rows[college]["room"]) == ("B Block", "204")

    # One octonorm per team; two teams can swap in one save; a room holds several teams.
    assert entries(root, {"team_id": a, "octonorm": "154"}).status_code == 409
    assert entries(root, {"team_id": a, "octonorm": "9"}, {"team_id": b, "octonorm": "9"}).status_code == 422
    swapped = entries(root, {"team_id": a, "octonorm": "4"}, {"team_id": b, "octonorm": "3"}).json()
    assert {row["team"]["id"]: row["octonorm"] for row in swapped["teams"]}[a] == "4"
    assert entries(root, {"team_id": school, "octonorm": "154", "building": "B Block", "room": "204"}).status_code == 200

    # A super admin moves a team to another section, and back.
    moved = entries(root, {"team_id": college, "octonorm": "164", "building": "B Block", "room": "204", "section": "startup"}).json()
    assert {row["team"]["id"]: row["section"] for row in moved["teams"]}[college] == "startup"
    back = entries(root, {"team_id": college, "octonorm": "164", "building": "B Block", "room": "204", "section": None}).json()
    assert {row["team"]["id"]: row["section"] for row in back["teams"]}[college] == "college"
    # Only finale teams.
    assert entries(root, {"team_id": teams["cse_c"]["id"], "octonorm": "50"}).status_code == 422
    assert "finale.entries_saved" in {e["action"] for e in root.get("/admin/activity", params={"kind": "finale"}).json()["items"]}


def test_judging_switches_and_publishing(judging, settings, as_user):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, judge = judging["root"], judging["external"]
    a, b, college = teams["cse_a"], teams["cse_b"], teams["college"]
    entries(root, {"team_id": college["id"], "octonorm": "164", "building": "B Block", "room": "204"})
    panel = finale_panel(judging)

    # Judges sign in and see their teams any time, but score only while a super admin has judging open.
    page = judge.get("/judge").json()["panels"][0]
    assert page["open"] is False and page["edits_allowed"] is True
    assert {t["id"]: t["place"] for t in page["teams"]}[college["id"]] == "B Block · Room 204"
    assert score(judge, panel, a, FULL).status_code == 423
    assert judging["cse"].post("/admin/judging/final/open").status_code == 403
    assert root.post("/admin/judging/final/open").status_code == 200
    assert score(judge, panel, a, FULL).status_code == 200

    # The switch: with it off, judges give new marks but cannot change saved ones.
    assert judging["cse"].put("/admin/finale/settings", {"judges_can_edit": False}).status_code == 403
    assert root.put("/admin/finale/settings", {"judges_can_edit": False}).json()["judges_can_edit"] is False
    assert judge.get("/judge").json()["panels"][0]["edits_allowed"] is False
    change = {"marks": LOWER, "remarks": "", "edit_reason": "I gave the wrong marks for ease of use"}
    refused = judge.put(f"/judge/panels/{panel['id']}/teams/{a['id']}/score", change)
    assert refused.status_code == 409 and "turned off" in refused.json()["detail"]
    assert score(judge, panel, b, LOWER).status_code == 200
    assert root.put("/admin/finale/settings", {"judges_can_edit": True}).status_code == 200
    assert judge.put(f"/judge/panels/{panel['id']}/teams/{a['id']}/score", {**change, "marks": FULL}).status_code == 200
    assert score(judge, panel, college, FULL).status_code == 200

    # The preview: 1st and 2nd of every section; the school has not been scored, so no winner there yet.
    groups = {g["label"]: g for g in root.get("/admin/finale/results").json()["groups"]}
    category = groups["Category 1: Smart Solutions, Smarter Society"]
    assert [(w["place"], w["team_code"], w["amount"]) for w in category["winners"]] == [(1, a["code"], 8000), (2, b["code"], 5000)]
    assert [(w["team_code"], w["amount"]) for w in groups["Innovation at Other Colleges"]["winners"]] == [(college["code"], 0)]
    assert groups["Best School Project"]["winners"] == [] and groups["Best School Project"]["not_ranked"] == 1

    # Publishing: typed phrase, super admins only; judging locks and judges can no longer change anything.
    assert root.post("/admin/finale/results/publish", {"confirm": "yes"}).status_code == 422
    assert judging["cse"].post("/admin/finale/results/publish", {"confirm": "PUBLISH"}).status_code == 403
    done = root.post("/admin/finale/results/publish", {"confirm": "PUBLISH"})
    assert done.status_code == 200 and done.json()["published_at"] and done.json()["round_open"] is False
    assert root.post("/admin/finale/results/publish", {"confirm": "PUBLISH"}).status_code == 409
    assert judge.get("/judge").json()["panels"][0]["locked"] is True
    late = judge.put(f"/judge/panels/{panel['id']}/teams/{b['id']}/score", {**change, "marks": FULL})
    assert late.status_code == 409 and "published" in late.json()["detail"]
    winner = next(c for c in as_user("a@kiet.edu").get("/me/results").json()["cards"] if c["round"] == "final")
    assert (winner["status"], winner["place"], winner["amount"]) == ("winner", 1, 8000)
    college_card = as_user("r@gmail.com").get("/me/results").json()["cards"][0]
    assert college_card["status"] == "winner" and "₹" not in college_card["message"]

    # Only a super admin changes marks now, with no reason asked, and the winners follow at once.
    edited = root.put(f"/admin/panels/{panel['id']}/teams/{b['id']}/scores/expert@kiet.edu", {"marks": FULL, "remarks": "", "reason": ""})
    assert edited.status_code == 200, edited.text
    edited = root.put(f"/admin/panels/{panel['id']}/teams/{a['id']}/scores/expert@kiet.edu", {"marks": LOWER, "remarks": "", "reason": ""})
    assert edited.status_code == 200, edited.text
    category = {g["label"]: g for g in root.get("/admin/finale/results").json()["groups"]}["Category 1: Smart Solutions, Smarter Society"]
    assert [w["team_code"] for w in category["winners"]] == [b["code"], a["code"]]
    assert next(c for c in as_user("c@kiet.edu").get("/me/results").json()["cards"] if c["round"] == "final")["place"] == 1

    # Withdrawing hides the results again and takes back the winners publishing named.
    assert root.post("/admin/finale/results/unpublish", {"reason": ""}).json()["published_at"] is None
    assert next(c for c in as_user("a@kiet.edu").get("/me/results").json()["cards"] if c["round"] == "final")["status"] == "awaiting"


def test_the_registration_desk_registers_students_and_records_id_cards_and_coupons(judging, settings, as_user):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, client = judging["root"], judging["root"].client
    school = teams["school"]
    entries(root, {"team_id": school["id"], "octonorm": "154"})
    assert root.post("/admin/admins", {"email": "volunteer@kiet.edu", "name": "Desk Volunteer", "role": "desk"}).status_code == 201
    desk = Api(client, "volunteer@kiet.edu")
    team = desk.get("/desk/teams", params={"q": "154"}).json()[0]
    leader, member = (m["user_id"] for m in team["members"])
    url = f"/desk/teams/{school['id']}/registration"

    # Before registering, the student is told to register at the desk and sees no octonorm.
    student = as_user("k@gmail.com")
    assert student.get("/me/results").json()["finale"]["octonorm"] is None

    # An absent student gets no ID card or coupon.
    refused = desk.put(url, {"members": [{"user_id": member, "present": False, "coupon": True}]})
    assert refused.status_code == 422 and "not registered" in refused.json()["detail"]
    done = desk.put(
        url, {"members": [{"user_id": leader, "present": True, "id_card": True, "coupon": True}, {"user_id": member, "present": False}]}
    )
    assert done.status_code == 200, done.text
    by_id = {m["user_id"]: m for m in done.json()["members"]}
    assert by_id[leader]["checked_in_by"] == "volunteer@kiet.edu" and by_id[leader]["id_card_at"] and by_id[leader]["coupon_at"]
    assert by_id[member]["checked_in_at"] is None and by_id[member]["coupon_at"] is None
    overview = desk.get("/desk").json()
    assert (overview["students_checked_in"], overview["id_cards"], overview["coupons"]) == (1, 1, 1)

    # Registered: the octonorm shows on the dashboard and the pass; the absent teammate still sees none.
    card = student.get("/me/results").json()["finale"]
    assert (card["registered"], card["octonorm"], card["team_registered"], card["team_members"]) == (True, "154", 1, 2)
    assert [r["tent"] for r in student.get("/me/pass").json()["rounds"] if r["round"] == "final"] == ["154"]
    assert as_user("l@gmail.com").get("/me/results").json()["finale"]["octonorm"] is None

    # No time limit: the desk corrects it whenever needed; off the register means no ID card or coupon on record.
    fixed = desk.put(url, {"members": [{"user_id": leader, "present": True, "id_card": True, "coupon": False}]}).json()
    assert {m["user_id"]: m for m in fixed["members"]}[leader]["coupon_at"] is None
    off = desk.put(url, {"members": [{"user_id": leader, "present": False}]}).json()
    assert {m["user_id"]: m for m in off["members"]}[leader]["id_card_at"] is None
    assert student.get("/me/results").json()["finale"]["registered"] is False
    # Department admins and judges do not use the desk; registration is logged for super admins.
    assert judging["cse"].put(url, {"members": [{"user_id": leader, "present": True}]}).status_code == 403
    assert "desk.registration" in {e["action"] for e in root.get("/admin/activity", params={"kind": "desk"}).json()["items"]}


def test_a_wild_card_team_gets_an_octonorm_and_takes_part(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root = judging["root"]
    entries(root, {"team_id": teams["school"]["id"], "octonorm": "154"})
    clash = root.post("/admin/teams/complete", complete_team(wildcard=True, octonorm="154"))
    assert clash.status_code == 409 and "154" in clash.json()["detail"]
    assert root.get("/admin/students", params={"q": "walkin"}).json()["total"] == 0  # nothing saved

    made = root.post("/admin/teams/complete", complete_team(wildcard=True, octonorm="186", building="Main Lawn"))
    assert made.status_code == 201, made.text
    row = next(r for r in root.get("/admin/finale").json()["teams"] if r["team"]["id"] == made.json()["id"])
    assert (row["wildcard"], row["octonorm"], row["building"], row["section"]) == (True, "186", "Main Lawn", "school")

    # A KIET wild card from a department takes part as a finalist, ranked in its category.
    kiet = complete_team(
        name="Late Lions",
        category=2,
        participant_type="kiet",
        institution="",
        city="",
        members=[
            {
                "email": "late.one@kiet.edu",
                "full_name": "Late One",
                "phone": "9811100011",
                "year": 2,
                "department": "CSE",
                "course": "B.Tech",
                "roll_number": "2400290100901",
            },
            {
                "email": "late.two@kiet.edu",
                "full_name": "Late Two",
                "phone": "9811100012",
                "year": 2,
                "department": "CSE",
                "course": "B.Tech",
                "roll_number": "2400290100902",
            },
        ],
        wildcard=True,
        octonorm="187",
    )
    made = root.post("/admin/teams/complete", kiet)
    assert made.status_code == 201, made.text
    assert made.json()["result"] == "finalist"
    row = next(r for r in root.get("/admin/finale").json()["teams"] if r["team"]["id"] == made.json()["id"])
    assert (row["wildcard"], row["octonorm"], row["section"]) == (True, "187", "category")


def test_level_teams_are_flagged_and_decided_by_hand_even_without_a_cash_prize(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, judge = judging["root"], judging["external"]
    a, b, college, school = (teams[k] for k in ("cse_a", "cse_b", "college", "school"))
    panel = finale_panel(judging)
    assert root.post("/admin/judging/final/open").status_code == 200
    for team in (a, b, college, school):
        assert score(judge, panel, team, LOWER).status_code == 200

    # CSE Alpha and CSE Beta are level on everything: the preview says so instead of quietly splitting them.
    groups = {g["label"]: g for g in root.get("/admin/finale/results").json()["groups"]}
    category = groups["Category 1: Smart Solutions, Smarter Society"]
    assert category["tie_at_cut"] is True and len(category["winners"]) == 2
    # A section without a cash prize still offers 1st and 2nd, so a super admin can declare its places by hand.
    rankings = {g["label"]: g for g in root.get("/admin/judging/final/rankings").json()["groups"]}
    assert [p["place"] for p in rankings["Innovation at Other Colleges"]["prizes"]] == [1, 2]
    assert root.post("/admin/judging/final/awards", {"team_id": college["id"], "place": 1}).status_code == 204
    # The organisers decide the level pair: Beta 1st, Alpha 2nd. Publishing keeps the places declared by hand.
    assert root.post("/admin/judging/final/awards", {"team_id": b["id"], "place": 1}).status_code == 204
    assert root.post("/admin/judging/final/awards", {"team_id": a["id"], "place": 2}).status_code == 204
    preview = {g["label"]: g for g in root.post("/admin/finale/results/publish", {"confirm": "PUBLISH"}).json()["groups"]}
    category = preview["Category 1: Smart Solutions, Smarter Society"]
    assert category["declared_by_hand"] is True
    assert [(w["place"], w["team_code"], w["amount"]) for w in category["winners"]] == [(1, b["code"], 8000), (2, a["code"], 5000)]
    assert [(w["team_code"], w["amount"]) for w in preview["Innovation at Other Colleges"]["winners"]] == [(college["code"], 0)]
    # The school had no hand-declared places, so publishing named its winner from the marks.
    assert [w["team_code"] for w in preview["Best School Project"]["winners"]] == [school["code"]]


def test_registration_desk_volunteers_sign_in_with_email_and_password(world, client):  # noqa: F811
    import re

    from test_finale import bearer, judge_login

    root, cse = world["root"], world["cse"]
    added = root.post("/admin/admins", {"email": "Desk.Two@gmail.com", "name": "Desk Two", "role": "desk"})
    assert added.status_code == 201, added.text
    password = added.json()["password"]
    assert re.fullmatch(r"Desk@\d{5}", password) and added.json()["has_password"] is True
    listed = {a["email"]: a for a in root.get("/admin/admins").json()}
    assert listed["desk.two@gmail.com"]["has_password"] is True and listed["desk.two@gmail.com"]["password"] is None
    # Other organisers get no password: they sign in with Google.
    assert (
        root.post("/admin/admins", {"email": "x.admin@kiet.edu", "name": "X Admin", "role": "admin", "department": "IT"}).json()["password"]
        is None
    )

    assert judge_login(client, "desk.two@gmail.com", "wrong").status_code == 401
    session = judge_login(client, " DESK.two@gmail.com ", password)
    assert session.status_code == 200, session.text
    headers = bearer(session)
    me = client.get("/admin/me", headers=headers).json()
    assert (me["role"], me["judge"]) == ("desk", False)
    # The registration desk only: no organiser, judging or Grand Finale pages.
    assert client.get("/desk", headers=headers).status_code == 200
    for path in ("/admin/teams", "/admin/stats", "/admin/finale", "/judge", "/admin/activity"):
        assert client.get(path, headers=headers).status_code == 403, path

    # A super admin gives a new password; the old one stops working. Only desk volunteers have one.
    assert cse.post("/admin/admins/desk.two@gmail.com/password").status_code == 403
    assert root.post("/admin/admins/cse.admin@kiet.edu/password").status_code == 404
    fresh = root.post("/admin/admins/desk.two@gmail.com/password").json()["password"]
    assert judge_login(client, "desk.two@gmail.com", password).status_code == 401
    assert judge_login(client, "desk.two@gmail.com", fresh).status_code == 200
    # Removed from the admins: the session no longer opens the desk.
    assert root.delete("/admin/admins/desk.two@gmail.com").status_code == 204
    assert client.get("/desk", headers=headers).status_code == 403
