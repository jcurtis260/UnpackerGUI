import { useEffect, useState } from "react";
import { api, type RuntimeStatus, type ToolStatus } from "../api/client";

export function Lifecycle(): JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async (): Promise<void> => {
    const [runtime, tools] = await Promise.all([api.status(), api.getToolStatus()]);
    setStatus(runtime);
    setToolStatus(tools);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAction = async (action: () => Promise<unknown>, successText: string): Promise<void> => {
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lifecycle action failed.");
    }
  };

  return (
    <div className="panel">
      <h2>Install / Upgrade / Runtime</h2>
      <div className="status-row">
        <span>Installed: {String(status?.installed ?? false)}</span>
        <span>Running: {String(status?.running ?? false)}</span>
        <span>PID: {status?.pid ?? "n/a"}</span>
        <span>Version: {status?.version ?? "n/a"}</span>
      </div>
      <div className="status-row">
        <span>7z: {toolStatus?.sevenZip ? "installed" : "missing"}</span>
        <span>unrar: {toolStatus?.unrar ? "installed" : "missing"}</span>
      </div>
      <div className="button-row">
        <button onClick={() => void runAction(() => api.install(), "Installed latest release.")}>Install</button>
        <button onClick={() => void runAction(() => api.upgrade(), "Upgraded to latest release.")}>Upgrade</button>
        <button onClick={() => void runAction(() => api.start(), "Unpackerr started.")}>Start</button>
        <button onClick={() => void runAction(() => api.stop(), "Unpackerr stop signal sent.")}>Stop</button>
        <button onClick={() => void runAction(() => api.restart(), "Unpackerr restarted.")}>Restart</button>
      </div>
      <div className="button-row">
        <button onClick={() => void runAction(() => api.installTool("7z"), "7z install attempted. Refreshed tool status.")}>
          Install 7z
        </button>
        <button onClick={() => void runAction(() => api.installTool("unrar"), "unrar install attempted. Refreshed tool status.")}>
          Install unrar
        </button>
      </div>
      <p className="hint">Tool install uses the container OS package manager (apk/apt/dnf/yum) when available.</p>
      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
