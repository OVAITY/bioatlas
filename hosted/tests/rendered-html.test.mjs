import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the BioAtlas application shell and sidebar CTA", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BioAtlas \| OVAITY<\/title>/i);
  assert.match(html, /The OVAITY BioAtlas is a free, continuously expanding knowledge base/i);
  assert.match(html, /Building or managing life-science research\?/);
  assert.match(html, /href="https:\/\/www\.ovaity\.com\/#waitlist"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Join the OVAITY waitlist \(opens in a new tab\)"/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("ships the full BioAtlas-to-OVAITY CTA with accessible external links", async () => {
  const [app, css, page] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Ready to put your knowledge to work\?/i);
  assert.match(app, /You&rsquo;ve learned the language\. Now connect the science\./);
  assert.match(app, /BioAtlas helps you understand life-science concepts and methods\./);
  assert.match(app, /https:\/\/www\.ovaity\.com\/#waitlist/);
  assert.match(app, /https:\/\/www\.ovaity\.com/);
  assert.match(app, /rel="noopener noreferrer"/);
  assert.match(app, /Learn with BioAtlas\. Work with OVAITY\./);

  assert.match(page, /className="sidebar-cta"/);
  assert.match(css, /\.sidebar-cta:focus-visible/);
  assert.match(css, /\.platform-cta-primary:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
