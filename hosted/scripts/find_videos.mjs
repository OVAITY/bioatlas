import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DATA_ROOT = path.join(ROOT, "public", "data");
const REVIEW_DATA_ROOT = path.join(ROOT, "data");
const DATA_PATH = path.join(PUBLIC_DATA_ROOT, "data.js");
const VIDEOS_PATH = path.join(PUBLIC_DATA_ROOT, "videos.js");
const REPORT_PATH = path.join(REVIEW_DATA_ROOT, "video-review.json");
const CHECKPOINT_PATH = path.join(REVIEW_DATA_ROOT, ".video-search-checkpoint.json");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const [key, value = "true"] = process.argv[i].split("=");
  args.set(key, value);
}
const limit = Number(args.get("--limit") || Infinity);
const delayMs = Number(args.get("--delay-ms") || 650);
const concurrency = Math.max(1, Math.min(6, Number(args.get("--concurrency") || 1)));

const TRUSTED_CHANNELS = [
  "khan academy", "crashcourse", "stated clearly", "statquest", "osmosis",
  "national cancer institute", "national human genome research institute",
  "national institutes of health", "nih", "illumina", "10x genomics",
  "thermo fisher scientific", "embl-ebi", "ebi training", "ncbi",
  "broad institute", "addgene", "ibiology", "hhmi biointeractive",
  "bozeman science", "labxchange", "bio-rad", "nature video",
  "ibm technology", "mit opencourseware", "stanford", "harvard",
  "oxford nanopore technologies", "pacbio", "qiagen", "agilent",
  "graphpad software", "deepmind", "nvidia", "microsoft research",
];

const CONTEXT_WORDS = new Set([
  "biology", "biological", "cell", "cells", "dna", "rna", "gene", "genetic",
  "genome", "genomics", "protein", "molecular", "laboratory", "clinical",
  "trial", "drug", "pharma", "research", "bioinformatics", "sequencing",
  "statistics", "statistical", "data", "machine", "learning", "ai",
]);

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of",
  "on", "or", "the", "to", "using", "with", "analysis", "method",
]);

const NEGATIVE_TITLE_WORDS = [
  "song", "lyrics", "movie", "trailer", "podcast", "reaction", "news live",
  "gaming", "gameplay", "shorts", "#shorts", "asmr", "meme",
];

// Results that pass lexical checks but teach a different domain or only discuss
// a narrow case without explaining the glossary concept itself.
const MANUAL_REJECTIONS = {
  "term-70": "Enhancer trapping is a specific technique, not an introduction to enhancers",
  "term-93": "Peptide mass fingerprinting does not explain the peptide concept",
  "term-102": "Product-focused webinar rather than a binding-affinity explanation",
  "term-177": "Automotive vehicle-control result; wrong domain",
  "term-198": "Standard deviation is not a laboratory protocol deviation",
  "term-199": "AI commentary rather than a chain-of-custody explanation",
  "term-219": "Product promotion rather than an RNA-therapeutics explanation",
  "term-238": "Industry monitoring discussion rather than a predictive-biomarker explanation",
  "term-239": "Single research example rather than a prognostic-biomarker explanation",
  "term-250": "Site-selection case study rather than a first-in-human study explanation",
  "term-263": "Trial results rather than an open-label study explanation",
  "term-274": "Clinical data-management lecture rather than a CTMS explanation",
  "term-284": "Excel validation tutorial; wrong domain",
  "term-313": "Entertainment-oriented prompt challenge rather than a prompt explanation",
  "term-316": "Research workshop on spatial grounding rather than LLM grounding",
  "term-320": "Model distillation example rather than model-training fundamentals",
  "term-323": "Infrastructure talk rather than an inference explanation",
  "term-329": "Specialist research seminar rather than generalization fundamentals",
  "term-333": "Unclear low-quality baseline-model explanation",
  "term-335": "Research-paper presentation rather than dataset-shift fundamentals",
  "term-338": "Vendor model announcement rather than a multimodal-model explanation",
  "term-339": "Opinion/hype video rather than a scientific-agent explanation",
  "method-17": "Disease-specific study rather than a single-nucleus RNA-seq method overview",
  "method-31": "Incomplete webinar result rather than an LC-MS/MS explanation",
};

function loadScript(file, additions = "") {
  return fs.readFile(file, "utf8").then((source) => {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(`${source}\n${additions}`, context);
    return context;
  });
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function conceptTokens(name) {
  return normalize(name).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function decodeJsonText(value) {
  try { return JSON.parse(`"${value}"`); } catch { return value; }
}

function parseSearchResults(html) {
  return html.split('"videoRenderer":').slice(1, 13).map((chunk) => {
    const block = chunk.slice(0, 7000);
    const videoId = block.match(/^\{"videoId":"([\w-]{11})"/)?.[1];
    const rawTitle = block.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/)?.[1];
    const rawChannel = block.match(/"(?:ownerText|longBylineText)":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/)?.[1];
    if (!videoId || !rawTitle) return null;
    return {
      videoId,
      title: decodeJsonText(rawTitle),
      channel: rawChannel ? decodeJsonText(rawChannel) : "YouTube",
    };
  }).filter(Boolean);
}

function scoreCandidate(entry, candidate) {
  const name = entry.kind === "term" ? entry.Term : entry.Methodology;
  const title = normalize(candidate.title);
  const channel = normalize(candidate.channel);
  const nameNormalized = normalize(name);
  const tokens = conceptTokens(name);
  const titleWords = new Set(title.split(" "));
  const matched = tokens.filter((token) => titleWords.has(token) || titleWords.has(`${token}s`) || (token.endsWith("s") && titleWords.has(token.slice(0, -1))));
  const coverage = tokens.length ? matched.length / tokens.length : 0;
  const exact = new RegExp(`(^| )${nameNormalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s)?( |$)`).test(title);
  const trusted = TRUSTED_CHANNELS.some((trustedChannel) => channel.includes(trustedChannel));
  const hasContext = [...CONTEXT_WORDS].some((word) => title.includes(word));
  const negative = NEGATIVE_TITLE_WORDS.some((word) => title.includes(word));

  let score = coverage * 7;
  if (exact) score += 7;
  if (trusted) score += 5;
  if (hasContext) score += 1.5;
  if (negative) score -= 12;
  const educationalIntent = /\b(explained|introduction|basics|overview|tutorial|what|why|how|where|step by step|crash course)\b/.test(title);
  if (educationalIntent) score += 1.5;

  const singleWord = tokens.length === 1;
  const token = tokens[0] || "";
  const singleTopicIntent = !singleWord || new RegExp(
    `(^${token}s?\\b|what (?:is|are) (?:an? |the )?${token}s?\\b|(?:why|how|where) (?:is|are|do|does|did|can) (?:an? |the )?${token}s?\\b|types? of ${token}s?\\b|introduction to (?:the )?${token}s?\\b|${token}s? (?:explained|basics|overview|tutorial)\\b)`,
  ).test(title);
  const acceptable = !negative && coverage >= 0.75 && score >= 9 && singleTopicIntent && (!singleWord || trusted || (exact && educationalIntent));
  return { score, acceptable, coverage, exact, trusted };
}

function buildQuery(entry) {
  if (entry.kind === "term") {
    return `"${entry.Term}" ${entry.Domain || "life science"} explained`;
  }
  return `"${entry.Methodology}" ${entry.Category || "life science"} tutorial`;
}

async function searchYouTube(query) {
  if (!searchYouTube.config) {
    const bootstrap = await fetch("https://www.youtube.com/", {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
      },
    });
    const bootstrapText = await bootstrap.text();
    const apiKey = bootstrapText.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const clientVersion = bootstrapText.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
    if (!apiKey || !clientVersion) throw new Error("Could not initialize YouTube search");
    searchYouTube.config = { apiKey, clientVersion };
  }
  const { apiKey, clientVersion } = searchYouTube.config;
  const url = `https://www.youtube.com/youtubei/v1/search?key=${encodeURIComponent(apiKey)}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36",
        },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion, hl: "en", gl: "US" } },
          query,
        }),
      });
      if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
      return parseSearchResults(JSON.stringify(await response.json()));
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    }
  }
  throw lastError;
}

function serializeVideos(videos) {
  const sorted = Object.fromEntries(Object.entries(videos).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
  return `// Curated YouTube lessons, keyed by "<kind>-<ID>" (e.g. "term-1").\n` +
    `// Generated candidates are accepted only when the title closely matches the concept.\n` +
    `// Entries without a suitable lesson fall back to a YouTube search link in the app.\n` +
    `window.VIDEOS = ${JSON.stringify(sorted, null, 2)};\n`;
}

const dataContext = await loadScript(DATA_PATH);
const videoContext = await loadScript(VIDEOS_PATH);
const DATA = dataContext.window.DATA;
const existingVideos = videoContext.window.VIDEOS || {};

let checkpoint = { completed: {}, accepted: {}, rejected: {} };
try { checkpoint = JSON.parse(await fs.readFile(CHECKPOINT_PATH, "utf8")); } catch {}

const entries = [
  ...DATA.glossary.map((entry) => ({ ...entry, kind: "term" })),
  ...DATA.methodologies.map((entry) => ({ ...entry, kind: "method" })),
];

for (const [key, saved] of Object.entries(checkpoint.accepted)) {
  const entry = entries.find((candidate) => `${candidate.kind}-${candidate.ID}` === key);
  if (!entry) continue;
  const candidate = {
    videoId: saved.videoUrl.split("v=")[1] || "",
    title: saved.videoTitle,
    channel: saved.channel,
  };
  if (!scoreCandidate(entry, candidate).acceptable) {
    delete checkpoint.accepted[key];
    delete checkpoint.completed[key];
    delete existingVideos[key];
    console.log(`RECHECK ${key}: previous candidate no longer passes the stricter filter`);
  }
}

for (const [key, reason] of Object.entries(MANUAL_REJECTIONS)) {
  const entry = entries.find((candidate) => `${candidate.kind}-${candidate.ID}` === key);
  if (!entry) continue;
  delete checkpoint.accepted[key];
  delete existingVideos[key];
  checkpoint.completed[key] = true;
  checkpoint.rejected[key] = {
    name: entry.kind === "term" ? entry.Term : entry.Methodology,
    query: buildQuery(entry),
    reason,
    topCandidates: [],
  };
}

async function reviewEntry(entry) {
  const key = `${entry.kind}-${entry.ID}`;
  const name = entry.kind === "term" ? entry.Term : entry.Methodology;
  const query = buildQuery(entry);
  try {
    const candidates = await searchYouTube(query);
    const ranked = candidates
      .map((candidate) => ({ ...candidate, ...scoreCandidate(entry, candidate) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked.find((candidate) => candidate.acceptable);
    if (best) {
      return { key, accepted: {
        videoTitle: best.title,
        videoUrl: `https://www.youtube.com/watch?v=${best.videoId}`,
        channel: best.channel,
        score: Number(best.score.toFixed(2)),
        query,
      }, log: `ACCEPT ${key} ${name} -> ${best.title} (${best.channel})` };
    } else {
      return { key, rejected: {
        name,
        query,
        reason: ranked.length ? "No result passed the relevance threshold" : "No video results found",
        topCandidates: ranked.slice(0, 3).map(({ title, channel, videoId, score, coverage }) => ({
          title, channel, videoId, score: Number(score.toFixed(2)), coverage,
        })),
      }, log: `SKIP   ${key} ${name}` };
    }
  } catch (error) {
    return { key, error, log: `ERROR  ${key} ${name}: ${error.message}` };
  }
}

const pendingEntries = entries
  .filter((entry) => {
    const key = `${entry.kind}-${entry.ID}`;
    return !existingVideos[key] && !checkpoint.completed[key];
  })
  .slice(0, limit);

let stop = false;
for (let index = 0; index < pendingEntries.length && !stop; index += concurrency) {
  const batch = pendingEntries.slice(index, index + concurrency);
  const results = await Promise.all(batch.map(reviewEntry));
  for (const result of results) {
    console.log(result.log);
    if (result.error) {
      if (/429|403/.test(result.error.message)) stop = true;
      continue;
    }
    if (result.accepted) checkpoint.accepted[result.key] = result.accepted;
    if (result.rejected) checkpoint.rejected[result.key] = result.rejected;
    checkpoint.completed[result.key] = true;
  }
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
}
if (stop) console.error("YouTube is temporarily refusing searches; stopped safely at the last checkpoint.");

const merged = { ...existingVideos };
for (const [key, value] of Object.entries(checkpoint.accepted)) {
  const { videoTitle, videoUrl, channel } = value;
  merged[key] = { videoTitle, videoUrl, channel };
}

await fs.writeFile(VIDEOS_PATH, serializeVideos(merged));
await fs.writeFile(REPORT_PATH, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totals: {
    entries: entries.length,
    videos: Object.keys(merged).length,
    searched: Object.keys(checkpoint.completed).length,
    accepted: Object.keys(checkpoint.accepted).length,
    rejected: Object.keys(checkpoint.rejected).length,
  },
  accepted: checkpoint.accepted,
  rejected: checkpoint.rejected,
}, null, 2));

console.log(`Saved ${Object.keys(merged).length} video links; ${Object.keys(checkpoint.completed).length}/${entries.length} entries searched.`);
