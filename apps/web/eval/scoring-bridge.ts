/**
 * Thin re-export so eval scripts don't need to know about the package layout.
 */
export { scoreResume, scoreResumeAsync } from "@resumetruth/scoring";
export { activeProvider, activeModel } from "@resumetruth/scoring/llm-client";
import { activeProvider, activeModel } from "@resumetruth/scoring/llm-client";

export function activeProviderInfo(): { provider: string | null; model: string } {
  return { provider: activeProvider(), model: activeModel() };
}
