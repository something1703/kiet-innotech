"""Admin panel endpoints. The list matches admin-panel/lib/api/live.ts."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from ..auth import CurrentAdmin
from ..config import Settings, get_settings
from ..db import get_db
from ..schemas import (
    AdminInput,
    AdminOut,
    AdminStudentOut,
    AdminTeamOut,
    AuditOut,
    FinalistBoardOut,
    FinalistSummaryOut,
    NominationsInput,
    PublishOut,
    ReasonInput,
    StatsOut,
    StudentPage,
    TeamPage,
)
from ..services import admin as service
from ..services.admin import StudentFilters, TeamFilters

router = APIRouter(prefix="/admin", tags=["admin"])

Db = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.get("/me")
def me(admin: CurrentAdmin) -> AdminOut:
    return service.admin_out(admin)


@router.get("/stats")
def stats(admin: CurrentAdmin, db: Db) -> StatsOut:
    return service.stats(db, admin)


@router.get("/teams")
def list_teams(admin: CurrentAdmin, db: Db, filters: Annotated[TeamFilters, Query()]) -> TeamPage:
    items, total = service.list_teams(db, admin, filters)
    return TeamPage(items=items, total=total, page=filters.page, page_size=filters.page_size)


@router.get("/teams/export")
def export_teams(admin: CurrentAdmin, db: Db, filters: Annotated[TeamFilters, Query()]) -> list[AdminTeamOut]:
    return service.export_teams(db, admin, filters)


@router.get("/teams/{team_id}")
def get_team(team_id: uuid.UUID, admin: CurrentAdmin, db: Db) -> AdminTeamOut:
    return service.get_team(db, admin, team_id)


@router.post("/teams/{team_id}/withdraw")
def withdraw_team(team_id: uuid.UUID, data: ReasonInput, admin: CurrentAdmin, db: Db) -> AdminTeamOut:
    return service.change_status(db, admin, team_id, "withdraw", data.reason)


@router.post("/teams/{team_id}/disqualify")
def disqualify_team(team_id: uuid.UUID, data: ReasonInput, admin: CurrentAdmin, db: Db) -> AdminTeamOut:
    return service.change_status(db, admin, team_id, "disqualify", data.reason)


@router.post("/teams/{team_id}/restore")
def restore_team(team_id: uuid.UUID, data: ReasonInput, admin: CurrentAdmin, db: Db) -> AdminTeamOut:
    return service.change_status(db, admin, team_id, "restore", data.reason)


@router.get("/students")
def list_students(admin: CurrentAdmin, db: Db, filters: Annotated[StudentFilters, Query()]) -> StudentPage:
    items, total = service.list_students(db, admin, filters)
    return StudentPage(items=items, total=total, page=filters.page, page_size=filters.page_size)


@router.get("/students/export")
def export_students(admin: CurrentAdmin, db: Db, filters: Annotated[StudentFilters, Query()]) -> list[AdminStudentOut]:
    return service.export_students(db, admin, filters)


@router.get("/finalists/summary")
def finalist_summary(admin: CurrentAdmin, db: Db) -> FinalistSummaryOut:
    return service.finalist_summary(db, admin)


@router.get("/finalists")
def finalist_board(admin: CurrentAdmin, db: Db, department: Annotated[str | None, Query(max_length=20)] = None) -> FinalistBoardOut:
    # A department admin can omit the department and gets their own board.
    return service.finalist_board(db, admin, department or admin.department or "")


@router.put("/finalists/{department}")
def save_finalists(
    department: Annotated[str, Path(max_length=20)], data: NominationsInput, admin: CurrentAdmin, db: Db
) -> FinalistBoardOut:
    return service.save_finalists(db, admin, department, data)


@router.post("/results/publish")
def publish_results(admin: CurrentAdmin, db: Db) -> PublishOut:
    return service.publish_results(db, admin)


@router.get("/admins")
def list_admins(admin: CurrentAdmin, db: Db, settings: AppSettings) -> list[AdminOut]:
    return service.list_admins(db, admin, settings)


@router.post("/admins", status_code=status.HTTP_201_CREATED)
def add_admin(data: AdminInput, admin: CurrentAdmin, db: Db, settings: AppSettings) -> AdminOut:
    return service.add_admin(db, admin, data, settings)


@router.delete("/admins/{email}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin(email: Annotated[str, Path(max_length=320)], admin: CurrentAdmin, db: Db, settings: AppSettings) -> Response:
    service.remove_admin(db, admin, email, settings)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/audit")
def audit_log(
    admin: CurrentAdmin,
    db: Db,
    team_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AuditOut]:
    return service.audit_log(db, admin, team_id, limit)
