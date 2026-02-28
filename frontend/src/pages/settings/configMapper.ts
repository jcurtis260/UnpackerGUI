import TOML from "@iarna/toml";

type Dict = Record<string, unknown>;

export type StarrInstance = {
  url: string;
  api_key: string;
  paths: string[];
  protocols: string[];
  timeout: string;
  delete_delay: string;
  delete_orig: boolean;
};

export type WebhookInstance = {
  url: string;
  name: string;
  silent: boolean;
  events: Array<number | string>;
  nickname: string;
  channel: string;
  exclude: string[];
  template: string;
  template_path: string;
  ignore_ssl: boolean;
  timeout: string;
  content_type: string;
};

export type SettingsFormModel = {
  interval: string;
  start_delay: string;
  retry_delay: string;
  max_retries: number;
  parallel: number;
  log_file: string;
  extract_path: string;
  file_mode: string;
  dir_mode: string;
  debug: boolean;
  quiet: boolean;
  error_stderr: boolean;
  webserver: {
    metrics: boolean;
    listen_addr: string;
    urlbase: string;
    ssl_cert_file: string;
    ssl_key_file: string;
  };
  folders: {
    downloads: string[];
    interval: string;
    buffer: number;
  };
  radarr: StarrInstance[];
  sonarr: StarrInstance[];
  lidarr: StarrInstance[];
  readarr: StarrInstance[];
  webhook: WebhookInstance[];
};

const defaultStarr = (): StarrInstance => ({
  url: "",
  api_key: "",
  paths: [],
  protocols: ["torrent", "usenet"],
  timeout: "10s",
  delete_delay: "5m",
  delete_orig: false
});

const defaultWebhook = (): WebhookInstance => ({
  url: "",
  name: "",
  silent: false,
  events: [0],
  nickname: "Unpackerr",
  channel: "",
  exclude: [],
  template: "",
  template_path: "",
  ignore_ssl: false,
  timeout: "10s",
  content_type: "application/json"
});

export const defaultModel = (): SettingsFormModel => ({
  interval: "2m",
  start_delay: "1m",
  retry_delay: "5m",
  max_retries: 3,
  parallel: 1,
  log_file: "/data/logs/unpackerr.log",
  extract_path: "",
  file_mode: "0644",
  dir_mode: "0755",
  debug: false,
  quiet: false,
  error_stderr: true,
  webserver: {
    metrics: false,
    listen_addr: "0.0.0.0:5656",
    urlbase: "/",
    ssl_cert_file: "",
    ssl_key_file: ""
  },
  folders: {
    downloads: ["/downloads"],
    interval: "0s",
    buffer: 20000
  },
  radarr: [],
  sonarr: [],
  lidarr: [],
  readarr: [],
  webhook: []
});

const asRecord = (value: unknown): Dict => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Dict;
  }
  return {};
};

const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asBool = (value: unknown, fallback = false): boolean => (typeof value === "boolean" ? value : fallback);
const asNumber = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const asStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []);

const toStarr = (item: unknown): StarrInstance => {
  const obj = asRecord(item);
  return {
    url: asString(obj.url),
    api_key: asString(obj.api_key),
    paths: asStringArray(obj.paths),
    protocols: asStringArray(obj.protocols),
    timeout: asString(obj.timeout, "10s"),
    delete_delay: asString(obj.delete_delay, "5m"),
    delete_orig: asBool(obj.delete_orig, false)
  };
};

const toWebhook = (item: unknown): WebhookInstance => {
  const obj = asRecord(item);
  return {
    url: asString(obj.url),
    name: asString(obj.name),
    silent: asBool(obj.silent, false),
    events: Array.isArray(obj.events) ? obj.events.map((ev) => (typeof ev === "number" ? ev : String(ev))) : [0],
    nickname: asString(obj.nickname, "Unpackerr"),
    channel: asString(obj.channel),
    exclude: asStringArray(obj.exclude),
    template: asString(obj.template),
    template_path: asString(obj.template_path),
    ignore_ssl: asBool(obj.ignore_ssl, false),
    timeout: asString(obj.timeout, "10s"),
    content_type: asString(obj.content_type, "application/json")
  };
};

export const parseRawToParsed = (raw: string): Dict => asRecord(TOML.parse(raw));

export const toFormModel = (parsedInput: unknown): SettingsFormModel => {
  const parsed = asRecord(parsedInput);
  const defaults = defaultModel();
  const webserver = asRecord(parsed.webserver);
  const folders = asRecord(parsed.folders);

  return {
    interval: asString(parsed.interval, defaults.interval),
    start_delay: asString(parsed.start_delay, defaults.start_delay),
    retry_delay: asString(parsed.retry_delay, defaults.retry_delay),
    max_retries: asNumber(parsed.max_retries, defaults.max_retries),
    parallel: asNumber(parsed.parallel, defaults.parallel),
    log_file: asString(parsed.log_file, defaults.log_file),
    extract_path: asString(parsed.extract_path, defaults.extract_path),
    file_mode: asString(parsed.file_mode, defaults.file_mode),
    dir_mode: asString(parsed.dir_mode, defaults.dir_mode),
    debug: asBool(parsed.debug, defaults.debug),
    quiet: asBool(parsed.quiet, defaults.quiet),
    error_stderr: asBool(parsed.error_stderr, defaults.error_stderr),
    webserver: {
      metrics: asBool(webserver.metrics, defaults.webserver.metrics),
      listen_addr: asString(webserver.listen_addr, defaults.webserver.listen_addr),
      urlbase: asString(webserver.urlbase, defaults.webserver.urlbase),
      ssl_cert_file: asString(webserver.ssl_cert_file),
      ssl_key_file: asString(webserver.ssl_key_file)
    },
    folders: {
      downloads: asStringArray(folders.downloads).length ? asStringArray(folders.downloads) : defaults.folders.downloads,
      interval: asString(folders.interval, defaults.folders.interval),
      buffer: asNumber(folders.buffer, defaults.folders.buffer)
    },
    radarr: Array.isArray(parsed.radarr) ? parsed.radarr.map(toStarr) : [],
    sonarr: Array.isArray(parsed.sonarr) ? parsed.sonarr.map(toStarr) : [],
    lidarr: Array.isArray(parsed.lidarr) ? parsed.lidarr.map(toStarr) : [],
    readarr: Array.isArray(parsed.readarr) ? parsed.readarr.map(toStarr) : [],
    webhook: Array.isArray(parsed.webhook) ? parsed.webhook.map(toWebhook) : []
  };
};

const mergeArrayEntries = (base: unknown, incoming: Dict[]): Dict[] => {
  const baseArr = Array.isArray(base) ? base.map(asRecord) : [];
  return incoming.map((item, idx) => ({ ...asRecord(baseArr[idx]), ...item }));
};

export const applyFormToParsed = (model: SettingsFormModel, baseParsedInput: unknown): Dict => {
  const base = asRecord(baseParsedInput);
  const merged: Dict = { ...base };

  merged.interval = model.interval;
  merged.start_delay = model.start_delay;
  merged.retry_delay = model.retry_delay;
  merged.max_retries = model.max_retries;
  merged.parallel = model.parallel;
  merged.log_file = model.log_file;
  merged.extract_path = model.extract_path;
  merged.file_mode = model.file_mode;
  merged.dir_mode = model.dir_mode;
  merged.debug = model.debug;
  merged.quiet = model.quiet;
  merged.error_stderr = model.error_stderr;

  merged.webserver = {
    ...asRecord(base.webserver),
    ...model.webserver
  };

  merged.folders = {
    ...asRecord(base.folders),
    downloads: model.folders.downloads,
    interval: model.folders.interval,
    buffer: model.folders.buffer
  };

  merged.radarr = mergeArrayEntries(
    base.radarr,
    model.radarr.map((item) => ({ ...item }))
  );
  merged.sonarr = mergeArrayEntries(
    base.sonarr,
    model.sonarr.map((item) => ({ ...item }))
  );
  merged.lidarr = mergeArrayEntries(
    base.lidarr,
    model.lidarr.map((item) => ({ ...item }))
  );
  merged.readarr = mergeArrayEntries(
    base.readarr,
    model.readarr.map((item) => ({ ...item }))
  );
  merged.webhook = mergeArrayEntries(
    base.webhook,
    model.webhook.map((item) => ({ ...item }))
  );

  return merged;
};

export const toRawToml = (model: SettingsFormModel, baseParsed: unknown): string => {
  const merged = applyFormToParsed(model, baseParsed);
  return TOML.stringify(merged as never);
};

export const newStarrInstance = (): StarrInstance => defaultStarr();
export const newWebhookInstance = (): WebhookInstance => defaultWebhook();
