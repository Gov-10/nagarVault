from sqlalchemy import create_engine, Column, String, Integer, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
sessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String)
    username = Column(String)
    user_id = Column(String, unique=True)
    password = Column(String)
    role = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
