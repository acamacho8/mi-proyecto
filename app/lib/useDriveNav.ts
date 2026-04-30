"use client";
import { useRef, useCallback } from "react";

declare global { interface Window { google: any; } }

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "283123145928-1l7vbsufcajsaidkk7n1uv9p7ql7ldah.apps.googleusercontent.com";
const SCOPE = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file"
].join(" ");
const ROOT_FOLDER_ID = "1-a5lK2UKyqRcsMMOz2fIY3J2fvXx2JGv";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function driveList(token: string, parentId: string, onlyFolders = false): Promise<DriveFile[]> {
  const mimeFilter = onlyFolders ? `and mimeType='application/vnd.google-apps.folder'` : "";
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false ${mimeFilter}`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&orderBy=name&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.files || [];
}

export const STORE_PATTERN: Record<string, (name: string) => boolean> = {
  FQ01: (name) => name.toUpperCase().startsWith("MF"),
  FQ88: (name) => name.toUpperCase().startsWith("MF"),
  FQ28: (name) => name.toLowerCase().includes("reporte z") || name.toLowerCase().includes("reporte_z"),
};

export function useDriveNav() {
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async (): Promise<string> => {
    await loadScript("https://accounts.google.com/gsi/client");
    if (tokenRef.current) return tokenRef.current;
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          tokenRef.current = resp.access_token;
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: "" });
    });
  }, []);

  const listStoreFolders = useCallback(async (): Promise<DriveFile[]> => {
    const token = await getToken();
    return driveList(token, ROOT_FOLDER_ID, true);
  }, [getToken]);

  const listMonths = useCallback(async (storeFolderId: string): Promise<DriveFile[]> => {
    const token = await getToken();
    return driveList(token, storeFolderId, true);
  }, [getToken]);

  const listDays = useCallback(async (monthFolderId: string): Promise<DriveFile[]> => {
    const token = await getToken();
    return driveList(token, monthFolderId, true);
  }, [getToken]);

  const findReporteZ = useCallback(async (dayFolderId: string, storeCode: string): Promise<DriveFile | null> => {
    const token = await getToken();
    const files = await driveList(token, dayFolderId, false);
    const pattern = STORE_PATTERN[storeCode];
    if (!pattern) return null;
    return files.find(f => pattern(f.name)) ?? null;
  }, [getToken]);

  // OCR via Google Doc: copia la imagen como Google Doc (Drive hace OCR automático), 
  // exporta el texto y elimina el Doc temporal
  const extractTextViaGoogleDoc = useCallback(async (fileId: string, onStatus?: (msg: string) => void): Promise<string> => {
    const token = await getToken();

    // Paso 1: Copiar imagen como Google Doc (Drive hace OCR automáticamente)
    onStatus?.("Convirtiendo imagen a Google Doc (OCR)...");
    const copyRes = await fetch("https://www.googleapis.com/drive/v3/files/copy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `_fq_ocr_temp_${Date.now()}`,
        mimeType: "application/vnd.google-apps.document",
        parents: [], // raíz de Mi Drive
      }),
    });

    // Drive v3 copy con conversión requiere pasar el fileId en la URL
    const copyRes2 = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `_fq_ocr_temp_${Date.now()}`,
        mimeType: "application/vnd.google-apps.document",
      }),
    });

    const copyData = await copyRes2.json();
    if (copyData.error) throw new Error("Error al crear Doc: " + copyData.error.message);
    const docId = copyData.id;

    try {
      // Paso 2: Exportar el Doc como texto plano
      onStatus?.("Extrayendo texto del documento...");
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!exportRes.ok) throw new Error("Error al exportar texto del Doc");
      const text = await exportRes.text();
      return text;
    } finally {
      // Paso 3: Eliminar el Doc temporal
      onStatus?.("Limpiando archivos temporales...");
      await fetch(`https://www.googleapis.com/drive/v3/files/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }, [getToken]);

  return { listStoreFolders, listMonths, listDays, findReporteZ, extractTextViaGoogleDoc };
}
