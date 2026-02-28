import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Lifecycle } from "./pages/Lifecycle";
import { Settings } from "./pages/Settings";

type Tab = "dashboard" | "lifecycle" | "settings";

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <main>
      <h1>Unpackerr Control Plane</h1>
      <div className="tab-row">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          Monitor
        </button>
        <button className={tab === "lifecycle" ? "active" : ""} onClick={() => setTab("lifecycle")}>
          Lifecycle
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>
      {tab === "dashboard" ? <Dashboard /> : null}
      {tab === "lifecycle" ? <Lifecycle /> : null}
      {tab === "settings" ? <Settings /> : null}
    </main>
  );
}
