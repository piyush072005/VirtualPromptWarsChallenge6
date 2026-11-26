import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CloudFog,
  Thermometer,
  Users,
  Wind,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeImpactSummary, findKeyTimeWindows } from '@shared/airQuality.ts';
import { buildTailoredActions } from '@shared/interventions.ts';
import {
  buildPresetTelemetry,
  CITY_PRESETS,
  DEFAULT_HOUSEHOLD_PROFILE,
} from '@shared/presets.ts';
import type {
  AssistantPlan,
  HouseholdProfile,
  LocationTelemetry,
} from '@shared/types.ts';
import { fetchPlan } from './api/client.ts';
import { ActionPlanList } from './components/ActionPlanList.tsx';
import { CommunityHub } from './components/CommunityHub.tsx';
import { DiurnalChart } from './components/DiurnalChart.tsx';
import { GenAiCoach } from './components/GenAiCoach.tsx';
import { ImpactDashboard } from './components/ImpactDashboard.tsx';
import { ProfileForm } from './components/ProfileForm.tsx';

type ActiveTab = 'plan' | 'coach' | 'community';

export function App() {
  const [profile, setProfile] = useState<HouseholdProfile>(DEFAULT_HOUSEHOLD_PROFILE);
  const [telemetry, setTelemetry] = useState<LocationTelemetry>(() =>
    buildPresetTelemetry(CITY_PRESETS[0]!, true)
  );
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(() =>
    buildTailoredActions(
      buildPresetTelemetry(CITY_PRESETS[0]!, true),
      DEFAULT_HOUSEHOLD_PROFILE
    ).map((a) => a.id)
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('plan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState('');

  const requestSeq = useRef(0);

  const syncWithServer = useCallback(
    async (
      nextProfile: HouseholdProfile,
      actionIds: string[],
      cityOverride?: string
    ) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPlan(nextProfile, actionIds, cityOverride);
        if (seq !== requestSeq.current) return;
        setTelemetry(res.telemetry);
        setPlan(res.plan);
        setSelectedActionIds((prev) => {
          const validIds = new Set(res.plan.actions.map((a) => a.id));
          const kept = prev.filter((id) => validIds.has(id));
          return kept.length > 0 ? kept : res.plan.actions.map((a) => a.id);
        });
        setLiveStatus(
          `Updated plan for ${res.telemetry.city}. AQI ${res.telemetry.aqi} (${res.telemetry.aqiCategory.label}).`
        );
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Using local air-quality model (server unavailable).'
        );
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void syncWithServer(DEFAULT_HOUSEHOLD_PROFILE, selectedActionIds);
    // Run once on mount to fetch live/server telemetry & GenAI brief
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute actions & impact locally in zero milliseconds whenever toggles or profile shift
  const localActions = useMemo(
    () => plan?.actions ?? buildTailoredActions(telemetry, profile),
    [plan?.actions, telemetry, profile]
  );

  const activeActions = useMemo(() => {
    const selectedSet = new Set(selectedActionIds);
    return localActions.filter((a) => selectedSet.has(a.id));
  }, [localActions, selectedActionIds]);

  const liveImpact = useMemo(
    () => computeImpactSummary(telemetry, profile, activeActions),
    [telemetry, profile, activeActions]
  );

  const windows = useMemo(
    () => findKeyTimeWindows(telemetry.hourlyForecast),
    [telemetry.hourlyForecast]
  );

  const handleProfileChange = (nextProfile: HouseholdProfile) => {
    setProfile(nextProfile);
    const updatedActions = buildTailoredActions(telemetry, nextProfile);
    const allIds = updatedActions.map((a) => a.id);
    setSelectedActionIds(allIds);
    void syncWithServer(nextProfile, allIds);
  };

  const handleCityLookup = (cityName: string, presetId?: string) => {
    const nextProfile: HouseholdProfile = {
      ...profile,
      city: cityName,
      presetId,
    };
    setProfile(nextProfile);
    void syncWithServer(nextProfile, selectedActionIds, cityName);
  };

  const handleToggleAction = (actionId: string) => {
    setSelectedActionIds((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId]
    );
  };

  const aqiClass = `aqi-${telemetry.aqiCategory.colorToken}`;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1 className="brand-title">
              <CloudFog size={28} aria-hidden="true" />
              AeroShield Family — Urban Air Quality Assistant
            </h1>
            <p className="brand-subtitle">
              GenAI-powered winter smog guidance: low-emission routines, indoor air hacks,
              sustainable swaps, and transparent health &amp; climate impact.
            </p>
          </div>
          <div className="header-status-pill" aria-label="Active AI synthesis mode">
            <Bot size={16} aria-hidden="true" />
            <span>
              {plan?.provider === 'gemini' || plan?.provider === 'openai-compatible'
                ? `GenAI Live (${plan.provider})`
                : 'AeroGuide Science Engine'}
            </span>
          </div>
        </div>
      </header>

      <div className="sr-only" aria-live="polite">
        {liveStatus}
      </div>

      <main id="main-content" className="main-layout">
        <ProfileForm
          profile={profile}
          loading={loading}
          onProfileChange={handleProfileChange}
          onCityLookup={handleCityLookup}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {error && (
            <div role="alert" className="alert-banner">
              {error}
            </div>
          )}

          {/* Local Air Quality & Winter Smog Telemetry */}
          <section aria-labelledby="telemetry-heading" className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.6rem',
              }}
            >
              <div>
                <h2 id="telemetry-heading" className="section-heading" style={{ marginBottom: '0.2rem' }}>
                  {telemetry.city}, {telemetry.country}
                </h2>
                <p className="muted-text" style={{ margin: 0 }}>
                  Source:{' '}
                  {telemetry.source === 'live-open-meteo'
                    ? 'Live Open-Meteo Air Quality & Weather'
                    : 'Calibrated Winter Smog Model'}{' '}
                  · Inversion risk: <strong>{telemetry.inversionRisk}</strong>
                </p>
              </div>

              <span className={`aqi-badge ${aqiClass}`}>
                <AlertTriangle size={15} aria-hidden="true" />
                AQI {telemetry.aqi} · {telemetry.aqiCategory.label}
              </span>
            </div>

            <div className="telemetry-grid">
              <div className="metric-box">
                <div className="metric-label">Outdoor PM2.5</div>
                <div className="metric-value">{telemetry.pm25} µg/m³</div>
                <div className="metric-sub">
                  {Math.round((telemetry.pm25 / 15) * 10) / 10}× WHO 24h limit
                </div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Traffic NO₂ / PM10</div>
                <div className="metric-value">
                  {telemetry.no2} / {telemetry.pm10}
                </div>
                <div className="metric-sub">µg/m³ urban mix</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">Winter Weather</div>
                <div className="metric-value">
                  <Thermometer size={17} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} />{' '}
                  {telemetry.temperatureC}°C
                </div>
                <div className="metric-sub">
                  <Wind size={13} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} />{' '}
                  {telemetry.windSpeedKmh} km/h wind · {telemetry.humidityPct}% RH
                </div>
              </div>
            </div>

            {plan && (
              <div className="impact-callout" style={{ marginTop: '0.9rem' }}>
                <strong>{plan.headline}:</strong> {plan.executiveBrief}
              </div>
            )}

            <p className="muted-text" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
              <strong>Primary local drivers:</strong> {telemetry.winterDrivers.join(' · ')}
            </p>
          </section>

          <ImpactDashboard
            impact={liveImpact}
            selectedCount={activeActions.length}
            totalCount={localActions.length}
          />

          <DiurnalChart
            hourly={telemetry.hourlyForecast}
            city={telemetry.city}
            bestVentilationWindow={windows.bestVentilationWindow}
            peakSmogWindow={windows.peakSmogWindow}
          />

          {/* Primary Interactive Sections */}
          <div>
            <div className="tab-bar" role="tablist" aria-label="Assistant views">
              <button
                type="button"
                role="tab"
                id="tab-plan"
                aria-selected={activeTab === 'plan'}
                aria-controls="panel-plan"
                className="tab-btn"
                onClick={() => setActiveTab('plan')}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Action Plan ({localActions.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-coach"
                aria-selected={activeTab === 'coach'}
                aria-controls="panel-coach"
                className="tab-btn"
                onClick={() => setActiveTab('coach')}
              >
                <Bot size={16} aria-hidden="true" />
                <span>Ask AeroGuide AI</span>
              </button>

              <button
                type="button"
                role="tab"
                id="tab-community"
                aria-selected={activeTab === 'community'}
                aria-controls="panel-community"
                className="tab-btn"
                onClick={() => setActiveTab('community')}
              >
                <Users size={16} aria-hidden="true" />
                <span>Community &amp; Schools</span>
              </button>
            </div>

            <div
              role="tabpanel"
              id="panel-plan"
              aria-labelledby="tab-plan"
              hidden={activeTab !== 'plan'}
            >
              {activeTab === 'plan' && (
                <ActionPlanList
                  actions={localActions}
                  selectedActionIds={selectedActionIds}
                  onToggleAction={handleToggleAction}
                />
              )}
            </div>

            <div
              role="tabpanel"
              id="panel-coach"
              aria-labelledby="tab-coach"
              hidden={activeTab !== 'coach'}
            >
              {activeTab === 'coach' && (
                <GenAiCoach
                  profile={profile}
                  selectedActionIds={selectedActionIds}
                  city={telemetry.city}
                />
              )}
            </div>

            <div
              role="tabpanel"
              id="panel-community"
              aria-labelledby="tab-community"
              hidden={activeTab !== 'community'}
            >
              {activeTab === 'community' && (
                <CommunityHub
                  bulletin={
                    plan?.communityBulletin ?? {
                      title: `${telemetry.city} Clean-Air Alert`,
                      message: `Today's AQI in ${telemetry.city} is ${telemetry.aqi}. Air out briefly inside ${windows.bestVentilationWindow} and run indoor HEPA/MERV-13 filtration during ${windows.peakSmogWindow}.`,
                      schoolAdvisory:
                        'Request indoor recess whenever outdoor PM2.5 exceeds 55 µg/m³.',
                    }
                  }
                  impact={liveImpact}
                  city={telemetry.city}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <strong>Medical &amp; Methodology Note:</strong> AeroShield Family provides
        educational environmental guidance grounded in US EPA PM2.5 AQI breakpoints, WHO 2021
        Air Quality Guidelines (15 µg/m³ 24h), and ASHRAE filtration research. It does not
        replace emergency medical advice for severe asthma or cardiopulmonary symptoms.
      </footer>
    </>
  );
}

export default App;
