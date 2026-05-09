"""Auth/security helpers for MonoLit."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.db import SessionLocal, User, utcnow

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _load_secret() -> str:
    env = os.environ.get("MONOLIT_SECRET")
    if env:
        return env
    secret_file = os.environ.get("MONOLIT_SECRET_FILE", "/data/.monolit-secret")
    from pathlib import Path

    p = Path(secret_file)
    if not p.parent.exists():
        p = Path(__file__).resolve().parent.parent / "data" / ".monolit-secret"
        p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        return p.read_text().strip()
    val = secrets.token_urlsafe(48)
    p.write_text(val)
    try:
        os.chmod(p, 0o600)
    except OSError:
        pass
    return val


SECRET_KEY = _load_secret()
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 24 * 7
COOKIE_NAME = "monolit_session"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(password, hashed)
    except Exception:
        return False


def create_token(user_id: int) -> str:
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(utcnow().timestamp()),
        "exp": int((utcnow() + timedelta(hours=TOKEN_TTL_HOURS)).timestamp()),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user_from_token(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    uid = decode_token(token)
    if uid is None:
        return None
    user = db.get(User, uid)
    if user is None:
        return None
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    token = request.cookies.get(COOKIE_NAME)
    return _user_from_token(token, db)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(COOKIE_NAME)
    user = _user_from_token(token, db)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been banned.")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role.")
        return user

    return dep
