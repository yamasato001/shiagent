import { pick } from "./i18n.js";
import common from "./i18n/common.js";

const queuePanel = document.querySelector("#queuePanel");
const fileInput = document.querySelector("#fileInput");

if (queuePanel && fileInput) {
  let dragDepth = 0;
  queuePanel.dataset.dropLabel = pick(common).dropToAdd;

  const includesFiles = event => [...(event.dataTransfer?.types || [])].includes("Files");
  const clearDragState = () => {
    dragDepth = 0;
    queuePanel.classList.remove("is-over");
  };

  queuePanel.addEventListener("dragenter", event => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    queuePanel.classList.add("is-over");
  });

  queuePanel.addEventListener("dragover", event => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    queuePanel.classList.add("is-over");
  });

  queuePanel.addEventListener("dragleave", event => {
    if (!includesFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) queuePanel.classList.remove("is-over");
  });

  queuePanel.addEventListener("drop", event => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = [...event.dataTransfer.files];
    clearDragState();
    if (!files.length || fileInput.disabled) return;
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
