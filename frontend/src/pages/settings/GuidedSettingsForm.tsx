import {
  type SettingsFormModel,
  newStarrInstance,
  newWebhookInstance,
  type StarrInstance,
  type WebhookInstance
} from "./configMapper";

type Props = {
  model: SettingsFormModel;
  onChange: (next: SettingsFormModel) => void;
  onResetSection: (section: "global" | "webserver" | "folders" | "radarr" | "sonarr" | "lidarr" | "readarr" | "webhook") => void;
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitEvents(value: string): Array<number | string> {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const n = Number(x);
      return Number.isNaN(n) ? x : n;
    });
}

function sectionHeader(title: string, description: string, resetAction: () => void): JSX.Element {
  return (
    <div className="settings-card-header">
      <div>
        <h3>{title}</h3>
        <p className="hint">{description}</p>
      </div>
      <button onClick={resetAction}>Reset section</button>
    </div>
  );
}

function textField(
  label: string,
  value: string,
  onChange: (next: string) => void,
  hint: string,
  suggestions?: string[]
): JSX.Element {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
      <small className="hint">{hint}</small>
      {suggestions?.length ? (
        <div className="chip-row">
          {suggestions.map((suggestion) => (
            <button key={suggestion} className="chip" onClick={() => onChange(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function boolField(label: string, value: boolean, onChange: (next: boolean) => void, hint: string): JSX.Element {
  return (
    <label className="settings-field checkbox">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <small className="hint">{hint}</small>
    </label>
  );
}

function numberField(label: string, value: number, onChange: (next: number) => void, hint: string, min = 0): JSX.Element {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input type="number" min={min} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small className="hint">{hint}</small>
    </label>
  );
}

function renderStarrInstance(
  title: string,
  instances: StarrInstance[],
  update: (idx: number, next: StarrInstance) => void,
  remove: (idx: number) => void,
  add: () => void
): JSX.Element {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div>
          <h3>{title}</h3>
          <p className="hint">Configure one or more {title.toLowerCase()} servers.</p>
        </div>
        <button onClick={add}>Add instance</button>
      </div>
      {instances.length === 0 ? <p className="hint">No instances yet.</p> : null}
      {instances.map((item, idx) => (
        <div key={idx} className="instance-box">
          <div className="instance-box-header">
            <strong>Instance {idx + 1}</strong>
            <button onClick={() => remove(idx)}>Remove</button>
          </div>
          <div className="settings-grid">
            {textField("URL", item.url, (next) => update(idx, { ...item, url: next }), "Example: http://radarr:7878")}
            {textField("API key", item.api_key, (next) => update(idx, { ...item, api_key: next }), "Paste the Starr API key from app settings.")}
            {textField(
              "Paths (comma-separated)",
              item.paths.join(", "),
              (next) => update(idx, { ...item, paths: splitCsv(next) }),
              "Paths watched for this app instance.",
              ["/downloads"]
            )}
            {textField(
              "Protocols (comma-separated)",
              item.protocols.join(", "),
              (next) => update(idx, { ...item, protocols: splitCsv(next) }),
              "Common values: torrent, usenet.",
              ["torrent, usenet", "torrent", "usenet"]
            )}
            {textField("Timeout", item.timeout, (next) => update(idx, { ...item, timeout: next }), "Duration, for example 10s.", ["5s", "10s", "30s"])}
            {textField(
              "Delete delay",
              item.delete_delay,
              (next) => update(idx, { ...item, delete_delay: next }),
              "Wait before deleting original files.",
              ["0s", "1m", "5m"]
            )}
            {boolField(
              "Delete originals",
              item.delete_orig,
              (next) => update(idx, { ...item, delete_orig: next }),
              "Only enable if you are sure imports are complete."
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderWebhookInstance(
  instances: WebhookInstance[],
  update: (idx: number, next: WebhookInstance) => void,
  remove: (idx: number) => void,
  add: () => void
): JSX.Element {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div>
          <h3>Webhooks</h3>
          <p className="hint">Send notifications for queue/start/finish/delete events.</p>
        </div>
        <button onClick={add}>Add webhook</button>
      </div>
      {instances.length === 0 ? <p className="hint">No webhook destinations yet.</p> : null}
      {instances.map((item, idx) => (
        <div key={idx} className="instance-box">
          <div className="instance-box-header">
            <strong>Webhook {idx + 1}</strong>
            <button onClick={() => remove(idx)}>Remove</button>
          </div>
          <div className="settings-grid">
            {textField("URL", item.url, (next) => update(idx, { ...item, url: next }), "Target endpoint URL.")}
            {textField("Name", item.name, (next) => update(idx, { ...item, name: next }), "Friendly label shown in logs.")}
            {textField(
              "Events (comma-separated ids)",
              item.events.join(", "),
              (next) => update(idx, { ...item, events: splitEvents(next) }),
              "Use 0 to send all events.",
              ["0", "1,2,3,4"]
            )}
            {textField("Nickname", item.nickname, (next) => update(idx, { ...item, nickname: next }), "Bot/display name used by providers.")}
            {textField("Channel", item.channel, (next) => update(idx, { ...item, channel: next }), "Optional channel (provider specific).")}
            {textField(
              "Exclude apps (comma-separated)",
              item.exclude.join(", "),
              (next) => update(idx, { ...item, exclude: splitCsv(next) }),
              "Skip notifications from selected apps.",
              ["radarr, sonarr"]
            )}
            {textField(
              "Template",
              item.template,
              (next) => update(idx, { ...item, template: next }),
              "Built-in payload style.",
              ["notifiarr", "discord", "telegram", "slack"]
            )}
            {textField(
              "Template path",
              item.template_path,
              (next) => update(idx, { ...item, template_path: next }),
              "Path to custom template file."
            )}
            {textField("Timeout", item.timeout, (next) => update(idx, { ...item, timeout: next }), "Duration, such as 10s.", ["5s", "10s", "30s"])}
            {textField(
              "Content type",
              item.content_type,
              (next) => update(idx, { ...item, content_type: next }),
              "HTTP Content-Type header.",
              ["application/json", "application/x-www-form-urlencoded"]
            )}
            {boolField("Silent success", item.silent, (next) => update(idx, { ...item, silent: next }), "Hide successful send logs.")}
            {boolField("Ignore SSL errors", item.ignore_ssl, (next) => update(idx, { ...item, ignore_ssl: next }), "Allow self-signed/invalid certs.")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GuidedSettingsForm({ model, onChange, onResetSection }: Props): JSX.Element {
  const updateStarr = (key: "radarr" | "sonarr" | "lidarr" | "readarr", idx: number, next: StarrInstance): void => {
    const arr = [...model[key]];
    arr[idx] = next;
    onChange({ ...model, [key]: arr });
  };

  const removeStarr = (key: "radarr" | "sonarr" | "lidarr" | "readarr", idx: number): void => {
    onChange({ ...model, [key]: model[key].filter((_, i) => i !== idx) });
  };

  const addStarr = (key: "radarr" | "sonarr" | "lidarr" | "readarr"): void => {
    onChange({ ...model, [key]: [...model[key], newStarrInstance()] });
  };

  const updateWebhook = (idx: number, next: WebhookInstance): void => {
    const arr = [...model.webhook];
    arr[idx] = next;
    onChange({ ...model, webhook: arr });
  };

  return (
    <div className="settings-layout">
      <div className="settings-card">
        {sectionHeader("Global", "Primary behavior and logs for Unpackerr.", () => onResetSection("global"))}
        <div className="settings-grid">
          {textField("Polling interval", model.interval, (next) => onChange({ ...model, interval: next }), "How often to check Starr apps.", ["30s", "1m", "2m", "5m"])}
          {textField("Start delay", model.start_delay, (next) => onChange({ ...model, start_delay: next }), "Delay before extraction starts.", ["0s", "30s", "1m", "5m"])}
          {textField("Retry delay", model.retry_delay, (next) => onChange({ ...model, retry_delay: next }), "Wait before retrying failures.", ["1m", "5m", "15m"])}
          {numberField("Max retries", model.max_retries, (next) => onChange({ ...model, max_retries: next }), "How many times to retry a failed extract.")}
          {numberField("Parallel extractions", model.parallel, (next) => onChange({ ...model, parallel: next }), "Simultaneous extractions.", 1)}
          {textField("Log file path", model.log_file, (next) => onChange({ ...model, log_file: next }), "Container path where logs are written.", ["/data/logs/unpackerr.log"])}
          {textField("Extract path", model.extract_path, (next) => onChange({ ...model, extract_path: next }), "Optional alternate extraction location.")}
          {textField("File mode", model.file_mode, (next) => onChange({ ...model, file_mode: next }), "Permissions for extracted files.", ["0644", "0664"])}
          {textField("Directory mode", model.dir_mode, (next) => onChange({ ...model, dir_mode: next }), "Permissions for extracted folders.", ["0755", "0775"])}
          {boolField("Debug logging", model.debug, (next) => onChange({ ...model, debug: next }), "Enable verbose troubleshooting output.")}
          {boolField("Quiet mode", model.quiet, (next) => onChange({ ...model, quiet: next }), "Reduce routine console logging.")}
          {boolField("Errors to stderr", model.error_stderr, (next) => onChange({ ...model, error_stderr: next }), "Write errors to standard error stream.")}
        </div>
      </div>

      <div className="settings-card">
        {sectionHeader("Webserver", "Prometheus/HTTP endpoint configuration.", () => onResetSection("webserver"))}
        <div className="settings-grid">
          {boolField("Enable metrics", model.webserver.metrics, (next) => onChange({ ...model, webserver: { ...model.webserver, metrics: next } }), "Expose metrics endpoint for scraping.")}
          {textField(
            "Listen address",
            model.webserver.listen_addr,
            (next) => onChange({ ...model, webserver: { ...model.webserver, listen_addr: next } }),
            "Bind address and port for metrics/web UI.",
            ["0.0.0.0:5656", "127.0.0.1:5656"]
          )}
          {textField("URL base", model.webserver.urlbase, (next) => onChange({ ...model, webserver: { ...model.webserver, urlbase: next } }), "Path prefix for routes.", ["/"])}
          {textField("SSL cert file", model.webserver.ssl_cert_file, (next) => onChange({ ...model, webserver: { ...model.webserver, ssl_cert_file: next } }), "Certificate path for HTTPS.")}
          {textField("SSL key file", model.webserver.ssl_key_file, (next) => onChange({ ...model, webserver: { ...model.webserver, ssl_key_file: next } }), "Private key path for HTTPS.")}
        </div>
      </div>

      <div className="settings-card">
        {sectionHeader("Folders", "Generic folder watcher settings.", () => onResetSection("folders"))}
        <div className="settings-grid">
          {textField(
            "Downloads paths (comma-separated)",
            model.folders.downloads.join(", "),
            (next) => onChange({ ...model, folders: { ...model.folders, downloads: splitCsv(next) } }),
            "These should match your mounted download folders.",
            ["/downloads"]
          )}
          {textField(
            "Folder interval",
            model.folders.interval,
            (next) => onChange({ ...model, folders: { ...model.folders, interval: next } }),
            "Set 0s to disable periodic folder scans.",
            ["0s", "10s", "30s"]
          )}
          {numberField(
            "Folder buffer",
            model.folders.buffer,
            (next) => onChange({ ...model, folders: { ...model.folders, buffer: next } }),
            "Queue capacity for folder events."
          )}
        </div>
      </div>

      {renderStarrInstance("Radarr", model.radarr, (idx, next) => updateStarr("radarr", idx, next), (idx) => removeStarr("radarr", idx), () => addStarr("radarr"))}
      {renderStarrInstance("Sonarr", model.sonarr, (idx, next) => updateStarr("sonarr", idx, next), (idx) => removeStarr("sonarr", idx), () => addStarr("sonarr"))}
      {renderStarrInstance("Lidarr", model.lidarr, (idx, next) => updateStarr("lidarr", idx, next), (idx) => removeStarr("lidarr", idx), () => addStarr("lidarr"))}
      {renderStarrInstance("Readarr", model.readarr, (idx, next) => updateStarr("readarr", idx, next), (idx) => removeStarr("readarr", idx), () => addStarr("readarr"))}

      {renderWebhookInstance(
        model.webhook,
        updateWebhook,
        (idx) => onChange({ ...model, webhook: model.webhook.filter((_, i) => i !== idx) }),
        () => onChange({ ...model, webhook: [...model.webhook, newWebhookInstance()] })
      )}
    </div>
  );
}
