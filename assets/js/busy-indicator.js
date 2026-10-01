// Spinner next to a tool's run button while it is processing.
// Tools already signal "busy" in one of two ways, so no tool script has to call this:
//   - a Cancel button is shown (compressor, converter, resizer, workflows, ...), or
//   - the run button is disabled while files are queued (splitter, SVG tools, ...).
//     With no files the queue panel is hidden, so a disabled button there means busy.
import { pick } from "./i18n.js";
import common from "./i18n/common.js";

const label = pick(common).processing;

for (const actions of document.querySelectorAll(".run-actions")) {
  const run = actions.querySelector(".button-accent");
  const cancel = actions.querySelector("#cancelButton");
  const panel = actions.closest(".queue-panel, .settings-panel") || actions.parentElement;
  const hasProgressText = Boolean(actions.querySelector(".vector-progress"));

  const indicator = document.createElement("span");
  indicator.className = hasProgressText ? "busy-indicator" : "busy-indicator busy-indicator-labelled";
  indicator.hidden = true;
  // Tools with their own progress text already announce progress; elsewhere say "Processing…".
  if (hasProgressText) indicator.setAttribute("aria-hidden", "true");
  else {
    indicator.setAttribute("role", "status");
    indicator.append(label);
  }
  actions.prepend(indicator);

  // Only write when the state actually changes: setting `hidden` to the value it
  // already has still queues a mutation, and the observer below would then call
  // update() again forever (the page froze on load before this guard).
  let busyNow = false;
  const update = () => {
    const visible = !actions.closest("[hidden]");
    const busy = visible && Boolean((cancel && !cancel.hidden) || (run && run.disabled && !run.hidden));
    if (busy === busyNow) return;
    busyNow = busy;
    indicator.hidden = !busy;
    if (busy) panel.setAttribute("aria-busy", "true");
    else panel.removeAttribute("aria-busy");
  };
  // Ignore the indicator's own changes; react to the tool's buttons and panels.
  const observer = new MutationObserver(records => {
    if (records.every(record => record.target === indicator)) return;
    update();
  });
  observer.observe(actions, { subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
  // The queue panel is hidden while empty; showing it can change the answer too.
  for (let node = actions.parentElement; node && node !== document.body; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeFilter: ["hidden"] });
  }
  update();
}
