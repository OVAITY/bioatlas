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
  assert.match(page, /href="https:\/\/www\.ovaity\.com" className="brand"/);
  assert.match(page, /aria-label="Visit the OVAITY website"/);
  assert.match(page, /href="https:\/\/www\.ovaity\.com\/#waitlist"/);
  assert.match(page, /target="_blank"/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.match(page, /aria-label="Join the OVAITY waitlist \(opens in a new tab\)"/);
});

test("ships the full BioAtlas-to-OVAITY CTA with accessible external links", async () => {
  const [app, css, page, layout] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
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

  assert.doesNotMatch(layout, /data\/data\.js/);
  assert.doesNotMatch(layout, /data\/videos\.js/);
  assert.match(page, /app\.js\?v=20260923-7" strategy="afterInteractive"/);
  assert.match(app, /visibleAtlasGraph/);
  assert.match(app, /atlasSpineSeeds/);
  assert.match(app, /openExplorerNode/);
  assert.match(app, /The live knowledge graph/);
  assert.match(app, /openProvidersModal/);
  assert.match(app, /open-run-providers/);
  assert.match(app, /openModelModal/);
  assert.match(app, /modal-wide/);
  assert.match(app, /provider-logo/);
  assert.match(app, /MODELS_PAGE_SIZE/);
  assert.match(app, /Where you can run them/);
  assert.match(app, /mountInteractiveGraph/);
  assert.match(app, /setScale/);
  assert.match(app, /graphWorldSize/);
  assert.match(app, /fitViewBox/);
  assert.match(app, /visibleLabels/);
  assert.match(app, /data-zoom/);
  assert.match(css, /\.graph-zoom/);
  assert.match(app, /filterModels/);
  assert.match(app, /Filtered knowledge graph/);
  assert.match(app, /All run providers/);
  assert.match(css, /\.graph-stage/);
  assert.match(css, /\.graph-tooltip/);
  assert.match(page, /href=\{`\/#\/\$\{item.route\}`\}/);
  assert.match(page, /label: "Home"/);
  assert.match(page, /label: "Learning Hub"/);
  assert.match(page, /label: "Atlas"/);
  assert.match(page, /label: "Learn"/);
  assert.match(page, /label: "Explore"/);
  assert.match(page, /label: "Discover"/);
  assert.match(page, /route: "overview"/);
  assert.match(page, /route: "learn"/);
  assert.match(page, /route: "glossary"/);
  assert.match(page, /route: "models"/);
  assert.match(page, /route: "structures"/);
  assert.match(page, /route: "intelligence"/);
  assert.doesNotMatch(page, /label: "Overview"/);
  assert.doesNotMatch(page, /label: "BioAtlas"/);
  assert.doesNotMatch(page, /route: "review"/);
  assert.match(app, /function renderLearningHub\(\)/);
  assert.match(app, /Eight stages, start to finish/);
  assert.match(app, /home-view/);
  assert.match(app, /One BioAtlas\. Three ways to explore life science\./);
  assert.match(app, /Why we built BioAtlas/);
  assert.match(app, /BioAtlas at a glance/);
  assert.match(app, /Continue learning/);
  assert.match(app, /Explore the Atlas/);
  assert.doesNotMatch(app, /Workbook Summary/);
  assert.match(css, /#app:has\(\.home-view\)/);
  assert.match(css, /\.home-modes/);
  assert.match(css, /\.home-spine/);
  assert.match(css, /\.nav-section-label/);
  assert.match(css, /\.nav-section \{ display: contents; \}/);
  assert.match(app, /function readSavedTheme\(\)/);
  assert.match(app, /window\.localStorage\.getItem/);
  assert.match(app, /catch \(error\)/);
  assert.match(app, /BioAtlas could not load this view\./);
  assert.match(app, /fetch\("\/api\/atlas"\)/);
  assert.match(app, /Connected in BioAtlas/);
  assert.match(app, /renderModels/);
  assert.match(app, /renderStructures/);
  assert.match(app, /Explore life by scale/);
  assert.match(app, /structures-view/);
  assert.match(app, /scale-atlas/);
  assert.doesNotMatch(app, /Start exploring/);
  assert.match(app, /collection: 10/);
  assert.match(app, /fetch\("\/api\/structures"\)/);
  assert.match(css, /\.structures-view/);
  assert.match(app, /species-chip/);
  assert.match(app, /Whole organism/);
  assert.match(app, /Search resources, structures, databases/);
  assert.match(app, /structure-filters-btn/);
  assert.match(app, /structuresQuery/);
  assert.match(css, /\.species-chip/);
  assert.match(css, /\.scale-filter-btn/);
  assert.doesNotMatch(css, /\.journey-grid/);
  assert.match(css, /\.graph-node-collection/);
  assert.match(app, /renderIntelligence/);
  assert.match(app, /renderEventsGraph/);
  assert.match(app, /Knowledge graph/);
  assert.doesNotMatch(app, /renderReview/);
  assert.match(app, /https:\/\/bio\.rodeo\/models/);
  assert.match(app, /Browse all models on bio\.rodeo/);
});

test("defines a Postgres kernel and compatibility APIs", async () => {
  const [schema, atlas, graph, models, events, structures, collectionsMigration, atlasMigration] = await Promise.all([
    readFile(new URL("../drizzle/0001_init.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/atlas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/graph/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/models/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/structures/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_collections.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0005_structure_atlas.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /CREATE TABLE entities/);
  assert.match(schema, /CREATE TABLE entity_relations/);
  assert.match(atlas, /getAtlasPayload/);
  const queries = await readFile(new URL("../lib/queries.ts", import.meta.url), "utf8");
  assert.match(queries, /modelCount/);
  assert.match(queries, /collectionCount/);
  assert.match(queries, /recentEvents/);
  assert.match(graph, /getNeighbors/);
  assert.match(graph, /getKnowledgeGraph/);
  assert.match(models, /getModelCatalogue/);
  assert.match(models, /hasBiorodeoCatalogue/);
  assert.match(events, /getEventFeed/);
  assert.match(structures, /getStructureCatalogue/);
  assert.match(structures, /getStructureAtlas/);
  assert.match(collectionsMigration, /CREATE TABLE collections/);
  assert.match(atlasMigration, /relevant_model/);
  assert.match(atlasMigration, /Organisms/);
});

test("includes the curated 3D structure portals", async () => {
  const catalogue = JSON.parse(await readFile(new URL("../data/structures/collections.json", import.meta.url), "utf8"));
  const collections = catalogue.collections;
  assert.ok(collections.length >= 70);
  const hubs = collections.filter((collection) => collection.isHub).map((collection) => collection.slug).sort();
  assert.deepEqual(hubs, ["morphosource", "nih-3d", "rcsb-pdb", "sketchfab"]);
  for (const collection of collections) {
    assert.ok(collection.website.startsWith("http"), collection.slug);
    assert.ok(collection.summary.length > 40, collection.slug);
  }
  const scales = new Set(collections.map((collection) => collection.scale));
  assert.ok(scales.has("Molecules"));
  assert.ok(scales.has("Cells"));
  const atlas = await readFile(new URL("../lib/structures-atlas.ts", import.meta.url), "utf8");
  assert.match(atlas, /BIOLOGICAL_SCALES/);
  assert.match(atlas, /STRUCTURE_JOURNEYS/);
  assert.match(atlas, /relatedModels: STRUCTURE_MODELS/);
  assert.match(atlas, /id: "Organisms"/);
  assert.match(atlas, /label: "Whole organism"/);
  assert.match(atlas, /STRUCTURE_SPECIES/);
});

test("includes the scraped bio.rodeo foundation-model catalogue", async () => {
  const [modelsJson, providersJson, catalogue] = await Promise.all([
    readFile(new URL("../data/foundation models/models.json", import.meta.url), "utf8"),
    readFile(new URL("../data/foundation models/providers.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/biorodeo-catalogue.ts", import.meta.url), "utf8"),
  ]);
  const models = JSON.parse(modelsJson);
  const providers = JSON.parse(providersJson);
  assert.ok(models.length > 2500);
  assert.equal(providers.length, 7);
  assert.match(catalogue, /foundation models/);
  assert.match(catalogue, /\/providers\/nvidia\.svg/);
  assert.match(catalogue, /\/providers\/huggingface\.svg/);
  const nvidia = await readFile(new URL("../public/providers/nvidia.svg", import.meta.url), "utf8");
  const aws = await readFile(new URL("../public/providers/aws.svg", import.meta.url), "utf8");
  const benchling = await readFile(new URL("../public/providers/benchling.svg", import.meta.url), "utf8");
  assert.match(nvidia, /NVIDIA/);
  assert.match(aws, /#FF9900/);
  assert.match(benchling, /#000650/);
});

test("serves packaged catalogues on Vercel without Postgres", async () => {
  const [atlasRoute, videosRoute, eventsRoute, graphRoute, queries, packaged] = await Promise.all([
    readFile(new URL("../app/api/atlas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/videos/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/graph/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/queries.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/packaged-atlas.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(atlasRoute, /databaseUnavailable/);
  assert.doesNotMatch(videosRoute, /databaseUnavailable/);
  assert.doesNotMatch(eventsRoute, /databaseUnavailable/);
  assert.doesNotMatch(graphRoute, /databaseUnavailable/);
  assert.match(queries, /getPackagedAtlas/);
  assert.match(queries, /getPackagedVideos/);
  assert.match(packaged, /parseWindowAssign/);
  assert.match(packaged, /resolvePublicData\("data.js"\)/);
  assert.match(packaged, /resolvePublicData\("videos.js"\)/);
  const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(nextConfig, /outputFileTracingIncludes/);
  assert.match(nextConfig, /public\/data/);

  const dataJs = await readFile(new URL("../public/data/data.js", import.meta.url), "utf8");
  const start = dataJs.indexOf("window.DATA =");
  assert.ok(start >= 0);
  let json = dataJs.slice(start + "window.DATA =".length).trim();
  if (json.endsWith(";")) json = json.slice(0, -1);
  const data = JSON.parse(json);
  assert.ok(data.glossary.length > 300);
  assert.ok(data.methodologies.length > 50);
  assert.ok(data.learningPath.length >= 8);
});
