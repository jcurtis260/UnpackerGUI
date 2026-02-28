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
  validateConfig: (raw: string) =>
    request<{ valid: true; parsed: unknown } | { valid: false; error: string }>("/api/unpackerr/config/validate", {
      method: "POST",
      body: JSON.stringify({ raw })
    })
};
