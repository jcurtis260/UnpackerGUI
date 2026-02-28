export type RuntimeStatus = {
  installed: boolean;
  running: boolean;
  pid: number | null;
  version: string | null;
  binaryPath: string;
  configPath: string;
};

export type RuntimeLogEvent = {
  ts: string;
  level: "info" | "stderr";
  message: string;
};

export type ProgressMode = "estimated_from_logs" | "activity_only" | "strict_percent_only";

export type UiPreferences = {
  monitorCollapsed: boolean;
  progressMode: ProgressMode;
};

export type BuildInfo = {
  appVersion: string;
  buildCommit: string;
  buildTime: string;
};

export type MountRoot = {
  id: string;
  label: string;
  absolutePath: string;
};

export type FileListEntry = {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
};

export type FileListResult = {
  root: MountRoot;
  currentPath: string;
  parentPath: string | null;
  entries: FileListEntry[];
};

export type QueueJobState = "queued" | "running" | "done" | "failed" | "cancelled";

export type QueueJob = {
  id: string;
  rootId: string;
  rootLabel: string;
  sourceRelativePath: string;
  sourceAbsolutePath: string;
  outputPath: string | null;
  state: QueueJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

export type QueueSnapshot = {
  active: QueueJob | null;
  queued: QueueJob[];
  history: QueueJob[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }
  return body as T;
}

async function validateConfigRequest(
  raw: string
): Promise<{ valid: true; parsed: unknown } | { valid: false; error: string }> {
  const response = await fetch("/api/unpackerr/config/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw })
  });
  const body = await response.json().catch(() => null);
  if (response.ok) {
    return body as { valid: true; parsed: unknown };
  }
  return {
    valid: false,
    error: body?.error ?? body?.message ?? "Validation failed."
  };
}

export const api = {
  status: () => request<RuntimeStatus>("/api/unpackerr/status"),
  install: () => request<{ version: string; binaryPath: string }>("/api/unpackerr/install", { method: "POST" }),
  upgrade: () => request<{ version: string; binaryPath: string }>("/api/unpackerr/upgrade", { method: "POST" }),
  start: () => request<{ started: boolean; pid: number | null }>("/api/unpackerr/start", { method: "POST" }),
  stop: () => request<{ stopped: boolean }>("/api/unpackerr/stop", { method: "POST" }),
  restart: () => request<{ pid: number | null }>("/api/unpackerr/restart", { method: "POST" }),
  logs: (limit = 200) => request<{ tail: string[]; events: RuntimeLogEvent[] }>(`/api/unpackerr/logs?limit=${limit}`),
  getConfig: () => request<{ raw: string; parsed: unknown }>("/api/unpackerr/config"),
  saveConfig: (raw: string) =>
    request<{ raw: string; parsed: unknown }>("/api/unpackerr/config", {
      method: "PUT",
      body: JSON.stringify({ raw })
    }),
  validateConfig: (raw: string) => validateConfigRequest(raw),
  getPreferences: () => request<UiPreferences>("/api/unpackerr/preferences"),
  savePreferences: (payload: Partial<UiPreferences>) =>
    request<UiPreferences>("/api/unpackerr/preferences", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  getVersion: () => request<BuildInfo>("/api/version"),
  getMounts: () => request<{ mounts: MountRoot[] }>("/api/unpackerr/files/mounts"),
  listFiles: (rootId: string, filePath = "") =>
    request<FileListResult>(`/api/unpackerr/files/list?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(filePath)}`),
  getQueue: () => request<QueueSnapshot>("/api/unpackerr/queue"),
  enqueueArchive: (rootId: string, relativePath: string) =>
    request<QueueJob>("/api/unpackerr/queue", {
      method: "POST",
      body: JSON.stringify({ rootId, relativePath })
    }),
  cancelQueueJob: (id: string) => request<{ cancelled: boolean }>(`/api/unpackerr/queue/${encodeURIComponent(id)}/cancel`, { method: "POST" })
};
