import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

// ── Day names ──────────────────────────────────────────────────────────────────
const DIAS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function getDiasFromFecha(fechaInicio: string): string[] {
  const base = new Date(fechaInicio + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(d.getDate() + i);
    return DIAS_ES[d.getDay()];
  });
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
}

function num(v: string | undefined): number {
  return parseFloat(String(v ?? "").replace(",", ".")) || 0;
}

// ── Colors ─────────────────────────────────────────────────────────────────────
const CH_DARK  = "FF1F4E79";
const CH_MID   = "FF2E75B6";
const CH_GREEN = "FF375623";
const C_INPUT  = "FFDCE6F1";
const C_CALC   = "FFF2F2F2";
const C_HILITE = "FFFFF2CC";
const C_LABEL  = "FFEAEAEA";

// ── Number formats ─────────────────────────────────────────────────────────────
const NUM = '#,##0.00;(#,##0.00);"-"';
const PCT = '0.0%;(0.0%);"-"';

// ── Style helpers ──────────────────────────────────────────────────────────────
const TBorder = { style: "thin" as const, color: { argb: "FFBFBFBF" } };
const Border  = { left: TBorder, right: TBorder, top: TBorder, bottom: TBorder };

function hdr(cell: ExcelJS.Cell, bg: string, sz = 10) {
  cell.font      = { name:"Arial", bold:true, size:sz, color:{ argb:"FFFFFFFF" } };
  cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
  cell.alignment = { horizontal:"center", vertical:"middle", wrapText:true };
  cell.border    = Border;
}

function inp(cell: ExcelJS.Cell, fmt = NUM) {
  cell.font      = { name:"Arial", color:{ argb:"FF0000FF" } };
  cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:C_INPUT } };
  cell.numFmt    = fmt;
  cell.border    = Border;
  cell.alignment = { horizontal:"right" };
}

function calc(cell: ExcelJS.Cell, fmt = NUM, bg?: string) {
  cell.font      = { name:"Arial", color:{ argb:"FF000000" } };
  cell.numFmt    = fmt;
  cell.border    = Border;
  cell.alignment = { horizontal:"right" };
  if (bg) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
}

function lbl(cell: ExcelJS.Cell, bold = false, bg = "FFFFFFFF") {
  cell.font      = { name:"Arial", bold, size:10, color:{ argb:"FF000000" } };
  cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
  cell.border    = Border;
  cell.alignment = { horizontal:"left", vertical:"middle" };
}

function empty(cell: ExcelJS.Cell) { cell.border = Border; }

function fml(cell: ExcelJS.Cell, formula: string, result: number, fmt = NUM, bg?: string) {
  cell.value  = { formula, result };
  cell.numFmt = fmt;
  cell.border = Border;
  cell.alignment = { horizontal:"right" };
  cell.font   = { name:"Arial", color:{ argb:"FF000000" } };
  if (bg) cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
}

// ── DiaData stored for General sheet ──────────────────────────────────────────
interface DiaData {
  name: string; fecha: string;
  b5: number; b6: number; b7: number;
  b9: number; b10: number; b11: number; b12: number; b13: number; b14: number;
  b16: number;
  c9: number; c10: number; c11: number; c12: number; c13: number; c14: number;
  c23: number; b27: number;
  posSelectedIdxs: Set<number>;
}

// ── POST handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { tienda, semana, porcentaje, dias, imagenes } = await req.json();
  const tiendaNombre = (tienda.split(" - ")[1] || tienda).toUpperCase();
  const diasSemana   = getDiasFromFecha(semana);
  const pct          = num(porcentaje) / 100;

  const wb       = new ExcelJS.Workbook();
  const diaData: DiaData[] = [];

  // ── Day sheets ───────────────────────────────────────────────────────────────
  diasSemana.forEach((diaName, i) => {
    const d    = dias[i] || {};
    const tasa = num(d.tasa);
    const fecha = addDays(semana, i);

    // Raw values from form/CRM (all converted to $)
    const efTBs  = num(d["Efectivo Tienda_Bs"]);
    const efTDir = num(d["Efectivo Tienda_$"]);
    const efDBs  = num(d["Efectivo Delivery_Bs"]);
    const efDDir = num(d["Efectivo Delivery_$"]);
    const posBs  = num(d["Punto de Venta_Bs"]);
    const pmBs   = num(d["Pago Móvil_Bs"]);
    const zelleD = num(d["Zelle_$"]);
    const depBs  = num(d["Depósito Banco_Bs"]);

    const t = tasa > 0 ? tasa : 1;

    // B column (REAL $)
    const b9  = efTBs / t + efTDir;
    const b10 = efDBs / t + efDDir;
    const b11 = posBs / t;
    const b12 = pmBs  / t;
    const b13 = zelleD;
    const b14 = depBs / t;

    const b16 = b9 + b10 + b11 + b12 + b13 + b14;
    const b17 = efTBs + efDBs + posBs + pmBs + depBs; // total Bs
    const b19 = pct;          // % aplicado

    // C column (ADJUSTED) — pct a todos los métodos; POS usa cajas enteras
    const c9  = b9  * pct;
    const c10 = b10 * pct;
    const c12 = b12 * pct;
    const c13 = b13 * pct;
    const c14 = b14 * pct;

    // POS: seleccionar cajas enteras (desc) hasta alcanzar el objetivo
    type CounterItem = { nombre: string; tasa: number; puntoSis: number; movilSis: number; vesSisTienda: number; usdSisTienda: number; vesSisDelivery: number; usdSisDelivery: number; zelleSis: number };
    const countersArr: CounterItem[] = Array.isArray(d.counters) ? d.counters : [];
    const posCountersUsd = countersArr
      .map((c, idx) => ({ idx, usd: c.puntoSis / (c.tasa > 0 ? c.tasa : t) }))
      .filter(c => c.usd > 0)
      .sort((a, b) => b.usd - a.usd);
    // Tomar cajas enteras sin superar el objetivo (piso, no techo)
    const posTarget = b11 * pct;
    const posSelectedIdxs = new Set<number>();
    let posAccum = 0;
    for (const pc of posCountersUsd) {
      if (posAccum + pc.usd <= posTarget + 0.005) { // +0.005 tolerancia de redondeo
        posAccum += pc.usd;
        posSelectedIdxs.add(pc.idx);
      }
      // si no cabe, se omite esa caja y se intenta con la siguiente (más pequeña)
    }
    // Si ninguna caja cabe (todas superan el objetivo solas), tomar la más pequeña
    if (posSelectedIdxs.size === 0 && posCountersUsd.length > 0) {
      const smallest = posCountersUsd[posCountersUsd.length - 1];
      posAccum = smallest.usd;
      posSelectedIdxs.add(smallest.idx);
    }
    const c11 = posCountersUsd.length > 0 ? posAccum : b11 * pct;
    const c23 = c9 + c10 + c11 + c12 + c13 + c14;

    // INGRESOS section totals
    const b5 = b17;            // total Bs
    const b6 = b17 / t;        // equiv $
    const b7 = efTDir + efDDir + zelleD; // direct $

    const b27 = b16 - c23;     // sobrante = real - ajustado

    diaData.push({ name:diaName, fecha, b5, b6, b7, b9, b10, b11, b12, b13, b14, b16, c9, c10, c11, c12, c13, c14, c23, b27, posSelectedIdxs });

    // ── Sheet ──────────────────────────────────────────────────────────────────
    const ws = wb.addWorksheet(diaName);
    ws.columns = [
      { width: 34 }, // A: CONCEPTO
      { width: 22 }, // B: VALOR ($)
      { width: 22 }, // C: NOTA
    ];

    // Row 1: Title
    ws.mergeCells("A1:C1");
    ws.getCell("A1").value = `REPORTE DE VENTAS — ${diaName.toUpperCase()}`;
    hdr(ws.getCell("A1"), CH_DARK, 14);
    ws.getRow(1).height = 32;

    // Row 2: Tienda | Fecha | Tasa
    ws.getCell("A2").value = tiendaNombre; inp(ws.getCell("A2"), "@");
    ws.getCell("B2").value = fecha;        inp(ws.getCell("B2"), "DD/MM/YYYY");
    ws.getCell("C2").value = tasa || 0;    inp(ws.getCell("C2"), '#,##0.00 "Bs/$"');

    // Row 3: Column headers
    [["A","CONCEPTO"],["B","VALOR ($)"],["C","NOTA"]].forEach(([col, title]) => {
      ws.getCell(`${col}3`).value = title; hdr(ws.getCell(`${col}3`), CH_MID, 10);
    });
    ws.getRow(3).height = 24;

    // ── INGRESOS section ───────────────────────────────────────────────────────
    ws.mergeCells("A4:C4");
    ws.getCell("A4").value = "INGRESOS"; hdr(ws.getCell("A4"), CH_GREEN, 10);

    const ingRows: [string, number][] = [
      ["Ingresos Bs",       b5],
      ["Ingreso Equiv $",   b6],
      ["Ingreso $ Directo", b7],
    ];
    ingRows.forEach(([label, val], j) => {
      const r = 5 + j;
      ws.getCell(`A${r}`).value = label; lbl(ws.getCell(`A${r}`));
      ws.getCell(`B${r}`).value = val;   calc(ws.getCell(`B${r}`), NUM, C_CALC);
      empty(ws.getCell(`C${r}`));
    });

    // ── MEDIOS DE PAGO section ─────────────────────────────────────────────────
    ws.mergeCells("A8:C8");
    ws.getCell("A8").value = "MEDIOS DE PAGO"; hdr(ws.getCell("A8"), CH_GREEN, 10);

    type PM = [number, string, number, boolean];
    const pmRows: PM[] = [
      [9,  "Efectivo Tienda",   c9,  false],
      [10, "Efectivo Delivery", c10, false],
      [11, "Punto de Venta",    c11, true ],
      [12, "Pago Móvil",        c12, false],
      [13, "Zelle",             c13, false],
      [14, "Depósito Banco",    c14, false],
    ];

    pmRows.forEach(([row, label, cVal, isPos]) => {
      ws.getCell(`A${row}`).value = label; lbl(ws.getCell(`A${row}`));
      ws.getCell(`B${row}`).value = cVal;  inp(ws.getCell(`B${row}`));
      if (isPos && posCountersUsd.length > 0) {
        const selCount    = posSelectedIdxs.size;
        const totPosCount = posCountersUsd.length;
        ws.getCell(`C${row}`).value = `${selCount} de ${totPosCount} cajas`;
        lbl(ws.getCell(`C${row}`), false, C_CALC);
      } else {
        empty(ws.getCell(`C${row}`));
      }
    });

    // ── CÁLCULOS section ───────────────────────────────────────────────────────
    ws.mergeCells("A15:C15");
    ws.getCell("A15").value = "CÁLCULOS"; hdr(ws.getCell("A15"), CH_MID, 10);

    // B9-B14 son cVal, por lo que =B9+..+B14 = c23
    ws.getCell("A16").value = "Total Métodos $"; lbl(ws.getCell("A16"), false, C_CALC);
    fml(ws.getCell("B16"), "=B9+B10+B11+B12+B13+B14", c23, NUM, C_CALC);
    empty(ws.getCell("C16"));

    ws.getCell("A17").value = "% Aplicado"; lbl(ws.getCell("A17"), false, C_CALC);
    ws.getCell("B17").value = b19; inp(ws.getCell("B17"), PCT);
    empty(ws.getCell("C17"));

    // ── TOTALES REPORTADOS ─────────────────────────────────────────────────────
    ws.mergeCells("A18:C18");
    ws.getCell("A18").value = "TOTALES REPORTADOS"; hdr(ws.getCell("A18"), CH_DARK, 11);

    ws.getCell("A19").value = "Total Reportado $"; lbl(ws.getCell("A19"), true, C_HILITE);
    const totCell = ws.getCell("B19");
    totCell.value  = { formula:"=B16", result: c23 };
    totCell.font   = { name:"Arial", bold:true, color:{ argb:"FF000000" } };
    totCell.numFmt = NUM; totCell.border = Border;
    totCell.alignment = { horizontal:"right" };
    totCell.fill  = { type:"pattern", pattern:"solid", fgColor:{ argb:C_HILITE } };
    empty(ws.getCell("C19"));

    // ── DIFERENCIAS ────────────────────────────────────────────────────────────
    ws.mergeCells("A20:C20");
    ws.getCell("A20").value = "DIFERENCIAS"; hdr(ws.getCell("A20"), CH_GREEN, 10);

    const sobPct = b16 > 0 ? b27 / b16 : 0;
    ws.getCell("A21").value = "Sobrante / Faltante"; lbl(ws.getCell("A21"));
    const sobBCell = ws.getCell("B21");
    sobBCell.value  = b27; sobBCell.numFmt = NUM; sobBCell.border = Border;
    sobBCell.alignment = { horizontal:"right" };
    sobBCell.font = { name:"Arial", bold:true, color:{ argb: b27 >= 0 ? "FF008000" : "FFCC0000" } };
    const sobCCell = ws.getCell("C21");
    sobCCell.value  = sobPct; sobCCell.numFmt = "0.000%"; sobCCell.border = Border;
    sobCCell.alignment = { horizontal:"right" };
    sobCCell.font = { name:"Arial", color:{ argb: b27 >= 0 ? "FF008000" : "FFCC0000" } };

    // Freeze rows 1-3
    ws.views = [{ state:"frozen", xSplit:0, ySplit:3 }];

    // ── Images ─────────────────────────────────────────────────────────────────
    const imgs = imagenes?.[i];
    let filaImg = 26;
    const addImg = (dataUrl: string, titulo: string) => {
      ws.getCell(`A${filaImg}`).value = titulo;
      ws.getCell(`A${filaImg}`).font  = { bold:true, color:{ argb:"FFCC0000" } };
      filaImg++;
      const ext = dataUrl.startsWith("data:image/png") ? "png" : dataUrl.startsWith("data:image/gif") ? "gif" : "jpeg";
      const id  = wb.addImage({ base64: dataUrl.split(",")[1] ?? dataUrl, extension: ext });
      ws.addImage(id, { tl:{ col:0, row:filaImg-1 }, ext:{ width:600, height:350 } });
      filaImg += 20;
    };
    if (imgs?.reporteZ)  addImg(imgs.reporteZ,  "REPORTE Z");
    if (imgs?.cierrePDV) addImg(imgs.cierrePDV, "CIERRE PUNTO DE VENTA");
  });

  // ── GENERAL sheet ─────────────────────────────────────────────────────────────
  const wg = wb.addWorksheet("GENERAL");

  wg.columns = [
    { width: 34 }, // A
    ...Array.from({ length: 8 }, () => ({ width: 17 })), // B–I
  ];

  // Row 1: Title
  wg.mergeCells("A1:I1");
  wg.getCell("A1").value = `REPORTE SEMANAL DE VENTAS — ${tiendaNombre}`;
  hdr(wg.getCell("A1"), CH_DARK, 14); wg.getRow(1).height = 32;

  // Row 2: Period
  wg.getCell("A2").value = "Período:"; lbl(wg.getCell("A2"), true, C_LABEL);
  wg.mergeCells("B2:I2");
  wg.getCell("B2").value = `${diaData[0]?.fecha ?? ""} — ${diaData[6]?.fecha ?? ""}`;
  wg.getCell("B2").font  = { name:"Arial", color:{ argb:"FF000000" } };
  wg.getCell("B2").alignment = { horizontal:"left" }; wg.getCell("B2").border = Border;

  // Row 3: Column headers
  const colHdrs = ["CONCEPTO", ...diaData.map(d => `${d.name}\n${d.fecha}`), "TOTAL"];
  colHdrs.forEach((h, ci) => {
    wg.getCell(3, ci+1).value = h; hdr(wg.getCell(3, ci+1), CH_MID, 10);
  });
  wg.getRow(3).height = 36;

  // Helper: write a general data row
  const genRow = (row: number, label: string, vals: number[], bold = false, bg?: string) => {
    const labelCell = wg.getCell(row, 1);
    labelCell.value = label;
    lbl(labelCell, bold, bg ?? "FFFFFFFF");
    let total = 0;
    vals.forEach((v, ci) => {
      const c = wg.getCell(row, ci + 2);
      c.font  = { name:"Arial", color:{ argb:"FF008000" } };
      c.numFmt = NUM; c.border = Border; c.alignment = { horizontal:"right" };
      if (bg) c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
      c.value = v; // pre-computed value (formulas below)
      total += v;
    });
    const totCell = wg.getCell(row, 9);
    totCell.value  = total;
    totCell.numFmt = NUM; totCell.border = Border;
    totCell.alignment = { horizontal:"right" };
    totCell.font = { name:"Arial", bold:true, color:{ argb:"FF000000" } };
    if (bg) totCell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:bg } };
  };

  const secRow = (row: number, label: string, bg: string) => {
    wg.mergeCells(`A${row}:I${row}`);
    wg.getCell(`A${row}`).value = label;
    hdr(wg.getCell(`A${row}`), bg, 10);
  };

  // Sections
  secRow(4, "INGRESOS", CH_GREEN);
  genRow(5,  "Ingresos Bs",        diaData.map(d => d.b5));
  genRow(6,  "Ingreso Equiv $",    diaData.map(d => d.b6));
  genRow(7,  "Ingreso $ Directo",  diaData.map(d => d.b7));

  secRow(8, "MEDIOS DE PAGO", CH_MID);
  genRow(9,  "Efectivo Tienda",    diaData.map(d => d.b9));
  genRow(10, "Efectivo Delivery",  diaData.map(d => d.b10));
  genRow(11, "Punto de Venta",     diaData.map(d => d.b11));
  genRow(12, "Pago Móvil",         diaData.map(d => d.b12));
  genRow(13, "Zelle",              diaData.map(d => d.b13));
  genRow(14, "Depósito Banco",     diaData.map(d => d.b14));
  genRow(15, "Sistema Total Real $", diaData.map(d => d.b16), true, C_CALC);

  secRow(16, `MEDIOS DE PAGO REPORTADO (${pct*100}%)`, CH_MID);
  genRow(17, "Efectivo Tienda (Aj.)",   diaData.map(d => d.c9));
  genRow(18, "Efectivo Delivery (Aj.)", diaData.map(d => d.c10));
  genRow(19, "Punto de Venta (cajas)",   diaData.map(d => d.c11));
  genRow(20, "Pago Móvil (Aj.)",        diaData.map(d => d.c12));
  genRow(21, "Zelle (Aj.)",             diaData.map(d => d.c13));
  genRow(22, "Depósito Banco (Aj.)",    diaData.map(d => d.c14));
  genRow(23, "SISTEMA TOTAL AJUSTADO $", diaData.map(d => d.c23), true, C_HILITE);

  secRow(24, "DIFERENCIAS", CH_GREEN);
  genRow(25, "Sobrante / Faltante", diaData.map(d => d.b27));

  // Verification row
  lbl(wg.getCell(26, 1), false, C_CALC);
  wg.getCell(26, 1).value = "% Ajuste vs Real (verificación)";
  for (let ci = 0; ci < 7; ci++) {
    const real = diaData[ci]?.b16 ?? 0;
    const adj  = diaData[ci]?.c23 ?? 0;
    const c    = wg.getCell(26, ci + 2);
    c.value    = real > 0 ? adj / real : 0;
    c.numFmt   = PCT; c.border = Border;
    c.alignment = { horizontal:"right" };
    c.font      = { name:"Arial", color:{ argb:"FF000000" } };
    c.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:C_CALC } };
  }
  const totReal = diaData.reduce((s,d) => s + d.b16, 0);
  const totAdj  = diaData.reduce((s,d) => s + d.c23, 0);
  const totVerif = wg.getCell(26, 9);
  totVerif.value  = totReal > 0 ? totAdj / totReal : 0;
  totVerif.numFmt = PCT; totVerif.border = Border;
  totVerif.alignment = { horizontal:"right" };
  totVerif.font   = { name:"Arial", bold:true };
  totVerif.fill   = { type:"pattern", pattern:"solid", fgColor:{ argb:C_HILITE } };

  wg.views = [{ state:"frozen", xSplit:1, ySplit:3 }];

  // ── PUNTOS DE VENTA sheet ─────────────────────────────────────────────────
  const wp = wb.addWorksheet("PUNTOS DE VENTA");
  wp.columns = [
    { width: 22 }, // A: Caja
    { width: 14 }, // B: Punto ($)
    { width: 14 }, // C: Móvil (Bs)
    { width: 14 }, // D: Ef. Tienda Bs
    { width: 14 }, // E: Ef. Tienda $
    { width: 14 }, // F: Ef. Delivery Bs
    { width: 14 }, // G: Ef. Delivery $
    { width: 14 }, // H: Zelle ($)
    { width: 12 }, // I: Tasa
    { width: 14 }, // J: Total $
  ];

  // Title
  wp.mergeCells("A1:J1");
  wp.getCell("A1").value = `PUNTOS DE VENTA — ${tiendaNombre}`;
  hdr(wp.getCell("A1"), CH_DARK, 14); wp.getRow(1).height = 32;

  let wpRow = 2;

  diasSemana.forEach((diaName, i) => {
    const d = dias[i] || {};
    const counters: Array<{
      nombre: string; tasa: number;
      puntoSis: number; movilSis: number;
      vesSisTienda: number; usdSisTienda: number;
      vesSisDelivery: number; usdSisDelivery: number;
      zelleSis: number;
    }> = Array.isArray(d.counters) ? d.counters : [];

    // Day section header
    wp.mergeCells(`A${wpRow}:J${wpRow}`);
    wp.getCell(`A${wpRow}`).value = `${diaName.toUpperCase()} — ${addDays(semana, i)}`;
    hdr(wp.getCell(`A${wpRow}`), CH_MID, 11);
    wp.getRow(wpRow).height = 22;
    wpRow++;

    // Column headers
    const hdrs = ["CAJA / CAJERO", "PUNTO ($)", "MÓVIL (Bs)", "EF. TIENDA Bs", "EF. TIENDA $", "EF. DELIVERY Bs", "EF. DELIVERY $", "ZELLE ($)", "TASA", "TOTAL $"];
    hdrs.forEach((h, ci) => {
      const c = wp.getCell(wpRow, ci + 1);
      c.value = h; hdr(c, CH_GREEN, 9);
    });
    wp.getRow(wpRow).height = 20;
    wpRow++;

    if (counters.length === 0) {
      wp.mergeCells(`A${wpRow}:J${wpRow}`);
      wp.getCell(`A${wpRow}`).value = "Sin datos de cajas para este día";
      lbl(wp.getCell(`A${wpRow}`), false, C_CALC);
      wpRow++;
    } else {
      // Per-counter rows (green = seleccionada para el reporte, gris = omitida)
      const selIdxs = diaData[i]?.posSelectedIdxs ?? new Set<number>();
      counters.forEach((ctr, ctrIdx) => {
        const t = ctr.tasa > 0 ? ctr.tasa : 1;
        const isSelected = selIdxs.has(ctrIdx);
        const rowBg = isSelected ? "FFE2EFDA" : "FFF2F2F2"; // verde claro / gris
        const totalUsd =
          ctr.puntoSis / t +
          ctr.movilSis / t +
          ctr.vesSisTienda / t + ctr.usdSisTienda +
          ctr.vesSisDelivery / t + ctr.usdSisDelivery +
          ctr.zelleSis;

        const row = [
          (isSelected ? "✓ " : "✗ ") + ctr.nombre,
          ctr.puntoSis / t,
          ctr.movilSis,
          ctr.vesSisTienda,
          ctr.usdSisTienda,
          ctr.vesSisDelivery,
          ctr.usdSisDelivery,
          ctr.zelleSis,
          ctr.tasa,
          totalUsd,
        ];
        row.forEach((v, ci) => {
          const cell = wp.getCell(wpRow, ci + 1);
          cell.value = v;
          cell.border = Border;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          if (ci === 0) {
            cell.font = { name: "Arial", size: 9, bold: isSelected };
            cell.alignment = { horizontal: "left" };
          } else {
            cell.numFmt = ci === 8 ? '#,##0.00' : NUM;
            cell.font = { name: "Arial", size: 9, bold: isSelected };
            cell.alignment = { horizontal: "right" };
          }
        });
        wpRow++;
      });

      // Subtotal row
      const subPunto   = counters.reduce((s, c) => s + c.puntoSis / (c.tasa > 0 ? c.tasa : 1), 0);
      const subMovil   = counters.reduce((s, c) => s + c.movilSis, 0);
      const subVesTi   = counters.reduce((s, c) => s + c.vesSisTienda, 0);
      const subUsdTi   = counters.reduce((s, c) => s + c.usdSisTienda, 0);
      const subVesDe   = counters.reduce((s, c) => s + c.vesSisDelivery, 0);
      const subUsdDe   = counters.reduce((s, c) => s + c.usdSisDelivery, 0);
      const subZelle   = counters.reduce((s, c) => s + c.zelleSis, 0);
      const subTotal   = counters.reduce((s, c) => {
        const t2 = c.tasa > 0 ? c.tasa : 1;
        return s + c.puntoSis / t2 + c.movilSis / t2 + c.vesSisTienda / t2 + c.usdSisTienda + c.vesSisDelivery / t2 + c.usdSisDelivery + c.zelleSis;
      }, 0);

      const subRow = ["SUBTOTAL", subPunto, subMovil, subVesTi, subUsdTi, subVesDe, subUsdDe, subZelle, "", subTotal];
      subRow.forEach((v, ci) => {
        const cell = wp.getCell(wpRow, ci + 1);
        cell.value = v;
        cell.border = Border;
        cell.font = { name: "Arial", bold: true, size: 9, color: { argb: "FF000000" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C_CALC } };
        if (ci !== 0 && ci !== 8) {
          cell.numFmt = NUM;
          cell.alignment = { horizontal: "right" };
        } else if (ci === 8) {
          cell.alignment = { horizontal: "right" };
        }
      });
      wpRow++;
    }

    wpRow++; // blank row between days
  });

  wp.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  // ── Output ─────────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${tiendaNombre}-${semana}.xlsx"`,
    },
  });
}
