import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MOUNT_ENV_KEYS = ["DOWNLOADS_PATH", "MEDIA_PATH"] as const;

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

export class FileBrowserService {
  private readonly mounts: MountRoot[];

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.mounts = this.loadMountRoots();
  }

  getMountRoots(): MountRoot[] {
    return this.mounts;
  }

  async list(rootId: string, requestedPath = ""): Promise<FileListResult> {
    const root = this.getRootById(rootId);
    const resolved = this.resolveInsideRoot(root, requestedPath);
    const dirents = await fs.readdir(resolved.absolutePath, { withFileTypes: true });

    const entries: FileListEntry[] = [];
    for (const dirent of dirents) {
      const absoluteEntryPath = path.join(resolved.absolutePath, dirent.name);
      const stat = await fs.stat(absoluteEntryPath);
      const relativeEntryPath = toApiRelativePath(path.relative(root.absolutePath, absoluteEntryPath));
      entries.push({
        name: dirent.name,
        relativePath: relativeEntryPath,
        isDirectory: dirent.isDirectory(),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      root,
      currentPath: resolved.relativePath,
      parentPath: resolved.relativePath ? toParentPath(resolved.relativePath) : null,
      entries
    };
  }

  async resolveFile(rootId: string, requestedPath: string): Promise<{ root: MountRoot; absolutePath: string; relativePath: string }> {
    const root = this.getRootById(rootId);
    const resolved = this.resolveInsideRoot(root, requestedPath);
    const stat = await fs.stat(resolved.absolutePath);
    if (!stat.isFile()) {
      throw new Error("Selected path is not a file.");
    }
    return {
      root,
      absolutePath: resolved.absolutePath,
      relativePath: resolved.relativePath
    };
  }

  private loadMountRoots(): MountRoot[] {
    const explicitMounts = this.readMountPathsFromListEnv();
    const keyedMounts = DEFAULT_MOUNT_ENV_KEYS.map((key) => ({ key, path: this.env[key] ?? "" }));
    const merged = [...keyedMounts, ...explicitMounts];

    const seen = new Set<string>();
    const mounts: MountRoot[] = [];

    for (const item of merged) {
      const candidate = (item.path ?? "").trim();
      if (!candidate || !path.isAbsolute(candidate)) {
        continue;
      }
      const normalized = path.resolve(candidate);
      const dedupeKey = normalized.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      mounts.push({
        id: createMountId(item.key, mounts.length),
        label: item.key,
        absolutePath: normalized
      });
    }

    return mounts;
  }

  private readMountPathsFromListEnv(): Array<{ key: string; path: string }> {
    const raw = (this.env.MOUNT_PATHS ?? "").trim();
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value, idx) => ({
        key: `MOUNT_PATH_${idx + 1}`,
        path: value
      }));
  }

  private getRootById(rootId: string): MountRoot {
    const root = this.mounts.find((mount) => mount.id === rootId);
    if (!root) {
      throw new Error("Invalid mount root.");
    }
    return root;
  }

  private resolveInsideRoot(root: MountRoot, requestedPath: string): { absolutePath: string; relativePath: string } {
    const safeRelativePath = toApiRelativePath(requestedPath);
    const absolutePath = path.resolve(root.absolutePath, safeRelativePath || ".");
    const rootPrefix = addTrailingSeparator(path.resolve(root.absolutePath));
    const absolutePrefix = addTrailingSeparator(path.resolve(absolutePath));
    if (!absolutePrefix.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
      throw new Error("Path escapes the selected mount root.");
    }
    return {
      absolutePath,
      relativePath: safeRelativePath
    };
  }
}

function createMountId(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = base || `mount-${index + 1}`;
  return `${id}-${index + 1}`;
}

function addTrailingSeparator(value: string): string {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

function toApiRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const safe: string[] = [];
  for (const segment of segments) {
    if (segment === "." || segment === "") {
      continue;
    }
    if (segment === "..") {
      safe.pop();
      continue;
    }
    safe.push(segment);
  }
  return safe.join("/");
}

function toParentPath(relativePath: string): string | null {
  if (!relativePath) {
    return null;
  }
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  return parts.slice(0, -1).join("/");
}
