import { extractText, getDocumentProxy } from "unpdf";

export interface PDFExtraction {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PDFExtraction> {
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8);
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  return {
    text: text.trim(),
    pageCount: result.totalPages,
    charCount: text.length,
  };
}

export function looksLikePdf(buffer: ArrayBuffer): boolean {
  // PDF starts with %PDF-
  if (buffer.byteLength < 5) return false;
  const head = new Uint8Array(buffer.slice(0, 5));
  return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
}

export function guessCandidateName(text: string, filename: string): string {
  // PDF extraction often concatenates the visual layout into one long stream
  // without preserving newlines. Look for a name pattern at the very start.
  const head = text.slice(0, 120).trim();

  // Chinese name at the very start: 2–4 hanzi, then space or punct
  const cn = head.match(/^([一-龥]{2,4})(?=\s|[，,。.|])/);
  if (cn) return cn[1];

  // Western name: take 2 cap-initial tokens at the start, optionally a 3rd
  // if it's also a name-shaped token AND not a role/title keyword (the most
  // common false positive — "Alex Chen Senior Backend Engineer").
  const STOP_TOKENS = new Set([
    "Senior", "Junior", "Lead", "Principal", "Staff", "Chief",
    "Software", "Engineer", "Developer", "Designer", "Manager", "Director",
    "Analyst", "Scientist", "Specialist", "Consultant", "Architect",
    "Founder", "President", "Backend", "Frontend", "Fullstack", "Full-Stack",
    "Mobile", "Data", "Product", "Marketing", "Sales", "Operations",
    "PROFESSIONAL", "EXPERIENCE", "EDUCATION", "SUMMARY", "SKILLS",
    "OBJECTIVE", "RESUME", "CV", "CONTACT", "ABOUT",
  ]);
  // Hyphenated buzzword adjectives ("Results-driven", "Customer-focused", etc.)
  // are NOT names — they're descriptive openers, often in AI-generated summaries.
  const isBuzzword = (t: string) =>
    /-(driven|oriented|focused|minded|based|first|tier|loving|hating|seeking)$/i.test(t);

  const tokenRe = /^([A-Z][a-zA-ZÀ-ſ.'-]{1,30})\s+([A-Z][a-zA-ZÀ-ſ.'-]{1,30})(?:\s+([A-Z][a-zA-ZÀ-ſ.'-]{1,30}))?/;
  const m = head.match(tokenRe);
  if (m) {
    const [, a, b, c] = m;
    const stop = (t: string) => STOP_TOKENS.has(t) || isBuzzword(t);
    if (!stop(a) && !stop(b)) {
      if (c && !stop(c)) return `${a} ${b} ${c}`;
      return `${a} ${b}`;
    }
  }

  // Fall back to filename without extension
  return filename.replace(/\.[^./\\]+$/, "").replace(/[_\-]+/g, " ").trim() || "未命名候选人";
}
