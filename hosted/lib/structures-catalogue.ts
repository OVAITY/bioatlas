import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BIOLOGICAL_SCALES,
  STRUCTURE_JOURNEYS,
  STRUCTURE_SPECIES,
  enrichStructureRecord,
} from "./structures-atlas";

export const STRUCTURE_SCALES = BIOLOGICAL_SCALES.map((scale) => scale.id);

export type StructureCard = {
  slug: string;
  name: string;
  summary: string;
  scale: string;
  scales: string[];
  access: string;
  media_kind: string;
  website: string;
  is_hub: boolean;
  best_for: string;
  resource_types: string[];
  modalities: string[];
  data_types: string[];
  capabilities: string[];
  tags: string[];
  species: string[];
  related_resources: string[];
  related_models: string[];
  learning_topics: string[];
};

type FileOrganization = {
  slug: string;
  name: string;
  orgKind: string;
  website: string;
  summary: string;
};

type FileCollection = {
  slug: string;
  name: string;
  summary: string;
  scale: string;
  access: string;
  mediaKind: string;
  website: string;
  isHub?: boolean;
  organizations?: string[];
  methods?: string[];
};

export type StructureCatalogueFile = {
  organizations: FileOrganization[];
  collections: FileCollection[];
};

export function structureCataloguePath() {
  return path.join(process.cwd(), "data/structures/collections.json");
}

export function loadStructureCatalogueFile(): StructureCatalogueFile {
  return JSON.parse(readFileSync(structureCataloguePath(), "utf8")) as StructureCatalogueFile;
}

export function structureCardsFromFile(): StructureCard[] {
  return loadStructureCatalogueFile().collections.map((row) => {
    const atlas = enrichStructureRecord(row);
    return {
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      scale: atlas.scale,
      scales: atlas.scales,
      access: row.access,
      media_kind: row.mediaKind,
      website: row.website,
      is_hub: Boolean(row.isHub),
      best_for: atlas.bestFor,
      resource_types: atlas.resourceTypes,
      modalities: atlas.modalities,
      data_types: atlas.dataTypes,
      capabilities: atlas.capabilities,
      tags: atlas.tags,
      species: atlas.species,
      related_resources: atlas.relatedResources,
      related_models: atlas.relatedModels,
      learning_topics: atlas.learningTopics,
    };
  });
}

export function structureAtlasMeta() {
  return {
    scales: BIOLOGICAL_SCALES,
    journeys: STRUCTURE_JOURNEYS,
    species: STRUCTURE_SPECIES,
  };
}
