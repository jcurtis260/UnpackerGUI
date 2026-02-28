import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { createUnpackerrRouter } from "./routes/unpackerr.js";
import { LogStreamService } from "./services/logStreamService.js";
import { ConfigService } from "./services/configService.js";
import { UnpackerrManager } from "./services/unpackerrManager.js";
import { UiPreferencesService } from "./services/uiPreferencesService.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? "/data";
const binDir = process.env.BIN_DIR ?? path.join(dataDir, "bin");
const configPath = process.env.UNPACKERR_CONFIG_PATH ?? path.join(dataDir, "config", "unpackerr.conf");
const logPath = process.env.UNPACKERR_LOG_PATH ?? path.join(dataDir, "logs", "unpackerr.log");
const unpackerrBinaryPath = process.env.UNPACKERR_BINARY_PATH ?? path.join(binDir, "unpackerr");
const buildCommitPath = path.resolve(process.cwd(), ".build-commit");
const buildTimePath = path.resolve(process.cwd(), ".build-time");

const logStream = new LogStreamService();
const configService = new ConfigService(configPath);
const unpackerrManager = new UnpackerrManager(unpackerrBinaryPath, configPath, logPath, logStream);
const uiPreferencesService = new UiPreferencesService(dataDir);
const frontendDist = path.resolve(process.cwd(), "frontend", "dist");
const EXTERNAL_LOG_POLL_MS = 1500;

function bootLog(message: string): void {
  const ts = new Date().toISOString();
  const line = `[boot] ${message}`;
  console.log(line);
  logStream.publish({
    ts,
    level: "info",
    message: line
  });
}

function publishExternalLogLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let level: "info" | "stderr" = "info";
  if (trimmed.toLowerCase().includes("[error]") || trimmed.toLowerCase().includes(" error ")) {
    level = "stderr";
  }
  logStream.publish({
    ts: new Date().toISOString(),
    level,
    message: `[unpackerr] ${trimmed}`
  });
}

async function startExternalLogTailer(filePath: string): Promise<void> {
  // Ensure the log file exists even before unpackerr writes first line.
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf-8");
  }

  let offset = 0;
  let remainder = "";

  const poll = async (): Promise<void> => {
    try {
      const handle = await fs.open(filePath, "r");
      try {
        const stats = await handle.stat();
        if (stats.size < offset) {
          offset = 0;
          remainder = "";
        }
        if (stats.size === offset) {
          return;
        }
        const bytesToRead = stats.size - offset;
        const buffer = Buffer.alloc(bytesToRead);
        const result = await handle.read(buffer, 0, bytesToRead, offset);
        offset += result.bytesRead;

        const chunk = remainder + buffer.toString("utf-8", 0, result.bytesRead);
        const lines = chunk.split(/\r?\n/);
        remainder = lines.pop() ?? "";
        for (const line of lines) {
          publishExternalLogLine(line);
        }
      } finally {
        await handle.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown external log tail error";
      bootLog(`External log tail error: ${message}`);
    }
  };

  const timer = setInterval(() => {
    void poll();
  }, EXTERNAL_LOG_POLL_MS);
  timer.unref();
  bootLog(`External unpackerr log tailer started for ${filePath}`);
}

async function getAppVersion(): Promise<string> {
  try {
    const packagePath = path.resolve(process.cwd(), "backend", "package.json");
    const raw = await fs.readFile(packagePath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function getBuildCommit(): Promise<string> {
  const fromEnv = process.env.BUILD_COMMIT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const raw = await fs.readFile(buildCommitPath, "utf-8");
    return raw.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

async function getBuildTime(): Promise<string> {
  const fromEnv = process.env.BUILD_TIME?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const raw = await fs.readFile(buildTimePath, "utf-8");
    return raw.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

const runtimeBuildInfo: {
  appVersion: string;
  buildCommit: string;
  buildTime: string;
} = {
  appVersion: "unknown",
  buildCommit: "unknown",
  buildTime: "unknown"
};

app.get("/api/health", async (_req, res) => {
  const status = await unpackerrManager.getStatus();
  res.json({
    ok: true,
    unpackerr: status,
    app: runtimeBuildInfo
  });
});

app.get("/api/version", (_req, res) => {
  res.json(runtimeBuildInfo);
});

app.get("/api/unpackerr/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const preload = logStream.getHistory(100);
  for (const item of preload) {
    res.write(`data: ${JSON.stringify(item)}\n\n`);
  }

  const unsubscribe = logStream.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    unsubscribe();
    res.end();
  });
});

app.use("/api/unpackerr", createUnpackerrRouter(unpackerrManager, configService, logStream, uiPreferencesService));
app.use(express.static(frontendDist));
app.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  try {
    const indexPath = path.join(frontendDist, "index.html");
    const html = await fs.readFile(indexPath, "utf-8");
    res.type("html").send(html);
  } catch {
    res.status(404).send("Frontend build not found. Run `npm run build`.");
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(500).json({ error: message });
});

async function bootstrap(): Promise<void> {
  const appVersion = await getAppVersion();
  const buildCommit = await getBuildCommit();
  const buildTime = await getBuildTime();
  runtimeBuildInfo.appVersion = appVersion;
  runtimeBuildInfo.buildCommit = buildCommit;
  runtimeBuildInfo.buildTime = buildTime;

  bootLog(`Starting Unpackerr GUI backend v${appVersion} (commit=${buildCommit}, buildTime=${buildTime})`);
  bootLog(`Data directory: ${dataDir}`);
  bootLog(`Config path: ${configPath}`);
  bootLog(`Binary path: ${unpackerrBinaryPath}`);
  bootLog(`Log path: ${logPath}`);
  bootLog("Ensuring config file exists...");
  await configService.ensureExists();
  bootLog("Config file ready.");
  bootLog("Ensuring runtime directories exist...");
  await unpackerrManager.ensureDirectories();
  bootLog("Runtime directories ready.");
  await uiPreferencesService.ensureExists();
  const preferences = await uiPreferencesService.read();
  bootLog(`UI preferences loaded: progressMode=${preferences.progressMode}, monitorCollapsed=${preferences.monitorCollapsed}`);

  const status = await unpackerrManager.getStatus();
  bootLog(
    `Unpackerr status: installed=${status.installed}, running=${status.running}, version=${status.version ?? "n/a"}`
  );

  try {
    const frontendIndexPath = path.join(frontendDist, "index.html");
    await fs.access(frontendIndexPath);
    bootLog(`Frontend bundle detected at ${frontendIndexPath}`);
  } catch {
    bootLog("Frontend bundle missing. Requests to / will return 404 until built.");
  }

  await startExternalLogTailer(logPath);

  bootLog(`Binding HTTP server on :${port}...`);
  app.listen(port, () => {
    bootLog(`Unpackerr GUI backend listening on :${port}`);
  });
}

void bootstrap();
