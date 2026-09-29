const form = document.querySelector("#contactForm");
const status = document.querySelector("#contactStatus");
const tool = document.querySelector("#toolInput");
const diagnostics = document.querySelector("#diagnosticsInput");
const submit = document.querySelector("#contactSubmit");
const startedAt = Date.now();
const ja = document.documentElement.lang === "ja";

fetch("/ai/tools.json")
  .then(response => response.ok ? response.json() : Promise.reject(new Error("catalog")))
  .then(catalog => {
    for (const item of catalog.tools.filter(item => item.status === "active")) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name[ja ? "ja" : "en"] || item.name.en;
      tool.append(option);
    }
  })
  .catch(() => {});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (Date.now() - startedAt < 2500 || form.elements.website.value) {
    status.textContent = ja ? "送信できませんでした。少し待ってから再度お試しください。" : "Could not send. Please wait a moment and try again.";
    return;
  }

  const data = new FormData(form);
  data.set("_subject", `[SHIAGENT] ${data.get("category")}: ${data.get("tool") || "general"}`);
  data.set("_template", "table");
  data.set("_captcha", "false");
  data.set("page", location.href);
  if (diagnostics.checked) {
    data.set("diagnostics", JSON.stringify(window.SHIAGENT_DIAGNOSTICS?.snapshot() || {
      browser: navigator.userAgent,
      page: location.pathname,
    }, null, 2));
  } else {
    data.delete("diagnostics");
  }

  submit.disabled = true;
  status.textContent = ja ? "送信中…" : "Sending…";
  try {
    const response = await fetch("https://formsubmit.co/ajax/yamamotoshiki@yahoo.co.jp", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || `HTTP ${response.status}`);
    form.reset();
    status.textContent = ja
      ? "送信しました。初回のみ、運営者側でFormSubmitの確認メールを承認すると以後の問い合わせが届きます。"
      : "Sent. On the first submission, the operator must approve FormSubmit's confirmation email before messages are delivered.";
    status.classList.add("is-success");
    window.SHIAGENT_DIAGNOSTICS?.record("contact-sent", { category: data.get("category") });
  } catch (error) {
    console.error(error);
    status.innerHTML = ja
      ? '送信できませんでした。<a href="mailto:yamamotoshiki@yahoo.co.jp?subject=SHIAGENTへのお問い合わせ">メールでお問い合わせください。</a>'
      : 'Could not send. <a href="mailto:yamamotoshiki@yahoo.co.jp?subject=SHIAGENT%20inquiry">Contact us by email.</a>';
  } finally {
    submit.disabled = false;
  }
});
