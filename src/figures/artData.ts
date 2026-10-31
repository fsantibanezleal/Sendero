/**
 * The silhouette drawings as data (no Skia): which drawings exist per archetype and view. The visit planner
 * and the tests use this module; `art.ts` turns a drawing into a Skia path.
 */
import type { HumanKind, PetKind } from './catalog';

export type ArtView = 'walk' | 'stand' | 'sit';

/** Where the body is in a drawing, measured by the pipeline, in figure units (height 1, feet at y = 0). */
export interface PersonAnchors {
  head: { x: number; y: number; r: number };
  neck: { x: number; y: number; w: number };
  shoulder: { x: number; y: number; w: number };
  waist: { x: number; y: number; w: number };
  /** Height of the skirt's or coat's hem when the figure ends wide, or null. */
  hemY: number | null;
  /** How much of the head lies ahead of its centre: near 0 is a frontal face, higher a profile. */
  bias: number;
}

export interface PetAnchors {
  head: { x: number; y: number; r: number };
  body: { x: number; y: number };
}

export interface ArtEntry {
  id: string;
  archetype: HumanKind | PetKind;
  view: ArtView;
  /** Width over height of the figure. */
  aspect: number;
  anchors: PersonAnchors | PetAnchors;
  parts: { d: string; evenodd: boolean }[];
  source: string;
  author: string;
  licence: string;
  notes: string;
}

// Metro bundles the JSON with the app (generated; never edited by hand).
export const ART: readonly ArtEntry[] = require('../../assets/silhouettes/silhouettes.json');

const BY_ID = new Map(ART.map((a) => [a.id, a]));

/** The drawings of one archetype in one view (falls back to every view of that archetype). */
export function artOf(archetype: HumanKind | PetKind, view: ArtView): ArtEntry[] {
  const exact = ART.filter((a) => a.archetype === archetype && a.view === view);
  return exact.length > 0 ? exact : ART.filter((a) => a.archetype === archetype);
}

export function artById(id: string): ArtEntry | undefined {
  return BY_ID.get(id);
}

