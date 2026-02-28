import { useEffect, useMemo, useState } from "react";
import { api, type RuntimeLogEvent, type RuntimeStatus } from "../api/client";

export function Dashboard(): JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [events, setEvents] = useState<RuntimeLogEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await api.status());
        const logData = await api.logs(200);
        setEvents(logData.events);
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
      <div className="log-box">
        {lastEvents.map((event, idx) => (
          <pre key={`${event.ts}-${idx}`}>{`[${event.ts}] [${event.level}] ${event.message}`}</pre>
        ))}
      </div>
    </div>
  );
}
