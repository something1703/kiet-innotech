"""Errors returned to the browser as {"detail": "<message the user can act on>"}."""

import logging

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

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
    @app.exception_handler(PoolTimeoutError)
    async def database_unavailable(_: Request, exc: Exception) -> JSONResponse:
        # Also raised when every pooled connection is busy for longer than the pool timeout.
        logger.exception("Database unavailable", exc_info=exc)
        return JSONResponse({"detail": "The service is busy. Please try again in a moment."}, status_code=503)

    @app.exception_handler(DataError)
    async def unstorable_input(_: Request, exc: DataError) -> JSONResponse:
        logger.warning("Rejected input the database cannot store: %s", exc.orig)
        return JSONResponse(
            {"detail": "Some of the text contains characters that cannot be saved. Please check it and try again."},
            status_code=422,
        )

    @app.middleware("http")
    async def unexpected(request: Request, call_next) -> Response:
        # A middleware rather than an Exception handler: FastAPI runs that handler outside CORSMiddleware, so the
        # browser would see a CORS failure instead of this message. main.py adds CORS after this, around it.
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled error", exc_info=exc)
            return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)
