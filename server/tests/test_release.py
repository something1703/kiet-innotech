"""Releasing the department results: winners from the rankings, certificates for those marked present, and the edge cases."""

import pymupdf
from test_admin import world  # noqa: F401  (fixture)
from test_certificates import AFTER, mark_present, release_department, upload
from test_judging import FULL, judging, score, set_room  # noqa: F401  (fixture)

from app.services import judging as judging_service


def open_round(j):
    assert j["root"].post("/admin/judging/department/open").status_code == 200


def score_both(j, key, parts=FULL):
    for judge in ("it_prof", "cse_prof"):
        assert score(j[judge], j["room"], j["teams"][key], parts).status_code == 200


release = release_department


def cards(api):
    return api.get("/me/results").json()["cards"]


def certs(api):
    body = api.get("/me/certificates").json()
    return [c["type"] for c in body["certificates"]], body["message"]


def all_templates(root):
    for cert_type in ("dept_participation", "dept_winner", "dept_judge"):
        upload(root, cert_type)


def pdf_text(response):
    with pymupdf.open(stream=response.content, filetype="pdf") as doc:
        return doc[0].get_text()


def test_nothing_changes_until_the_button_is_pressed(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    score_both(judging, "cse_a")
    a = as_user("a@kiet.edu")
    mark_present(root, "a@kiet.edu", a)
    # Scored and ranked, templates published, attendance marked: students still see nothing about results or certificates.
    assert [c["status"] for c in cards(a)] == ["awaiting"]
    assert certs(a)[0] == [] and "release" in certs(a)[1]
    assert judging["it_prof"].get("/judge/certificates").json()["certificates"][0]["available"] is False
    # Only a super admin sees the screen or presses the button.
    assert judging["cse"].get("/admin/judging/department/release").status_code == 403
    assert release(judging["cse"]).status_code == 403


def test_release_names_winners_and_opens_the_right_certificates(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    score_both(judging, "cse_a", FULL)  # 50: 1st
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])  # 40: 2nd, but CSE has two places in PS 1
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])  # 30: not a winner
    a, b, c, d, e = (as_user(f"{x}@kiet.edu") for x in "abcde")
    for api, email in ((a, "a"), (c, "c"), (e, "e")):
        mark_present(root, f"{email}@kiet.edu", api)  # b, d, f were never marked
    # Rooms are still open at this moment: the button refuses, with the reason.
    blocked = release(root)
    assert blocked.status_code == 409 and "still open" in blocked.json()["detail"]
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)

    preview = root.get("/admin/judging/department/release").json()
    cse1 = next(g for g in preview["groups"] if g["department"] == "CSE" and g["category"] == 1)
    assert [(w["place"], w["team_name"]) for w in cse1["winners"]] == [(1, "CSE Alpha"), (2, "CSE Beta")]
    assert [w["prize"] for w in cse1["winners"]] == [2000, 0]
    assert cse1["tie_at_cut"] is False
    assert (preview["released"], preview["winner_teams"], preview["open_rooms"]) == (False, 2, 0)
    # IT Alpha was never in a room, so it has no group at all; nothing is invented for it.
    assert {(g["department"], g["category"]) for g in preview["groups"]} == {("CSE", 1)}
    assert preview["present"] == 3 and preview["not_marked"] >= 3 and preview["judges"] == 2

    wrong = release(root, confirm="yes")
    assert wrong.status_code == 422
    done = release(root)
    assert done.status_code == 200 and done.json() == {"winners": 2, "groups_without_winner": 0, "declared": 2}
    assert release(root).status_code == 409  # not twice

    # The winning team: the dashboard says so, with the Grand Finale note, and never "not selected".
    won = [x for x in cards(a) if x["status"] == "winner"]
    assert len(won) == 1 and won[0]["place"] == 1 and won[0]["amount"] == 2000 and "Grand Finale details" in won[0]["message"]
    assert {x["status"] for x in cards(a)} == {"winner"} and won[0]["certificate"] == "dept_winner"
    # The 2nd place team: a winner too, no prize amount.
    second = next(x for x in cards(c) if x["status"] == "winner")
    assert second["place"] == 2 and second["amount"] is None and "₹" not in second["message"] and second["certificate"] == "dept_winner"
    # A team that did not win: participation. A student not marked present: no certificate, and told why.
    other = [x for x in cards(e) if x["status"] == "participated"]
    assert len(other) == 1 and other[0]["certificate"] == "dept_participation"
    # No "Grand Finale awaited" for a team that did not win: it is told plainly, and kindly, that it did not.
    assert [x["status"] for x in cards(e)] == ["participated"]
    assert "did not win" in other[0]["title"].lower() or "not among the winners" in other[0]["title"].lower()
    assert "does not go to the Grand Finale" in other[0]["message"] and "ready to download" in other[0]["message"]
    assert not any("awaited" in x["title"].lower() for x in cards(e))
    assert certs(a)[0] == ["dept_winner"] and certs(c)[0] == ["dept_winner"] and certs(e)[0] == ["dept_participation"]
    # Not marked present (b is on the winning team): no certificate, a clear message, and the card does not promise one.
    assert certs(b)[0] == [] and "marked present" in certs(b)[1]
    assert [x["certificate"] for x in cards(b)] == [None]
    assert certs(d)[0] == [] and a.get("/me/certificates/dept_winner.pdf").status_code == 200
    assert b.get("/me/certificates/dept_winner.pdf").status_code == 404
    assert e.get("/me/certificates/dept_winner.pdf").status_code == 404  # the other kind is refused too
    assert a.get("/me/certificates/dept_participation.pdf").status_code == 404  # winners get the winner one only
    # The winner certificate carries the student's own name and the place (the sample template has one name box).
    assert "Test Student" in pdf_text(a.get("/me/certificates/dept_winner.pdf"))

    # Judges: both scored, so both get one. The winners are on the leaderboard and the rankings with who named them.
    for judge in ("it_prof", "cse_prof"):
        assert judging[judge].get("/judge/certificates").json()["certificates"][0]["available"] is True
        assert judging[judge].get("/judge/certificates/dept_judge.pdf").status_code == 200
    assert judging["external"].get("/judge/certificates").json()["certificates"][0]["available"] is False
    assert judging["external"].get("/judge/certificates/dept_judge.pdf").status_code == 404
    group = root.get("/admin/judging/department/rankings").json()["groups"][0]
    assert {t["team"]["name"]: t["award"]["declared_by"] for t in group["teams"] if t["award"]} == {
        "CSE Alpha": "release:root@kiet.edu",
        "CSE Beta": "release:root@kiet.edu",
    }
    # The legacy "withdraw winners" button cannot half-undo the release.
    assert root.post("/admin/judging/department/awards/withdraw").status_code == 409


def test_a_problem_statement_nobody_finished_has_no_winner(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    # Only one of the two judges scores a team: it is never complete, so it cannot be ranked or win.
    assert score(judging["it_prof"], judging["room"], judging["teams"]["cse_a"], FULL).status_code == 200
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    preview = root.get("/admin/judging/department/release").json()
    group = preview["groups"][0]
    assert group["winners"] == [] and "scored by all the judges" in group["reason"] and group["not_ranked"] == 3
    assert preview["groups_without_winner"] == 1
    assert release(root).status_code == 409  # nothing to release at all
    assert not root.get("/admin/judging/department/release").json()["released"]


def test_a_problem_statement_where_everyone_was_absent_has_no_winner(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    teams = judging["teams"]
    for key in ("cse_a", "cse_b", "cse_c"):
        score_both(judging, key)
        for member in root.get(f"/admin/teams/{teams[key]['id']}").json()["members"]:
            assert root.put(f"/admin/teams/{teams[key]['id']}/attendance/{member['user_id']}", {"state": "absent"}).status_code == 200
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert group["winners"] == [] and group["reason"] == "Every team in this problem statement was absent."
    assert release(root).status_code == 409


def test_an_absent_team_cannot_take_a_place_from_a_present_one(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    teams = judging["teams"]
    score_both(judging, "cse_a", FULL)  # the best marks, but every member absent
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    for member in root.get(f"/admin/teams/{teams['cse_a']['id']}").json()["members"]:
        root.put(f"/admin/teams/{teams['cse_a']['id']}/attendance/{member['user_id']}", {"state": "absent"})
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert [(w["place"], w["team_name"]) for w in group["winners"]] == [(1, "CSE Beta")]
    assert release(root).status_code == 200
    assert certs(as_user("a@kiet.edu"))[0] == []  # absent, on a team that did not win
    assert certs(as_user("c@kiet.edu"))[0] == []  # winner, but not marked present


def test_winners_declared_by_hand_are_kept_and_withdrawing_takes_back_only_the_release(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    teams = judging["teams"]
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    # A department admin decides a tie by hand: Beta is 1st, whatever the marks say.
    assert root.post("/admin/judging/department/awards", {"team_id": teams["cse_b"]["id"], "place": 1}).status_code == 204
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert group["declared_by_hand"] is True and [w["team_name"] for w in group["winners"]] == ["CSE Beta"]
    assert release(root).json()["declared"] == 0
    c = as_user("c@kiet.edu")
    mark_present(root, "c@kiet.edu", c)
    assert certs(c)[0] == ["dept_winner"]
    # Withdrawing hides everything again; the by-hand winner stays declared.
    assert root.post("/admin/judging/department/release/withdraw", {"reason": "x"}).status_code == 422
    assert root.post("/admin/judging/department/release/withdraw", {"reason": "Marks are being rechecked"}).status_code == 204
    assert certs(c)[0] == [] and [x["status"] for x in cards(c)] == ["awaiting"]
    ranked = root.get("/admin/judging/department/rankings").json()
    assert [t["team"]["name"] for t in ranked["groups"][0]["teams"] if t["award"]] == ["CSE Beta"] and not ranked["awards_published"]


def test_templates_must_be_published_and_banned_students_get_nothing(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    a, c = as_user("a@kiet.edu"), as_user("c@kiet.edu")
    for api, email in ((a, "a"), (c, "c")):
        mark_present(root, f"{email}@kiet.edu", api)
    assert release(root).status_code == 200
    ready = root.get("/admin/judging/department/release").json()
    assert ready["templates"] == {"dept_participation": False, "dept_winner": False, "dept_judge": False}
    # Released, but the designs are not published yet: a friendly message, no broken download.
    assert certs(a)[0] == [] and "being prepared" in certs(a)[1]
    assert a.get("/me/certificates/dept_winner.pdf").status_code == 404
    upload(root, "dept_winner")
    assert certs(a)[0] == ["dept_winner"] and certs(c)[0] == ["dept_winner"]
    # Withdrawing one template takes the download away again straight away.
    assert root.put("/admin/certificates/dept_winner/withdraw").status_code == 200
    assert certs(a)[0] == [] and a.get("/me/certificates/dept_winner.pdf").status_code == 404
    upload(root, "dept_winner")
    # A student the organisers banned gets nothing, whatever their team did.
    banned = root.post(f"/admin/students/{c.get('/me/pass').json()['user_id']}/ban", {"reason": "Cheating during the round"})
    assert banned.status_code == 200, banned.text
    # (The API shuts a banned student out of everything, certificates included.)
    assert c.get("/me/certificates").status_code == 403 and c.get("/me/certificates/dept_winner.pdf").status_code == 403
    assert certs(a)[0] == ["dept_winner"]


def test_every_student_sees_a_consistent_picture(judging, as_user, monkeypatch):  # noqa: F811
    """The invariants, for everyone in the fixture, after a release: no contradictions between card, certificate and attendance."""
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])
    present = {"a", "c", "e", "d"}
    for letter in present:
        mark_present(root, f"{letter}@kiet.edu", as_user(f"{letter}@kiet.edu"))
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release(root).status_code == 200
    for letter in "abcdefgh":
        api = as_user(f"{letter}@kiet.edu")
        statuses = {x["status"] for x in cards(api)}
        have, _ = certs(api)
        assert not ({"winner", "not_selected"} <= statuses), letter  # never both
        assert not ({"participated", "winner"} <= statuses), letter
        assert len(have) <= 1, letter  # at most one certificate each
        if have:
            assert letter in present  # only students marked present
        card_cert = [x["certificate"] for x in cards(api) if x["certificate"]]
        assert card_cert == have, letter  # the dashboard offers exactly what the download allows
        for kind in ("dept_winner", "dept_participation"):
            allowed = api.get(f"/me/certificates/{kind}.pdf").status_code == 200
            assert allowed == (kind in have), (letter, kind)


def test_long_names_are_shortened_not_refused(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    tiny = [
        {
            "id": "n",
            "label": "recipient_name",
            "x_pt": 100,
            "y_pt": 200,
            "w_pt": 40,
            "h_pt": 10,
            "font": "Montserrat",
            "fontsize": 30,
            "color": "#000000",
            "align": 1,
            "rotation": 0,
        }
    ]
    upload(root, "dept_participation", tiny)
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])
    e = as_user("e@kiet.edu")
    mark_present(root, "e@kiet.edu", e)
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release(root).status_code == 200
    download = e.get("/me/certificates/dept_participation.pdf")
    assert download.status_code == 200 and download.content.startswith(b"%PDF")


def test_a_tie_at_the_winning_places_is_flagged_before_the_release(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [4, 4, 4, 4, 4, 4, 4, 4, 8])  # level with CSE Beta, the last of the two winning places
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert group["tie_at_cut"] is True
    # The team ranked higher is taken (the lower team number), and an admin can still decide it by hand first.
    assert [(w["place"], w["team_name"]) for w in group["winners"]] == [(1, "CSE Alpha"), (2, "CSE Beta")]
    assert root.post("/admin/judging/department/awards", {"team_id": judging["teams"]["cse_a"]["id"], "place": 1}).status_code == 204
    assert root.get("/admin/judging/department/release").json()["groups"][0]["tie_at_cut"] is False


def test_a_disqualified_or_withdrawn_team_never_takes_a_winning_place(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    teams = judging["teams"]
    score_both(judging, "cse_a", FULL)  # the best marks...
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])
    # ...but the organisers disqualify that team after the judges scored it.
    assert root.post(f"/admin/teams/{teams['cse_a']['id']}/disqualify", {"reason": "Plagiarised project"}).status_code == 200
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert [(w["place"], w["team_name"]) for w in group["winners"]] == [(1, "CSE Beta"), (2, "CSE Gamma")]  # the next teams move up
    assert [w["prize"] for w in group["winners"]] == [2000, 0]
    for letter in "cde":
        mark_present(root, f"{letter}@kiet.edu", as_user(f"{letter}@kiet.edu"))
    assert release(root).status_code == 200
    assert next(x for x in cards(as_user("c@kiet.edu")) if x["status"] == "winner")["place"] == 1
    assert certs(as_user("a@kiet.edu"))[0] == []  # the disqualified team gets nothing
    assert cards(as_user("a@kiet.edu")) == []


def test_a_declared_winner_who_was_disqualified_blocks_the_release(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    teams = judging["teams"]
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    assert root.post("/admin/judging/department/awards", {"team_id": teams["cse_a"]["id"], "place": 1}).status_code == 204
    assert root.post(f"/admin/teams/{teams['cse_a']['id']}/disqualify", {"reason": "Plagiarised project"}).status_code == 200
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert "no longer taking part" in group["blocker"]
    blocked = release(root)
    assert blocked.status_code == 409 and "CSE Alpha" in blocked.json()["detail"]
    # Remove that winner by hand and the release goes ahead with the next teams.
    assert root.delete(f"/admin/judging/department/awards/{teams['cse_a']['id']}").status_code == 204
    assert release(root).status_code == 200


def test_marks_cannot_change_under_released_results_until_they_are_withdrawn(judging, as_user, monkeypatch):  # noqa: F811
    root, room = judging["root"], judging["room"]
    set_room(judging)
    open_round(judging)
    teams = judging["teams"]
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release(root).status_code == 200
    held = "Withdraw the release first"
    # An organiser's correction, a judge's save, unlocking a judge and extending the rooms are all held until it is withdrawn.
    corrected = root.put(
        f"/admin/panels/{room['id']}/teams/{teams['cse_b']['id']}/scores/it.prof@kiet.edu", {"marks": FULL, "reason": "Typo in the sheet"}
    )
    assert corrected.status_code == 409 and held in corrected.json()["detail"]
    assert root.post(f"/admin/panels/{room['id']}/jurors/it.prof@kiet.edu/unlock", {"reason": "Please recheck"}).status_code == 409
    assert root.post(
        "/admin/panels/extend", {"panel_ids": [room["id"]], "until": "2099-01-01T00:00:00+05:30", "reason": "More time"}
    ).status_code in (409, 422)
    assert held in score(judging["it_prof"], room, teams["cse_c"], FULL).json()["detail"]
    # Withdraw, fix, release again: the winners follow the corrected marks.
    assert root.post("/admin/judging/department/release/withdraw", {"reason": "A typo in the marks"}).status_code == 204
    fixed = root.put(
        f"/admin/panels/{room['id']}/teams/{teams['cse_b']['id']}/scores/it.prof@kiet.edu", {"marks": FULL, "reason": "Typo in the sheet"}
    )
    assert fixed.status_code == 200, fixed.text
    assert release(root).status_code == 200


def test_a_department_with_three_winning_places_names_three_winners(judging, as_user, monkeypatch):  # noqa: F811
    """CSE has three places in problem statement 1 this year: 1st, 2nd and 3rd all win, and the 3rd is told so and gets a certificate."""
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    upload(
        root,
        "dept_winner",
        fields=[
            {
                "id": "n",
                "label": "recipient_name",
                "x_pt": 100,
                "y_pt": 200,
                "w_pt": 400,
                "h_pt": 36,
                "font": "Montserrat Bold",
                "fontsize": 23,
            },
            {"id": "p", "label": "place", "x_pt": 100, "y_pt": 260, "w_pt": 400, "h_pt": 36, "font": "Montserrat Bold", "fontsize": 23},
        ],
    )
    quotas = root.put("/admin/finalists/quotas", {"quotas": [{"department": "CSE", "category": 1, "quota": 3}]})
    assert quotas.status_code == 200, quotas.text
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])
    e = as_user("e@kiet.edu")  # CSE Gamma: third
    mark_present(root, "e@kiet.edu", e)
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    group = root.get("/admin/judging/department/release").json()["groups"][0]
    assert group["places"] == 3 and [(w["place"], w["team_name"]) for w in group["winners"]] == [
        (1, "CSE Alpha"),
        (2, "CSE Beta"),
        (3, "CSE Gamma"),
    ]
    assert [w["prize"] for w in group["winners"]] == [2000, 0, 0]
    assert release(root).json()["winners"] == 3
    winner = next(x for x in cards(e) if x["status"] == "winner")
    assert winner["place"] == 3 and "3rd" in winner["message"] and winner["amount"] is None and winner["certificate"] == "dept_winner"
    assert "3rd" in pdf_text(e.get("/me/certificates/dept_winner.pdf"))
    # And the leaderboard-style rankings carry the third place too.
    ranked = root.get("/admin/judging/department/rankings").json()["groups"][0]["teams"]
    assert sorted(t["award"]["place"] for t in ranked if t["award"]) == [1, 2, 3]


def test_a_team_that_did_not_win_is_told_so_and_never_sees_the_finale_awaited(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    set_room(judging)
    open_round(judging)
    all_templates(root)
    score_both(judging, "cse_a", FULL)
    score_both(judging, "cse_b", [4, 4, 4, 4, 4, 4, 4, 4, 8])
    score_both(judging, "cse_c", [3, 3, 3, 3, 3, 3, 3, 3, 6])
    present, absent = as_user("e@kiet.edu"), as_user("f@kiet.edu")  # CSE Gamma: third of two places, so it did not win
    mark_present(root, "e@kiet.edu", present)
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    # Before the release nothing changes for them.
    assert [x["status"] for x in cards(present)] == ["awaiting"]
    assert release(root).status_code == 200
    for who, certificate in ((present, "dept_participation"), (absent, None)):
        shown = cards(who)
        assert [x["status"] for x in shown] == ["participated"] and shown[0]["title"] == "Not among the winners this time"
        assert "did not win Category 1 for CSE" in shown[0]["message"] and "does not go to the Grand Finale" in shown[0]["message"]
        assert shown[0]["certificate"] == certificate
    assert "ready to download" in cards(present)[0]["message"]
    assert "marked present" in cards(absent)[0]["message"]  # told why there is no certificate
    # The winners still see the finale note.
    assert "Grand Finale details" in cards(as_user("a@kiet.edu"))[0]["message"]
