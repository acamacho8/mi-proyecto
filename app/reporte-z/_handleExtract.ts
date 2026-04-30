  const handleExtract = async () => {
    if (!foundFile || !tesseractReady) return;
    setLoading("Descargando imagen...");
    setError("");
    setOcrProgress(0);
    try {
      const { data, type } = await drive.downloadFile(foundFile.id, foundFile.mimeType);
      const imageUrl = `data:${type};base64,${data}`;

      setLoading("Ejecutando OCR (puede tardar ~30s)...");

      // Tesseract.js v5 API
      const worker = await window.Tesseract.createWorker("spa", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const result = await worker.recognize(imageUrl);
      await worker.terminate();

      const text = result?.data?.text;
      if (!text) throw new Error("No se pudo extraer texto de la imagen");

      const parsed = parseReporteZ(text);
      setRawData(parsed);
      const extracted: Record<string, string> = {};
      BC_FIELDS.forEach(f => {
        const val = parsed[f.key as keyof typeof parsed];
        if (val != null) extracted[f.key] = String(val);
      });
      setFields(extracted);
    } catch (e: any) {
      setError("Error OCR: " + (e.message || JSON.stringify(e)));
    } finally {
      setLoading("");
      setOcrProgress(0);
    }
  };