import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def now_utc():
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    platform_admin = "platform_admin"
    clinic_admin = "clinic_admin"
    doctor = "doctor"
    staff = "staff"


class Clinic(Base):
    __tablename__ = "clinics"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    status: Mapped[str] = mapped_column(String(24), default="trial")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    users: Mapped[list["User"]] = relationship(back_populates="clinic")


class User(Base):
    __tablename__ = "clinic_users"
    __table_args__ = (UniqueConstraint("email", name="uq_clinic_user_email"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), default=Role.staff)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    clinic: Mapped[Clinic | None] = relationship(back_populates="users")


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (UniqueConstraint("clinic_id", "phone_e164", name="uq_patient_clinic_phone"), Index("ix_patient_clinic_name", "clinic_id", "name"))
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    phone_e164: Mapped[str] = mapped_column(String(16))
    preferred_language: Mapped[str] = mapped_column(String(16), default="en")
    consent_status: Mapped[str] = mapped_column(String(16), default="unknown")
    consent_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinic_users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class WhatsAppConnection(Base):
    __tablename__ = "whatsapp_connections"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), unique=True)
    business_account_id: Mapped[str] = mapped_column(String(80))
    phone_number_id: Mapped[str] = mapped_column(String(80), unique=True)
    display_phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    verified_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    encrypted_access_token: Mapped[str] = mapped_column(Text)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(200))
    frequency: Mapped[str] = mapped_column(String(80))
    food_timing: Mapped[str] = mapped_column(String(80))
    duration_days: Mapped[int] = mapped_column()
    reminder_times: Mapped[list[str]] = mapped_column(JSON)
    starts_on: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class MedicationReminder(Base):
    __tablename__ = "medication_reminders"
    __table_args__ = (
        UniqueConstraint("schedule_id", "scheduled_for", name="uq_medication_reminder_schedule_time"),
        Index("ix_medication_reminder_due", "status", "scheduled_for"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    schedule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medication_schedules.id", ondelete="CASCADE"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(200))
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    whatsapp_message_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
