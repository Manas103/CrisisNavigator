# gemini_processor.py
import os
import time
import google.generativeai as genai
from pymongo import MongoClient
from dotenv import load_dotenv
import requests
from PIL import Image
from io import BytesIO
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

client = MongoClient(os.getenv("MONGO_URI"))
db = client.crisis_db
events = db.disaster_events

def get_first_image_url(event):
    """Extract first valid image URL from event sources"""
    for source in event['raw_data'].get('sources', []):
        if source.get('url', '').lower().endswith(('.png', '.jpg', '.jpeg')):
            return source['url']
    return None

def analyze_event(event):
    """Analyze disaster event using Gemini"""
    try:
        combined_prompt = f"""
        DISASTER ANALYSIS REQUEST:
        **Event**: {event['raw_data']['title']}
        **Description**: {event['raw_data']['description']}
        **Type**: {event['type']}
        **Location**: {event['location']['coordinates']}
        **Date**: {event['timestamp']}

        YOUR TASKS:
        1. Severity score (1-10)
        2. Primary disaster type
        3. Top 3 risks
        4. Emergency response plan with:
           a) Immediate actions
           b) Evacuation guidance
           c) Resource priorities
        """
        
        img_url = get_first_image_url(event)
        img_part = None
        if img_url:
            try:
                response = requests.get(img_url, timeout=10)
                if response.status_code == 200:
                    img_part = Image.open(BytesIO(response.content))
                    combined_prompt += "\n\nIMAGE ANALYSIS: Describe damage severity, visible impacts, and affected area"
            except Exception as img_e:
                print(f"Image download failed: {str(img_e)}")
        
        try:
            if img_part:
                response = model.generate_content([combined_prompt, img_part])
            else:
                response = model.generate_content(combined_prompt)
                
            response_text = response.text
        except Exception as gen_e:
            print(f"Gemini API error: {str(gen_e)}")
            return None
        
        severity = 5
        try:
            if "severity score:" in response_text.lower():
                match = re.search(r"severity score:\s*(\d+)", response_text, re.IGNORECASE)
                if match:
                    severity = int(match.group(1))
            else:
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
        print(traceback.format_exc())
        return None

unprocessed = list(events.find({"severity": None}).limit(50))
total = events.count_documents({"severity": None})
processed_count = 0

print(f"Found {total} unprocessed events. Starting analysis...")

with ThreadPoolExecutor(max_workers=5) as executor:
    future_to_event = {executor.submit(analyze_event, event): event for event in unprocessed}
    
    for i, future in enumerate(as_completed(future_to_event)):
        event = future_to_event[future]
        try:
            analysis = future.result()
            if analysis:
                severity = 5
                try:
                    if "severity score:" in analysis['analysis'].lower():
                        score_text = analysis['analysis'].split("severity score:")[1].split("\n")[0].strip()
                        if score_text.isdigit():
                            severity = int(score_text)
                    else:
                        for word in analysis['analysis'].split():
                            if word.isdigit() and 1 <= int(word) <= 10:
                                severity = int(word)
                                break
                except Exception as e:
                    print(f"Severity extraction failed: {str(e)}")
                
                events.update_one({"_id": event["_id"]}, {"$set": {
                    "severity": severity,
                    "analysis": analysis['analysis'],
                    "last_processed": time.time()
                }})
                processed_count += 1
            else:
                events.update_one({"_id": event["_id"]}, {"$set": {"processed": True}})
        except Exception as e:
            print(f"Thread processing error: {str(e)}")
            events.update_one({"_id": event["_id"]}, {"$set": {"processed": True}})
        
        print(f"Completed {i+1}/{len(unprocessed)} events")

print(f"Processed {processed_count} events. Analysis complete!")