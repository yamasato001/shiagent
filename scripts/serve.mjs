import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob: https://formsubmit.co; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://formsubmit.co; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = normalize(urlPath).replace(/^([/\\])+/, "");
  let file = join(root, relative);
  if (!file.startsWith(root) || !existsSync(file)) {
    const notFound = join(root, urlPath.startsWith("/ja/") ? "ja/404.html" : "404.html");
    response.writeHead(404, { ...securityHeaders, "Content-Type": mime[".html"] });
    createReadStream(notFound).pipe(response);
    return;
  }
  if (statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const notFound = join(root, urlPath.startsWith("/ja/") ? "ja/404.html" : "404.html");
    response.writeHead(404, { ...securityHeaders, "Content-Type": mime[".html"] });
    createReadStream(notFound).pipe(response);
    return;
  }
  response.writeHead(200, {
    ...securityHeaders,
    "Content-Type": mime[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`SHIAGENT: http://localhost:${port}/ja/image-compressor/`));
