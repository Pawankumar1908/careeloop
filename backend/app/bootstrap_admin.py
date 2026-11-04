"""Create the initial platform administrator from a trusted local terminal."""
import argparse
from getpass import getpass

from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.models import Role, User


def main():
    parser = argparse.ArgumentParser(description="Create the initial ClinicCare platform administrator")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    password = getpass("Platform admin password (minimum 12 characters): ")
    if len(password) < 12:
        parser.error("Password must be at least 12 characters")
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == Role.platform_admin).limit(1)):
            parser.error("A platform administrator already exists; use the admin console to manage clinics")
        email = args.email.strip().lower()
        if db.scalar(select(User.id).where(User.email == email)):
            parser.error("That email is already in use")
        db.add(User(name=args.name.strip(), email=email, password_hash=hash_password(password), role=Role.platform_admin))
        db.commit()
    print(f"Platform administrator created: {email}")


if __name__ == "__main__":
    main()
