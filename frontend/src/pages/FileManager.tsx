import { useEffect, useMemo, useState } from "react";
import { api, type FileListEntry, type MountRoot, type QueueJob, type QueueSnapshot } from "../api/client";

const ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz"];

export function FileManager(): JSX.Element {
  const [mounts, setMounts] = useState<MountRoot[]>([]);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileListEntry[]>([]);
  const [selectedEntryPath, setSelectedEntryPath] = useState("");
  const [queue, setQueue] = useState<QueueSnapshot>({
    active: null,
    queued: [],
    history: []
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedRoot = useMemo(() => mounts.find((item) => item.id === selectedRootId) ?? null, [mounts, selectedRootId]);

  useEffect(() => {
    void (async () => {
      try {
        const mountResponse = await api.getMounts();
        setMounts(mountResponse.mounts);
        if (mountResponse.mounts.length > 0) {
          setSelectedRootId(mountResponse.mounts[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mounted folders.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRootId) {
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const result = await api.listFiles(selectedRootId, currentPath);
        setEntries(result.entries);
        setCurrentPath(result.currentPath);
        setParentPath(result.parentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to list files.");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedRootId, currentPath]);

  useEffect(() => {
    const pullQueue = async (): Promise<void> => {
      try {
        setQueue(await api.getQueue());
      } catch {
        // Keep stale queue view if fetch fails.
      }
    };
    void pullQueue();
    const timer = setInterval(() => {
      void pullQueue();
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const enqueueSelected = async (): Promise<void> => {
    if (!selectedRootId || !selectedEntryPath) {
      return;
    }
    setMessage("");
    setError("");
    try {
      const job = await api.enqueueArchive(selectedRootId, selectedEntryPath);
      setMessage(`Queued ${job.sourceRelativePath}`);
      setSelectedEntryPath("");
      setQueue(await api.getQueue());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue archive.");
    }
  };

  const cancelJob = async (jobId: string): Promise<void> => {
    setMessage("");
    setError("");
    try {
      const result = await api.cancelQueueJob(jobId);
      if (result.cancelled) {
        setMessage("Queue item cancelled.");
      } else {
        setMessage("Queue item was not active.");
      }
      setQueue(await api.getQueue());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel queue item.");
    }
  };

  const openFolder = (entry: FileListEntry): void => {
    setSelectedEntryPath("");
    setCurrentPath(entry.relativePath);
  };

  const selectedFile = entries.find((item) => item.relativePath === selectedEntryPath && !item.isDirectory) ?? null;
  const selectedFileIsArchive = selectedFile ? isArchive(selectedFile.name) : false;

  return (
    <div className="panel">
      <h2>File Manager</h2>
      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="file-manager-layout">
        <section className="settings-card">
          <h3>Mounted Folders</h3>
          <div className="mount-list">
            {mounts.map((mount) => (
              <button
                key={mount.id}
                className={selectedRootId === mount.id ? "active mount-item" : "mount-item"}
                onClick={() => {
                  setSelectedRootId(mount.id);
                  setCurrentPath("");
                  setSelectedEntryPath("");
                }}
              >
                {mount.label}
              </button>
            ))}
            {mounts.length === 0 ? <p className="hint">No mounted roots detected from environment.</p> : null}
          </div>
          {selectedRoot ? <p className="hint">Path: {selectedRoot.absolutePath}</p> : null}
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <div>
              <h3>Browse</h3>
              <p className="hint">
                {selectedRoot ? `${selectedRoot.label}: /${currentPath}` : "Select a mounted root"}
              </p>
            </div>
            <div className="button-row">
              <button disabled={!selectedRootId || loading} onClick={() => setCurrentPath("")}>
                Root
              </button>
              <button disabled={!selectedRootId || parentPath === null || loading} onClick={() => setCurrentPath(parentPath ?? "")}>
                Up
              </button>
            </div>
          </div>
          <div className="file-list">
            {entries.map((entry) => (
              <div key={entry.relativePath} className="file-row">
                {entry.isDirectory ? (
                  <button className="file-name-btn" onClick={() => openFolder(entry)}>
                    {entry.name}/
                  </button>
                ) : (
                  <label className="file-pick-label">
                    <input
                      type="radio"
                      name="file-select"
                      checked={selectedEntryPath === entry.relativePath}
                      onChange={() => setSelectedEntryPath(entry.relativePath)}
                    />
                    <span>{entry.name}</span>
                  </label>
                )}
                <span className="hint">{entry.isDirectory ? "dir" : formatSize(entry.size)}</span>
              </div>
            ))}
            {!loading && entries.length === 0 ? <p className="hint">Folder is empty.</p> : null}
            {loading ? <p className="hint">Loading...</p> : null}
          </div>
          <div className="button-row">
            <button disabled={!selectedFile || !selectedFileIsArchive} onClick={() => void enqueueSelected()}>
              Add to queue
            </button>
          </div>
          {selectedFile && !selectedFileIsArchive ? (
            <p className="hint">Selected file is not an archive. Supported: {ARCHIVE_EXTENSIONS.join(", ")}</p>
          ) : null}
        </section>
      </div>

      <section className="settings-card">
        <h3>Active Queue</h3>
        {queue.active ? (
          <QueueJobRow
            title="Running now"
            job={queue.active}
            showCancel
            onCancel={(id) => {
              void cancelJob(id);
            }}
          />
        ) : (
          <p className="hint">No active unpack task.</p>
        )}
        <h3>Queued</h3>
        {queue.queued.length ? (
          queue.queued.map((job) => (
            <QueueJobRow
              key={job.id}
              title="Pending"
              job={job}
              showCancel
              onCancel={(id) => {
                void cancelJob(id);
              }}
            />
          ))
        ) : (
          <p className="hint">No pending queue items.</p>
        )}
        <h3>Recent History</h3>
        {queue.history.length ? (
          queue.history
            .slice()
            .reverse()
            .slice(0, 10)
            .map((job) => <QueueJobRow key={job.id} title="Completed" job={job} />)
        ) : (
          <p className="hint">No queue history yet.</p>
        )}
      </section>
    </div>
  );
}

function QueueJobRow({
  title,
  job,
  showCancel,
  onCancel
}: {
  title: string;
  job: QueueJob;
  showCancel?: boolean;
  onCancel?: (jobId: string) => void;
}): JSX.Element {
  return (
    <div className="queue-job-row">
      <div>
        <strong>{title}</strong> <span className="hint">[{job.state}]</span>
      </div>
      <code>{job.sourceRelativePath}</code>
      <div className="status-row">
        <span>Created: {formatTime(job.createdAt)}</span>
        <span>Started: {job.startedAt ? formatTime(job.startedAt) : "n/a"}</span>
        <span>Finished: {job.finishedAt ? formatTime(job.finishedAt) : "n/a"}</span>
      </div>
      {job.outputPath ? <p className="hint">Output: {job.outputPath}</p> : null}
      {job.error ? <p className="error">{job.error}</p> : null}
      {showCancel ? (
        <div className="button-row">
          <button onClick={() => onCancel?.(job.id)}>Cancel</button>
        </div>
      ) : null}
    </div>
  );
}

function isArchive(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "n/a";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
