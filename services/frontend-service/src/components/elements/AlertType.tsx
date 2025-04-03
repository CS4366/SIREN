const AlertType = ({alertType} : AlertTypeProps) => {
  return (
    <div className="h-auto w-full border border-[#FFFFFF] rounded-2xl flex flex-col justify-start bg-[#283648] text-white p-4">
      {alertType}
    </div>
  );
}

export default AlertType;

interface AlertTypeProps {
  alertType: string;
};