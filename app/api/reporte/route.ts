import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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
const GREEN  = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD5E8D4" } };
const BOLD   = { bold: true };
const CENTER = { horizontal: "center" as const };
const NUM_FMT = "#,##0.00";

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
  calc: Array<{ label: string; bs: number; usd: number; equiv: number; sist: number }>;
  totContado: number;
  totSist: number;
}

export async function POST(req: NextRequest) {
  const { tienda, semana, porcentaje, dias, imagenes } = await req.json();
  const tiendaNombre = (tienda.split(" - ")[1] || tienda).toUpperCase();

  const wb = new ExcelJS.Workbook();
  const diasResumen: DiaResumen[] = [];

  diasSemana.forEach((diaName, i) => {
    const dia = dias[i] || {};
    const tasa = num(dia.tasa);
    const fecha = addDays(semana, i);

    const pct = num(porcentaje) / 100;

    // Valores del sistema (Reporte Z)
    const sistBsToUsd = (key: string) => tasa > 0 ? num(dia[key]) / tasa * pct : 0;
    const sistUsd     = (key: string) => num(dia[key]) * pct;

    const metodos = [
      {
        label: "Efectivo Tienda",
        bs: num(dia["Efectivo Tienda_Bs"]),   usd: num(dia["Efectivo Tienda_$"]),
        sist: sistBsToUsd("sist_Efectivo Tienda_Bs") + sistUsd("sist_Efectivo Tienda_$"),
      },
      {
        label: "Efectivo Delivery",
        bs: num(dia["Efectivo Delivery_Bs"]), usd: num(dia["Efectivo Delivery_$"]),
        sist: sistBsToUsd("sist_Efectivo Delivery_Bs") + sistUsd("sist_Efectivo Delivery_$"),
      },
      {
        label: "Punto de Venta",
        bs: num(dia["Punto de Venta_Bs"]),    usd: 0,
        sist: sistBsToUsd("sist_Punto de Venta_Bs"),
      },
      {
        label: "Pago Móvil",
        bs: num(dia["Pago Móvil_Bs"]),        usd: 0,
        sist: sistBsToUsd("sist_Pago Móvil_Bs"),
      },
      {
        label: "Zelle",
        bs: 0,                                 usd: num(dia["Zelle_$"]),
        sist: sistUsd("sist_Zelle_$"),
      },
      {
        label: "Depósito Banco",
        bs: num(dia["Depósito Banco_Bs"]),    usd: 0,
        sist: sistBsToUsd("sist_Depósito Banco_Bs"),
      },
    ];

    const calc = metodos.map(m => {
      const esPOS = m.label === "Punto de Venta";
      const factor = esPOS ? 1 : pct;
      return {
        label: m.label,
        bs:    m.bs * factor,
        usd:   m.usd * factor,
        equiv: tasa > 0 ? m.bs / tasa * factor : 0,
        sist:  m.sist,
      };
    });

    const totBs    = calc.reduce((s, m) => s + m.bs, 0);
    const totEquiv = calc.reduce((s, m) => s + m.equiv, 0);
    const totUsd   = calc.reduce((s, m) => s + m.usd, 0);
    const totSist  = calc.reduce((s, m) => s + m.sist, 0);
    const totContado = totEquiv + totUsd;

    // Guardar para la hoja General
    diasResumen.push({ fecha, calc, totContado, totSist });

    const ws = wb.addWorksheet(diaName);

    ws.columns = [
      { width: 20 }, // A
      { width: 14 }, // B: Ingresos Bs
      { width: 3  }, // C: $
      { width: 12 }, // D: Equiv $
      { width: 3  }, // E: $
      { width: 12 }, // F: Ingreso $
      { width: 3  }, // G: $
      { width: 24 }, // H: Sistema Total
      { width: 3  }, // I: $
      { width: 18 }, // J: Sobrante/Faltante
    ];

    // ── Row 1: Título ──────────────────────────────────────────────────────────
    ws.mergeCells("A1:J1");
    const t = ws.getCell("A1");
    t.value = "RESUMEN CIERRE DIARIO";
    t.font = { bold: true, size: 13 };
    t.alignment = CENTER;

    // ── Rows 2-4: Info general ─────────────────────────────────────────────────
    ws.getCell("A2").value = "Dia";
    ws.getCell("A2").font = BOLD;
    ws.getCell("B2").value = fecha;
    ws.getCell("B2").fill = YELLOW;
    ws.getCell("B2").font = BOLD;

    ws.getCell("A3").value = "Tienda";
    ws.getCell("A3").font = BOLD;
    ws.getCell("B3").value = tiendaNombre;
    ws.getCell("B3").fill = YELLOW;
    ws.getCell("B3").font = BOLD;

    ws.getCell("A4").value = "Tasa Cambio Dia";
    ws.getCell("A4").font = BOLD;
    ws.getCell("B4").value = tasa || "-";
    ws.getCell("B4").numFmt = NUM_FMT;

    // ── Row 6: Cabecera INGRESOS ───────────────────────────────────────────────
    ws.mergeCells("B6:F6");
    const hIng = ws.getCell("B6");
    hIng.value = "INGRESOS";
    hIng.font = BOLD;
    hIng.alignment = CENTER;
    hIng.fill = BLUE;

    ws.getCell("H6").value = "Sistema Total $ y Bs Equiv";
    ws.getCell("H6").font = BOLD;
    ws.getCell("H6").alignment = { horizontal: "center", wrapText: true };
    ws.getCell("H6").fill = BLUE;

    ws.getCell("J6").value = "Sobrante / Faltante";
    ws.getCell("J6").font = BOLD;
    ws.getCell("J6").alignment = { horizontal: "center", wrapText: true };
    ws.getCell("J6").fill = BLUE;

    // ── Row 7: Sub-cabeceras ───────────────────────────────────────────────────
    ws.getCell("B7").value = "Ingresos Bs";  ws.getCell("B7").font = BOLD;
    ws.getCell("D7").value = "Equiv  $";     ws.getCell("D7").font = BOLD;
    ws.getCell("F7").value = "Ingreso $";    ws.getCell("F7").font = BOLD;

    // ── Row 8: TOTALES ─────────────────────────────────────────────────────────
    const totSobrante = totSist > 0 ? totContado - totSist : 0;

    const tot = ws.getRow(8);
    const totCells: [number, string | number][] = [
      [1, "TOTALES"],
      [2, dash(totBs)],       [3, "$"],
      [4, dash(totEquiv)],    [5, "$"],
      [6, dash(totUsd)],      [7, "$"],
      [8, dash(totSist)],     [9, "$"],
      [10, totSist > 0 ? dash(totSobrante) : ""],
    ];
    totCells.forEach(([col, val]) => {
      const c = tot.getCell(col);
      c.value = val;
      c.font = BOLD;
    });
    [2, 4, 6, 8, 10].forEach(col => { tot.getCell(col).numFmt = NUM_FMT; });

    // ── Rows 10+: Métodos de pago ──────────────────────────────────────────────
    calc.forEach((m, idx) => {
      const contado = m.equiv + m.usd;
      const sobrante = m.sist > 0 ? contado - m.sist : null;

      const row = ws.getRow(10 + idx);
      row.getCell(1).value = m.label;
      row.getCell(2).value = dash(m.bs);                  row.getCell(3).value = "$";
      row.getCell(4).value = dash(m.equiv);               row.getCell(5).value = "$";
      row.getCell(6).value = dash(m.usd);                 row.getCell(7).value = "$";
      row.getCell(8).value = m.sist > 0 ? dash(m.sist) : ""; row.getCell(9).value = "$";
      row.getCell(10).value = sobrante !== null ? dash(sobrante) : "";

      [2, 4, 6].forEach(col => {
        const c = row.getCell(col);
        if (typeof c.value === "number") c.numFmt = NUM_FMT;
      });
    });

    // ── Bordes en la tabla (filas 6-16) ───────────────────────────────────────
    const borderThin = { style: "thin" as const };
    for (let r = 6; r <= 16; r++) {
      for (let c = 1; c <= 10; c++) {
        const cell = ws.getRow(r).getCell(c);
        cell.border = {
          top: borderThin, bottom: borderThin,
          left: borderThin, right: borderThin,
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

  // ── Hoja General (conciliación semanal) ────────────────────────────────────
  const wsGen = wb.addWorksheet("General");

  wsGen.columns = [
    { width: 20 }, // A: Método
    { width: 13 }, // B: Lunes
    { width: 13 }, // C: Martes
    { width: 13 }, // D: Miércoles
    { width: 13 }, // E: Jueves
    { width: 13 }, // F: Viernes
    { width: 13 }, // G: Sábado
    { width: 13 }, // H: Domingo
    { width: 15 }, // I: TOTAL
  ];

  // Row 1: Título
  wsGen.mergeCells("A1:I1");
  const tGen = wsGen.getCell("A1");
  tGen.value = "RESUMEN GENERAL SEMANAL";
  tGen.font = { bold: true, size: 13 };
  tGen.alignment = CENTER;

  // Rows 2-4: Info
  wsGen.getCell("A2").value = "Tienda";      wsGen.getCell("A2").font = BOLD;
  wsGen.getCell("B2").value = tiendaNombre;  wsGen.getCell("B2").fill = YELLOW; wsGen.getCell("B2").font = BOLD;
  wsGen.getCell("A3").value = "Semana";      wsGen.getCell("A3").font = BOLD;
  wsGen.getCell("B3").value = `${diasResumen[0]?.fecha ?? ""} - ${diasResumen[6]?.fecha ?? ""}`;
  wsGen.getCell("B3").font = BOLD;
  wsGen.getCell("A4").value = "Porcentaje";  wsGen.getCell("A4").font = BOLD;
  wsGen.getCell("B4").value = `${porcentaje}%`; wsGen.getCell("B4").fill = YELLOW; wsGen.getCell("B4").font = BOLD;

  // Row 6: Cabecera de días
  const genHeader = wsGen.getRow(6);
  genHeader.getCell(1).value = "Método de Pago";
  for (let i = 0; i < 7; i++) {
    genHeader.getCell(i + 2).value = `${diasSemana[i]}\n${diasResumen[i]?.fecha ?? ""}`;
    genHeader.getCell(i + 2).alignment = { horizontal: "center" as const, wrapText: true };
  }
  genHeader.getCell(9).value = "TOTAL SEMANA";
  genHeader.eachCell(c => {
    c.font = BOLD;
    c.fill = BLUE;
    if (!c.alignment?.wrapText) c.alignment = CENTER;
  });
  wsGen.getRow(6).height = 32;

  // Rows 7-12: un método por fila (equiv $ contado)
  const metodoLabels = ["Efectivo Tienda", "Efectivo Delivery", "Punto de Venta", "Pago Móvil", "Zelle", "Depósito Banco"];
  metodoLabels.forEach((label, mIdx) => {
    const row = wsGen.getRow(7 + mIdx);
    row.getCell(1).value = label;
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const m = diasResumen[d]?.calc[mIdx];
      const val = m ? m.equiv + m.usd : 0;
      if (val !== 0) {
        row.getCell(d + 2).value = val;
        row.getCell(d + 2).numFmt = NUM_FMT;
      }
      total += val;
    }
    if (total !== 0) {
      row.getCell(9).value = total;
      row.getCell(9).numFmt = NUM_FMT;
      row.getCell(9).font = BOLD;
      row.getCell(9).fill = GREEN;
    }
  });

  // Row 14: TOTAL CONTADO $
  const rowTC = wsGen.getRow(14);
  rowTC.getCell(1).value = "TOTAL CONTADO $"; rowTC.getCell(1).font = BOLD; rowTC.getCell(1).fill = BLUE;
  let grandContado = 0;
  for (let d = 0; d < 7; d++) {
    const val = diasResumen[d]?.totContado ?? 0;
    if (val !== 0) {
      rowTC.getCell(d + 2).value = val;
      rowTC.getCell(d + 2).numFmt = NUM_FMT;
      rowTC.getCell(d + 2).font = BOLD;
    }
    grandContado += val;
  }
  rowTC.getCell(9).value = grandContado;
  rowTC.getCell(9).numFmt = NUM_FMT;
  rowTC.getCell(9).font = { bold: true, size: 12 };
  rowTC.getCell(9).fill = YELLOW;

  // Row 15: TOTAL SISTEMA $
  const rowTS = wsGen.getRow(15);
  rowTS.getCell(1).value = "TOTAL SISTEMA $"; rowTS.getCell(1).font = BOLD; rowTS.getCell(1).fill = BLUE;
  let grandSist = 0;
  for (let d = 0; d < 7; d++) {
    const val = diasResumen[d]?.totSist ?? 0;
    if (val > 0) {
      rowTS.getCell(d + 2).value = val;
      rowTS.getCell(d + 2).numFmt = NUM_FMT;
      rowTS.getCell(d + 2).font = BOLD;
    }
    grandSist += val;
  }
  if (grandSist > 0) {
    rowTS.getCell(9).value = grandSist;
    rowTS.getCell(9).numFmt = NUM_FMT;
    rowTS.getCell(9).font = { bold: true, size: 12 };
    rowTS.getCell(9).fill = YELLOW;
  }

  // Row 16: DIFERENCIA (Sobrante / Faltante)
  const rowDif = wsGen.getRow(16);
  rowDif.getCell(1).value = "DIFERENCIA $"; rowDif.getCell(1).font = BOLD; rowDif.getCell(1).fill = BLUE;
  for (let d = 0; d < 7; d++) {
    const contado = diasResumen[d]?.totContado ?? 0;
    const sist = diasResumen[d]?.totSist ?? 0;
    if (sist > 0) {
      const diff = contado - sist;
      rowDif.getCell(d + 2).value = diff;
      rowDif.getCell(d + 2).numFmt = NUM_FMT;
      rowDif.getCell(d + 2).font = { bold: true, color: { argb: diff >= 0 ? "FF27AE60" : "FFE74C3C" } };
    }
  }
  if (grandSist > 0) {
    const grandDiff = grandContado - grandSist;
    rowDif.getCell(9).value = grandDiff;
    rowDif.getCell(9).numFmt = NUM_FMT;
    rowDif.getCell(9).font = { bold: true, size: 12, color: { argb: grandDiff >= 0 ? "FF27AE60" : "FFE74C3C" } };
    rowDif.getCell(9).fill = YELLOW;
  }

  // Bordes tabla General (filas 6-16)
  const borderGen = { style: "thin" as const };
  for (let r = 6; r <= 16; r++) {
    for (let c = 1; c <= 9; c++) {
      wsGen.getRow(r).getCell(c).border = {
        top: borderGen, bottom: borderGen,
        left: borderGen, right: borderGen,
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
