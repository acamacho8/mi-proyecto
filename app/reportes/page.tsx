"use client";
import { useState, useCallback, useRef } from "react";
import { useDrivePicker } from "@/app/lib/useDrivePicker";

const tiendas = [
  "FQ28 - El Marques",
  "FQ01 - Sambil Caracas",
  "FQ88 - Sambil La Candelaria",
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

const sistemaMetodos = [
  { label: "Punto de Venta",    moneda: "Bs" },
  { label: "Pago Móvil",        moneda: "Bs" },
  { label: "Efectivo Tienda",   moneda: "Bs" },
  { label: "Efectivo Tienda",   moneda: "$"  },
  { label: "Efectivo Delivery", moneda: "Bs" },
  { label: "Efectivo Delivery", moneda: "$"  },
  { label: "Zelle",             moneda: "$"  },
  { label: "Depósito Banco",    moneda: "Bs" },
];

const initialDia = () => {
  const obj: any = { tasa: "" };
  metodosPago.forEach(m => { obj[`${m.label}_${m.moneda}`] = ""; });
  sistemaMetodos.forEach(m => { obj[`sist_${m.label}_${m.moneda}`] = ""; });
  return obj;
};

const initialImagenes = () => ({ reporteZ: null as string | null, cierrePDV: null as string | null });

function calcularResumenDia(dia: any, pct: number) {
  const n = (v: any) => parseFloat(String(v ?? "").replace(",", ".")) || 0;
  const tasa = n(dia.tasa);
  if (tasa <= 0) return null;

  const metodos = [
    { pos: false, bsKey: "Efectivo Tienda_Bs",    usdKey: "Efectivo Tienda_$",    sBsKey: "sist_Efectivo Tienda_Bs",    sUsdKey: "sist_Efectivo Tienda_$" },
    { pos: false, bsKey: "Efectivo Delivery_Bs",  usdKey: "Efectivo Delivery_$",  sBsKey: "sist_Efectivo Delivery_Bs",  sUsdKey: "sist_Efectivo Delivery_$" },
    { pos: true,  bsKey: "Punto de Venta_Bs",     usdKey: null,                   sBsKey: "sist_Punto de Venta_Bs",     sUsdKey: null },
    { pos: false, bsKey: "Pago Móvil_Bs",         usdKey: null,                   sBsKey: "sist_Pago Móvil_Bs",         sUsdKey: null },
    { pos: false, bsKey: null,                    usdKey: "Zelle_$",              sBsKey: null,                         sUsdKey: "sist_Zelle_$" },
    { pos: false, bsKey: "Depósito Banco_Bs",     usdKey: null,                   sBsKey: "sist_Depósito Banco_Bs",     sUsdKey: null },
  ];

  let contado = 0;
  let sistema = 0;
  for (const m of metodos) {
    const factor = m.pos ? 1 : (pct / 100);
    const bs  = m.bsKey  ? n(dia[m.bsKey])  : 0;
    const usd = m.usdKey ? n(dia[m.usdKey]) : 0;
    contado += (bs / tasa + usd) * factor;

    const sBs  = m.sBsKey  ? n(dia[m.sBsKey])  : 0;
    const sUsd = m.sUsdKey ? n(dia[m.sUsdKey]) : 0;
    sistema += (sBs / tasa + sUsd) * (pct / 100);
  }

  const sobrante = sistema > 0 ? contado - sistema : null;
  return { contado, sistema, sobrante };
}

function leerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReportesPage() {
  const [tienda, setTienda] = useState("");
  const [semana, setSemana] = useState("");
  const [porcentaje, setPorcentaje] = useState("75");
  const [paso, setPaso] = useState(1);
  const [dias, setDias] = useState(diasSemana.map(() => initialDia()));
  const [imagenes, setImagenes] = useState(diasSemana.map(() => initialImagenes()));
  const [descargando, setDescargando] = useState(false);
  const [cargandoCRM, setCargandoCRM] = useState<number | null>(null);
  const [cargandoTodos, setCargandoTodos] = useState(false);
  const [expandidos, setExpandidos] = useState<boolean[]>(diasSemana.map(() => false));

  const toggleExpandido = (i: number) =>
    setExpandidos(prev => prev.map((v, idx) => idx === i ? !v : v));

  const cargarTodosCRM = async () => {
    if (!tienda || !semana) return;
    setCargandoTodos(true);
    await Promise.all(diasSemana.map((_, i) => cargarDesdeCRM(i)));
    setCargandoTodos(false);
  };

  const cargarDesdeCRM = async (i: number) => {
    if (!tienda || !semana) return;
    const shopCode = tienda.split(" ")[0]; // "FQ01 - Chacao" → "FQ01"
    const fecha = new Date(semana + "T00:00:00");
    fecha.setDate(fecha.getDate() + i);
    const date = fecha.toISOString().split("T")[0];
    setCargandoCRM(i);
    try {
      const res = await fetch(`/api/crm-dia?date=${date}&shopCode=${shopCode}`);
      const json = await res.json();
      if (json.error) { alert("CRM: " + json.error); return; }
      setDias(prev => {
        const nuevo = [...prev];
        nuevo[i] = { ...nuevo[i], ...json };
        return nuevo;
      });
      setExpandidos(prev => prev.map((v, idx) => idx === i ? true : v));
    } catch {
      alert("Error al conectar con el CRM");
    } finally {
      setCargandoCRM(null);
    }
  };

  // Google Drive Picker
  const pickerTarget = useRef<{ i: number; tipo: "reporteZ" | "cierrePDV" } | null>(null);
  const handleDrivePicked = useCallback((dataUrl: string) => {
    if (!pickerTarget.current) return;
    const { i, tipo } = pickerTarget.current;
    setImagenes(prev => {
      const nuevo = [...prev];
      nuevo[i] = { ...nuevo[i], [tipo]: dataUrl };
      return nuevo;
    });
  }, []);
  const openDrive = useDrivePicker(handleDrivePicked);
  const openDriveForField = async (i: number, tipo: "reporteZ" | "cierrePDV") => {
    pickerTarget.current = { i, tipo };
    try {
      await openDrive(diasSemana[i]);
    } catch (err: any) {
      console.error("Drive Picker error:", err);
      alert("Error al abrir Google Drive: " + (err?.message ?? String(err)));
    }
  };

  const updateDia = (i: number, campo: string, valor: string) => {
    setDias(prev => {
      const nuevo = [...prev];
      nuevo[i] = { ...nuevo[i], [campo]: valor };
      return nuevo;
    });
  };

  const handleImagen = async (i: number, tipo: "reporteZ" | "cierrePDV", file: File | null) => {
    if (!file) return;
    const base64 = await leerBase64(file);
    setImagenes(prev => {
      const nuevo = [...prev];
      nuevo[i] = { ...nuevo[i], [tipo]: base64 };
      return nuevo;
    });
  };

  const descargarReporte = async () => {
    setDescargando(true);
    try {
      const res = await fetch("/api/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tienda, semana, porcentaje, dias, imagenes }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cierre-${tienda}-${semana}.xlsx`;
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
                {["75", "80"].map(p => (
                  <button key={p} onClick={() => setPorcentaje(p)} style={{ flex: 1, padding: "12px", border: `2px solid ${porcentaje === p ? "#C0392B" : "#eee"}`, borderRadius: "8px", fontSize: "16px", fontWeight: "700", backgroundColor: porcentaje === p ? "#C0392B" : "white", color: porcentaje === p ? "white" : "#333", cursor: "pointer" }}>{p}%</button>
                ))}
              </div>
            </div>
            <button onClick={() => setPaso(2)} disabled={!tienda || !semana} style={{ width: "100%", padding: "14px", backgroundColor: tienda && semana ? "#C0392B" : "#ddd", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: tienda && semana ? "pointer" : "not-allowed" }}>Continuar →</button>
          </div>
        )}

        {paso === 2 && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <h2 style={{ color: "#C0392B", fontSize: "22px", margin: 0 }}>Datos de Ventas por Día</h2>
              <button
                onClick={cargarTodosCRM}
                disabled={cargandoTodos}
                style={{ padding: "8px 16px", backgroundColor: cargandoTodos ? "#aaa" : "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: cargandoTodos ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
              >
                {cargandoTodos ? "⏳ Cargando..." : "📥 Cargar 7 días"}
              </button>
            </div>
            <p style={{ color: "#888", marginBottom: "24px", fontSize: "14px" }}>{tienda} · Porcentaje: {porcentaje}%</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
              {diasSemana.map((dia, i) => (
                <div key={i} style={{ border: `2px solid ${expandidos[i] ? "#C0392B" : "#eee"}`, borderRadius: "8px", overflow: "hidden", transition: "border-color 0.2s" }}>
                  <div
                    onClick={() => toggleExpandido(i)}
                    style={{ backgroundColor: expandidos[i] ? "#C0392B" : "#f7f7f7", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: expandidos[i] ? "white" : "#333", fontWeight: "700", fontSize: "14px" }}>{dia}</span>
                      {!expandidos[i] && (() => {
                        const r = calcularResumenDia(dias[i], parseFloat(porcentaje) || 0);
                        if (!r) return null;
                        const fmt = (v: number) => v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", color: "#888" }}>Sist: <strong style={{ color: "#2980B9" }}>${fmt(r.sistema)}</strong></span>
                            {r.sobrante !== null && (
                              <span style={{ fontSize: "12px", fontWeight: "700", color: r.sobrante >= 0 ? "#27AE60" : "#E74C3C" }}>
                                {r.sobrante >= 0 ? "+" : ""}{fmt(r.sobrante)}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); cargarDesdeCRM(i); }}
                        disabled={cargandoCRM === i}
                        title="Cargar valores del sistema desde el CRM"
                        style={{ padding: "4px 10px", backgroundColor: cargandoCRM === i ? "#aaa" : "#F1C40F", color: "#C0392B", border: "none", borderRadius: "5px", fontSize: "12px", fontWeight: "700", cursor: cargandoCRM === i ? "not-allowed" : "pointer" }}
                      >
                        {cargandoCRM === i ? "⏳" : "📥 CRM"}
                      </button>
                      <span style={{ color: expandidos[i] ? "#F1C40F" : "#aaa", fontWeight: "700", fontSize: "13px" }}>{expandidos[i] ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {expandidos[i] && <>
                  <div style={{ padding: "12px 16px", backgroundColor: "#fffbea", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", whiteSpace: "nowrap" }}>Tasa de Cambio</label>
                    <input placeholder="0.00 Bs/$" value={dias[i].tasa} onChange={e => updateDia(i, "tasa", e.target.value)} style={{ flex: 1, padding: "6px 10px", border: "1px solid #F1C40F", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }} />
                  </div>
                  {/* Valores del Sistema (Reporte Z) */}
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #eee", backgroundColor: "#f0f4ff" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#2C3E50", marginBottom: "10px" }}>
                      📊 Valores del Sistema (Reporte Z)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {sistemaMetodos.map((m, j) => (
                        <div key={j}>
                          <label style={{ fontSize: "11px", color: "#555", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                            {m.label} <span style={{ color: m.moneda === "$" ? "#27AE60" : "#2980B9" }}>{m.moneda}</span>
                          </label>
                          <input
                            placeholder={`0.00 ${m.moneda}`}
                            value={dias[i][`sist_${m.label}_${m.moneda}`]}
                            onChange={e => updateDia(i, `sist_${m.label}_${m.moneda}`, e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", border: "1px solid #c5d3e8", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", backgroundColor: "white" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumen de cálculo en vivo */}
                  {(() => {
                    const r = calcularResumenDia(dias[i], parseFloat(porcentaje) || 0);
                    if (!r) return null;
                    const fmt = (v: number) => v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const diff = r.sobrante;
                    return (
                      <div style={{ padding: "10px 16px", borderTop: "1px solid #eee", backgroundColor: "#f8f9fa", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "100px", textAlign: "center" }}>
                          <div style={{ fontSize: "10px", color: "#888", fontWeight: "700", marginBottom: "2px" }}>CONTADO ({porcentaje}%)</div>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#2C3E50" }}>${fmt(r.contado)}</div>
                        </div>
                        {r.sistema > 0 && (
                          <>
                            <div style={{ flex: 1, minWidth: "100px", textAlign: "center" }}>
                              <div style={{ fontSize: "10px", color: "#888", fontWeight: "700", marginBottom: "2px" }}>SISTEMA ({porcentaje}%)</div>
                              <div style={{ fontSize: "14px", fontWeight: "700", color: "#2980B9" }}>${fmt(r.sistema)}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: "100px", textAlign: "center" }}>
                              <div style={{ fontSize: "10px", color: "#888", fontWeight: "700", marginBottom: "2px" }}>DIFERENCIA</div>
                              <div style={{ fontSize: "14px", fontWeight: "700", color: diff !== null && diff >= 0 ? "#27AE60" : "#E74C3C" }}>
                                {diff !== null ? (diff >= 0 ? "+" : "") + fmt(diff) : "—"}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Carga de imágenes */}
                  <div style={{ padding: "12px 16px", borderTop: "1px solid #eee", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "#fafafa" }}>
                    {(["reporteZ", "cierrePDV"] as const).map(tipo => {
                      const label = tipo === "reporteZ" ? "Reporte Z" : "Cierre Punto de Venta";
                      const val = imagenes[i][tipo];
                      return (
                        <div key={tipo}>
                          <label style={{ fontSize: "11px", color: "#555", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                            📎 {label}
                          </label>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{
                              display: "flex", alignItems: "center", gap: "8px",
                              padding: "8px 10px", borderRadius: "6px", cursor: "pointer",
                              border: `1px dashed ${val ? "#27AE60" : "#bbb"}`,
                              backgroundColor: val ? "#f0fff4" : "white",
                              fontSize: "12px", color: val ? "#27AE60" : "#888",
                            }}>
                              <span>{val ? "✓ Cargado" : "📁 Subir archivo"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={e => handleImagen(i, tipo, e.target.files?.[0] ?? null)}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => openDriveForField(i, tipo)}
                              style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                padding: "8px 10px", borderRadius: "6px", cursor: "pointer",
                                border: "1px solid #4285F4", backgroundColor: "white",
                                fontSize: "12px", color: "#4285F4", fontWeight: "600",
                              }}
                            >
                              <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" alt="Drive" style={{ width: "14px", height: "14px" }} />
                              Seleccionar desde Drive
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>}
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
              <div style={{ fontSize: "14px", color: "#333", marginBottom: "8px" }}>📊 Porcentaje: <strong>{porcentaje}%</strong></div>
              <div style={{ fontSize: "14px", color: "#333" }}>
                📎 Imágenes cargadas: <strong>{imagenes.reduce((n, img) => n + (img.reporteZ ? 1 : 0) + (img.cierrePDV ? 1 : 0), 0)}</strong> / 14
              </div>
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
            <button onClick={() => { setPaso(1); setTienda(""); setSemana(""); setDias(diasSemana.map(() => initialDia())); setImagenes(diasSemana.map(() => initialImagenes())); }} style={{ width: "100%", padding: "14px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "16px", fontWeight: "700", cursor: "pointer" }}>
              Generar otro reporte
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
