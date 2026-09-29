"""
Races that real students will cause: double clicks, two tabs, two teammates acting at once.
Requests run in parallel threads against PostgreSQL; the rules must hold whatever the interleaving.
"""

from concurrent.futures import ThreadPoolExecutor
from functools import partial
from threading import Barrier

from sqlalchemy import func, select

from app.db import get_sessionmaker
from app.models import Team, TeamMember
from conftest import team_input


def parallel(*calls):
    """Runs the calls at the same moment and returns their status codes."""
    barrier = Barrier(len(calls))

    def run(call):
        barrier.wait()
        return call().status_code

    with ThreadPoolExecutor(len(calls)) as pool:
        return list(pool.map(run, calls))


def count(model, *where) -> int:
    with get_sessionmaker()() as db:
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_accepting_two_invitations_at_once_joins_one_team(student, team_of):
    a, b, invitee = student("a@kiet.edu"), student("b@kiet.edu"), student("c@kiet.edu")
    team_a, team_b = team_of(a, name="Alpha"), team_of(b, name="Beta")
    a.post(f"/teams/{team_a['id']}/invitations", {"email": invitee.email})
    b.post(f"/teams/{team_b['id']}/invitations", {"email": invitee.email})
    first, second = (i["id"] for i in invitee.get("/me/invitations").json())

    codes = parallel(lambda: invitee.post(f"/invitations/{first}/accept"), lambda: invitee.post(f"/invitations/{second}/accept"))
    assert sorted(codes)[0] == 204 and codes.count(204) == 1
    assert count(TeamMember, TeamMember.user_id == invitee.get("/me").json()["profile"]["user_id"]) == 1


def test_double_click_create_team_makes_one_team(student):
    leader = student("a@kiet.edu")
    codes = parallel(*(lambda i=i: leader.post("/teams", team_input(name=f"Team {i}")) for i in range(4)))
    assert codes.count(201) == 1
    assert set(codes) <= {201, 409}
    assert count(Team) == 1


def test_same_team_name_at_once(student):
    leaders = [student(f"l{i}@kiet.edu") for i in range(4)]
    codes = parallel(*(lambda leader=leader: leader.post("/teams", team_input(name="Same Name")) for leader in leaders))
    assert codes.count(201) == 1
    assert codes.count(409) == 3


def test_last_slot_invited_twice_at_once(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader, [student(f"m{i}@kiet.edu") for i in range(3)])
    x, y = student("x@kiet.edu"), student("y@kiet.edu")
    codes = parallel(
        lambda: leader.post(f"/teams/{team['id']}/invitations", {"email": x.email}),
        lambda: leader.post(f"/teams/{team['id']}/invitations", {"email": y.email}),
    )
    assert sorted(codes) == [201, 422]
    final = leader.get("/me/team").json()
    assert len(final["members"]) + len(final["invitations"]) == 5


def test_submit_while_member_leaves(student, team_of):
    for attempt in range(5):
        leader, member = student(f"lead{attempt}@kiet.edu"), student(f"mem{attempt}@kiet.edu")
        team = team_of(leader, [member], name=f"Race {attempt}")
        parallel(partial(leader.post, f"/teams/{team['id']}/submit"), partial(member.post, f"/teams/{team['id']}/leave"))
        final = leader.get("/me/team").json()
        # Either the team was submitted with both members, or the member left and it stayed a draft.
        if final["status"] == "submitted":
            assert len(final["members"]) == 2
        else:
            assert len(final["members"]) == 1


def test_same_invitation_accepted_twice(student, team_of):
    leader, invitee = student("a@kiet.edu"), student("b@kiet.edu")
    team = team_of(leader)
    leader.post(f"/teams/{team['id']}/invitations", {"email": invitee.email})
    invitation = invitee.get("/me/invitations").json()[0]["id"]
    codes = parallel(*(lambda: invitee.post(f"/invitations/{invitation}/accept") for _ in range(3)))
    assert codes.count(204) == 1
    assert len(leader.get("/me/team").json()["members"]) == 2


def test_last_place_taken_with_code_at_once(student, team_of):
    leader = student("a@kiet.edu")
    team = team_of(leader, [student(f"m{i}@kiet.edu") for i in range(3)])
    x, y = student("x@kiet.edu"), student("y@kiet.edu")
    codes = parallel(
        partial(x.post, "/teams/join", {"code": team["join_code"]}), partial(y.post, "/teams/join", {"code": team["join_code"]})
    )
    assert sorted(codes) == [200, 409]
    assert len(leader.get("/me/team").json()["members"]) == 5
