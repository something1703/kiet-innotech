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
    # Winners are announced for the categories and the schools only: other colleges (and CoE, clubs) take part without places.
    assert "Innovation at Other Colleges" not in groups
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
    # The college team gets the thank-you, never marks or a place.
    college_card = as_user("r@gmail.com").get("/me/results").json()["cards"][0]
    assert college_card["status"] == "participated" and "Better luck next time" in college_card["message"]
    assert "50" not in college_card["message"] and "₹" not in college_card["message"]

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
    # The desk sees where each student is from, to tell the teams apart at a glance.
    assert {(m["participant_type"], m["institution"], m["year"], m["club"]) for m in team["members"]} == {
        ("school", "Delhi Public School", 11, "")
    }

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
    assert "Innovation at Other Colleges" not in preview
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


def octonorm_sheet(rows: list[list[str]]) -> bytes:
    """A small .xlsx shaped like the organisers' octonorm list (sheet "List", inline text cells)."""
    import io
    import zipfile
    from xml.sax.saxutils import escape

    def cell(ref, value):
        if value.isdigit():
            return f'<c r="{ref}"><v>{value}</v></c>'
        return f'<c r="{ref}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'

    body = "".join(
        f'<row r="{i}">' + "".join(cell(f"{chr(66 + j)}{i}", v) for j, v in enumerate(row) if v) + "</row>" for i, row in enumerate(rows, 1)
    )
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("xl/workbook.xml", f'<workbook {ns} {rel}><sheets><sheet name="List" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>',
        )
        z.writestr("xl/worksheets/sheet1.xml", f"<worksheet {ns}><sheetData>{body}</sheetData></worksheet>")
    return out.getvalue()


def test_the_octonorm_list_is_imported_from_the_organisers_sheet(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root = judging["root"]
    a, b, college, school = (teams[k] for k in ("cse_a", "cse_b", "college", "school"))
    sheet = octonorm_sheet(
        [
            ["LIST OF OCTONORMS STALL – INNOTECH’26 GRAND FINALE (30 October 2026)"],
            ["Number", "Organiser", "Desk"],
            ["1", "Innotech 26", "Registration Desk"],
            ["(KIET Departmental Winners)"],
            ["Category 1: Smart Solutions, Smarter Society"],
            ["Number", "University", "Team name & ID"],
            ["3", "KIET - CSE", f"CSE Alpha ({a['code']})"],
            ["4", "KIET - CSE", f"Not The Same Name ({b['code']})"],
            ["5", "KIET - CSE", f"Gamma Squad ({teams['cse_c']['code']})"],
            ["6", "KIET - CSE", f"Totally Different ({teams['school']['code']})"],
            ["Innovation at School"],
            ["Number", "School", "Team No."],
            ["154", "School Teams", "DELHI PUBLIC SCHOOL, Ghaziabad"],
            ["Innovation at Other Colleges"],
            ["Number", "College", "Team No."],
            ["164", "Outside College Teams", "ABES Engineering College"],
            ["165", "Outside College Teams", "Somewhere Else Entirely"],
            ["Reserve / Spare"],
            ["186", "Innotech", "Reserve (KIET team)"],
        ]
    )

    def upload(who, data, name="list.xlsx"):
        return who.client.post(
            "/admin/finale/octonorm-import", headers=who.headers("/admin/finale/octonorm-import"), files={"file": (name, data)}
        )

    assert upload(judging["cse"], sheet).status_code == 403
    assert upload(root, b"not a spreadsheet").status_code == 422
    entries(root, {"team_id": school["id"], "octonorm": "999"})
    preview = upload(root, sheet)
    assert preview.status_code == 200, preview.text
    rows = {r["octonorm"]: r for r in preview.json()["rows"]}
    assert list(rows) == ["3", "4", "5", "6", "154", "164", "165"]  # the desk and the reserve are not team stalls
    assert (rows["3"]["status"], rows["3"]["team"]["id"], rows["3"]["note"]) == ("change", a["id"], None)
    assert rows["4"]["team"]["id"] == b["id"] and "named 'CSE Beta'" in rows["4"]["note"]
    # CSE Gamma was not a finalist: the sheet is wrong or the site is, and the page says so.
    assert rows["5"]["status"] == "not_in_finale"
    # A code whose team fits neither the name nor the category (a typo in the sheet) is offered, never chosen by itself.
    assert (rows["6"]["status"], rows["6"]["team"]) == ("unmatched", None)
    assert [c["team"]["id"] for c in rows["6"]["candidates"]] == [school["id"]] and "check the code" in rows["6"]["note"]
    # Schools and colleges are matched by name; a name that matches nothing is left to choose.
    assert (rows["154"]["status"], rows["154"]["team"]["id"], rows["154"]["current"]) == ("change", school["id"], "999")
    assert rows["164"]["team"]["id"] == college["id"]
    assert rows["165"]["status"] == "unmatched" and rows["165"]["team"] is None
    assert preview.json()["not_in_sheet"] == []

    # Saved through the usual save: afterwards the same sheet shows everything in place. Nothing was saved by the preview.
    assert {t["team"]["id"]: t["octonorm"] for t in root.get("/admin/finale").json()["teams"]}[school["id"]] == "999"
    chosen = [rows[n] for n in ("3", "4", "154", "164")]
    assert entries(root, *({"team_id": r["team"]["id"], "octonorm": r["octonorm"]} for r in chosen)).status_code == 200
    again = {r["octonorm"]: r for r in upload(root, sheet).json()["rows"]}
    assert [again[n]["status"] for n in ("3", "4", "154", "164")] == ["same"] * 4


def test_a_club_team_is_matched_by_its_clubs_name_and_the_project(student, team_of):
    from sqlalchemy import select
    from test_startups_clubs import club_profile

    from app.db import get_sessionmaker
    from app.models import Team
    from app.services import octonorm_import, sections

    gdg = team_of(
        student("gdg1@kiet.edu", club_profile(club="Google Developer Group KIET")), [], name="Trust Vault", project_title="TrustVault"
    )
    mythx = team_of(student("myx1@kiet.edu", club_profile(club="MythX")), [], name="Nexus Crew", project_title="MythX Nexus and CyCom")
    with get_sessionmaker()() as db:
        teams = list(db.scalars(select(Team).where(Team.id.in_([gdg["id"], mythx["id"]]))))
        clubs = sections.clubs_of(db, teams)
        by_name = {t.name: t for t in teams}
        assert {str(k): v for k, v in clubs.items()} == {gdg["id"]: "Google Developer Group KIET", mythx["id"]: "MythX"}
        # The team's own institution is just KIET: the club in the sheet's line is what points to the team.
        label = "Google Developer Group KIET – Jeevan – Offline Mesh Network (Team Horizon)"
        assert octonorm_import._score(label, by_name["Trust Vault"], clubs[by_name["Trust Vault"].id]) > octonorm_import._score(
            label, by_name["Nexus Crew"], clubs[by_name["Nexus Crew"].id]
        )
        assert octonorm_import._score("MythX – MythX Nexus and CyCom", by_name["Nexus Crew"], "MythX") >= 50
        assert octonorm_import._score("Nothing alike", by_name["Nexus Crew"], "MythX") == 0


def test_a_super_admin_looks_up_downloads_and_resets_every_login_they_made(world, client):  # noqa: F811
    from test_finale import judge_login

    from app.db import get_sessionmaker
    from app.models import Juror
    from app.services import judge_accounts

    root, cse = world["root"], world["cse"]
    desk = root.post("/admin/admins", {"email": "desk.three@gmail.com", "name": "Desk Three", "role": "desk"}).json()["password"]
    imported = root.post(
        "/admin/jurors/import", {"judges": [{"name": "Arun Mishra", "email": "arun@gmail.com", "organisation": "Adnolgy", "phone": ""}]}
    ).json()["judges"][0]["password"]

    # Only super admins see the list; each login is there with the password it was given.
    assert cse.get("/admin/credentials").status_code == 403
    listed = {c["email"]: c for c in root.get("/admin/credentials").json()}
    assert (listed["desk.three@gmail.com"]["kind"], listed["desk.three@gmail.com"]["password"]) == ("desk", desk)
    assert (listed["arun@gmail.com"]["kind"], listed["arun@gmail.com"]["password"], listed["arun@gmail.com"]["detail"]) == (
        "judge",
        imported,
        "Adnolgy",
    )
    # The database holds the password only sealed, never as it is typed.
    with get_sessionmaker()() as db:
        sealed = db.get(Juror, "arun@gmail.com").password_sealed
        assert sealed and imported not in sealed and judge_accounts.unseal(sealed) == imported

    # A password made before it could be looked up has only its hash: it works, but is not shown until a new one is made.
    with get_sessionmaker()() as db:
        db.get(Juror, "arun@gmail.com").password_sealed = None
        db.commit()
    old = {c["email"]: c for c in root.get("/admin/credentials").json()}["arun@gmail.com"]
    assert (old["password"], old["has_password"]) == (None, True)
    assert judge_login(client, "arun@gmail.com", imported).status_code == 200

    # New passwords in bulk: the old ones stop working, the new ones are listed, unknown accounts are reported.
    bulk = root.post(
        "/admin/credentials/reset",
        {
            "accounts": [
                {"email": "arun@gmail.com", "kind": "judge"},
                {"email": "desk.three@gmail.com", "kind": "desk"},
                {"email": "no@x.in", "kind": "desk"},
            ]
        },
    )
    assert bulk.status_code == 200, bulk.text
    fresh = {c["email"]: c["password"] for c in bulk.json()["credentials"]}
    assert bulk.json()["skipped"] == ["no@x.in"] and all(fresh.values())
    assert judge_login(client, "arun@gmail.com", imported).status_code == 401
    assert judge_login(client, "arun@gmail.com", fresh["arun@gmail.com"]).status_code == 200
    assert judge_login(client, "desk.three@gmail.com", fresh["desk.three@gmail.com"]).status_code == 200
    assert {c["email"]: c["password"] for c in root.get("/admin/credentials").json()}["arun@gmail.com"] == fresh["arun@gmail.com"]
    assert cse.post("/admin/credentials/reset", {"accounts": [{"email": "arun@gmail.com", "kind": "judge"}]}).status_code == 403
    assert "credentials.reset" in {e["action"] for e in root.get("/admin/activity").json()["items"]}

    # Turning a judge's password off removes the sealed copy too.
    assert root.delete("/admin/jurors/arun@gmail.com/password").status_code == 204
    gone = {c["email"]: c for c in root.get("/admin/credentials").json()}["arun@gmail.com"]
    assert (gone["password"], gone["has_password"]) == (None, False)


def test_try_out_marks_are_removed_by_a_super_admin(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, judge = judging["root"], judging["external"]
    a, b = teams["cse_a"], teams["cse_b"]
    panel = finale_panel(judging)
    assert root.post("/admin/judging/final/open").status_code == 200
    assert score(judge, panel, a, FULL).status_code == 200
    assert score(judge, panel, b, LOWER).status_code == 200
    listed = {t["team"]["id"]: t for t in root.get("/admin/finale").json()["teams"]}
    assert (listed[a["id"]]["scores"], listed[a["id"]]["marked_by"]) == (1, ["expert@kiet.edu"])

    # Clearing one team's Grand Finale marks: only super admins; the other team keeps its marks.
    assert judging["cse"].post(f"/admin/finale/teams/{a['id']}/clear-marks").status_code == 403
    cleared = root.post(f"/admin/finale/teams/{a['id']}/clear-marks")
    assert cleared.status_code == 200, cleared.text
    after = {t["team"]["id"]: t for t in cleared.json()["teams"]}
    assert (after[a["id"]]["scores"], after[a["id"]]["marked_by"]) == (0, [])
    assert after[b["id"]]["marked_by"] == ["expert@kiet.edu"]
    page = {t["id"]: t for t in judge.get("/judge").json()["panels"][0]["teams"]}
    assert page[a["id"]]["my_score"] is None and page[b["id"]]["my_score"] is not None
    # Nothing left to clear is fine; a team outside the Grand Finale is not found.
    assert root.post(f"/admin/finale/teams/{a['id']}/clear-marks").status_code == 200
    assert root.post(f"/admin/finale/teams/{teams['cse_c']['id']}/clear-marks").status_code == 404

    # One judge's marks for one team.
    url = f"/admin/panels/{panel['id']}/teams/{b['id']}/scores/expert@kiet.edu"
    assert judging["cse"].delete(url).status_code == 403
    assert root.delete(url).status_code == 204
    assert root.delete(url).status_code == 404
    assert {t["team"]["id"]: t for t in root.get("/admin/finale").json()["teams"]}[b["id"]]["scores"] == 0
    # The judge can mark the team afresh, and every removal is in the activity log.
    assert score(judge, panel, a, LOWER).status_code == 200
    removed = [e for e in root.get("/admin/activity").json()["items"] if e["action"] == "judging.score_removed"]
    assert len(removed) == 2


def test_judges_are_allotted_one_panel_each_over_consecutive_octonorms(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root = judging["root"]
    a, b, college, school = (teams[k] for k in ("cse_a", "cse_b", "college", "school"))
    entries(
        root, {"team_id": a["id"], "octonorm": "4"}, {"team_id": b["id"], "octonorm": "3"}, {"team_id": college["id"], "octonorm": "164"}
    )
    judges = [{"name": f"Judge {n}", "email": f"judge{n}@gmail.com", "organisation": "", "phone": ""} for n in (1, 2, 3)]
    assert root.post("/admin/jurors/import", {"judges": judges}).status_code == 200
    emails = [j["email"] for j in judges]
    body = {"judges": emails[:2], "sections": ["category", "school", "college"]}

    # Super admins only; the plan saves nothing. Lowest octonorms to the first judge; a team without an octonorm is listed.
    assert judging["cse"].post("/admin/finale/allot", body).status_code == 403
    plan = root.post("/admin/finale/allot", body)
    assert plan.status_code == 200, plan.text
    assert [(p["name"], p["juror_email"], p["teams"]) for p in plan.json()["panels"]] == [
        ("Panel 1 · Octonorms 3-4", "judge1@gmail.com", 2),
        ("Panel 2 · Octonorm 164", "judge2@gmail.com", 1),
    ]
    assert plan.json()["no_octonorm"] == [school["code"]] and plan.json()["applied"] is False
    assert {t["panel"] for t in root.get("/admin/finale").json()["teams"]} == {None}

    # Too many judges for the teams, unknown judges, a judge listed twice: refused.
    assert root.post("/admin/finale/allot", {**body, "judges": emails, "sections": ["college"]}).status_code == 422
    assert root.post("/admin/finale/allot", {**body, "judges": ["nobody@x.in"]}).status_code == 422
    assert root.post("/admin/finale/allot", {**body, "judges": [emails[0], emails[0]]}).status_code == 422

    done = root.post("/admin/finale/allot", {**body, "apply": True})
    assert done.status_code == 200 and done.json()["applied"] is True
    listed = {t["team"]["id"]: t["panel"] for t in root.get("/admin/finale").json()["teams"]}
    assert listed[a["id"]] == listed[b["id"]] == "Panel 1 · Octonorms 3-4" and listed[college["id"]] == "Panel 2 · Octonorm 164"
    logins = {c["email"]: c["panels"] for c in root.get("/admin/credentials").json()}
    assert logins["judge1@gmail.com"] == ["Panel 1 · Octonorms 3-4"] and logins["judge3@gmail.com"] == []
    # Allotting again: those judges already sit on a panel, and those teams are already on one.
    again = root.post("/admin/finale/allot", {**body, "apply": True})
    assert again.status_code == 409 and "one panel only" in again.json()["detail"]
    left = root.post("/admin/finale/allot", {"judges": [emails[2]], "sections": ["category", "college"]})
    assert left.status_code == 422 and "Only 0 teams" in left.json()["detail"]


def test_octonorms_are_shared_out_in_order_and_evenly():
    from app.services.finale import split_evenly

    # The real Grand Finale: 134 department winners (3-136), 10 schools, 10 colleges, among 16 judges.
    numbers = [*range(3, 137), *range(154, 174)]
    runs = split_evenly(numbers, 16)
    assert [len(r) for r in runs] == [10] * 10 + [9] * 6
    assert [n for r in runs for n in r] == numbers  # every team once, in order
    assert (runs[0][0], runs[0][-1], runs[-1][0], runs[-1][-1]) == (3, 12, 165, 173)
    assert split_evenly([1, 2, 3], 3) == [[1], [2], [3]]


def test_judges_are_shared_among_venues_in_proportion_to_their_teams():
    from app.services.finale import share_judges
    from app.services.judging import place_label

    # The G Block plan: schools in G-006 (10), Floors 1-5 (20, 18, 23, 23, 25), the badminton court (36), 16 judges.
    assert share_judges([10, 20, 18, 23, 23, 25, 36], 16) == [1, 2, 2, 2, 2, 3, 4]
    assert share_judges([5, 1], 2) == [1, 1] and share_judges([3], 3) == [3]
    assert sum(share_judges([1, 1, 50], 10)) == 10 and share_judges([1, 1, 50], 10)[:2] == [1, 1]
    assert place_label("G Block · Floor 3", "Corridor, Side A, Table 7") == "G Block · Floor 3 · Corridor, Side A, Table 7"
    assert place_label("B Block", "204") == "B Block · Room 204" and place_label("Badminton Court", "") == "Badminton Court"


def test_a_panel_never_spans_two_venues(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root = judging["root"]
    a, b, college, school = (teams[k] for k in ("cse_a", "cse_b", "college", "school"))
    floor, court = "G Block · Floor 1", "Badminton Court"
    entries(
        root,
        {"team_id": a["id"], "octonorm": "F1-01", "building": floor, "room": "Corridor, Side A, Table 1"},
        {"team_id": b["id"], "octonorm": "F1-02", "building": floor, "room": "Corridor, Side A, Table 2"},
        {"team_id": college["id"], "octonorm": "F1-03", "building": floor, "room": "Corridor, Side B, Table 1"},
        {"team_id": school["id"], "octonorm": "BC-01", "building": court},
    )
    judges = [{"name": f"Judge {n}", "email": f"judge{n}@gmail.com", "organisation": "", "phone": ""} for n in (1, 2, 3)]
    assert root.post("/admin/jurors/import", {"judges": judges}).status_code == 200
    body = {"judges": [j["email"] for j in judges], "sections": ["category", "school", "college"]}
    # Three judges: the court (1 team) gets one, Floor 1 (3 teams) two; the court's stall sorts first.
    plan = root.post("/admin/finale/allot", body).json()["panels"]
    assert [(p["name"], p["venue"], p["teams"]) for p in plan] == [
        ("Badminton Court · Panel 1 · BC-01", court, 1),
        ("G Block · Floor 1 · Panel 2 · F1-01 to F1-02", floor, 2),
        ("G Block · Floor 1 · Panel 3 · F1-03", floor, 1),
    ]
    # Fewer judges than venues: refused (a judge sits in one venue only).
    assert root.post("/admin/finale/allot", {**body, "judges": body["judges"][:1]}).status_code == 422
    assert root.post("/admin/finale/allot", {**body, "apply": True}).status_code == 200
    listed = {t["team"]["id"]: t["panel"] for t in root.get("/admin/finale").json()["teams"]}
    assert listed[a["id"]] == "G Block · Floor 1 · Panel 2 · F1-01 to F1-02" and listed[school["id"]] == "Badminton Court · Panel 1 · BC-01"


def test_a_judge_scores_a_team_that_is_not_in_their_room(judging, settings):  # noqa: F811
    teams = finale_teams(judging, settings)
    root, judge, other = judging["root"], judging["external"], judging["cse_prof"]
    a, b, college, school = (teams[k] for k in ("cse_a", "cse_b", "college", "school"))
    entries(root, {"team_id": college["id"], "octonorm": "F3-21", "building": "G Block · Floor 3", "room": "Corridor, Side B, Table 2"})
    room_a = finale_panel(judging, keys=("cse_a", "cse_b"))  # the external judge
    room_b = root.post("/admin/panels", {"round": "final", "name": "Panel B"}).json()
    assert root.put(f"/admin/panels/{room_b['id']}/teams", {"team_ids": [college["id"]]}).status_code == 200
    assert root.put(f"/admin/panels/{room_b['id']}/jurors", {"jurors": [{"email": "cse.prof@kiet.edu"}]}).status_code == 200
    # (the school is on no panel at all)

    # Every Grand Finale team, for Grand Finale judges only, with its stall, place, panel and section.
    assert judging["it_prof"].get("/judge/finale/teams").status_code == 403
    listed = judge.get("/judge/finale/teams").json()
    found = {t["id"]: t for t in listed["teams"]}
    assert set(found) == {a["id"], b["id"], college["id"], school["id"]} and listed["open"] is False
    assert found[a["id"]]["in_my_panel"] is True and found[college["id"]]["in_my_panel"] is False
    assert (found[college["id"]]["tent"], found[college["id"]]["place"], found[college["id"]]["panel"]) == (
        "F3-21",
        "G Block · Floor 3 · Corridor, Side B, Table 2",
        "Panel B",
    )
    assert found[school["id"]]["panel"] == "" and found[school["id"]]["section"] == "Innovation at School"
    assert found[a["id"]]["section"].startswith("Category 1:") and found[a["id"]]["leader_name"]

    url = lambda team: f"/judge/finale/teams/{team['id']}/score"  # noqa: E731
    assert judge.put(url(college), {"marks": FULL, "remarks": ""}).status_code == 423  # judging not open yet
    assert root.post("/admin/judging/final/open").status_code == 200
    assert judge.put(url(college), {"marks": FULL, "remarks": ""}).status_code == 200
    assert judge.put(url(school), {"marks": LOWER, "remarks": ""}).status_code == 200
    assert judge.put(url(a), {"marks": FULL, "remarks": ""}).status_code == 200  # own room: saved as in the room
    assert judge.get("/judge").json()["panels"][0]["teams"][0]["my_score"]["total"] == 50

    # The room's own judge sees that someone else marked their team (names only, never the marks).
    seen = {t["id"]: t for t in other.get("/judge").json()["panels"][0]["teams"]}
    assert seen[college["id"]]["other_judges"] == ["Industry Judge"]
    # Rankings count every judge: the college and the school (on no panel) are ranked with one mark each.
    groups = {g["label"]: g for g in root.get("/admin/finale/results").json()["groups"]}
    assert [w["team_code"] for w in groups["Best School Project"]["winners"]] == [school["code"]]
    college_row = next(
        t for g in root.get("/admin/judging/final/rankings").json()["groups"] for t in g["teams"] if t["team"]["id"] == college["id"]
    )
    assert college_row["complete"] is True
    # The organisers see the outside mark on the team's own panel, flagged, and a super admin can change it there.
    rooms = {p["id"]: p for p in root.get("/admin/judging/final").json()["panels"]}
    on_b = next(t for t in rooms[room_b["id"]]["teams"] if t["id"] == college["id"])
    assert on_b["scores"] == 1 and [(x["juror_email"], x["total"], x["from_outside"]) for x in on_b["judge_scores"]] == [
        ("expert@kiet.edu", 50, True)
    ]
    fixed = root.put(
        f"/admin/panels/{room_b['id']}/teams/{college['id']}/scores/expert@kiet.edu", {"marks": FULL, "remarks": "checked", "reason": ""}
    )
    assert fixed.status_code == 200, fixed.text
    # The organisers see the outside mark on the team's own panel, flagged, and a super admin can change it there.
    rooms = {p["id"]: p for p in root.get("/admin/judging/final").json()["panels"]}
    on_b = next(t for t in rooms[room_b["id"]]["teams"] if t["id"] == college["id"])
    assert on_b["scores"] == 1 and [(x["juror_email"], x["total"], x["from_outside"]) for x in on_b["judge_scores"]] == [
        ("expert@kiet.edu", 50, True)
    ]
    fixed = root.put(
        f"/admin/panels/{room_b['id']}/teams/{college['id']}/scores/expert@kiet.edu", {"marks": FULL, "remarks": "checked", "reason": ""}
    )
    assert fixed.status_code == 200, fixed.text
    # One judge marks a Grand Finale team: the room's own judge is now refused, from the room or from the search.
    refused = other.put(f"/judge/panels/{room_b['id']}/teams/{college['id']}/score", {"marks": LOWER, "remarks": ""})
    assert refused.status_code == 409 and "already scored by Industry Judge" in refused.json()["detail"]
    assert other.put(url(college), {"marks": LOWER, "remarks": ""}).status_code == 409
    assert other.put(url(school), {"marks": LOWER, "remarks": ""}).status_code == 409
    college_row = next(
        t for g in root.get("/admin/judging/final/rankings").json()["groups"] for t in g["teams"] if t["team"]["id"] == college["id"]
    )
    assert (college_row["scores"], college_row["judges"], college_row["average"], college_row["complete"]) == (1, 1, 50.0, True)
    overview = {t["team"]["id"]: t for t in root.get("/admin/finale").json()["teams"]}
    assert overview[college["id"]]["scores"] == 1 and overview[college["id"]]["marked_by"] == ["expert@kiet.edu"]
    # A super admin can still change any mark (here: enter the room judge's, which replaces nothing of the first judge's).
    assert (
        root.put(
            f"/admin/panels/{room_b['id']}/teams/{college['id']}/scores/cse.prof@kiet.edu", {"marks": LOWER, "remarks": "", "reason": ""}
        ).status_code
        == 200
    )

    # The same rules as in the room: changes need a reason and the organisers' switch; a locked judge cannot score.
    change = {"marks": LOWER, "remarks": "", "edit_reason": "I misread the rubric for ease of use"}
    assert judge.put(url(college), {"marks": LOWER, "remarks": ""}).status_code == 422  # no reason
    assert judge.put(url(college), change).status_code == 200
    assert root.put("/admin/finale/settings", {"judges_can_edit": False}).status_code == 200
    assert judge.put(url(college), {**change, "marks": FULL}).status_code == 409
    assert root.put("/admin/finale/settings", {"judges_can_edit": True}).status_code == 200
    assert judge.post(f"/judge/panels/{room_a['id']}/lock").status_code == 200
    assert judge.put(url(school), {**change, "marks": FULL}).status_code == 409
    assert judge.get("/judge/finale/teams").json()["locked"] is True
    # Every mark is in the activity log, saying it came from outside the judge's room.
    details = [e["detail"] for e in root.get("/admin/activity").json()["items"] if e["action"] == "judging.scored"]
    assert any("outside their room (team on Panel B)" in d for d in details) and any("team on no panel" in d for d in details)
