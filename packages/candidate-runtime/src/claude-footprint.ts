/**
 * Read the candidate's LOCAL Claude Code footprint — file/dir METADATA only,
 * never the contents of any transcript.
 *
 * Compliance basis (no special authorization needed): this is the candidate's
 * OWN data, on their OWN machine, read only after they opt in (the caller must
 * pass an explicit flag). v1 is deliberately conservative — it counts session
 * files and reads directory names to learn *which projects* the candidate used
 * Claude Code on and *how recently/often*, but it never opens a transcript. So
 * no code, secrets, or chat content is read, let alone transmitted. Anything
 * derived from this is SELF-REPORTED and must never feed a verified score.
 *
 * (Before shipping, skim Claude Code's ToS to confirm third-party reads of the
 * user's own local transcript store are permitted.)
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CcProject {
  /** Friendly name derived from the project directory (no full path leaked). */
  project: string;
  /** Number of transcript files — counted, not read. */
  sessions: number;
  /** ISO date (YYYY-MM-DD) of the most recent transcript file's mtime. */
  lastActive: string;
}

export interface ClaudeFootprint {
  projects: CcProject[];
  totalSessions: number;
  warnings: string[];
}

// Claude Code encodes the project cwd into the dir name, e.g.
// "C--Users-86151-Desktop-resumetruth". Take the last path-ish segment.
function deriveName(dir: string): string {
  const parts = dir.split(/[-/\\]+/).filter(Boolean);
  return parts[parts.length - 1] || dir;
}

export function readClaudeFootprint(baseDir?: string): ClaudeFootprint {
  const root = baseDir ?? join(homedir(), ".claude", "projects");
  if (!existsSync(root)) {
    return { projects: [], totalSessions: 0, warnings: [`no Claude Code transcripts found at ${root}`] };
  }

  const projects: CcProject[] = [];
  let totalSessions = 0;
  let dirs: string[] = [];
  try {
    dirs = readdirSync(root);
  } catch (err) {
    return { projects: [], totalSessions: 0, warnings: [`cannot read ${root}: ${err instanceof Error ? err.message : String(err)}`] };
  }

  for (const dir of dirs) {
    const full = join(root, dir);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    let sessions = 0;
    let lastMtime = 0;
    try {
      for (const f of readdirSync(full)) {
        if (!f.endsWith(".jsonl")) continue;
        sessions++;
        try {
          lastMtime = Math.max(lastMtime, statSync(join(full, f)).mtimeMs);
        } catch {
          /* skip unreadable file */
        }
      }
    } catch {
      continue;
    }
    if (sessions === 0) continue;

    projects.push({
      project: deriveName(dir),
      sessions,
      lastActive: lastMtime ? new Date(lastMtime).toISOString().slice(0, 10) : "unknown",
    });
    totalSessions += sessions;
  }

  projects.sort((a, b) => b.sessions - a.sessions);
  return { projects, totalSessions, warnings: [] };
}
