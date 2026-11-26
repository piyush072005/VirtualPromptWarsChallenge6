import { CheckCircle2, Filter, Home, Leaf, Clock } from 'lucide-react';
import { useState } from 'react';
import type { ActionItem, RecommendationCategory } from '@shared/types.ts';

interface ActionPlanListProps {
  actions: ActionItem[];
  selectedActionIds: string[];
  onToggleAction: (id: string) => void;
}

const CATEGORY_META: Record<
  RecommendationCategory,
  { label: string; icon: typeof Clock }
> = {
  routine: { label: 'Low-Emission Routine', icon: Clock },
  indoor_hack: { label: 'Indoor Air Hack', icon: Home },
  sustainable_alt: { label: 'Sustainable Alternative', icon: Leaf },
};

export function ActionPlanList({
  actions,
  selectedActionIds,
  onToggleAction,
}: ActionPlanListProps) {
  const [filter, setFilter] = useState<'all' | RecommendationCategory>('all');

  const visibleActions =
    filter === 'all' ? actions : actions.filter((a) => a.category === filter);

  return (
    <section aria-labelledby="actions-heading" className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.6rem',
          marginBottom: '0.85rem',
        }}
      >
        <h2 id="actions-heading" className="section-heading" style={{ marginBottom: 0 }}>
          <CheckCircle2 size={20} aria-hidden="true" />
          Tailored Action Plan & Scenario Builder
        </h2>

        <div className="preset-chips" role="group" aria-label="Filter recommendations by category">
          <Filter size={15} aria-hidden="true" style={{ alignSelf: 'center', marginRight: '0.2rem' }} />
          {(
            [
              { id: 'all', label: `All (${actions.length})` },
              { id: 'routine', label: 'Routines' },
              { id: 'indoor_hack', label: 'Indoor Hacks' },
              { id: 'sustainable_alt', label: 'Sustainable Shifts' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="chip-btn"
              aria-pressed={filter === tab.id}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="muted-text" style={{ marginTop: 0 }}>
        Toggle any recommendation on or off to simulate the exact change in your family’s
        inhaled PM2.5 and annual emissions above.
      </p>

      <div className="action-list">
        {visibleActions.map((action) => {
          const isSelected = selectedActionIds.includes(action.id);
          const meta = CATEGORY_META[action.category];
          const Icon = meta.icon;

          return (
            <article
              key={action.id}
              className={`action-card ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="action-card-header">
                <div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    <span className={`pill-tag pill-${action.category}`}>
                      <Icon size={13} aria-hidden="true" />
                      {meta.label}
                    </span>
                    <span className="pill-tag">Cost: {action.estimatedCost}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{action.title}</h3>
                </div>

                <label className="checkbox-label" style={{ fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleAction(action.id)}
                    aria-label={`Include "${action.title}" in impact simulation`}
                  />
                  <span>{isSelected ? 'Active' : 'Off'}</span>
                </label>
              </div>

              <p style={{ margin: '0.5rem 0 0', fontSize: '0.94rem' }}>{action.summary}</p>

              <div className="impact-callout">
                <strong>Direct Impact:</strong> Cuts exposure by{' '}
                <strong>{action.pm25ExposureReductionPct}%</strong> (~
                {action.dailyInhaledPm25SavedUg} µg/day PM2.5 avoided)
                {action.annualCo2eSavedKg > 0 && (
                  <>
                    {' '}
                    · Prevents <strong>{action.annualCo2eSavedKg} kg CO₂e/yr</strong>
                  </>
                )}
                {action.annualPm25EmittedSavedG > 0 && (
                  <>
                    {' '}
                    and <strong>{action.annualPm25EmittedSavedG} g/yr</strong> local soot
                  </>
                )}
                .
                <div style={{ marginTop: '0.25rem', color: '#1e293b' }}>
                  <em>Why it works:</em> {action.whyItMatters}
                </div>
              </div>

              <p className="muted-text" style={{ margin: '0.55rem 0 0' }}>
                <strong>Tailored for you:</strong> {action.tailoredReason}
              </p>

              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                  Step-by-step guide & science note
                </summary>
                <ol className="steps-list">
                  {action.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <p className="muted-text" style={{ marginTop: '0.45rem', marginBottom: 0 }}>
                  Basis: {action.scientificBasis}
                </p>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
