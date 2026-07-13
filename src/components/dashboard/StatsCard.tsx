import "./StatsCard.css";

type StatsCardProps = {
  title: string;
  value: number;
};

const StatsCard = ({ title, value }: StatsCardProps) => {
  return (
    <div className="stats-card">
      <p className="stats-title">{title}</p>

      <h2 className="stats-value">{value}</h2>
    </div>
  );
};

export default StatsCard;
