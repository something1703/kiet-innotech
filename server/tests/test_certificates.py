"""Certificate templates, eligibility (including attendance) and downloads."""

from datetime import datetime

import pymupdf
from test_admin import world  # noqa: F401  (fixture)
from test_judging import judging, scored_room  # noqa: F401  (fixture)

from app import rules
from app.services import judging as judging_service

# Every room's time is over by then (the test room's slot ends at 13:00).
AFTER = datetime(2026, 10, 22, 20, 0, tzinfo=rules.IST)


def release_department(root, **extra):
    """The super admin's "Release department results" button."""
    return root.post("/admin/judging/department/release", {"confirm": "RELEASE", **extra})


def sample_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=841.89, height=595.276)
    page.insert_text((50, 50), "Certificate")
    data = doc.tobytes()
    doc.close()
    return data


def upload(admin, cert_type: str = "dept_participation", fields: list | None = None):
    response = admin.client.put(
        f"/admin/certificates/{cert_type}/template",
        headers=admin.admin,
        files={"file": ("template.pdf", sample_pdf(), "application/pdf")},
        data={"name": cert_type.replace("_", " ").title()},
    )
    assert response.status_code == 200, response.text
    body = {
        "fields": fields
        or [
            {
                "id": "name",
                "label": "recipient_name",
                "x_pt": 200,
                "y_pt": 250,
                "w_pt": 440,
                "h_pt": 60,
                "font": "Montserrat",
                "fontsize": 28,
                "color": "#000000",
                "align": 1,
                "rotation": 0,
            }
        ]
    }
    assert admin.put(f"/admin/certificates/{cert_type}/fields", json=body).status_code == 200, response.text
    published = admin.put(f"/admin/certificates/{cert_type}/publish")
    assert published.status_code == 200, published.text
    return published.json()


def mark_present(admin, email: str, api):
    me = api.get("/me/pass").json()
    response = admin.post(
        "/admin/attendance/mark",
        {"user_id": me["user_id"], "round": "department", "note": "Certificate test at the venue"},
    )
    assert response.status_code == 200, response.text


def test_only_present_students_get_a_certificate_after_release(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    e, f = as_user("e@kiet.edu"), as_user("f@kiet.edu")  # CSE Gamma: took part, was not among the winners
    scored_room(judging)
    upload(root)

    # The results are not released yet.
    assert e.get("/me/certificates").json()["certificates"] == []
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release_department(root).status_code == 200

    # Nobody is marked yet: no certificates.
    assert e.get("/me/certificates").json()["certificates"] == []
    assert e.get("/me/certificates/dept_participation.pdf").status_code == 404

    # Only the team member who checked in gets one; their teammate who was not marked does not.
    mark_present(root, "e@kiet.edu", e)
    certificates = e.get("/me/certificates").json()["certificates"]
    assert certificates == [{"type": "dept_participation", "available": True, "reason": None}]
    download = e.get("/me/certificates/dept_participation.pdf")
    assert download.status_code == 200 and download.headers["content-type"] == "application/pdf"
    assert download.content.startswith(b"%PDF")
    with pymupdf.open(stream=download.content, filetype="pdf") as pdf:
        page = pdf[0]
        assert "Test Student" in page.get_text()
        placed = page.search_for("Test Student")[0]
        assert abs(placed.x0 + placed.width / 2 - 420) < 2  # centred in x_pt 200 + w_pt 440
        assert abs(placed.y0 - 250) < 2
    assert f.get("/me/certificates").json()["certificates"] == []
    assert f.get("/me/certificates/dept_participation.pdf").status_code == 404

    # An explicit absence is not presence, even though a row exists.
    f_id = f.get("/me/pass").json()["user_id"]
    team_id = judging["teams"]["cse_c"]["id"]
    assert root.put(f"/admin/teams/{team_id}/attendance/{f_id}", json={"state": "absent"}).status_code == 200
    assert f.get("/me/certificates").json()["certificates"] == []

    # Withdrawing the template takes the certificate away again.
    assert root.put("/admin/certificates/dept_participation/withdraw").status_code == 200
    assert e.get("/me/certificates/dept_participation.pdf").status_code == 404

    # Changing the field source changes the next download.
    upload(
        root,
        fields=[
            {
                "id": "department",
                "label": "department",
                "x_pt": 200,
                "y_pt": 250,
                "w_pt": 440,
                "h_pt": 60,
                "font": "Montserrat",
                "fontsize": 28,
            }
        ],
    )
    with pymupdf.open(stream=e.get("/me/certificates/dept_participation.pdf").content, filetype="pdf") as pdf:
        text = pdf[0].get_text()
        assert "CSE" in text
        assert "Test Student" not in text


def test_winner_certificates_follow_the_release_and_attendance(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    a, c = as_user("a@kiet.edu"), as_user("c@kiet.edu")
    scored_room(judging)  # CSE Alpha 50, CSE Beta 40: CSE has two winning places in problem statement 1
    mark_present(root, "a@kiet.edu", a)
    mark_present(root, "c@kiet.edu", c)
    upload(
        root,
        "dept_winner",
        fields=[
            {
                "id": "name",
                "label": "recipient_name",
                "x_pt": 200,
                "y_pt": 250,
                "w_pt": 440,
                "h_pt": 60,
                "font": "Montserrat",
                "fontsize": 28,
            },
            {"id": "category", "label": "category", "x_pt": 50, "y_pt": 50, "w_pt": 740, "h_pt": 30, "font": "Montserrat", "fontsize": 18},
            {"id": "place", "label": "place", "x_pt": 50, "y_pt": 90, "w_pt": 300, "h_pt": 30, "font": "Montserrat", "fontsize": 18},
        ],
    )

    # Before the release nothing shows, whatever the rankings say.
    assert a.get("/me/certificates").json()["certificates"] == []
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release_department(root).status_code == 200
    assert a.get("/me/certificates").json()["certificates"] == [{"type": "dept_winner", "available": True, "reason": None}]
    assert c.get("/me/certificates").json()["certificates"] == [{"type": "dept_winner", "available": True, "reason": None}]

    # A present member of a winning team who is not the leader also gets one; a member not marked present does not.
    b = as_user("b@kiet.edu")
    assert b.get("/me/certificates").json()["certificates"] == []
    mark_present(root, "b@kiet.edu", b)
    download = b.get("/me/certificates/dept_winner.pdf")
    assert download.status_code == 200
    with pymupdf.open(stream=download.content, filetype="pdf") as pdf:
        text = pdf[0].get_text()
        assert "Smart Solutions, Smarter Society" in text
        assert "1st" in text
    with pymupdf.open(stream=c.get("/me/certificates/dept_winner.pdf").content, filetype="pdf") as pdf:
        assert "2nd" in pdf[0].get_text()


def test_judges_get_a_certificate_only_if_they_judged_and_the_results_are_released(judging, as_user, monkeypatch):  # noqa: F811
    root = judging["root"]
    scored_room(judging)
    it_prof, expert = judging["it_prof"], judging["external"]  # the expert is appointed but sits in no room and scores nothing
    unavailable = [
        {"type": "dept_judge", "available": False, "reason": it_prof.get("/judge/certificates").json()["certificates"][0]["reason"]}
    ]
    assert it_prof.get("/judge/certificates").json()["certificates"] == unavailable
    upload(root, "dept_judge")
    assert it_prof.get("/judge/certificates").json()["certificates"][0]["available"] is False  # published, not released
    monkeypatch.setattr(judging_service, "utcnow", lambda: AFTER)
    assert release_department(root).status_code == 200
    assert it_prof.get("/judge/certificates").json()["certificates"] == [{"type": "dept_judge", "available": True, "reason": None}]
    download = it_prof.get("/judge/certificates/dept_judge.pdf")
    assert download.status_code == 200 and download.content.startswith(b"%PDF")
    with pymupdf.open(stream=download.content, filetype="pdf") as pdf:
        assert "IT Professor" in pdf[0].get_text()
    assert it_prof.get("/judge/certificates/dept_participation.pdf").status_code == 404
    # A judge who judged nothing gets none, and is told so.
    nothing = expert.get("/judge/certificates").json()["certificates"][0]
    assert nothing["available"] is False and "No judging was recorded" in nothing["reason"]
    assert expert.get("/judge/certificates/dept_judge.pdf").status_code == 404


def test_template_upload_validation_and_fonts(world):  # noqa: F811
    root = world["root"]
    bad = root.client.put(
        "/admin/certificates/dept_participation/template",
        headers=root.admin,
        files={"file": ("x.pdf", b"not a pdf", "application/pdf")},
    )
    assert bad.status_code == 400
    too_big = root.client.put(
        "/admin/certificates/dept_participation/template",
        headers=root.admin,
        files={"file": ("x.pdf", b"%PDF" + b"0" * (1024 * 1024), "application/pdf")},
    )
    assert too_big.status_code == 400

    assert root.put("/admin/certificates/dept_winner/publish").status_code == 404
    # The sample renders while the template is still a draft (it is how the designer checks placement).
    draft = root.client.put(
        "/admin/certificates/dept_participation/template",
        headers=root.admin,
        files={"file": ("template.pdf", sample_pdf(), "application/pdf")},
        data={"name": "Draft"},
    )
    assert draft.status_code == 200, draft.text
    sample = root.get("/admin/certificates/dept_participation/sample.pdf")
    assert sample.status_code == 200 and sample.content.startswith(b"%PDF")
    upload(
        root,
        "dept_winner",
        fields=[
            {"id": "category", "label": "category", "x_pt": 50, "y_pt": 50, "w_pt": 740, "h_pt": 30, "font": "Montserrat", "fontsize": 18}
        ],
    )
    winner_sample = root.get("/admin/certificates/dept_winner/sample.pdf")
    assert winner_sample.status_code == 200
    with pymupdf.open(stream=winner_sample.content, filetype="pdf") as pdf:
        assert "Smart Solutions, Smarter Society" in pdf[0].get_text()
    empty = {"fields": []}
    assert root.put("/admin/certificates/dept_winner/fields", json=empty).status_code == 200
    assert root.put("/admin/certificates/dept_winner/publish").status_code == 400

    font = root.client.post(
        "/admin/certificate-fonts",
        headers=root.admin,
        files={"file": ("Custom.ttf", b"\x00\x01\x00\x00", "font/ttf")},
        data={"name": "Custom"},
    )
    assert font.status_code == 201, font.text
    assert any(f["name"] == "Custom" for f in root.get("/admin/certificate-fonts").json())
    custom_field = {
        "id": "name",
        "label": "recipient_name",
        "x_pt": 1,
        "y_pt": 1,
        "w_pt": 100,
        "h_pt": 20,
        "font": "Custom",
    }
    root.put("/admin/certificates/dept_winner/fields", json={"fields": [custom_field]})
    in_use = root.delete(f"/admin/certificate-fonts/{font.json()['id']}")
    assert in_use.status_code == 409 and "used by a certificate" in in_use.json()["detail"]
    root.put("/admin/certificates/dept_winner/fields", json={"fields": []})
    assert root.delete(f"/admin/certificate-fonts/{font.json()['id']}").status_code == 204
    assert root.delete(f"/admin/certificate-fonts/{font.json()['id']}").status_code == 404


def test_names_the_font_cannot_draw_fall_back_instead_of_printing_blanks():
    from app.services import certificates as certs

    assert certs.printable("Ananya Sharma") and certs.printable("José Álvarez-Müller O'Neil") and certs.printable("A. K. Singh")
    assert not certs.printable("आर्यन शर्मा") and not certs.printable("Test 😀")
    # The profile name if it can be drawn, else the account's own name, else what can be drawn of it, else a plain word.
    assert certs.display_name("आर्यन शर्मा", "Aaryan Sharma") == "Aaryan Sharma"
    assert certs.display_name("Aryan शर्मा", "आर्यन") == "Aryan"
    assert certs.display_name("😀") == "Participant" and certs.display_name("") == "Participant"
    assert certs.display_name("  Ananya    Sharma ") == "Ananya Sharma"


def test_a_name_stays_on_one_line_however_long(world, as_user):  # noqa: F811
    from app.db import get_sessionmaker
    from app.services import certificates as certs

    upload(
        world["root"],
        fields=[
            {
                "id": "name",
                "label": "recipient_name",
                "x_pt": 200,
                "y_pt": 250,
                "w_pt": 400,
                "h_pt": 36,
                "font": "Montserrat Bold",
                "fontsize": 23,
            }
        ],
    )
    with get_sessionmaker()() as db:
        for name in (
            "Om Rao",
            "Venkata Satya Narayana Raghavendra Subramanian",
            "Muhammad Abdul Rahman bin Abdullah Al-Hashimi Junior",
            "W" * 70,
        ):
            pdf = certs.render_certificate(db, "dept_participation", {"recipient_name": name})
            with pymupdf.open(stream=pdf, filetype="pdf") as doc:
                lines = [line for block in doc[0].get_text("dict")["blocks"] for line in block.get("lines", [])]
                words = [
                    s for line in lines for s in line["spans"] if s["text"].strip() and s["bbox"][1] > 240
                ]  # below the template's own text
                assert len({round(s["bbox"][1]) for s in words}) == 1, (name, len(lines))  # one line
                assert all(s["bbox"][0] >= 199 and s["bbox"][2] <= 601 for s in words), name  # inside the 400 pt box
