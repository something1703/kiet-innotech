"""Errors returned to the browser as {"detail": "<message the user can act on>"}."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def _field_name(loc: tuple) -> str:
    parts = [str(part) for part in loc if part not in ("body", "query", "path")]
    return parts[-1].replace("_", " ") if parts else "request"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # One readable sentence instead of Pydantic's list, e.g. "phone: Enter a 10-digit Indian mobile number."
        first = exc.errors()[0] if exc.errors() else {"loc": (), "msg": "Invalid request.", "type": ""}
        message = str(first.get("msg", "Invalid request."))
        if first.get("type") == "value_error":
            # Our own validators already write complete sentences.
            detail = message.removeprefix("Value error, ")
        else:
            detail = f"{_field_name(tuple(first.get('loc', ())))}: {message}"
        return JSONResponse({"detail": detail}, status_code=422)

    @app.exception_handler(OperationalError)
    async def database_unavailable(_: Request, exc: OperationalError) -> JSONResponse:
        logger.exception("Database error", exc_info=exc)
        return JSONResponse({"detail": "The service is busy. Please try again in a moment."}, status_code=503)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)
