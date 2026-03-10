import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

export async function POST(req: NextRequest) {
  const { tienda, semana, porcentaje, dias } = await req.json();

  const wb = XLSX.utils.book_new();

  // Encabezado general
  const info = [
    ["Tienda", tienda],
    ["Semana", semana],
    ["Porcentaje", `${porcentaje}%`],
    [],
  ];

  // Cabeceras de columnas
  const headers = [
    "Día",
    "Tasa (Bs/$)",
    ...metodosPago.map((m) => `${m.label} (${m.moneda})`),
  ];

  // Filas de datos
  const rows = diasSemana.map((dia, i) => {
    const d = dias[i] || {};
    return [
      dia,
      d.tasa || "",
      ...metodosPago.map((m) => d[`${m.label}_${m.moneda}`] || ""),
    ];
  });

  const wsData = [...info, headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas
  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    ...metodosPago.map(() => ({ wch: 22 })),
  ];

  XLSX.utils.book_append_sheet(wb, ws, tienda.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${tienda}-${semana}.xlsx"`,
    },
  });
}
