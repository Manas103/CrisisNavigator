# prediction_engine.py
from sklearn.ensemble import RandomForestRegressor
import pandas as pd
from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))
db = client.crisis_db

# Load historical data
data = list(db.historical_events.find())
df = pd.DataFrame(data)

# Feature engineering
df['population_density'] = df['coordinates'].apply(get_population_density)  # External API
df = pd.get_dummies(df, columns=['type'])

# Train resource prediction model
X = df[['severity', 'population_density', 'type_earthquake', ...]]
y = df[['water_needed', 'medical_kits', 'shelters']]

model = RandomForestRegressor()
model.fit(X, y)

# Save model for real-time use
import joblib
joblib.dump(model, 'resource_predictor.pkl')