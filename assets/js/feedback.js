const form = document.querySelector("#feedbackForm");
const type = document.querySelector("#feedbackType");
const page = document.querySelector("#feedbackPage");
const message = document.querySelector("#feedbackMessage");
const email = document.querySelector("#feedbackEmail");
const environment = document.querySelector("#includeEnvironment");
const status = document.querySelector("#feedbackStatus");
const download = document.querySelector("#downloadFeedback");
const submit = document.querySelector("#sendFeedback");
const website = document.querySelector("#feedbackWebsite");
const ja = document.documentElement.lang === "ja";
const startedAt = Date.now();

function report() {
  const rows = [
    "SHIAGENT feedback",
    `Type: ${type.value}`,
    `Tool/page: ${page.value.trim() || "-"}`,
    `Reply email: ${email.value.trim() || "-"}`,
    "",
    message.value.trim(),
  ];
  if (environment.checked) rows.push("", `URL: ${location.href}`, `Browser: ${navigator.userAgent}`);
  rows.push("", `Created: ${new Date().toISOString()}`);
  return rows.join("\n");
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (Date.now() - startedAt < 2500 || website.value) {
    status.textContent = ja ? "送信できませんでした。少し待ってから再度お試しください。" : "Could not send. Please wait a moment and try again.";
    return;
  }
  submit.disabled = true;
  status.textContent = ja ? "送信中…" : "Sending…";
  try {
    const data = new FormData();
    data.set("_subject", `[SHIAGENT feedback] ${type.value}: ${page.value.trim() || "general"}`);
    data.set("_template", "table");
    data.set("_captcha", "false");
    data.set("type", type.value);
    data.set("tool_or_page", page.value.trim());
    data.set("email", email.value.trim());
    data.set("message", report());
    const response = await fetch("https://formsubmit.co/ajax/yamamotoshiki@yahoo.co.jp", { method: "POST", headers: { Accept: "application/json" }, body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || `HTTP ${response.status}`);
    form.reset();
    status.textContent = ja ? "フィードバックを送信しました。" : "Feedback sent.";
  } catch (error) {
    console.error(error);
    status.innerHTML = ja ? '送信できませんでした。<a href="mailto:yamamotoshiki@yahoo.co.jp?subject=SHIAGENTフィードバック">メールで送信してください。</a>' : 'Could not send. <a href="mailto:yamamotoshiki@yahoo.co.jp?subject=SHIAGENT%20feedback">Send by email instead.</a>';
  } finally {
    submit.disabled = false;
  }
});

download?.addEventListener("click", () => {
  if (!form.reportValidity()) return;
  const url = URL.createObjectURL(new Blob([report()], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shiagent-feedback-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = ja ? "報告文を保存しました。" : "Report saved.";
});
