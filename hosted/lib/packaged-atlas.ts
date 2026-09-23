import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { hasBiorodeoCatalogue, loadBiorodeoCatalogue } from "./biorodeo-catalogue";
import { structureCardsFromFile } from "./structures-catalogue";

export type PackagedAtlas = {
  glossary: unknown[];
  methodologies: unknown[];
  learningPath: unknown[];
  sources: unknown[];
  recentEvents: unknown[];
  meta: {
    glossaryCount: number;
    methodologyCount: number;
    stageCount: number;
    modelCount: number;
    collectionCount: number;
    eventCount: number;
  };
};

type WindowData = {
  glossary?: unknown[];
  methodologies?: unknown[];
  learningPath?: unknown[];
  sources?: unknown[];
  meta?: {
    glossaryCount?: number;
    methodologyCount?: number;
    stageCount?: number;
  };
};

const cache = globalThis as unknown as {
  __bioatlasPackagedAtlas?: PackagedAtlas;
  __bioatlasPackagedVideos?: Record<string, unknown>;
};

function resolvePublicData(fileName: "data.js" | "videos.js") {
  const candidates = {
    "data.js": [
      path.join(process.cwd(), "public/data/data.js"),
      path.join(process.cwd(), "hosted/public/data/data.js"),
    ],
    "videos.js": [
      path.join(process.cwd(), "public/data/videos.js"),
      path.join(process.cwd(), "hosted/public/data/videos.js"),
    ],
  }[fileName];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Packaged data file not found: ${fileName}`);
  }
  return found;
}

export function parseWindowAssign(source: string, name: string) {
  const marker = `window.${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing window.${name} assignment`);
  }
  let json = source.slice(start + marker.length).trim();
  if (json.endsWith(";")) json = json.slice(0, -1);
  return JSON.parse(json);
}

export function getPackagedAtlas(): PackagedAtlas {
  if (cache.__bioatlasPackagedAtlas) return cache.__bioatlasPackagedAtlas;
  const data = parseWindowAssign(readFileSync(resolvePublicData("data.js"), "utf8"), "DATA") as WindowData;
  const glossary = data.glossary || [];
  const methodologies = data.methodologies || [];
  const learningPath = data.learningPath || [];
  const sources = data.sources || [];
  cache.__bioatlasPackagedAtlas = {
    glossary,
    methodologies,
    learningPath,
    sources,
    recentEvents: [],
    meta: {
      glossaryCount: data.meta?.glossaryCount ?? glossary.length,
      methodologyCount: data.meta?.methodologyCount ?? methodologies.length,
      stageCount: data.meta?.stageCount ?? learningPath.length,
      modelCount: hasBiorodeoCatalogue() ? loadBiorodeoCatalogue().models.length : 0,
      collectionCount: structureCardsFromFile().length,
      eventCount: 0,
    },
  };
  return cache.__bioatlasPackagedAtlas;
}

export function getPackagedVideos() {
  if (cache.__bioatlasPackagedVideos) return cache.__bioatlasPackagedVideos;
  cache.__bioatlasPackagedVideos = parseWindowAssign(
    readFileSync(resolvePublicData("videos.js"), "utf8"),
    "VIDEOS",
  ) as Record<string, unknown>;
  return cache.__bioatlasPackagedVideos;
}
