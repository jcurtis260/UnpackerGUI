type Props = {
  rawConfig: string;
  onRawConfigChange: (next: string) => void;
  onValidate: () => Promise<void>;
  onSave: () => Promise<void>;
  onApplyGuidedToRaw: () => void;
  onLoadRawToGuided: () => Promise<void>;
};

export function AdvancedTomlEditor({
  rawConfig,
  onRawConfigChange,
  onValidate,
  onSave,
  onApplyGuidedToRaw,
  onLoadRawToGuided
}: Props): JSX.Element {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div>
          <h3>Advanced TOML Editor</h3>
          <p className="hint">Use this mode for power-user edits, custom keys, and exact formatting control.</p>
        </div>
      </div>
      <div className="hint-box">
        <p>
          Tip: use <strong>Apply guided changes to raw</strong> to generate TOML from the form, or{" "}
          <strong>Load raw into guided</strong> to parse current editor text back into form boxes.
        </p>
      </div>
      <textarea value={rawConfig} onChange={(e) => onRawConfigChange(e.target.value)} rows={22} />
      <div className="button-row">
        <button onClick={() => void onValidate()}>Validate</button>
        <button onClick={() => void onSave()}>Save</button>
        <button onClick={onApplyGuidedToRaw}>Apply guided changes to raw</button>
        <button onClick={() => void onLoadRawToGuided()}>Load raw into guided</button>
      </div>
    </div>
  );
}
