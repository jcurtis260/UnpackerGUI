import { useEffect, useMemo, useState } from "react";
import { api, type RuntimeLogEvent, type RuntimeStatus, type UiPreferences } from "../api/client";
import { MonitorCards } from "./monitor/MonitorCards";
import { buildMonitorState } from "./monitor/jobTracker";

export function Dashboard(): JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [events, setEvents] = useState<RuntimeLogEvent[]>([]);
  const [preferences, setPreferences] = useState<UiPreferences>({
    monitorCollapsed: false,
    progressMode: "estimated_from_logs"
  });
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await api.status());
        const logData = await api.logs(200);
        setEvents(logData.events);
        const prefs = await api.getPreferences();
        setPreferences(prefs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      }
    })();
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/unpackerr/events");
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RuntimeLogEvent;
        setEvents((existing) => [...existing.slice(-300), parsed]);
      } catch {
        // Ignore malformed event payloads.
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, []);

  const lastEvents = useMemo(() => events.slice(-100).reverse(), [events]);
  const monitorState = useMemo(
    () => buildMonitorState({ events, mode: preferences.progressMode }),
    [events, preferences.progressMode]
  );

  const toggleCollapse = async (): Promise<void> => {
    const next = !preferences.monitorCollapsed;
    setPreferences((prev) => ({ ...prev, monitorCollapsed: next }));
    try {
      await api.savePreferences({ monitorCollapsed: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to persist monitor collapse preference.");
    }
  };

  return (
    <div className="panel">
      <h2>Live Monitor</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="status-row">
        <span>Installed: {String(status?.installed ?? false)}</span>
        <span>Running: {String(status?.running ?? false)}</span>
        <span>PID: {status?.pid ?? "n/a"}</span>
        <span>Version: {status?.version ?? "n/a"}</span>
      </div>
      <MonitorCards
        active={monitorState.active}
        queued={monitorState.queued}
        completed={monitorState.completed}
        requirements={monitorState.requirements}
      />
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Raw Log Stream</h3>
          <button onClick={() => void toggleCollapse()}>
            {preferences.monitorCollapsed ? "Expand logs" : "Collapse logs"}
          </button>
        </div>
        {preferences.monitorCollapsed ? <p className="hint">Logs are collapsed.</p> : null}
        {!preferences.monitorCollapsed ? (
          <div className="log-box">
            {lastEvents.map((event, idx) => (
              <pre key={`${event.ts}-${idx}`}>{`[${event.ts}] [${event.level}] ${event.message}`}</pre>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
