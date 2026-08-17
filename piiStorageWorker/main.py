import os, json, re, hashlib, hmac
from kafka import KafkaConsumer
from dotenv import load_dotenv
load_dotenv()
from database import WaterEvents, TrafficEvents, Complaints, sessionLocal
PHONE_REGEX = re.compile(r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b")
AADHAAR_REGEX = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
SECRET_SALT = os.getenv("PII_HMAC_SALT", "nagarvault_secret_salt_2026").encode()
def generate_citizen_token(identifier: str):
    if not identifier:
        return "cit_anonymous"
    digest = hmac.new(SECRET_SALT, str(identifier).strip().encode(), hashlib.sha256).hexdigest()
    return f"cit_{digest[:10]}"

def scrub_text(text: str):
    if not text:
        return ""
    text = PHONE_REGEX.sub("[REDACTED_PHONE]", text)
    text = AADHAAR_REGEX.sub("[REDACTED_AADHAAR]", text)
    text = EMAIL_REGEX.sub("[REDACTED_EMAIL]", text)
    return text

consumer = KafkaConsumer("enrich-topic",bootstrap_servers=os.getenv("BOOTSTRAP_SERVER"), value_deserializer= lambda x: json.loads(x.decode()), group_id= "pii-group")
for msg in consumer:
    data = msg.value
    db = sessionLocal()
    try:
        dept = data.get("department").upper()
        if dept == "COMPLAINTS":
            raw_identity = data.get("phone") or data.get("email") or data.get("name")
            token = generate_citizen_token(raw_identity)
            clean_desc = scrub_text(data.get("description", ""))
            db_note = Complaints(citizen_token=token, ward_id=data.get("ward_id"), department=dept, issue_type = data.get("issue_type"), cleaned_desc=clean_desc, file_key=data.get("file_key") if data.get("file_key") else None)
            db.add(db_note)
        elif dept == "WATER":
            db_note = WaterEvents(sensor_id=data.get("sensor_id"), ward_id=data.get("ward_id"), water_level = data.get("water_level"), flow_rate= data.get("flow_rate"), pressure_psi = data.get("pressure_psi"))
            db.add(db_note)
        elif dept == "TRAFFIC":
            db_note = TrafficEvents(junction_id = data.get("junction_id"), ward_id = data.get("ward_id"), congestion_score= data.get("congestion_score"), vehicle_count = data.get("vehicle_count"))
            db.add(db_note)
        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()
