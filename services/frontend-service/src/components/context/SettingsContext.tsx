import React, { createContext, useContext, useState } from "react";

// Define the types for the context value
interface SettingsContextProps {
  coordinates: { longitude: number; latitude: number };
  setCoordinates: (coords: { longitude: number; latitude: number }) => void;
  mapStyle: string;
  setMapStyle: (style: string) => void;
  borderOpacity: number;
  setBorderOpacity: (opacity: number) => void;
  fillOpacity: number;
  setFillOpacity: (opacity: number) => void;
}

// Create the context with default values
const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined
);

// Create a provider component
// This component will wrap around the parts of the app that need access to the context
// It will manage the state and provide the context value to its children
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize state variables for coordinates, map style, border opacity, and fill opacity
  const [coordinates, setCoordinates] = useState({
    longitude: -101.87457,
    latitude: 33.58462,
  });
  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/mapbox/navigation-night-v1"
  );
  const [borderOpacity, setBorderOpacity] = useState(100);
  const [fillOpacity, setFillOpacity] = useState(40);

  return (
    <SettingsContext.Provider
      value={{
        coordinates,
        setCoordinates,
        mapStyle,
        setMapStyle,
        borderOpacity,
        setBorderOpacity,
        fillOpacity,
        setFillOpacity,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Create a custom hook to use the SettingsContext
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useLocation must be used within a SettingsProvider");
  }
  return context;
};
