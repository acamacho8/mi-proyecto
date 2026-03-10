"use client";
import { useState } from "react";

const tiendas = [
  "FQ01 - Chacao",
  "FQ02 - Las Mercedes",
  "FQ03 - Altamira",
  "FQ04 - La Castellana",
  "FQ05 - Bello Monte",
];

const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const metodosPago = [
  { label: "Efectivo Tienda", moneda: "Bs" },
  { label: "Efectivo Tienda", moneda: "$" },
  { label: "Efectivo Delivery", moneda: "Bs" },
  { label: "Efectivo Delivery", moneda: "$" },
  { label: "Punto de Venta", moneda: "Bs" },
  { label: "Pago Móvil", moneda: "Bs" },
  { label: "Zelle", moneda: "$" },
  { label: "Depósito Banco", moneda: "Bs" },
];

const initialDia = () => {
  const obj: any = { tasa: "" };
  metodosPago.forEach(m => { obj[`${m.label}_${m.moneda}`] = ""; });
  return obj;
};

export default function ReportesPage() {
  const [tienda, setTienda] = useState("");
  const [semana, setSemana] = useState("");
  const [porcentaje, setPorcentaje] = useState("70");
  const [paso, setPaso] = useState(1);
  const [dias, setDias] = useState(diasSemana.map(() => initialDia()));
  const [descargando, setDescargando] = useState(false);

  const updateDia = (i: number, campo: string, valor: string) => {
    setDias(prev => {
      const nuevo = [...prev];
      nuevo[i] = { ...nuevo[i], [campo]: valor };
      return nuevo;
    });
  };

  const descargarReporte = async () => {
    setDescargando(true);
    try {
      const res = await fetch("/api/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tienda, semana, porcentaje, dias }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-${tienda}-${semana}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al generar el reporte");
    }
    setDescargando(false);
  };

  const pasos = ["Selección", "Datos", "Revisión", "Reporte"];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <header style={{ backgroundColor: "#C0392B", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", backgroundColor: "#F1C40F", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "18px", color: "#C0392B" }}>FQ</div>
          <span style={{ color: "white", fontWeight: "700", fontSize: "18px" }}>Generador de Reportes</span>
        </div>
        <div style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "20px", padding: "6px 16px", color: "white", fontSize: "14px" }}>Fullqueso IA</div>
      </header>

      <div style={{ backgroundColor: "white", borderBottom: "1px solid #eee", padding: "16px 32px", display: "flex", gap: "8px", alignItems: "center" }}>
        {pasos.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: paso >= i + 1 ? "#C0392B" : "#ddd", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", opacity: paso === i + 1 ? 1 : paso > i + 1 ? 0.7 : 0.4 }}>{i + 1}</div>
            <span style={{ fontSize: "14px", fontWeight: paso === i + 1 ? "700" : "400", color: paso === i + 1 ? "#C0392B" : "#888" }}>{p}</span>
            {i < pasos.length - 1 && <div style={{ width: "32px", height: "2px", backgroundColor: paso > i + 1 ? "#C0392B" : "#ddd", marginLeft: "4px" }} />}
          </div>
        ))}
      </div>

      <main style={{ maxWidth: "800px", margin: "32px auto", padding: "0 16px" }}>
        {paso === 1 && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ color: "#C0392B", marginBottom: "8px", fontSize: "22px" }}>Selección de Tienda y Semana</h2>
            <p style={{ color: "#888", marginBottom: "32px", fontSize: "14px" }}>Selecciona la tienda y la semana para generar el reporte</p>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", color: "#333" }}>Tienda</label>
              <select value={tienda} onChange={e => setTienda(e.target.value)} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${tienda ? "#C0392B" : "#eee"}`, borderRadius: "8px", fontSize: "15px", outline: "none" }}>
                <option value="">Selecciona una tienda...</option>
                {tiendas.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", color: "#333" }}>Semana (fecha de inicio)</label>
              <input type="date" value={semana} onChange={e => setSemana(e.target.value)} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${semana ? "#C0392B" : "#eee"}`, borderRadius: "8px", fontSize: "15px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", color: "#333" }}>Porcentaje a aplicar</label>
              <div style={{ display: "flex", gap: "12px" }}>
                {["70", "75"].map(p => (
                  <button key={p} onClick={() => setPorcentaje(p)} style={{ flex: 1, padding: "12px", border: `2px solid ${porcentaje === p ? "#C0392B" : "#eee"}`, borderRadius: "8px", fontSize: "16px", fontWeight: "700", backgroundColor: porcentaje === p ? "#C0392B" : "white", color: porcentaje === p ? "white" : "#333", cursor: "pointer" }}>{p}%</button>
                ))}
              </div>
            </div>
            <button onClick={() => setPaso(2)} disabled={!tienda || !semana} style={{ width: "100%", padding: "14px", backgroundColor: tienda && semana ? "#C0392B" : "#ddd", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: tienda && semana ? "pointer" : "not-allowed" }}>Continuar →</button>
          </div>
        )}

        {paso === 2 && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ color: "#C0392B", marginBottom: "8px", fontSize: "22px" }}>Datos de Ventas por Día</h2>
            <p style={{ color: "#888", marginBottom: "24px", fontSize: "14px" }}>{tienda} · Porcentaje: {porcentaje}%</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
              {diasSemana.map((dia, i) => (
                <div key={i} style={{ border: "2px solid #eee", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ backgroundColor: "#C0392B", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "white", fontWeight: "700", fontSize: "14px" }}>{dia}</span>
                    <span style={{ color: "#F1C40F", fontWeight: "700", fontSize: "13px" }}>{porcentaje}%</span>
                  </div>
                  <div style={{ padding: "12px 16px", backgroundColor: "#fffbea", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", whiteSpace: "nowrap" }}>Tasa de Cambio</label>
                    <input placeholder="0.00 Bs/$" value={dias[i].tasa} onChange={e => updateDia(i, "tasa", e.target.value)} style={{ flex: 1, padding: "6px 10px", border: "1px solid #F1C40F", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {metodosPago.map((metodo, j) => (
                      <div key={j}>
                        <label style={{ fontSize: "11px", color: "#888", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                          {metodo.label} <span style={{ color: metodo.moneda === "$" ? "#27AE60" : "#C0392B" }}>{metodo.moneda}</span>
                        </label>
                        <input placeholder={`0.00 ${metodo.moneda}`} value={dias[i][`${metodo.label}_${metodo.moneda}`]} onChange={e => updateDia(i, `${metodo.label}_${metodo.moneda}`, e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${metodo.moneda === "$" ? "#d5f5e3" : "#eee"}`, borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setPaso(1)} style={{ flex: 1, padding: "14px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setPaso(3)} style={{ flex: 2, padding: "14px", backgroundColor: "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>Continuar →</button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ color: "#C0392B", marginBottom: "8px", fontSize: "22px" }}>Revisión</h2>
            <p style={{ color: "#888", marginBottom: "24px", fontSize: "14px" }}>Revisa los datos antes de generar el reporte</p>
            <div style={{ backgroundColor: "#fff5f5", borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
              <div style={{ fontWeight: "700", color: "#C0392B", marginBottom: "12px" }}>📋 Resumen</div>
              <div style={{ fontSize: "14px", color: "#333", marginBottom: "8px" }}>🏪 Tienda: <strong>{tienda}</strong></div>
              <div style={{ fontSize: "14px", color: "#333", marginBottom: "8px" }}>📅 Semana: <strong>{semana}</strong></div>
              <div style={{ fontSize: "14px", color: "#333" }}>📊 Porcentaje: <strong>{porcentaje}%</strong></div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setPaso(2)} style={{ flex: 1, padding: "14px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>← Atrás</button>
              <button onClick={() => setPaso(4)} style={{ flex: 2, padding: "14px", backgroundColor: "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>Generar Reporte →</button>
            </div>
          </div>
        )}

        {paso === 4 && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
            <h2 style={{ color: "#C0392B", marginBottom: "8px", fontSize: "22px" }}>¡Reporte Listo!</h2>
            <p style={{ color: "#888", marginBottom: "32px", fontSize: "14px" }}>El reporte de {tienda} está listo para descargar</p>
            <button onClick={descargarReporte} disabled={descargando} style={{ width: "100%", padding: "14px", backgroundColor: descargando ? "#ddd" : "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: descargando ? "not-allowed" : "pointer", marginBottom: "12px" }}>
              {descargando ? "⏳ Generando..." : "⬇️ Descargar Excel"}
            </button>
            <button onClick={() => { setPaso(1); setTienda(""); setSemana(""); setDias(diasSemana.map(() => initialDia())); }} style={{ width: "100%", padding: "14px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>
              Generar otro reporte
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
