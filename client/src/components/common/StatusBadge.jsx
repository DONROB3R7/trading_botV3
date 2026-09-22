export default function StatusBadge({
  status,
}) {
  const running =
    status === "RUNNING";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 6,
        background: running
          ? "#d9f7df"
          : "#eee",
        color: running
          ? "#176b2c"
          : "#555",
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {status}
    </span>
  );
}