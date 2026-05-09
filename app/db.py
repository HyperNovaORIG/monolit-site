"""Database setup and models for MonoLit."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)


def _build_engine():
    """Build the SQLAlchemy engine.

    Uses ``DATABASE_URL`` (e.g. Postgres on Neon) when set; otherwise falls
    back to a local SQLite file under ``MONOLIT_DATA_DIR``.
    """
    url = os.environ.get("DATABASE_URL")
    if url:
        # Neon and many providers hand out URLs starting with "postgres://";
        # SQLAlchemy 2.x requires the canonical "postgresql://" scheme.
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        # Force psycopg2 driver to avoid surprises with implicit drivers.
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg2://" + url[len("postgresql://"):]
        return create_engine(url, future=True, pool_pre_ping=True)

    data_dir = Path(os.environ.get("MONOLIT_DATA_DIR", "/data"))
    if not data_dir.exists():
        data_dir = Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "monolit.db"
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    username_lower: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="User", nullable=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ban_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tickets: Mapped[list["SupportTicket"]] = relationship(back_populates="user")


class LauncherState(Base):
    __tablename__ = "launcher_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    online: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    downloads_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status_message: Mapped[str] = mapped_column(String(255), default="All systems operational.", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    author_username: Mapped[str] = mapped_column(String(32), nullable=False)
    author_role: Mapped[str] = mapped_column(String(16), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    author_username: Mapped[str] = mapped_column(String(64), nullable=False)
    contact: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    user: Mapped[User | None] = relationship(back_populates="tickets")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
