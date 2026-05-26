/**
 * Curated list of public GitHub users with substantive Profile READMEs
 * (≥ 500 chars after markdown stripping). Probed manually 2026-05-25.
 *
 * These are real-human-authored documents about real engineers. Suitable
 * for ground-truth evaluation of our AI-text detector and jd-match signals.
 *
 * Caveat: these are Profile READMEs / about pages, NOT full resumes. So
 * the document format differs from the AI fixtures (which are resume-style).
 * Report this honestly in the eval write-up.
 */

import type { FitBand, JobKey } from "./fixtures";

export interface RealSource {
  username: string;
  primaryRole: "backend" | "frontend" | "data-ml" | "infra" | "general";
  expectedFit: Record<JobKey, FitBand>;
  notes?: string;
}

const BE_GENERAL = {
  paymentsBackend: "MED",
  seniorFrontend: "LOW",
  dataEngineer: "LOW",
} as const;
const FE_PRIMARY = {
  paymentsBackend: "LOW",
  seniorFrontend: "HIGH",
  dataEngineer: "LOW",
} as const;
const DATA_ML_PRIMARY = {
  paymentsBackend: "MED",
  seniorFrontend: "LOW",
  dataEngineer: "HIGH",
} as const;
const INFRA_PRIMARY = {
  paymentsBackend: "MED",
  seniorFrontend: "LOW",
  dataEngineer: "LOW",
} as const;
const MOBILE_OR_OTHER = {
  paymentsBackend: "LOW",
  seniorFrontend: "MED",
  dataEngineer: "LOW",
} as const;
const GENERAL = {
  paymentsBackend: "LOW",
  seniorFrontend: "MED",
  dataEngineer: "LOW",
} as const;

export const REAL_SOURCES: RealSource[] = [
  // ===== Frontend / DX (10) =====
  { username: "swyxio", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Shawn Wang, AI engineer/DX (formerly Netlify/Temporal)" },
  { username: "sw-yx", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Shawn Wang alt handle" },
  { username: "mxstbr", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Max Stoiber, styled-components/Bedrock" },
  { username: "bahmutov", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Gleb Bahmutov, ex-Cypress" },
  { username: "danielroe", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Daniel Roe, Nuxt lead" },
  { username: "ai", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Andrey Sitnik, PostCSS/Logux" },
  { username: "trevorblades", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Trevor Blades, ex-Apollo" },
  { username: "cassidoo", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Cassidy Williams" },
  { username: "anuraghazra", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Anurag Hazra, github-readme-stats" },
  { username: "ericclemmons", primaryRole: "frontend", expectedFit: FE_PRIMARY, notes: "Eric Clemmons (Node/frontend)" },

  // ===== Backend / Infra (5) =====
  { username: "willmcgugan", primaryRole: "backend", expectedFit: BE_GENERAL, notes: "Will McGugan, Textual/Rich" },
  { username: "tonsky", primaryRole: "backend", expectedFit: BE_GENERAL, notes: "Nikita Prokopov, Clojure/JVM" },
  { username: "wolfeidau", primaryRole: "infra", expectedFit: INFRA_PRIMARY, notes: "Mark Wolfe, Go/AWS" },
  { username: "bnb", primaryRole: "backend", expectedFit: BE_GENERAL, notes: "Tierney Cyren, ex-Node.js TSC" },
  { username: "jacobwgillespie", primaryRole: "backend", expectedFit: BE_GENERAL, notes: "Jacob W Gillespie" },

  // ===== Data / ML (1 — only confirmed real) =====
  { username: "rasbt", primaryRole: "data-ml", expectedFit: DATA_ML_PRIMARY, notes: "Sebastian Raschka, ML educator" },

  // ===== Mobile / General / Educators (6) — varied fit =====
  { username: "chrisbanes", primaryRole: "general", expectedFit: MOBILE_OR_OTHER, notes: "Chris Banes, Android/Compose" },
  { username: "DenverCoder1", primaryRole: "general", expectedFit: GENERAL, notes: "Jonah Lawrence, very active" },
  { username: "codingstella", primaryRole: "general", expectedFit: GENERAL },
  { username: "codeSTACKr", primaryRole: "general", expectedFit: GENERAL, notes: "FE/DX educator" },
  { username: "Asabeneh", primaryRole: "general", expectedFit: GENERAL, notes: "30 Days Of Python/JS author" },
  { username: "iuricode", primaryRole: "general", expectedFit: GENERAL },
];
