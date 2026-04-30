  useEffect(() => {
    if (typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js";
    script.onload = () => setTesseractReady(true);
    document.head.appendChild(script);
  }, []);