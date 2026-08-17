import os, json
from dotenv import load_dotenv
load_dotenv()
from kafka import KafkaConsumer, KafkaProducer
producer = KafkaProducer(bootstrap_servers=os.getenv("BOOTSTRAP_SERVER"), value_serializer = lambda x: json.dumps(x).encode("utf-8"))
consumer = KafkaConsumer("ingestion-complaint", "ingestion-water", "ingestion-road", bootstrap_servers=os.getenv("BOOTSTRAP_SERVER"), value_deserializer=lambda x: json.loads(x.decode()), group_id="enrich-group")
for msg in consumer:
    pass
