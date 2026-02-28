import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Lifecycle } from "./pages/Lifecycle";
import { Settings } from "./pages/Settings";
import { FileManager } from "./pages/FileManager";
import { api, type BuildInfo } from "./api/client";

type Tab = "dashboard" | "lifecycle" | "file-manager" | "settings";

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setBuildInfo(await api.getVersion());
      } catch {
        setBuildInfo(null);
      }
    })();
  }, []);

  return (
    <main>
      <h1>Unpackerr Control Plane</h1>
      {buildInfo ? (
        <p className="build-stamp">
          v{buildInfo.appVersion} | commit {buildInfo.buildCommit} | built {buildInfo.buildTime}
        </p>
      ) : null}
      <div className="tab-row">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          Monitor
        </button>
        <button className={tab === "lifecycle" ? "active" : ""} onClick={() => setTab("lifecycle")}>
          Lifecycle
        </button>
        <button className={tab === "file-manager" ? "active" : ""} onClick={() => setTab("file-manager")}>
          File Manager
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>
      {tab === "dashboard" ? <Dashboard /> : null}
      {tab === "lifecycle" ? <Lifecycle /> : null}
      {tab === "file-manager" ? <FileManager /> : null}
      {tab === "settings" ? <Settings /> : null}
    </main>
  );
}
