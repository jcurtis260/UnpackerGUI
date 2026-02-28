import type { ProgressMode, RuntimeLogEvent } from "../../api/client";

export type JobState = "queued" | "running" | "verifying" | "done" | "failed";

export type JobCard = {
  id: string;
  label: string;
  state: JobState;
  progress: number | null;
  indeterminate: boolean;
  lastMessage: string;
  updatedAt: string;
};

export type MonitorRequirements = {
  hasPercentSignals: boolean;
  warnings: string[];
};

export type MonitorViewState = {
  active: JobCard[];
  queued: JobCard[];
  completed: JobCard[];
  requirements: MonitorRequirements;
};

export type TrackerInput = {
  events: RuntimeLogEvent[];
  mode: ProgressMode;
};
