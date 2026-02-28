import type { ProgressMode, RuntimeLogEvent } from "../../api/client";
import type { JobCard, JobState, MonitorViewState, TrackerInput } from "./monitorTypes";

const QUEUE_HINTS = ["queue", "queued", "enqueue"];
const START_HINTS = ["starting", "extracting", "unpacking", "processing"];
const VERIFY_HINTS = ["verifying", "import", "finalizing"];
const DONE_HINTS = ["done", "finished", "success", "completed", "imported"];
const FAIL_HINTS = ["error", "failed", "panic", "unable", "fatal"];
const UNPACK_CONTEXT_HINTS = ["unpack", "extract", "archive", "rar", "zip", "7z", "queued", "queue"];
const NON_JOB_HINTS = [
  "[boot]",
  "unpackerr gui backend",
  "binding http server",
  "frontend bundle detected",
  "runtime directories",
  "config file ready",
  "ui preferences loaded"
];

function containsHint(text: string, hints: string[]): boolean {
  const lc = text.toLowerCase();
  return hints.some((hint) => lc.includes(hint));
}

function parsePercent(message: string): number | null {
  const match = message.match(/(\d{1,3})\s*%/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

function extractLabel(message: string): string {
  const quoted = message.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const pathMatch = message.match(/(\/[^\s]+)/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }
  const chunk = message.split(":")[0].trim();
  return chunk.length > 4 ? chunk : "Unpack job";
}

function getState(message: string): JobState {
  if (containsHint(message, FAIL_HINTS)) {
    return "failed";
  }
  if (containsHint(message, DONE_HINTS)) {
    return "done";
  }
  if (containsHint(message, VERIFY_HINTS)) {
    return "verifying";
  }
  if (containsHint(message, START_HINTS)) {
    return "running";
  }
  if (containsHint(message, QUEUE_HINTS)) {
    return "queued";
  }
  return "running";
}

function deriveProgress(message: string, state: JobState, mode: ProgressMode): { progress: number | null; indeterminate: boolean } {
  const explicit = parsePercent(message);
  if (mode === "strict_percent_only") {
    return { progress: explicit, indeterminate: explicit === null && state !== "done" && state !== "failed" };
  }
  if (mode === "activity_only") {
    return { progress: null, indeterminate: state === "running" || state === "verifying" || state === "queued" };
  }
  if (explicit !== null) {
    return { progress: explicit, indeterminate: false };
  }
  if (state === "queued") {
    return { progress: 10, indeterminate: false };
  }
  if (state === "running") {
    return { progress: 55, indeterminate: false };
  }
  if (state === "verifying") {
    return { progress: 85, indeterminate: false };
  }
  if (state === "done") {
    return { progress: 100, indeterminate: false };
  }
  return { progress: 0, indeterminate: false };
}

function shouldTrack(message: string): boolean {
  if (containsHint(message, NON_JOB_HINTS)) {
    return false;
  }
  const hasLifecycleSignal = containsHint(message, [...QUEUE_HINTS, ...START_HINTS, ...VERIFY_HINTS, ...DONE_HINTS, ...FAIL_HINTS]);
  const hasUnpackContext = containsHint(message, UNPACK_CONTEXT_HINTS);
  return hasLifecycleSignal && hasUnpackContext;
}

export function buildMonitorState({ events, mode }: TrackerInput): MonitorViewState {
  const jobs = new Map<string, JobCard>();
  let hasPercentSignals = false;

  for (const event of events) {
    if (!shouldTrack(event.message)) {
      continue;
    }
    const label = extractLabel(event.message);
    const id = label.toLowerCase();
    const state = getState(event.message);
    const progressState = deriveProgress(event.message, state, mode);
    if (parsePercent(event.message) !== null) {
      hasPercentSignals = true;
    }

    const existing = jobs.get(id);
    if (existing?.state === "done" || existing?.state === "failed") {
      // Keep terminal state stable; ignore later non-terminal noise for same label.
      if (state !== "done" && state !== "failed") {
        continue;
      }
    }
    jobs.set(id, {
      id,
      label,
      state,
      progress: progressState.progress,
      indeterminate: progressState.indeterminate,
      lastMessage: event.message,
      updatedAt: event.ts
    });
  }

  const values = [...jobs.values()].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  const queued = values.filter((job) => job.state === "queued");
  const active = values.filter((job) => job.state === "running" || job.state === "verifying");
  const completed = values.filter((job) => job.state === "done" || job.state === "failed").slice(0, 8);

  const warnings: string[] = [];
  if (mode === "strict_percent_only" && !hasPercentSignals) {
    warnings.push("Strict percent mode is enabled, but no explicit % values were found in recent logs.");
  }
  if (mode === "estimated_from_logs") {
    warnings.push("Estimated mode uses log phases and may not reflect exact extraction percent.");
  }

  return {
    active,
    queued,
    completed,
    requirements: {
      hasPercentSignals,
      warnings
    }
  };
}
