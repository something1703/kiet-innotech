from sqlalchemy.orm import Session

from ..models import AuditEntry, Team


def record(
    db: Session,
    actor_email: str,
    action: str,
    team: Team | None = None,
    detail: str = "",
    department: str | None = None,
    participant_type: str | None = None,
) -> None:
    """Adds an audit entry to the current transaction, so it commits (or rolls back) with the change."""
    db.add(
        AuditEntry(
            actor_email=actor_email,
            action=action,
            team_id=team.id if team else None,
            team_code=team.code if team else None,
            department=team.department if team and team.participant_type == "kiet" else department,
            # Entries about a student (no team) carry their type, so outside admins see those of other colleges and schools.
            participant_type=team.participant_type if team else participant_type,
            detail=detail[:2000],
        )
    )
