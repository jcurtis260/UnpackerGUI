import { useEffect, useState } from "react";
import { api } from "../api/client";

export function Settings(): JSX.Element {
  const [rawConfig, setRawConfig] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const config = await api.getConfig();
        setRawConfig(config.raw);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load config.");
      }
    })();
  }, []);

  const onValidate = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      const result = await api.validateConfig(rawConfig);
      if ("valid" in result && result.valid) {
        setMessage("Config is valid TOML.");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    }
  };

  const onSave = async (): Promise<void> => {
    setMessage("");
    setError("");
    try {
      await api.saveConfig(rawConfig);
      setMessage("Config saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config.");
    }
  };

  return (
    <div className="panel">
      <h2>Settings</h2>
      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <textarea value={rawConfig} onChange={(e) => setRawConfig(e.target.value)} rows={22} />
      <div className="button-row">
        <button onClick={() => void onValidate()}>Validate</button>
        <button onClick={() => void onSave()}>Save</button>
      </div>
    </div>
  );
}
