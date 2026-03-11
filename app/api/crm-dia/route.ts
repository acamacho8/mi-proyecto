import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/crm-dia?date=YYYY-MM-DD&shopCode=FQ01
 *
 * Devuelve los valores del sistema (Reporte Z) para un día y tienda,
 * sumando todos los counters (cajas) del día.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const shopCode = searchParams.get("shopCode");

  if (!date || !shopCode) {
    return NextResponse.json({ error: "Faltan parámetros date o shopCode" }, { status: 400 });
  }

  const base = process.env.CRM_BASE_URL;
  if (!base) {
    return NextResponse.json({ error: "CRM_BASE_URL no configurada" }, { status: 500 });
  }

  try {
    const url = `${base}/counters-by-day?date=${date}&shopCode=${shopCode}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CRM ${res.status}`);

    const data = await res.json() as {
      success: boolean;
      counters: Array<{
        rate: number;
        vesSisTienda: number;
        usdSisTienda: number;
        vesSisDelivery: number;
        usdSisDelivery: number;
        puntoSis: number;
        movilSis: number;
        zelleSis: number;
      }>;
    };

    if (!data.success || !data.counters?.length) {
      return NextResponse.json({ error: "Sin datos para esa fecha/tienda" }, { status: 404 });
    }

    const counters = data.counters;

    // Tasa: promedio de los counters con rate > 0
    const rates = counters.map(c => c.rate).filter(r => r > 0);
    const tasa = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;

    // Sumar todos los counters
    const sum = (key: keyof typeof counters[0]) =>
      counters.reduce((s, c) => s + (Number(c[key]) || 0), 0);

    return NextResponse.json({
      tasa: tasa.toFixed(2),
      "sist_Punto de Venta_Bs":     sum("puntoSis").toFixed(2),
      "sist_Pago Móvil_Bs":         sum("movilSis").toFixed(2),
      "sist_Efectivo Tienda_Bs":    sum("vesSisTienda").toFixed(2),
      "sist_Efectivo Tienda_$":     sum("usdSisTienda").toFixed(2),
      "sist_Efectivo Delivery_Bs":  sum("vesSisDelivery").toFixed(2),
      "sist_Efectivo Delivery_$":   sum("usdSisDelivery").toFixed(2),
      "sist_Zelle_$":               sum("zelleSis").toFixed(2),
      "sist_Depósito Banco_Bs":     "0.00",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
