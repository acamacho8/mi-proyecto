import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const PROMPT = `Eres un extractor de datos de Reportes Z de máquinas fiscales HKA venezolanas para Full Queso.
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
REGLAS: firstInvoiceNo = primer ticket del día actual. reporteZTotalAmount NO incluye IGTF. null si no encuentras el campo. SOLO JSON, sin explicaciones.`;

export async function POST(req: NextRequest) {
  try {
    const { data, mediaType } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data } },
            { text: PROMPT }
          ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024 }
      }),
    });

    const apiData = await res.json();
    if (apiData.error) return NextResponse.json({ error: apiData.error.message }, { status: 500 });

    const text = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
