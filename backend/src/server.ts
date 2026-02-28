import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { createUnpackerrRouter } from "./routes/unpackerr.js";
import { LogStreamService } from "./services/logStreamService.js";
import { ConfigService } from "./services/configService.js";
import { UnpackerrManager } from "./services/unpackerrManager.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? "/data";
const binDir = process.env.BIN_DIR ?? path.join(dataDir, "bin");
const configPath = process.env.UNPACKERR_CONFIG_PATH ?? path.join(dataDir, "config", "unpackerr.conf");
const logPath = process.env.UNPACKERR_LOG_PATH ?? path.join(dataDir, "logs", "unpackerr.log");
const unpackerrBinaryPath = process.env.UNPACKERR_BINARY_PATH ?? path.join(binDir, "unpackerr");

const logStream = new LogStreamService();
const configService = new ConfigService(configPath);
const unpackerrManager = new UnpackerrManager(unpackerrBinaryPath, configPath, logPath, logStream);
const frontendDist = path.resolve(process.cwd(), "frontend", "dist");

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

app.get("/api/health", async (_req, res) => {
  const status = await unpackerrManager.getStatus();
  res.json({ ok: true, unpackerr: status });
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

app.use("/api/unpackerr", createUnpackerrRouter(unpackerrManager, configService, logStream));
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
  bootLog(`Starting Unpackerr GUI backend v${appVersion}`);
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

  bootLog(`Binding HTTP server on :${port}...`);
  app.listen(port, () => {
    bootLog(`Unpackerr GUI backend listening on :${port}`);
  });
}

void bootstrap();
