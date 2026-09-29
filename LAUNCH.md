# SHIAGENT launch runbook

## Build and verify

1. Install dependencies and run `npm run build`.
2. Run `npm test` and `npm run launch:check`.
3. Deploy the repository root as the static publish directory. `_headers` is supported by Cloudflare Pages and Netlify.
4. Confirm that an unknown URL returns the custom `404.html` with HTTP status 404.
5. Check the production response headers and verify that every tool still loads its Worker and WebAssembly assets.

## Contact activation

The first real form submission causes FormSubmit to send an activation message to `yamamotoshiki@yahoo.co.jp`. Open that message and approve the form. Until it is approved, subsequent inquiries will not be delivered normally. Submit one test inquiry after deployment and reply to it to verify the full path.

## Search ownership

1. Add `https://shiagent.com/` as a Search Console property.
2. Choose HTML-tag verification and copy only the `content` token.
3. Set `GOOGLE_SITE_VERIFICATION` in the production build environment and rebuild.
4. Optionally set `BING_SITE_VERIFICATION` in the same way for Bing Webmaster Tools.
5. Verify ownership, submit `https://shiagent.com/sitemap.xml`, and inspect the home page plus the main tool pages.

The metadata generator inserts verification tags only on `/` and `/ja/`. Tokens are not committed to source control.

## Privacy-safe diagnostics

The site keeps at most 30 sanitized diagnostic events in the current tab's `sessionStorage`. Nothing is sent automatically. A visitor can explicitly include these diagnostics in the contact form. Do not add file names, file contents, prompt text, or generated SVG data to telemetry events.
