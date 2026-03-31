export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>Lightsee</h1>
        <p style={{ fontSize: "18px", opacity: 0.7 }}>Markdown viewer and sharing platform</p>
      </div>
    </div>
  );
}
