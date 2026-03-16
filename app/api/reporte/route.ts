import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getDiasFromFecha(fechaInicio: string): string[] {
  const base = new Date(fechaInicio + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return DIAS_ES[d.getDay()];
  });
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function num(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(",", ".")) || 0;
}

function dash(val: number): number | string {
  return val === 0 ? "-" : val;
}

const YELLOW = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFF00" } };
const BLUE   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFBDD7EE" } };
const BOLD   = { bold: true };
const CENTER = { horizontal: "center" as const };
const NUM_FMT = "#,##0.00";
const BORDER_THIN = { style: "thin" as const };

function extensionDeBase64(dataUrl: string): "jpeg" | "png" | "gif" {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  return "jpeg";
}

function base64Puro(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? dataUrl;
}

interface DiaResumen {
  fecha: string;
  tasa: number;
  totBs: number;
  posBs: number;
  totContado: number;
  totSist: number;
}

export async function POST(req: NextRequest) {
  const { tienda, semana, porcentaje, dias, imagenes } = await req.json();
  const tiendaNombre = (tienda.split(" - ")[1] || tienda).toUpperCase();
  const diasSemana = getDiasFromFecha(semana);

  const wb = new ExcelJS.Workbook();
  const diasResumen: DiaResumen[] = [];

  diasSemana.forEach((diaName, i) => {
    const dia = dias[i] || {};
    const tasa = num(dia.tasa);
    const fecha = addDays(semana, i);
    const pct = num(porcentaje) / 100;

    const metodos = [
      { label: "Efectivo Tienda",   bs: num(dia["Efectivo Tienda_Bs"]),   usd: num(dia["Efectivo Tienda_$"]) },
      { label: "Efectivo Delivery", bs: num(dia["Efectivo Delivery_Bs"]), usd: num(dia["Efectivo Delivery_$"]) },
      { label: "Punto de Venta",    bs: num(dia["Punto de Venta_Bs"]),    usd: 0 },
      { label: "Pago Móvil",        bs: num(dia["Pago Móvil_Bs"]),        usd: 0 },
      { label: "Zelle",             bs: 0,                                 usd: num(dia["Zelle_$"]) },
      { label: "Depósito Banco",    bs: num(dia["Depósito Banco_Bs"]),    usd: 0 },
    ];

    const calc = metodos.map(m => {
      const esPOS = m.label === "Punto de Venta";
      const factor = esPOS ? 1 : pct;
      return {
        label: m.label,
        bs:    m.bs * factor,
        usd:   m.usd * factor,
        equiv: tasa > 0 ? m.bs / tasa * factor : 0,
      };
    });

    const totBs      = calc.reduce((s, m) => s + m.bs, 0);
    const totEquiv   = calc.reduce((s, m) => s + m.equiv, 0);
    const totUsd     = calc.reduce((s, m) => s + m.usd, 0);
    const totContado = totEquiv + totUsd;

    const sistemaTotalUsd = num(dia["sistemaTotalUsd"]);
    const sobrante = sistemaTotalUsd > 0 ? totContado - sistemaTotalUsd : 0;

    diasResumen.push({ fecha, tasa, totBs, posBs: calc[2].bs, totContado, totSist: sistemaTotalUsd });

    // ── Hoja diaria ───────────────────────────────────────────────────────────
    const ws = wb.addWorksheet(diaName);

    ws.columns = [
      { width: 20 }, // A: Método
      { width: 18 }, // B: Ingresos Bs
      { width: 14 }, // C: Equiv $
      { width: 14 }, // D: Ingreso $
      { width: 26 }, // E: Sistema Total $ y Bs Equiv
      { width: 18 }, // F: Sobrante / Faltante
    ];

    // ── Row 1: Título ─────────────────────────────────────────────────────────
    ws.mergeCells("A1:F1");
    const t = ws.getCell("A1");
    t.value = "RESUMEN CIERRE DIARIO";
    t.font = { bold: true, size: 13 };
    t.alignment = CENTER;

    // ── Rows 2-4: Info general ────────────────────────────────────────────────
    ws.getCell("A2").value = "Dia";           ws.getCell("A2").font = BOLD;
    ws.getCell("B2").value = fecha;           ws.getCell("B2").fill = YELLOW; ws.getCell("B2").font = BOLD;
    ws.getCell("A3").value = "Tienda";        ws.getCell("A3").font = BOLD;
    ws.getCell("B3").value = tiendaNombre;    ws.getCell("B3").fill = YELLOW; ws.getCell("B3").font = BOLD;
    ws.getCell("A4").value = "Tasa Cambio Dia"; ws.getCell("A4").font = BOLD;
    ws.getCell("B4").value = tasa || "-";     if (tasa) ws.getCell("B4").numFmt = NUM_FMT;

    // ── Row 6: Cabeceras ──────────────────────────────────────────────────────
    ws.mergeCells("B6:D6");
    const hIng = ws.getCell("B6");
    hIng.value = "INGRESOS"; hIng.font = BOLD; hIng.alignment = CENTER; hIng.fill = BLUE;

    const hSist = ws.getCell("E6");
    hSist.value = "Sistema Total $ y Bs Equiv"; hSist.font = BOLD; hSist.alignment = CENTER; hSist.fill = BLUE;

    const hSob = ws.getCell("F6");
    hSob.value = "Sobrante / Faltante"; hSob.font = BOLD; hSob.alignment = CENTER; hSob.fill = BLUE;

    // ── Row 7: Sub-cabeceras ──────────────────────────────────────────────────
    ws.getCell("B7").value = "Ingresos Bs"; ws.getCell("B7").font = BOLD; ws.getCell("B7").alignment = CENTER;
    ws.getCell("C7").value = "Equiv $";     ws.getCell("C7").font = BOLD; ws.getCell("C7").alignment = CENTER;
    ws.getCell("D7").value = "Ingreso $";   ws.getCell("D7").font = BOLD; ws.getCell("D7").alignment = CENTER;

    // ── Row 8: TOTALES ────────────────────────────────────────────────────────
    const tot = ws.getRow(8);
    tot.getCell(1).value = "TOTALES";       tot.getCell(1).font = BOLD;
    tot.getCell(2).value = dash(totBs);     tot.getCell(2).font = BOLD; if (totBs)    tot.getCell(2).numFmt = NUM_FMT;
    tot.getCell(3).value = dash(totEquiv);  tot.getCell(3).font = BOLD; if (totEquiv) tot.getCell(3).numFmt = NUM_FMT;
    tot.getCell(4).value = dash(totUsd);    tot.getCell(4).font = BOLD; if (totUsd)   tot.getCell(4).numFmt = NUM_FMT;

    if (sistemaTotalUsd > 0) {
      tot.getCell(5).value = sistemaTotalUsd; tot.getCell(5).font = BOLD; tot.getCell(5).numFmt = NUM_FMT;
      tot.getCell(6).value = sobrante;
      tot.getCell(6).numFmt = NUM_FMT;
      tot.getCell(6).font = { bold: true, color: { argb: sobrante >= 0 ? "FF27AE60" : "FFE74C3C" } };
    }

    // ── Row 9: Separador (vacío) ──────────────────────────────────────────────

    // ── Rows 10+: Métodos de pago ─────────────────────────────────────────────
    calc.forEach((m, idx) => {
      const row = ws.getRow(10 + idx);
      row.getCell(1).value = m.label;
      row.getCell(2).value = dash(m.bs);    if (typeof dash(m.bs)    === "number") row.getCell(2).numFmt = NUM_FMT;
      row.getCell(3).value = dash(m.equiv); if (typeof dash(m.equiv) === "number") row.getCell(3).numFmt = NUM_FMT;
      row.getCell(4).value = dash(m.usd);   if (typeof dash(m.usd)   === "number") row.getCell(4).numFmt = NUM_FMT;
      // E y F: vacío (Sistema y Sobrante solo en TOTALES)
    });

    // ── Bordes en la tabla (filas 6-16, cols 1-6) ─────────────────────────────
    for (let r = 6; r <= 16; r++) {
      for (let c = 1; c <= 6; c++) {
        ws.getRow(r).getCell(c).border = {
          top: BORDER_THIN, bottom: BORDER_THIN,
          left: BORDER_THIN, right: BORDER_THIN,
        };
      }
    }

    // ── Imágenes ───────────────────────────────────────────────────────────────
    const imgs = imagenes?.[i];
    let filaImg = 18;

    const agregarImagen = (dataUrl: string, titulo: string) => {
      ws.getCell(`A${filaImg}`).value = titulo;
      ws.getCell(`A${filaImg}`).font = { bold: true, color: { argb: "FFC0392B" } };
      filaImg++;
      const imgId = wb.addImage({
        base64: base64Puro(dataUrl),
        extension: extensionDeBase64(dataUrl),
      });
      ws.addImage(imgId, {
        tl: { col: 0, row: filaImg - 1 },
        ext: { width: 600, height: 350 },
      });
      filaImg += 20;
    };

    if (imgs?.reporteZ)  agregarImagen(imgs.reporteZ,  "REPORTE Z");
    if (imgs?.cierrePDV) agregarImagen(imgs.cierrePDV, "CIERRE PUNTO DE VENTA");
  });

  // ── Hoja General (conciliación semanal) ──────────────────────────────────────
  const wsGen = wb.addWorksheet("General");

  wsGen.columns = [
    { width: 12 }, // A: Fecha
    { width: 20 }, // B: Suma Bs
    { width: 12 }, // C: Tasa
    { width: 16 }, // D: Total $
    { width: 20 }, // E: Punto de Venta Bs
    { width: 20 }, // F: Otros Métodos Bs
    { width: 16 }, // G: Restante $
    { width: 16 }, // H: Sistema $
    { width: 16 }, // I: Diferencia $
  ];

  wsGen.mergeCells("A1:I1");
  const tGen = wsGen.getCell("A1");
  tGen.value = "RESUMEN GENERAL SEMANAL";
  tGen.font = { bold: true, size: 13 };
  tGen.alignment = CENTER;

  wsGen.getCell("A2").value = "Tienda";     wsGen.getCell("A2").font = BOLD;
  wsGen.getCell("B2").value = tiendaNombre; wsGen.getCell("B2").fill = YELLOW; wsGen.getCell("B2").font = BOLD;
  wsGen.getCell("A3").value = "Semana";     wsGen.getCell("A3").font = BOLD;
  wsGen.getCell("B3").value = `${diasResumen[0]?.fecha ?? ""} - ${diasResumen[6]?.fecha ?? ""}`;
  wsGen.getCell("B3").font = BOLD;
  wsGen.getCell("A4").value = "Porcentaje"; wsGen.getCell("A4").font = BOLD;
  wsGen.getCell("B4").value = `${porcentaje}%`; wsGen.getCell("B4").fill = YELLOW; wsGen.getCell("B4").font = BOLD;

  const colHeaders = ["FECHA", "SUMA Bs", "TASA", "TOTAL $", "PUNTO DE VENTA Bs", "OTROS MÉTODOS Bs", "RESTANTE $", "SISTEMA $", "DIFERENCIA $"];
  colHeaders.forEach((h, i) => {
    const cell = wsGen.getRow(6).getCell(i + 1);
    cell.value = h; cell.font = BOLD; cell.fill = BLUE;
    cell.alignment = { horizontal: "center", wrapText: true };
  });
  wsGen.getRow(6).height = 36;

  let grandSumaBs = 0, grandTotalUsd = 0, grandPosBs = 0, grandOtrosBs = 0, grandRestante = 0, grandSist = 0;

  diasResumen.forEach((dr, i) => {
    const row = wsGen.getRow(7 + i);
    const otrosBs  = dr.posBs - dr.totBs;
    const restante = dr.tasa > 0 ? otrosBs / dr.tasa : 0;
    const difSist  = dr.totSist > 0 ? dr.totContado - dr.totSist : 0;

    row.getCell(1).value = dr.fecha;
    row.getCell(2).value = dr.totBs;       row.getCell(2).numFmt = NUM_FMT;
    row.getCell(3).value = dr.tasa || "-"; if (dr.tasa) row.getCell(3).numFmt = NUM_FMT;
    row.getCell(4).value = dr.totContado;  row.getCell(4).numFmt = NUM_FMT;
    row.getCell(5).value = dr.posBs;       row.getCell(5).numFmt = NUM_FMT;
    row.getCell(6).value = otrosBs;        row.getCell(6).numFmt = NUM_FMT;
    row.getCell(7).value = restante;       row.getCell(7).numFmt = NUM_FMT;
    if (dr.totSist > 0) {
      row.getCell(8).value = dr.totSist;   row.getCell(8).numFmt = NUM_FMT;
      row.getCell(9).value = difSist;      row.getCell(9).numFmt = NUM_FMT;
      row.getCell(9).font = { color: { argb: difSist >= 0 ? "FF27AE60" : "FFE74C3C" } };
    }

    grandSumaBs   += dr.totBs;
    grandTotalUsd += dr.totContado;
    grandPosBs    += dr.posBs;
    grandOtrosBs  += otrosBs;
    grandRestante += restante;
    grandSist     += dr.totSist;
  });

  const rowTot = wsGen.getRow(15);
  rowTot.getCell(1).value = "TOTAL"; rowTot.getCell(1).font = BOLD; rowTot.getCell(1).fill = YELLOW;
  const totGenData: [number, number][] = [
    [2, grandSumaBs], [4, grandTotalUsd], [5, grandPosBs],
    [6, grandOtrosBs], [7, grandRestante],
  ];
  totGenData.forEach(([col, val]) => {
    rowTot.getCell(col).value = val;
    rowTot.getCell(col).numFmt = NUM_FMT;
    rowTot.getCell(col).font = BOLD;
    rowTot.getCell(col).fill = YELLOW;
  });
  if (grandSist > 0) {
    rowTot.getCell(8).value = grandSist;
    rowTot.getCell(8).numFmt = NUM_FMT;
    rowTot.getCell(8).font = BOLD;
    rowTot.getCell(8).fill = YELLOW;
    const grandDif = grandTotalUsd - grandSist;
    rowTot.getCell(9).value = grandDif;
    rowTot.getCell(9).numFmt = NUM_FMT;
    rowTot.getCell(9).font = { bold: true, color: { argb: grandDif >= 0 ? "FF27AE60" : "FFE74C3C" } };
    rowTot.getCell(9).fill = YELLOW;
  }

  for (let r = 6; r <= 15; r++) {
    for (let c = 1; c <= 9; c++) {
      wsGen.getRow(r).getCell(c).border = {
        top: BORDER_THIN, bottom: BORDER_THIN,
        left: BORDER_THIN, right: BORDER_THIN,
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cierre-${tiendaNombre}-${semana}.xlsx"`,
    },
  });
}
