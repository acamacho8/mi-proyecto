"use client";
import { useRef, useCallback } from "react";

declare global { interface Window { google: any; } }

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "283123145928-1l7vbsufcajsaidkk7n1uv9p7ql7ldah.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
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

export async function driveDownloadBase64(token: string, fileId: string, mimeType: string): Promise<{ data: string; type: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Error descargando archivo: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { data: btoa(binary), type: mimeType };
}

// Patrones por tienda para detectar el Reporte Z
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

  const downloadFile = useCallback(async (fileId: string, mimeType: string) => {
    const token = await getToken();
    return driveDownloadBase64(token, fileId, mimeType);
  }, [getToken]);

  return { listStoreFolders, listMonths, listDays, findReporteZ, downloadFile };
}
