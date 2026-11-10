import hashlib
import secrets
import uuid
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import RefreshSession, User

password_hash = PasswordHash.recommended()
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(raw: str) -> str:
    return password_hash.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return password_hash.verify(raw, hashed)


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def access_token(user: User, clinic_id: uuid.UUID | None = None) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user.id), "role": user.role.value, "clinic": str(user.clinic_id) if user.clinic_id else None, "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}
    if clinic_id is not None:
        claims.update({"admin_view": True, "clinic": str(clinic_id)})
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def create_refresh(db: Session, user: User, family_id: uuid.UUID | None = None) -> str:
    raw = secrets.token_urlsafe(48)
    db.add(RefreshSession(user_id=user.id, token_hash=token_hash(raw), family_id=family_id or uuid.uuid4(), expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days)))
    return raw


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    if claims.get("admin_view"):
        clinic_id = uuid.UUID(claims.get("clinic", ""))
        from app.models import Clinic, Role
        clinic = db.get(Clinic, clinic_id)
        if user.role.value != "platform_admin" or not clinic or clinic.status == "suspended":
            raise HTTPException(status_code=403, detail="Clinic access is unavailable")
        return SimpleNamespace(id=user.id, name=user.name, email=user.email, phone_e164=user.phone_e164, designation=user.designation, role=Role.clinic_admin, clinic_id=clinic_id, is_active=True, admin_view=True)
    return user
