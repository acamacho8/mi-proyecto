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
const FAC = '0.0000;(0.0000);"-"';

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
    const b18 = b9 + b10 + b12 + b13 + b14;           // otros (excl POS)
    const b19 = b16 * pct;                              // meta ajustada
    const b20 = pct;
    const b21 = b18 > 0 ? Math.max(0, (b19 - b11) / b18) : 0; // factor

    // C column (ADJUSTED)
    const c9  = b9  * b21;
    const c10 = b10 * b21;
    const c11 = b11;           // POS 100%
    const c12 = b12 * b21;
    const c13 = b13 * b21;
    const c14 = b14 * b21;
    const c23 = c9 + c10 + c11 + c12 + c13 + c14;

    // INGRESOS section totals
    const b5 = b17;            // total Bs
    const b6 = b17 / t;        // equiv $
    const b7 = efTDir + efDDir + zelleD; // direct $

    const b27 = b16 - c23;     // sobrante = real - ajustado

    diaData.push({ name:diaName, fecha, b5, b6, b7, b9, b10, b11, b12, b13, b14, b16, c9, c10, c11, c12, c13, c14, c23, b27 });

    // ── Sheet ──────────────────────────────────────────────────────────────────
    const ws = wb.addWorksheet(diaName);
    ws.columns = [
      { width: 32 }, // A: CONCEPTO
      { width: 20 }, // B: VALOR REAL
      { width: 20 }, // C: VALOR AJUSTADO
      { width: 22 }, // D: NOTA
    ];

    // Row 1: Title
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = `REPORTE DE VENTAS — ${diaName.toUpperCase()}`;
    hdr(ws.getCell("A1"), CH_DARK, 14);
    ws.getRow(1).height = 32;

    // Row 2: Fecha / Tienda / Tasa
    ws.getCell("A2").value = "Tienda:"; lbl(ws.getCell("A2"), true, C_LABEL);
    ws.getCell("B2").value = tiendaNombre; inp(ws.getCell("B2"), "@");
    ws.getCell("C2").value = fecha; inp(ws.getCell("C2"), "DD/MM/YYYY");
    ws.getCell("D2").value = tasa || "-"; inp(ws.getCell("D2"), '#,##0.00;"-"');

    // Row 3: Column headers
    [["A","CONCEPTO"],["B","VALOR REAL ($)"],["C",`VALOR AJUSTADO (${pct*100}%)`],["D","TASA / NOTA"]].forEach(([col, title]) => {
      ws.getCell(`${col}3`).value = title; hdr(ws.getCell(`${col}3`), CH_MID, 10);
    });
    ws.getRow(3).height = 24;

    // ── INGRESOS section ───────────────────────────────────────────────────────
    ws.mergeCells("A4:D4");
    ws.getCell("A4").value = "INGRESOS"; hdr(ws.getCell("A4"), CH_GREEN, 10);

    const ingRows: [string, number, string][] = [
      ["Ingresos Bs",       b5, "=B5"],
      ["Ingreso Equiv $",   b6, "=B6"],
      ["Ingreso $ Directo", b7, "=B7"],
    ];
    ingRows.forEach(([label, val, formula], j) => {
      const r = 5 + j;
      ws.getCell(`A${r}`).value = label; lbl(ws.getCell(`A${r}`));
      ws.getCell(`B${r}`).value = val;   calc(ws.getCell(`B${r}`), NUM, C_CALC);
      fml(ws.getCell(`C${r}`), formula, val);
      empty(ws.getCell(`D${r}`));
    });

    // ── MEDIOS DE PAGO section ─────────────────────────────────────────────────
    ws.mergeCells("A8:D8");
    ws.getCell("A8").value = "MEDIOS DE PAGO"; hdr(ws.getCell("A8"), CH_GREEN, 10);

    type PM = [number, string, number, number, boolean];
    const pmRows: PM[] = [
      [9,  "Efectivo Tienda",   b9,  c9,  false],
      [10, "Efectivo Delivery", b10, c10, false],
      [11, "Punto de Venta",    b11, c11, true ],
      [12, "Pago Móvil",        b12, c12, false],
      [13, "Zelle",             b13, c13, false],
      [14, "Depósito Banco",    b14, c14, false],
    ];

    pmRows.forEach(([row, label, bVal, cVal, isPOS]) => {
      ws.getCell(`A${row}`).value = label; lbl(ws.getCell(`A${row}`));
      ws.getCell(`B${row}`).value = bVal;  inp(ws.getCell(`B${row}`));
      if (isPOS) {
        fml(ws.getCell(`C${row}`), `=B${row}`, cVal);
        const note = ws.getCell(`D${row}`);
        note.value = "Sin ajuste (100%)";
        note.font  = { name:"Arial", italic:true, color:{ argb:"FF7F7F7F" }, size:9 };
        note.alignment = { horizontal:"center" };
        note.border = Border;
      } else {
        fml(ws.getCell(`C${row}`), `=IF(B18=0,0,B${row}*B21)`, cVal);
        empty(ws.getCell(`D${row}`));
      }
    });

    // ── CÁLCULOS section ───────────────────────────────────────────────────────
    ws.mergeCells("A15:D15");
    ws.getCell("A15").value = "CÁLCULOS"; hdr(ws.getCell("A15"), CH_MID, 10);

    ws.getCell("A16").value = "Sistema Total Real $"; lbl(ws.getCell("A16"), false, C_CALC);
    fml(ws.getCell("B16"), "=B9+B10+B11+B12+B13+B14", b16, NUM, C_CALC);
    empty(ws.getCell("C16")); empty(ws.getCell("D16"));

    ws.getCell("A17").value = "Sistema Total Bs"; lbl(ws.getCell("A17"), false, C_CALC);
    ws.getCell("B17").value = b5; calc(ws.getCell("B17"), NUM, C_CALC);
    empty(ws.getCell("C17")); empty(ws.getCell("D17"));

    ws.getCell("A18").value = "Otros Métodos (excl. POS) $"; lbl(ws.getCell("A18"), false, C_CALC);
    fml(ws.getCell("B18"), "=B9+B10+B12+B13+B14", b18, NUM, C_CALC);
    empty(ws.getCell("C18")); empty(ws.getCell("D18"));

    ws.getCell("A19").value = `Meta Ajustada (${pct*100}%) $`; lbl(ws.getCell("A19"), false, C_CALC);
    fml(ws.getCell("B19"), "=B16*B20", b19, NUM, C_CALC);
    empty(ws.getCell("C19")); empty(ws.getCell("D19"));

    ws.getCell("A20").value = "% Mínimo a Reportar"; lbl(ws.getCell("A20"), false, C_CALC);
    ws.getCell("B20").value = b20; inp(ws.getCell("B20"), PCT);
    empty(ws.getCell("C20")); empty(ws.getCell("D20"));

    ws.getCell("A21").value = "Factor de Ajuste"; lbl(ws.getCell("A21"), false, C_CALC);
    fml(ws.getCell("B21"), "=IF(B18=0,0,MAX(0,(B19-B11)/B18))", b21, FAC, C_CALC);
    empty(ws.getCell("C21")); empty(ws.getCell("D21"));

    // ── TOTALES REPORTADOS ─────────────────────────────────────────────────────
    ws.mergeCells("A22:D22");
    ws.getCell("A22").value = "TOTALES REPORTADOS"; hdr(ws.getCell("A22"), CH_DARK, 11);

    ws.getCell("A23").value = "Sistema Total Ajustado $"; lbl(ws.getCell("A23"), true, C_HILITE);
    fml(ws.getCell("B23"), "=B16", b16, NUM, C_CALC);
    const c23cell = ws.getCell("C23");
    c23cell.value  = { formula:"=C9+C10+C11+C12+C13+C14", result: c23 };
    c23cell.font   = { name:"Arial", bold:true, color:{ argb:"FF000000" } };
    c23cell.numFmt = NUM; c23cell.border = Border;
    c23cell.alignment = { horizontal:"right" };
    c23cell.fill  = { type:"pattern", pattern:"solid", fgColor:{ argb:C_HILITE } };
    empty(ws.getCell("D23"));

    ws.getCell("A24").value = "Sistema Total Bs (ref.)"; lbl(ws.getCell("A24"), false, C_CALC);
    fml(ws.getCell("B24"), "=B17", b5, NUM, C_CALC);
    empty(ws.getCell("C24")); empty(ws.getCell("D24"));

    const pctVerif = b16 > 0 ? c23 / b16 : 0;
    ws.getCell("A25").value = "% del Total Real (verificación)"; lbl(ws.getCell("A25"), false, C_CALC);
    empty(ws.getCell("B25"));
    fml(ws.getCell("C25"), "=IF(B16=0,0,C23/B16)", pctVerif, PCT, C_CALC);
    empty(ws.getCell("D25"));

    // ── DIFERENCIAS ────────────────────────────────────────────────────────────
    ws.mergeCells("A26:D26");
    ws.getCell("A26").value = "DIFERENCIAS"; hdr(ws.getCell("A26"), CH_GREEN, 10);

    ws.getCell("A27").value = "Sobrante / Faltante"; lbl(ws.getCell("A27"));
    ws.getCell("B27").value = b27; inp(ws.getCell("B27"));
    fml(ws.getCell("C27"), "=B27", b27, NUM);
    const sobCell = ws.getCell("C27");
    sobCell.font = { name:"Arial", bold:true, color:{ argb: b27 >= 0 ? "FF008000" : "FFCC0000" } };
    empty(ws.getCell("D27"));

    // Freeze rows 1-3
    ws.views = [{ state:"frozen", xSplit:0, ySplit:3 }];

    // ── Images ─────────────────────────────────────────────────────────────────
    const imgs = imagenes?.[i];
    let filaImg = 29;
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

  secRow(8, "MEDIOS DE PAGO — VALOR REAL ($)", CH_MID);
  genRow(9,  "Efectivo Tienda",    diaData.map(d => d.b9));
  genRow(10, "Efectivo Delivery",  diaData.map(d => d.b10));
  genRow(11, "Punto de Venta",     diaData.map(d => d.b11));
  genRow(12, "Pago Móvil",         diaData.map(d => d.b12));
  genRow(13, "Zelle",              diaData.map(d => d.b13));
  genRow(14, "Depósito Banco",     diaData.map(d => d.b14));
  genRow(15, "Sistema Total Real $", diaData.map(d => d.b16), true, C_CALC);

  secRow(16, `MEDIOS DE PAGO — VALOR AJUSTADO (${pct*100}%)`, CH_MID);
  genRow(17, "Efectivo Tienda (Aj.)",   diaData.map(d => d.c9));
  genRow(18, "Efectivo Delivery (Aj.)", diaData.map(d => d.c10));
  genRow(19, "Punto de Venta (100%)",   diaData.map(d => d.c11));
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

  // ── Output ─────────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${tiendaNombre}-${semana}.xlsx"`,
    },
  });
}
