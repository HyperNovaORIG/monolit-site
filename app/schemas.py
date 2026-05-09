"""Pydantic schemas for the MonoLit API."""
from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,16}$")


class RegisterIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=16)
    password: str = Field(..., min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-16 chars, A-Z, a-z, 0-9, _ only.")
        return v


class LoginIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=256)
    new_password: str = Field(..., min_length=6, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_banned: bool
    created_at: datetime
    last_seen_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserAdminOut(UserOut):
    ban_reason: str | None = None


class LauncherStateOut(BaseModel):
    online: bool
    downloads_enabled: bool
    status_message: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class LauncherStateUpdate(BaseModel):
    online: bool | None = None
    downloads_enabled: bool | None = None
    status_message: str | None = Field(None, max_length=255)


class AnnouncementIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


class AnnouncementOut(BaseModel):
    id: int
    author_username: str
    author_role: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketIn(BaseModel):
    contact: str = Field(..., min_length=3, max_length=255)
    subject: str = Field(..., min_length=3, max_length=120)
    body: str = Field(..., min_length=10, max_length=4000)


class TicketOut(BaseModel):
    id: int
    author_username: str
    contact: str
    subject: str
    body: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleUpdateIn(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        if v not in {"User", "Dev", "Owner"}:
            raise ValueError("Role must be User, Dev, or Owner.")
        return v


class BanIn(BaseModel):
    banned: bool
    reason: str | None = Field(None, max_length=255)


class CreateAccountIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=16)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = "Dev"

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("Username must be 3-16 chars, A-Z, a-z, 0-9, _ only.")
        return v

    @field_validator("role")
    @classmethod
    def _validate_role(cls, v: str) -> str:
        if v not in {"User", "Dev", "Owner"}:
            raise ValueError("Role must be User, Dev, or Owner.")
        return v
