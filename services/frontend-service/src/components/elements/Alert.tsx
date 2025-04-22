//import { useState } from "react";
import { Button } from "@heroui/react";
import ClockIcon from "../../assets/clock-icon.png";
import PinIcon from "../../assets/pin-icon.png";

function truncate(str, maxLength) {
  return str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;
}

// Alert component
const Alert = ({
  alertType,
  alertEndTime,
  alertAreas,
  color,
  onShowOnMap,
  onShowDetails,
}: AlertProps) => {
  // Drawer dependdencies

  return (
    // Alert component
    <div className="flex flex-row border border-b border-[#71717a] rounded-2xl mr-3 ml-3 mb-3 items-center">
      <div className="flex flex-col w-full h-full justify-between gap-3 p-3">
        {/* Alert Type and Color */}
        <div className="flex flex-row items-center text-xs">
          <h1 className="font-bold text-xs md:text-sm lg:text-lg">
            {alertType}
          </h1>
          <div
            className="mx-1 w-4 h-4 ml-3 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        {/* Alert Areas */}
        <div className="flex flex-row text-xs">
          <img src={PinIcon} alt="clock icon" className="w-4 h-4 mr-1" />
          <p className="text-xs">{truncate(alertAreas, 255)}</p>
        </div>
        {/* Alert End Time */}
        <div className="flex flex-row text-xs">
          <img src={ClockIcon} alt="pin icon" className="w-4 h-4 mr-1" />
          <p className="text-xs">
            Until {new Date(alertEndTime).toLocaleString("en-US")}
          </p>
        </div>
      </div>
      {/* Button Container */}
      <div className="flex flex-col w-1/3 h-full justify-center items-center space-y-2 m-3">
        {/* Button To Expand Alert Details */}
        <Button
          className="h-2/3 w-full border border-white bg-white text-[#283648] text-xs p-2"
          onPress={onShowDetails}
        >
          View Details
        </Button>
        {/* Button To Show Alert on Map (Maybe zoom in on area to implement)*/}
        <Button
          className="h-2/3 w-full text-white  border border-white bg-transparent text-xs p-2"
          onPress={onShowOnMap}
        >
          Show on Map
        </Button>
      </div>
    </div>
  );
};

export default Alert;

// Alert component props
interface AlertProps {
  alertType: string;
  alertAreas: string;
  alertEndTime: string;
  color: string;
  onShowOnMap: () => void;
  onShowDetails: () => void;
}
