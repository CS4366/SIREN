import { useEffect, useState } from "react";
import {
  Button,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
} from "@heroui/react";
import { useAlertContext } from "../context/AlertContext";
import { SirenAlert } from "../../model/Alert";

// Main component for the DataPage
const DataPage = () => {
  // State variables for push and API connection status
  const { isPushConnected, isAPIConnected, alertData } = useAlertContext();

  // State variables for filters
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("");
  // State variable for alert data
  const [filteredData, setFilteredData] = useState<SirenAlert[]>([]);

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
        alert.capInfo?.info?.area?.description
          ?.toLowerCase()
          .includes(locationFilter.toLowerCase())
      );
    }

    // Filter by alert type
    if (alertTypeFilter) {
      filtered = filtered.filter(
        (alert) =>
          alert.capInfo?.info.event?.toLowerCase() ===
          alertTypeFilter.toLowerCase()
      );
    }

    // Filter by date range
    if (dateRangeFilter) {
      const now = new Date();
      filtered = filtered.filter((alert) => {
        const alertDate = new Date(alert.mostRecentSentTime || "");
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
            return (
              alertDate >= new Date(now.setFullYear(now.getFullYear() - 1))
            );
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

  return (
    <div className="flex h-screen w-full flex-col bg-[#283648]">
      {/* Header */}
      <div className="flex w-full flex-row justify-between ">
        {/* Page Info */}
        <div className="flex-col w-full justify-start m-5">
          <div className="flex w-full justify-start text-3xl font-bold italic">
            SIREN
          </div>
          <div className="flex w-full justify-start txt-small font-light">
            Alert Data
          </div>
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
          <h1 className="font-bold text-2xl mb-2">Search For Alerts</h1>
          <div className="flex flex-row h-auto w-full justify-between gap-3">
            <div className="flex w-full">
              <Input
                type="text"
                placeholder=""
                label="Location"
                variant="bordered"
                className="w-full h-full"
                size="sm"
                value={locationFilter}
                onChange={handleLocationChange}
              />
            </div>
            <div className="flex w-full">
              <Select
                label="Range"
                className="w-full rounded-2xl"
                variant="bordered"
                size="sm"
                onChange={(e) => handleDateRangeChange(e.target.value)}
              >
                {dates.map((date) => (
                  <SelectItem key={date}>{date}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex w-full">
              <Select
                label="Alert Type"
                className="w-full rounded-2xl"
                variant="bordered"
                size="sm"
                onChange={(e) => handleAlertTypeChange(e.target.value)}
              >
                {alertTypes.map((alert) => (
                  <SelectItem key={alert}>{alert}</SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex-2 flex-col justify-center light">
              <Button onPress={handleFilterButtonClick} size="lg">
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex flex-col w-full h-full border border-[#71717a] items-center justify-center rounded-2xl overflow-hidden">
          <div className="w-[98%] h-[95%] items-center border border-[#71717a] rounded-2xl bg-white overflow-y-auto">
            <Table removeWrapper aria-label="Example static collection table">
              <TableHeader className="bg-transparent">
                <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">
                  Alert Type
                </TableColumn>
                <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">
                  Alert Issued
                </TableColumn>
                <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">
                  Status
                </TableColumn>
                <TableColumn className="bg-transparent w-1/4 text-black font-bold text-lg border-b border-gray-300">
                  Location
                </TableColumn>
              </TableHeader>
              <TableBody>
                {filteredData
                  .filter((data) => data.capInfo) // Ensure `info` exists before mapping
                  .map((data, index) => (
                    <TableRow
                      key={data.identifier || index}
                      className="text-black border-b border-gray-300"
                    >
                      <TableCell className="border-r border-gray-300">
                        {data.capInfo.info.event || "N/A"}
                      </TableCell>
                      <TableCell className="border-r border-gray-300">
                        {data.mostRecentSentTime.toLocaleString("en-US") ||
                          "N/A"}
                      </TableCell>
                      <TableCell className="border-r border-gray-300">
                        {data.state || "N/A"}
                      </TableCell>
                      <TableCell>
                        {data.capInfo.info.area?.description || "N/A"}
                      </TableCell>
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
