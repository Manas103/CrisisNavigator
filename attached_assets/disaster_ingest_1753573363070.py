# disaster_ingest.py
try:
    import requests
    from pymongo import MongoClient
    from dotenv import load_dotenv
    import os
except ImportError as e:
    print(f"Missing module: {e.name}")
    print("Please install with: pip install requests pymongo python-dotenv")
    exit(1)

load_dotenv()

# Fetch EONET data with error handling
try:
    response = requests.get("https://eonet.gsfc.nasa.gov/api/v3/events", timeout=10)
    response.raise_for_status()  # Raise error for bad status codes
    eonet_data = response.json()["events"]
except requests.exceptions.RequestException as e:
    print(f"Failed to fetch EONET data: {str(e)}")
    exit(1)

# MongoDB Connection
try:
    client = MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
    client.server_info()  # Test connection
    db = client.crisis_db
    events = db.disaster_events
except Exception as e:
    print(f"MongoDB connection failed: {str(e)}")
    exit(1)

# Verify EONET data structure
if not eonet_data:
    print("No events found in EONET data")
    exit(1)

try:
    sample_event = eonet_data[0]
    print("Sample event keys:", list(sample_event.keys()))
    print("First geometry:", sample_event["geometry"][0])
    print("Coordinates:", sample_event["geometry"][0]["coordinates"])
    print("Category:", sample_event["categories"][0]["title"])
except KeyError as e:
    print(f"Unexpected EONET data structure: Missing key {str(e)}")
    exit(1)

# Prepare documents for insertion
documents = []
for event in eonet_data:
    try:
        doc = {
            "type": event["categories"][0]["title"],
            "location": {
                "type": "Point",
                "coordinates": [
                    event["geometry"][0]["coordinates"][0], 
                    event["geometry"][0]["coordinates"][1]
                ]
            },
            "timestamp": event["geometry"][0]["date"],
            "severity": None,
            "raw_data": event
        }
        documents.append(doc)
    except (KeyError, IndexError) as e:
        print(f"Skipping malformed event: {str(e)}")

# Insert documents with error handling
if documents:
    try:
        result = events.insert_many(documents)
        print(f"Successfully inserted {len(result.inserted_ids)} documents")
        
        # Create geospatial index
        events.create_index([("location", "2dsphere")])
        print("Created geospatial index")
    except Exception as e:
        print(f"Insert failed: {str(e)}")
else:
    print("No valid documents to insert")