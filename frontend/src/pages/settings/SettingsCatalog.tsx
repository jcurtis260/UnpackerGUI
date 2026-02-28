import { useMemo, useState } from "react";
import { SETTINGS_SECTIONS } from "./settingsSchema";

export function SettingsCatalog(): JSX.Element {
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!normalized) {
      return SETTINGS_SECTIONS;
    }
    return SETTINGS_SECTIONS.map((section) => ({
      ...section,
      settings: section.settings.filter((setting) => {
        const haystack = `${setting.key} ${setting.label} ${setting.description} ${setting.defaultValue}`.toLowerCase();
        return haystack.includes(normalized);
      })
    })).filter((section) => section.settings.length > 0);
  }, [normalized]);

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div>
          <h3>All Settings Catalog</h3>
          <p className="hint">Search every available setting key with defaults, tips, and suggested values.</p>
        </div>
      </div>
      <label className="settings-field">
        <span>Search settings</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try: delete_orig, metrics, webhook" />
      </label>
      <div className="catalog-list">
        {sections.map((section) => (
          <div key={section.id} className="catalog-section">
            <h4>{section.title}</h4>
            <p className="hint">{section.description}</p>
            {section.settings.map((setting) => (
              <div key={setting.key} className="catalog-item">
                <code>{setting.key}</code>
                <strong>{setting.label}</strong>
                <p>{setting.description}</p>
                <p className="hint">
                  Default: <code>{setting.defaultValue}</code>
                </p>
                {setting.tip ? <p className="hint">Tip: {setting.tip}</p> : null}
                {setting.suggestions?.length ? (
                  <p className="hint">
                    Suggestions: <code>{setting.suggestions.join(", ")}</code>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
