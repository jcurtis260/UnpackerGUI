import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml";

export type ConfigReadResult = {
  raw: string;
  parsed: unknown;
};

const DEFAULT_CONFIG = `# Unpackerr config managed by Unpackerr GUI
interval = "2m"
log_file = "/data/logs/unpackerr.log"
error_stderr = true
debug = false
quiet = false

[folders]
downloads = ["/downloads"]
`;

export class ConfigService {
  constructor(private readonly configPath: string) {}

  async ensureExists(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      await fs.access(this.configPath);
    } catch {
      await fs.writeFile(this.configPath, DEFAULT_CONFIG, "utf-8");
    }
  }

  async readConfig(): Promise<ConfigReadResult> {
    await this.ensureExists();
    const raw = await fs.readFile(this.configPath, "utf-8");
    const parsed = TOML.parse(raw);
    return { raw, parsed };
  }

  validateRaw(raw: string): { valid: true; parsed: unknown } | { valid: false; error: string } {
    try {
      const parsed = TOML.parse(raw);
      return { valid: true, parsed };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown TOML parse error";
      return { valid: false, error: message };
    }
  }

  async writeConfig(raw: string): Promise<ConfigReadResult> {
    await this.ensureExists();
    const validation = this.validateRaw(raw);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.error}`);
    }
    await fs.writeFile(this.configPath, raw, "utf-8");
    return { raw, parsed: validation.parsed };
  }
}
