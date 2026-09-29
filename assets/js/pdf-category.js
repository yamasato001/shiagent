import { mountPdfTray } from "./pdf-tray.js";

mountPdfTray(document.querySelector("#pdfTrayRoot"), { lang: document.documentElement.lang === "ja" ? "ja" : "en" });

