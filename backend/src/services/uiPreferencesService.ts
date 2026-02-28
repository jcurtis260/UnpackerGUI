import fs from "node:fs/promises";
import path from "node:path";

export type ProgressMode = "estimated_from_logs" | "activity_only" | "strict_percent_only";

export type UiPreferences = {
  monitorCollapsed: boolean;
  progressMode: ProgressMode;
};

const DEFAULT_PREFERENCES: UiPreferences = {
  monitorCollapsed: false,
  progressMode: "estimated_from_logs"
};

export class UiPreferencesService {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "config", "ui-preferences.json");
  }

  async ensureExists(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(DEFAULT_PREFERENCES, null, 2), "utf-8");
    }
  }

  async read(): Promise<UiPreferences> {
    await this.ensureExists();
    const raw = await fs.readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      monitorCollapsed: typeof parsed.monitorCollapsed === "boolean" ? parsed.monitorCollapsed : DEFAULT_PREFERENCES.monitorCollapsed,
      progressMode:
        parsed.progressMode === "estimated_from_logs" ||
        parsed.progressMode === "activity_only" ||
        parsed.progressMode === "strict_percent_only"
          ? parsed.progressMode
          : DEFAULT_PREFERENCES.progressMode
    };
  }

  async update(next: Partial<UiPreferences>): Promise<UiPreferences> {
    const current = await this.read();
    const merged: UiPreferences = {
      ...current,
      ...next
    };
    await fs.writeFile(this.filePath, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }
}
