// Adds "Choose from Google Drive" next to each tool's file chooser. Picked files
// are handed to the tool's own file input, exactly like a drop or the file dialog.
import { driveConfigured, pickDriveFiles, preloadDrive } from "./google-drive.js";

const CHOOSERS = "#selectButton, #pdfChoose, #pdfOrderChoose";
const ja = () => document.documentElement.lang === "ja";
const label = () => (ja() ? "Google Driveから選択" : "Choose from Google Drive");

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
  const preload = () => { preloadDrive().catch(() => {}); };
  button.addEventListener("pointerenter", preload, { once: true });
  button.addEventListener("focus", preload, { once: true });
  button.addEventListener("click", async event => {
    // The drop zone opens the file dialog on any click inside it.
    event.stopPropagation();
    if (button.disabled || input.disabled) return;
    button.disabled = true;
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
    } catch (error) {
      if (error?.name === "AbortError") button.textContent = label();
      else {
        console.error(error);
        button.textContent = ja() ? "Google Driveから読み込めませんでした" : "Could not load from Google Drive";
        setTimeout(() => { button.textContent = label(); }, 4000);
      }
    } finally {
      button.disabled = chooser.disabled;
    }
  });
  // Follow the chooser's disabled state (tools disable it while running).
  new MutationObserver(() => { button.disabled = chooser.disabled; }).observe(chooser, { attributes: true, attributeFilter: ["disabled"] });
  chooser.insertAdjacentElement("afterend", button);
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
