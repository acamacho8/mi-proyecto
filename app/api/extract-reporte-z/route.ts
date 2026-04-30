import { NextRequest, NextResponse } from "next/server";

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

const parseReporteZ = (text: string) => {
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);

  const find = (pattern: RegExp): string | null => {
    for (const line of lines) {
      const m = line.match(pattern);
      if (m) return m[1]?.trim() || null;
    }
    return null;
  };

  const findNum = (pattern: RegExp): number | null => {
    const v = find(pattern);
    return v ? parseFloat(v.replace(/\./g, "").replace(",", ".")) : null;
  };

  const modelo = find(/modelo[:\s]+([A-Z0-9\-]+)/i) || find(/(HKA-\d+)/i);
  const serialNo = find(/serial[:\s#]+([A-Z0-9]+)/i) || find(/numero\s+de\s+maquina[:\s]+([A-Z0-9]+)/i);
  const numeroReporte = find(/reporte\s*z[:\s#]*(\d+)/i) || find(/numero\s+reporte[:\s]+(\d+)/i);
  const firstInvoiceNo = findNum(/first\s+invoice[:\s]+(\d+)/i) || findNum(/primera\s+factura[:\s]+(\d+)/i) || findNum(/desde[:\s]+(\d+)/i);
  const lastInvoiceNo = findNum(/last\s+invoice[:\s]+(\d+)/i) || findNum(/ultima\s+factura[:\s]+(\d+)/i) || findNum(/hasta[:\s]+(\d+)/i);

  const totalVenta = findNum(/total\s+venta[:\s]+([\d.,]+)/i);
  const igtfVenta = findNum(/igtf\s+venta[:\s]+([\d.,]+)/i) || findNum(/igtf\s*\(3[,.]00%\)[:\s]+([\d.,]+)/i);
  const totalNotaDebito = findNum(/total\s+nota\s+debito[:\s]+([\d.,]+)/i);
  const igtfNotaDebito = findNum(/igtf\s+nota\s+debito[:\s]+([\d.,]+)/i);
  const totalNotaCredito = findNum(/total\s+nota\s+credito[:\s]+([\d.,]+)/i);
  const igtfNotaCredito = findNum(/igtf\s+nota\s+credito[:\s]+([\d.,]+)/i);
  const totalGaveta = findNum(/total\s+gaveta[:\s]+([\d.,]+)/i);

  const tv = totalVenta || 0;
  const iv = igtfVenta || 0;
  const tnd = totalNotaDebito || 0;
  const ind = igtfNotaDebito || 0;
  const tnc = totalNotaCredito || 0;
  const inc = igtfNotaCredito || 0;

  const reporteZTotalAmount = (tv - iv) + (tnd - ind) - (tnc - inc);
  const igtfAmount = iv + ind - inc;

  const advertencias: string[] = [];
  if (!modelo) advertencias.push("Modelo no encontrado");
  if (!serialNo) advertencias.push("Serial no encontrado");
  if (!firstInvoiceNo) advertencias.push("First Invoice no encontrado");
  if (!lastInvoiceNo) advertencias.push("Last Invoice no encontrado");
  if (!totalVenta) advertencias.push("Total Venta no encontrado — verificar cálculo manualmente");

  const fechaMatch = text.match(/fecha[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i)
    || text.match(/(\d{2}-\d{2}-\d{4})/);
  let fecha: string | null = null;
  if (fechaMatch) {
    const parts = fechaMatch[1].split(/[-\/]/);
    if (parts[2]?.length === 4) {
      fecha = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    } else if (parts[0]?.length === 4) {
      fecha = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
  }

  const confianza = [modelo, serialNo, numeroReporte, firstInvoiceNo, lastInvoiceNo, totalVenta]
    .filter(Boolean).length / 6 * 100;

  return {
    modelo, serialNo, numeroReporte,
    firstInvoiceNo, lastInvoiceNo,
    reporteZTotalAmount: Math.round(reporteZTotalAmount * 100) / 100,
    igtfAmount: Math.round(igtfAmount * 100) / 100,
    fecha, totalGaveta,
    confianza: Math.round(confianza),
    advertencias,
    calculo_detalle: {
      totalVenta, igtfVenta,
      totalNotaDebito, igtfNotaDebito,
      totalNotaCredito, igtfNotaCredito
    }
  };
};

export async function POST(req: NextRequest) {
  try {
    const { data, mediaType } = await req.json();
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GOOGLE_VISION_API_KEY no configurada" }, { status: 500 });

    const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: data },
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
        }]
      }),
    });

    const apiData = await res.json();
    if (apiData.error) return NextResponse.json({ error: apiData.error.message }, { status: 500 });

    const text = apiData.responses?.[0]?.fullTextAnnotation?.text || "";
    if (!text) return NextResponse.json({ error: "No se pudo extraer texto de la imagen" }, { status: 422 });

    const parsed = parseReporteZ(text);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
