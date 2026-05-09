"""MonoLit FastAPI application."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.db import (
    Announcement,
    LauncherState,
    SessionLocal,
    SupportTicket,
    User,
    init_db,
)
from app.security import (
    COOKIE_NAME,
    TOKEN_TTL_HOURS,
    create_token,
    decode_token,
    get_current_user,
    get_db,
    get_optional_user,
    hash_password,
    require_role,
    verify_password,
)

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
APP_DIR = Path(__file__).resolve().parent
MONOLIT_LITE_JAR = APP_DIR / "MonoLit-Lite-1.0.2A.jar"
FABRIC_JAR = APP_DIR / "fabric-1.21.11.jar"
# Backwards-compat alias used elsewhere.
JAR_PATH = FABRIC_JAR

MAINTENANCE_ALLOWED_PREFIXES = (
    "/api/auth/",
    "/api/admin/",
    "/api/launcher/state",
    "/healthz",
    "/css/",
    "/js/",
    "/img/",
    "/favicon",
)

OWNER_USERNAME = os.environ.get("MONOLIT_OWNER_USERNAME", "pnexn")
OWNER_PASSWORD = os.environ.get("MONOLIT_OWNER_PASSWORD", "MonoLitOwner!2025")


def seed_db() -> None:
    init_db()
    with SessionLocal() as db:
        if db.execute(select(LauncherState).limit(1)).scalar_one_or_none() is None:
            db.add(
                LauncherState(
                    online=True,
                    downloads_enabled=True,
                    status_message="All systems operational. Build something amazing.",
                )
            )
            db.commit()
        owner = (
            db.execute(select(User).where(User.username_lower == OWNER_USERNAME.lower()))
            .scalar_one_or_none()
        )
        if owner is None:
            owner = User(
                username=OWNER_USERNAME,
                username_lower=OWNER_USERNAME.lower(),
                password_hash=hash_password(OWNER_PASSWORD),
                role="Owner",
            )
            db.add(owner)
            db.commit()
        elif owner.role != "Owner":
            owner.role = "Owner"
            db.commit()


limiter = Limiter(key_func=get_remote_address, default_limits=[])
app = FastAPI(title="MonoLit", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _on_startup() -> None:
    seed_db()


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    )
    return response


def _maintenance_active() -> tuple[bool, str]:
    try:
        with SessionLocal() as db:
            state = db.execute(select(LauncherState).limit(1)).scalar_one_or_none()
            if state is None:
                return False, ""
            return bool(state.maintenance_mode), state.maintenance_message or ""
    except Exception:
        return False, ""


def _is_staff(request: Request) -> bool:
    """Best-effort check whether the requester has Dev/Owner role.

    Used to allow admins to keep navigating the site while maintenance is on.
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return False
    try:
        user_id = decode_token(token)
    except Exception:
        return False
    if user_id is None:
        return False
    try:
        with SessionLocal() as db:
            user = db.get(User, int(user_id))
            return user is not None and user.role in {"Dev", "Owner"} and not user.is_banned
    except Exception:
        return False


@app.middleware("http")
async def maintenance_gate(request: Request, call_next):
    path = request.url.path
    if path.startswith(MAINTENANCE_ALLOWED_PREFIXES):
        return await call_next(request)
    active, message = _maintenance_active()
    if not active:
        return await call_next(request)
    if _is_staff(request):
        return await call_next(request)
    page = FRONTEND / "maintenance.html"
    if path.startswith("/api/"):
        return JSONResponse(
            status_code=503,
            content={"detail": message or "Site is under maintenance."},
        )
    if page.exists():
        # Inject the message via simple placeholder substitution.
        html = page.read_text(encoding="utf-8")
        html = html.replace(
            "{{MESSAGE}}",
            (message or "Site maintenance in progress. We'll be back shortly.")
            .replace("<", "&lt;")
            .replace(">", "&gt;"),
        )
        return Response(content=html, media_type="text/html", status_code=503)
    return Response(
        content=message or "Site is under maintenance.",
        media_type="text/plain",
        status_code=503,
    )


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = create_token(user_id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=TOKEN_TTL_HOURS * 3600,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _user_to_out(u: User) -> schemas.UserOut:
    return schemas.UserOut.model_validate(u)


def _user_admin(u: User) -> schemas.UserAdminOut:
    return schemas.UserAdminOut.model_validate(u)


# ---------------- Auth ----------------


@app.post("/api/auth/register", response_model=schemas.UserOut)
@limiter.limit("10/minute")
def register(
    payload: schemas.RegisterIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(User).where(User.username_lower == payload.username.lower())
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username is already taken.")
    user = User(
        username=payload.username,
        username_lower=payload.username.lower(),
        password_hash=hash_password(payload.password),
        role="User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user.id)
    return _user_to_out(user)


@app.post("/api/auth/login", response_model=schemas.UserOut)
@limiter.limit("20/minute")
def login(
    payload: schemas.LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.execute(
        select(User).where(User.username_lower == payload.username.lower())
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password.")
    if user.is_banned:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            user.ban_reason or "Your account has been banned.",
        )
    _set_session_cookie(response, user.id)
    return _user_to_out(user)


@app.post("/api/auth/logout")
def logout(response: Response):
    _clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/me", response_model=schemas.UserOut | None)
def me(user: User | None = Depends(get_optional_user)):
    if user is None or user.is_banned:
        return None
    return _user_to_out(user)


@app.post("/api/auth/change-password")
def change_password(
    payload: schemas.PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


# ---------------- Public state ----------------


@app.get("/api/launcher/state", response_model=schemas.LauncherStateOut)
def get_launcher_state(db: Session = Depends(get_db)):
    state = db.execute(select(LauncherState).limit(1)).scalar_one()
    return schemas.LauncherStateOut.model_validate(state)


@app.get("/api/announcements", response_model=list[schemas.AnnouncementOut])
def list_announcements(db: Session = Depends(get_db)):
    rows = (
        db.execute(select(Announcement).order_by(Announcement.created_at.desc()).limit(50))
        .scalars()
        .all()
    )
    return [schemas.AnnouncementOut.model_validate(a) for a in rows]


# ---------------- Download ----------------


def _download_check(state: LauncherState, user: User | None, *, slot: str) -> None:
    if not state.online:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "MonoLit launcher is currently offline.",
        )
    if not state.downloads_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Downloads are temporarily disabled by an administrator.",
        )
    if slot == "monolit" and not state.monolit_lite_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "MonoLit Lite download is currently disabled.",
        )
    if slot == "fabric" and not state.fabric_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Fabric jar download is currently disabled.",
        )
    if slot == "express" and not state.express_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Express download is currently disabled.",
        )
    if user and user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been banned.")


@app.get("/api/download/monolit")
def download_monolit(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    state = db.execute(select(LauncherState).limit(1)).scalar_one()
    _download_check(state, user, slot="monolit")
    if not MONOLIT_LITE_JAR.exists():
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Build artifact missing.")
    return FileResponse(
        MONOLIT_LITE_JAR,
        media_type="application/java-archive",
        filename="MonoLit-Lite-1.0.2A.jar",
    )


@app.get("/api/download/fabric")
def download_fabric(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    state = db.execute(select(LauncherState).limit(1)).scalar_one()
    _download_check(state, user, slot="fabric")
    if not FABRIC_JAR.exists():
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Build artifact missing.")
    return FileResponse(
        FABRIC_JAR,
        media_type="application/java-archive",
        filename="fabric-1.21.11.jar",
    )


@app.get("/api/download/express/check")
def download_express_check(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Pre-flight check the JS calls before kicking off Express downloads.

    Lets the admin block "express" without disabling individual files, and
    returns a unified error so the UI can show one toast.
    """
    state = db.execute(select(LauncherState).limit(1)).scalar_one()
    _download_check(state, user, slot="express")
    return {"ok": True}


# Backwards-compat: /api/download/lite kept so any old links still work.
@app.get("/api/download/lite")
def download_lite_compat(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    return download_monolit(db=db, user=user)


# ---------------- Support ----------------


@app.post("/api/support", response_model=schemas.TicketOut)
@limiter.limit("5/minute")
def submit_ticket(
    payload: schemas.TicketIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    ticket = SupportTicket(
        user_id=user.id if user else None,
        author_username=user.username if user else "guest",
        contact=payload.contact,
        subject=payload.subject,
        body=payload.body,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return schemas.TicketOut.model_validate(ticket)


@app.get("/api/admin/tickets", response_model=list[schemas.TicketOut])
def list_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Dev", "Owner")),
):
    rows = (
        db.execute(select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(200))
        .scalars()
        .all()
    )
    return [schemas.TicketOut.model_validate(t) for t in rows]


# ---------------- Admin ----------------


@app.get("/api/admin/users", response_model=list[schemas.UserAdminOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Dev", "Owner")),
):
    rows = (
        db.execute(select(User).order_by(User.created_at.desc()).limit(500))
        .scalars()
        .all()
    )
    return [_user_admin(u) for u in rows]


@app.post("/api/admin/users/{user_id}/ban", response_model=schemas.UserAdminOut)
def ban_user(
    user_id: int,
    payload: schemas.BanIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role("Dev", "Owner")),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot ban yourself.")
    if target.role == "Owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owners cannot be banned.")
    if target.role == "Dev" and actor.role != "Owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the Owner can ban a Dev.")
    target.is_banned = bool(payload.banned)
    target.ban_reason = (payload.reason or None) if payload.banned else None
    db.commit()
    db.refresh(target)
    return _user_admin(target)


@app.post("/api/admin/users/{user_id}/role", response_model=schemas.UserAdminOut)
def update_role(
    user_id: int,
    payload: schemas.RoleUpdateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role("Owner")),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.id == actor.id and payload.role != "Owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot demote yourself.")
    target.role = payload.role
    db.commit()
    db.refresh(target)
    return _user_admin(target)


@app.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role("Owner")),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.id == actor.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete yourself.")
    if target.role == "Owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owners cannot be deleted.")
    db.delete(target)
    db.commit()
    return {"ok": True}


@app.post("/api/admin/accounts", response_model=schemas.UserAdminOut)
def create_account(
    payload: schemas.CreateAccountIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Owner")),
):
    if (
        db.execute(select(User).where(User.username_lower == payload.username.lower()))
        .scalar_one_or_none()
        is not None
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username is already taken.")
    user = User(
        username=payload.username,
        username_lower=payload.username.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_admin(user)


@app.post("/api/admin/launcher", response_model=schemas.LauncherStateOut)
def update_launcher(
    payload: schemas.LauncherStateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Dev", "Owner")),
):
    state = db.execute(select(LauncherState).limit(1)).scalar_one()
    if payload.online is not None:
        state.online = payload.online
    if payload.downloads_enabled is not None:
        state.downloads_enabled = payload.downloads_enabled
    if payload.monolit_lite_enabled is not None:
        state.monolit_lite_enabled = payload.monolit_lite_enabled
    if payload.fabric_enabled is not None:
        state.fabric_enabled = payload.fabric_enabled
    if payload.express_enabled is not None:
        state.express_enabled = payload.express_enabled
    if payload.maintenance_mode is not None:
        state.maintenance_mode = payload.maintenance_mode
    if payload.maintenance_message is not None:
        state.maintenance_message = payload.maintenance_message
    if payload.status_message is not None:
        state.status_message = payload.status_message
    db.commit()
    db.refresh(state)
    return schemas.LauncherStateOut.model_validate(state)


@app.post("/api/admin/announce", response_model=schemas.AnnouncementOut)
def create_announcement(
    payload: schemas.AnnouncementIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role("Dev", "Owner")),
):
    a = Announcement(
        author_id=actor.id,
        author_username=actor.username,
        author_role=actor.role,
        body=payload.body,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return schemas.AnnouncementOut.model_validate(a)


@app.delete("/api/admin/announce/{ann_id}")
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Dev", "Owner")),
):
    a = db.get(Announcement, ann_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found.")
    db.delete(a)
    db.commit()
    return {"ok": True}


# ---------------- Static frontend ----------------


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


@app.get("/download", include_in_schema=False)
@app.get("/download/", include_in_schema=False)
def download_page() -> FileResponse:
    return FileResponse(FRONTEND / "download.html")


@app.get("/healthz")
def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


app.mount("/", StaticFiles(directory=str(FRONTEND), html=True), name="frontend")
