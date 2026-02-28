import { spawn } from "node:child_process";

export type ToolStatus = {
  sevenZip: boolean;
  unrar: boolean;
};

type ToolName = "7z" | "unrar";
type PackageManager = "apk" | "apt-get" | "dnf" | "yum";

export class ToolInstallService {
  async getStatus(): Promise<ToolStatus> {
    const sevenZip = await commandExists("7z");
    const unrar = await commandExists("unrar");
    return { sevenZip, unrar };
  }

  async install(tool: ToolName): Promise<{ tool: ToolName; installed: boolean; message: string }> {
    const status = await this.getStatus();
    if (tool === "7z" && status.sevenZip) {
      return { tool, installed: true, message: "7z is already installed." };
    }
    if (tool === "unrar" && status.unrar) {
      return { tool, installed: true, message: "unrar is already installed." };
    }

    const packageManager = await detectPackageManager();
    if (!packageManager) {
      throw new Error("No supported package manager found. Install tools manually in the container image.");
    }

    const packageSets = getPackageCandidates(packageManager, tool);
    if (packageSets.length === 0) {
      throw new Error(`No installation recipe configured for ${tool} on ${packageManager}.`);
    }

    if (packageManager === "apt-get") {
      await runCommand("apt-get", ["update"]);
    }

    let lastError = "Unknown install error";
    for (const packageSet of packageSets) {
      try {
        await runInstall(packageManager, packageSet);
        const now = await this.getStatus();
        if ((tool === "7z" && now.sevenZip) || (tool === "unrar" && now.unrar)) {
          return {
            tool,
            installed: true,
            message: `${tool} installed successfully via ${packageManager}: ${packageSet.join(", ")}`
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to install package set.";
      }
    }

    throw new Error(`Failed to install ${tool}. Last error: ${lastError}`);
  }
}

async function detectPackageManager(): Promise<PackageManager | null> {
  if (await commandExists("apk")) {
    return "apk";
  }
  if (await commandExists("apt-get")) {
    return "apt-get";
  }
  if (await commandExists("dnf")) {
    return "dnf";
  }
  if (await commandExists("yum")) {
    return "yum";
  }
  return null;
}

function getPackageCandidates(packageManager: PackageManager, tool: ToolName): string[][] {
  if (packageManager === "apk") {
    if (tool === "7z") {
      return [["p7zip"]];
    }
    return [["unrar"], ["unrar-free"]];
  }
  if (packageManager === "apt-get") {
    if (tool === "7z") {
      return [["p7zip-full"]];
    }
    return [["unrar"], ["unrar-free"]];
  }
  if (packageManager === "dnf" || packageManager === "yum") {
    if (tool === "7z") {
      return [["p7zip", "p7zip-plugins"], ["p7zip"]];
    }
    return [["unrar"]];
  }
  return [];
}

async function runInstall(packageManager: PackageManager, packages: string[]): Promise<void> {
  if (packageManager === "apk") {
    await runCommand("apk", ["add", "--no-cache", ...packages]);
    return;
  }
  if (packageManager === "apt-get") {
    await runCommand("apt-get", ["install", "-y", ...packages]);
    return;
  }
  if (packageManager === "dnf") {
    await runCommand("dnf", ["install", "-y", ...packages]);
    return;
  }
  await runCommand("yum", ["install", "-y", ...packages]);
}

async function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    const child = spawn(probe, [command], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}: ${stderr.trim()}`));
    });
  });
}
