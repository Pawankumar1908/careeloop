import re
import uuid
from datetime import date, datetime, time
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterIn(BaseModel):
    clinic_name: str = Field(min_length=2, max_length=200)
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class AdminClinicCreateIn(BaseModel):
    clinic_name: str = Field(min_length=2, max_length=200)
    admin_name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class ClinicMemberCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    designation: str = Field(min_length=2, max_length=80)
    phone_e164: str = Field(min_length=9, max_length=16, pattern=r"^\+[1-9]\d{7,14}$")
    password: str = Field(min_length=12, max_length=128)


class AppointmentCreateIn(BaseModel):
    patient_id: uuid.UUID
    title: str = Field(min_length=2, max_length=160)
    starts_at: datetime
    notes: str = Field(default="", max_length=2000)
    reminder_minutes_before: int | None = Field(default=None, ge=15, le=10080)


class AppointmentUpdateIn(BaseModel):
    status: str | None = Field(default=None, pattern=r"^(scheduled|confirmed|completed|cancelled)$")
    attendance_status: str | None = Field(default=None, pattern=r"^(unmarked|attended|missed)$")


class AdminClinicOut(BaseModel):
    id: str
    name: str
    timezone: str
    status: str
    created_at: datetime
    admin_name: str
    admin_email: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str | None
    phone_e164: str | None = None
    designation: str | None = None
    role: str
    clinic_id: str | None


class PatientOut(BaseModel):
    id: str
    name: str
    phone_e164: str
    preferred_language: str
    consent_status: str
    is_active: bool

    @field_validator("phone_e164")
    @classmethod
    def phone_shape(cls, value: str) -> str:
        if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
            raise ValueError("Phone must use international E.164 format")
        return value


class WhatsAppConnectIn(BaseModel):
    business_account_id: str = Field(min_length=1, max_length=80, pattern=r"^\d+$")
    phone_number_id: str = Field(min_length=1, max_length=80, pattern=r"^\d+$")
    access_token: str = Field(min_length=20, max_length=4096)


class WhatsAppTestMessageIn(BaseModel):
    to: str = Field(min_length=8, max_length=15, pattern=r"^[1-9]\d{7,14}$")


class MedicationScheduleIn(BaseModel):
    id: uuid.UUID | None = None
    medicine_name: str = Field(min_length=1, max_length=200)
    frequency: str = Field(min_length=1, max_length=80)
    food_timing: str = Field(min_length=1, max_length=80)
    duration_days: int = Field(ge=1, le=365)
    reminder_times: list[str] = Field(min_length=1, max_length=8)
    starts_on: date | None = None

    @field_validator("reminder_times")
    @classmethod
    def validate_times(cls, values: list[str]) -> list[str]:
        for value in values:
            try:
                time.fromisoformat(value)
            except ValueError as exc:
                raise ValueError("Reminder times must use 24-hour HH:MM format") from exc
            if not re.fullmatch(r"\d{2}:\d{2}", value):
                raise ValueError("Reminder times must use 24-hour HH:MM format")
        if len(set(values)) != len(values):
            raise ValueError("Reminder times must be unique")
        return sorted(values)

    @model_validator(mode="after")
    def reminder_count_matches_known_frequency(self):
        counts = {
            "1-0-0": 1, "0-1-0": 1, "0-0-1": 1,
            "1-0-1": 2, "1-1-1": 3, "Twice daily": 2, "Once daily": 1,
        }
        expected = counts.get(self.frequency)
        if expected is not None and len(self.reminder_times) != expected:
            raise ValueError(f"This frequency requires {expected} reminder time(s)")
        return self


class PatientCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = Field(default=None, max_length=32)
    phone_e164: str
    preferred_language: str = Field(default="en", min_length=2, max_length=16)
    consent: bool = False
    medications: list[MedicationScheduleIn] = Field(default_factory=list, max_length=30)

    @field_validator("name")
    @classmethod
    def validate_patient_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Patient name is required")
        return value

    @field_validator("phone_e164")
    @classmethod
    def validate_patient_phone(cls, value: str) -> str:
        if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
            raise ValueError("Phone must use international E.164 format")
        return value
