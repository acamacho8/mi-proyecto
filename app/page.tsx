import Link from "next/link";

export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      backgroundColor: "#f5f5f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif"
    }}>
      <div style={{
        backgroundColor: "black",
        borderRadius: "12px",
        padding: "48px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%"
      }}>
        <div style={{
          width: "64px", height: "64px",
          backgroundColor: "#C0392B",
          borderRadius: "16px",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: "28px", fontWeight: "900", color: "#F1C40F"
        }}>FQ</div>
        <h1 style={{ color: "#C0392B", marginBottom: "8px", fontSize: "24px" }}>
          Fullqueso Reportes
        </h1>
        <p style={{ color: "#888", marginBottom: "32px", fontSize: "14px" }}>
          Generador de reportes de cierre diario
        </p>
        <Link href="/reportes" style={{
          display: "block", padding: "14px",
          backgroundColor: "#C0392B", color: "white",
          borderRadius: "8px", fontSize: "16px",
          fontWeight: "700", textDecoration: "none"
        }}>
          Generar Reporte →
        </Link>
      </div>
    </main>
  );
}
