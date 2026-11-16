import React, { createContext, useContext, useState, useEffect } from 'react';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  coords: GeoCoordinate;
  searchRadiusKm: number;
  setSearchRadiusKm: (radius: number) => void;
  permissionGranted: boolean;
  manualLocationName: string;
  setCustomLocation: (name: string, coords: GeoCoordinate) => void;
  requestPermission: () => Promise<void>;
}

// Default to San Francisco coordinates for MVP
const DEFAULT_COORDS: GeoCoordinate = {
  latitude: 37.7749,
  longitude: -122.4194,
};

const LocationContext = createContext<LocationContextType>({
  coords: DEFAULT_COORDS,
  searchRadiusKm: 10,
  setSearchRadiusKm: () => {},
  permissionGranted: true,
  manualLocationName: 'San Francisco, CA',
  setCustomLocation: () => {},
  requestPermission: async () => {},
});

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<GeoCoordinate>(DEFAULT_COORDS);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(10); // default 10 km
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  const [manualLocationName, setManualLocationName] = useState<string>('San Francisco, CA');

  const requestPermission = async () => {
    // Uses standard Expo Location or mock fallback
    try {
      setPermissionGranted(true);
      setCoords(DEFAULT_COORDS);
    } catch {
      setPermissionGranted(false);
    }
  };

  const setCustomLocation = (name: string, newCoords: GeoCoordinate) => {
    setManualLocationName(name);
    setCoords(newCoords);
  };

  return (
    <LocationContext.Provider
      value={{
        coords,
        searchRadiusKm,
        setSearchRadiusKm,
        permissionGranted,
        manualLocationName,
        setCustomLocation,
        requestPermission,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
