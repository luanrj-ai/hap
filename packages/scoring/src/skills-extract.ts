import { z } from "zod";
import type { ExtractedSkills } from "@resumetruth/shared";
import { activeModel, activeProvider, callLLMJson } from "./llm-client";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "skills", "yearsExperience", "seniority", "currentTitle", "currentCompany",
    "pastCompanies", "education", "specializations", "ossArtifacts", "publicTalks",
  ],
  properties: {
    skills: {
      type: "array",
      items: { type: "string" },
      description:
        "Normalized skill names. Prefer canonical form (e.g., 'Go' not 'golang', 'PostgreSQL' not 'postgres'). Include languages, frameworks, infra, domain expertise.",
      maxItems: 30,
    },
    yearsExperience: {
      type: ["integer", "null"],
      description: "Total years of full-time engineering experience. Null if unclear.",
    },
    seniority: {
      type: "string",
      enum: ["junior", "mid", "senior", "staff", "principal", "unknown"],
    },
    currentTitle: { type: ["string", "null"] },
    currentCompany: { type: ["string", "null"] },
    pastCompanies: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["degree", "school", "year"],
        properties: {
          degree: { type: "string" },
          school: { type: "string" },
          year: { type: ["integer", "null"] },
        },
      },
      maxItems: 5,
    },
    specializations: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
      description: "Domain or problem areas (e.g., 'payments', 'idempotency', 'high-throughput APIs', 'recommendation systems').",
    },
    ossArtifacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "stars"],
        properties: {
          name: { type: "string" },
          stars: { type: ["integer", "null"] },
        },
      },
      maxItems: 6,
    },
    publicTalks: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
      description: "Conference talks / podcast appearances / public technical writing (with venue + title when available).",
    },
  },
};

const SYSTEM = `You extract structured data from an engineering resume.

Output STRICTLY what is in the resume — do NOT invent skills, years, or companies. If something is not in the resume, use null or [].

Normalization rules:
- Skill names: canonical form. "golang" → "Go". "JS" → "JavaScript". "postgres" → "PostgreSQL".
- Seniority: infer from title + years. Junior < 3 years; mid 3-5; senior 5-9; staff 8-12; principal 12+.
- yearsExperience: total full-time experience. Exclude internships unless >12 months.
- Specializations: domain or problem areas, NOT skills. "payments", "ML ranking", "distributed transactions". Skip generic terms like "software development".

Output JSON only.`;

const ExtractedSkillsZ = z.object({
  skills: z.array(z.string()),
  yearsExperience: z.number().int().nullable(),
  seniority: z.enum(["junior", "mid", "senior", "staff", "principal", "unknown"]),
  currentTitle: z.string().nullable(),
  currentCompany: z.string().nullable(),
  pastCompanies: z.array(z.string()),
  education: z.array(z.object({ degree: z.string(), school: z.string(), year: z.number().int().nullable() })),
  specializations: z.array(z.string()),
  ossArtifacts: z.array(z.object({ name: z.string(), stars: z.number().int().nullable() })),
  publicTalks: z.array(z.string()),
});

export async function extractSkills(resumeText: string): Promise<ExtractedSkills | null> {
  if (!activeProvider()) return null;

  const parsed = await callLLMJson<unknown>({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Extract structured data from this resume:\n\n${resumeText.slice(0, 20_000)}` },
    ],
    schema: SCHEMA,
    schemaName: "extracted_skills",
    maxTokens: 1200,
  });

  if (!parsed) return null;
  const safe = ExtractedSkillsZ.safeParse(parsed);
  if (!safe.success) {
    console.warn("[skills-extract] schema mismatch:", safe.error.message);
    return null;
  }

  return {
    ...safe.data,
    extractedAt: new Date().toISOString(),
    model: activeModel(),
  };
}
