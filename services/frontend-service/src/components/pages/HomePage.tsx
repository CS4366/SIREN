import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import { io } from "socket.io-client";
import Alert from "../elements/Alert";
import UpArrow from "../../assets/up-arrow.png";
import DownArrow from "../../assets/down-arrow.png";

const LIVE_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-live.jaxcksn.dev"
    : "http://localhost:4000";

const socket = io(LIVE_URL, {
  autoConnect: false,
});

const API_URL =
  import.meta.env.MODE === "production"
    ? "https://siren-api.jaxcksn.dev"
    : "http://localhost:3030";

const HomePage = () => {
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  // State variables for alert data this will be fetched from API later on
  const [activeAlerts, setActiveAlerts] = useState(8);
  const [activeIncrease, setActiveIncrease] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(148);
  const [totalAlertsIncrease, setTotalAlertsIncrease] = useState(1);
  const [commonAlertType, setCommonAlertType] = useState("Servere Thunderstorm Warning");
  const [commonAlertTypeYesterday, setCommonAlertTypeYesterday] = useState("Special Weather Statement");
  const [mostAlertAreas, setMostAlertAreas] = useState(["West Texas", "East Texas", "Great Plains"]);
  const [yesterdayMostAlertAreas, setYesterdayMostAlertAreas] = useState(["West Texas", "East Texas"]);

  // Refs for MapboxGL
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // TODO: Add functionality to fetch data for components from API
  // getTotalAlertsToday
  // getCurrentAlerts
  // getMostPrevelentAlert
  // getMostAffected Areas (Today/Right Now)
  // getAlertsForArea (City/State/Zip, etc)
  // displayAlertOnMap (Logic done, but data still needs to be fetched from API)



  // This is just for testing purpoeses
  // Once API is implemented, Alerts will be
  // fetched from the API and displayed on the map
  // and made to an Alert Object
  const getAlertPolygons = () => {

    // Get polygons from API, this is just for testing

    // Testing Data
    return [
      {
      color: '#FF0000',
      coordinates: [
        [
        [-101.88457, 33.57462],
        [-101.88457, 33.67462],
        [-101.77457, 33.67462],
        [-101.77457, 33.57462],
        [-101.88457, 33.57462], 
        ],
      ],
      },
      {
      color: '#00FF00',
      coordinates: [
        [
        [-101.86457, 33.59462],
        [-101.86457, 33.69462],
        [-101.75457, 33.69462],
        [-101.75457, 33.59462],
        [-101.86457, 33.59462], 
        ],
      ],
      },
    ];
  };

  // Socket Handling and Setup
  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Check if API is connected
  useEffect(() => {
    fetch(API_URL).then((res) => {
      if (res.ok) {
        setIsAPIConnected(true);
      } else {
        setIsAPIConnected(false);
      }
    });
  }, []);

  // Check if socket is connected
  useEffect(() => {
    function onConnect() {
      setIsPushConnected(true);
    }

    function onDisconnect() {
      setIsPushConnected(false);
    }
    
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Map Handling and Setup
  useEffect(() => {
    // MapboxGL setup
    mapboxgl.accessToken = 'pk.eyJ1IjoiYmdvcm1hbiIsImEiOiJjbTh5eDZtM2EwM2Q0MmtvOWxtZHUydjY0In0.95ybhEJ2-Z9VcKABogtE5A'
    
    // Add map to the mapContainerRef
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current as HTMLElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [-101.87457, 33.58462],
      zoom: 5,
      attributionControl: false,
    });

    // Add zoom and rotation controls to the map.
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    // Grab alert polygons from API
    const polygons = getAlertPolygons()

    mapRef.current?.on('load', () => {
      // Add each polygon to the map
      polygons.forEach((polygon) => {
        // Get polygon color and coordinates
        const color = polygon.color;
        const coordinates = polygon.coordinates;

        // Add polygon to the map
        mapRef.current?.addSource(`polygon-${color}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {}, // Add this field to satisfy the required 'properties'
            geometry: {
              type: 'Polygon',
              coordinates: coordinates,
            },
          },
        });

        // Fill the polygon with the specified color
        mapRef.current?.addLayer({
          id: `polygon-${color}`,
          type: 'fill',
          source: `polygon-${color}`,
          layout: {},
          paint: {
            'fill-color': color,
            'fill-opacity': 0.5,
          },
        });

        // Add border to polygon darker than fill color
        mapRef.current?.addLayer({
          id: `outline-${color}`,
          type: 'line',
          source: `polygon-${color}`,
          layout: {},
          paint: {
            'line-color': color,
            'line-width': 2,
          },
        });
      });
    });

    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    }
  }, [])


  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#283648]">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start m-5">
          <div className="flex w-full justify-start text-3xl font-bold italic">SIREN</div>
          <div className="flex w-full justify-start txt-small font-light">Web Dashboard</div>
        </div>
        {/* Connection Status */}
        <div className="flex-col w-full justify-items-end m-5">
          <div className="flex items-center">
            SIREN Live Status:{" "}
            {isPushConnected ? (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                <p>Online</p>
              </>
            ) : (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                <p>Offline</p>
              </>
            )}
          </div>
          <div className="flex items-center">
            SIREN API Status:{" "}
            {isAPIConnected ? (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                <p>Online</p>
              </>
            ) : (
              <>
                <div className="mx-1 w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                <p>Offline</p>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Alert Stats */}
      <div className="flex w-full flex-row">
        <div className="flex w-full mt-5 ml-5 mr-5 flex-row justify-start items-center gap-3">
          {/* Active Alert Stats */}
          <div className="flex-row w-1/5 border border-[#71717a] rounded-2xl">
            <div className="flex w-full">
              <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm">Total Active Alerts</p>
            </div>
            <div className="flex w-full">
              <h1 className="font-bold p-2 text-xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl truncate">{activeAlerts}</h1>
            </div>
            <div className="flex w-full">
              <div className="flex justify-start items-center p-2">
                <img src={activeIncrease > 0 ? UpArrow : DownArrow} alt="arrow" className="w-4 h-4"/>
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs">{activeIncrease > 0 ? "Up" : "Down"} {activeIncrease}% from yesterday</p>
              </div>
            </div>
          </div>
          {/* Total Alert Stats */}
          <div className="flex-row w-1/4 border border-[#71717a] rounded-2xl">
            <div className="flex w-full">
              <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm">Total Alerts Issued Today</p>
            </div>
            <div className="flex w-full">
              <h1 className="font-bold p-2 text-xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl truncate">{totalAlerts}</h1>
            </div>
            <div className="flex w-full">
              <div className="flex justify-start items-center p-2">
                <img src={totalAlertsIncrease > 0 ? UpArrow : DownArrow} alt="arrow" className="w-4 h-4 inline-block"/>
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs">{totalAlertsIncrease > 0 ? "Up" : "Down"} {totalAlertsIncrease}% from yesterday</p>
              </div>
            </div>
          </div>
          {/* Common Alert Stats*/}
          <div className="flex-row w-1/3 border border-[#71717a] rounded-2xl">
            <div className="flex w-full">
              <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm">Most Issued Alert Type Today</p>
            </div>
            <div className="flex w-full">
              <p className="font-bold p-2 text-xs sm:text-sm md:text-sm lg:text-xl xl:text-3xl">{commonAlertType}</p>
            </div>
            <div className="flex w-full">
              <div className="flex justify-start items-center p-2">
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs">Yesterday: {commonAlertTypeYesterday}</p>
              </div>
            </div>
          </div>
          {/* Region Stats */}
          <div className="flex-row w-1/2 border border-[#71717a] rounded-2xl">
            <div className="flex w-full">
              <p className="font-bold p-2 text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm">Regions with Most Alerts</p>
            </div>
            <div className="flex-col w-full p-2 font-bold text-md">
              <h1>1. {mostAlertAreas[0]}</h1>
              <h1>2. {mostAlertAreas[1]}</h1>
              <h1>3. {mostAlertAreas[2]}</h1>
            </div>
            <div className="flex w-full">
              <div className="flex justify-start items-center p-2">
                <p className="p-2 text-xs sm:text-xs md:text-xs lg:text-xs xl:text-xs">Yesterday: {yesterdayMostAlertAreas[0]} | {yesterdayMostAlertAreas[1]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-9/10 flex-row h-full mt-5 ml-5 justify-start items-center gap-3 overflow-hidden mb-5 bg-[#283648]">
        {/* Active Alert Contatiner */}
        <div className="flex w-1/2 h-full border border-[#71717a] rounded-2xl">
            <div className="flex flex-col w-full h-full">
              {/* Active Alert Header */}
              <div className="flex w-full justify-between items-center p-3">
                <h2 className="text-lg font-bold">Active Alert List</h2>
                <input type="text" placeholder="Filter by Location" className="p-2 border w-2/5 border-white rounded-md focus:outline-none bg-transparent text-xs sm:text-xs md:text-sm lg:text-md xl:text-lg font-light" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                  {/* Active Alerts (Will be populated from APO) */}
                  <Alert 
                      alertType="Tornado Watch"
                      alertIssue="NWS Lubbock"
                      alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                      alertStartTime="10:00 AM"
                      alertEndTime="12:00 PM"
                      alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                      alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                      alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                      color="#FF0000"
                  />
                   <Alert 
                      alertType="Tornado Watch"
                      alertIssue="NWS Lubbock"
                      alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                      alertStartTime="10:00 AM"
                      alertEndTime="12:00 PM"
                      alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                      alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                      alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                      color="#FF0000"
                  />
                   <Alert 
                      alertType="Tornado Watch"
                      alertIssue="NWS Lubbock"
                      alertAreas={["Lubbock TX", "Wolfforth TX", "Snyder TX"]}
                      alertStartTime="10:00 AM"
                      alertEndTime="12:00 PM"
                      alertDescription={['At 821 PM EDT, a severe thunderstorm capable of producing a tornado was located near Wolfforth, moving northeast at 40 mph.', 'HAZARD...Tornado and quarter size hail.','SOURCE...Radar indicated rotation.','IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.']}
                      alertInstructions="TAKE COVER NOW! Move to a basement or an interior room on the lowestfloor of a sturdy building. Avoid windows. If you are outdoors, in amobile home, or in a vehicle, move to the closest substantial shelterand protect yourself from flying debris."
                      alertHistory={['Alert Issued', 'Alert Updated - Time Extended']}
                      color="#FF0000"
                  />
              </div>
            </div>
        </div>
        {/* Alert-Map Containter */}
        <div id="map-container" className="flex w-1/2 h-full border border-[#71717a] rounded-2xl mt-0 mr-5" ref={mapContainerRef}>
          {/* Alert-Map Header */}
          <div className="absolute top-2 left-2 z-10">
            <h2 className="text-lg font-bold">Active Mini-Map</h2>
          </div>
        </div>
      </div>
    </div>
  );
};


export default HomePage;
