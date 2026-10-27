// Adds "Choose from Google Drive" next to each tool's file chooser. Picked files
// are handed to the tool's own file input, exactly like a drop or the file dialog.
import { driveConfigured, pickDriveFiles, preloadDrive } from "./google-drive.js";

const CHOOSERS = "#selectButton, #pdfChoose, #pdfOrderChoose";
const ja = () => document.documentElement.lang === "ja";
const label = () => (ja() ? "Google Driveから選択" : "Choose from Google Drive");

function driveErrorMessage(error) {
  if (error?.code === "DRIVE_PICKER_ERROR") return ja() ? `Google Driveでファイルを選択できませんでした（${error.message}）` : `Google Drive could not select the file (${error.message}).`;
  if (error?.code === "DRIVE_API_401") return ja() ? "Google Driveの認証期限が切れました。もう一度選択してください（401）" : "Google Drive authorization expired. Choose the file again (401).";
  if (error?.code === "DRIVE_API_403") return ja() ? "Google Driveへのアクセスが拒否されました。Drive APIと権限設定を確認してください（403）" : "Google Drive denied access. Check the Drive API and permission settings (403).";
  if (error?.code === "DRIVE_API_429") return ja() ? "Google Driveの利用上限に達しました。少し待って再試行してください（429）" : "Google Drive rate limit reached. Wait briefly and try again (429).";
  return ja() ? "Google Driveからファイルを読み込めませんでした。通信環境を確認して再試行してください" : "Could not load the file from Google Drive. Check the connection and try again.";
}

function showStatus(status, message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
  status.hidden = !message;
}

function handOver(input, files) {
  const transfer = new DataTransfer();
  files.forEach(file => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function mountButton(chooser, input) {
  if (chooser.nextElementSibling?.matches("[data-drive-input]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-light drive-input-button";
  button.dataset.driveInput = "";
  button.textContent = label();
  const status = document.createElement("span");
  status.className = "drive-input-status";
  status.role = "status";
  status.hidden = true;
  const preload = () => { preloadDrive().catch(() => {}); };
  button.addEventListener("pointerenter", preload, { once: true });
  button.addEventListener("focus", preload, { once: true });
  button.addEventListener("click", async event => {
    // The drop zone opens the file dialog on any click inside it.
    event.stopPropagation();
    if (button.disabled || input.disabled) return;
    button.disabled = true;
    showStatus(status, "");
    try {
      const files = await pickDriveFiles({
        accept: input.accept,
        multiple: input.multiple,
        title: label(),
        onProgress: (done, total) => {
          if (total) button.textContent = ja() ? `読み込み中… ${done}/${total}` : `Loading… ${done}/${total}`;
        },
      });
      if (files.length) handOver(input, files);
      button.textContent = label();
      if (files.length) showStatus(status, ja() ? `${files.length}件をGoogle Driveから読み込みました` : `Loaded ${files.length} file(s) from Google Drive`);
    } catch (error) {
      if (error?.name === "AbortError") button.textContent = label();
      else if (error?.code === "DRIVE_FOLDER_SELECTED") {
        showStatus(status, ja() ? "フォルダーを開いて、ファイルを選択してください" : "Open the folder and select files", true);
      } else if (error?.code === "DRIVE_UNSUPPORTED_SELECTION") {
        showStatus(status, ja() ? "このツールに対応するファイルを選択してください" : "Select a file supported by this tool", true);
      }
      else {
        console.error(error);
        showStatus(status, driveErrorMessage(error), true);
      }
      button.textContent = label();
    } finally {
      button.disabled = chooser.disabled;
    }
  });
  // Follow the chooser's disabled state (tools disable it while running).
  new MutationObserver(() => { button.disabled = chooser.disabled; }).observe(chooser, { attributes: true, attributeFilter: ["disabled"] });
  chooser.insertAdjacentElement("afterend", button);
  button.insertAdjacentElement("afterend", status);
}

export function installDriveInput(inputSelector) {
  if (!driveConfigured() || !inputSelector) return;
  const mount = () => {
    const input = document.querySelector(inputSelector);
    if (!input) return;
    document.querySelectorAll(CHOOSERS).forEach(chooser => mountButton(chooser, input));
  };
  mount();
  // PDF tools render their chooser after the bundle loads.
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
}
