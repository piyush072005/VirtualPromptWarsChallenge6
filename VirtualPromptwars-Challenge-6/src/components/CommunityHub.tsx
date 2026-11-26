import { Copy, Check, Users } from 'lucide-react';
import { useState } from 'react';
import type { AssistantPlan, ImpactSummary } from '@shared/types.ts';

interface CommunityHubProps {
  bulletin: AssistantPlan['communityBulletin'];
  impact: ImpactSummary;
  city: string;
}

export function CommunityHub({ bulletin, impact, city }: CommunityHubProps) {
  const [familiesCount, setFamiliesCount] = useState(15);
  const [copied, setCopied] = useState(false);

  const scaledCo2eKg = Math.round(impact.annualCo2eSavedKg * familiesCount);
  const scaledSootG = Math.round(
    impact.annualTailpipeAndHomePm25SavedG * familiesCount
  );
  const filterBulkSavingsUsd = familiesCount * 18;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${bulletin.title}\n\n${bulletin.message}\n\n${bulletin.schoolAdvisory}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="community-heading" className="card">
      <h2 id="community-heading" className="section-heading">
        <Users size={20} aria-hidden="true" />
        Community & School Action Hub ({city})
      </h2>

      <div className="field-group" style={{ marginBottom: '1rem' }}>
        <label htmlFor="community-families-slider" className="field-label">
          Neighborhood Ripple Simulator: <strong>{familiesCount} families</strong>{" "}
          adopting your clean-air routine
        </label>
        <input
          id="community-families-slider"
          type="range"
          min={2}
          max={100}
          value={familiesCount}
          onChange={(e) => setFamiliesCount(Number(e.target.value))}
        />
      </div>

      <div className="telemetry-grid" style={{ marginBottom: '1rem' }}>
        <div className="metric-box">
          <div className="metric-label">Community CO₂e Avoided</div>
          <div className="metric-value">{scaledCo2eKg.toLocaleString()} kg/yr</div>
          <div className="metric-sub">Across {familiesCount} households</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Neighborhood Soot Cut</div>
          <div className="metric-value">{(scaledSootG / 1000).toFixed(2)} kg/yr</div>
          <div className="metric-sub">Direct urban PM2.5 avoided</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Bulk Filter Savings</div>
          <div className="metric-value">${filterBulkSavingsUsd}</div>
          <div className="metric-sub">Est. group MERV-13 discount</div>
        </div>
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.9rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.5rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{bulletin.title}</h3>
          <button type="button" className="btn btn-secondary" onClick={() => void handleCopy()}>
            {copied ? (
              <>
                <Check size={15} aria-hidden="true" />
                <span>Copied bulletin</span>
              </>
            ) : (
              <>
                <Copy size={15} aria-hidden="true" />
                <span>Copy for WhatsApp / PTA</span>
              </>
            )}
          </button>
        </div>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.92rem' }}>{bulletin.message}</p>
        <p className="muted-text" style={{ margin: 0 }}>
          {bulletin.schoolAdvisory}
        </p>
      </div>
    </section>
  );
}
