/**
 * Quick helper to generate two test PDFs for verifying the batch flow.
 * Run: cd apps/web && npx tsx scripts/make-test-pdfs.ts
 * Writes to: apps/web/test-fixtures/{real,ai}-candidate.pdf
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../test-fixtures");

const REAL = `Alex Chen
Senior Backend Engineer - San Francisco
alex@example.com | github.com/alex-chen | alex-chen.dev | linkedin.com/in/alexchen

EXPERIENCE
Stripe - Senior Backend Engineer (Jan 2022 - Present)
- Led migration of payment routing from Ruby to Go, cut p99 from 340ms to 110ms
  across 18M daily requests
- Designed idempotency key system used by 2,400+ merchants; reduced double-charges by 94%
- Mentored 3 junior engineers, two promoted to L4 within 12 months

Notion - Backend Engineer (Mar 2019 - Dec 2021)
- Built real-time collab editing backend for 850k concurrent users at peak
- Authored operational transforms internal RFC adopted across 4 teams

Coinbase - Software Engineer (Jul 2016 - Feb 2019)
- Implemented order-matching engine extensions handling $400M+ daily volume

OPEN SOURCE
- Maintainer of ratelimit-go (1.2k stars) and pgbouncer-helm (480 stars)
- Talk at GopherCon 2024: Designing Idempotent Payment APIs

EDUCATION
Carnegie Mellon University, BS Computer Science (2012-2016)`;

const AI = `John Smith
Results-driven Senior Software Engineer

PROFESSIONAL SUMMARY
A results-driven professional with a proven track record of delivering impactful
solutions in today fast-paced ever-evolving landscape. Passionate about leveraging
cutting-edge technologies to drive meaningful results through cross-functional
collaboration and stakeholder engagement.

EXPERIENCE
Senior Software Engineer at TechCorp 2021-Present
- Spearheaded innovative solutions to leverage robust frameworks for best-in-class results
- Orchestrated cross-functional initiatives to spearhead transformative outcomes
- Pioneered actionable insights to revolutionize digital transformation journey
- Championed strategic initiatives to architect scalable solutions for global stakeholders
- Transformed legacy systems through extensive experience in modern cloud architectures

Software Engineer at DataSolutions 2018-2021
- Spearheaded data-driven decision making to deliver impactful business outcomes
- Leveraged advanced analytics to drive meaningful results across multiple verticals
- Demonstrated ability to architect robust solutions in cross-functional environments

EDUCATION
State University, Computer Science Degree`;

async function makePdf(text: string, outName: string): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  let y = 750;
  for (const line of text.split("\n")) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 14;
    if (y < 50) break;
  }
  const bytes = await pdf.save();
  writeFileSync(resolve(OUT_DIR, outName), bytes);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  await makePdf(REAL, "real-candidate.pdf");
  await makePdf(AI, "ai-candidate.pdf");
  console.log(`✓ Wrote ${OUT_DIR}/real-candidate.pdf`);
  console.log(`✓ Wrote ${OUT_DIR}/ai-candidate.pdf`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
