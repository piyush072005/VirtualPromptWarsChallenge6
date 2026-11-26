import { ShieldCheck, Sparkles, Wind } from 'lucide-react';
import type { ImpactSummary } from '@shared/types.ts';

interface ImpactDashboardProps {
  impact: ImpactSummary;
  selectedCount: number;
  totalCount: number;
}

export function ImpactDashboard({
  impact,
  selectedCount,
  totalCount,
}: ImpactDashboardProps) {
  const beforeBarPct = 100;
  const afterBarPct =
    impact.baselineDailyInhaledPm25Ug > 0
      ? Math.max(
          8,
          Math.round(
            (impact.projectedDailyInhaledPm25Ug / impact.baselineDailyInhaledPm25Ug) * 100
          )
        )
      : 100;

  return (
    <section aria-labelledby="impact-heading" className="card">
      <h2 id="impact-heading" className="section-heading">
        <ShieldCheck size={20} aria-hidden="true" />
        Direct Impact of Your Choices ({selectedCount} of {totalCount} active)
      </h2>

      <div className="telemetry-grid">
        <div className="metric-box">
          <div className="metric-label">Inhaled PM2.5 Reduction</div>
          <div className="metric-value">{impact.exposureReductionPct}%</div>
          <div className="metric-sub">
            {impact.dailyPm25AvoidedUg} µg/day avoided per adult
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">Indoor Air Level</div>
          <div className="metric-value">
            {impact.projectedIndoorPm25} µg/m³
          </div>
          <div className="metric-sub">
            Down from {impact.baselineIndoorPm25} µg/m³ baseline
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">Annual CO₂e Avoided</div>
          <div className="metric-value">{impact.annualCo2eSavedKg.toLocaleString()} kg</div>
          <div className="metric-sub">
            Plus {impact.annualTailpipeAndHomePm25SavedG.toLocaleString()} g soot eliminated
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">Comparative Lung Relief</div>
          <div className="metric-value">
            -{impact.cigaretteEquivalenceReducedPerWeek}/wk
          </div>
          <div className="metric-sub">
            Cigarette-equivalent PM2.5 burden reduced
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.65rem' }}>
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            <span>Without tailored routine (Baseline)</span>
            <span>
              {impact.baselineDailyInhaledPm25Ug} µg/day ({impact.whoGuidelineRatioBefore}× WHO 24h guideline)
            </span>
          </div>
          <div className="compare-bar-track" aria-hidden="true">
            <div
              className="compare-bar-fill bar-before"
              style={{ width: `${beforeBarPct}%` }}
            />
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            <span>With your active clean-air choices</span>
            <span>
              {impact.projectedDailyInhaledPm25Ug} µg/day ({impact.whoGuidelineRatioAfter}× WHO 24h guideline)
            </span>
          </div>
          <div className="compare-bar-track" aria-hidden="true">
            <div
              className="compare-bar-fill bar-after"
              style={{ width: `${afterBarPct}%` }}
            />
          </div>
        </div>
      </div>

      <details style={{ marginTop: '0.85rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          <Sparkles size={15} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
          How your direct impact is calculated
        </summary>
        <p className="muted-text" style={{ marginTop: '0.45rem', marginBottom: 0 }}>
          <Wind size={14} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />
          We model indoor infiltration from your home seal type, add indoor cooking/heating
          combustion bursts, weight time spent indoors vs. outdoors by AQI severity, multiply by
          14.2 m³/day adult inhalation volume (EPA Exposure Factors), and compare against the
          WHO 2021 24-hour PM2.5 guideline (15 µg/m³). Toggle actions below to test scenarios.
        </p>
      </details>
    </section>
  );
}
