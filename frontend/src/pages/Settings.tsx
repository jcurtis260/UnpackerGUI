import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  defaultModel,
  parseRawToParsed,
  toFormModel,
  toRawToml,
  type SettingsFormModel
} from "./settings/configMapper";
import { GuidedSettingsForm } from "./settings/GuidedSettingsForm";
import { AdvancedTomlEditor } from "./settings/AdvancedTomlEditor";
import { SettingsCatalog } from "./settings/SettingsCatalog";

export function Settings(): JSX.Element {
  const [mode, setMode] = useState<"guided" | "advanced">("guided");
  const [formModel, setFormModel] = useState<SettingsFormModel>(defaultModel());
  const [baseParsed, setBaseParsed] = useState<unknown>({});
  const [rawConfig, setRawConfig] = useState("");
  const [savedRaw, setSavedRaw] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const config = await api.getConfig();
        setRawConfig(config.raw);
        setSavedRaw(config.raw);
        setBaseParsed(config.parsed);
        setFormModel(toFormModel(config.parsed));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load config.");
      }
    })();
  }, []);

  const unsaved = useMemo(() => rawConfig !== savedRaw || formDirty, [rawConfig, savedRaw, formDirty]);

  const validateRaw = async (text: string): Promise<void> => {
    const result = await api.validateConfig(text);
    if ("valid" in result && result.valid) {
      setMessage("Config is valid TOML.");
      return;
    }
    setError(result.error);
  };

  const onValidate = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      await validateRaw(rawConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    }
  };

  const onSave = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      const saved = await api.saveConfig(rawConfig);
      setBaseParsed(saved.parsed);
      setFormModel(toFormModel(saved.parsed));
      setSavedRaw(saved.raw);
      setFormDirty(false);
      setMessage("Config saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config.");
    }
  };

  const onApplyGuidedToRaw = (): void => {
    setMessage("");
    setError("");
    try {
      const nextRaw = toRawToml(formModel, baseParsed);
      setRawConfig(nextRaw);
      setFormDirty(false);
      setMessage("Guided values applied to raw TOML.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert guided values to TOML.");
    }
  };

  const onLoadRawToGuided = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      await validateRaw(rawConfig);
      const parsed = parseRawToParsed(rawConfig);
      setBaseParsed(parsed);
      setFormModel(toFormModel(parsed));
      setFormDirty(false);
      setMode("guided");
      setMessage("Raw TOML loaded into guided form.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse raw TOML into guided fields.");
    }
  };

  const onSaveGuided = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      const nextRaw = toRawToml(formModel, baseParsed);
      await validateRaw(nextRaw);
      setRawConfig(nextRaw);
      const saved = await api.saveConfig(nextRaw);
      setBaseParsed(saved.parsed);
      setFormModel(toFormModel(saved.parsed));
      setSavedRaw(saved.raw);
      setFormDirty(false);
      setMessage("Guided settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save guided settings.");
    }
  };

  const onResetSection = (
    section: "global" | "webserver" | "folders" | "radarr" | "sonarr" | "lidarr" | "readarr" | "webhook"
  ): void => {
    const defaults = defaultModel();
    const next = { ...formModel };
    if (section === "global") {
      Object.assign(next, {
        interval: defaults.interval,
        start_delay: defaults.start_delay,
        retry_delay: defaults.retry_delay,
        max_retries: defaults.max_retries,
        parallel: defaults.parallel,
        log_file: defaults.log_file,
        extract_path: defaults.extract_path,
        file_mode: defaults.file_mode,
        dir_mode: defaults.dir_mode,
        debug: defaults.debug,
        quiet: defaults.quiet,
        error_stderr: defaults.error_stderr
      });
    } else {
      next[section] = defaults[section] as never;
    }
    setFormModel(next);
    setFormDirty(true);
    setMessage(`${section} section reset to defaults.`);
  };

  return (
    <div className="panel">
      <div className="settings-page-header">
        <h2>Settings</h2>
        <span className={unsaved ? "warn-chip" : "ok-chip"}>{unsaved ? "Unsaved changes" : "Saved"}</span>
      </div>
      <div className="tab-row">
        <button className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}>
          Guided
        </button>
        <button className={mode === "advanced" ? "active" : ""} onClick={() => setMode("advanced")}>
          Advanced TOML
        </button>
      </div>
      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {mode === "guided" ? (
        <div>
          <GuidedSettingsForm
            model={formModel}
            onChange={(next) => {
              setFormModel(next);
              setFormDirty(true);
            }}
            onResetSection={onResetSection}
          />
          <div className="button-row">
            <button onClick={onApplyGuidedToRaw}>Generate TOML Preview</button>
            <button onClick={() => void onSaveGuided()}>Validate + Save Guided</button>
          </div>
        </div>
      ) : (
        <AdvancedTomlEditor
          rawConfig={rawConfig}
          onRawConfigChange={(next) => {
            setRawConfig(next);
          }}
          onValidate={onValidate}
          onSave={onSave}
          onApplyGuidedToRaw={onApplyGuidedToRaw}
          onLoadRawToGuided={onLoadRawToGuided}
        />
      )}
      <SettingsCatalog />
    </div>
  );
}
