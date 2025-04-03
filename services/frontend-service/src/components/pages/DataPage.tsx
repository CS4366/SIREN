import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Button, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";

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

const DataPage = () => {
  // State variables for push and API connection status
  const [isPushConnected, setIsPushConnected] = useState(socket.connected);
  const [isAPIConnected, setIsAPIConnected] = useState(false);
  

  // TODO
  // getAllAlerts(default)
  // getAlertsByCriteria



  // Table test data (will be pulled from API later)
  const testData = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    alertType: `Alert Type ${index + 1}`,
    alertIssued: `2023-10-${String(index + 1).padStart(2, "0")}`,
    status: index % 2 === 0 ? "Active" : "Inactive",
    location: `Location ${index + 1}`,
  }));

  // Alert types will change later when we have a full list of alerts
  const alertTypes = [
    { id: 1, name: "Tornado Watch" },
    { id: 2, name: "Tornado Warning" },
    { id: 3, name: "Servere Thunderstorm Watch" },
    { id: 4, name: "Servere Thunderstorm Warning" },
    { id: 5, name: "Winter Storm" },
    { id: 6, name: "High Wind Advisory" },
    { id: 7, name: "Special Weather Event" },
  ]


  // Date Ranges
  const dates = [
    { id: 1, name: "Last Dat" },
    { id: 2, name: "Last Week" },
    { id: 3, name: "Last Month" },
    { id: 4, name: "Last 3 Months" },
    { id: 5, name: "Last 6 Months" },
    { id: 6, name: "Last Year" },
    { id: 7, name: "All Time" },
  ]


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
      <div className="flex flex-col h-full min-w-[97%] m-0 gap-3 lg:m-5 xl:m-5 overflow-hidden">
        {/* Filter Header */}
        <div className="flex flex-col w-full h-auto border border-[#71717a] rounded-2xl p-3">
            <h1 className="font-bold text-2xl">Search For Alerts</h1>
            <div className="flex flex-row h-auto w-full justify-between gap-3">
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Location</p>
                  <input type="text" placeholder="Enter Location" className="w-full h-auto border border-[#71717a] rounded-2xl bg-transparent p-4" />
                </div>
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Date Range</p>
                  <Select label="Range" variant="bordered" className="w-full h-auto border border-[#71717a] rounded-2xl">
                    {dates.map((date) => (
                      <SelectItem key={date.id}>
                        {date.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col w-[27%] mt-1 gap-3">
                  <p className="font-bold text-md">Alert Types</p>
                  <Select label="Alert Type" variant="bordered" className="w-full h-auto border border-[#71717a] rounded-2xl">
                    {alertTypes.map((alert) => (
                      <SelectItem key={alert.id}>
                        {alert.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col w-[19%] mt-1 justify-end">
                  <Button className="h-3/5 w-full border border-[#71717a] rounded-xl bg-transparent text-white text-xs sm:text-xs md:text:xs lg:text-md xl:text-md truncate p-2">
                  Search With Filters
                  </Button>
                </div>

            </div>
        </div>
  
  
        {/* Table Container */}
        <div className="flex flex-col w-full max-h-4/5 border border-[#71717a] items-center justify-center rounded-2xl overflow-hidden">
          <div className="w-[98%] h-[95%] items-center border border-[#71717a] rounded-2xl bg-white overflow-y-auto">
            <Table removeWrapper aria-label="Example static collection table">
                <TableHeader className="bg-transparent">
                  <TableColumn className="bg-transparent text-black font-bold text-lg border-b border-gray-300">Alert Type</TableColumn>
                  <TableColumn className="bg-transparent text-black font-bold text-lg border-b border-gray-300">Alert Issued</TableColumn>
                  <TableColumn className="bg-transparent text-black font-bold text-lg border-b border-gray-300">Status</TableColumn>
                  <TableColumn className="bg-transparent text-black font-bold text-lg border-b border-gray-300">Location</TableColumn>
                </TableHeader>
                <TableBody>
                  {testData.map((data) => (
                        <TableRow key={data.id} className="text-black border-b border-gray-300">
                        <TableCell className="border-r border-gray-300">{data.alertType}</TableCell>
                        <TableCell className="border-r border-gray-300">{data.alertIssued}</TableCell>
                        <TableCell className="border-r border-gray-300">{data.status}</TableCell>
                        <TableCell>{data.location}</TableCell>
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
