# app.py
import os
import time
import threading
import re
import traceback
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import google.generativeai as genai
import requests
from PIL import Image
from io import BytesIO

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client.crisis_db

# ----------------------
# Helper Functions (UPDATED)
# ----------------------
def get_first_image_url(event):
    """Extract first valid image URL from event sources"""
    try:
        sources = event.get('raw_data', {}).get('sources', [])
        for source in sources:
            url = source.get('url', '')
            if url and any(ext in url.lower() for ext in ['.png', '.jpg', '.jpeg']):
                return url
        return None
    except Exception as e:
        print(f"Image URL extraction error: {str(e)}")
        return None

def safe_get(dictionary, keys, default=None):
    """Safely get nested dictionary values"""
    try:
        for key in keys:
            dictionary = dictionary[key]
        return dictionary
    except (KeyError, TypeError):
        return default

def analyze_event(event):
    """Robust event analysis with better error handling"""
    try:
        # Safely extract event data
        title = safe_get(event, ['raw_data', 'title'], "Untitled Event")
        description = safe_get(event, ['raw_data', 'description'], "No description")
        event_type = safe_get(event, ['type'], "Unknown")
        coordinates = safe_get(event, ['location', 'coordinates'], [0, 0])
        timestamp = safe_get(event, ['timestamp'], "Unknown date")
        
        # Combined prompt for efficiency
        combined_prompt = f"""
        DISASTER ANALYSIS REQUEST:
        **Event**: {title}
        **Description**: {description}
        **Type**: {event_type}
        **Location**: {coordinates}
        **Date**: {timestamp}

        YOUR TASKS:
        1. Severity score (1-10)
        2. Primary disaster type
        3. Top 3 risks
        4. Emergency response plan with:
           a) Immediate actions
           b) Evacuation guidance
           c) Resource priorities
        """
        
        # Handle image if available
        img_url = get_first_image_url(event)
        img_part = None
        if img_url:
            try:
                response = requests.get(img_url, timeout=10)
                if response.status_code == 200 and response.content:
                    img_part = Image.open(BytesIO(response.content))
                    combined_prompt += "\n\nIMAGE ANALYSIS: Describe damage severity, visible impacts, and affected area"
                else:
                    print(f"Image download failed for {img_url}: Status {response.status_code}")
            except Exception as img_e:
                print(f"Image download error: {str(img_e)}")
        
        # Single API call
        try:
            if img_part:
                response = model.generate_content([combined_prompt, img_part])
            else:
                response = model.generate_content(combined_prompt)
            
            response_text = response.text
        except Exception as gen_e:
            print(f"Gemini API error: {str(gen_e)}")
            return None
        
        # Extract severity score - more robust method
        severity = 5
        try:
            # Regex-based extraction
            match = re.search(r"severity\s*score:\s*(\d+)", response_text, re.IGNORECASE)
            if match and match.group(1).isdigit() and 1 <= int(match.group(1)) <= 10:
                severity = int(match.group(1))
            else:
                # Fallback: search for any number between 1-10
                for word in response_text.split():
                    if word.isdigit() and 1 <= int(word) <= 10:
                        severity = int(word)
                        break
        except Exception as e:
            print(f"Severity extraction failed: {str(e)}")
        
        return {
            "severity": severity,
            "analysis": response_text,
            "processed": True
        }
    
    except Exception as e:
        print(f"Analysis failed: {str(e)}")
        traceback.print_exc()
        return None

# ----------------------
# Background Processing Thread
# ----------------------
def background_processor():
    """Continuously process unanalyzed events in the background"""
    while True:
        try:
            print("Background processor: Checking for unprocessed events...")
            events_col = db.disaster_events
            
            # Get unprocessed events (limit to 10 per batch)
            unprocessed = list(events_col.find({"processed": {"$ne": True}}).limit(10))
            
            if not unprocessed:
                print("No unprocessed events found. Sleeping for 5 minutes.")
                time.sleep(300)  # 5 minutes
                continue
                
            print(f"Processing {len(unprocessed)} events in background...")
            
            for event in unprocessed:
                result = analyze_event(event)
                if result:
                    # Update the event document
                    events_col.update_one(
                        {"_id": event["_id"]},
                        {"$set": {
                            "severity": result["severity"],
                            "analysis": result["analysis"],
                            "processed": True,
                            "last_processed": time.time()
                        }}
                    )
                    print(f"Processed event {event['_id']}")
                
                # Respect Gemini rate limits (1 request per second)
                time.sleep(1.2)
                
            print("Batch processing complete. Sleeping for 1 minute.")
            time.sleep(60)  # Wait 1 minute between batches
            
        except Exception as e:
            print(f"Background processing error: {str(e)}")
            time.sleep(60)  # Wait before retrying

# ----------------------
# API Endpoints
# ----------------------
@app.route('/api/disasters', methods=['GET'])
def get_disasters():
    """Get processed disasters for the map"""
    disasters = list(db.disaster_events.find(
        {"processed": True},
        {"_id": 0, "raw_data": 1, "location": 1, "severity": 1, "type": 1, "analysis": 1}
    ).sort("last_processed", -1).limit(100))  # Get most recent 100
    return jsonify(disasters)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics"""
    stats = {
        "total_events": db.disaster_events.count_documents({}),
        "processed": db.disaster_events.count_documents({"processed": True}),
        "high_severity": db.disaster_events.count_documents({"severity": {"$gt": 7}}),
        "last_updated": time.time()
    }
    return jsonify(stats)

# ----------------------
# Frontend Serving
# ----------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join('crisis-dashboard/build', path)):
        return send_from_directory('crisis-dashboard/build', path)
    else:
        return send_from_directory('crisis-dashboard/build', 'index.html')


# Add to app.py after other routes
@app.route('/api/test-event', methods=['GET'])
def test_event():
    """Test event structure"""
    sample = db.disaster_events.find_one()
    if sample:
        # Remove MongoDB _id field
        sample.pop('_id', None)
        return jsonify(sample)
    return jsonify({"error": "No events found"})


# ----------------------
# Application Startup
# ----------------------
if __name__ == '__main__':
    # Start background processing thread
    processor_thread = threading.Thread(target=background_processor, daemon=True)
    processor_thread.start()
    
    print("Starting Flask server...")
    app.run(host='0.0.0.0', port=5000, debug=True)