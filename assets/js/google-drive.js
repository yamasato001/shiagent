// Google Drive as a file source and a save destination.
//
// Nothing from Google is loaded until the visitor points at or focuses a Drive
// button, so pages that never use Drive make no request to Google. Files travel
// directly between this browser and the visitor's own Drive; SHIAGENT has no
// server in between. The drive.file scope only reaches files the visitor picks
// in the Picker or that this site creates.
import { GOOGLE_DRIVE } from "./google-drive-config.js";
import { applyConfiguredOutputSuffix } from "./output-name.js";
import { safeFolderFileName } from "./folder-download.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const scripts = new Map();
let token = null;
let tokenClient = null;
let pending = null;

export function driveConfigured(config = GOOGLE_DRIVE) {
  return Boolean(config.clientId && config.apiKey);
}

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        scripts.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.append(script);
    }));
  }
  return scripts.get(src);
}

let libraries = null;
// Starts loading Google Identity Services and the Picker. Called on hover/focus
// so that the click itself can open the sign-in popup without being blocked.
export function preloadDrive() {
  if (!driveConfigured()) return Promise.reject(new Error("Google Drive is not configured"));
  libraries ||= Promise.all([
    loadScript("https://accounts.google.com/gsi/client"),
    loadScript("https://apis.google.com/js/api.js").then(() => new Promise((resolve, reject) => {
      window.gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Could not load Google Picker")) });
    })),
  ]).catch(error => {
    libraries = null;
    throw error;
  });
  return libraries;
}

function abortError() {
  return Object.assign(new Error("Google Drive was cancelled"), { name: "AbortError" });
}

function requestToken() {
  if (token && token.expires > Date.now() + 60_000) return Promise.resolve(token.value);
  tokenClient ||= window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_DRIVE.clientId,
    scope: SCOPE,
    callback: response => {
      const request = pending;
      pending = null;
      if (response.error) request?.reject(new Error(response.error_description || response.error));
      else {
        token = { value: response.access_token, expires: Date.now() + Number(response.expires_in || 3600) * 1000 };
        request?.resolve(token.value);
      }
    },
    error_callback: error => {
      const request = pending;
      pending = null;
      request?.reject(error?.type === "popup_closed" ? abortError() : new Error(error?.message || error?.type || "Google sign-in failed"));
    },
  });
  return new Promise((resolve, reject) => {
    pending?.reject(abortError());
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: token ? "" : undefined });
  });
}

async function authorise() {
  await preloadDrive();
  return requestToken();
}

// Tabs appear in the order given; the first one is shown when the Picker opens.
function showPicker(accessToken, views, { multiselect = false, title = "" } = {}) {
  const { picker } = window.google;
  return new Promise(resolve => {
    const builder = new picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(GOOGLE_DRIVE.apiKey)
      .setLocale(document.documentElement.lang === "ja" ? "ja" : "en")
      .setCallback(data => {
        if (data[picker.Response.ACTION] === picker.Action.PICKED) resolve(data[picker.Response.DOCUMENTS] || []);
        else if (data[picker.Response.ACTION] === picker.Action.CANCEL) resolve([]);
      });
    [views].flat().forEach(view => builder.addView(view));
    if (GOOGLE_DRIVE.appId) builder.setAppId(GOOGLE_DRIVE.appId);
    if (title) builder.setTitle(title);
    if (multiselect) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
}

// Exact MIME types from an <input accept> value. Extensions and wildcards
// (image/*) cannot be expressed in the Picker filter and are left out.
export function pickerMimeTypes(accept = "") {
  return [...new Set(String(accept).split(",").map(type => type.trim().toLowerCase()).filter(type => /^[a-z]+\/[a-z0-9.+-]+$/.test(type)))];
}

async function driveFetch(url, accessToken, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...options.headers } });
  if (response.status === 401) token = null;
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status})`);
  return response;
}

// Opens the Picker and downloads the chosen files into File objects.
// Remembers (per browser) that Drive files were picked here before, so the
// "Recently selected" tab is only put first once it has something to show.
const PICKED_KEY = "shiagent-drive-picked";
function pickedBefore() {
  try { return localStorage.getItem(PICKED_KEY) === "1"; } catch { return false; }
}
function rememberPicked() {
  try { localStorage.setItem(PICKED_KEY, "1"); } catch { /* storage unavailable */ }
}

export async function pickDriveFiles({ accept = "", multiple = true, title = "", onProgress = () => {} } = {}) {
  const accessToken = await authorise();
  const { picker } = window.google;
  const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);
  const mimeTypes = pickerMimeTypes(accept);
  const recent = new picker.View(picker.ViewId.RECENTLY_PICKED);
  if (mimeTypes.length) {
    view.setMimeTypes(mimeTypes.join(","));
    recent.setMimeTypes(mimeTypes.join(","));
  }
  const docs = (await showPicker(accessToken, pickedBefore() ? [recent, view] : [view, recent], { multiselect: multiple, title }))
    .filter(doc => doc.mimeType !== FOLDER_MIME && !String(doc.mimeType).startsWith("application/vnd.google-apps."));
  const files = [];
  for (const doc of docs) {
    onProgress(files.length, docs.length, doc.name);
    const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media&supportsAllDrives=true`, accessToken);
    const blob = await response.blob();
    files.push(new File([blob], doc.name, { type: doc.mimeType || blob.type, lastModified: Number(doc.lastEditedUtc) || Date.now() }));
  }
  onProgress(files.length, docs.length, "");
  if (files.length) rememberPicked();
  return files;
}

// Asks for a Drive folder. Resolves to its id, or null when cancelled.
export async function chooseDriveFolder({ title = "" } = {}) {
  const accessToken = await authorise();
  const { picker } = window.google;
  const view = new picker.DocsView(picker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes(FOLDER_MIME);
  const [folder] = await showPicker(accessToken, view, { title });
  return folder ? folder.id : null;
}

// Uploads files into a Drive folder with resumable uploads (any size).
export async function uploadFilesToDrive(folderId, files, onProgress = () => {}) {
  const accessToken = await authorise();
  let written = 0;
  for (let index = 0; index < files.length; index += 1) {
    const item = files[index];
    const blob = item?.blob || item;
    if (!blob || typeof blob !== "object") continue;
    const name = safeFolderFileName(applyConfiguredOutputSuffix(item?.name || blob.name), index);
    const type = blob.type || "application/octet-stream";
    const start = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type },
      body: JSON.stringify({ name, parents: folderId ? [folderId] : undefined }),
    });
    const location = start.headers.get("Location");
    if (!location) throw new Error("Google Drive did not return an upload URL");
    await driveFetch(location, accessToken, { method: "PUT", headers: { "Content-Type": type }, body: blob });
    written += 1;
    onProgress(written, files.length, name);
  }
  return written;
}
