import React, { createContext, useContext, useState, ReactNode } from "react";
import { SirenAlert } from "../../model/Alert";

interface AlertContextProps {
  alertData: SirenAlert[];
  setAlertData: React.Dispatch<React.SetStateAction<SirenAlert[]>>;
  polygonGeoJson: GeoJSON.FeatureCollection;
  setPolygonGeoJson: React.Dispatch<React.SetStateAction<GeoJSON.FeatureCollection>>;
  countyGeoJson: GeoJSON.FeatureCollection;
  setCountyGeoJson: React.Dispatch<React.SetStateAction<GeoJSON.FeatureCollection>>;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [alertData, setAlertData] = useState<SirenAlert[]>([]);
  const [polygonGeoJson, setPolygonGeoJson] = useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const [countyGeoJson, setCountyGeoJson] = useState<GeoJSON.FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });

  return (
    <AlertContext.Provider
      value={{
        alertData,
        setAlertData,
        polygonGeoJson,
        setPolygonGeoJson,
        countyGeoJson,
        setCountyGeoJson,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlertContext = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlertContext must be used within an AlertProvider");
  }
  return context;
};