import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/crm-dia?date=YYYY-MM-DD&shopCode=FQ01
 *
 * Devuelve:
 *  - tasa de cambio del día
 *  - sist_* (valores del Reporte Z desde counters-by-day)
 *  - OA campos de pago (desde trans-by-day, separando tienda vs delivery por mode)
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
    const [countersRes, transRes] = await Promise.allSettled([
      fetch(`${base}/counters-by-day?date=${date}&shopCode=${shopCode}`, { cache: "no-store" }),
      fetch(`${base}/trans-by-day?date=${date}&shopCode=${shopCode}`, { cache: "no-store" }),
    ]);

    // Parsear respuestas de forma independiente (fallo parcial permitido)
    let countersData: { success: boolean; counters: Array<{ rate: number; vesSisTienda: number; usdSisTienda: number; vesSisDelivery: number; usdSisDelivery: number; puntoSis: number; movilSis: number; zelleSis: number }> } | null = null;
    let transData: { success: boolean; orders: Array<{ mode: string; pagoPuntoBs: number; pagoMovilBs: number; cash: number; cashVuelto: number; pagoEfectivoBs: number; pagoEfectivoBsVuelto: number; zelle: number }> } | null = null;

    if (countersRes.status === "fulfilled" && countersRes.value.ok) {
      try { countersData = await countersRes.value.json(); } catch { /* ignore */ }
    }
    if (transRes.status === "fulfilled" && transRes.value.ok) {
      try { transData = await transRes.value.json(); } catch { /* ignore */ }
    }

    if (!countersData && !transData) {
      const c = countersRes.status === "fulfilled" ? countersRes.value.status : "error";
      const t = transRes.status === "fulfilled" ? transRes.value.status : "error";
      return NextResponse.json({ error: `Sin datos del CRM (counters: ${c}, trans: ${t})` }, { status: 502 });
    }

    // ── Sistema (Reporte Z) desde counters ─────────────────────────────────────
    const counters = countersData?.counters ?? [];
    const rates = counters.map(c => c.rate).filter(r => r > 0);
    const tasa = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;

    const sumC = (key: keyof typeof counters[0]) =>
      counters.reduce((s, c) => s + (Number(c[key]) || 0), 0);

    // ── OA (conteo real) desde trans ────────────────────────────────────────────
    const orders = transData?.orders ?? [];

    const sumTrans = (
      fn: (o: (typeof orders)[0]) => number,
      filter?: (o: (typeof orders)[0]) => boolean,
    ) =>
      orders
        .filter(filter ?? (() => true))
        .reduce((s, o) => s + (fn(o) || 0), 0);

    const isDelivery = (o: (typeof orders)[0]) =>
      typeof o.mode === "string" && o.mode.toLowerCase().includes("delivery");

    const isTienda = (o: (typeof orders)[0]) => !isDelivery(o);

    const efTiendaBs    = sumTrans(o => (o.pagoEfectivoBs || 0) - (o.pagoEfectivoBsVuelto || 0), isTienda);
    const efTiendaUsd   = sumTrans(o => (o.cash || 0) - (o.cashVuelto || 0), isTienda);
    const efDelivBs     = sumTrans(o => (o.pagoEfectivoBs || 0) - (o.pagoEfectivoBsVuelto || 0), isDelivery);
    const efDelivUsd    = sumTrans(o => (o.cash || 0) - (o.cashVuelto || 0), isDelivery);
    const puntoBs       = sumTrans(o => o.pagoPuntoBs);
    const movilBs       = sumTrans(o => o.pagoMovilBs);
    const zelleUsd      = sumTrans(o => o.zelle);

    return NextResponse.json({
      tasa: tasa.toFixed(2),

      // Campos OA (lo que el cajero contó / lo que ingresó)
      "Efectivo Tienda_Bs":    efTiendaBs  > 0 ? efTiendaBs.toFixed(2)  : "",
      "Efectivo Tienda_$":     efTiendaUsd > 0 ? efTiendaUsd.toFixed(2) : "",
      "Efectivo Delivery_Bs":  efDelivBs   > 0 ? efDelivBs.toFixed(2)   : "",
      "Efectivo Delivery_$":   efDelivUsd  > 0 ? efDelivUsd.toFixed(2)  : "",
      "Punto de Venta_Bs":     puntoBs     > 0 ? puntoBs.toFixed(2)     : "",
      "Pago Móvil_Bs":         movilBs     > 0 ? movilBs.toFixed(2)     : "",
      "Zelle_$":               zelleUsd    > 0 ? zelleUsd.toFixed(2)    : "",
      "Depósito Banco_Bs":     "",

      // Campos sistema (Reporte Z)
      "sist_Punto de Venta_Bs":    sumC("puntoSis").toFixed(2),
      "sist_Pago Móvil_Bs":        sumC("movilSis").toFixed(2),
      "sist_Efectivo Tienda_Bs":   sumC("vesSisTienda").toFixed(2),
      "sist_Efectivo Tienda_$":    sumC("usdSisTienda").toFixed(2),
      "sist_Efectivo Delivery_Bs": sumC("vesSisDelivery").toFixed(2),
      "sist_Efectivo Delivery_$":  sumC("usdSisDelivery").toFixed(2),
      "sist_Zelle_$":              sumC("zelleSis").toFixed(2),
      "sist_Depósito Banco_Bs":    "0.00",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
