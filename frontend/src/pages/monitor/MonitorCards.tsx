import type { JobCard, MonitorRequirements } from "./monitorTypes";

type Props = {
  active: JobCard[];
  queued: JobCard[];
  completed: JobCard[];
  requirements: MonitorRequirements;
};

function ProgressBar({ progress, indeterminate }: { progress: number | null; indeterminate: boolean }): JSX.Element {
  if (indeterminate) {
    return (
      <div className="progress-shell">
        <div className="progress-indeterminate" />
      </div>
    );
  }
  return (
    <div className="progress-shell">
      <div className="progress-fill" style={{ width: `${progress ?? 0}%` }} />
    </div>
  );
}

function JobCardView({ card }: { card: JobCard }): JSX.Element {
  return (
    <div className={`job-card state-${card.state}`}>
      <div className="job-card-head">
        <strong>{card.label}</strong>
        <span>{card.state}</span>
      </div>
      <ProgressBar progress={card.progress} indeterminate={card.indeterminate} />
      <p className="hint">{card.progress !== null ? `${card.progress}%` : "In progress"}</p>
      <p className="hint">{card.lastMessage}</p>
    </div>
  );
}

export function MonitorCards({ active, queued, completed, requirements }: Props): JSX.Element {
  return (
    <div className="monitor-cards-wrap">
      {requirements.warnings.length ? (
        <div className="monitor-warning">
          {requirements.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="monitor-cards-grid">
        <div className="monitor-card-group">
          <h3>Active ({active.length})</h3>
          {active.length ? active.map((card) => <JobCardView key={card.id} card={card} />) : <p className="hint">No active unpack jobs.</p>}
        </div>

        <div className="monitor-card-group">
          <h3>Queued ({queued.length})</h3>
          {queued.length ? queued.map((card) => <JobCardView key={card.id} card={card} />) : <p className="hint">No queued jobs.</p>}
        </div>
      </div>

      <div className="monitor-card-group">
        <h3>Recent Completed ({completed.length})</h3>
        {completed.length ? completed.map((card) => <JobCardView key={card.id} card={card} />) : <p className="hint">No completed jobs yet.</p>}
      </div>
    </div>
  );
}
