"""
Grand Finale sections and the finale's judging switches, kept apart from services/finale.py so judging can use them.

A team's section is what it is ranked in at the Grand Finale: department winners (and KIET wild cards) in their category,
everyone else in their own section. A super admin can move a team to another section (finale_entries.section).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import rules
from ..models import AppState, FinaleEntry, Profile, Team, TeamMember

# Present while a super admin has turned off judges' changes to marks they already saved (Grand Finale only).
JUDGE_EDITS_OFF_KEY = "finale_judge_edits_off"
SECTION_ORDER = ["category", "coe", "club", "college", "startup", "school"]


def default_section(team: Team) -> str:
    if team.participant_type in ("school", "college", "startup"):
        return team.participant_type
    if team.department == rules.CLUB_DEPARTMENT:
        return "coe"
    return "category"


def of_teams(db: Session, teams: list[Team]) -> dict[uuid.UUID, str]:
    """Each team's Grand Finale section: the one a super admin chose, or its own."""
    chosen = (
        dict(
            db.execute(select(FinaleEntry.team_id, FinaleEntry.section).where(FinaleEntry.team_id.in_([t.id for t in teams])))
            .tuples()
            .all()
        )
        if teams
        else {}
    )
    return {t.id: chosen.get(t.id) or default_section(t) for t in teams}


def group_key(section: str, category: int) -> str:
    """The finale rankings group: "category-3" for department winners, "coe-0", "school-0" ... for the other sections."""
    return f"category-{category}" if section == "category" else f"{section}-0"


def judges_can_edit(db: Session) -> bool:
    return db.get(AppState, JUDGE_EDITS_OFF_KEY) is None


def clubs_of(db: Session, teams: list[Team]) -> dict[uuid.UUID, str]:
    """
    The club a COE KIET / technical-club team belongs to: the name its students gave (the most common one, the leader's
    on a tie). Other teams have none. The team's own institution is just "KIET", so this is what tells the clubs apart.
    """
    ids = [t.id for t in teams if t.department == rules.CLUB_DEPARTMENT]
    found: dict[uuid.UUID, list[str]] = {}
    if ids:
        for team_id, club in db.execute(
            select(TeamMember.team_id, Profile.club)
            .join(Profile, Profile.user_id == TeamMember.user_id)
            .where(TeamMember.team_id.in_(ids), Profile.club != "")
            .order_by(TeamMember.role != "leader", TeamMember.joined_at)
        ).tuples():
            found.setdefault(team_id, []).append(club)
    return {team_id: max(names, key=lambda n: names.count(n)) for team_id, names in found.items()}
