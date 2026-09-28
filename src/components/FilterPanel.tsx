import { FILTER_FIELDS, PRESETS, activeFilterCount, type ConfFilter, type FlipFilters, type MemberFilter } from '../lib/filters';
import { Field, Segmented } from './Controls';
import { Icon } from './Icon';

interface Props {
  filters: FlipFilters;
  setFilters: (patch: Partial<FlipFilters>) => void;
  reset: () => void;
  /** id prefix so the sidebar and the sheet can coexist. */
  idPrefix: string;
  showHeader?: boolean;
}

export function FilterPanel({ filters, setFilters, reset, idPrefix, showHeader = true }: Props) {
  const active = activeFilterCount(filters);
  const presetOn = (values: Record<string, string>) => Object.entries(values).every(([k, v]) => filters[k as keyof FlipFilters] === v);
  return (
    <div className="filters">
      {showHeader && (
        <div className="filters-head">
          <div className="filters-title">
            <Icon name="sliders" />
            Filters
            <span className="badge gold">{active} active</span>
          </div>
          <button type="button" className="btn small plain" onClick={reset}>
            Reset
          </button>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div className="section-label">Presets</div>
        <div className="chips">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn small"
              aria-pressed={presetOn(p.values)}
              onClick={() => setFilters(p.values)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {FILTER_FIELDS.map((g) => (
        <div className="filter-group" key={g.title}>
          <div className="section-label">{g.title}</div>
          <div className="filter-grid">
            {g.fields.map((f) => (
              <Field
                key={f.key}
                id={`${idPrefix}-${f.key}`}
                label={f.label}
                placeholder={f.placeholder}
                value={filters[f.key]}
                onChange={(v) => setFilters({ [f.key]: v })}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="filter-group">
        <div className="section-label" title="How likely the suggested offers are to fill: liquidity, margin stability, spikes and trend">
          Fill confidence
        </div>
        <Segmented<ConfFilter>
          label="Minimum fill confidence"
          className="fill"
          value={filters.minConf}
          onChange={(minConf) => setFilters({ minConf })}
          options={[
            { value: 'any', label: 'Any' },
            { value: 'med', label: 'Medium+' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>

      <div className="filter-group">
        <div className="section-label">Membership</div>
        <Segmented<MemberFilter>
          label="Membership"
          className="fill"
          value={filters.member}
          onChange={(member) => setFilters({ member })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'mem', label: 'Members' },
            { value: 'f2p', label: 'F2P' },
          ]}
        />
      </div>
      <p className="panel-sub" style={{ margin: 0 }}>
        Amounts accept k, m and b, e.g. 50k or 2.5m.
      </p>
    </div>
  );
}
