import { readCustomWorkflows, toolById } from "./custom-workflow-core.js";
import { readTray, replaceTray } from "./work-tray.js";
import { readPdfTray, replacePdfTray } from "./pdf-tray.js";

const params = new URLSearchParams(location.search);
const id = params.get("customWorkflow");
const stepIndex = Number(params.get("step") || 0);
const workflow = readCustomWorkflows().find(item => item.id === id);
if (workflow && Number.isInteger(stepIndex) && workflow.steps[stepIndex]) {
  const ja = document.documentElement.lang === "ja";
  const current = toolById(workflow.steps[stepIndex]);
  const next = toolById(workflow.steps[stepIndex + 1]);
  const prefix = ja ? "/ja" : "";
  const text = ja ? { beta: "ORIGINAL WORKFLOW · BETA", step: "工程", help: "このツールで処理・保存してから、次の工程へ進んでください。", next: "次の工程へ", done: "ワークフローを完了", edit: "編集に戻る" } : { beta: "ORIGINAL WORKFLOW · BETA", step: "Step", help: "Finish and save in this tool, then continue to the next step.", next: "Next step", done: "Finish workflow", edit: "Back to editor" };
  const panel = document.createElement("aside");
  panel.className = "custom-workflow-runner";
  panel.setAttribute("aria-label", text.beta);
  panel.innerHTML = `<div><span>${text.beta}</span><strong>${workflow.name}</strong><small>${text.step} ${stepIndex + 1} / ${workflow.steps.length} · ${text.help}</small></div><div><a href="${prefix}/workflows/custom/?edit=${encodeURIComponent(id)}">${text.edit}</a><button type="button">${next ? text.next : text.done} <b>→</b></button></div>`;
  panel.querySelector("button").addEventListener("click", async () => {
    if (!next) { location.href = `${prefix}/workflows/custom/?completed=${encodeURIComponent(id)}`; return; }
    if (current.category === "pdf" && next.category !== "pdf") {
      const files = await readPdfTray().catch(() => []);
      if (files.length) await replaceTray(files).catch(() => {});
    } else if (current.category !== "pdf" && next.category === "pdf" && next.id !== "images-to-pdf") {
      const files = (await readTray().catch(() => [])).filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
      if (files.length) await replacePdfTray(files).catch(() => {});
    }
    const target = new URL(`${prefix}${next.path}`, location.origin);
    target.searchParams.set("customWorkflow", id); target.searchParams.set("step", String(stepIndex + 1));
    if (next.category !== "pdf" || next.id === "images-to-pdf") target.searchParams.set("tray", "1");
    location.href = `${target.pathname}${target.search}`;
  });
  const style = document.createElement("link"); style.rel = "stylesheet"; style.href = "/assets/css/custom-workflow.css"; document.head.append(style);
  document.body.prepend(panel);
}
