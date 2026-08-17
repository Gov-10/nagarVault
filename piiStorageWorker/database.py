from sqlalchemy import create_engine, Column, String, Integer, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
sessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
class Complaints(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    citizen_token = Column(String)
    ward_id = Column(String)
    department= Column(String)
    issue_type = Column(String)
    cleaned_desc = Column(String)
    file_key = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class WaterEvents(Base):
    __tablename__= "water_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sensor_id = Column(String)
    ward_id = Column(String)
    water_level = Column(Float)
    flow_rate= Column(Float)
    pressure_psi = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class TrafficEvents(Base):
    __tablename__ = "traffic_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    junction_id= Column(String)
    ward_id = Column(String)
    congestion_score= Column(Float)
    vehicle_count = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)
