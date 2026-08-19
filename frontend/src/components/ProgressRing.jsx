const COLORS = {
  amber: "#C9820A",
  teal: "#2E7D5B",
  red: "#B3433A",
};

export default function ProgressRing({ progreso, colorKey, centerLabel, centerSub }) {
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progreso)));
  const color = COLORS[colorKey] || COLORS.amber;

  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E4E2D6"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="50%" y="46%" textAnchor="middle" fontSize="17" fill="#1E2B22">
        {centerLabel}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="9" fill="#5C6B5F">
        {centerSub}
      </text>
    </svg>
  );
}
