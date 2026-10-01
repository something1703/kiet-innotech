"""Every filter, sort and order on the admin lists and exports, alone and combined, must answer (never a 500).

Found the hard way: "In a team" on the Students page crashed the query, and no test exercised it.
"""

import itertools

import pytest

from conftest import college_profile, kiet_profile, school_profile

TEAM_FILTERS = {
    "department": ["CSE", "IT"],
    "category": [1, 5, 8],
    "status": ["draft", "submitted", "withdrawn", "disqualified"],
    "type": ["kiet", "college", "school"],
    "route": ["department", "finale"],
    "q": ["Alpha", "a@kiet.edu", "IT26-0001", "%_\\", "नमस्ते"],
}
TEAM_SORTS = ["code", "name", "category", "department", "status", "members", "submitted_at"]
STUDENT_FILTERS = {
    "department": ["CSE", "IT"],
    "type": ["kiet", "college", "school"],
    "year": [1, 3, 11],
    "in_team": ["yes", "no"],
    "q": ["Test", "a@kiet.edu", "98765", "%_\\", "नमस्ते"],
}
STUDENT_SORTS = ["name", "email", "department", "year", "institution", "created_at"]


@pytest.fixture
def data(as_user, student, team_of):
    root = as_user("root@kiet.edu")
    root.post("/admin/admins", {"email": "cse.admin@kiet.edu", "name": "CSE Admin", "role": "admin", "department": "CSE"})
    a = student("a@kiet.edu")
    team = team_of(a, [student("b@kiet.edu", kiet_profile(department="IT"))], name="Alpha", category=1)
    assert a.post(f"/teams/{team['id']}/submit").status_code == 200
    team_of(student("c@kiet.edu", kiet_profile(year=1)), name="Solo Draft", category=6)
    team_of(student("r@gmail.com", college_profile()), [student("s@gmail.com", college_profile())], name="College", category=8)
    team_of(student("k@gmail.com", school_profile()), name="School", category=5)
    student("lonely@kiet.edu")  # registered, not in a team
    return {"root": root, "cse": as_user("cse.admin@kiet.edu")}


def combinations(filters: dict) -> list[dict]:
    """Each value alone, plus every pair of filters (first value of each), so joins between them are covered."""
    singles = [{key: value} for key, values in filters.items() for value in values]
    pairs = [{a: filters[a][0], b: filters[b][0]} for a, b in itertools.combinations(filters, 2)]
    return [{}, *singles, *pairs, {key: values[0] for key, values in filters.items()}]


@pytest.mark.parametrize("who", ["root", "cse"])
def test_every_team_filter_and_sort_answers(data, who):
    api = data[who]
    for params in combinations(TEAM_FILTERS):
        if who == "cse" and params.get("department") == "IT":
            continue  # a department admin asking for another department is a 403, tested elsewhere
        for sort in TEAM_SORTS:
            for order in ("asc", "desc"):
                query = {**params, "sort": sort, "order": order}
                listed = api.get("/admin/teams", params={**query, "page_size": 100})
                assert listed.status_code in (200, 403), (query, listed.status_code, listed.text[:200])
                if listed.status_code == 200:
                    exported = api.get("/admin/teams/export", params=query)
                    assert exported.status_code == 200, (query, exported.text[:200])
                    assert len(exported.json()) == listed.json()["total"], query


@pytest.mark.parametrize("who", ["root", "cse"])
def test_every_student_filter_and_sort_answers(data, who):
    api = data[who]
    for params in combinations(STUDENT_FILTERS):
        if who == "cse" and params.get("department") == "IT":
            continue
        for sort in STUDENT_SORTS:
            for order in ("asc", "desc"):
                query = {**params, "sort": sort, "order": order}
                listed = api.get("/admin/students", params={**query, "page_size": 100})
                assert listed.status_code in (200, 403), (query, listed.status_code, listed.text[:200])
                if listed.status_code == 200:
                    exported = api.get("/admin/students/export", params=query)
                    assert exported.status_code == 200, (query, exported.text[:200])
                    assert len(exported.json()) == listed.json()["total"], query


def test_in_team_filter_is_correct(data):
    root = data["root"]
    everyone = root.get("/admin/students", params={"page_size": 100}).json()
    in_team = root.get("/admin/students", params={"in_team": "yes", "page_size": 100}).json()
    alone = root.get("/admin/students", params={"in_team": "no", "page_size": 100}).json()
    assert in_team["total"] + alone["total"] == everyone["total"]
    assert all(s["team"] is not None for s in in_team["items"])
    assert all(s["team"] is None for s in alone["items"])
    assert {s["email"] for s in alone["items"]} == {"lonely@kiet.edu"}
    # Combined with a department, a department admin sees only their own students.
    cse_alone = data["cse"].get("/admin/students", params={"in_team": "no"}).json()
    assert {s["email"] for s in cse_alone["items"]} == {"lonely@kiet.edu"}


def test_bad_filter_values_are_rejected_not_crashing(data):
    root = data["root"]
    for path, params in [
        ("/admin/teams", {"category": 0}),
        ("/admin/teams", {"category": "x"}),
        ("/admin/teams", {"status": "bogus"}),
        ("/admin/teams", {"sort": "password"}),
        ("/admin/teams", {"order": "sideways"}),
        ("/admin/teams", {"page": 0}),
        ("/admin/teams", {"page_size": 1000}),
        ("/admin/teams", {"q": "x" * 101}),
        ("/admin/students", {"in_team": "maybe"}),
        ("/admin/students", {"year": 99}),
        ("/admin/students", {"type": "alien"}),
    ]:
        response = root.get(path, params=params)
        assert response.status_code == 422, (path, params, response.status_code)
    assert root.get("/admin/teams", params={"department": "NOPE"}).status_code in (403, 404, 422)
    assert root.get("/admin/teams", params={"page": 9999}).json()["items"] == []
