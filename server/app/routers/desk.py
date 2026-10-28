"""The Grand Finale event desk: check-in and food coupons. Super admins and desk volunteers (admin-panel sessions)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from ..auth import DeskAdmin
from ..db import get_db
from ..schemas import (
    CheckInInput,
    CheckOutInput,
    CouponsInput,
    CouponsOut,
    DeskOut,
    DeskTeamOut,
    MealExtraInput,
    MealExtraOut,
    MealInput,
    MealUpdateInput,
    ReasonInput,
)
from ..services import desk

router = APIRouter(prefix="/desk", tags=["desk"])

Db = Annotated[Session, Depends(get_db)]
MealKey = Annotated[str, Path(max_length=40)]


@router.get("")
def overview(admin: DeskAdmin, db: Db) -> DeskOut:
    return desk.overview(db, admin)


@router.get("/teams")
def search(admin: DeskAdmin, db: Db, q: Annotated[str, Query(max_length=100)] = "") -> list[DeskTeamOut]:
    """Grand Finale teams by team code or number, stall, team name, institution, or a member's name, roll number or phone."""
    return desk.search(db, q)


@router.get("/teams/export")
def export(admin: DeskAdmin, db: Db) -> list[DeskTeamOut]:
    """Every Grand Finale team with check-ins and coupons, for the downloads."""
    return desk.all_teams(db)


@router.post("/teams/{team_id}/check-in")
def check_in(team_id: uuid.UUID, data: CheckInInput, admin: DeskAdmin, db: Db) -> DeskTeamOut:
    return desk.check_in(db, admin, team_id, data)


@router.post("/teams/{team_id}/check-out")
def check_out(team_id: uuid.UUID, data: CheckOutInput, admin: DeskAdmin, db: Db) -> DeskTeamOut:
    return desk.check_out(db, admin, team_id, data)


@router.post("/teams/{team_id}/coupons")
def give_coupons(team_id: uuid.UUID, data: CouponsInput, admin: DeskAdmin, db: Db) -> CouponsOut:
    return desk.give_coupons(db, admin, team_id, data)


@router.post("/teams/{team_id}/coupons/{meal}/{user_id}/take-back")
def take_back_coupon(team_id: uuid.UUID, meal: MealKey, user_id: uuid.UUID, data: ReasonInput, admin: DeskAdmin, db: Db) -> DeskTeamOut:
    """Super admin: takes a coupon back, e.g. given by mistake."""
    return desk.take_back_coupon(db, admin, team_id, meal, user_id, data.reason)


@router.post("/extras", status_code=status.HTTP_201_CREATED)
def give_extras(data: MealExtraInput, admin: DeskAdmin, db: Db) -> MealExtraOut:
    return desk.give_extras(db, admin, data)


@router.delete("/extras/{extra_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_extra(extra_id: uuid.UUID, admin: DeskAdmin, db: Db) -> Response:
    desk.remove_extra(db, admin, extra_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/meals", status_code=status.HTTP_201_CREATED)
def add_meal(data: MealInput, admin: DeskAdmin, db: Db) -> DeskOut:
    return desk.add_meal(db, admin, data)


@router.put("/meals/{key}")
def update_meal(key: MealKey, data: MealUpdateInput, admin: DeskAdmin, db: Db) -> DeskOut:
    return desk.update_meal(db, admin, key, data)


@router.delete("/meals/{key}")
def delete_meal(key: MealKey, admin: DeskAdmin, db: Db) -> DeskOut:
    return desk.delete_meal(db, admin, key)
