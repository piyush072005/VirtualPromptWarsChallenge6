import { MapPin, Search, Sliders } from 'lucide-react';
import { useState } from 'react';
import { CITY_PRESETS } from '@shared/presets.ts';
import type { HouseholdProfile, Vulnerability } from '@shared/types.ts';

interface ProfileFormProps {
  profile: HouseholdProfile;
  loading: boolean;
  onProfileChange: (next: HouseholdProfile) => void;
  onCityLookup: (cityName: string, presetId?: string) => void;
}

const VULNERABILITY_OPTIONS: ReadonlyArray<{ id: Vulnerability; label: string }> = [
  { id: 'children', label: 'Children / Infants' },
  { id: 'asthma_respiratory', label: 'Asthma / Respiratory sensitivity' },
  { id: 'seniors', label: 'Older adults (65+)' },
  { id: 'pregnancy', label: 'Pregnancy' },
  { id: 'outdoor_workers', label: 'Outdoor commuters / workers' },
];

export function ProfileForm({
  profile,
  loading,
  onProfileChange,
  onCityLookup,
}: ProfileFormProps) {
  const [cityInput, setCityInput] = useState(profile.city);

  const toggleVulnerability = (v: Vulnerability) => {
    const exists = profile.vulnerabilities.includes(v);
    const vulnerabilities = exists
      ? profile.vulnerabilities.filter((item) => item !== v)
      : [...profile.vulnerabilities, v];
    onProfileChange({ ...profile, vulnerabilities });
  };

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (trimmed.length >= 2) {
      onCityLookup(trimmed, undefined);
    }
  };

  return (
    <aside className="card" aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="section-heading">
        <Sliders size={19} aria-hidden="true" />
        Location & Family Profile
      </h2>
      <p className="muted-text" style={{ marginTop: 0 }}>
        Tailor winter smog routines, indoor air hacks, and impact math to your home.
      </p>

      <form onSubmit={handleCitySubmit} className="form-stack" style={{ marginBottom: '1rem' }}>
        <div className="field-group">
          <label htmlFor="city-search" className="field-label">
            <MapPin size={14} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />
            City or Neighborhood
          </label>
          <div className="inline-row">
            <input
              id="city-search"
              type="text"
              className="input"
              value={cityInput}
              maxLength={80}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="e.g. New Delhi, Warsaw, Salt Lake City"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || cityInput.trim().length < 2}
              aria-label="Update location air quality"
            >
              <Search size={16} aria-hidden="true" />
              <span>Check</span>
            </button>
          </div>
        </div>

        <div>
          <span className="field-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Winter Smog City Presets
          </span>
          <div className="preset-chips" role="group" aria-label="City presets">
            {CITY_PRESETS.map((preset) => {
              const active = profile.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="chip-btn"
                  aria-pressed={active}
                  onClick={() => {
                    setCityInput(preset.city);
                    onCityLookup(preset.city, preset.id);
                  }}
                >
                  {preset.city}
                </button>
              );
            })}
          </div>
        </div>
      </form>

      <div className="form-stack">
        <div className="grid-2">
          <div className="field-group">
            <label htmlFor="household-size" className="field-label">
              Household Size
            </label>
            <input
              id="household-size"
              type="number"
              className="input"
              min={1}
              max={12}
              value={profile.householdSize}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  householdSize: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="commute-km" className="field-label">
              Daily Commute (km)
            </label>
            <input
              id="commute-km"
              type="number"
              className="input"
              min={0}
              max={150}
              value={profile.dailyCommuteKm}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  dailyCommuteKm: Math.min(150, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </div>
        </div>

        <fieldset className="clean-fieldset">
          <legend>Sensitive Household Members</legend>
          <div className="checkbox-grid">
            {VULNERABILITY_OPTIONS.map((opt) => (
              <label key={opt.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={profile.vulnerabilities.includes(opt.id)}
                  onChange={() => toggleVulnerability(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-group">
          <label htmlFor="commute-mode" className="field-label">
            Primary Commute Mode
          </label>
          <select
            id="commute-mode"
            className="select"
            value={profile.commuteMode}
            onChange={(e) =>
              onProfileChange({
                ...profile,
                commuteMode: e.target.value as HouseholdProfile['commuteMode'],
              })
            }
          >
            <option value="petrol_car">Petrol / Gasoline Car</option>
            <option value="diesel_car">Diesel Car</option>
            <option value="two_wheeler">Motorbike / Scooter</option>
            <option value="public_transit">Metro / Bus / Rail</option>
            <option value="ev_car">Electric Vehicle</option>
            <option value="walk_bike">Walk / Bicycle</option>
            <option value="remote">Work / Study from Home</option>
          </select>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label htmlFor="cooking-fuel" className="field-label">
              Cooking Fuel
            </label>
            <select
              id="cooking-fuel"
              className="select"
              value={profile.cookingFuel}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  cookingFuel: e.target.value as HouseholdProfile['cookingFuel'],
                })
              }
            >
              <option value="lpg_piped_gas">Gas / LPG Stove</option>
              <option value="solid_biomass">Wood / Biomass / Coal</option>
              <option value="electric_coil">Electric Coil</option>
              <option value="induction">Induction</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="heating-fuel" className="field-label">
              Winter Heating
            </label>
            <select
              id="heating-fuel"
              className="select"
              value={profile.heatingFuel}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  heatingFuel: e.target.value as HouseholdProfile['heatingFuel'],
                })
              }
            >
              <option value="electric_resistance">Electric Heater</option>
              <option value="gas_boiler">Gas Boiler / Furnace</option>
              <option value="wood_coal">Wood / Coal Stove</option>
              <option value="heat_pump">Heat Pump</option>
              <option value="district_heating">District Heating</option>
              <option value="none">No Heating Needed</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label htmlFor="home-type" className="field-label">
              Home Seal Quality
            </label>
            <select
              id="home-type"
              className="select"
              value={profile.homeType}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  homeType: e.target.value as HouseholdProfile['homeType'],
                })
              }
            >
              <option value="apartment_drafty">Apartment (Drafty)</option>
              <option value="apartment_sealed">Apartment (Well-sealed)</option>
              <option value="house_drafty">House (Drafty)</option>
              <option value="house_sealed">House (Well-sealed)</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="purifier-setup" className="field-label">
              Current Filtration
            </label>
            <select
              id="purifier-setup"
              className="select"
              value={profile.purifierSetup}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  purifierSetup: e.target.value as HouseholdProfile['purifierSetup'],
                })
              }
            >
              <option value="none">None yet</option>
              <option value="corsi_rosenthal_diy">DIY Corsi-Rosenthal Box</option>
              <option value="single_hepa">Single-room HEPA</option>
              <option value="multi_room_hepa">Multi-room HEPA</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label htmlFor="budget-tier" className="field-label">
              Budget Preference
            </label>
            <select
              id="budget-tier"
              className="select"
              value={profile.budgetTier}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  budgetTier: e.target.value as HouseholdProfile['budgetTier'],
                })
              }
            >
              <option value="zero_cost">$0 Behavior & Habits</option>
              <option value="low_cost">Low-cost / DIY ($15–$90)</option>
              <option value="upgrade_ready">Ready for Home Upgrades</option>
            </select>
          </div>

          <div className="field-group" style={{ justifyContent: 'flex-end' }}>
            <label className="checkbox-label" style={{ marginTop: '1.35rem' }}>
              <input
                type="checkbox"
                checked={profile.hasSchoolKids}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    hasSchoolKids: e.target.checked,
                  })
                }
              />
              <span>School-aged kids</span>
            </label>
          </div>
        </div>
      </div>
    </aside>
  );
}
