"use client";
import { useState } from "react";
import { useDriveNav, DriveFile } from "@/app/lib/useDriveNav";

const STORES = [
  { code: "FQ01", label: "FQ01 · Chacao" },
  { code: "FQ88", label: "FQ88 · Candelaria" },
  { code: "FQ28", label: "FQ28 · Marqués" },
];

const BC_FIELDS = [
  { key: "modelo",              label: "Modelo",                 hint: "" },
  { key: "serialNo",            label: "Serial No.",             hint: "" },
  { key: "numeroReporte",       label: "Numero Reporte",         hint: "" },
  { key: "firstInvoiceNo",      label: "First Invoice No.",      hint: "Primer número del día" },
  { key: "lastInvoiceNo",       label: "Last Invoice No.",       hint: "Último número del día" },
  { key: "reporteZTotalAmount", label: "Reporte Z Total Amount", hint: "Sin IGTF" },
  { key: "igtfAmount",          label: "IGTF Amount",            hint: "" },
];

const parseReporteZ = (text: string) => {
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);

  const find = (pattern: RegExp): string | null => {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) return m[1]?.trim() || null;
    }
    const m = text.match(pattern);
    return m ? m[1]?.trim() || null : null;
  };

  const findNum = (pattern: RegExp): number | null => {
    const v = find(pattern);
    if (!v) return null;
    return parseFloat(v.replace(/\./g, "").replace(",", "."));
  };

  const modelo = find(/modelo[:\s]+([A-Z0-9\-]+)/i) || find(/(HKA-\d+)/i);
  const serialNo = find(/serial[:\s#. ]+([A-Z0-9]+)/i) || find(/n[uú]mero\s+de\s+m[aá]quina[:\s]+([A-Z0-9]+)/i);
  const numeroReporte = find(/reporte\s*z[:\s#]*\s*(\d+)/i) || find(/n[uú]m(?:ero)?\s*reporte[:\s]+(\d+)/i);
  const firstInvoiceNo = findNum(/first\s+invoice[:\s]+(\d+)/i) || findNum(/primer[a]?\s+factura[:\s]+(\d+)/i) || findNum(/desde[:\s#]+(\d+)/i) || findNum(/inicio[:\s]+(\d+)/i);
  const lastInvoiceNo = findNum(/last\s+invoice[:\s]+(\d+)/i) || findNum(/[uú]ltim[a]?\s+factura[:\s]+(\d+)/i) || findNum(/hasta[:\s#]+(\d+)/i) || findNum(/fin[:\s]+(\d+)/i);
  const totalVenta = findNum(/total\s+venta\s+([\d.,]+)/i);
  const igtfVenta = findNum(/igtf\s+venta\s*\(?3[,.]?00%?\)?\s+([\d.,]+)/i) || findNum(/igtf\s+venta[:\s]+([\d.,]+)/i);
  const totalNotaDebito = findNum(/total\s+nota\s+d[eé]bito\s+([\d.,]+)/i);
  const igtfNotaDebito = findNum(/igtf\s+nota\s+d[eé]bito\s*\(?3[,.]?00%?\)?\s+([\d.,]+)/i);
  const totalNotaCredito = findNum(/total\s+nota\s+cr[eé]dito\s+([\d.,]+)/i);
  const igtfNotaCredito = findNum(/igtf\s+nota\s+cr[eé]dito\s*\(?3[,.]?00%?\)?\s+([\d.,]+)/i);
  const totalGaveta = findNum(/total\s+gaveta\s+([\d.,]+)/i);

  const tv = totalVenta || 0, iv = igtfVenta || 0;
  const tnd = totalNotaDebito || 0, ind = igtfNotaDebito || 0;
  const tnc = totalNotaCredito || 0, inc = igtfNotaCredito || 0;
  const reporteZTotalAmount = Math.round(((tv - iv) + (tnd - ind) - (tnc - inc)) * 100) / 100;
  const igtfAmount = Math.round((iv + ind - inc) * 100) / 100;

  const advertencias: string[] = [];
  if (!modelo) advertencias.push("Modelo no encontrado");
  if (!serialNo) advertencias.push("Serial no encontrado");
  if (!firstInvoiceNo) advertencias.push("First Invoice no encontrado");
  if (!lastInvoiceNo) advertencias.push("Last Invoice no encontrado");
  if (!totalVenta) advertencias.push("Total Venta no encontrado — verificar cálculo");

  const fechaMatch = text.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);
  let fecha: string | null = null;
  if (fechaMatch) {
    const parts = fechaMatch[1].split(/[-\/]/);
    fecha = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }

  return {
    modelo, serialNo, numeroReporte, firstInvoiceNo, lastInvoiceNo,
    reporteZTotalAmount, igtfAmount, fecha, totalGaveta,
    confianza: Math.round([modelo, serialNo, numeroReporte, firstInvoiceNo, lastInvoiceNo, totalVenta].filter(Boolean).length / 6 * 100),
    advertencias,
    calculo_detalle: { totalVenta, igtfVenta, totalNotaDebito, igtfNotaDebito, totalNotaCredito, igtfNotaCredito }
  };
};

const S = {
  page: { fontFamily: "Inter, sans-serif", minHeight: "100vh", backgroundColor: "#f5f5f5" } as React.CSSProperties,
  header: { backgroundColor: "#C0392B", padding: "0 32px", display: "flex", alignItems: "center", gap: "12px", height: "64px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" } as React.CSSProperties,
  logo: { width: "36px", height: "36px", backgroundColor: "#F1C40F", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "18px", color: "#C0392B" } as React.CSSProperties,
  main: { maxWidth: "720px", margin: "32px auto", padding: "0 16px" } as React.CSSProperties,
  card: { backgroundColor: "white", borderRadius: "12px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: "20px" } as React.CSSProperties,
  label: { display: "block", fontWeight: "600", marginBottom: "8px", color: "#333", fontSize: "14px" } as React.CSSProperties,
  input: { width: "100%", padding: "10px 14px", border: "1.5px solid #eee", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  btnPrimary: { padding: "12px 24px", backgroundColor: "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" } as React.CSSProperties,
  btnSecondary: { padding: "10px 18px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" } as React.CSSProperties,
  pill: (active: boolean) => ({ padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: active ? "700" : "400", cursor: "pointer", border: `2px solid ${active ? "#C0392B" : "#eee"}`, backgroundColor: active ? "#C0392B" : "white", color: active ? "white" : "#555" }) as React.CSSProperties,
  tag: (active: boolean) => ({ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: active ? "700" : "400", cursor: "pointer", border: `1.5px solid ${active ? "#C0392B" : "#ddd"}`, backgroundColor: active ? "#fff5f5" : "white", color: active ? "#C0392B" : "#555" }) as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "180px 1fr", borderBottom: "1px solid #f5f5f5", alignItems: "stretch" } as React.CSSProperties,
  rowLabel: { padding: "10px 14px", backgroundColor: "#fafafa", borderRight: "1px solid #f5f5f5" } as React.CSSProperties,
  rowInput: { padding: "6px 10px", display: "flex", alignItems: "center" } as React.CSSProperties,
  alert: (type: "warn" | "err" | "info") => ({
    padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
    backgroundColor: type === "err" ? "#fff5f5" : type === "warn" ? "#fffbea" : "#f0fff4",
    border: `1px solid ${type === "err" ? "#f5c6c6" : type === "warn" ? "#f5e6a0" : "#b7f0c8"}`,
    color: type === "err" ? "#C0392B" : type === "warn" ? "#7d6008" : "#1a7a3c",
  }) as React.CSSProperties,
};

export default function ReporteZPage() {
  const drive = useDriveNav();
  const [storeCode, setStoreCode]       = useState("");
  const [storeFolders, setStoreFolders] = useState<DriveFile[]>([]);
  const [months, setMonths]             = useState<DriveFile[]>([]);
  const [selMonth, setSelMonth]         = useState<DriveFile | null>(null);
  const [days, setDays]                 = useState<DriveFile[]>([]);
  const [selDay, setSelDay]             = useState<DriveFile | null>(null);
  const [foundFile, setFoundFile]       = useState<DriveFile | null>(null);
  const [numeroCaja, setNumeroCaja]     = useState("");
  const [fields, setFields]             = useState<Record<string, string>>({});
  const [rawData, setRawData]           = useState<any>(null);
  const [loading, setLoading]           = useState("");
  const [error, setError]               = useState("");
  const [copied, setCopied]             = useState(false);

  const withLoading = async (msg: string, fn: () => Promise<void>) => {
    setLoading(msg); setError("");
    try { await fn(); } catch (e: any) { setError(e.message); }
    finally { setLoading(""); }
  };

  const handleConnect = () => withLoading("Conectando a Google Drive...", async () => {
    const folders = await drive.listStoreFolders();
    if (!folders.length) throw new Error("No se encontraron carpetas de tiendas en Drive");
    setStoreFolders(folders);
  });

  const handleStoreSelect = (code: string) => withLoading("Cargando meses...", async () => {
    setStoreCode(code);
    setSelMonth(null); setSelDay(null); setFoundFile(null); setFields({}); setRawData(null);
    const storeObj = STORES.find(s => s.code === code)!;
    const keyword = storeObj.label.split("·")[1].trim().toLowerCase();
    const folder = storeFolders.find(f =>
      f.name.toLowerCase().includes(code.toLowerCase()) ||
      f.name.toLowerCase().includes(keyword)
    );
    if (!folder) throw new Error(`No se encontró carpeta para ${code}. Disponibles: ${storeFolders.map(f => f.name).join(", ")}`);
    const m = await drive.listMonths(folder.id);
    setMonths(m); setDays([]);
  });

  const handleMonthSelect = (m: DriveFile) => withLoading("Cargando días...", async () => {
    setSelMonth(m); setSelDay(null); setFoundFile(null); setFields({}); setRawData(null);
    const d = await drive.listDays(m.id);
    setDays(d);
  });

  const handleDaySelect = (d: DriveFile) => withLoading("Buscando Reporte Z...", async () => {
    setSelDay(d); setFoundFile(null); setFields({}); setRawData(null);
    const file = await drive.findReporteZ(d.id, storeCode);
    if (!file) throw new Error(`No se encontró Reporte Z en el día ${d.name}.`);
    setFoundFile(file);
  });

  const handleExtract = async () => {
    if (!foundFile) return;
    setError("");
    try {
      const text = await drive.extractTextViaGoogleDoc(foundFile.id, setLoading);
      if (!text || text.trim().length < 10) throw new Error("El OCR no extrajo texto suficiente. Verifica la calidad de la imagen.");
      const parsed = parseReporteZ(text);
      setRawData(parsed);
      const extracted: Record<string, string> = {};
      BC_FIELDS.forEach(f => {
        const val = parsed[f.key as keyof typeof parsed];
        if (val != null) extracted[f.key] = String(val);
      });
      setFields(extracted);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading("");
    }
  };

  const copyForBC = () => {
    const text = [`Numero de Caja: ${numeroCaja}`, ...BC_FIELDS.map(f => `${f.label}: ${fields[f.key] || ""}`)].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmt = (n: any) => n != null ? Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2 }) : "—";
  const conf = rawData?.confianza ?? null;
  const confColor = conf === null ? "#888" : conf >= 80 ? "#27AE60" : conf >= 50 ? "#E67E22" : "#C0392B";
  const hasResult = Object.keys(fields).length > 0;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}>FQ</div>
        <span style={{ color: "white", fontWeight: "700", fontSize: "18px" }}>Reporte Z → BC Custom Information</span>
      </header>
      <main style={S.main}>
        {error && <div style={S.alert("err")}>{error}</div>}
        {loading && <div style={S.alert("info")}>{loading}</div>}

        {!storeFolders.length && (
          <div style={S.card}>
            <p style={{ color: "#555", marginBottom: "8px", fontSize: "14px", lineHeight: 1.6 }}>
              Conecta tu cuenta de Google para acceder a los Reportes Z en Drive y pre-llenar el Custom Information de los Sales Orders en BC.
            </p>
            <p style={{ color: "#aaa", marginBottom: "20px", fontSize: "12px" }}>
              OCR mediante Google Docs — sin costo de API externa.
            </p>
            <button style={S.btnPrimary} onClick={handleConnect}>Conectar Google Drive</button>
          </div>
        )}

        {storeFolders.length > 0 && (
          <div style={S.card}>
            <h2 style={{ color: "#C0392B", fontSize: "18px", marginBottom: "20px", fontWeight: "700" }}>Selecciona tienda · mes · día</h2>
            <div style={{ marginBottom: "16px" }}>
              <label style={S.label}>Tienda</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {STORES.map(s => <button key={s.code} style={S.pill(storeCode === s.code)} onClick={() => handleStoreSelect(s.code)}>{s.label}</button>)}
              </div>
            </div>
            {months.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <label style={S.label}>Mes</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {months.map(m => <button key={m.id} style={S.tag(selMonth?.id === m.id)} onClick={() => handleMonthSelect(m)}>{m.name}</button>)}
                </div>
              </div>
            )}
            {days.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <label style={S.label}>Día</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {days.map(d => <button key={d.id} style={S.tag(selDay?.id === d.id)} onClick={() => handleDaySelect(d)}>{d.name}</button>)}
                </div>
              </div>
            )}
            {foundFile && !hasResult && (
              <div style={{ marginTop: "16px", padding: "14px 16px", backgroundColor: "#f0fff4", border: "1px solid #b7f0c8", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "14px", color: "#1a7a3c" }}>Reporte Z encontrado</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#555" }}>{foundFile.name}</p>
                </div>
                <button style={S.btnPrimary} onClick={handleExtract}>Extraer datos →</button>
              </div>
            )}
          </div>
        )}

        {hasResult && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ color: "#C0392B", fontSize: "18px", fontWeight: "700", margin: 0 }}>Custom Information</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#888" }}>
                  {rawData?.fecha && <span>{rawData.fecha} · </span>}
                  Confianza: <strong style={{ color: confColor }}>{conf}%</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={S.btnSecondary} onClick={() => { setFields({}); setRawData(null); }}>← Nuevo</button>
                <button style={S.btnPrimary} onClick={copyForBC}>{copied ? "✓ Copiado" : "Copiar para BC"}</button>
              </div>
            </div>
            {rawData?.advertencias?.length > 0 && (
              <div style={S.alert("warn")}><strong>Verificar: </strong>{rawData.advertencias.join(" · ")}</div>
            )}
            <div style={{ border: "1px solid #f0f0f0", borderRadius: "8px", overflow: "hidden" }}>
              <div style={S.row}>
                <div style={S.rowLabel}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#333" }}>Numero de Caja</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#aaa" }}>Ingresar manualmente</p>
                </div>
                <div style={S.rowInput}>
                  <input style={{ ...S.input, border: "1.5px solid #F1C40F" }} value={numeroCaja} onChange={e => setNumeroCaja(e.target.value)} placeholder="01" />
                </div>
              </div>
              {BC_FIELDS.map((f, i) => (
                <div key={f.key} style={{ ...S.row, borderBottom: i < BC_FIELDS.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={S.rowLabel}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#333" }}>{f.label}</p>
                    {f.hint && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#aaa" }}>{f.hint}</p>}
                  </div>
                  <div style={S.rowInput}>
                    <input style={{ ...S.input, backgroundColor: fields[f.key] ? "white" : "#fafafa" }} value={fields[f.key] ?? ""} onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder="—" />
                  </div>
                </div>
              ))}
            </div>
            {rawData?.calculo_detalle && (
              <details style={{ marginTop: "16px" }}>
                <summary style={{ fontSize: "13px", color: "#888", cursor: "pointer" }}>Ver desglose del cálculo</summary>
                <div style={{ marginTop: "10px", backgroundColor: "#fafafa", borderRadius: "8px", padding: "16px", fontSize: "13px" }}>
                  {(() => {
                    const d = rawData.calculo_detalle;
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", color: "#555" }}>
                        <tbody>
                          <tr><td style={{ padding: "4px 0" }}>TOTAL VENTA</td><td style={{ textAlign: "right" }}>Bs {fmt(d.totalVenta)}</td></tr>
                          <tr><td style={{ padding: "4px 0", color: "#C0392B" }}>− IGTF VENTA (3%)</td><td style={{ textAlign: "right", color: "#C0392B" }}>Bs {fmt(d.igtfVenta)}</td></tr>
                          {d.totalNotaDebito > 0 && <tr><td style={{ padding: "4px 0", color: "#27AE60" }}>+ TOTAL ND − IGTF ND</td><td style={{ textAlign: "right", color: "#27AE60" }}>Bs {fmt((d.totalNotaDebito||0)-(d.igtfNotaDebito||0))}</td></tr>}
                          {d.totalNotaCredito > 0 && <tr><td style={{ padding: "4px 0", color: "#C0392B" }}>− TOTAL NC − IGTF NC</td><td style={{ textAlign: "right", color: "#C0392B" }}>Bs {fmt((d.totalNotaCredito||0)-(d.igtfNotaCredito||0))}</td></tr>}
                          <tr style={{ borderTop: "1px solid #eee" }}>
                            <td style={{ padding: "8px 0 4px", fontWeight: "700", color: "#333" }}>= Reporte Z Total</td>
                            <td style={{ textAlign: "right", fontWeight: "700", color: "#333", padding: "8px 0 4px" }}>Bs {fmt(fields.reporteZTotalAmount)}</td>
                          </tr>
                          {rawData.totalGaveta && <tr><td style={{ padding: "4px 0", fontSize: "12px", color: "#aaa" }}>TOTAL GAVETA (referencia)</td><td style={{ textAlign: "right", fontSize: "12px", color: "#aaa" }}>Bs {fmt(rawData.totalGaveta)}</td></tr>}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </details>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
