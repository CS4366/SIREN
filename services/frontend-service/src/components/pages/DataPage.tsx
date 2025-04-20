import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { 
  Button, 
  Select,
  SelectItem, 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell 
} from "@heroui/react";

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


// Define the structure of the alert data
interface AlertData {
  _id?: string;
  info?: {
    event?: string;
    expires?: string;
    area?: {
      description?: string;
    };
  };
  sent?: string;
}

// Main component for the DataPage
const DataPage = () => {
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  // State variables for filters
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("");
  // State variable for alert data
  const [alertData, setAlertData] = useState<AlertData[]>([]);
  const [filteredData, setFilteredData] = useState<AlertData[]>([]);

  // Alert types will change later when we have a full list of alerts
  const alertTypes = [
    "Administrative Message",
  "Avalanche Watch",
  "Avalanche Warning",
  "Blizzard Warning",
  "Blizzard Watch",
  "Child Abduction Emergency",
  "Civil Danger Warning",
  "Civil Emergency Message",
  "Coastal Flood Advisory",
  "Lakeshore Flood Advisory",
  "Coastal Flood Warning",
  "Lakeshore Flood Warning",
  "Dust Storm Warning",
  "Earthquake Warning",
  "Evacuation Immediate",
  "Extreme Wind Warning",
  "Flash Flood Advisory",
  "Flash Flood Advisory",
  "Flash Flood Warning",
  "Flood Advisory",
  "Flood Watch",
  "Flood Warning",
  "Fire Warning",
  "Hurricane Local Statement",
  "Typhoon Local Statement",
  "Hazardous Materials Warning",
  "Hurricane Watch",
  "Typhoon Watch",
  "Hurricane Warning",
  "Typhoon Warning",
  "High Wind Watch",
  "High Wind Warning",
  "Law Enforcement Emergency",
  "Law Enforcement Warning",
  "Nuclear Power Plant Warning",
  "Air Quality Alert",
  "Air Stagnation Advisory",
  "Ashfall Advisory",
  "Marine Ashfall Advisory",
  "Marine High Wind Warning",
  "Shelter in Place Warning",
  "Boil Water Advisory",
  "Dust Advisory",
  "Dust Warning",
  "Blowing Snow Advisory",
  "Coastal Flood Advisory",
  "Coastal Flood Statement",
  "Cold Weather Advisory",
  "Dense Fog Advisory",
  "Marine Dense Fog Advisory",
  "Marine Small Craft Advisory",
  "Small Craft Advisory",
  "Dense Smoke Advisory",
  "Extreme Cold Advisory",
  "Extreme Cold Warning",
  "Excessive Heat Warning",
  "Excessive Heat Advisory",
  "Radiological Hazard Warning",
  "Extreme Hazard Alert",
  "Extreme Hazard Warning",
  "Fire Weather Advisory",
  "Flood Advisory",
  "Flood Advisory",
  "Freeze Warning",
  "Freezing Rain Advisory",
  "Freeze Advisory",
  "Freeze Warning",
  "Frost Advisory",
  "Gale Warning",
  "Gale Advisory",
  "Hard Freeze Warning",
  "Hard Freeze Advisory",
  "Severe Weather Statement",
  "Severe Weather Advisory",
  "Heat Advisory",
  "Urban and Small Stream Flood Advisory",
  "Urban and Small Stream Flood Warning",
  "Urban and Small Stream Flood Advisory",
  "Snow Advisory",
  "Snow Warning",
  "Hazardous Fire Weather",
  "Hazardous Fire Advisory",
  "Excessive Snowfall Advisory",
  "Lake Wind Advisory",
  "Lakeshore Flood Advisory",
  "Lakeshore Flood Statement",
  "Low Water Advisory",
  "Marine Weather Statement",
  "Fire Weather Warning",
  "Radiological Protection Statement",
  "Special Weather Statement",
  "Snow Squall Warning",
  "River Flood Advisory",
  "Small Ice Advisory",
  "Marine Warning",
  "Storm Warning",
  "Storm Advisory",
  "Hurricane Statement",
  "Tsunami Advisory",
  "Wind Advisory",
  "Winter Weather Advisory",
  "Radiological Hazard Warning",
  "Special Weather Statement",
  "Special Weather Warning",
  "Severe Storm Advisory",
  "Severe Storm Warning",
  "Severe Thunderstorm Watch",
  "Severe Thunderstorm Warning",
  "Snow Squall Warning",
  "Tornado Warning",
  "Tornado Watch",
  "Tornado Emergency",
  "Tropical Storm Advisory",
  "Tropical Storm Warning",
  "Tsunami Watch",
  "Tsunami Warning",
  "Volcano Warning",
  "Winter Storm Advisory",
  "Winter Storm Warning",
  "Ice Storm Warning",
  "Law Enforcement Warning",
  ];

  // Date Ranges
  const dates = [
    "Today",
    "Last Week",
    "Last Month",
    "Last 3 Months",
    "Last 6 Months",
    "Last Year",
    "All Time",
  ];

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
  
  // Gather all alerts from the API (default action)
  useEffect(() => {
    // Fetch alerts from the API
    fetch(`${API_URL}/alerts/all`)
      .then((res) => res.json())
      .then((data) => {
        setAlertData(data);
      })
      .catch((error) => {
        console.error("Error fetching alerts:", error);
      });
  }, []);

  // Settinf the filtered data when alertData changes
  useEffect(() => {
    setFilteredData(alertData);
  }, [alertData]);

  // Handle location filter change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocationFilter(e.target.value);
  };
  
  // Handle date range filter change
  const handleDateRangeChange = (value: string) => {
    setDateRangeFilter(value);
  };
  
  // Handle alert type filter change
  const handleAlertTypeChange = (value: string) => {
    setAlertTypeFilter(value);
  };

  // Filtering function
  const filterAlerts = () => {
    let filtered = alertData;

    // Filter by location
    if (locationFilter) {
      filtered = filtered.filter((alert) =>
        alert.info?.area?.description?.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    // Filter by alert type
    if (alertTypeFilter) {
      filtered = filtered.filter((alert) =>
        alert.info?.event?.toLowerCase() === alertTypeFilter.toLowerCase()
      );
    }

    // Filter by date range
    if (dateRangeFilter) {
      const now = new Date();
      filtered = filtered.filter((alert) => {
        const alertDate = new Date(alert.sent || "");
        switch (dateRangeFilter) {
          case "Today":
            return alertDate.toDateString() === now.toDateString();
          case "Last Week":
            return alertDate >= new Date(now.setDate(now.getDate() - 7));
          case "Last Month":
            return alertDate >= new Date(now.setMonth(now.getMonth() - 1));
          case "Last 3 Months":
            return alertDate >= new Date(now.setMonth(now.getMonth() - 3));
          case "Last 6 Months":
            return alertDate >= new Date(now.setMonth(now.getMonth() - 6));
          case "Last Year":
            return alertDate >= new Date(now.setFullYear(now.getFullYear() - 1));
          case "All Time":
          default:
            return true;
        }
      });
    }

    setFilteredData(filtered);
  };

  // Add a handler for the button click
  const handleFilterButtonClick = () => {
    filterAlerts();
  };

  return(
    <div className="flex h-screen w-full flex-col bg-[#283648]">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start m-5">
          <div className="flex w-full justify-start text-3xl font-bold italic">SIREN</div>
          <div className="flex w-full justify-start txt-small font-light">Alert Data</div>
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


      {/* Body */}
      <div className="flex flex-col h-full min-w-[97%] m-0 gap-3 lg:m-3 xl:m-2 overflow-hidden">
        {/* Filter Header */}
        <div className="flex flex-col w-full h-auto border border-[#71717a] rounded-2xl p-3">
            <h1 className="font-bold text-2xl">Search For Alerts</h1>
            <div className="flex flex-row h-auto w-full justify-between gap-3">
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Location</p>
                  <input 
                    type="text" 
                    placeholder="Enter Location" 
                    className="w-full h-auto focus:outline-none border border-[#71717a] rounded-2xl bg-transparent p-4" 
                    value={locationFilter} 
                    onChange={handleLocationChange} 
                  />
                </div>
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Date Range</p>
                  <Select 
                    label="Range" 
                    variant="bordered" 
                    className="w-full h-auto border border-[#71717a] rounded-2xl" 
                    onChange={(e) => handleDateRangeChange(e.target.value)}
                  >
                    {dates.map((date) => (
                      <SelectItem key={date}>
                        {date}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Alert Types</p>
                  <Select 
                    label="Alert Type" 
                    variant="bordered" 
                    className="w-full h-auto border border-[#71717a] rounded-2xl" 
                    onChange={(e) => handleAlertTypeChange(e.target.value)}
                  >
                    {alertTypes.map((alert) => (
                      <SelectItem key={alert}>
                        {alert}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col w-[19%] mt-1 justify-end">
                  <Button 
                    className="h-3/5 w-full border border-[#71717a] rounded-xl bg-transparent text-white text-xs sm:text-xs md:text:xs lg:text-md xl:text-md truncate p-2" 
                    onClick={handleFilterButtonClick}
                  >
                    Search With Filters
                  </Button>
                </div>

            </div>
        </div>
  
  
        {/* Table Container */}
        <div className="flex flex-col w-full h-full border border-[#71717a] items-center justify-center rounded-2xl overflow-hidden">
          <div className="w-[98%] h-[95%] items-center border border-[#71717a] rounded-2xl bg-white overflow-y-auto">
            <Table removeWrapper aria-label="Example static collection table">
                <TableHeader className="bg-transparent">
                  <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">Alert Type</TableColumn>
                  <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">Alert Issued</TableColumn>
                  <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">Status</TableColumn>
                  <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">Location</TableColumn>
                </TableHeader>
                <TableBody>
                  {filteredData
                    .filter((data) => data.info) // Ensure `info` exists before mapping
                    .map((data, index) => (
                        <TableRow key={data._id || index} className="text-black border-b border-gray-300">
                        <TableCell className="border-r border-gray-300">{data.info?.event || "N/A"}</TableCell>
                        <TableCell className="border-r border-gray-300">{data.sent?.substring(0,10) || "N/A"}</TableCell>
                        <TableCell className="border-r border-gray-300">
                          {data.info?.expires && new Date(data.info.expires) > new Date() ? "Active" : "Inactive"}
                        </TableCell>
                        <TableCell>{data.info?.area?.description || "N/A"}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </div>
      </div>  
    </div>
  );
};

export default DataPage;
