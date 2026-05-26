import tuningConfig from "../config/tuning.json";

export interface TuningConfig {
  version: string;
  weights: Record<string, number>;
  lastTunedAt: string | null;
  feedbackSampleSize: number;
}

export const DEFAULT_WEIGHTS: Record<string, number> = {
  "ai-text": 20,
  "template-uniformity": 10,
  "timeline": 10,
  "external-evidence": 20,
  "positive-github": 15,
  "jd-match": 25,
  "positive-rare-depth": 15,
};

const config = tuningConfig as TuningConfig;

export function getWeight(signalId: string): number {
  return (
    config.weights?.[signalId] ??
    DEFAULT_WEIGHTS[signalId] ??
    10
  );
}

export function getTuningConfig(): TuningConfig {
  return config;
}
