//import { useState } from "react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  useDisclosure,
} from "@heroui/react";
import ClockIcon from "../../assets/clock-icon.png";
import PinIcon from "../../assets/pin-icon.png";

function truncate(str, maxLength) {
  return str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;
}

// Alert component
const Alert = ({
  alertType,
  alertIssue,
  alertStartTime,
  alertEndTime,
  alertDescription,
  alertInstructions,
  alertAreas,
  alertHistory,
  color,
  onShowOnMap,
}: AlertProps) => {
  // Drawer dependdencies
  const { isOpen, onOpen, onOpenChange } = useDisclosure();


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
          onPress={onOpen}
        >
          View Details
        </Button>
        {/* Drawer Expands on Click */}
        <Drawer
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          placement="left"
          size="xl"
          backdrop="transparent"
        >
          <DrawerContent className="bg-[#283648] text-white">
            {(onClose) => (
              <>
                {/* Drawer Header */}
                <DrawerHeader className="flex flex-col gap-1 font-bold text-3xl">
                  {/* Header Info */}
                  <div className="flex flex-row items-center">
                    {alertType}
                    <div
                      className="mx-1 w-7 h-7 ml-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </DrawerHeader>
                {/* Drawer Body */}
                <DrawerBody>
                  {/* Drawer Body Info (Needs to be modularized once API is finished) */}
                  <p>{alertIssue}</p>
                  <p>
                    Issued at {new Date(alertStartTime).toLocaleString("en-US")}{" "}
                    | Expires at{" "}
                    {new Date(alertEndTime).toLocaleString("en-US")}
                  </p>
                  <h4 className="font-bold text-xl">Alert Description:</h4>
                  <p>{alertDescription}</p>
                  <h4 className="font-bold text-xl">Safety Instructions:</h4>
                  <p>{alertInstructions}</p>
                  <h4 className="font-bold text-xl">Alert History:</h4>
                  {alertHistory.map((history, index) => (
                    <div key={index} className="flex flex-col">
                      <p className="font-bold">{history}</p>
                      <p>{new Date(alertStartTime).toLocaleString("en-US")}</p>
                    </div>
                  ))}
                </DrawerBody>
                {/* Drawer Footer */}
                <DrawerFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Close
                  </Button>
                </DrawerFooter>
              </>
            )}
          </DrawerContent>
        </Drawer>
        {/* Button To Show Alert on Map (Maybe zoom in on area to implement)*/}
        <Button className="h-2/3 w-full text-white  border border-white bg-transparent text-xs p-2" onPress={onShowOnMap} >
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
  alertIssue: string;
  alertAreas: string;
  alertStartTime: string;
  alertEndTime: string;
  alertDescription: string[];
  alertInstructions: string;
  alertHistory: string[];
  color: string;
  onShowOnMap: () => void;
}