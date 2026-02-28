export type SettingType = "string" | "boolean" | "number" | "duration" | "array" | "select";

export type SettingDefinition = {
  key: string;
  label: string;
  type: SettingType;
  description: string;
  defaultValue: string;
  suggestions?: string[];
  tip?: string;
};

export type SettingsSection = {
  id: string;
  title: string;
  description: string;
  settings: SettingDefinition[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "global",
    title: "Global",
    description: "Core runtime behavior and logging controls.",
    settings: [
      { key: "interval", label: "Polling interval", type: "duration", description: "How often Unpackerr checks Starr apps.", defaultValue: "2m", suggestions: ["30s", "1m", "2m", "5m"] },
      { key: "start_delay", label: "Start delay", type: "duration", description: "Wait before extracting newly imported downloads.", defaultValue: "1m", suggestions: ["0s", "30s", "1m", "5m"] },
      { key: "retry_delay", label: "Retry delay", type: "duration", description: "Delay before retrying failed extraction.", defaultValue: "5m", suggestions: ["1m", "5m", "15m"] },
      { key: "max_retries", label: "Max retries", type: "number", description: "Maximum extraction retries per item.", defaultValue: "3", suggestions: ["0", "1", "3", "5"] },
      { key: "parallel", label: "Parallel extractions", type: "number", description: "How many extractions can run at once.", defaultValue: "1", suggestions: ["1", "2", "3", "4"] },
      { key: "log_file", label: "Log file path", type: "string", description: "Path to write Unpackerr logs.", defaultValue: "/data/logs/unpackerr.log", suggestions: ["/data/logs/unpackerr.log"] },
      { key: "extract_path", label: "Extraction path", type: "string", description: "Optional alternate path for extracted files.", defaultValue: "", tip: "Leave empty to extract in-place with the download." },
      { key: "file_mode", label: "File mode", type: "string", description: "Permissions applied to extracted files.", defaultValue: "0644", suggestions: ["0644", "0664"] },
      { key: "dir_mode", label: "Directory mode", type: "string", description: "Permissions applied to extracted folders.", defaultValue: "0755", suggestions: ["0755", "0775"] },
      { key: "debug", label: "Debug logging", type: "boolean", description: "Enable verbose debugging output.", defaultValue: "false" },
      { key: "quiet", label: "Quiet mode", type: "boolean", description: "Reduce standard output noise.", defaultValue: "false" },
      { key: "error_stderr", label: "Errors to stderr", type: "boolean", description: "Write errors to stderr stream.", defaultValue: "true" }
    ]
  },
  {
    id: "webserver",
    title: "Webserver",
    description: "Prometheus metrics and embedded web server behavior.",
    settings: [
      { key: "webserver.metrics", label: "Enable metrics", type: "boolean", description: "Expose Prometheus metrics endpoint.", defaultValue: "false" },
      { key: "webserver.listen_addr", label: "Listen address", type: "string", description: "Bind address for metrics/web server.", defaultValue: "0.0.0.0:5656", suggestions: ["0.0.0.0:5656", "127.0.0.1:5656"] },
      { key: "webserver.urlbase", label: "URL base", type: "string", description: "Prefix path for web routes.", defaultValue: "/" },
      { key: "webserver.ssl_cert_file", label: "SSL cert file", type: "string", description: "TLS certificate path.", defaultValue: "" },
      { key: "webserver.ssl_key_file", label: "SSL key file", type: "string", description: "TLS private key path.", defaultValue: "" }
    ]
  },
  {
    id: "folders",
    title: "Folders",
    description: "Folder watcher behavior for generic download paths.",
    settings: [
      { key: "folders.downloads", label: "Downloads directories", type: "array", description: "List of download paths to monitor.", defaultValue: "[\"/downloads\"]", suggestions: ["/downloads"] },
      { key: "folders.interval", label: "Folder poll interval", type: "duration", description: "How often folder watcher scans.", defaultValue: "0s", suggestions: ["0s", "10s", "30s"] },
      { key: "folders.buffer", label: "Folder queue buffer", type: "number", description: "Queue size for folder events.", defaultValue: "20000", suggestions: ["1000", "5000", "20000"] }
    ]
  },
  {
    id: "starrApps",
    title: "Starr Applications",
    description: "Shared fields for Radarr, Sonarr, Lidarr, and Readarr instances.",
    settings: [
      { key: "radarr[].url", label: "Instance URL", type: "string", description: "Base URL of the Starr app instance.", defaultValue: "http://radarr:7878", suggestions: ["http://radarr:7878", "http://sonarr:8989"] },
      { key: "radarr[].api_key", label: "API key", type: "string", description: "App API key from the Starr instance.", defaultValue: "" },
      { key: "radarr[].paths", label: "Paths", type: "array", description: "Paths associated with this app instance.", defaultValue: "[]", suggestions: ["/downloads"] },
      { key: "radarr[].protocols", label: "Protocols", type: "array", description: "Filter by protocol values such as torrent or usenet.", defaultValue: "[\"torrent\",\"usenet\"]", suggestions: ["torrent", "usenet"] },
      { key: "radarr[].timeout", label: "Timeout", type: "duration", description: "API request timeout for this app.", defaultValue: "10s", suggestions: ["5s", "10s", "30s"] },
      { key: "radarr[].delete_delay", label: "Delete delay", type: "duration", description: "Delay before cleanup of extracted originals.", defaultValue: "5m", suggestions: ["0s", "1m", "5m"] },
      { key: "radarr[].delete_orig", label: "Delete originals", type: "boolean", description: "Delete original archive source after successful extraction.", defaultValue: "false" }
    ]
  },
  {
    id: "webhooks",
    title: "Webhooks",
    description: "Notification hooks for queue/start/finish/delete events.",
    settings: [
      { key: "webhook[].url", label: "Webhook URL", type: "string", description: "Destination endpoint for notifications.", defaultValue: "" },
      { key: "webhook[].name", label: "Name", type: "string", description: "Friendly label shown in logs.", defaultValue: "" },
      { key: "webhook[].silent", label: "Silent success", type: "boolean", description: "Suppress successful post logs.", defaultValue: "false" },
      { key: "webhook[].events", label: "Events", type: "array", description: "Numeric event IDs to send; [0] means all.", defaultValue: "[0]", suggestions: ["0", "1", "2", "3", "4"] },
      { key: "webhook[].nickname", label: "Nickname", type: "string", description: "Bot/display name for the message.", defaultValue: "Unpackerr", suggestions: ["Unpackerr"] },
      { key: "webhook[].channel", label: "Channel", type: "string", description: "Optional destination channel (provider-dependent).", defaultValue: "" },
      { key: "webhook[].exclude", label: "Exclude apps", type: "array", description: "Apps to exclude from notifications.", defaultValue: "[]", suggestions: ["radarr", "sonarr", "lidarr", "readarr"] },
      { key: "webhook[].template", label: "Template", type: "select", description: "Built-in payload template name.", defaultValue: "", suggestions: ["notifiarr", "discord", "telegram", "gotify", "pushover", "slack"] },
      { key: "webhook[].template_path", label: "Template path", type: "string", description: "Custom template path on disk.", defaultValue: "" },
      { key: "webhook[].ignore_ssl", label: "Ignore SSL errors", type: "boolean", description: "Allow invalid TLS certificates.", defaultValue: "false" },
      { key: "webhook[].timeout", label: "Webhook timeout", type: "duration", description: "Timeout waiting for webhook response.", defaultValue: "10s", suggestions: ["5s", "10s", "30s"] },
      { key: "webhook[].content_type", label: "Content type", type: "string", description: "Payload content type header.", defaultValue: "application/json", suggestions: ["application/json", "application/x-www-form-urlencoded"] }
    ]
  }
];
