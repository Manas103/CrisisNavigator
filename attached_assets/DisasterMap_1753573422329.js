// crisis-dashboard/src/components/DisasterMap.js
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix marker icons - IMPORTANT for Windows
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DisasterMap = ({ disasters, onSelect }) => {
  const [map, setMap] = useState(null);
  
  // Set initial view to Florida where most disasters are
  const initialPosition = [29.118233, -81.4737];
  const initialZoom = 6;

  // Update view when disasters change
  useEffect(() => {
    if (map && disasters.length > 0) {
      const coords = disasters.map(d => [
        d.location.coordinates[1],
        d.location.coordinates[0]
      ]);
      
      // Create bounds that contain all markers
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [disasters, map]);

  return (
    <MapContainer 
      center={initialPosition}
      zoom={initialZoom}
      style={{ height: '100%', width: '100%' }}
      whenCreated={setMap}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {disasters.map(disaster => {
        const coords = disaster.location.coordinates;
        if (!coords || coords.length !== 2) return null;
        
        return (
          <Marker 
            key={disaster.id || `${coords[0]}-${coords[1]}`}
            position={[coords[1], coords[0]]}
            eventHandlers={{ 
              click: () => onSelect(disaster)
            }}
          >
            <Popup>
              <h3>{disaster.type || 'Unknown Disaster'}</h3>
              <p>Severity: {disaster.severity}/10</p>
              <p>{disaster.raw_data?.title || 'No title'}</p>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default DisasterMap;