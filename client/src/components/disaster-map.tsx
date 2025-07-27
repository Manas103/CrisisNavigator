import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Disaster } from "@shared/schema";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DisasterMapProps {
  disasters: Disaster[];
  onSelectDisaster: (disaster: Disaster) => void;
  selectedDisaster?: Disaster | null;
  centerMap?: boolean; // New prop to trigger centering
}

export function DisasterMap({ disasters, onSelectDisaster, selectedDisaster, centerMap }: DisasterMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [shouldPreserveView, setShouldPreserveView] = useState(false);

  const getSeverityColor = (severity: number | null): string => {
    if (!severity) return "#6B7280"; // gray for unknown
    if (severity >= 7) return "#DC2626"; // red for high
    if (severity >= 4) return "#F59E0B"; // yellow for medium
    return "#16A34A"; // green for low
  };

  const createCustomIcon = (severity: number | null) => {
    const color = getSeverityColor(severity);
    return L.divIcon({
      className: 'custom-disaster-marker',
      html: `<div style="
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ${severity && severity >= 7 ? 'animation: pulse 2s infinite;' : ''}
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapRef.current);

    // Track user interactions to preserve view
    mapRef.current.on('zoomstart dragstart', () => {
      setShouldPreserveView(true);
    });

    // Add pulse animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    setIsInitialized(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Add new markers
    disasters.forEach(disaster => {
      if (!mapRef.current) return;

      const marker = L.marker(
        [disaster.latitude, disaster.longitude],
        { icon: createCustomIcon(disaster.severity) }
      );

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-semibold text-gray-900 mb-1">${disaster.title || disaster.type}</h3>
          <p class="text-sm text-gray-600 mb-2">${disaster.type}</p>
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm text-gray-600">Severity:</span>
            <span class="font-semibold ${disaster.severity && disaster.severity >= 7 ? 'text-red-600' : disaster.severity && disaster.severity >= 4 ? 'text-yellow-600' : 'text-green-600'}">${disaster.severity || 'Unknown'}/10</span>
          </div>
          <p class="text-xs text-gray-500">${new Date(disaster.timestamp).toLocaleString()}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        // Don't center map when clicking on disaster
        onSelectDisaster(disaster);
      });
      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    // Only fit bounds on initial load or when explicitly requested
    if (disasters.length > 0 && (!isInitialized || (centerMap && !shouldPreserveView))) {
      const bounds = L.latLngBounds(
        disasters.map(d => [d.latitude, d.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [disasters, onSelectDisaster, centerMap, isInitialized, shouldPreserveView]);

  // Handle center map trigger
  useEffect(() => {
    if (centerMap && mapRef.current && disasters.length > 0) {
      const bounds = L.latLngBounds(
        disasters.map(d => [d.latitude, d.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      setShouldPreserveView(false); // Reset preservation after centering
    }
  }, [centerMap, disasters]);

  return (
    <div className="relative h-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      
      {/* Map controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-1 z-[1000]">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="block w-8 h-8 bg-white hover:bg-gray-50 rounded border text-gray-700 font-bold"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="block w-8 h-8 bg-white hover:bg-gray-50 rounded border text-gray-700 font-bold"
        >
          −
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Severity Scale</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span className="text-gray-700">Low (1-3)</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
            <span className="text-gray-700">Med (4-6)</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span className="text-gray-700">High (7-10)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
