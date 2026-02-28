import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { LogStreamService } from "./logStreamService.js";

const execFileAsync = promisify(execFile);

type UnpackerrRelease = {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
};

export type UnpackerrStatus = {
  installed: boolean;
  running: boolean;
  pid: number | null;
  version: string | null;
  binaryPath: string;
  configPath: string;
};

export class UnpackerrManager {
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null;

  constructor(
    private readonly binaryPath: string,
    private readonly configPath: string,
    private readonly logFilePath: string,
    private readonly stream: LogStreamService
  ) {}

  async ensureDirectories(): Promise<void> {
    await fs.mkdir(path.dirname(this.binaryPath), { recursive: true });
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
  }

  async install(force = false): Promise<{ version: string; binaryPath: string }> {
    await this.ensureDirectories();
    const installed = await this.isInstalled();
    if (installed && !force) {
      const version = await this.getInstalledVersion();
      return { version: version ?? "unknown", binaryPath: this.binaryPath };
    }

    const release = await this.fetchLatestRelease();
    const asset = this.pickAsset(release.assets);
    if (!asset) {
      throw new Error("Unable to find an Unpackerr linux amd64 asset in latest release.");
    }

    const response = await fetch(asset.browser_download_url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download Unpackerr asset: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(this.binaryPath, Buffer.from(arrayBuffer));
    await fs.chmod(this.binaryPath, 0o755);

    this.stream.publish({
      ts: new Date().toISOString(),
      level: "info",
      message: `Installed Unpackerr ${release.tag_name} to ${this.binaryPath}`
    });

    return { version: release.tag_name, binaryPath: this.binaryPath };
  }

  async upgrade(): Promise<{ version: string; binaryPath: string }> {
    return this.install(true);
  }

  async start(): Promise<{ started: boolean; pid: number | null }> {
    await this.ensureDirectories();
    if (!(await this.isInstalled())) {
      throw new Error("Unpackerr is not installed yet. Run install first.");
    }
    if (this.process && !this.process.killed) {
      return { started: false, pid: this.process.pid ?? null };
    }

    const logWriter = createWriteStream(this.logFilePath, { flags: "a" });
    const child = spawn(this.binaryPath, ["-c", this.configPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    this.process = child;

    const publishLine = (level: "info" | "stderr", message: string): void => {
      const event = { ts: new Date().toISOString(), level, message: message.trimEnd() };
      this.stream.publish(event);
      logWriter.write(`[${event.ts}] [${level}] ${event.message}\n`);
    };

    child.stdout.on("data", (chunk: Buffer) => publishLine("info", chunk.toString("utf-8")));
    child.stderr.on("data", (chunk: Buffer) => publishLine("stderr", chunk.toString("utf-8")));
    child.on("close", (code, signal) => {
      publishLine("info", `Unpackerr exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
      logWriter.end();
      this.process = null;
    });

    this.stream.publish({
      ts: new Date().toISOString(),
      level: "info",
      message: `Unpackerr started with pid ${child.pid ?? "unknown"}`
    });

    return { started: true, pid: child.pid ?? null };
  }

  async stop(): Promise<{ stopped: boolean }> {
    if (!this.process || this.process.killed) {
      return { stopped: false };
    }
    this.process.kill("SIGTERM");
    return { stopped: true };
  }

  async restart(): Promise<{ pid: number | null }> {
    await this.stop();
    const result = await this.start();
    return { pid: result.pid };
  }

  async getStatus(): Promise<UnpackerrStatus> {
    const installed = await this.isInstalled();
    const version = installed ? await this.getInstalledVersion() : null;
    return {
      installed,
      running: Boolean(this.process && !this.process.killed),
      pid: this.process?.pid ?? null,
      version,
      binaryPath: this.binaryPath,
      configPath: this.configPath
    };
  }

  async readLogTail(limit = 200): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.logFilePath, "utf-8");
      const lines = raw.split("\n").filter(Boolean);
      return lines.slice(-Math.max(1, limit));
    } catch {
      return [];
    }
  }

  private async isInstalled(): Promise<boolean> {
    try {
      await fs.access(this.binaryPath);
      return true;
    } catch {
      return false;
    }
  }

  private async getInstalledVersion(): Promise<string | null> {
    try {
      const { stdout, stderr } = await execFileAsync(this.binaryPath, ["--version"]);
      const output = `${stdout}\n${stderr}`.trim();
      return output.length ? output.split("\n")[0] : null;
    } catch {
      return null;
    }
  }

  private async fetchLatestRelease(): Promise<UnpackerrRelease> {
    const response = await fetch("https://api.github.com/repos/Unpackerr/unpackerr/releases/latest", {
      headers: {
        "User-Agent": "unpackerr-gui-platform"
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub release lookup failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as UnpackerrRelease;
  }

  private pickAsset(assets: Array<{ name: string; browser_download_url: string }>): { name: string; browser_download_url: string } | null {
    const matches = assets.find((asset) =>
      asset.name.toLowerCase().includes("linux") &&
      asset.name.toLowerCase().includes("amd64")
    );
    return matches ?? null;
  }
}
