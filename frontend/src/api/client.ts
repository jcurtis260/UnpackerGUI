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
  getVersion: () => request<BuildInfo>("/api/version")
};
