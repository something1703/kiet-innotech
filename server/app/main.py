"""FastAPI application: `uvicorn app.main:app`."""

import logging

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import get_settings
from .db import get_engine
from .errors import register_error_handlers
from .routers import admin, auth, dev, public, students


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    production = settings.environment == "production"

    app = FastAPI(
        title="InnoTech26 API",
        version="1.0.0",
        # Interactive docs only outside production.
        docs_url=None if production else "/docs",
        redoc_url=None,
        openapi_url=None if production else "/openapi.json",
    )
    register_error_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        if production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        """For the load balancer: checks the database is reachable."""
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(public.router)
    app.include_router(students.router)
    app.include_router(admin.router)
    if settings.environment == "development" and settings.dev_sign_in:
        app.include_router(dev.router)
    return app


app = create_app()
