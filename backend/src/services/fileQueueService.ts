import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { once } from "node:events";
import type { Readable } from "node:stream";
import type { LogStreamService } from "./logStreamService.js";
import type { FileBrowserService } from "./fileBrowserService.js";

type QueueState = "queued" | "running" | "done" | "failed" | "cancelled";

export type QueueJob = {
  id: string;
  rootId: string;
  rootLabel: string;
  sourceRelativePath: string;
  sourceAbsolutePath: string;
  outputPath: string | null;
  state: QueueState;
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

type QueueStore = {
  queued: QueueJob[];
  history: QueueJob[];
};

const HISTORY_LIMIT = 100;
const SUPPORTED_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz"];

export class FileQueueService {
  private readonly storePath: string;
  private queued: QueueJob[] = [];
  private history: QueueJob[] = [];
  private active: QueueJob | null = null;
  private activeChild: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private cancelActiveId: string | null = null;
  private processing = false;
  private readonly commandAvailability = new Map<string, Promise<boolean>>();

  constructor(
    dataDir: string,
    private readonly browser: FileBrowserService,
    private readonly logs: LogStreamService
  ) {
    this.storePath = path.join(dataDir, "config", "file-queue.json");
  }

  async ensureExists(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      await fs.access(this.storePath);
    } catch {
      await this.writeStore({ queued: [], history: [] });
    }
    await this.loadStore();
  }

  getSnapshot(): QueueSnapshot {
    return {
      active: this.active,
      queued: this.queued,
      history: this.history
    };
  }

  async enqueue(rootId: string, sourceRelativePath: string): Promise<QueueJob> {
    const resolvedFile = await this.browser.resolveFile(rootId, sourceRelativePath);
    ensureSupportedArchive(resolvedFile.relativePath);
    const now = new Date().toISOString();
    const job: QueueJob = {
      id: createJobId(),
      rootId,
      rootLabel: resolvedFile.root.label,
      sourceRelativePath: resolvedFile.relativePath,
      sourceAbsolutePath: resolvedFile.absolutePath,
      outputPath: null,
      state: "queued",
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      error: null
    };
    this.queued.push(job);
    await this.persist();
    this.publishInfo(`Queued archive ${job.sourceRelativePath}`);
    void this.processQueue();
    return job;
  }

  async cancel(jobId: string): Promise<{ cancelled: boolean }> {
    const queuedIdx = this.queued.findIndex((item) => item.id === jobId);
    if (queuedIdx >= 0) {
      const [job] = this.queued.splice(queuedIdx, 1);
      job.state = "cancelled";
      job.finishedAt = new Date().toISOString();
      this.pushHistory(job);
      await this.persist();
      this.publishInfo(`Cancelled queued archive ${job.sourceRelativePath}`);
      return { cancelled: true };
    }

    if (this.active?.id === jobId && this.activeChild) {
      this.cancelActiveId = jobId;
      this.activeChild.kill("SIGTERM");
      return { cancelled: true };
    }

    return { cancelled: false };
  }

  private async loadStore(): Promise<void> {
    const raw = await fs.readFile(this.storePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<QueueStore>;
    const queued = Array.isArray(parsed.queued) ? parsed.queued : [];
    const history = Array.isArray(parsed.history) ? parsed.history : [];

    // If the app restarted while a job was running, treat it as failed.
    for (const item of queued) {
      if (item.state === "running") {
        item.state = "failed";
        item.error = "Job interrupted by application restart.";
        item.finishedAt = new Date().toISOString();
        history.push(item);
      } else if (item.state === "queued") {
        this.queued.push(item);
      } else {
        history.push(item);
      }
    }

    this.history = history.slice(-HISTORY_LIMIT);
    await this.persist();
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (!this.active && this.queued.length > 0) {
        const next = this.queued.shift();
        if (!next) {
          break;
        }
        next.state = "running";
        next.startedAt = new Date().toISOString();
        this.active = next;
        await this.persist();
        try {
          const destination = await this.extractArchive(next);
          next.state = "done";
          next.outputPath = destination;
          next.finishedAt = new Date().toISOString();
          this.publishInfo(`Finished unpacking ${next.sourceRelativePath} -> ${destination}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown extraction error";
          if (this.cancelActiveId === next.id) {
            next.state = "cancelled";
            this.publishInfo(`Cancelled unpacking ${next.sourceRelativePath}`);
          } else {
            next.state = "failed";
            next.error = message;
            this.publishError(`Failed unpacking ${next.sourceRelativePath}: ${message}`);
          }
          next.finishedAt = new Date().toISOString();
        } finally {
          this.cancelActiveId = null;
          this.active = null;
          this.activeChild = null;
          this.pushHistory(next);
          await this.persist();
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async extractArchive(job: QueueJob): Promise<string> {
    const outputPath = await createOutputDirectory(job.sourceAbsolutePath);
    const command = await this.selectExtractorCommand(job.sourceAbsolutePath, outputPath);
    this.publishInfo(`Unpacking ${job.sourceRelativePath} using ${command.executable}`);
    await this.runCommand(command.executable, command.args, (line) => this.publishInfo(`[extractor] ${line}`));
    return outputPath;
  }

  private async runCommand(
    executable: string,
    args: string[],
    onLine: (line: string) => void
  ): Promise<void> {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });
    this.activeChild = child;
    streamLines(child.stdout, onLine);
    streamLines(child.stderr, onLine);
    const [code] = (await once(child, "close")) as [number | null];
    if (code !== 0) {
      throw new Error(`${executable} exited with code ${code ?? "null"}`);
    }
  }

  private async selectExtractorCommand(sourceAbsolutePath: string, outputPath: string): Promise<{ executable: string; args: string[] }> {
    const lower = sourceAbsolutePath.toLowerCase();
    const isZip = lower.endsWith(".zip");
    const isTarFamily =
      lower.endsWith(".tar") ||
      lower.endsWith(".tar.gz") ||
      lower.endsWith(".tgz") ||
      lower.endsWith(".tar.bz2") ||
      lower.endsWith(".tbz2") ||
      lower.endsWith(".tar.xz") ||
      lower.endsWith(".txz");
    const isRar = lower.endsWith(".rar");
    const is7z = lower.endsWith(".7z");

    if (isZip) {
      if (process.platform === "win32") {
        const hasPwsh = await this.commandExistsCached("pwsh");
        if (hasPwsh || (await this.commandExistsCached("powershell"))) {
          return {
            executable: hasPwsh ? "pwsh" : "powershell",
            args: [
              "-NoProfile",
              "-Command",
              `Expand-Archive -LiteralPath '${escapeSingleQuotesForPs(sourceAbsolutePath)}' -DestinationPath '${escapeSingleQuotesForPs(outputPath)}' -Force`
            ]
          };
        }
      }
      if (await this.commandExistsCached("7z")) {
        return {
          executable: "7z",
          args: ["x", "-y", `-o${outputPath}`, sourceAbsolutePath]
        };
      }
      if (await this.commandExistsCached("unzip")) {
        return {
          executable: "unzip",
          args: ["-o", sourceAbsolutePath, "-d", outputPath]
        };
      }
    }

    if (isTarFamily) {
      if (await this.commandExistsCached("tar")) {
        return {
          executable: "tar",
          args: ["-xf", sourceAbsolutePath, "-C", outputPath]
        };
      }
      if (await this.commandExistsCached("7z")) {
        return {
          executable: "7z",
          args: ["x", "-y", `-o${outputPath}`, sourceAbsolutePath]
        };
      }
    }

    if (isRar || is7z) {
      if (await this.commandExistsCached("7z")) {
        return {
          executable: "7z",
          args: ["x", "-y", `-o${outputPath}`, sourceAbsolutePath]
        };
      }
      if (isRar && (await this.commandExistsCached("unrar"))) {
        return {
          executable: "unrar",
          args: ["x", "-o+", sourceAbsolutePath, outputPath]
        };
      }
    }

    throw new Error("No suitable extractor available for this archive. Install 7z (recommended) or unzip/tar.");
  }

  private async commandExistsCached(command: string): Promise<boolean> {
    const existing = this.commandAvailability.get(command);
    if (existing) {
      return existing;
    }
    const probe = commandExists(command);
    this.commandAvailability.set(command, probe);
    return probe;
  }

  private pushHistory(job: QueueJob): void {
    this.history.push(job);
    if (this.history.length > HISTORY_LIMIT) {
      this.history = this.history.slice(-HISTORY_LIMIT);
    }
  }

  private async persist(): Promise<void> {
    await this.writeStore({
      queued: this.active ? [this.active, ...this.queued] : this.queued,
      history: this.history
    });
  }

  private async writeStore(store: QueueStore): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), "utf-8");
  }

  private publishInfo(message: string): void {
    this.logs.publish({
      ts: new Date().toISOString(),
      level: "info",
      message: `[queue] ${message}`
    });
  }

  private publishError(message: string): void {
    this.logs.publish({
      ts: new Date().toISOString(),
      level: "stderr",
      message: `[queue] ${message}`
    });
  }
}

async function createOutputDirectory(sourceAbsolutePath: string): Promise<string> {
  const sourceDir = path.dirname(sourceAbsolutePath);
  const sourceName = path.basename(sourceAbsolutePath);
  const baseName = sourceName.replace(/(\.tar\.gz|\.tar\.bz2|\.tar\.xz|\.tgz|\.tbz2|\.txz|\.zip|\.rar|\.7z|\.tar)$/i, "");
  let outputPath = path.join(sourceDir, `${baseName}_unpacked`);
  let suffix = 2;
  while (true) {
    try {
      await fs.access(outputPath);
      outputPath = path.join(sourceDir, `${baseName}_unpacked_${suffix}`);
      suffix += 1;
    } catch {
      break;
    }
  }
  await fs.mkdir(outputPath, { recursive: true });
  return outputPath;
}

function ensureSupportedArchive(relativePath: string): void {
  const lower = relativePath.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    throw new Error(`Unsupported archive type. Allowed: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }
}

async function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    const child = spawn(probe, [command], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function streamLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let remainder = "";
  stream.on("data", (chunk: Buffer) => {
    const text = remainder + chunk.toString("utf-8");
    const lines = text.split(/\r?\n/);
    remainder = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        onLine(line);
      }
    }
  });
  stream.on("end", () => {
    if (remainder.trim()) {
      onLine(remainder);
    }
  });
}

function createJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeSingleQuotesForPs(value: string): string {
  return value.replace(/'/g, "''");
}
