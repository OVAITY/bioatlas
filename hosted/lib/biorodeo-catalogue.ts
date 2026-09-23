import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type CatalogueNeighbor = {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  summary: string | null;
  relationType: string;
  direction: "from" | "to";
  legacyId: string | null;
};

export type CatalogueModel = {
  slug: string;
  name: string;
  summary: string | null;
  release_date: string | null;
  model_category: string | null;
  architecture: string | null;
  openness: string | null;
  openness_score: number | null;
  usability_score: number | null;
  reproducibility_score: number | null;
  citations_count: number | null;
  license: string | null;
  github_url: string | null;
  model_url: string | null;
  paper_url: string | null;
  weights_url: string | null;
  homepage_url: string | null;
  authors: string[];
  neighbors: CatalogueNeighbor[];
};

export type CatalogueProvider = {
  slug: string;
  name: string;
  summary: string | null;
  website: string | null;
  logo: string;
  tool_kind: string;
};

type ScrapedOrg = { name?: string; url?: string };
type ScrapedProvider = { name?: string; url?: string; run_url?: string | null };
type ScrapedModel = {
  slug: string;
  url?: string;
  name: string;
  description?: string;
  categories?: string[];
  category_primary?: string;
  organizations?: ScrapedOrg[];
  authors?: string[];
  release_date?: string | null;
  openness_score?: number | null;
  openness_label?: string | null;
  usability_score?: number | null;
  reproducibility_score?: number | null;
  citations_count?: number | null;
  license?: string | null;
  paper_url?: string | null;
  code_url?: string | null;
  weights_url?: string | null;
  homepage_url?: string | null;
  providers?: ScrapedProvider[];
};

type ScrapedRunProvider = {
  slug: string;
  name: string;
  url?: string;
  description?: string;
};

const PROVIDER_META: Record<string, { website: string; logo: string }> = {
  aws: { website: "https://aws.amazon.com/", logo: "/providers/aws.svg" },
  "amazon-web-services": { website: "https://aws.amazon.com/", logo: "/providers/aws.svg" },
  "benchling-model-hub": { website: "https://www.benchling.com/", logo: "/providers/benchling.svg" },
  "google-cloud-model-garden": { website: "https://cloud.google.com/model-garden", logo: "/providers/google-cloud.svg" },
  "hugging-face": { website: "https://huggingface.co/", logo: "/providers/huggingface.svg" },
  "nvidia-bionemo": { website: "https://www.nvidia.com/en-us/clara/bionemo/", logo: "/providers/nvidia.svg" },
  "nvidia-bionemo-nim": { website: "https://www.nvidia.com/en-us/clara/bionemo/", logo: "/providers/nvidia.svg" },
  scigantic: { website: "https://www.scigantic.com/", logo: "/providers/scigantic.svg" },
  zenodo: { website: "https://zenodo.org/", logo: "/providers/zenodo.svg" },
};

function catalogueDir() {
  return path.join(process.cwd(), "data", "foundation models");
}

function readJson<T>(fileName: string): T | null {
  const fullPath = path.join(catalogueDir(), fileName);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, "utf8")) as T;
}

function slugFromUrl(url: string | undefined, fallback: string) {
  if (!url) return fallback;
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || fallback;
}

function neighbor(name: string, slug: string, entityType: string, relationType: string): CatalogueNeighbor {
  return {
    id: slug,
    slug,
    name,
    entityType,
    summary: null,
    relationType,
    direction: "from",
    legacyId: null,
  };
}

function mapOpenness(label: string | null | undefined) {
  if (!label) return null;
  return label.toLowerCase();
}

function uniqueByName<T extends { name?: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapModel(model: ScrapedModel): CatalogueModel {
  const orgs = uniqueByName(model.organizations || []);
  const providers = uniqueByName(model.providers || []);
  return {
    slug: model.slug,
    name: model.name,
    summary: model.description || null,
    release_date: model.release_date || null,
    model_category: model.category_primary || model.categories?.[0] || null,
    architecture: null,
    openness: mapOpenness(model.openness_label),
    openness_score: model.openness_score ?? null,
    usability_score: model.usability_score ?? null,
    reproducibility_score: model.reproducibility_score ?? null,
    citations_count: model.citations_count ?? null,
    license: model.license || null,
    github_url: model.code_url || null,
    model_url: model.url || null,
    paper_url: model.paper_url || null,
    weights_url: model.weights_url || null,
    homepage_url: model.homepage_url || null,
    authors: model.authors || [],
    neighbors: [
      ...orgs.map((org) => neighbor(org.name || "", slugFromUrl(org.url, org.name || ""), "organization", "developed_by")),
      ...providers.map((provider) => neighbor(
        provider.name || "",
        slugFromUrl(provider.url, provider.name || ""),
        "tool",
        "available_on",
      )),
    ],
  };
}

function mapProvider(provider: ScrapedRunProvider): CatalogueProvider {
  const meta = PROVIDER_META[provider.slug] || { website: null, logo: "/providers/generic.svg" };
  return {
    slug: provider.slug,
    name: provider.name,
    summary: provider.description || null,
    website: meta.website,
    logo: meta.logo,
    tool_kind: "platform",
  };
}

let cached: { models: CatalogueModel[]; providers: CatalogueProvider[] } | null = null;

export function loadBiorodeoCatalogue() {
  if (cached) return cached;
  const models = readJson<ScrapedModel[]>("models.json") || [];
  const providers = readJson<ScrapedRunProvider[]>("providers.json") || [];
  cached = {
    models: models.map(mapModel),
    providers: providers.map(mapProvider),
  };
  return cached;
}

export function hasBiorodeoCatalogue() {
  return existsSync(path.join(catalogueDir(), "models.json"));
}

export function biorodeoSource(modelCount = 0) {
  const count = modelCount || loadBiorodeoCatalogue().models.length;
  return {
    name: "bio.rodeo",
    url: "https://bio.rodeo/",
    modelsUrl: "https://bio.rodeo/models",
    providersUrl: "https://bio.rodeo/providers",
    blurb: `bio.rodeo tracks ${count.toLocaleString()} biological foundation models, ranked and scored for openness. BioAtlas lists that catalogue here, with links back to the source.`,
  };
}

export function providerLogo(slug: string | null | undefined) {
  if (!slug) return "/providers/generic.svg";
  return PROVIDER_META[slug]?.logo || "/providers/generic.svg";
}
