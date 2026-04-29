import { NextRequest, NextResponse } from "next/server";

const CLAUDE_SYSTEM = `Eres un extractor de datos de Reportes Z de máquinas fiscales HKA venezolanas para Full Queso.
Extrae estos campos y devuelve SOLO JSON válido sin backticks ni texto adicional:
{
  "modelo": "modelo de la máquina (ej: HKA-080)",
  "serialNo": "número serial",
  "numeroReporte": "número del reporte Z",
  "firstInvoiceNo": número entero del primer comprobante del día (NO el último del día anterior),
  "lastInvoiceNo": número entero del último comprobante del día,
  "reporteZTotalAmount": número: (TOTAL VENTA - IGTF VENTA) + (TOTAL ND - IGTF ND) - (TOTAL NC - IGTF NC),
  "igtfAmount": número: IGTF VENTA + IGTF ND - IGTF NC,
  "fecha": "YYYY-MM-DD",
  "totalGaveta": número del TOTAL GAVETA (para verificación),
  "confianza": número 0-100,
  "advertencias": [],
  "calculo_detalle": { "totalVenta": número, "igtfVenta": número, "totalNotaDebito": número, "igtfNotaDebito": número, "totalNotaCredito": número, "igtfNotaCredito": número }
}
REGLAS: firstInvoiceNo = primer ticket del día actual. reporteZTotalAmount NO incluye IGTF. null si no encuentras el campo.`;

export async function POST(req: NextRequest) {
  try {
    const { data, mediaType } = await req.json();

    const isPDF = mediaType === "application/pdf";
    const contentBlock = isPDF
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data } };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: CLAUDE_SYSTEM,
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: "Extrae los datos de este Reporte Z." }],
          },
        ],
      }),
    });

    const apiData = await res.json();
    if (apiData.error) return NextResponse.json({ error: apiData.error.message }, { status: 500 });

    const text = apiData.content?.find((b: any) => b.type === "text")?.text || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
