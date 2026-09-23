(function () {
  "use strict";

  function getApp() {
    return document.getElementById("app");
  }

  function getTabs() {
    return document.querySelectorAll("#tabs a");
  }

  function getThemeToggle() {
    return document.getElementById("theme-toggle");
  }

  let DATA = { glossary: [], methodologies: [], learningPath: [], sources: [], recentEvents: [], meta: { glossaryCount: 0, methodologyCount: 0, stageCount: 0, modelCount: 0, collectionCount: 0, eventCount: 0 } };
  let glossary = [];
  let methodologies = [];
  let allEntries = [];
  let videos = {};

  function readSavedTheme() {
    try {
      return window.localStorage.getItem("ovaity-theme");
    } catch (error) {
      console.warn("BioAtlas could not read the saved theme.", error);
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem("ovaity-theme", theme);
    } catch (error) {
      console.warn("BioAtlas could not save the selected theme.", error);
    }
  }

  function bindThemeToggle() {
    const themeToggle = getThemeToggle();
    if (!themeToggle || themeToggle.dataset.bound === "1") return;
    themeToggle.dataset.bound = "1";
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      saveTheme(next);
      themeToggle.setAttribute("aria-label", `Switch to ${current} theme`);
    });
  }

  const savedTheme = readSavedTheme();
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }
  bindThemeToggle();

  function showLoadError(message) {
    const app = getApp();
    if (!app) return;
    app.innerHTML = `
      <div class="no-results load-error" role="alert">
        <strong>BioAtlas could not load this view.</strong>
        <span>${escapeHtml(message)}</span>
        <button type="button" id="reload-bioatlas">Reload BioAtlas</button>
      </div>`;
    document.getElementById("reload-bioatlas")?.addEventListener("click", () => location.reload());
  }

  async function boot() {
    bindThemeToggle();
    const app = getApp();
    if (!app) return;
    app.innerHTML = `<div class="view"><div class="no-results">Loading BioAtlas&hellip;</div></div>`;
    try {
      const [atlasRes, videosRes] = await Promise.all([
        fetch("/api/atlas"),
        fetch("/api/videos"),
      ]);
      if (window.__bioatlasBootToken !== bootToken) return;
      if (!atlasRes.ok) {
        throw new Error("The knowledge graph API is unavailable. Start Postgres and import the workbook.");
      }
      DATA = await atlasRes.json();
      if (window.__bioatlasBootToken !== bootToken) return;
      videos = videosRes.ok ? await videosRes.json() : {};
      glossary = DATA.glossary.map((g) => ({ ...g, kind: "term" }));
      methodologies = DATA.methodologies.map((m) => ({ ...m, kind: "method" }));
      allEntries = [...glossary, ...methodologies];
      document.getElementById("foot-terms").textContent = DATA.meta.glossaryCount;
      document.getElementById("foot-methods").textContent = DATA.meta.methodologyCount;
      bindHashRouter();
      await render();
    } catch (error) {
      if (window.__bioatlasBootToken !== bootToken) return;
      console.error("BioAtlas could not load atlas data.", error);
      showLoadError(error instanceof Error ? error.message : "Please reload the page.");
    }
  }

  function splitList(s) {
    if (!s) return [];
    return String(s).split(/,|;/).map((p) => p.trim()).filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return "";
    const text = String(value);
    if (/[A-Za-z]/.test(text)) return text;
    return text.slice(0, 10);
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function searchIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  }

  // Minimal line illustrations, matching the OVAITY icon style. Shared across
  // stage badges, glossary domains and methodology categories so every card
  // gets a thematically relevant illustration.
  const ICONS = {
    dna: '<path d="M7 3c0 4 10 4 10 8s-10 4-10 8"/><path d="M17 3c0 4-10 4-10 8s10 4 10 8"/><path d="M8 6h8M7.3 12h9.4M8 18h8"/>',
    flask: '<path d="M10 3h4M10.5 3v5.5L6 17a2 2 0 0 0 1.8 3h8.4A2 2 0 0 0 18 17l-4.5-8.5V3"/><path d="M8 15h8"/>',
    sequence: '<path d="M4 8v8M8 5v14M12 9v6M16 4v16M20 8v8"/>',
    pipeline: '<circle cx="5" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="19" cy="7" r="2"/><path d="M6.7 8.3 10.5 15M17.3 8.3 13.5 15"/>',
    layers: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    molecule: '<circle cx="6" cy="7" r="2.2"/><circle cx="17" cy="6" r="2.2"/><circle cx="8" cy="17" r="2.2"/><circle cx="17.5" cy="15" r="2.2"/><path d="M7.7 8.2 15.3 6.7M7.4 9 8 15M9.9 17.3 15.4 15.6"/>',
    shield: '<path d="M12 3.5 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="m8.7 12 2.3 2.3 4.3-4.3"/>',
    network: '<circle cx="12" cy="12" r="2.3"/><circle cx="12" cy="4" r="1.6"/><circle cx="19.5" cy="16" r="1.6"/><circle cx="4.5" cy="16" r="1.6"/><path d="M12 6.3v3.4M13.9 13.3l4 1.9M10.1 13.3l-4 1.9"/>',
    cell: '<circle cx="12" cy="12" r="8"/><path d="M9.3 12a2.7 2.7 0 1 0 5.4 0 2.7 2.7 0 0 0-5.4 0Z"/>',
    cellOrganelles: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1.6"/><ellipse cx="14.5" cy="14" rx="1.8" ry="1.2" transform="rotate(30 14.5 14)"/>',
    geneTag: '<path d="M7 3c0 4 10 4 10 8s-10 4-10 8"/><path d="M17 3c0 4-10 4-10 8s10 4 10 8"/><rect x="14.5" y="2.5" width="4.5" height="4.5" rx="1"/>',
    ribbon: '<path d="M4 17c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/><path d="M4 9c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
    folder: '<path d="M4 7.2A2.2 2.2 0 0 1 6.2 5h3.4l1.8 2H18a2.2 2.2 0 0 1 2.2 2.2v7.6A2.2 2.2 0 0 1 18 19H6.2A2.2 2.2 0 0 1 4 16.8Z"/>',
  };

  const STAGE_ICON_KEYS = ["dna", "flask", "sequence", "pipeline", "layers", "molecule", "shield", "network"];

  function iconSvg(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[key] || ICONS.flask}</svg>`;
  }

  function stageIcon(stageNum) {
    return iconSvg(STAGE_ICON_KEYS[(stageNum - 1) % STAGE_ICON_KEYS.length]);
  }

  function stageAccent(stageNum) {
    return stageNum % 2 === 0 ? "accent-violet" : "accent-teal";
  }

  const DOMAIN_ICON_KEYS = {
    "Biology Foundations": "cell",
    "Cell & Molecular Biology": "cellOrganelles",
    "Genetics & Genomics": "dna",
    "Gene Regulation & Epigenetics": "geneTag",
    "Proteins & Proteomics": "ribbon",
    "Omics": "layers",
    "Laboratory & Experimental Design": "flask",
    "Bioinformatics & Data Science": "pipeline",
    "Drug Discovery & Development": "molecule",
    "Clinical Research": "shield",
    "Data, Knowledge & Governance": "folder",
    "AI & Computational Research": "network",
  };

  const METHOD_ICON_RULES = [
    [/genom|sequenc|variant|pcr|panel/i, "dna"],
    [/epigenom|chip-?seq|atac|methylation|crispri|crispra/i, "geneTag"],
    [/rna|transcript/i, "sequence"],
    [/protein|proteom|antibody|elisa|western|mass spec|lc-ms|nmr|spr|itc|cryo-em|structural|co-ip/i, "ribbon"],
    [/cell|facs|flow cytometry|microscop|imaging|pathology|sorting/i, "cellOrganelles"],
    [/bioinformatic|pipeline|gsea|align|enrichment/i, "pipeline"],
    [/ai |nlp|rag|knowledge|ontology|llm/i, "network"],
    [/clinical|trial|gcp|pharmacovigilance|regulator/i, "shield"],
    [/crispr|rnai|knockout|genome engineering|screen/i, "molecule"],
    [/omics|multi-omics|spatial/i, "layers"],
  ];

  function domainIcon(domain) {
    return iconSvg(DOMAIN_ICON_KEYS[domain] || "cell");
  }

  function methodIcon(entry) {
    const haystack = `${entry.Category || ""} ${entry.Methodology || ""}`.toLowerCase();
    for (const [re, key] of METHOD_ICON_RULES) {
      if (re.test(haystack)) return iconSvg(key);
    }
    return iconSvg("flask");
  }

  function conceptIcon(entry) {
    return entry.kind === "term" ? domainIcon(entry.Domain) : methodIcon(entry);
  }

  const STAT_ICONS = {
    terms: '<path d="M6 4h11a2 2 0 0 1 2 2v13.5a1 1 0 0 1-1.5.87L14 18l-3.5 2.37a1 1 0 0 1-1 0L6 18l-2.5 2.37A1 1 0 0 1 2 19.5V7a3 3 0 0 1 3-3Z"/><path d="M7 8h7M7 11.5h7"/>',
    methods: '<path d="M10 3h4M10.5 3v5.5L6 17a2 2 0 0 0 1.8 3h8.4A2 2 0 0 0 18 17l-4.5-8.5V3"/><path d="M8 15h8"/>',
    stages: '<path d="M4 20V14M4 14V9l6-3M10 6v6l6 3M16 9v6l4 2"/>',
    essential: '<path d="M12 3.5 14 9l5.8.5-4.4 3.8L16.8 19 12 15.8 7.2 19l1.4-5.7-4.4-3.8L9.8 9Z"/>',
    models: '<circle cx="12" cy="12" r="2.3"/><circle cx="12" cy="4" r="1.6"/><circle cx="19.5" cy="16" r="1.6"/><circle cx="4.5" cy="16" r="1.6"/><path d="M12 6.3v3.4M13.9 13.3l4 1.9M10.1 13.3l-4 1.9"/>',
    resources: '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/><path d="M12 12 20 7.5M12 12v9M12 12 4 7.5"/>',
  };

  function statIcon(key) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${STAT_ICONS[key]}</svg>`;
  }

  function playIcon() {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
  }

  function videoResourceBlock(e) {
    const name = e.kind === "term" ? e.Term : e.Methodology;
    const v = videos[idFor(e)];
    if (v) {
      return `
        <div class="detail-block">
          <div class="detail-label">Learn more</div>
          <a class="resource-card" href="${escapeHtml(v.videoUrl)}" target="_blank" rel="noopener">
            <span class="resource-play">${playIcon()}</span>
            <span class="resource-text">
              <span class="resource-title">${escapeHtml(v.videoTitle)}</span>
              <span class="resource-channel">${escapeHtml(v.channel)} &middot; YouTube</span>
            </span>
          </a>
        </div>`;
    }
    const query = encodeURIComponent(`${name} explained`);
    return `
      <div class="detail-block">
        <div class="detail-label">Learn more</div>
        <a class="resource-card muted" href="https://www.youtube.com/results?search_query=${query}" target="_blank" rel="noopener">
          <span class="resource-play">${searchIcon()}</span>
          <span class="resource-text">
            <span class="resource-title">Search YouTube for &ldquo;${escapeHtml(name)}&rdquo;</span>
            <span class="resource-channel">Find a video lesson</span>
          </span>
        </a>
      </div>`;
  }

  function kindIcon(kind) {
    const d = kind === "term"
      ? '<path d="M6 4h11a2 2 0 0 1 2 2v13.5a1 1 0 0 1-1.5.87L14 18l-3.5 2.37a1 1 0 0 1-1 0L6 18l-2.5 2.37A1 1 0 0 1 2 19.5V7a3 3 0 0 1 3-3Z"/>'
      : '<path d="M10 3h4M10.5 3v5.5L6 17a2 2 0 0 0 1.8 3h8.4A2 2 0 0 0 18 17l-4.5-8.5V3"/>';
    return `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }

  function idFor(entry) {
    return `${entry.kind}-${entry.ID}`;
  }

  function findEntryById(id) {
    return allEntries.find((e) => idFor(e) === id);
  }

  // ---------------- Router ----------------

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const qIndex = raw.indexOf("?");
    const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/\/$/, "");
    const search = qIndex >= 0 ? raw.slice(qIndex + 1) : "";
    const [route, ...rest] = path.split("/").filter(Boolean);
    const query = {};
    new URLSearchParams(search).forEach((value, key) => {
      query[key] = value;
    });
    return { route: route || "overview", param: rest.join("/"), query };
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function replaceHash(hash) {
    const next = hash.startsWith("#") ? hash : `#${hash.startsWith("/") ? hash : `/${hash}`}`;
    if (location.hash === next) return;
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }

  function bindHashRouter() {
    if (typeof window.__bioatlasOnHashChange === "function") {
      window.removeEventListener("hashchange", window.__bioatlasOnHashChange);
    }
    window.__bioatlasOnHashChange = () => {
      void render();
    };
    window.addEventListener("hashchange", window.__bioatlasOnHashChange);
    getTabs().forEach((a) => {
      if (a.dataset.navBound === "1") return;
      a.dataset.navBound = "1";
      a.addEventListener("click", () => {
        const route = a.dataset.route || "overview";
        const current = parseHash().route;
        if (current === route) queueMicrotask(() => { void render(); });
      });
    });
  }

  // Always keep a single live renderer. Hot reloads of app.js used to stack
  // hashchange listeners, so Structures could mark the tab active while an
  // older listener painted Overview into the main pane.
  const bootToken = Symbol("bioatlas-boot");
  window.__bioatlasBootToken = bootToken;
  window.__bioatlasRender = () => render();

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  async function render() {
    try {
      bindThemeToggle();
      const app = getApp();
      if (!app) return;
      const { route, param, query } = parseHash();
      getTabs().forEach((a) => a.classList.toggle("active", a.dataset.route === route));
      closeModal();

      if (route === "learn") {
        renderLearningHub();
      } else if (route === "sessions") {
        renderSessions(param);
      } else if (route === "glossary") {
        renderGlossary(param);
      } else if (route === "models") {
        app.innerHTML = `<div class="view"><div class="no-results">Loading models&hellip;</div></div>`;
        await renderModels(param);
      } else if (route === "structures") {
        app.innerHTML = `<div class="view"><div class="no-results">Loading structures&hellip;</div></div>`;
        await renderStructures(param, query);
      } else if (route === "intelligence") {
        app.innerHTML = `<div class="view"><div class="no-results">Loading intelligence&hellip;</div></div>`;
        await renderIntelligence(param);
      } else {
        renderOverview();
      }

      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      console.error("BioAtlas could not render this view.", error);
      const app = getApp();
      if (!app) return;
      app.innerHTML = `
        <div class="no-results load-error" role="alert">
          <strong>BioAtlas could not load this view.</strong>
          <span>Please reload the page. If the problem continues, try clearing this site&rsquo;s cached data.</span>
          <button type="button" id="reload-bioatlas">Reload BioAtlas</button>
        </div>`;
      document.getElementById("reload-bioatlas")?.addEventListener("click", () => location.reload());
    }
  }

  // ---------------- Overview ----------------

  function formatCount(value) {
    return Number(value || 0).toLocaleString();
  }

  function bindStageChips(root) {
    root.querySelectorAll(".stage-chip").forEach((el) => {
      el.addEventListener("click", () => navigate(`/sessions/${el.dataset.stage}`));
    });
  }

  function renderOverview() {
    const app = getApp();
    if (!app) return;
    const stages = DATA.learningPath;
    const preview = stages.slice(0, 3);
    const recent = Array.isArray(DATA.recentEvents) ? DATA.recentEvents.slice(0, 3) : [];
    const meta = DATA.meta || {};
    const glance = [
      { key: "terms", accent: "accent-teal", num: meta.glossaryCount, label: "Life-science concepts" },
      { key: "methods", accent: "accent-violet", num: meta.methodologyCount, label: "Methodologies" },
      { key: "models", accent: "", num: meta.modelCount, label: "AI models" },
      { key: "resources", accent: "", num: meta.collectionCount, label: "Scientific resources" },
      { key: "stages", accent: "", num: meta.stageCount, label: "Learning stages" },
      { key: "essential", accent: "", num: glossary.filter((g) => g.Priority === "Essential").length, label: "Essential terms" },
    ].filter((item) => Number(item.num) > 0);

    app.innerHTML = `
      <div class="view home-view">
        <section class="home-hero">
          <svg class="hero-nodes" width="220" height="200" viewBox="0 0 220 200" fill="none" aria-hidden="true">
            <circle cx="170" cy="40" r="3" fill="#4EB1C2"/>
            <circle cx="140" cy="90" r="2.5" fill="#725AFF"/>
            <circle cx="195" cy="110" r="2" fill="#4EB1C2"/>
            <circle cx="155" cy="150" r="3" fill="#4EB1C2"/>
            <circle cx="200" cy="170" r="2" fill="#725AFF"/>
            <path d="M170 40 L140 90 M140 90 L195 110 M140 90 L155 150 M155 150 L200 170" stroke="#4EB1C2" stroke-width="0.75" opacity="0.6"/>
          </svg>
          <div class="eyebrow">The OVAITY BioAtlas</div>
          <h1 class="hero-title">Explore the language and landscape of life science.</h1>
          <p class="hero-lede">BioAtlas is OVAITY&rsquo;s open knowledge environment for life science &mdash; built to help anyone understand the science, explore the tools and resources shaping modern research, and stay current with a rapidly evolving field.</p>
          <div class="home-hero-actions">
            <a href="#/glossary" class="hero-cta">Explore BioAtlas &rarr;</a>
            <a href="#/learn" class="hero-cta-secondary">Start learning &rarr;</a>
          </div>
        </section>

        <section class="home-section">
          <div class="section-head">
            <h2>One BioAtlas. Three ways to explore life science.</h2>
          </div>
          <div class="home-modes">
            <article class="home-mode home-mode-learn">
              <div class="home-mode-kicker">Learn</div>
              <h3>Understand life science.</h3>
              <p>Build your knowledge from biological foundations to modern computational research and scientific AI.</p>
              <div class="home-mode-links">
                <a href="#/learn">Learning Hub</a>
                <a href="#/sessions">Sessions</a>
              </div>
              <a class="home-mode-cta" href="#/learn">Start learning &rarr;</a>
            </article>
            <article class="home-mode home-mode-explore">
              <div class="home-mode-kicker">Explore</div>
              <h3>Navigate the life-science landscape.</h3>
              <p>Explore biological concepts, AI models, structures, databases and scientific resources &mdash; and understand how they connect.</p>
              <div class="home-mode-links">
                <a href="#/glossary">Atlas</a>
                <a href="#/models">Models</a>
                <a href="#/structures">Structures</a>
              </div>
              <a class="home-mode-cta" href="#/glossary">Explore the Atlas &rarr;</a>
            </article>
            <article class="home-mode home-mode-discover">
              <div class="home-mode-kicker">Discover</div>
              <h3>Stay current.</h3>
              <p>Follow important developments across life science, biotechnology, scientific AI and the tools shaping modern research.</p>
              <div class="home-mode-links">
                <a href="#/intelligence">Intelligence</a>
              </div>
              <a class="home-mode-cta" href="#/intelligence">Discover what&rsquo;s new &rarr;</a>
            </article>
          </div>
        </section>

        <section class="home-section home-mission">
          <div class="eyebrow">Why we built BioAtlas</div>
          <h2>Making life science easier to understand, navigate and build upon.</h2>
          <p>Life science is becoming increasingly interdisciplinary. Biology, computation, data and AI are converging, while the knowledge required to understand modern research is scattered across papers, databases, platforms and institutions.</p>
          <p>OVAITY created BioAtlas to make this landscape easier to navigate. The goal is an open, continuously evolving map of modern life science &mdash; connecting concepts, methods, scientific resources and AI so that knowledge becomes easier to understand and use.</p>
          <a class="home-text-link" href="https://www.ovaity.com" target="_blank" rel="noopener noreferrer">About OVAITY &rarr;</a>
        </section>

        <section class="home-section">
          <div class="section-head">
            <h2>From biological concepts to the tools shaping research.</h2>
          </div>
          <p class="home-section-lede">BioAtlas is one connected environment. Learn a concept, open the method, find the resource, and see the models and developments around it.</p>
          <ol class="home-spine">
            <li>Biology</li>
            <li>Concepts</li>
            <li>Methods</li>
            <li>Data &amp; structures</li>
            <li>AI models</li>
            <li>Research &amp; industry</li>
          </ol>
          <div class="home-threads">
            <div class="home-thread">
              <a href="#/glossary/protein%20folding">Protein folding</a>
              <a href="#/structures">Structures</a>
              <a href="#/structures/rcsb-pdb">RCSB PDB</a>
              <a href="#/models">AlphaFold</a>
              <a href="#/intelligence">Research</a>
            </div>
            <div class="home-thread">
              <a href="#/glossary/single-cell">Single-cell biology</a>
              <a href="#/glossary/scRNA-seq">scRNA-seq</a>
              <a href="#/structures">Human Cell Atlas</a>
              <a href="#/models">Foundation models</a>
              <a href="#/intelligence">Recent developments</a>
            </div>
          </div>
        </section>

        <section class="home-section">
          <div class="section-head">
            <h2>BioAtlas at a glance</h2>
          </div>
          <div class="home-glance">
            ${glance.map((item) => `
              <div class="stat-tile ${item.accent}">
                <span class="stat-icon">${statIcon(item.key)}</span>
                <div>
                  <div class="stat-num">${formatCount(item.num)}</div>
                  <div class="stat-label">${escapeHtml(item.label)}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="home-section">
          <div class="section-head">
            <h2>Continue learning</h2>
            <a class="home-text-link" href="#/learn">View the Learning Hub &rarr;</a>
          </div>
          <p class="home-section-lede">A structured path through modern life science. The full curriculum lives in the Learning Hub.</p>
          <div class="home-path">
            ${preview.map((s) => `
              <button type="button" class="home-path-item" data-stage="${s.Stage}">
                <span class="home-path-index">Stage ${s.Stage}</span>
                <span class="home-path-theme">${escapeHtml(s.Theme)}</span>
                <span class="home-path-meta">~${escapeHtml(s["Suggested hours"])}h</span>
              </button>
            `).join("")}
          </div>
        </section>

        ${recent.length ? `
        <section class="home-section">
          <div class="section-head">
            <h2>What&rsquo;s new in life science</h2>
            <a class="home-text-link" href="#/intelligence">Explore Intelligence &rarr;</a>
          </div>
          <div class="home-news">
            ${recent.map((event) => `
              <article class="home-news-item" data-slug="${escapeHtml(event.slug)}">
                <div class="timeline-date">${escapeHtml(formatDate(event.occurred_on))}</div>
                <div class="atlas-kicker">${escapeHtml((event.event_type || "event").replace(/_/g, " "))}</div>
                <h3>${escapeHtml(event.name)}</h3>
                <p>${escapeHtml(event.summary || "")}</p>
              </article>
            `).join("")}
          </div>
        </section>` : ""}
      </div>
    `;

    app.querySelectorAll(".home-path-item").forEach((el) => {
      el.addEventListener("click", () => navigate(`/sessions/${el.dataset.stage}`));
    });
    app.querySelectorAll(".home-news-item").forEach((el) => {
      el.addEventListener("click", () => navigate(`/intelligence/${el.dataset.slug}`));
    });
  }

  // ---------------- Learning Hub ----------------

  function renderLearningHub() {
    const app = getApp();
    if (!app) return;
    const stages = DATA.learningPath;
    const topics = [
      "What is a foundation model?",
      "What is single-cell sequencing?",
      "How does AlphaFold work?",
      "What is spatial transcriptomics?",
      "Introduction to proteins",
      "Understanding CRISPR",
    ];
    app.innerHTML = `
      <div class="view">
        <div class="eyebrow">Learning Hub</div>
        <h2 class="page-title">Understand the language of life science</h2>
        <p class="page-lede">Structured introductions to the concepts, methods and models behind modern biology. This hub is the place to start when you want to learn a topic, not just look it up.</p>

        <div class="section-head"><h2>Eight stages, start to finish</h2></div>
        <div class="stage-strip">
          ${stages
            .map(
              (s) => `
            <div class="stage-chip" data-stage="${s.Stage}">
              <span class="stage-badge ${stageAccent(s.Stage)}">${stageIcon(s.Stage)}</span>
              <div class="stage-theme">${escapeHtml(s.Theme)}</div>
              <div class="stage-hours">Stage ${s.Stage} &middot; ~${s["Suggested hours"]}h</div>
            </div>`
            )
            .join("")}
        </div>

        <div class="learn-doors" style="margin-top:36px;">
          <a class="learn-door" href="#/sessions">
            <div class="learn-door-kicker">Interactive learning</div>
            <h3>Sessions</h3>
            <p>Work the staged path from basic biology to AI-assisted research.</p>
          </a>
          <a class="learn-door" href="#/glossary">
            <div class="learn-door-kicker">Look it up</div>
            <h3>Atlas</h3>
            <p>Search concepts, methods and definitions across the life-science field.</p>
          </a>
          <a class="learn-door" href="#/models">
            <div class="learn-door-kicker">See them in practice</div>
            <h3>Models</h3>
            <p>Open the foundation models that sit behind topics such as protein structure.</p>
          </a>
        </div>

        <div class="section-head"><h2>Topics this hub will cover</h2></div>
        <div class="learn-topics">
          ${topics.map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join("")}
        </div>

        <div class="section-head" style="margin-top:44px;"><h2>How to use this guide</h2></div>
        <div class="howto">
          <div class="howto-item"><span class="howto-num">01</span><p>Begin with Essential + Foundation concepts in the Atlas.</p></div>
          <div class="howto-item"><span class="howto-num">02</span><p>Filter by domain, priority or level as you go.</p></div>
          <div class="howto-item"><span class="howto-num">03</span><p>Work through each Session to see terms in their methodological context.</p></div>
          <div class="howto-item"><span class="howto-num">04</span><p>Use Methodologies entries to understand how evidence is actually produced.</p></div>
        </div>

        <div class="rule-of-thumb">
          &ldquo;Always ask: what was measured? In which biological system? With which controls? Using which method? Compared with what? Under which assumptions?&rdquo;
        </div>
      </div>
    `;
    bindStageChips(app);
  }

  // ---------------- Sessions ----------------

  function renderSessions(param) {
    const app = getApp();
    if (!app) return;
    const openStage = param ? Number(param) : null;
    const stages = DATA.learningPath;

    app.innerHTML = `
      <div class="view">
        <div class="eyebrow">In-Depth Sessions</div>
        <h2 class="page-title">Work the path stage by stage</h2>
        <div class="stage-list">
          ${stages.map((s) => renderStageCard(s, s.Stage === openStage)).join("")}
        </div>
      </div>
    `;

    app.querySelectorAll(".stage-card-head").forEach((head) => {
      const toggleStage = () => {
        const card = head.closest(".stage-card");
        const isOpen = card.classList.contains("open");
        app.querySelectorAll(".stage-card").forEach((c) => {
          c.classList.remove("open");
          c.querySelector(".stage-card-head").setAttribute("aria-expanded", "false");
          c.querySelector(".stage-card-body").style.maxHeight = null;
        });
        if (!isOpen) {
          card.classList.add("open");
          head.setAttribute("aria-expanded", "true");
          const body = card.querySelector(".stage-card-body");
          body.style.maxHeight = body.scrollHeight + "px";
        }
      };
      head.addEventListener("click", toggleStage);
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleStage();
        }
      });
    });

    app.querySelectorAll(".chip.link").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        openModal(chip.dataset.id);
      });
    });

    if (openStage) {
      const card = app.querySelector(`.stage-card[data-stage="${openStage}"]`);
      if (card) {
        card.classList.add("open");
        const body = card.querySelector(".stage-card-body");
        body.style.maxHeight = body.scrollHeight + "px";
        setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    }
  }

  function renderStageCard(s, open) {
    const concepts = splitList(s["Core concepts to master"]);
    const methods = splitList(s["Methods to recognize"]);
    const matchedTerms = s.matched_terms || [];
    const matchedMethods = s.matched_methodologies || [];

    return `
      <div class="stage-card${open ? " open" : ""}" data-stage="${s.Stage}">
        <div class="stage-card-head" role="button" tabindex="0" aria-expanded="${open ? "true" : "false"}">
          <div class="stage-no ${stageAccent(s.Stage)}">${stageIcon(s.Stage)}</div>
          <div class="stage-info">
            <div class="stage-theme">${escapeHtml(s.Theme)}</div>
            <div class="stage-goal">${escapeHtml(s.Goal)}</div>
          </div>
          <div class="stage-meta">~${s["Suggested hours"]}h &middot; ${escapeHtml(s.Status || "Not started")}</div>
          <div class="chevron">&rsaquo;</div>
        </div>
        <div class="stage-card-body">
          <div class="stage-card-body-inner">
            <div class="detail-block">
              <div class="detail-label">Core concepts to master</div>
              <div class="chip-row">
                ${concepts.map((c) => conceptChip(c, matchedTerms)).join("")}
              </div>
            </div>
            <div class="detail-block">
              <div class="detail-label">Methods to recognize</div>
              <div class="chip-row">
                ${methods.map((m) => methodChip(m, matchedMethods)).join("")}
              </div>
            </div>
            ${
              matchedMethods.length
                ? `<div class="detail-block">
                     <div class="detail-label">Related methodology entries</div>
                     <div class="chip-row">
                       ${matchedMethods
                         .map((name) => {
                           const entry = methodologies.find((m) => m.Methodology === name);
                           return entry ? `<span class="chip link" data-id="${idFor(entry)}">${escapeHtml(name)}</span>` : "";
                         })
                         .join("")}
                     </div>
                   </div>`
                : ""
            }
            <div class="detail-block">
              <div class="detail-label">Practical exercise</div>
              <p class="exercise-box">${escapeHtml(s["Practical exercise"])}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function conceptChip(concept, matchedTerms) {
    const match = matchedTerms.find((t) => t.toLowerCase() === concept.toLowerCase());
    if (match) {
      const entry = glossary.find((g) => g.Term === match);
      if (entry) return `<span class="chip link" data-id="${idFor(entry)}">${escapeHtml(concept)}</span>`;
    }
    return `<span class="chip">${escapeHtml(concept)}</span>`;
  }

  function methodChip(name, matchedMethods) {
    const match = (matchedMethods || []).find((item) => item.toLowerCase() === name.toLowerCase()) || name;
    const entry = methodologies.find((m) => m.Methodology.toLowerCase() === String(match).toLowerCase());
    if (entry) return `<span class="chip link" data-id="${idFor(entry)}">${escapeHtml(name)}</span>`;
    return `<span class="chip">${escapeHtml(name)}</span>`;
  }

  function relatedChips(entry) {
    const links = entry.related || [];
    if (links.length) {
      return links.map((link) => {
        if (link.id) {
          return `<span class="chip link" data-id="${escapeHtml(link.id)}" data-type="${escapeHtml(link.entityType)}" data-slug="${escapeHtml(link.slug || "")}">${escapeHtml(link.name)}</span>`;
        }
        return `<span class="chip">${escapeHtml(link.name)}</span>`;
      }).join("");
    }
    return splitList(entry["Related concepts"]).map((name) => {
      const match = glossary.find((g) => g.Term.toLowerCase() === name.toLowerCase());
      return match
        ? `<span class="chip link" data-id="${idFor(match)}">${escapeHtml(name)}</span>`
        : `<span class="chip">${escapeHtml(name)}</span>`;
    }).join("");
  }

  // ---------------- Glossary ----------------

  let glossaryState = { q: "", domain: "", level: "", priority: "", type: "", video: "" };

  function domainsList() {
    const set = new Set();
    glossary.forEach((g) => g.Domain && set.add(g.Domain));
    methodologies.forEach((m) => m.Category && set.add(m.Category));
    return [...set].sort();
  }

  function renderGlossary(param) {
    const app = getApp();
    if (!app) return;
    if (param && !glossaryState.q) glossaryState.q = decodeURIComponent(param);

    app.innerHTML = `
      <div class="view">
        <header class="atlas-intro">
          <div class="atlas-kicker">The OVAITY BioAtlas</div>
          <h1 class="atlas-title">Explore the language of life science.</h1>
          <div class="atlas-stats" aria-label="BioAtlas statistics">
            <span><strong>${DATA.meta.glossaryCount + DATA.meta.methodologyCount}</strong> concepts</span>
            <span><strong>${DATA.meta.methodologyCount}</strong> laboratory methods</span>
            <span class="atlas-expanding">Continuously expanding</span>
          </div>
        </header>
        <div class="search-bar">
          <span class="search-glyph">${searchIcon()}</span>
          <input type="search" id="search-input" placeholder="Search BioAtlas concepts, methods, definitions&hellip;" value="${escapeHtml(glossaryState.q)}" autofocus />
          <span class="result-count" id="result-count"></span>
        </div>
        <div class="filter-bar">
          <select id="f-type">
            <option value="">All types</option>
            <option value="term">Life-science concepts</option>
            <option value="method">Methodologies</option>
          </select>
          <select id="f-level">
            <option value="">All levels</option>
            <option value="Foundation">Foundation</option>
            <option value="Core">Core</option>
            <option value="Advanced">Advanced</option>
          </select>
          <select id="f-priority">
            <option value="">All priorities</option>
            <option value="Essential">Essential</option>
            <option value="Core">Core</option>
            <option value="Optional">Optional</option>
          </select>
          <select id="f-domain">
            <option value="">All domains</option>
            ${domainsList().map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
          </select>
          <select id="f-video">
            <option value="">All video resources</option>
            <option value="curated">Curated video</option>
            <option value="search">Search fallback</option>
          </select>
          <button class="clear-btn" id="clear-filters">Clear filters</button>
        </div>
        <div id="grid-wrap"></div>
        <section class="platform-cta" aria-labelledby="platform-cta-title">
          <div class="platform-cta-copy">
            <div class="platform-cta-eyebrow">Ready to put your knowledge to work?</div>
            <h2 id="platform-cta-title">You&rsquo;ve learned the language. Now connect the science.</h2>
            <p>BioAtlas helps you understand life-science concepts and methods. OVAITY helps research teams turn that knowledge into connected projects, experiments, analyses and decisions.</p>
          </div>
          <div class="platform-cta-actions">
            <a
              class="platform-cta-primary"
              href="https://www.ovaity.com/#waitlist"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join the OVAITY waitlist (opens in a new tab)"
            >Join the OVAITY waitlist <span aria-hidden="true">&rarr;</span></a>
            <a
              class="platform-cta-secondary"
              href="https://www.ovaity.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discover OVAITY (opens in a new tab)"
            >Discover OVAITY</a>
          </div>
          <div class="platform-cta-signoff" aria-hidden="true">Learn with BioAtlas. Work with OVAITY.</div>
        </section>
      </div>
    `;

    const input = document.getElementById("search-input");
    const fType = document.getElementById("f-type");
    const fLevel = document.getElementById("f-level");
    const fPriority = document.getElementById("f-priority");
    const fDomain = document.getElementById("f-domain");
    const fVideo = document.getElementById("f-video");

    fType.value = glossaryState.type;
    fLevel.value = glossaryState.level;
    fPriority.value = glossaryState.priority;
    fDomain.value = glossaryState.domain;
    fVideo.value = glossaryState.video;

    input.addEventListener("input", () => {
      glossaryState.q = input.value;
      renderGrid();
    });
    fType.addEventListener("change", () => { glossaryState.type = fType.value; renderGrid(); });
    fLevel.addEventListener("change", () => { glossaryState.level = fLevel.value; renderGrid(); });
    fPriority.addEventListener("change", () => { glossaryState.priority = fPriority.value; renderGrid(); });
    fDomain.addEventListener("change", () => { glossaryState.domain = fDomain.value; renderGrid(); });
    fVideo.addEventListener("change", () => { glossaryState.video = fVideo.value; renderGrid(); });
    document.getElementById("clear-filters").addEventListener("click", () => {
      glossaryState = { q: "", domain: "", level: "", priority: "", type: "", video: "" };
      renderGlossary();
    });

    renderGrid();
  }

  function matchesQuery(entry, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    const haystack =
      entry.kind === "term"
        ? [entry.Term, entry.Acronym, entry.Definition, entry.Domain, entry["Related concepts"]]
        : [entry.Methodology, entry.Category, entry.Purpose, entry["Common tools / platforms"]];
    return haystack.some((v) => v && String(v).toLowerCase().includes(needle));
  }

  function filteredEntries() {
    return allEntries.filter((e) => {
      if (glossaryState.type && e.kind !== glossaryState.type) return false;
      if (glossaryState.level && e.Level !== glossaryState.level) return false;
      if (glossaryState.priority && e.Priority !== glossaryState.priority) return false;
      if (glossaryState.domain) {
        const d = e.kind === "term" ? e.Domain : e.Category;
        if (d !== glossaryState.domain) return false;
      }
      const hasVideo = Boolean(videos[idFor(e)]);
      if (glossaryState.video === "curated" && !hasVideo) return false;
      if (glossaryState.video === "search" && hasVideo) return false;
      if (!matchesQuery(e, glossaryState.q)) return false;
      return true;
    });
  }

  function renderGrid() {
    const results = filteredEntries();
    document.getElementById("result-count").textContent = `${results.length} found`;
    const wrap = document.getElementById("grid-wrap");

    if (!results.length) {
      wrap.innerHTML = `<div class="no-results">No entries match &mdash; try a different search or clear filters.</div>`;
      return;
    }

    wrap.innerHTML = `<div class="card-grid">${results.map(renderCard).join("")}</div>`;
    wrap.querySelectorAll(".entry-card").forEach((card) => {
      card.addEventListener("click", () => openModal(card.dataset.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal(card.dataset.id);
        }
      });
    });
  }

  function renderCard(e) {
    if (e.kind === "term") {
      return `
        <div class="entry-card" data-id="${idFor(e)}" role="button" tabindex="0">
          <div class="tag-row">
            <span class="entry-icon">${conceptIcon(e)}</span>
            <span class="entry-kind term">${kindIcon("term")} Term</span>
          </div>
          <div class="entry-term">${escapeHtml(e.Term)}${e.Acronym ? `<span class="entry-acronym">${escapeHtml(e.Acronym)}</span>` : ""}</div>
          <div class="entry-def">${escapeHtml(e.Definition)}</div>
          <div class="entry-foot">
            <span class="pill ${e.Priority === "Essential" ? "priority-essential" : ""}">${escapeHtml(e.Priority || "")}</span>
            <span class="pill">${escapeHtml(e.Level || "")}</span>
            ${videos[idFor(e)] ? `<span class="video-available">${playIcon()} Video</span>` : ""}
          </div>
        </div>`;
    }
    return `
      <div class="entry-card" data-id="${idFor(e)}" role="button" tabindex="0">
        <div class="tag-row">
          <span class="entry-icon accent-violet">${conceptIcon(e)}</span>
          <span class="entry-kind method">${kindIcon("method")} Method</span>
        </div>
        <div class="entry-term">${escapeHtml(e.Methodology)}</div>
        <div class="entry-def">${escapeHtml(e.Purpose)}</div>
        <div class="entry-foot">
          <span class="pill ${e.Priority === "Essential" ? "priority-essential" : ""}">${escapeHtml(e.Priority || "")}</span>
          <span class="pill">${escapeHtml(e.Category || "")}</span>
          ${videos[idFor(e)] ? `<span class="video-available">${playIcon()} Video</span>` : ""}
        </div>
      </div>`;
  }

  // ---------------- Modal ----------------

  function openModal(id) {
    const e = findEntryById(id);
    if (!e) return;
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${e.kind === "term" ? termModalBody(e) : methodModalBody(e)}</div>`;
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";

    const onKey = (ev) => {
      if (ev.key === "Escape") closeModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);

    backdrop.querySelector(".modal-close").addEventListener("click", closeModal);
    backdrop.querySelector(".modal-close").focus();
    bindGraphLinks(backdrop);
    fillGraphPanel(backdrop, id);
  }

  function closeModal() {
    const backdrop = document.getElementById("modal-backdrop");
    if (backdrop) {
      if (backdrop._onKey) window.removeEventListener("keydown", backdrop._onKey);
      backdrop.remove();
      document.body.style.overflow = "";
    }
  }

  function dismissModelModal() {
    closeModal();
    if (location.hash.startsWith("#/models/")) navigate("/models");
  }

  function termModalBody(e) {
    return `
      <button class="modal-close" aria-label="Close details">&times;</button>
      <span class="modal-icon">${conceptIcon(e)}</span>
      <div class="modal-kind">BioAtlas Concept &middot; #${e.ID}</div>
      <h3 class="modal-title" id="modal-title">${escapeHtml(e.Term)}${e.Acronym ? ` <span class="entry-acronym">${escapeHtml(e.Acronym)}</span>` : ""}</h3>
      <div class="modal-domain">${escapeHtml(e.Domain)} &middot; ${escapeHtml(e.Level)} &middot; ${escapeHtml(e.Priority)}</div>
      <div class="detail-block"><div class="detail-label">Definition</div><p>${escapeHtml(e.Definition)}</p></div>
      ${e["Why it matters"] ? `<div class="detail-block"><div class="detail-label">Why it matters</div><p>${escapeHtml(e["Why it matters"])}</p></div>` : ""}
      ${e.Example ? `<div class="detail-block"><div class="detail-label">Example</div><p>${escapeHtml(e.Example)}</p></div>` : ""}
      ${e["Related concepts"] || (e.related && e.related.length) ? `<div class="detail-block"><div class="detail-label">Related concepts</div><div class="chip-row">${relatedChips(e)}</div></div>` : ""}
      ${e["Common confusion"] ? `<div class="detail-block"><div class="detail-label">Common confusion</div><p>${escapeHtml(e["Common confusion"])}</p></div>` : ""}
      <div class="graph-panel" data-from="${idFor(e)}"><div class="graph-loading">Loading connections&hellip;</div></div>
      ${videoResourceBlock(e)}
      ${e["Source URL"] ? `<div class="modal-source">Source &middot; <a href="${escapeHtml(e["Source URL"])}" target="_blank" rel="noopener">${escapeHtml(e["Source URL"])}</a></div>` : ""}
    `;
  }

  function methodModalBody(e) {
    return `
      <button class="modal-close" aria-label="Close details">&times;</button>
      <span class="modal-icon accent-violet">${conceptIcon(e)}</span>
      <div class="modal-kind">Methodology &middot; #${e.ID}</div>
      <h3 class="modal-title" id="modal-title">${escapeHtml(e.Methodology)}${e.Acronym ? ` <span class="entry-acronym">${escapeHtml(e.Acronym)}</span>` : ""}</h3>
      <div class="modal-domain">${escapeHtml(e.Category)} &middot; ${escapeHtml(e.Level)} &middot; ${escapeHtml(e.Priority)}</div>
      <div class="detail-block"><div class="detail-label">Purpose</div><p>${escapeHtml(e.Purpose)}</p></div>
      ${e["Typical inputs"] ? `<div class="detail-block"><div class="detail-label">Typical inputs</div><p>${escapeHtml(e["Typical inputs"])}</p></div>` : ""}
      ${e["Simplified workflow"] ? `<div class="detail-block"><div class="detail-label">Simplified workflow</div><p>${escapeHtml(e["Simplified workflow"])}</p></div>` : ""}
      ${e["Typical outputs"] ? `<div class="detail-block"><div class="detail-label">Typical outputs</div><p>${escapeHtml(e["Typical outputs"])}</p></div>` : ""}
      ${e.Strengths ? `<div class="detail-block"><div class="detail-label">Strengths</div><p>${escapeHtml(e.Strengths)}</p></div>` : ""}
      ${e["Limitations / risks"] ? `<div class="detail-block"><div class="detail-label">Limitations / risks</div><p>${escapeHtml(e["Limitations / risks"])}</p></div>` : ""}
      ${e["Key QC checks"] ? `<div class="detail-block"><div class="detail-label">Key QC checks</div><p>${escapeHtml(e["Key QC checks"])}</p></div>` : ""}
      ${e["Common tools / platforms"] ? `<div class="detail-block"><div class="detail-label">Common tools / platforms</div><p>${escapeHtml(e["Common tools / platforms"])}</p></div>` : ""}
      <div class="graph-panel" data-from="${idFor(e)}"><div class="graph-loading">Loading connections&hellip;</div></div>
      ${videoResourceBlock(e)}
      ${e["Source URL"] ? `<div class="modal-source">Source &middot; <a href="${escapeHtml(e["Source URL"])}" target="_blank" rel="noopener">${escapeHtml(e["Source URL"])}</a></div>` : ""}
    `;
  }

  function relationLabel(type) {
    return String(type || "related_to").replace(/_/g, " ");
  }

  function neighborTarget(neighbor) {
    if (neighbor.entityType === "concept" || neighbor.entityType === "method") {
      return { kind: "modal", id: neighbor.legacyId || neighbor.id };
    }
    if (neighbor.entityType === "model") return { kind: "route", hash: `/models/${neighbor.slug}` };
    if (neighbor.entityType === "collection") return { kind: "route", hash: `/structures/${neighbor.slug}` };
    if (neighbor.entityType === "organization") return { kind: "entity" };
    if (neighbor.entityType === "event") return { kind: "route", hash: `/intelligence/${neighbor.slug}` };
    if (neighbor.entityType === "tool") {
      return { kind: "external", href: `https://bio.rodeo/providers/${neighbor.slug}` };
    }
    return { kind: "route", hash: `/models/${neighbor.slug}` };
  }

  function renderNeighborChips(neighbors) {
    if (!neighbors.length) return `<p class="graph-empty">No published connections yet.</p>`;
    return `<div class="chip-row">${neighbors.map((neighbor) => {
      const target = neighborTarget(neighbor);
      const attrs = target.kind === "modal"
        ? `data-id="${escapeHtml(target.id)}"`
        : target.kind === "external"
          ? `data-href="${escapeHtml(target.href)}"`
          : target.kind === "entity"
            ? `data-entity="${escapeHtml(neighbor.slug || "")}" data-entity-name="${escapeHtml(neighbor.name || "")}" data-entity-type="${escapeHtml(neighbor.entityType || "entity")}" data-entity-summary="${escapeHtml(neighbor.summary || "")}"`
            : `data-hash="${escapeHtml(target.hash)}"`;
      return `<span class="chip link" ${attrs}><span class="chip-rel">${escapeHtml(relationLabel(neighbor.relationType))}</span> ${escapeHtml(neighbor.name)}</span>`;
    }).join("")}</div>`;
  }

  let graphSeq = 0;
  const pendingGraphs = [];

  function graphNavFor(node) {
    if (node.legacyId || (node.id && String(node.id).match(/^(term|method)-/))) {
      return { kind: "modal", id: node.legacyId || node.id };
    }
    if (node.entityType === "tool" && node.slug) {
      return { kind: "external", href: `https://bio.rodeo/providers/${node.slug}` };
    }
    if (node.entityType === "event" && node.slug) return { kind: "route", hash: `/intelligence/${node.slug}` };
    if (node.entityType === "collection" && node.slug) return { kind: "route", hash: `/structures/${node.slug}` };
    if (node.entityType === "model" && node.slug) return { kind: "route", hash: `/models/${node.slug}` };
    if (node.entityType === "organization") return { kind: "entity" };
    if (node.slug) return { kind: "route", hash: `/models/${node.slug}` };
    return null;
  }

  function shortenLabel(name, max = 20) {
    const text = String(name || "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function uniqueTypes(nodes) {
    return [...new Set(nodes.map((node) => node.entityType || "entity"))].sort();
  }

  function graphWorldSize(count, viewW, viewH) {
    if (count <= 14) return { width: viewW, height: viewH };
    const minSep = 148;
    const area = count * minSep * minSep * 1.85;
    const aspect = viewW / Math.max(viewH, 1);
    const height = Math.max(viewH, Math.round(Math.sqrt(area / aspect)));
    const width = Math.max(viewW, Math.round(height * aspect));
    return { width: Math.min(width, 2600), height: Math.min(height, 1900) };
  }

  function layoutGraph(nodes, edges, width, height) {
    const count = nodes.length;
    const cx = width / 2;
    const cy = height / 2;
    const hasCenter = nodes.some((node) => node.center);
    const padX = 110;
    const padY = 72;
    const ring = Math.min(cx - padX, cy - padY);
    const layers = count > 30 ? 3 : count > 12 ? 2 : 1;
    const minSep = count > 36 ? 168 : count > 18 ? 142 : 104;
    const edgeRest = minSep * 1.65;
    const gravity = count > 20 ? 0.0018 : 0.007;
    const ticks = count > 24 ? 170 : 90;
    const placed = nodes.map((node) => {
      if (node.center) return { ...node, x: cx, y: cy, vx: 0, vy: 0 };
      const orbit = hasCenter ? nodes.filter((item) => !item.center) : nodes;
      const orbitIndex = Math.max(0, orbit.indexOf(node));
      const angle = (orbitIndex / Math.max(orbit.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const layer = layers === 1
        ? 0.84
        : 0.38 + ((orbitIndex % layers) / Math.max(layers - 1, 1)) * 0.54;
      return {
        ...node,
        x: cx + Math.cos(angle) * ring * layer,
        y: cy + Math.sin(angle) * ring * layer,
        vx: 0,
        vy: 0,
      };
    });
    const byKey = new Map(placed.map((node) => [node.key, node]));
    for (let tick = 0; tick < ticks; tick += 1) {
      for (let i = 0; i < placed.length; i += 1) {
        for (let j = i + 1; j < placed.length; j += 1) {
          const a = placed[i];
          const b = placed[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const min = a.center || b.center ? minSep + 36 : minSep;
          if (dist < min) {
            const force = (min - dist) / dist * 0.22;
            dx *= force;
            dy *= force;
            if (!a.center) { a.x += dx; a.y += dy; }
            if (!b.center) { b.x -= dx; b.y -= dy; }
          }
        }
      }
      edges.forEach((edge) => {
        const a = byKey.get(edge.from);
        const b = byKey.get(edge.to);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const pull = (dist - edgeRest) * 0.008;
        const ox = dx / dist * pull;
        const oy = dy / dist * pull;
        if (!a.center) { a.x += ox; a.y += oy; }
        if (!b.center) { b.x -= ox; b.y -= oy; }
      });
      placed.forEach((node) => {
        if (node.center) return;
        node.x += (cx - node.x) * gravity;
        node.y += (cy - node.y) * gravity;
        node.x = Math.max(padX, Math.min(width - padX, node.x));
        node.y = Math.max(padY, Math.min(height - padY, node.y));
      });
    }
    return placed;
  }

  function renderGraphHost(nodes, edges, options = {}) {
    if (!nodes.length) return `<p class="graph-empty">No published connections yet.</p>`;
    const id = `graph-${++graphSeq}`;
    pendingGraphs.push({ id, nodes, edges, options });
    return `<div class="graph-shell" id="${id}" role="img" aria-label="${escapeHtml(options.label || "BioAtlas knowledge graph")}"></div>`;
  }

  function mountInteractiveGraph(host, nodes, edges, options = {}) {
    const viewW = options.width || 760;
    const viewH = options.height || 380;
    const world = graphWorldSize(nodes.length, viewW, viewH);
    const width = world.width;
    const height = world.height;
    const placed = layoutGraph(nodes, edges, width, height);
    const types = uniqueTypes(placed);
    const MIN_SCALE = 0.7;
    const MAX_SCALE = 5.6;

    function fitViewBox() {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      placed.forEach((node) => {
        minX = Math.min(minX, node.x - 48);
        minY = Math.min(minY, node.y - 28);
        maxX = Math.max(maxX, node.x + 48);
        maxY = Math.max(maxY, node.y + 40);
      });
      const pad = nodes.length > 20 ? 70 : 56;
      minX -= pad;
      minY -= pad;
      maxX += pad;
      maxY += pad;
      let w = Math.max(220, maxX - minX);
      let h = Math.max(180, maxY - minY);
      const aspect = viewW / viewH;
      if (w / h > aspect) h = w / aspect;
      else w = h * aspect;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h, scale: 1 };
    }

    let typeFilter = "";
    let hoverKey = "";
    let drag = null;
    let pan = null;
    const fitted = fitViewBox();
    let view = { ...fitted };

    host.innerHTML = `
      <div class="graph-toolbar">
        <div class="graph-legend">
          ${types.map((type) => `<span class="graph-legend-item graph-node-${escapeHtml(type)}">${escapeHtml(type.replace(/_/g, " "))}</span>`).join("")}
        </div>
        <div class="graph-type-filters">
          <button type="button" class="graph-type-btn is-on" data-type="">All</button>
          ${types.map((type) => `<button type="button" class="graph-type-btn" data-type="${escapeHtml(type)}">${escapeHtml(type.replace(/_/g, " "))}</button>`).join("")}
        </div>
        <p class="graph-hint">Scroll to zoom in and read labels &middot; drag the canvas to pan &middot; drag a node to rearrange &middot; click to open</p>
      </div>
      <div class="graph-stage">
        <svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" width="100%" height="${viewH}" tabindex="0" role="application" aria-label="${escapeHtml(options.label || "Knowledge graph")}"></svg>
        <div class="graph-zoom" role="group" aria-label="Zoom the graph">
          <button type="button" class="graph-zoom-btn" data-zoom="out" aria-label="Zoom out">&minus;</button>
          <button type="button" class="graph-zoom-btn graph-zoom-level" data-zoom="reset" aria-label="Reset zoom">100%</button>
          <button type="button" class="graph-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>
        </div>
        <div class="graph-tooltip" hidden></div>
      </div>
    `;

    const svg = host.querySelector("svg");
    const tooltip = host.querySelector(".graph-tooltip");
    const zoomLevel = host.querySelector(".graph-zoom-level");
    const ns = "http://www.w3.org/2000/svg";

    function applyView() {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
      if (zoomLevel) zoomLevel.textContent = `${Math.round(view.scale * 100)}%`;
    }

    function clientToSvg(clientX, clientY) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: width / 2, y: height / 2 };
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      return point.matrixTransform(ctm.inverse());
    }

    function setScale(next, originX, originY) {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      const cx = originX ?? (view.x + view.w / 2);
      const cy = originY ?? (view.y + view.h / 2);
      const nextW = fitted.w / scale;
      const nextH = fitted.h / scale;
      const rx = view.w ? (cx - view.x) / view.w : 0.5;
      const ry = view.h ? (cy - view.y) / view.h : 0.5;
      view.scale = scale;
      view.w = nextW;
      view.h = nextH;
      view.x = cx - rx * nextW;
      view.y = cy - ry * nextH;
      applyView();
      draw();
    }

    function resetView() {
      view = { ...fitted };
      applyView();
      draw();
    }

    function connectedKeys(key) {
      const keys = new Set([key]);
      edges.forEach((edge) => {
        if (edge.from === key) keys.add(edge.to);
        if (edge.to === key) keys.add(edge.from);
      });
      return keys;
    }

    function edgeLit(edge) {
      if (!hoverKey) return false;
      return edge.from === hoverKey || edge.to === hoverKey;
    }

    function boxesOverlap(a, b, pad = 8) {
      return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
    }

    function typeSize() {
      const px = Math.max(svg.clientWidth, 1);
      const font = 13 * (view.w / px);
      return { font, charW: font * 0.56, lineH: font * 1.4 };
    }

    function labelBudget() {
      const screenPx = svg.clientWidth / Math.max(view.w, 1);
      return {
        screenPx,
        maxChars: screenPx >= 1.2 ? 30 : screenPx >= 0.85 ? 22 : 16,
      };
    }

    function visibleLabels(hot) {
      const budget = labelBudget();
      const size = typeSize();
      const hotSet = hot || new Set();
      const order = [...placed].sort((a, b) => {
        const score = (node) => (
          (node.key === hoverKey ? 8 : 0)
          + (hotSet.has(node.key) ? 4 : 0)
          + (node.center ? 3 : 0)
          + ({ event: 2, model: 2, collection: 2, concept: 1.5, method: 1, organization: 1 }[node.entityType] || 0)
        );
        return score(b) - score(a);
      });
      const taken = [];
      const shown = new Set();
      order.forEach((node) => {
        const text = shortenLabel(node.name, node.center || node.key === hoverKey ? 30 : budget.maxChars);
        const box = {
          x: node.x - Math.max(size.charW * 3, text.length * size.charW) / 2,
          y: node.y + size.font * 0.7,
          w: Math.max(size.charW * 3, text.length * size.charW),
          h: size.lineH,
        };
        const forced = node.key === hoverKey || node.center || hotSet.has(node.key);
        if (!forced && taken.some((other) => boxesOverlap(box, other, size.font * 0.35))) return;
        taken.push(box);
        shown.add(node.key);
      });
      return shown;
    }

    function draw() {
      const hot = hoverKey ? connectedKeys(hoverKey) : null;
      const labels = visibleLabels(hot);
      const budget = labelBudget();
      svg.innerHTML = `
        <defs>
          <radialGradient id="${host.id}-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(78,177,194,0.35)"/>
            <stop offset="100%" stop-color="rgba(78,177,194,0)"/>
          </radialGradient>
        </defs>
        <circle class="graph-halo" cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2 - 18}" fill="url(#${host.id}-glow)"></circle>
      `;
      edges.forEach((edge, index) => {
        const from = placed.find((node) => node.key === edge.from);
        const to = placed.find((node) => node.key === edge.to);
        if (!from || !to) return;
        const line = document.createElementNS(ns, "path");
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 18;
        line.setAttribute("d", `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`);
        const fromHidden = Boolean(typeFilter && from.entityType !== typeFilter && !from.center);
        const toHidden = Boolean(typeFilter && to.entityType !== typeFilter && !to.center);
        line.setAttribute("class", `graph-edge${edgeLit(edge) ? " is-hot" : ""}${hot && !edgeLit(edge) ? " is-dim" : ""}${fromHidden || toHidden ? " is-hidden" : ""}`);
        line.dataset.edge = String(index);
        svg.appendChild(line);
      });
      placed.forEach((node) => {
        const group = document.createElementNS(ns, "g");
        const hidden = Boolean(typeFilter && node.entityType !== typeFilter && !node.center);
        const dim = Boolean(hot && !hot.has(node.key));
        group.setAttribute("class", `graph-node graph-node-${node.entityType || "entity"}${node.center ? " is-center" : ""}${node.key === hoverKey ? " is-hot" : ""}${dim ? " is-dim" : ""}${hidden ? " is-hidden" : ""}`);
        group.dataset.key = node.key;
        const glow = document.createElementNS(ns, "circle");
        glow.setAttribute("class", "graph-node-glow");
        glow.setAttribute("cx", node.x);
        glow.setAttribute("cy", node.y);
        glow.setAttribute("r", node.center ? 44 : 32);
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("class", "graph-node-core");
        circle.setAttribute("cx", node.x);
        circle.setAttribute("cy", node.y);
        circle.setAttribute("r", node.center ? 16 : 12);
        if (labels.has(node.key)) {
          const size = typeSize();
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", node.x);
          label.setAttribute("y", node.y + size.font * 1.7);
          label.style.fontSize = "13px";
          label.style.strokeWidth = "3px";
          label.textContent = shortenLabel(node.name, node.center || node.key === hoverKey ? 30 : budget.maxChars);
          group.append(glow, circle, label);
        } else {
          group.append(glow, circle);
        }
        svg.appendChild(group);
      });
    }

    function showTip(node, clientX, clientY) {
      const links = edges.filter((edge) => edge.from === node.key || edge.to === node.key);
      tooltip.hidden = false;
      tooltip.innerHTML = `
        <strong>${escapeHtml(node.name)}</strong>
        <span>${escapeHtml((node.entityType || "entity").replace(/_/g, " "))}</span>
        ${links[0] ? `<span>${escapeHtml(relationLabel(links[0].relationType))} · ${links.length} link${links.length === 1 ? "" : "s"}</span>` : ""}
      `;
      const bounds = host.getBoundingClientRect();
      tooltip.style.left = `${Math.min(clientX - bounds.left + 14, bounds.width - 180)}px`;
      tooltip.style.top = `${Math.max(12, clientY - bounds.top - 18)}px`;
    }

    svg.addEventListener("pointermove", (event) => {
      if (pan) {
        const dx = (event.clientX - pan.clientX) * (view.w / Math.max(1, svg.clientWidth));
        const dy = (event.clientY - pan.clientY) * (view.h / Math.max(1, svg.clientHeight));
        if (Math.hypot(event.clientX - pan.clientX, event.clientY - pan.clientY) > 3) pan.moved = true;
        view.x = pan.vx - dx;
        view.y = pan.vy - dy;
        applyView();
        tooltip.hidden = true;
        return;
      }
      if (drag) {
        const cursor = clientToSvg(event.clientX, event.clientY);
        if (Math.hypot(cursor.x - drag.x, cursor.y - drag.y) > 2) drag.moved = true;
        drag.x = Math.max(36, Math.min(width - 36, cursor.x));
        drag.y = Math.max(28, Math.min(height - 28, cursor.y));
        draw();
        return;
      }
      const group = event.target.closest(".graph-node");
      const next = group?.dataset.key || "";
      if (next !== hoverKey) {
        hoverKey = next;
        draw();
      }
      const node = placed.find((item) => item.key === hoverKey);
      if (node) showTip(node, event.clientX, event.clientY);
      else tooltip.hidden = true;
    });
    svg.addEventListener("pointerleave", () => {
      hoverKey = "";
      tooltip.hidden = true;
      if (!drag && !pan) draw();
    });
    svg.addEventListener("pointerdown", (event) => {
      if (event.button && event.button !== 0) return;
      const group = event.target.closest(".graph-node");
      const node = placed.find((item) => item.key === group?.dataset.key);
      svg.focus({ preventScroll: true });
      if (node) {
        node.moved = false;
        drag = node;
      } else {
        pan = { clientX: event.clientX, clientY: event.clientY, vx: view.x, vy: view.y, moved: false };
      }
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener("pointerup", (event) => {
      try { svg.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
      if (pan) {
        const moved = pan.moved;
        pan = null;
        if (moved) return;
      }
      if (drag) {
        const moved = drag.moved;
        const node = drag;
        drag = null;
        if (moved) return;
        event.stopPropagation();
        if (typeof options.onNodeOpen === "function") {
          options.onNodeOpen(node);
          return;
        }
        const target = graphNavFor(node);
        if (!target) return;
        if (target.kind === "modal") openModal(target.id);
        else if (target.kind === "entity") openEntityModal(node);
        else if (target.kind === "route") { closeModal(); navigate(target.hash); }
        else if (target.kind === "external") window.open(target.href, "_blank", "noopener,noreferrer");
        return;
      }
    });
    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const cursor = clientToSvg(event.clientX, event.clientY);
      const factor = event.deltaY > 0 ? 0.9 : 1.12;
      setScale(view.scale * factor, cursor.x, cursor.y);
    }, { passive: false });
    svg.addEventListener("dblclick", (event) => {
      if (event.target.closest(".graph-node")) return;
      event.preventDefault();
      const cursor = clientToSvg(event.clientX, event.clientY);
      setScale(view.scale * 1.35, cursor.x, cursor.y);
    });
    svg.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") { event.preventDefault(); setScale(view.scale * 1.18); }
      if (event.key === "-" || event.key === "_") { event.preventDefault(); setScale(view.scale / 1.18); }
      if (event.key === "0") { event.preventDefault(); resetView(); }
    });
    svg.addEventListener("click", (event) => {
      if (!event.target.closest(".graph-node")) return;
      event.stopPropagation();
    });
    host.querySelectorAll(".graph-type-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        typeFilter = button.dataset.type || "";
        host.querySelectorAll(".graph-type-btn").forEach((item) => item.classList.toggle("is-on", item === button));
        draw();
      });
    });
    host.querySelectorAll("[data-zoom]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const action = button.dataset.zoom;
        if (action === "in") setScale(view.scale * 1.22);
        else if (action === "out") setScale(view.scale / 1.22);
        else resetView();
      });
    });

    draw();
    applyView();
  }

  function flushGraphs() {
    const remaining = [];
    pendingGraphs.forEach((spec) => {
      const host = document.getElementById(spec.id);
      if (host) mountInteractiveGraph(host, spec.nodes, spec.edges, spec.options);
      else remaining.push(spec);
    });
    pendingGraphs.length = 0;
    remaining.forEach((spec) => pendingGraphs.push(spec));
  }

  function renderStarGraph(center, neighbors) {
    const nodes = [
      { key: "center", name: center.name, slug: center.slug, entityType: center.entityType || center.entity_type, legacyId: center.legacyId || center.id, center: true },
      ...neighbors.map((neighbor) => ({
        key: neighbor.slug || neighbor.id || neighbor.name,
        name: neighbor.name,
        slug: neighbor.slug,
        entityType: neighbor.entityType,
        legacyId: neighbor.legacyId || neighbor.id,
      })),
    ];
    const edges = neighbors.map((neighbor) => ({
      from: "center",
      to: neighbor.slug || neighbor.id || neighbor.name,
      relationType: neighbor.relationType,
    }));
    return renderGraphHost(nodes, edges, { label: `Connections for ${center.name}` });
  }

  const GRAPH_FOCUS = new Set(["event", "model", "collection", "concept", "method", "organization", "publication", "use_case", "dataset"]);
  const SEED_QUOTAS = {
    event: 8,
    concept: 16,
    model: 12,
    collection: 10,
    method: 8,
    publication: 6,
    organization: 8,
    use_case: 4,
    dataset: 4,
  };

  function graphDegree(edges) {
    const degree = new Map();
    edges.forEach((edge) => {
      degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    });
    return degree;
  }

  function atlasSpineSeeds(nodes, degree) {
    const ranked = (type) => nodes
      .filter((node) => node.entityType === type)
      .sort((a, b) => {
        const hub = Number(Boolean(b.isHub)) - Number(Boolean(a.isHub));
        if (hub) return hub;
        return (degree.get(b.key) || 0) - (degree.get(a.key) || 0);
      });
    return Object.entries(SEED_QUOTAS).flatMap(([type, limit]) => ranked(type).slice(0, limit));
  }

  function diverseHits(seeds, limit = 18) {
    const buckets = new Map();
    seeds.forEach((seed) => {
      const list = buckets.get(seed.entityType) || [];
      list.push(seed);
      buckets.set(seed.entityType, list);
    });
    const hits = [];
    for (let index = 0; hits.length < limit; index += 1) {
      let added = false;
      buckets.forEach((list) => {
        if (hits.length >= limit || !list[index]) return;
        hits.push(list[index]);
        added = true;
      });
      if (!added) break;
    }
    return hits;
  }

  function visibleAtlasGraph(nodes, edges, { q = "", entityType = "" } = {}) {
    const query = q.trim().toLowerCase();
    const matches = (node) => {
      if (entityType && node.entityType !== entityType) return false;
      if (!query) return true;
      return `${node.name} ${node.summary || ""} ${node.entityType}`.toLowerCase().includes(query);
    };
    const degree = graphDegree(edges);
    const browsing = Boolean(query || entityType);
    let seeds = browsing ? nodes.filter(matches) : atlasSpineSeeds(nodes, degree);
    if (!seeds.length) seeds = nodes.filter(matches);
    const seedKeys = new Set(seeds.map((node) => node.key));
    const keep = new Set(seedKeys);
    const byKey = new Map(nodes.map((node) => [node.key, node]));
    edges.forEach((edge) => {
      const hop = (from, to) => {
        if (!seedKeys.has(from)) return;
        const neighbor = byKey.get(to);
        if (!neighbor) return;
        if (browsing || GRAPH_FOCUS.has(neighbor.entityType)) keep.add(to);
      };
      hop(edge.from, edge.to);
      hop(edge.to, edge.from);
    });
    let shown = nodes.filter((node) => keep.has(node.key));
    const cap = browsing ? 90 : 48;
    if (shown.length > cap) {
      const typeRank = (type) => ({ event: 5, concept: 4, model: 4, collection: 4, method: 3, organization: 2, publication: 2 }[type] || 1);
      shown = shown.sort((a, b) => {
        const seedDelta = Number(seedKeys.has(b.key)) - Number(seedKeys.has(a.key));
        if (seedDelta) return seedDelta;
        const typeDelta = typeRank(b.entityType) - typeRank(a.entityType);
        if (typeDelta) return typeDelta;
        return (degree.get(b.key) || 0) - (degree.get(a.key) || 0);
      }).slice(0, cap);
    }
    const keys = new Set(shown.map((node) => node.key));
    return {
      nodes: shown,
      edges: edges.filter((edge) => keys.has(edge.from) && keys.has(edge.to)),
      seeds,
      hits: diverseHits(seeds),
    };
  }

  function renderAtlasGraph(nodes, edges, options = {}) {
    return renderGraphHost(nodes, edges, { height: 640, label: "BioAtlas knowledge graph", ...options });
  }

  function renderEventsGraph(events) {
    const nodes = [];
    const seen = new Set();
    const edges = [];
    events.forEach((event) => {
      if (!seen.has(event.slug)) {
        seen.add(event.slug);
        nodes.push({ key: event.slug, name: event.name, slug: event.slug, entityType: "event" });
      }
      (event.neighbors || []).forEach((neighbor) => {
        const key = neighbor.slug || neighbor.id || neighbor.name;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({
            key,
            name: neighbor.name,
            slug: neighbor.slug,
            entityType: neighbor.entityType,
            legacyId: neighbor.legacyId || neighbor.id,
          });
        }
        edges.push({ from: event.slug, to: key, relationType: neighbor.relationType || "involves" });
      });
    });
    return renderGraphHost(nodes, edges, { height: 400, label: "Intelligence knowledge graph" });
  }

  function renderModelsGraph(models) {
    const nodes = [];
    const seen = new Set();
    const edges = [];
    const showNeighbors = models.length <= 8;
    models.forEach((model) => {
      if (!seen.has(model.slug)) {
        seen.add(model.slug);
        nodes.push({ key: model.slug, name: model.name, slug: model.slug, entityType: "model" });
      }
      if (!showNeighbors) return;
      (model.neighbors || []).forEach((neighbor) => {
        if (!["organization", "tool", "use_case"].includes(neighbor.entityType)) return;
        const key = neighbor.slug || neighbor.id || neighbor.name;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({
            key,
            name: neighbor.name,
            slug: neighbor.slug,
            entityType: neighbor.entityType,
            legacyId: neighbor.legacyId || neighbor.id,
          });
        }
        edges.push({ from: model.slug, to: key, relationType: neighbor.relationType });
      });
    });
    return renderGraphHost(nodes, edges, { height: models.length > 12 ? 460 : 400, label: "Filtered model graph" });
  }

  async function fillGraphPanel(root, from) {
    const panel = root.querySelector(".graph-panel");
    if (!panel) return;
    try {
      const response = await fetch(`/api/graph?from=${encodeURIComponent(from)}&depth=1`);
      if (!response.ok) {
        panel.innerHTML = "";
        return;
      }
      const graph = await response.json();
      panel.innerHTML = `
        <div class="detail-label">Connected in BioAtlas</div>
        ${renderStarGraph(graph.center || { name: from }, graph.neighbors || [])}
        ${renderNeighborChips(graph.neighbors || [])}
      `;
      bindGraphLinks(panel);
    } catch (error) {
      console.warn("BioAtlas could not load the graph panel.", error);
      panel.innerHTML = "";
    }
  }

  function bindGraphLinks(root) {
    flushGraphs(root);
    root.querySelectorAll(".chip.link").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        if (chip.dataset.id && (chip.dataset.id.startsWith("term-") || chip.dataset.id.startsWith("method-"))) {
          openModal(chip.dataset.id);
          return;
        }
        if (chip.dataset.entity) {
          openEntityModal({
            slug: chip.dataset.entity,
            name: chip.dataset.entityName,
            entityType: chip.dataset.entityType,
            summary: chip.dataset.entitySummary,
          });
          return;
        }
        if (chip.dataset.hash) {
          closeModal();
          navigate(chip.dataset.hash);
          return;
        }
        if (chip.dataset.href) {
          window.open(chip.dataset.href, "_blank", "noopener,noreferrer");
        }
      });
    });
  }

  let modelsState = { q: "", category: "", openness: "", year: "", provider: "", org: "", page: 1 };
  const MODELS_PAGE_SIZE = 24;
  let intelState = { q: "", type: "", entity: "" };

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function modelYear(model) {
    const match = String(model.release_date || "").match(/\d{4}/);
    return match ? match[0] : "";
  }

  function neighborNames(model, predicate) {
    return (model.neighbors || []).filter(predicate).map((neighbor) => neighbor.name);
  }

  function filterModels(models) {
    const q = modelsState.q.trim().toLowerCase();
    return models.filter((model) => {
      if (modelsState.category && (model.model_category || "") !== modelsState.category) return false;
      if (modelsState.openness && (model.openness || "") !== modelsState.openness) return false;
      if (modelsState.year && modelYear(model) !== modelsState.year) return false;
      if (modelsState.provider && !neighborNames(model, (neighbor) => neighbor.entityType === "tool" || neighbor.relationType === "available_on").includes(modelsState.provider)) return false;
      if (modelsState.org && !neighborNames(model, (neighbor) => neighbor.entityType === "organization").includes(modelsState.org)) return false;
      if (q) {
        const haystack = [
          model.name,
          model.summary,
          model.architecture,
          model.model_category,
          model.openness,
          model.license,
          ...(model.input_modalities || []),
          ...(model.output_modalities || []),
          ...neighborNames(model, () => true),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function filterEvents(events) {
    const q = intelState.q.trim().toLowerCase();
    return events.filter((event) => {
      if (intelState.type && (event.event_type || "") !== intelState.type) return false;
      if (q) {
        const haystack = [event.name, event.summary, event.body, event.event_type, ...(event.neighbors || []).map((neighbor) => neighbor.name)].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function optionList(values, allLabel) {
    return `<option value="">${escapeHtml(allLabel)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(String(value).replace(/_/g, " "))}</option>`).join("")}`;
  }

  let structuresState = { q: "", scale: "Molecules", species: "", access: "", type: "", modality: "", tag: "" };
  const STRUCTURE_SCALE_FALLBACK = [
    { id: "Molecules", label: "Molecules", hint: "Å–nm", copy: "Explore molecular structures, sequences, interactions and the resources used to study them." },
    { id: "Organelles", label: "Organelles", hint: "nm", copy: "Look inside the cell at mitochondria, nuclei and other compartments." },
    { id: "Cells", label: "Cells", hint: "µm", copy: "Browse cell types, morphology, tomograms and single-cell imaging collections." },
    { id: "Tissues", label: "Tissues", hint: "µm–mm", copy: "Move from histology and spatial maps to tissue atlases." },
    { id: "Organs", label: "Organs", hint: "mm–cm", copy: "Open organ-scale maps — brains, hearts, lungs — and the imaging that reconstructs them." },
    { id: "Organisms", label: "Whole organism", hint: "cm–m", copy: "Whole bodies, embryos and museum specimens — one organism at a time." },
    { id: "Populations", label: "Populations", hint: "many", copy: "Comparative libraries of many individuals or species." },
  ];
  const SPECIES_CHIP_ORDER = ["Human", "Mouse", "Rat", "Zebrafish", "Drosophila", "C. elegans", "Arabidopsis", "E. coli"];

  function mediaLabel(kind) {
    if (kind === "coordinates") return "Coordinates";
    if (kind === "mesh") return "Mesh";
    if (kind === "volume") return "Volume";
    return "Mixed";
  }

  function collectionScales(collection) {
    return (collection.scales && collection.scales.length ? collection.scales : [collection.scale]).filter(Boolean);
  }

  function collectionSpecies(collection) {
    return (collection.species || []).filter(Boolean);
  }

  function scaleLabel(scale) {
    return scale?.label || scale?.id || "";
  }

  function speciesDisplay(collection) {
    const list = collectionSpecies(collection);
    if (!list.length) return [];
    if (list.length >= 3) return ["Multi-species"];
    return list;
  }

  function speciesMatches(collection, species) {
    if (!species) return true;
    return collectionSpecies(collection).includes(species);
  }

  function sortStructures(collections) {
    return [...collections].sort((a, b) => {
      const hub = Number(Boolean(b.is_hub)) - Number(Boolean(a.is_hub));
      if (hub) return hub;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function structureHaystack(collection) {
    const models = (collection.related_models || []).map((item) => item.name || item).join(" ");
    const neighbors = (collection.neighbors || []).map((neighbor) => neighbor.name).join(" ");
    return [
      collection.name,
      collection.summary,
      collection.best_for,
      collection.access,
      collection.website,
      collectionScales(collection).join(" "),
      (collection.resource_types || []).join(" "),
      (collection.modalities || []).join(" "),
      (collection.data_types || []).join(" "),
      (collection.capabilities || []).join(" "),
      (collection.tags || []).join(" "),
      (collection.species || []).join(" "),
      models,
      neighbors,
    ].join(" ").toLowerCase();
  }

  function filterStructures(collections) {
    const q = structuresState.q.trim().toLowerCase();
    return sortStructures(collections.filter((collection) => {
      if (!q && structuresState.scale && !collectionScales(collection).includes(structuresState.scale)) return false;
      if (!speciesMatches(collection, structuresState.species)) return false;
      if (structuresState.access && collection.access !== structuresState.access) return false;
      if (structuresState.type && !(collection.resource_types || []).includes(structuresState.type)) return false;
      if (structuresState.modality && !(collection.modalities || []).includes(structuresState.modality)) return false;
      if (structuresState.tag && !(collection.tags || []).includes(structuresState.tag)) return false;
      if (!q) return true;
      return structureHaystack(collection).includes(q);
    }));
  }

  function renderFacetList(values, limit = 4) {
    return values.slice(0, limit).map((value) => `<span class="portal-tag">${escapeHtml(value)}</span>`).join("");
  }

  function renderPortalRow(collection, selected) {
    const types = collection.resource_types || [];
    return `
      <button type="button" class="portal-row${collection.is_hub ? " is-hub" : ""}${selected && selected.slug === collection.slug ? " selected" : ""}" data-slug="${escapeHtml(collection.slug)}">
        <span class="portal-row-main">
          <span class="portal-row-name">${escapeHtml(collection.name)}</span>
          ${collection.is_hub ? `<span class="portal-hub-mark">Hub</span>` : ""}
          <span class="portal-row-summary">${escapeHtml(collection.summary || "")}</span>
          ${collection.best_for ? `<span class="portal-best"><span>Best for</span> ${escapeHtml(collection.best_for)}</span>` : ""}
          <span class="portal-row-facets">
            ${renderFacetList(collectionScales(collection).map((scale) => scale === "Organisms" ? "Whole organism" : scale), 2)}
            ${renderFacetList(types, 2)}
            ${renderFacetList(speciesDisplay(collection), 1)}
          </span>
        </span>
        <span class="portal-row-meta">
          <span class="portal-tag">${escapeHtml(collection.access)}</span>
          <span class="portal-tag muted">${escapeHtml(mediaLabel(collection.media_kind))}</span>
        </span>
      </button>
    `;
  }

  function renderMetaBlock(label, values) {
    const items = (Array.isArray(values) ? values : [values]).filter(Boolean);
    if (!items.length) return "";
    return `<div><div class="detail-label">${escapeHtml(label)}</div><p>${escapeHtml(items.join(" · "))}</p></div>`;
  }

  function renderModelChips(models) {
    if (!models.length) return "";
    return `
      <div class="detail-label">Relevant models</div>
      <div class="chip-row">${models.map((model) => {
        const slug = model.slug || model;
        const name = model.name || model;
        return `<span class="chip link" data-hash="/models/${escapeHtml(slug)}">${escapeHtml(name)}</span>`;
      }).join("")}</div>
    `;
  }

  function renderStructureDetail(collection) {
    const models = collection.related_models || [];
    return `
      <button class="modal-close" aria-label="Close details">&times;</button>
      <div class="modal-kind">${escapeHtml((collection.resource_types || [])[0] || "Resource")} · ${escapeHtml(collectionScales(collection).join(" · ") || "Life science")}</div>
      <h3 class="modal-title" id="modal-title">${escapeHtml(collection.name)}</h3>
      <p class="modal-lede">${escapeHtml(collection.summary || "")}</p>
      ${collection.best_for ? `<p class="modal-best"><strong>Best for</strong> ${escapeHtml(collection.best_for)}</p>` : ""}
      <div class="meta-grid">
        ${renderMetaBlock("Scale", collectionScales(collection))}
        ${renderMetaBlock("Type", collection.resource_types)}
        ${renderMetaBlock("Access", collection.access)}
        ${renderMetaBlock("Data", collection.data_types)}
        ${renderMetaBlock("Modalities", collection.modalities)}
        ${renderMetaBlock("Capabilities", collection.capabilities)}
        ${renderMetaBlock("Species", collection.species)}
        ${renderMetaBlock("Tags", collection.tags)}
      </div>
      <p class="modal-source">Open resource &middot; <a href="${escapeHtml(collection.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(collection.website)}</a></p>
      <p class="modal-source">BioAtlas indexes where to explore. The data stays on the source site.</p>
      ${renderModelChips(models)}
      <div class="graph-panel">
        <div class="detail-label">Connected in BioAtlas</div>
        ${renderStarGraph({ name: collection.name, slug: collection.slug, entityType: "collection" }, collection.neighbors || [])}
        ${renderNeighborChips(collection.neighbors || [])}
      </div>
    `;
  }

  function openStructureModal(collection) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.dataset.kind = "structure";
    backdrop.innerHTML = `<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title">${renderStructureDetail(collection)}</div>`;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) dismissStructureModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") dismissStructureModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);
    backdrop.querySelector(".modal-close").addEventListener("click", dismissStructureModal);
    backdrop.querySelector(".modal-close").focus();
    bindGraphLinks(backdrop);
  }

  function dismissStructureModal() {
    closeModal();
    if (location.hash.startsWith("#/structures/")) navigate(structuresListHash());
  }

  function structuresQuery() {
    const params = new URLSearchParams();
    if (structuresState.scale) params.set("scale", structuresState.scale);
    if (structuresState.species) params.set("species", structuresState.species);
    if (structuresState.type) params.set("type", structuresState.type);
    if (structuresState.access) params.set("access", structuresState.access);
    if (structuresState.modality) params.set("modality", structuresState.modality);
    if (structuresState.q.trim()) params.set("q", structuresState.q.trim());
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  function structuresListHash() {
    return `/structures${structuresQuery()}`;
  }

  function applyStructuresQuery(query) {
    if (!query) return;
    if (query.scale) structuresState.scale = query.scale;
    if (Object.prototype.hasOwnProperty.call(query, "species")) structuresState.species = query.species || "";
    if (Object.prototype.hasOwnProperty.call(query, "type")) structuresState.type = query.type || "";
    if (Object.prototype.hasOwnProperty.call(query, "access")) structuresState.access = query.access || "";
    if (Object.prototype.hasOwnProperty.call(query, "modality")) structuresState.modality = query.modality || "";
    if (Object.prototype.hasOwnProperty.call(query, "q")) structuresState.q = query.q || "";
  }

  async function renderStructures(param, query) {
    const app = getApp();
    if (!app) return;
    applyStructuresQuery(query);
    app.innerHTML = `<div class="view"><div class="no-results">Loading structures&hellip;</div></div>`;
    const response = await fetch("/api/structures");
    if (!response.ok) {
      showLoadError("The structure catalogue could not be loaded.");
      return;
    }
    const payload = await response.json();
    const collections = payload.collections || [];
    const scaleMeta = payload.scales?.length ? payload.scales : STRUCTURE_SCALE_FALLBACK;
    const speciesCatalog = payload.species || [];
    const selected = param ? collections.find((collection) => collection.slug === param) : null;
    if (selected) structuresState.scale = collectionScales(selected)[0] || selected.scale;
    if (!scaleMeta.some((scale) => scale.id === structuresState.scale)) structuresState.scale = "Molecules";
    const access = uniqueSorted(collections.map((collection) => collection.access));
    const types = uniqueSorted(collections.flatMap((collection) => collection.resource_types || []));
    const modalities = uniqueSorted(collections.flatMap((collection) => collection.modalities || []));
    const total = collections.length;

    app.innerHTML = `
      <div class="view structures-view">
        <header class="structures-hero">
          <div class="structures-hero-copy">
            <div class="eyebrow">Scale atlas</div>
            <h2 class="page-title structures-title">Explore life by scale</h2>
            <p class="page-lede structures-lede">Start with a biological level, then narrow your view.</p>
          </div>
          <div class="structures-hero-stat" aria-label="Catalogue size">
            <div class="structures-stat-value">${total}</div>
            <div class="structures-stat-label">resources across ${scaleMeta.length} scales</div>
          </div>
        </header>

        <section class="scale-atlas" aria-label="Biological scale">
          <div class="scale-atlas-ruler" aria-hidden="true">
            <span>10<sup>&minus;10</sup> m</span>
            <span>10<sup>&minus;6</sup> m</span>
            <span>10<sup>&minus;3</sup> m</span>
            <span>1 m+</span>
          </div>
          <div class="scale-atlas-track">
            ${scaleMeta.map((scale) => {
              const count = collections.filter((collection) => collectionScales(collection).includes(scale.id)).length;
              return `
                <button type="button" class="scale-step${structuresState.scale === scale.id ? " active" : ""}" data-scale="${escapeHtml(scale.id)}">
                  <span class="scale-step-dot"></span>
                  <span class="scale-step-name">${escapeHtml(scaleLabel(scale))}</span>
                  <span class="scale-step-hint">${escapeHtml(scale.hint || "")}</span>
                  <span class="scale-step-count">${count}</span>
                </button>
              `;
            }).join("")}
          </div>
        </section>

        <div class="structures-workspace">
          <div class="scale-stage">
            <div class="scale-stage-head">
              <div>
                <div class="atlas-kicker" id="scale-kicker"></div>
                <p class="scale-stage-copy" id="scale-copy"></p>
              </div>
              <div class="scale-stage-controls">
                <label class="scale-search">
                  <span class="search-glyph">${searchIcon()}</span>
                  <input type="search" id="structure-search" placeholder="Search resources, structures, databases&hellip;" value="${escapeHtml(structuresState.q)}" />
                </label>
                <div class="scale-filter-wrap">
                  <button type="button" class="scale-filter-btn" id="structure-filters-btn" aria-expanded="false" aria-controls="structure-filters">Filters</button>
                  <div class="scale-popover" id="structure-filters" hidden>
                    <label>Resource type
                      <select id="f-type">${optionList(types, "All types")}</select>
                    </label>
                    <label>Access
                      <select id="f-access">${optionList(access, "All access")}</select>
                    </label>
                    <label>Modality
                      <select id="f-modality">${optionList(modalities, "All modalities")}</select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="species-refine" id="species-refine"></div>
            <div class="scale-active" id="scale-active"></div>
            <div class="portal-list" id="structure-grid"></div>
          </div>
        </div>
      </div>
    `;

    const search = document.getElementById("structure-search");
    const fAccess = document.getElementById("f-access");
    const fType = document.getElementById("f-type");
    const fModality = document.getElementById("f-modality");
    const filtersBtn = document.getElementById("structure-filters-btn");
    const filtersPanel = document.getElementById("structure-filters");
    fAccess.value = structuresState.access;
    fType.value = structuresState.type;
    fModality.value = structuresState.modality;

    function currentScale() {
      return scaleMeta.find((scale) => scale.id === structuresState.scale) || scaleMeta[0];
    }

    function speciesMeta(id) {
      return speciesCatalog.find((item) => item.id === id) || { id, common: id, scientific: "", group: "Other" };
    }

    function speciesInScale() {
      const counts = new Map();
      collections.forEach((collection) => {
        if (structuresState.scale && !collectionScales(collection).includes(structuresState.scale)) return;
        collectionSpecies(collection).forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
      });
      return [...counts.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => {
          const ai = SPECIES_CHIP_ORDER.indexOf(a[0]);
          const bi = SPECIES_CHIP_ORDER.indexOf(b[0]);
          if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          return a[0].localeCompare(b[0]);
        })
        .map(([id, count]) => ({ ...speciesMeta(id), count }));
    }

    function closePopovers() {
      filtersPanel.hidden = true;
      filtersBtn.setAttribute("aria-expanded", "false");
      const more = document.getElementById("species-more-panel");
      if (more) more.hidden = true;
    }

    function paintSpeciesRow() {
      const host = document.getElementById("species-refine");
      if (!host) return;
      const available = speciesInScale();
      const promoted = available.slice(0, 4);
      const extra = available.length > promoted.length;
      host.innerHTML = `
        <div class="species-label">Species</div>
        <div class="species-chips">
          <button type="button" class="species-chip${structuresState.species ? "" : " active"}" data-species="">All</button>
          ${promoted.map((item) => `
            <button type="button" class="species-chip${structuresState.species === item.id ? " active" : ""}" data-species="${escapeHtml(item.id)}">${escapeHtml(item.common)}</button>
          `).join("")}
          ${extra ? `<button type="button" class="species-chip species-more-btn" id="species-more-btn">More +</button>` : ""}
        </div>
        <div class="scale-popover species-more-panel" id="species-more-panel" hidden>
          <div class="species-more-title">Find an organism</div>
          <input type="search" id="species-more-search" placeholder="Search species&hellip;" />
          <div id="species-more-list"></div>
        </div>
      `;
      host.querySelectorAll("[data-species]").forEach((chip) => {
        chip.addEventListener("click", () => {
          structuresState.species = chip.dataset.species || "";
          closePopovers();
          paintStructures();
        });
      });
      const moreBtn = document.getElementById("species-more-btn");
      const morePanel = document.getElementById("species-more-panel");
      const moreSearch = document.getElementById("species-more-search");
      if (moreBtn && morePanel) {
        moreBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          const next = morePanel.hidden;
          closePopovers();
          morePanel.hidden = !next;
          if (!morePanel.hidden) {
            paintMoreSpecies();
            moreSearch?.focus();
          }
        });
      }
      moreSearch?.addEventListener("input", paintMoreSpecies);
    }

    function paintMoreSpecies() {
      const list = document.getElementById("species-more-list");
      if (!list) return;
      const q = (document.getElementById("species-more-search")?.value || "").trim().toLowerCase();
      const groups = {};
      speciesInScale().forEach((item) => {
        const hay = `${item.common} ${item.scientific} ${item.id}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        const group = item.group || "Other";
        (groups[group] || (groups[group] = [])).push(item);
      });
      const order = ["Common", "Model organisms", "Other"];
      list.innerHTML = order.filter((group) => groups[group]?.length).map((group) => `
        <div class="species-more-group">
          <div class="species-more-kicker">${escapeHtml(group)}</div>
          ${groups[group].map((item) => `
            <button type="button" class="species-more-item${structuresState.species === item.id ? " active" : ""}" data-species="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.common)}</span>
              ${item.scientific ? `<em>${escapeHtml(item.scientific)}</em>` : ""}
            </button>
          `).join("")}
        </div>
      `).join("") || `<div class="no-results">No organisms match.</div>`;
      list.querySelectorAll("[data-species]").forEach((item) => {
        item.addEventListener("click", () => {
          structuresState.species = item.dataset.species || "";
          closePopovers();
          paintStructures();
        });
      });
    }

    function paintActiveFilters(filteredCount) {
      const host = document.getElementById("scale-active");
      if (!host) return;
      const chips = [];
      if (structuresState.species) chips.push({ key: "species", label: structuresState.species });
      if (structuresState.type) chips.push({ key: "type", label: structuresState.type });
      if (structuresState.access) chips.push({ key: "access", label: structuresState.access });
      if (structuresState.modality) chips.push({ key: "modality", label: structuresState.modality });
      if (structuresState.q.trim()) chips.push({ key: "q", label: structuresState.q.trim() });
      host.innerHTML = `
        <div class="scale-active-chips">
          ${chips.map((chip) => `<button type="button" class="active-filter" data-clear="${chip.key}">${escapeHtml(chip.label)} ×</button>`).join("")}
        </div>
        <div class="scale-active-meta">
          <span>${filteredCount ? `${filteredCount} resource${filteredCount === 1 ? "" : "s"}` : "No matching resources"}</span>
          ${chips.length ? `<button type="button" class="clear-btn" id="clear-structure-filters">Clear all</button>` : ""}
        </div>
      `;
      host.querySelectorAll("[data-clear]").forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.clear;
          if (key === "q") structuresState.q = "";
          else structuresState[key] = "";
          search.value = structuresState.q;
          fType.value = structuresState.type;
          fAccess.value = structuresState.access;
          fModality.value = structuresState.modality;
          paintStructures();
        });
      });
      document.getElementById("clear-structure-filters")?.addEventListener("click", () => {
        structuresState.species = "";
        structuresState.type = "";
        structuresState.access = "";
        structuresState.modality = "";
        structuresState.q = "";
        search.value = "";
        fType.value = "";
        fAccess.value = "";
        fModality.value = "";
        paintStructures();
      });
    }

    function paintStructures() {
      const lookingUp = Boolean(structuresState.q.trim());
      const filtered = filterStructures(collections);
      const scale = currentScale();
      const kicker = document.getElementById("scale-kicker");
      const copy = document.getElementById("scale-copy");
      if (kicker) kicker.textContent = lookingUp && !structuresState.scale ? "Search" : scaleLabel(scale);
      if (copy) {
        copy.textContent = lookingUp
          ? "Names, species, databases and models — type what you are looking for."
          : (scale?.copy || "");
      }
      document.querySelectorAll(".scale-step").forEach((item) => {
        item.classList.toggle("active", item.dataset.scale === structuresState.scale);
      });
      paintSpeciesRow();
      paintActiveFilters(filtered.length);
      document.getElementById("structure-grid").innerHTML = filtered.length
        ? filtered.map((collection) => renderPortalRow(collection, selected)).join("")
        : `<div class="no-results">No resources match this view. Clear a filter or choose another scale.</div>`;
      document.querySelectorAll("#structure-grid .portal-row").forEach((row) => {
        row.addEventListener("click", () => navigate(`/structures/${row.dataset.slug}${structuresQuery()}`));
      });
      filtersBtn.classList.toggle("has-filters", Boolean(structuresState.type || structuresState.access || structuresState.modality));
      replaceHash(selected ? `/structures/${selected.slug}${structuresQuery()}` : structuresListHash());
    }

    document.querySelectorAll(".scale-step").forEach((item) => {
      item.addEventListener("click", () => {
        structuresState.scale = item.dataset.scale;
        structuresState.tag = "";
        closePopovers();
        paintStructures();
      });
    });
    search.addEventListener("input", () => { structuresState.q = search.value; paintStructures(); });
    fAccess.addEventListener("change", () => { structuresState.access = fAccess.value; paintStructures(); });
    fType.addEventListener("change", () => { structuresState.type = fType.value; paintStructures(); });
    fModality.addEventListener("change", () => { structuresState.modality = fModality.value; paintStructures(); });
    filtersBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = filtersPanel.hidden;
      closePopovers();
      filtersPanel.hidden = !next;
      filtersBtn.setAttribute("aria-expanded", String(!filtersPanel.hidden));
    });
    if (typeof window.__structuresDocClick === "function") {
      document.removeEventListener("click", window.__structuresDocClick);
    }
    window.__structuresDocClick = (event) => {
      if (!app.contains(event.target)) return;
      if (event.target.closest(".scale-filter-wrap, .species-refine")) return;
      closePopovers();
    };
    document.addEventListener("click", window.__structuresDocClick);

    paintStructures();
    if (selected) openStructureModal(selected);
  }

  async function renderModels(param) {
    const app = getApp();
    if (!app) return;
    app.innerHTML = `<div class="view"><div class="no-results">Loading models&hellip;</div></div>`;
    const response = await fetch("/api/models");
    if (!response.ok) {
      showLoadError("The model catalogue could not be loaded.");
      return;
    }
    const payload = await response.json();
    const models = payload.models || [];
    const providers = payload.providers || [];
    const source = payload.source || {
      name: "bio.rodeo",
      url: "https://bio.rodeo/",
      modelsUrl: "https://bio.rodeo/models",
      providersUrl: "https://bio.rodeo/providers",
      blurb: "bio.rodeo tracks 2,500+ biological foundation models.",
    };
    const selected = param ? models.find((model) => model.slug === param) : null;
    const categories = uniqueSorted(models.map((model) => model.model_category));
    const openness = uniqueSorted(models.map((model) => model.openness));
    const years = uniqueSorted(models.map(modelYear)).reverse();
    const providerNames = uniqueSorted(models.flatMap((model) => neighborNames(model, (neighbor) => neighbor.entityType === "tool" || neighbor.relationType === "available_on")));
    const orgNames = uniqueSorted(models.flatMap((model) => neighborNames(model, (neighbor) => neighbor.entityType === "organization")));

    app.innerHTML = `
      <div class="view">
        <div class="eyebrow">AI &amp; Foundation Model Atlas</div>
        <h2 class="page-title">Models that shape modern life science</h2>
        <p class="page-lede">A structured catalogue of protein, genomic and biomedical models. Each model is a graph node, not a blog post: it links to organizations, papers, datasets, domains and use cases.</p>
        <aside class="source-banner">
          <div>
            <div class="atlas-kicker">Catalogue from ${escapeHtml(source.name)}</div>
            <p>${escapeHtml(source.blurb)}</p>
          </div>
          <div class="source-banner-actions">
            <a class="source-banner-primary" href="${escapeHtml(source.modelsUrl || source.url)}" target="_blank" rel="noopener noreferrer">Browse all models on bio.rodeo <span aria-hidden="true">&rarr;</span></a>
            ${providers.length ? `<button type="button" class="source-banner-secondary" id="open-run-providers">Where to run them</button>` : `<a class="source-banner-secondary" href="${escapeHtml(source.providersUrl || "https://bio.rodeo/providers")}" target="_blank" rel="noopener noreferrer">Where to run them</a>`}
          </div>
        </aside>
        <div class="section-head"><h2>Models in BioAtlas</h2></div>
        <div class="search-bar">
          <span class="search-glyph">${searchIcon()}</span>
          <input type="search" id="model-search" placeholder="Search models, architectures, organizations, providers&hellip;" value="${escapeHtml(modelsState.q)}" />
          <span class="result-count" id="model-count"></span>
        </div>
        <div class="filter-bar" id="model-filters">
          <select id="f-category">${optionList(categories, "All categories")}</select>
          <select id="f-openness">${optionList(openness, "All openness")}</select>
          <select id="f-year">${optionList(years, "All years")}</select>
          <select id="f-provider">${optionList(providerNames, "All run providers")}</select>
          <select id="f-org">${optionList(orgNames, "All organizations")}</select>
          <button class="clear-btn" id="clear-model-filters" type="button">Clear filters</button>
        </div>
        <section class="graph-panel graph-panel-wide" id="models-graph-panel">
          <div class="detail-label">Filtered knowledge graph</div>
          <div id="models-graph-host"></div>
        </section>
        <div class="atlas-grid" id="model-grid"></div>
        <div class="pager" id="model-pager"></div>
      </div>
    `;

    const search = document.getElementById("model-search");
    const fCategory = document.getElementById("f-category");
    const fOpenness = document.getElementById("f-openness");
    const fYear = document.getElementById("f-year");
    const fProvider = document.getElementById("f-provider");
    const fOrg = document.getElementById("f-org");
    fCategory.value = modelsState.category;
    fOpenness.value = modelsState.openness;
    fYear.value = modelsState.year;
    fProvider.value = modelsState.provider;
    fOrg.value = modelsState.org;

    function paintModels() {
      const filtered = filterModels(models);
      const pages = Math.max(1, Math.ceil(filtered.length / MODELS_PAGE_SIZE));
      if (modelsState.page > pages) modelsState.page = pages;
      const start = (modelsState.page - 1) * MODELS_PAGE_SIZE;
      const pageItems = filtered.slice(start, start + MODELS_PAGE_SIZE);
      document.getElementById("model-count").textContent = `${filtered.length.toLocaleString()} model${filtered.length === 1 ? "" : "s"}`;
      document.getElementById("model-grid").innerHTML = pageItems.length ? pageItems.map((model) => `
        <article class="atlas-card${selected && selected.slug === model.slug ? " selected" : ""}" data-slug="${escapeHtml(model.slug)}">
          <div class="atlas-kicker">${escapeHtml(model.model_category || "Foundation model")}</div>
          <h3>${escapeHtml(model.name)}</h3>
          <p>${escapeHtml(model.summary || "")}</p>
          <div class="entry-foot">
            <span class="pill">${escapeHtml(model.openness || "unknown")}${model.openness_score != null ? ` · ${model.openness_score}` : ""}</span>
            <span class="pill">${escapeHtml(formatDate(model.release_date) || "date unpublished")}</span>
            ${model.citations_count != null ? `<span class="pill">${escapeHtml(String(model.citations_count))} cite${model.citations_count === 1 ? "" : "s"}</span>` : ""}
          </div>
        </article>
      `).join("") : `<div class="no-results">No models match these filters.</div>`;
      const graphHost = document.getElementById("models-graph-host");
      if (filtered.length && filtered.length <= 12) {
        graphHost.innerHTML = renderModelsGraph(filtered);
        bindGraphLinks(graphHost);
      } else {
        graphHost.innerHTML = `<p class="graph-empty">Showing ${filtered.length.toLocaleString()} models. Narrow category, year or organization to map a smaller set.</p>`;
      }
      const pager = document.getElementById("model-pager");
      pager.innerHTML = pages > 1 ? `
        <button type="button" class="pager-btn" id="model-prev" ${modelsState.page === 1 ? "disabled" : ""}>Previous</button>
        <span class="pager-status">Page ${modelsState.page} of ${pages}</span>
        <button type="button" class="pager-btn" id="model-next" ${modelsState.page === pages ? "disabled" : ""}>Next</button>
      ` : "";
      document.getElementById("model-prev")?.addEventListener("click", () => { modelsState.page -= 1; paintModels(); });
      document.getElementById("model-next")?.addEventListener("click", () => { modelsState.page += 1; paintModels(); });
      document.querySelectorAll("#model-grid .atlas-card").forEach((card) => {
        card.addEventListener("click", () => navigate(`/models/${card.dataset.slug}`));
      });
    }

    search.addEventListener("input", () => { modelsState.q = search.value; modelsState.page = 1; paintModels(); });
    fCategory.addEventListener("change", () => { modelsState.category = fCategory.value; modelsState.page = 1; paintModels(); });
    fOpenness.addEventListener("change", () => { modelsState.openness = fOpenness.value; modelsState.page = 1; paintModels(); });
    fYear.addEventListener("change", () => { modelsState.year = fYear.value; modelsState.page = 1; paintModels(); });
    fProvider.addEventListener("change", () => { modelsState.provider = fProvider.value; modelsState.page = 1; paintModels(); });
    fOrg.addEventListener("change", () => { modelsState.org = fOrg.value; modelsState.page = 1; paintModels(); });
    document.getElementById("clear-model-filters").addEventListener("click", () => {
      modelsState = { q: "", category: "", openness: "", year: "", provider: "", org: "", page: 1 };
      renderModels(param);
    });

    if (selected) {
      const index = filterModels(models).findIndex((model) => model.slug === selected.slug);
      if (index >= 0) modelsState.page = Math.floor(index / MODELS_PAGE_SIZE) + 1;
    }
    document.getElementById("open-run-providers")?.addEventListener("click", () => openProvidersModal(providers, source));
    paintModels();
    if (selected) openModelModal(selected);
  }

  function renderModelDetail(model) {
    const authors = model.authors || [];
    return `
      <button class="modal-close" aria-label="Close details">&times;</button>
      <div class="modal-kind">Selected model</div>
      <h3 class="modal-title" id="modal-title">${escapeHtml(model.name)}</h3>
      <p class="modal-lede">${escapeHtml(model.summary || "")}</p>
      <div class="meta-grid">
        <div><div class="detail-label">Category</div><p>${escapeHtml(model.model_category || "—")}</p></div>
        <div><div class="detail-label">Released</div><p>${escapeHtml(formatDate(model.release_date) || "—")}</p></div>
        <div><div class="detail-label">Openness</div><p>${escapeHtml(model.openness || "—")}${model.openness_score != null ? ` · ${model.openness_score}` : ""}</p></div>
        <div><div class="detail-label">License</div><p>${escapeHtml(model.license || "—")}</p></div>
        <div><div class="detail-label">Usability</div><p>${model.usability_score != null ? escapeHtml(String(model.usability_score)) : "—"}</p></div>
        <div><div class="detail-label">Reproducibility</div><p>${model.reproducibility_score != null ? escapeHtml(String(model.reproducibility_score)) : "—"}</p></div>
        <div><div class="detail-label">Citations</div><p>${model.citations_count != null ? escapeHtml(String(model.citations_count)) : "—"}</p></div>
        <div><div class="detail-label">Authors</div><p>${escapeHtml(authors.length ? authors.join(", ") : "—")}</p></div>
      </div>
      ${model.github_url ? `<p class="modal-source">Code &middot; <a href="${escapeHtml(model.github_url)}" target="_blank" rel="noopener">${escapeHtml(model.github_url)}</a></p>` : ""}
      ${model.paper_url ? `<p class="modal-source">Paper &middot; <a href="${escapeHtml(model.paper_url)}" target="_blank" rel="noopener">${escapeHtml(model.paper_url)}</a></p>` : ""}
      ${model.weights_url ? `<p class="modal-source">Weights &middot; <a href="${escapeHtml(model.weights_url)}" target="_blank" rel="noopener">${escapeHtml(model.weights_url)}</a></p>` : ""}
      ${model.homepage_url ? `<p class="modal-source">Homepage &middot; <a href="${escapeHtml(model.homepage_url)}" target="_blank" rel="noopener">${escapeHtml(model.homepage_url)}</a></p>` : ""}
      ${model.model_url ? `<p class="modal-source">Profile &middot; <a href="${escapeHtml(model.model_url)}" target="_blank" rel="noopener">${escapeHtml(model.model_url)}</a></p>` : ""}
      <p class="modal-source">More models &middot; <a href="https://bio.rodeo/models" target="_blank" rel="noopener noreferrer">bio.rodeo/models</a></p>
      <div class="graph-panel">
        <div class="detail-label">Connected in BioAtlas</div>
        ${renderStarGraph(model, model.neighbors || [])}
        ${renderNeighborChips(model.neighbors || [])}
      </div>
    `;
  }

  function renderProviderCards(providers) {
    return providers.map((provider) => `
      <article class="atlas-card provider-card" data-website="${escapeHtml(provider.website || "")}" data-slug="${escapeHtml(provider.slug)}">
        <div class="provider-brand">
          <img class="provider-logo" src="${escapeHtml(provider.logo || `/providers/${provider.slug}.svg`)}" alt="" width="72" height="44" />
          <div>
            <div class="atlas-kicker">Run provider</div>
            <h3>${escapeHtml(provider.name)}</h3>
          </div>
        </div>
        <p>${escapeHtml(provider.summary || "")}</p>
        <div class="entry-foot">
          ${provider.website ? `<a class="pill" href="${escapeHtml(provider.website)}" target="_blank" rel="noopener noreferrer">Official site</a>` : ""}
          <a class="pill" href="https://bio.rodeo/providers/${escapeHtml(provider.slug)}" target="_blank" rel="noopener noreferrer">bio.rodeo</a>
        </div>
      </article>
    `).join("");
  }

  function bindProviderCards(root) {
    root.querySelectorAll(".provider-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        const href = card.dataset.website || (card.dataset.slug ? `https://bio.rodeo/providers/${card.dataset.slug}` : "");
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      });
    });
  }

  function openProvidersModal(providers, source) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.dataset.kind = "providers";
    backdrop.innerHTML = `
      <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" aria-label="Close details">&times;</button>
        <div class="modal-kind">Where you can run them</div>
        <h3 class="modal-title" id="modal-title">Hosted inference, fine-tuning and weight downloads</h3>
        <p class="modal-lede">Click a provider to open their official site. Listings follow <a href="${escapeHtml(source.providersUrl || "https://bio.rodeo/providers")}" target="_blank" rel="noopener noreferrer">bio.rodeo/providers</a>.</p>
        <div class="atlas-grid provider-grid">${renderProviderCards(providers)}</div>
      </div>
    `;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") closeModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);
    backdrop.querySelector(".modal-close").addEventListener("click", closeModal);
    backdrop.querySelector(".modal-close").focus();
    bindProviderCards(backdrop);
  }

  function openModelModal(model) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.dataset.kind = "model";
    backdrop.innerHTML = `<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title">${renderModelDetail(model)}</div>`;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) dismissModelModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") dismissModelModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);
    backdrop.querySelector(".modal-close").addEventListener("click", dismissModelModal);
    backdrop.querySelector(".modal-close").focus();
    bindGraphLinks(backdrop);
  }

  function openEntityModal(node) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" aria-label="Close details">&times;</button>
        <div class="modal-kind">${escapeHtml((node.entityType || "entity").replace(/_/g, " "))}</div>
        <h3 class="modal-title" id="modal-title">${escapeHtml(node.name)}</h3>
        <p class="modal-lede">${escapeHtml(node.summary || "This node is part of the BioAtlas knowledge graph.")}</p>
      </div>
    `;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") closeModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);
    backdrop.querySelector(".modal-close").addEventListener("click", closeModal);
    backdrop.querySelector(".modal-close").focus();
  }

  function openExplorerNode(node) {
    const type = node.entityType || "";
    if ((type === "concept" || type === "method") && (node.legacyId || node.id)) {
      openModal(node.legacyId || node.id);
      return;
    }
    if (type === "model" && node.slug) {
      navigate(`/models/${node.slug}`);
      return;
    }
    if (type === "collection" && node.slug) {
      navigate(`/structures/${node.slug}`);
      return;
    }
    if (type === "event" && node.slug) {
      navigate(`/intelligence/${node.slug}`);
      return;
    }
    if (type === "tool" && node.slug) {
      window.open(`https://bio.rodeo/providers/${node.slug}`, "_blank", "noopener,noreferrer");
      return;
    }
    openEntityModal(node);
  }

  function openEventModal(event) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "modal-backdrop";
    backdrop.dataset.kind = "event";
    backdrop.innerHTML = `
      <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" aria-label="Close details">&times;</button>
        <div class="modal-kind">${escapeHtml((event.event_type || "event").replace(/_/g, " "))}</div>
        <h3 class="modal-title" id="modal-title">${escapeHtml(event.name)}</h3>
        <p class="modal-lede">${escapeHtml(event.body || event.summary || "")}</p>
        <div class="graph-panel">
          <div class="detail-label">This event in the graph</div>
          ${renderStarGraph(event, event.neighbors || [])}
          ${renderNeighborChips(event.neighbors || [])}
        </div>
      </div>
    `;
    backdrop.addEventListener("click", (eventClick) => {
      if (eventClick.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    const onKey = (eventKey) => {
      if (eventKey.key === "Escape") closeModal();
    };
    backdrop._onKey = onKey;
    window.addEventListener("keydown", onKey);
    backdrop.querySelector(".modal-close").addEventListener("click", closeModal);
    backdrop.querySelector(".modal-close").focus();
    bindGraphLinks(backdrop);
  }

  async function renderIntelligence(param) {
    const app = getApp();
    if (!app) return;
    app.innerHTML = `<div class="view"><div class="no-results">Loading intelligence&hellip;</div></div>`;
    const [eventsRes, graphRes] = await Promise.all([
      fetch("/api/events"),
      fetch("/api/graph"),
    ]);
    if (!eventsRes.ok) {
      showLoadError("The intelligence feed could not be loaded.");
      return;
    }
    const payload = await eventsRes.json();
    const events = payload.events || [];
    const atlas = graphRes.ok ? await graphRes.json() : { nodes: [], edges: [], stats: {} };
    const atlasNodes = atlas.nodes || [];
    const atlasEdges = atlas.edges || [];
    const selected = param ? events.find((event) => event.slug === param) : null;
    const types = uniqueSorted(events.map((event) => event.event_type));
    const entityTypes = uniqueSorted(atlasNodes.map((node) => node.entityType));

    app.innerHTML = `
      <div class="view">
        <div class="eyebrow">Biotech Intelligence</div>
        <h2 class="page-title">The live knowledge graph</h2>
        <p class="page-lede">Models, 3D portals, concepts, methods, organizations and events in one browseable map. Search or filter to walk the graph; hover to see links, drag to rearrange, click a node to open it.</p>
        <div class="search-bar">
          <span class="search-glyph">${searchIcon()}</span>
          <input type="search" id="intel-search" placeholder="Search models, 3D portals, concepts, organizations, events&hellip;" value="${escapeHtml(intelState.q)}" />
          <span class="result-count" id="intel-count"></span>
        </div>
        <div class="filter-bar">
          <select id="f-entity">${optionList(entityTypes, "All graph entities")}</select>
          <select id="f-event-type">${optionList(types, "All event types")}</select>
          <button class="clear-btn" id="clear-intel-filters" type="button">Clear filters</button>
        </div>
        <section class="graph-panel graph-panel-wide graph-panel-hero">
          <div class="detail-label" id="intel-graph-label">Knowledge graph</div>
          <div class="graph-hits" id="intel-hits"></div>
          <div id="intel-graph-host"></div>
        </section>
        <div class="section-head"><h2>Recent developments</h2></div>
        <div class="timeline" id="intel-timeline"></div>
      </div>
    `;

    const search = document.getElementById("intel-search");
    const fType = document.getElementById("f-event-type");
    const fEntity = document.getElementById("f-entity");
    fType.value = intelState.type;
    fEntity.value = intelState.entity;

    function paintIntel() {
      const filtered = filterEvents(events);
      const view = atlasNodes.length
        ? visibleAtlasGraph(atlasNodes, atlasEdges, { q: intelState.q, entityType: intelState.entity })
        : { nodes: [], edges: [], seeds: [] };
      const stats = atlas.stats || {};
      document.getElementById("intel-count").textContent = view.nodes.length
        ? `${view.nodes.length} on the map`
        : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`;
      document.getElementById("intel-graph-label").textContent = stats.nodeCount
        ? `Knowledge graph · ${stats.nodeCount.toLocaleString()} entities · ${Number(stats.edgeCount || 0).toLocaleString()} links`
        : "Knowledge graph";
      document.getElementById("intel-hits").innerHTML = (view.hits || view.seeds.slice(0, 18)).map((node) => `
        <button type="button" class="chip link graph-hit" data-key="${escapeHtml(node.key)}">${escapeHtml(shortenLabel(node.name, 28))}</button>
      `).join("");
      document.getElementById("intel-timeline").innerHTML = filtered.length ? filtered.map((event) => `
        <article class="timeline-item${selected && selected.slug === event.slug ? " selected" : ""}" data-slug="${escapeHtml(event.slug)}">
          <div class="timeline-date">${escapeHtml(formatDate(event.occurred_on))}</div>
          <div class="atlas-kicker">${escapeHtml((event.event_type || "event").replace(/_/g, " "))}</div>
          <h3>${escapeHtml(event.name)}</h3>
          <p>${escapeHtml(event.summary || "")}</p>
          ${renderNeighborChips(event.neighbors || [])}
        </article>
      `).join("") : `<div class="no-results">No events match these filters.</div>`;
      const graphHost = document.getElementById("intel-graph-host");
      if (view.nodes.length) {
        graphHost.innerHTML = renderAtlasGraph(view.nodes, view.edges, { onNodeOpen: openExplorerNode });
        bindGraphLinks(graphHost);
      } else {
        graphHost.innerHTML = renderEventsGraph(filtered);
        bindGraphLinks(graphHost);
      }
      document.querySelectorAll("#intel-hits .graph-hit").forEach((hit) => {
        hit.addEventListener("click", () => {
          const node = (view.nodes.find((item) => item.key === hit.dataset.key)
            || view.seeds.find((item) => item.key === hit.dataset.key));
          if (node) openExplorerNode(node);
        });
      });
      document.querySelectorAll("#intel-timeline .timeline-item").forEach((item) => {
        item.addEventListener("click", () => navigate(`/intelligence/${item.dataset.slug}`));
      });
      bindGraphLinks(document.getElementById("intel-timeline"));
    }

    search.addEventListener("input", () => { intelState.q = search.value; paintIntel(); });
    fType.addEventListener("change", () => { intelState.type = fType.value; paintIntel(); });
    fEntity.addEventListener("change", () => { intelState.entity = fEntity.value; paintIntel(); });
    document.getElementById("clear-intel-filters").addEventListener("click", () => {
      intelState = { q: "", type: "", entity: "" };
      renderIntelligence(param);
    });

    paintIntel();
    if (selected) openEventModal(selected);
  }
})();

