"use client";
import { useState } from "react";
import { useDriveNav, DriveFile } from "@/app/lib/useDriveNav";

const STORES = [
  { code: "FQ01", label: "FQ01 · Chacao" },
  { code: "FQ88", label: "FQ88 · Candelaria" },
  { code: "FQ28", label: "FQ28 · Marqués" },
];

const BC_FIELDS = [
  { key: "modelo",              label: "Modelo",                 hint: "",                                                               warn: false },
  { key: "serialNo",            label: "Serial No.",             hint: "",                                                               warn: false },
  { key: "numeroReporte",       label: "Numero Reporte",         hint: "⚠️ Verificar contra el ticket físico — OCR puede confundir 2↔7, 1↔4, 0↔6", warn: true },
  { key: "firstInvoiceNo",      label: "First Invoice No.",      hint: "Primer número del día",                                          warn: false },
  { key: "lastInvoiceNo",       label: "Last Invoice No.",       hint: "Último número del día",                                          warn: false },
  { key: "reporteZTotalAmount", label: "Reporte Z Total Amount", hint: "Sin IGTF: TOTAL VENTA − IGTF ± ND ± NC",                        warn: false },
  { key: "igtfAmount",          label: "IGTF Amount",            hint: "",                                                               warn: false },
];

// Extrae número venezolano de una cadena
// Soporta: "Bs 756.773,92", "Bs 325.443,78", "Bs 325.443.78" (OCR con punto en vez de coma)
const extractNum = (s: string): number | null => {
  // Primero intentar formato correcto con coma decimal: 325.443,78
  const withComma = [...s.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)];
  if (withComma.length) {
    const raw = withComma[withComma.length - 1][1];
    return parseFloat(raw.replace(/\./g, "").replace(",", "."));
  }
  // Si no, intentar formato con punto decimal mal escaneado: 325.443.78
  // (tres números separados por puntos donde el último grupo tiene 2 dígitos)
  const withDot = [...s.matchAll(/(\d{1,3}(?:\.\d{3})+\.\d{2})/g)];
  if (withDot.length) {
    const raw = withDot[withDot.length - 1][1];
    // Convertir: quitar todos los puntos excepto convertir el último en coma
    const parts = raw.split(".");
    const decimal = parts.pop();
    return parseFloat(parts.join("") + "." + decimal);
  }
  return null;
};

const parseReporteZ = (text: string) => {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let totalVenta: number | null = null;
  let igtfVenta: number | null = null;
  let totalNotaDebito: number | null = null;
  let igtfNotaDebito: number | null = null;
  let totalNotaCredito: number | null = null;
  let igtfNotaCredito: number | null = null;
  let totalGaveta: number | null = null;
  let numeroReporte: string | null = null;
  let modelo: string | null = null;
  let serialNo: string | null = null;
  let firstInvoiceNo: string | null = null;
  let lastInvoiceNo: string | null = null;
  let fecha: string | null = null;
  let foundReporteZLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // ── NUMERO DE REPORTE Z ─────────────────────────────────────────
    // Caso 1: "REPORTE 2:   1536 HORA: 19:05" — número en misma línea
    // Caso 2: "REPORTE 2:" en una línea, "1536 HORA: 19:05" en la siguiente
    if (!numeroReporte) {
      if (upper.match(/REPORTE\s*[Z2]\s*:/)) {
        foundReporteZLine = true;
        // Intentar extraer de la misma línea
        const m = line.match(/REPORTE\s*[Z2]\s*:\s*(\d{3,6})/i);
        if (m) { numeroReporte = m[1]; foundReporteZLine = false; }
      } else if (foundReporteZLine) {
        // La línea siguiente — buscar número de 3-6 dígitos al inicio o antes de HORA:
        const m = line.match(/^(\d{3,6})\s+HORA:/i) || line.match(/^(\d{3,6})\s*$/);
        if (m) { numeroReporte = m[1]; foundReporteZLine = false; }
        else foundReporteZLine = false; // si la siguiente línea no tiene el número, resetear
      }
    }

    // ── SERIAL ──────────────────────────────────────────────────────
    // FQ88: "77C7021976", FQ01: "Z7C7008053"
    if (!serialNo) {
      const m = line.match(/\b([A-Z0-9]{2}[A-Z][0-9]{7,})\b/);
      if (m && !upper.includes("RIF") && !upper.includes("LOCAL") && !upper.includes("ZONA")) {
        serialNo = m[1];
      }
    }

    // ── MODELO HKA ──────────────────────────────────────────────────
    if (!modelo) {
      const m = line.match(/(HKA[-\s]?\d+)/i);
      if (m) modelo = m[1].replace(/\s/, "-");
    }

    // ── FECHA del reporte ────────────────────────────────────────────
    // Tomar la primera fecha que aparezca en línea con "FECHA:"
    if (!fecha) {
      const m = line.match(/^FECHA:\s*(\d{2}-\d{2}-\d{4})/i);
      if (m) {
        const parts = m[1].split("-");
        fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // ── TOTAL GAVETA ─────────────────────────────────────────────────
    // "TOTAL GAVETA    Bs 325.443,78"
    if (upper.includes("TOTAL GAVETA")) {
      const v = extractNum(line);
      if (v !== null) totalGaveta = v;
      else if (lines[i + 1]) {
        const v2 = extractNum(lines[i + 1]);
        if (v2 !== null) totalGaveta = v2;
      }
    }

    // ── TOTAL VENTA ──────────────────────────────────────────────────
    // "TOTAL VENTA    Bs 325.443,69"  (sin incluir NOTA)
    if (upper.match(/^TOTAL\s+VENTA\b/) && !upper.includes("NOTA")) {
      const v = extractNum(line);
      if (v !== null) totalVenta = v;
      else if (lines[i + 1]) {
        const v2 = extractNum(lines[i + 1]);
        if (v2 !== null) totalVenta = v2;
      }
    }

    // ── IGTF VENTA ───────────────────────────────────────────────────
    // "IGTF VENTA (3.00%)    Bs 152,53"
    if (upper.match(/^IGTF\s+VENTA/)) {
      const v = extractNum(line);
      if (v !== null) igtfVenta = v;
      else if (lines[i + 1]) {
        const v2 = extractNum(lines[i + 1]);
        if (v2 !== null) igtfVenta = v2;
      }
    }

    // ── TOTAL NOTA DEBITO ────────────────────────────────────────────
    if (upper.match(/^TOTAL\s+NOTA\s+DE[B]ITO\b/)) {
      const v = extractNum(line);
      if (v !== null) totalNotaDebito = v;
      else if (lines[i + 1]) { const v2 = extractNum(lines[i + 1]); if (v2 !== null) totalNotaDebito = v2; }
    }
    if (upper.match(/^IGTF\s+NOTA\s+DE[B]ITO/)) {
      const v = extractNum(line);
      if (v !== null) igtfNotaDebito = v;
    }

    // ── TOTAL NOTA CREDITO ───────────────────────────────────────────
    if (upper.match(/^TOTAL\s+NOTA\s+CR[EÉ]DITO\b/)) {
      const v = extractNum(line);
      if (v !== null) totalNotaCredito = v;
      else if (lines[i + 1]) { const v2 = extractNum(lines[i + 1]); if (v2 !== null) totalNotaCredito = v2; }
    }
    if (upper.match(/^IGTF\s+NOTA\s+CR[EÉ]DITO/)) {
      const v = extractNum(line);
      if (v !== null) igtfNotaCredito = v;
    }

    // ── ULTIMA FACTURA ───────────────────────────────────────────────
    // "ULTIMA FACTURA FECHA: 06-01-2026  00106981  HORA: 16:32"
    // El número de 8 dígitos es la última factura
    if (upper.includes("ULTIMA FACTURA") || upper.includes("ULT.FACTURA")) {
      const nums = [...line.matchAll(/\b(\d{7,8})\b/g)];
      if (nums.length) lastInvoiceNo = nums[0][1]; // primer número grande = factura
    }

    // ── PRIMERA FACTURA ──────────────────────────────────────────────
    if (!firstInvoiceNo && (upper.includes("PRIMERA FACTURA") || upper.includes("PRIMER COMP") || upper.includes("DESDE"))) {
      const m = line.match(/\b(\d{7,8})\b/);
      if (m) firstInvoiceNo = m[1];
    }
  }

  // Cálculos finales
  const tv = totalVenta ?? 0, iv = igtfVenta ?? 0;
  const tnd = totalNotaDebito ?? 0, ind = igtfNotaDebito ?? 0;
  const tnc = totalNotaCredito ?? 0, inc = igtfNotaCredito ?? 0;
  const reporteZTotalAmount = Math.round(((tv - iv) + (tnd - ind) - (tnc - inc)) * 100) / 100;
  const igtfAmount = Math.round((iv + ind - inc) * 100) / 100;

  const advertencias: string[] = [];
  if (!numeroReporte) advertencias.push("Número de Reporte Z no encontrado");
  if (totalVenta === null) advertencias.push("TOTAL VENTA no encontrado");
  if (totalGaveta === null) advertencias.push("TOTAL GAVETA no encontrado");
  if (!lastInvoiceNo) advertencias.push("Última Factura no encontrada");

  return {
    modelo, serialNo, numeroReporte,
    firstInvoiceNo, lastInvoiceNo,
    reporteZTotalAmount, igtfAmount,
    fecha, totalGaveta,
    confianza: Math.round([numeroReporte, totalVenta, totalGaveta, lastInvoiceNo, serialNo].filter(v => v !== null).length / 5 * 100),
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
  inputWarn: { width: "100%", padding: "10px 14px", border: "2px solid #F1C40F", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box", backgroundColor: "#fffbea" } as React.CSSProperties,
  btnPrimary: { padding: "12px 24px", backgroundColor: "#C0392B", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" } as React.CSSProperties,
  btnSecondary: { padding: "10px 18px", backgroundColor: "white", color: "#C0392B", border: "2px solid #C0392B", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer" } as React.CSSProperties,
  pill: (active: boolean) => ({ padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: active ? "700" : "400", cursor: "pointer", border: `2px solid ${active ? "#C0392B" : "#eee"}`, backgroundColor: active ? "#C0392B" : "white", color: active ? "white" : "#555" }) as React.CSSProperties,
  tag: (active: boolean) => ({ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: active ? "700" : "400", cursor: "pointer", border: `1.5px solid ${active ? "#C0392B" : "#ddd"}`, backgroundColor: active ? "#fff5f5" : "white", color: active ? "#C0392B" : "#555" }) as React.CSSProperties,
  row: { display: "grid", gridTemplateColumns: "200px 1fr", borderBottom: "1px solid #f5f5f5", alignItems: "stretch" } as React.CSSProperties,
  rowLabel: { padding: "10px 14px", backgroundColor: "#fafafa", borderRight: "1px solid #f5f5f5" } as React.CSSProperties,
  rowLabelWarn: { padding: "10px 14px", backgroundColor: "#fffbea", borderRight: "1px solid #f5e6a0" } as React.CSSProperties,
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
  const [storeCode, setStoreCode]         = useState("");
  const [storeFolders, setStoreFolders]   = useState<DriveFile[]>([]);
  const [months, setMonths]               = useState<DriveFile[]>([]);
  const [selMonth, setSelMonth]           = useState<DriveFile | null>(null);
  const [days, setDays]                   = useState<DriveFile[]>([]);
  const [selDay, setSelDay]               = useState<DriveFile | null>(null);
  const [reportesZ, setReportesZ]         = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile]   = useState<DriveFile | null>(null);
  const [numeroCaja, setNumeroCaja]       = useState("");
  const [fields, setFields]               = useState<Record<string, string>>({});
  const [rawData, setRawData]             = useState<any>(null);
  const [loading, setLoading]             = useState("");
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [rawText, setRawText]             = useState("");

  const withLoading = async (msg: string, fn: () => Promise<void>) => {
    setLoading(msg); setError("");
    try { await fn(); } catch (e: any) { setError(e.message); }
    finally { setLoading(""); }
  };

  const resetResult = () => { setFields({}); setRawData(null); setRawText(""); };

  const handleConnect = () => withLoading("Conectando a Google Drive...", async () => {
    const folders = await drive.listStoreFolders();
    if (!folders.length) throw new Error("No se encontraron carpetas de tiendas en Drive");
    setStoreFolders(folders);
  });

  const handleStoreSelect = (code: string) => withLoading("Cargando meses...", async () => {
    setStoreCode(code);
    setSelMonth(null); setSelDay(null); setReportesZ([]); setSelectedFile(null); resetResult();
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
    setSelMonth(m); setSelDay(null); setReportesZ([]); setSelectedFile(null); resetResult();
    const d = await drive.listDays(m.id);
    setDays(d);
  });

  const handleDaySelect = (d: DriveFile) => withLoading("Buscando Reportes Z...", async () => {
    setSelDay(d); setReportesZ([]); setSelectedFile(null); resetResult();
    const files = await drive.findReportesZ(d.id, storeCode);
    if (!files.length) throw new Error(`No se encontraron Reportes Z en el día ${d.name}.`);
    setReportesZ(files);
    if (files.length === 1) setSelectedFile(files[0]);
  });

  const handleExtract = async () => {
    if (!selectedFile) return;
    setError(""); resetResult();
    try {
      const text = await drive.extractTextViaGoogleDoc(selectedFile.id, setLoading);
      setRawText(text);
      if (!text || text.trim().length < 10) throw new Error("El OCR no extrajo texto suficiente.");
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
            <p style={{ color: "#aaa", marginBottom: "20px", fontSize: "12px" }}>OCR mediante Google Docs — sin costo de API externa.</p>
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
            {reportesZ.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <label style={S.label}>Reporte Z ({reportesZ.length} encontrado{reportesZ.length > 1 ? "s" : ""})</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {reportesZ.map(f => (
                    <div key={f.id} onClick={() => { setSelectedFile(f); resetResult(); }} style={{
                      padding: "12px 16px", borderRadius: "8px", cursor: "pointer",
                      border: `2px solid ${selectedFile?.id === f.id ? "#C0392B" : "#eee"}`,
                      backgroundColor: selectedFile?.id === f.id ? "#fff5f5" : "white",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: "13px", fontWeight: selectedFile?.id === f.id ? "700" : "400", color: selectedFile?.id === f.id ? "#C0392B" : "#333" }}>
                        {f.name}
                      </span>
                      {selectedFile?.id === f.id && <span style={{ fontSize: "11px", color: "#C0392B", fontWeight: "700" }}>● Seleccionado</span>}
                    </div>
                  ))}
                </div>
                {selectedFile && !hasResult && (
                  <button style={{ ...S.btnPrimary, marginTop: "12px", width: "100%" }} onClick={handleExtract}>
                    Extraer datos →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {hasResult && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h2 style={{ color: "#C0392B", fontSize: "18px", fontWeight: "700", margin: 0 }}>Custom Information</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#888" }}>
                  {rawData?.fecha && <span>{rawData.fecha} · </span>}
                  Confianza OCR: <strong style={{ color: confColor }}>{conf}%</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={S.btnSecondary} onClick={resetResult}>← Otro</button>
                <button style={S.btnPrimary} onClick={copyForBC}>{copied ? "✓ Copiado" : "Copiar para BC"}</button>
              </div>
            </div>

            <div style={{ ...S.alert("warn"), marginBottom: "12px" }}>
              <strong>⚠️ Verificar siempre el Numero Reporte</strong> contra el ticket físico antes de guardar en BC.
              El OCR puede confundir dígitos similares en tickets térmicos (2↔7, 1↔4, 0↔6).
            </div>

            {rawData?.advertencias?.length > 0 && (
              <div style={{ ...S.alert("err"), marginBottom: "12px" }}>
                <strong>Campos no encontrados: </strong>{rawData.advertencias.join(" · ")}
              </div>
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
                  <div style={f.warn ? S.rowLabelWarn : S.rowLabel}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: f.warn ? "#7d6008" : "#333" }}>{f.label}</p>
                    {f.hint && <p style={{ margin: "2px 0 0", fontSize: "11px", color: f.warn ? "#a07010" : "#aaa" }}>{f.hint}</p>}
                  </div>
                  <div style={S.rowInput}>
                    <input
                      style={f.warn ? S.inputWarn : { ...S.input, backgroundColor: fields[f.key] ? "white" : "#fafafa" }}
                      value={fields[f.key] ?? ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="—"
                    />
                  </div>
                </div>
              ))}
            </div>

            {rawData?.calculo_detalle && (
              <details style={{ marginTop: "16px" }}>
                <summary style={{ fontSize: "13px", color: "#888", cursor: "pointer" }}>Ver desglose del cálculo</summary>
                <div style={{ marginTop: "10px", backgroundColor: "#fafafa", borderRadius: "8px", padding: "16px", fontSize: "13px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "#555" }}>
                    <tbody>
                      <tr><td style={{ padding: "4px 0" }}>TOTAL VENTA</td><td style={{ textAlign: "right" }}>Bs {fmt(rawData.calculo_detalle.totalVenta)}</td></tr>
                      <tr><td style={{ padding: "4px 0", color: "#C0392B" }}>− IGTF VENTA (3%)</td><td style={{ textAlign: "right", color: "#C0392B" }}>Bs {fmt(rawData.calculo_detalle.igtfVenta)}</td></tr>
                      {(rawData.calculo_detalle.totalNotaDebito ?? 0) > 0 && <tr><td style={{ padding: "4px 0", color: "#27AE60" }}>+ TOTAL ND − IGTF ND</td><td style={{ textAlign: "right", color: "#27AE60" }}>Bs {fmt((rawData.calculo_detalle.totalNotaDebito||0)-(rawData.calculo_detalle.igtfNotaDebito||0))}</td></tr>}
                      {(rawData.calculo_detalle.totalNotaCredito ?? 0) > 0 && <tr><td style={{ padding: "4px 0", color: "#C0392B" }}>− TOTAL NC − IGTF NC</td><td style={{ textAlign: "right", color: "#C0392B" }}>Bs {fmt((rawData.calculo_detalle.totalNotaCredito||0)-(rawData.calculo_detalle.igtfNotaCredito||0))}</td></tr>}
                      <tr style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: "8px 0 4px", fontWeight: "700", color: "#333" }}>= Reporte Z Total</td>
                        <td style={{ textAlign: "right", fontWeight: "700", color: "#333", padding: "8px 0 4px" }}>Bs {fmt(fields.reporteZTotalAmount)}</td>
                      </tr>
                      {rawData.totalGaveta && <tr><td style={{ padding: "4px 0", fontSize: "12px", color: "#aaa" }}>TOTAL GAVETA (referencia)</td><td style={{ textAlign: "right", fontSize: "12px", color: "#aaa" }}>Bs {fmt(rawData.totalGaveta)}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {rawText && (
              <details style={{ marginTop: "8px" }}>
                <summary style={{ fontSize: "12px", color: "#ccc", cursor: "pointer" }}>Ver texto OCR extraído</summary>
                <pre style={{ marginTop: "8px", fontSize: "11px", color: "#888", backgroundColor: "#fafafa", padding: "12px", borderRadius: "8px", overflowX: "auto", whiteSpace: "pre-wrap" }}>{rawText}</pre>
              </details>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
