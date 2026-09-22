export default function StatCard({
  label,
  value,
  subtitle,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 16,
        minWidth: 150,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#666",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: "bold",
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: "#777",
            marginTop: 5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}