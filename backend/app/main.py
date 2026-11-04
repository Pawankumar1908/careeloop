import csv
import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, time, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import jwt
from fastapi import Depends, FastAPI, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import access_token, create_refresh, current_user, hash_password, token_hash, verify_password
from app.config import settings
from app.db import SessionLocal, get_db
from app.models import Clinic, MedicationReminder, MedicationSchedule, Patient, RefreshSession, Role, User, WhatsAppConnection
from app.schemas import AdminClinicCreateIn, MedicationScheduleIn, PatientCreateIn, RegisterIn, WhatsAppConnectIn, WhatsAppTestMessageIn
from app.whatsapp_service import WhatsAppAPIError, decrypt_access_token, encrypt_access_token, get_phone_details, send_medication_reminder, send_test_template

app = FastAPI(title="ClinicCare API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def start_medication_reminder_worker():
    app.state.medication_reminder_worker = asyncio.create_task(_medication_reminder_worker())


@app.on_event("shutdown")
async def stop_medication_reminder_worker():
    worker = getattr(app.state, "medication_reminder_worker", None)
    if worker:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass


@lru_cache(maxsize=1)
def medicine_names() -> tuple[str, ...]:
    dataset = Path(__file__).resolve().parents[1] / "medicines.csv"
    with dataset.open(encoding="utf-8-sig", newline="") as source:
        return tuple(dict.fromkeys(
            row["tablet_name"].strip()
            for row in csv.DictReader(source)
            if row.get("tablet_name") and row["tablet_name"].strip()
        ))


@app.exception_handler(Exception)
async def safe_error(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/webhooks/whatsapp")
def verify_whatsapp_webhook(
    mode: str = Query(alias="hub.mode"),
    verify_token: str = Query(alias="hub.verify_token"),
    challenge: str = Query(alias="hub.challenge"),
):
    if not settings.whatsapp_webhook_verify_token:
        raise HTTPException(503, "WhatsApp webhook verification is not configured")
    if mode != "subscribe" or not hmac.compare_digest(verify_token, settings.whatsapp_webhook_verify_token):
        raise HTTPException(403, "Webhook verification failed")
    return PlainTextResponse(challenge)


@app.post("/api/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.meta_app_secret:
        raise HTTPException(503, "WhatsApp webhook signature validation is not configured")
    raw_body = await request.body()
    supplied_signature = request.headers.get("X-Hub-Signature-256", "")
    digest = hmac.new(settings.meta_app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(supplied_signature, f"sha256={digest}"):
        raise HTTPException(401, "Invalid webhook signature")
    try:
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(400, "Invalid webhook payload")
    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        raise HTTPException(400, "Unexpected webhook object")
    _process_whatsapp_webhook(payload, db)
    db.commit()
    return {"received": True}


def _process_whatsapp_webhook(payload: dict, db: Session):
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_id = value.get("metadata", {}).get("phone_number_id")
            connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.phone_number_id == phone_id)) if phone_id else None
            if not connection:
                continue
            for status_event in value.get("statuses", []):
                reminder = db.scalar(select(MedicationReminder).where(
                    MedicationReminder.whatsapp_message_id == status_event.get("id"),
                    MedicationReminder.clinic_id == connection.clinic_id,
                ))
                if not reminder or reminder.status in {"taken", "not_taken"}:
                    continue
                status = status_event.get("status")
                if status in {"sent", "delivered", "read", "failed"}:
                    if status == "failed" or reminder.status == "pending" or status == "read" or (status == "delivered" and reminder.status == "sent"):
                        reminder.status = status
            for message in value.get("messages", []):
                button = message.get("button", {})
                reply_payload = button.get("payload")
                if not reply_payload:
                    button_reply = message.get("interactive", {}).get("button_reply", {})
                    reply_payload = button_reply.get("id")
                if not isinstance(reply_payload, str) or ":" not in reply_payload:
                    continue
                answer, reminder_text = reply_payload.split(":", 1)
                if answer not in {"taken", "not_taken"}:
                    continue
                try:
                    reminder_id = uuid.UUID(reminder_text)
                except ValueError:
                    continue
                reminder = db.get(MedicationReminder, reminder_id)
                if not reminder or reminder.clinic_id != connection.clinic_id or reminder.status in {"taken", "not_taken"}:
                    continue
                patient = db.get(Patient, reminder.patient_id)
                sender = message.get("from", "")
                if not patient or sender != patient.phone_e164.lstrip("+"):
                    continue
                try:
                    replied_at = datetime.fromtimestamp(int(message.get("timestamp", "0")), timezone.utc)
                except (TypeError, ValueError, OSError):
                    replied_at = datetime.now(timezone.utc)
                reminder.status = answer
                reminder.responded_at = replied_at


@app.get("/api/medicines/search")
def search_medicines(q: str = Query(min_length=2, max_length=100), limit: int = Query(default=10, ge=1, le=20)):
    needle = q.strip().casefold()
    if len(needle) < 2:
        return {"items": []}
    starts_with = []
    contains = []
    for name in medicine_names():
        normalized = name.casefold()
        if normalized.startswith(needle):
            starts_with.append(name)
        elif needle in normalized:
            contains.append(name)
    return {"items": (starts_with + contains)[:limit]}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_platform_admin(user)
    email = str(body.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email is already registered")
    clinic = Clinic(name=body.clinic_name)
    user = User(clinic=clinic, name=body.name, email=email, password_hash=hash_password(body.password), role=Role.clinic_admin)
    db.add(user)
    db.flush()
    refresh = create_refresh(db, user)
    db.commit()
    return {"access_token": access_token(user), "refresh_token": refresh, "token_type": "bearer", "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value, "clinic_id": str(clinic.id)}}


@app.post("/api/auth/login")
def login(username: str = Form(), password: str = Form(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == username.lower()))
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    if user.clinic_id and (clinic := db.get(Clinic, user.clinic_id)) and clinic.status == "suspended":
        raise HTTPException(403, "This clinic account is suspended. Contact platform support.")
    refresh = create_refresh(db, user)
    db.commit()
    return {"access_token": access_token(user), "refresh_token": refresh, "token_type": "bearer", "user": {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value, "clinic_id": str(user.clinic_id) if user.clinic_id else None}}


@app.get("/api/auth/me")
def auth_me(user: User = Depends(current_user)):
    return {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role.value, "clinic_id": str(user.clinic_id) if user.clinic_id else None, "admin_view": bool(getattr(user, "admin_view", False))}


def require_platform_admin(user: User):
    if user.role != Role.platform_admin:
        raise HTTPException(403, "Platform administrator access required")


@app.get("/api/admin/clinics")
def admin_clinics(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_platform_admin(user)
    clinics = db.scalars(select(Clinic).order_by(Clinic.created_at.desc())).all()
    result = []
    for clinic in clinics:
        admin = db.scalar(select(User).where(User.clinic_id == clinic.id, User.role == Role.clinic_admin).order_by(User.created_at).limit(1))
        result.append({"id": str(clinic.id), "name": clinic.name, "timezone": clinic.timezone, "status": clinic.status, "created_at": clinic.created_at, "admin_name": admin.name if admin else "—", "admin_email": admin.email if admin else "—"})
    return result


@app.post("/api/admin/clinics/{clinic_id}/access")
def admin_clinic_access(clinic_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_platform_admin(user)
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    if clinic.status == "suspended":
        raise HTTPException(403, "Reactivate this clinic before opening its workspace")
    return {"access_token": access_token(user, clinic.id), "token_type": "bearer", "clinic_id": str(clinic.id), "clinic_name": clinic.name}


@app.post("/api/admin/clinics", status_code=201)
def admin_create_clinic(body: AdminClinicCreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_platform_admin(user)
    email = str(body.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email is already registered")
    clinic = Clinic(name=body.clinic_name.strip())
    clinic_admin = User(clinic=clinic, name=body.admin_name.strip(), email=email, password_hash=hash_password(body.password), role=Role.clinic_admin)
    db.add_all([clinic, clinic_admin])
    db.commit()
    db.refresh(clinic)
    return {"id": str(clinic.id), "name": clinic.name, "timezone": clinic.timezone, "status": clinic.status, "created_at": clinic.created_at, "admin_name": clinic_admin.name, "admin_email": clinic_admin.email}


@app.patch("/api/admin/clinics/{clinic_id}")
def admin_update_clinic(clinic_id: uuid.UUID, status: str = Query(pattern="^(trial|active|suspended)$"), user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_platform_admin(user)
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(404, "Clinic not found")
    clinic.status = status
    db.commit()
    return {"id": str(clinic.id), "name": clinic.name, "timezone": clinic.timezone, "status": clinic.status}


@app.post("/api/auth/refresh")
def refresh_token(refresh_token: str = Form(), clinic_id: uuid.UUID | None = Form(default=None), db: Session = Depends(get_db)):
    old = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash(refresh_token)))
    now = datetime.now(timezone.utc)
    if not old or old.revoked_at or old.expires_at <= now:
        if old:
            db.query(RefreshSession).filter(RefreshSession.family_id == old.family_id).update({RefreshSession.revoked_at: now})
            db.commit()
        raise HTTPException(401, "Invalid refresh token")
    user = db.get(User, old.user_id)
    if not user or not user.is_active:
        db.query(RefreshSession).filter(RefreshSession.family_id == old.family_id).update({RefreshSession.revoked_at: now})
        db.commit()
        raise HTTPException(401, "Account unavailable")
    if clinic_id is not None:
        if user.role != Role.platform_admin:
            raise HTTPException(403, "Only platform administrators can refresh a clinic-view session")
        clinic = db.get(Clinic, clinic_id)
        if not clinic or clinic.status == "suspended":
            raise HTTPException(403, "Clinic access is unavailable")
    old.revoked_at = now
    rotated = create_refresh(db, user, old.family_id)
    db.commit()
    result = {
        "access_token": access_token(user, clinic_id) if clinic_id is not None else access_token(user),
        "refresh_token": rotated,
        "token_type": "bearer",
    }
    if clinic_id is not None:
        result["platform_access_token"] = access_token(user)
    return result


@app.post("/api/auth/logout", status_code=204)
def logout(refresh_token: str = Form(), db: Session = Depends(get_db)):
    old = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_hash(refresh_token)))
    if old and not old.revoked_at:
        db.query(RefreshSession).filter(RefreshSession.family_id == old.family_id).update({RefreshSession.revoked_at: datetime.now(timezone.utc)})
        db.commit()


@app.get("/api/clinic/me")
def clinic_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == Role.platform_admin or not user.clinic_id:
        raise HTTPException(403, "Clinic context required")
    clinic = db.get(Clinic, user.clinic_id)
    return {"id": str(clinic.id), "name": clinic.name, "timezone": clinic.timezone, "status": clinic.status}


def clinic_admin_id(user: User) -> uuid.UUID:
    if user.role != Role.clinic_admin or not user.clinic_id:
        raise HTTPException(403, "Clinic administrator access required")
    return user.clinic_id


@app.get("/api/clinic/whatsapp")
def whatsapp_connection(user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_admin_id(user)
    connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.clinic_id == clinic_id))
    if not connection:
        return {"connected": False}
    return {
        "connected": True,
        "phone_number_id": connection.phone_number_id,
        "business_account_id": connection.business_account_id,
        "display_phone_number": connection.display_phone_number,
        "verified_name": connection.verified_name,
        "connected_at": connection.connected_at,
    }


@app.put("/api/clinic/whatsapp")
async def connect_whatsapp(body: WhatsAppConnectIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_admin_id(user)
    try:
        encrypted_token = encrypt_access_token(body.access_token)
        details = await get_phone_details(body.phone_number_id, body.access_token)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except WhatsAppAPIError as exc:
        raise HTTPException(400, str(exc))

    connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.clinic_id == clinic_id))
    other_owner = db.scalar(select(WhatsAppConnection).where(
        WhatsAppConnection.phone_number_id == body.phone_number_id,
        WhatsAppConnection.clinic_id != clinic_id,
    ))
    if other_owner:
        raise HTTPException(409, "This WhatsApp phone number is already connected to another clinic")
    if connection:
        connection.business_account_id = body.business_account_id
        connection.phone_number_id = body.phone_number_id
        connection.display_phone_number = details.get("display_phone_number")
        connection.verified_name = details.get("verified_name")
        connection.encrypted_access_token = encrypted_token
    else:
        connection = WhatsAppConnection(
            clinic_id=clinic_id,
            business_account_id=body.business_account_id,
            phone_number_id=body.phone_number_id,
            display_phone_number=details.get("display_phone_number"),
            verified_name=details.get("verified_name"),
            encrypted_access_token=encrypted_token,
        )
        db.add(connection)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "This WhatsApp phone number is already connected to another clinic") from exc
    return {"connected": True, "display_phone_number": connection.display_phone_number, "verified_name": connection.verified_name}


@app.delete("/api/clinic/whatsapp", status_code=204)
def disconnect_whatsapp(user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_admin_id(user)
    connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.clinic_id == clinic_id))
    if connection:
        db.delete(connection)
        db.commit()


@app.post("/api/clinic/whatsapp/test-message")
async def send_whatsapp_test(body: WhatsAppTestMessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_admin_id(user)
    connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.clinic_id == clinic_id))
    if not connection:
        raise HTTPException(409, "Connect a WhatsApp Business phone number first")
    try:
        token = decrypt_access_token(connection.encrypted_access_token)
        result = await send_test_template(connection.phone_number_id, token, body.to)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except WhatsAppAPIError as exc:
        raise HTTPException(400, str(exc))
    message = (result.get("messages") or [{}])[0]
    return {"sent": True, "message_id": message.get("id"), "status": message.get("message_status", "accepted")}


@app.get("/api/patients")
def patients(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == Role.platform_admin or not user.clinic_id:
        raise HTTPException(403, "Patient access is not granted to this account")
    rows = db.scalars(select(Patient).where(Patient.clinic_id == user.clinic_id, Patient.is_active.is_(True)).order_by(Patient.name).limit(100)).all()
    schedule_rows = db.scalars(select(MedicationSchedule).where(
        MedicationSchedule.clinic_id == user.clinic_id,
        MedicationSchedule.patient_id.in_([p.id for p in rows]),
        MedicationSchedule.is_active.is_(True),
    )).all() if rows else []
    by_patient = {}
    for schedule in schedule_rows:
        by_patient.setdefault(schedule.patient_id, []).append(schedule)
    return [_patient_payload(p, by_patient.get(p.id, [])) for p in rows]


def clinic_context(user: User) -> uuid.UUID:
    if user.role == Role.platform_admin or not user.clinic_id:
        raise HTTPException(403, "Clinic context required")
    return user.clinic_id


def _patient_payload(patient: Patient, schedules: list[MedicationSchedule]):
    return {
        "id": str(patient.id),
        "name": patient.name,
        "phone_e164": patient.phone_e164,
        "preferred_language": patient.preferred_language,
        "consent": patient.consent_status == "opted_in",
        "consent_status": patient.consent_status,
        "is_active": patient.is_active,
        "medications": [{
            "id": str(item.id), "name": item.medicine_name,
            "frequency": item.frequency, "food_timing": item.food_timing,
            "duration_days": item.duration_days, "reminder_times": item.reminder_times,
            "starts_on": item.starts_on.isoformat(),
        } for item in schedules],
    }


def _add_schedules(db: Session, patient: Patient, clinic: Clinic, schedules: list[MedicationScheduleIn]):
    starts_on = datetime.now(ZoneInfo(clinic.timezone)).date()
    for item in schedules:
        db.add(MedicationSchedule(
            clinic_id=clinic.id, patient_id=patient.id, medicine_name=item.medicine_name.strip(),
            frequency=item.frequency, food_timing=item.food_timing, duration_days=item.duration_days,
            reminder_times=item.reminder_times, starts_on=item.starts_on or starts_on, is_active=True,
        ))


def _update_schedules(db: Session, patient: Patient, clinic: Clinic, schedules: list[MedicationScheduleIn]):
    start_date = datetime.now(ZoneInfo(clinic.timezone)).date()
    existing = {item.id: item for item in db.scalars(select(MedicationSchedule).where(
        MedicationSchedule.patient_id == patient.id,
        MedicationSchedule.clinic_id == clinic.id,
    )).all()}
    for item in schedules:
        if item.id:
            schedule = existing.pop(item.id, None)
            if not schedule:
                raise HTTPException(400, "Medication schedule does not belong to this patient")
        else:
            schedule = MedicationSchedule(
                clinic_id=clinic.id, patient_id=patient.id, medicine_name="",
                frequency="", food_timing="", duration_days=1, reminder_times=[], starts_on=start_date,
            )
            db.add(schedule)
        schedule.medicine_name = item.medicine_name.strip()
        schedule.frequency = item.frequency
        schedule.food_timing = item.food_timing
        schedule.duration_days = item.duration_days
        schedule.reminder_times = item.reminder_times
        schedule.starts_on = item.starts_on or schedule.starts_on or start_date
        schedule.is_active = True
    for removed in existing.values():
        removed.is_active = False


async def _medication_reminder_worker():
    while True:
        try:
            await _dispatch_due_medication_reminders()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger(__name__).exception("Medication reminder worker iteration failed")
        await asyncio.sleep(30)


async def _dispatch_due_medication_reminders():
    now = datetime.now(timezone.utc)
    logger = logging.getLogger(__name__)
    with SessionLocal() as db:
        schedules = db.scalars(select(MedicationSchedule).where(MedicationSchedule.is_active.is_(True))).all()
        for schedule in schedules:
            patient = db.get(Patient, schedule.patient_id)
            clinic = db.get(Clinic, schedule.clinic_id)
            if not patient or not patient.is_active or patient.consent_status != "opted_in" or not clinic:
                continue
            connection = db.scalar(select(WhatsAppConnection).where(WhatsAppConnection.clinic_id == clinic.id))
            if not connection:
                continue
            try:
                clinic_zone = ZoneInfo(clinic.timezone)
            except Exception:
                logger.error("Invalid clinic timezone; medication reminders skipped")
                continue
            local_now = now.astimezone(clinic_zone)
            local_date = local_now.date()
            if local_date < schedule.starts_on or local_date >= schedule.starts_on + timedelta(days=schedule.duration_days):
                continue
            for time_label in schedule.reminder_times:
                local_due = datetime.combine(local_date, time.fromisoformat(time_label), tzinfo=clinic_zone)
                due_utc = local_due.astimezone(timezone.utc)
                if due_utc > now or now - due_utc > timedelta(minutes=5):
                    continue
                exists = db.scalar(select(MedicationReminder.id).where(
                    MedicationReminder.schedule_id == schedule.id,
                    MedicationReminder.scheduled_for == due_utc,
                ))
                if exists:
                    continue
                reminder = MedicationReminder(
                    clinic_id=clinic.id, patient_id=patient.id, schedule_id=schedule.id,
                    medicine_name=schedule.medicine_name, scheduled_for=due_utc, status="pending",
                )
                db.add(reminder)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    continue
                try:
                    token = decrypt_access_token(connection.encrypted_access_token)
                    result = await send_medication_reminder(
                        connection.phone_number_id, token, patient.phone_e164.lstrip("+"),
                        patient.name, schedule.medicine_name, time_label, str(reminder.id),
                    )
                    sent = (result.get("messages") or [{}])[0]
                    reminder.status = "sent"
                    reminder.whatsapp_message_id = sent.get("id")
                except Exception:
                    reminder.status = "failed"
                    logger.exception("WhatsApp medication reminder send failed")
                db.commit()


@app.post("/api/patients", status_code=201)
def create_patient(body: PatientCreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_context(user)
    clinic = db.get(Clinic, clinic_id)
    patient = Patient(
        clinic_id=clinic_id, name=body.name.strip(), phone_e164=body.phone_e164,
        preferred_language=body.preferred_language,
        consent_status="opted_in" if body.consent else "unknown",
        consent_source="Clinic-recorded" if body.consent else None,
        consent_at=datetime.now(timezone.utc) if body.consent else None,
    )
    db.add(patient)
    db.flush()
    _add_schedules(db, patient, clinic, body.medications)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "A patient with this phone number already exists in the clinic") from exc
    schedules = db.scalars(select(MedicationSchedule).where(MedicationSchedule.patient_id == patient.id)).all()
    return _patient_payload(patient, schedules)


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: uuid.UUID, body: PatientCreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_context(user)
    patient = db.scalar(select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id))
    if not patient:
        raise HTTPException(404, "Patient not found")
    clinic = db.get(Clinic, clinic_id)
    patient.name = body.name.strip()
    patient.phone_e164 = body.phone_e164
    patient.preferred_language = body.preferred_language
    patient.consent_status = "opted_in" if body.consent else "unknown"
    patient.consent_source = "Clinic-recorded" if body.consent else None
    patient.consent_at = datetime.now(timezone.utc) if body.consent else None
    _update_schedules(db, patient, clinic, body.medications)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "A patient with this phone number already exists in the clinic") from exc
    schedules = db.scalars(select(MedicationSchedule).where(MedicationSchedule.patient_id == patient.id)).all()
    return _patient_payload(patient, schedules)


@app.get("/api/clinic/medication-reminders")
def medication_reminders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    clinic_id = clinic_context(user)
    rows = db.execute(
        select(MedicationReminder, Patient, MedicationSchedule)
        .join(Patient, Patient.id == MedicationReminder.patient_id)
        .join(MedicationSchedule, MedicationSchedule.id == MedicationReminder.schedule_id)
        .where(MedicationReminder.clinic_id == clinic_id)
        .order_by(MedicationReminder.scheduled_for.desc())
        .limit(100)
    ).all()
    return [{
        "id": str(reminder.id), "patient_name": patient.name,
        "medicine_name": reminder.medicine_name,
        "scheduled_for": reminder.scheduled_for,
        "status": reminder.status,
        "responded_at": reminder.responded_at,
    } for reminder, patient, schedule in rows]
