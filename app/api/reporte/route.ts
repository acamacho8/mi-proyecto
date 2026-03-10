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
const BOLD   = { bold: true };
const CENTER = { horizontal: "center" as const };
const NUM_FMT = "#,##0.00";

export async function POST(req: NextRequest) {
  const { tienda, semana, porcentaje, dias } = await req.json();
  const tiendaNombre = (tienda.split(" - ")[1] || tienda).toUpperCase();

  const wb = new ExcelJS.Workbook();

  diasSemana.forEach((diaName, i) => {
    const dia = dias[i] || {};
    const tasa = num(dia.tasa);
    const fecha = addDays(semana, i);

    const metodos = [
      { label: "Efectivo Tienda",  bs: num(dia["Efectivo Tienda_Bs"]),   usd: num(dia["Efectivo Tienda_$"]) },
      { label: "Efectivo Delivery",bs: num(dia["Efectivo Delivery_Bs"]), usd: num(dia["Efectivo Delivery_$"]) },
      { label: "Punto de Venta",   bs: num(dia["Punto de Venta_Bs"]),    usd: 0 },
      { label: "Pago Móvil",       bs: num(dia["Pago Móvil_Bs"]),        usd: 0 },
      { label: "Zelle",            bs: 0,                                 usd: num(dia["Zelle_$"]) },
      { label: "Depósito Banco",   bs: num(dia["Depósito Banco_Bs"]),    usd: 0 },
    ];

    const calc = metodos.map(m => ({
      ...m,
      equiv: tasa > 0 ? m.bs / tasa : 0,
    }));

    const totBs    = calc.reduce((s, m) => s + m.bs, 0);
    const totEquiv = calc.reduce((s, m) => s + m.equiv, 0);
    const totUsd   = calc.reduce((s, m) => s + m.usd, 0);
    const totSist  = totEquiv + totUsd;

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
    const tot = ws.getRow(8);
    const totCells: [number, string | number][] = [
      [1, "TOTALES"],
      [2, dash(totBs)],   [3, "$"],
      [4, dash(totEquiv)],[5, "$"],
      [6, dash(totUsd)],  [7, "$"],
      [8, dash(totSist)], [9, "$"],
      [10, ""],
    ];
    totCells.forEach(([col, val]) => {
      const c = tot.getCell(col);
      c.value = val;
      c.font = BOLD;
    });
    [2, 4, 6, 8].forEach(col => { tot.getCell(col).numFmt = NUM_FMT; });

    // ── Rows 10+: Métodos de pago ──────────────────────────────────────────────
    calc.forEach((m, idx) => {
      const row = ws.getRow(10 + idx);
      row.getCell(1).value = m.label;
      row.getCell(2).value = dash(m.bs);     row.getCell(3).value = "$";
      row.getCell(4).value = dash(m.equiv);  row.getCell(5).value = "$";
      row.getCell(6).value = dash(m.usd);    row.getCell(7).value = "$";
      row.getCell(8).value = "";             row.getCell(9).value = "$";
      row.getCell(10).value = "";

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
  });

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cierre-${tiendaNombre}-${semana}.xlsx"`,
    },
  });
}
