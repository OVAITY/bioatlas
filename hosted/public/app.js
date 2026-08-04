(function () {
  "use strict";

  const DATA = window.DATA;
  const app = document.getElementById("app");
  const tabs = document.querySelectorAll("#tabs a");
  const themeToggle = document.getElementById("theme-toggle");

  const glossary = DATA.glossary.map((g) => ({ ...g, kind: "term" }));
  const methodologies = DATA.methodologies.map((m) => ({ ...m, kind: "method" }));
  const allEntries = [...glossary, ...methodologies];
  const videos = window.VIDEOS || {};

  document.getElementById("foot-terms").textContent = DATA.meta.glossaryCount;
  document.getElementById("foot-methods").textContent = DATA.meta.methodologyCount;

  const savedTheme = localStorage.getItem("ovaity-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ovaity-theme", next);
    themeToggle.setAttribute("aria-label", `Switch to ${current} theme`);
  });

  function splitList(s) {
    if (!s) return [];
    return String(s).split(/,|;/).map((p) => p.trim()).filter(Boolean);
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
    const [route, ...rest] = raw.split("/");
    return { route: route || "overview", param: rest.join("/") };
  }

  function navigate(hash) {
    location.hash = hash;
  }

  window.addEventListener("hashchange", render);
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }

  function render() {
    const { route, param } = parseHash();
    tabs.forEach((a) => a.classList.toggle("active", a.dataset.route === route));
    closeModal();

    if (route === "sessions") renderSessions(param);
    else if (route === "glossary") renderGlossary(param);
    else renderOverview();

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  // ---------------- Overview ----------------

  function renderOverview() {
    const stages = DATA.learningPath;
    app.innerHTML = `
      <div class="view">
        <div class="hero">
          <div class="hero-panel">
            <svg class="hero-nodes" width="220" height="200" viewBox="0 0 220 200" fill="none">
              <circle cx="170" cy="40" r="3" fill="#4EB1C2"/>
              <circle cx="140" cy="90" r="2.5" fill="#725AFF"/>
              <circle cx="195" cy="110" r="2" fill="#4EB1C2"/>
              <circle cx="155" cy="150" r="3" fill="#4EB1C2"/>
              <circle cx="200" cy="170" r="2" fill="#725AFF"/>
              <path d="M170 40 L140 90 M140 90 L195 110 M140 90 L155 150 M155 150 L200 170" stroke="#4EB1C2" stroke-width="0.75" opacity="0.6"/>
            </svg>
            <h1 class="hero-title">The OVAITY <span class="accent">BioAtlas</span></h1>
            <p class="hero-lede">Explore the language of life science. A free, continuously expanding knowledge base organised into an ${DATA.meta.stageCount}-stage path from basic biology to AI-assisted research.</p>
            <a href="#/sessions" class="hero-cta">Begin at Stage 1 &rarr;</a>
          </div>
          <div class="stat-panel">
            <div class="stat-panel-title">Workbook Summary</div>
            <div class="stat-grid">
              <div class="stat-tile accent-teal"><span class="stat-icon">${statIcon("terms")}</span><div><div class="stat-num">${DATA.meta.glossaryCount}</div><div class="stat-label">Life-science concepts</div></div></div>
              <div class="stat-tile accent-violet"><span class="stat-icon">${statIcon("methods")}</span><div><div class="stat-num">${DATA.meta.methodologyCount}</div><div class="stat-label">Methodologies</div></div></div>
              <div class="stat-tile"><span class="stat-icon">${statIcon("stages")}</span><div><div class="stat-num">${DATA.meta.stageCount}</div><div class="stat-label">Learning stages</div></div></div>
              <div class="stat-tile"><span class="stat-icon">${statIcon("essential")}</span><div><div class="stat-num">${glossary.filter((g) => g.Priority === "Essential").length}</div><div class="stat-label">Essential terms</div></div></div>
            </div>
          </div>
        </div>

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

        <div class="section-head" style="margin-top:44px;"><h2>How to use this guide</h2></div>
        <div class="howto">
          <div class="howto-item"><span class="howto-num">01</span><p>Begin with Essential + Foundation concepts in BioAtlas.</p></div>
          <div class="howto-item"><span class="howto-num">02</span><p>Filter BioAtlas by domain, priority or level as you go.</p></div>
          <div class="howto-item"><span class="howto-num">03</span><p>Work through each Session to see terms in their methodological context.</p></div>
          <div class="howto-item"><span class="howto-num">04</span><p>Use Methodologies entries to understand how evidence is actually produced.</p></div>
        </div>

        <div class="rule-of-thumb">
          &ldquo;Always ask: what was measured? In which biological system? With which controls? Using which method? Compared with what? Under which assumptions?&rdquo;
        </div>
      </div>
    `;

    app.querySelectorAll(".stage-chip").forEach((el) => {
      el.addEventListener("click", () => navigate(`/sessions/${el.dataset.stage}`));
    });
  }

  // ---------------- Sessions ----------------

  function renderSessions(param) {
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

  function methodChip(name) {
    return `<span class="chip">${escapeHtml(name)}</span>`;
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
  }

  function closeModal() {
    const backdrop = document.getElementById("modal-backdrop");
    if (backdrop) {
      if (backdrop._onKey) window.removeEventListener("keydown", backdrop._onKey);
      backdrop.remove();
      document.body.style.overflow = "";
    }
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
      ${e["Related concepts"] ? `<div class="detail-block"><div class="detail-label">Related concepts</div><div class="chip-row">${splitList(e["Related concepts"]).map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}</div></div>` : ""}
      ${e["Common confusion"] ? `<div class="detail-block"><div class="detail-label">Common confusion</div><p>${escapeHtml(e["Common confusion"])}</p></div>` : ""}
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
      ${videoResourceBlock(e)}
      ${e["Source URL"] ? `<div class="modal-source">Source &middot; <a href="${escapeHtml(e["Source URL"])}" target="_blank" rel="noopener">${escapeHtml(e["Source URL"])}</a></div>` : ""}
    `;
  }
})();
