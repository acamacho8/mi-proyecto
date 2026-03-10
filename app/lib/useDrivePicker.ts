"use client";
import { useCallback, useRef } from "react";

declare global {
  interface Window { gapi: any; google: any; }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "283123145928-1l7vbsufcajsaidkk7n1uv9p7ql7ldah.apps.googleusercontent.com";
const API_KEY   = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
const SCOPE     = "https://www.googleapis.com/auth/drive.readonly";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useDrivePicker(
  onFilePicked: (dataUrl: string) => void,
) {
  const tokenRef = useRef<string | null>(null);

  const openPicker = useCallback(async () => {
    await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]);

    // Cargar módulo picker de gapi
    await new Promise<void>(resolve => window.gapi.load("picker", resolve));

    // Obtener access token si no tenemos uno
    if (!tokenRef.current) {
      tokenRef.current = await new Promise<string>((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (resp: any) => {
            if (resp.error) { reject(new Error(resp.error)); return; }
            resolve(resp.access_token);
          },
        });
        client.requestAccessToken({ prompt: "" });
      });
    }

    const builder = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS_IMAGES)
      .setOAuthToken(tokenRef.current)
      .setCallback(async (data: any) => {
        if (data.action !== window.google.picker.Action.PICKED) return;

        const doc = data.docs[0];
        const fileId   = doc.id;
        const mimeType = doc.mimeType ?? "image/jpeg";

        const resp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );

        if (resp.status === 401) {
          // Token expirado: forzar nuevo login la próxima vez
          tokenRef.current = null;
          alert("Sesión de Google expirada. Intenta de nuevo.");
          return;
        }

        const buffer = await resp.arrayBuffer();
        const bytes  = new Uint8Array(buffer);
        let binary   = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;
        onFilePicked(dataUrl);
      });

    if (API_KEY) builder.setDeveloperKey(API_KEY);

    builder.build().setVisible(true);
  }, [onFilePicked]);

  return openPicker;
}
