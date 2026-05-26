import { scoreResumeWithEnhancement } from "@resumetruth/scoring";
import { prisma } from "../../../../lib/db";
import { sha256 } from "../../../../lib/hash";
import { extractPdfText, guessCandidateName, looksLikePdf } from "../../../../lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;

interface BatchItem {
  filename: string;
  ok: boolean;
  error?: string;
  scoreId?: string;
  candidateName?: string;
  authenticity?: number;
  verifiability?: number;
  interview?: number;
  pageCount?: number;
  charCount?: number;
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const jobDescription = (form.get("jobDescription") as string | null) ?? "";
  const enhance = (form.get("enhance") as string | null) === "true";
  const verify = (form.get("verify") as string | null) === "true";

  const fileEntries = form.getAll("files").filter((v): v is File => v instanceof File);
  if (fileEntries.length === 0) {
    return Response.json({ error: "No files uploaded (field name: 'files')" }, { status: 400 });
  }
  if (fileEntries.length > MAX_FILES) {
    return Response.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 413 },
    );
  }

  const results = await Promise.all(
    fileEntries.map(async (file): Promise<BatchItem> => {
      if (file.size > MAX_BYTES_PER_FILE) {
        return {
          filename: file.name,
          ok: false,
          error: `Too large (${(file.size / 1_048_576).toFixed(1)} MB > 5 MB)`,
        };
      }
      try {
        const buf = await file.arrayBuffer();
        if (!looksLikePdf(buf)) {
          return { filename: file.name, ok: false, error: "Not a PDF (missing %PDF- header)" };
        }
        const { text, pageCount, charCount } = await extractPdfText(buf);
        if (text.length < 50) {
          return {
            filename: file.name,
            ok: false,
            error: `Extracted only ${charCount} chars — scanned PDF? Run OCR first.`,
            pageCount,
            charCount,
          };
        }
        const candidateName = guessCandidateName(text, file.name);
        const scored = await scoreResumeWithEnhancement({
          resumeText: text,
          candidateName,
          jobDescription: jobDescription || undefined,
          enhance,
          verify,
        });
        const saved = await prisma.score.create({
          data: {
            candidateName,
            candidateHash: sha256(text),
            authenticity: scored.authenticity,
            verifiability: scored.verifiability,
            interview: scored.interview,
            summary: scored.summary,
            jobDescription: jobDescription || null,
            enhancementJson: scored.enhancement ? JSON.stringify(scored.enhancement) : null,
            verificationJson: scored.verification ? JSON.stringify(scored.verification) : null,
            skillsJson: scored.extractedSkills ? JSON.stringify(scored.extractedSkills) : null,
            panelJson: scored.expertPanel ? JSON.stringify(scored.expertPanel) : null,
            signals: {
              create: scored.signals.map((s) => ({
                signalId: s.id,
                label: s.label,
                dimension: s.dimension,
                weight: s.weight,
                value: s.score,
                impact: s.impact,
                explanation: s.explanation,
              })),
            },
          },
        });
        return {
          filename: file.name,
          ok: true,
          scoreId: saved.id,
          candidateName,
          authenticity: scored.authenticity,
          verifiability: scored.verifiability,
          interview: scored.interview,
          pageCount,
          charCount,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[batch] ${file.name} failed:`, msg);
        return { filename: file.name, ok: false, error: msg };
      }
    }),
  );

  // Default ranking: descending by interview score, push errors to bottom
  results.sort((a, b) => {
    if (a.ok && !b.ok) return -1;
    if (!a.ok && b.ok) return 1;
    return (b.interview ?? 0) - (a.interview ?? 0);
  });

  const okCount = results.filter((r) => r.ok).length;
  return Response.json({
    total: results.length,
    succeeded: okCount,
    failed: results.length - okCount,
    items: results,
  });
}
