"""
One-time admin seed script. Run directly against the database to create the first admin user.
Usage: python seed_admin.py --username admin --password <strong-password>
Never run this in production after the first admin exists.
"""
import argparse
import os
from argon2 import PasswordHasher
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Users, Base

load_dotenv()
ph = PasswordHasher()

def seed(username: str, password: str, user_id: str):
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL environment variable is not set.")
    engine = create_engine(database_url)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Users).filter(Users.username == username).first()
        if existing:
            print(f"User '{username}' already exists. Aborting.")
            return
        admin = Users(
            name="Administrator",
            username=username,
            user_id=user_id,
            password=ph.hash(password),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print(f"Admin user '{username}' created successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the first admin user")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--user-id", default="admin-001", help="Admin user ID (default: admin-001)")
    args = parser.parse_args()
    seed(args.username, args.password, args.user_id)
