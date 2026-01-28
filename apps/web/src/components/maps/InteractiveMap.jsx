import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, AlertTriangle } from "lucide-react";
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function InteractiveMap({ journey }) {
  const [mapSupported, setMapSupported] = useState(true);

  useEffect(() => {
    // Check if the browser supports the necessary features for Leaflet
    try {
      // Test for required DOM APIs
      if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) {
        setMapSupported(false);
      }
    } catch (e) {
      setMapSupported(false);
    }
  }, []);

  // Fallback for unsupported browsers
  if (!mapSupported) {
    return (
      <div className="w-full h-96 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-green-100 flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Map Not Available</h3>
        <p className="text-gray-600 text-center text-sm">
          Interactive maps require a modern browser. Please open in Chrome, Safari, or Firefox.
        </p>
        <div className="mt-4 space-y-2">
          {journey.locations.map((loc, i) => (
            <Badge key={i} variant="outline" className="mr-2">
              {i + 1}. {loc.name}
            </Badge>
          ))}
        </div>
      </div>
    );
  }
  // Calculate center point of all locations
  const centerLat = journey.locations.reduce((sum, loc) => sum + loc.lat, 0) / journey.locations.length;
  const centerLng = journey.locations.reduce((sum, loc) => sum + loc.lng, 0) / journey.locations.length;
  
  // Create path coordinates for the journey line
  const pathCoordinates = journey.locations.map(location => [location.lat, location.lng]);

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Draw the journey path */}
        <Polyline 
          positions={pathCoordinates} 
          color={journey.color}
          weight={3}
          opacity={0.7}
        />
        
        {/* Add markers for each location */}
        {journey.locations.map((location, index) => (
          <Marker 
            key={index} 
            position={[location.lat, location.lng]}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {location.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                <Badge variant="outline" className="mt-2" style={{ color: journey.color }}>
                  Stop {index + 1} of {journey.locations.length}
                </Badge>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}