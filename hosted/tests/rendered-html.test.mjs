import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the native Next.js build expected by Vercel", async () => {
  const [packageJson, layout, page] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.engines.node, "22.x");
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.devDependencies.vinext, undefined);
  assert.equal(pkg.devDependencies.wrangler, undefined);

  assert.match(layout, /title: "BioAtlas \| OVAITY"/);
  assert.match(layout, /The OVAITY BioAtlas is a free, continuously expanding knowledge base/);
  assert.match(page, /Building or managing life-science research\?/);
  assert.match(page, /href="https:\/\/www\.ovaity\.com\/#waitlist"/);
  assert.match(page, /target="_blank"/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.match(page, /aria-label="Join the OVAITY waitlist \(opens in a new tab\)"/);
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
