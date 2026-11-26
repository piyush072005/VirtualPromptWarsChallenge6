import {
  estimateBaselineIndoorPm25,
  estimateHouseholdEmissions,
  findKeyTimeWindows,
} from './airQuality.ts';
import type { ActionItem, HouseholdProfile, LocationTelemetry } from './types.ts';

function isVulnerable(profile: HouseholdProfile): boolean {
  return profile.vulnerabilities.length > 0;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Generates tailored low-emission routines, indoor air quality hacks, and
 * sustainable alternatives calibrated to the household's location & lifestyle.
 */
export function buildTailoredActions(
  telemetry: LocationTelemetry,
  profile: HouseholdProfile
): ActionItem[] {
  const { bestVentilationWindow, peakSmogWindow } = findKeyTimeWindows(
    telemetry.hourlyForecast
  );
  const emissions = estimateHouseholdEmissions(profile);
  const indoorPm = estimateBaselineIndoorPm25(telemetry.pm25, profile);
  const vulnerable = isVulnerable(profile);
  const severeSmog = telemetry.aqi >= 151;
  const isDrafty =
    profile.homeType === 'apartment_drafty' || profile.homeType === 'house_drafty';

  const actions: ActionItem[] = [];

  // 1. ROUTINE: Diurnal Inversion Window Shift
  const dailyBaselineExposureUg = round1(indoorPm * 10.5 + telemetry.pm25 * 2.8);
  const windowShiftPct = severeSmog ? 22 : 14;
  actions.push({
    id: 'routine-inversion-shift',
    category: 'routine',
    title: `Shift outdoor routines to ${bestVentilationWindow}`,
    summary: `Move exercise, walks, and school-yard errands out of the ${peakSmogWindow} thermal inversion peak into the midday mixing window.`,
    whyItMatters:
      'Winter thermal inversions trap exhaust and heating smoke in the lowest 100–200m of air during early morning and evening. Midday solar warming lifts the boundary layer and dilutes PM2.5 by 30–50%.',
    tailoredReason: vulnerable
      ? `In ${telemetry.city} (AQI ${telemetry.aqi}), shifting outdoor time protects vulnerable household members (${profile.vulnerabilities.join(', ').replace(/_/g, ' ')}) from peak inhaled particulate spikes.`
      : `Calibrated for ${telemetry.city}'s diurnal smog curve (wind ${telemetry.windSpeedKmh} km/h, inversion risk: ${telemetry.inversionRisk}).`,
    pm25ExposureReductionPct: windowShiftPct,
    dailyInhaledPm25SavedUg: round1((dailyBaselineExposureUg * windowShiftPct) / 100),
    annualCo2eSavedKg: 0,
    annualPm25EmittedSavedG: 0,
    effort: 'quick_win',
    estimatedCost: '$0',
    steps: [
      `Schedule brisk outdoor walks or playtime strictly inside ${bestVentilationWindow}.`,
      `Keep windows closed and use indoor stretching/play during ${peakSmogWindow}.`,
      ...(profile.hasSchoolKids
        ? [
            'Request indoor PE/recess from school staff whenever local PM2.5 exceeds 55 µg/m³.',
          ]
        : []),
    ],
    scientificBasis:
      'Boundary-layer meteorology shows afternoon mixing height peaks 2–4x higher than nocturnal inversion layers.',
  });

  // 2. ROUTINE: Cold-Start Errand Consolidation & Anti-Idling
  if (
    profile.commuteMode === 'petrol_car' ||
    profile.commuteMode === 'diesel_car' ||
    profile.commuteMode === 'two_wheeler'
  ) {
    const coldStartCo2Saved = Math.round(emissions.annualCommuteCo2eKg * 0.16);
    const coldStartPmSaved = Math.round(emissions.annualCommutePm25G * 0.24);
    actions.push({
      id: 'routine-cold-start-batching',
      category: 'routine',
      title: 'Batch cold-start trips & eliminate winter idling',
      summary:
        'Combine short errands into one warm-engine loop and avoid warming up the engine while parked.',
      whyItMatters:
        'Catalytic converters need ~250–400°C to scrub exhaust. In winter cold starts, the first 3 km emit disproportionately high PM2.5, VOCs, and NOx right beside homes and school gates.',
      tailoredReason: `Your ${profile.dailyCommuteKm} km/day ${profile.commuteMode.replace(/_/g, ' ')} profile emits ~${emissions.annualCommuteCo2eKg} kg CO₂e/yr; warm-engine batching cuts winter cold-start spikes immediately.`,
      pm25ExposureReductionPct: 8,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.08),
      annualCo2eSavedKg: coldStartCo2Saved,
      annualPm25EmittedSavedG: coldStartPmSaved,
      effort: 'habit_shift',
      estimatedCost: '$0 (saves fuel)',
      steps: [
        'Turn the engine off within 10 seconds at school pick-ups, railway crossings, or drive-thrus.',
        'Drive gently within 30 seconds of ignition instead of idling in the driveway.',
        'Bundle grocery, pharmacy, and school drop-offs into a single warm-engine loop.',
      ],
      scientificBasis:
        'EPA cold-start emissions testing shows sub-zero/cold starts account for 60–80% of tailpipe particulate and hydrocarbon spikes on short urban trips.',
    });
  } else {
    actions.push({
      id: 'routine-low-exposure-route',
      category: 'routine',
      title: 'Use side-street low-pollution commute corridors',
      summary:
        'Route walking, cycling, or transit waits one block away from major diesel arterial roads.',
      whyItMatters:
        'Tailpipe PM2.5 and ultrafine NO₂ drop by 40–60% within 100 meters of heavy traffic corridors.',
      tailoredReason: `Tailored for your ${profile.commuteMode.replace(/_/g, ' ')} commute in ${telemetry.city} where NO₂ is ${telemetry.no2} µg/m³.`,
      pm25ExposureReductionPct: 14,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.14),
      annualCo2eSavedKg: 45,
      annualPm25EmittedSavedG: 12,
      effort: 'quick_win',
      estimatedCost: '$0',
      steps: [
        'Pick parallel residential/park-adjacent streets rather than multi-lane intersections.',
        'Stand 3+ meters back from the curb at bus stops and crosswalks.',
        ...(severeSmog
          ? ['Wear a snug-fitting N95/KF94/KN95 respirator during commutes when AQI > 150.']
          : []),
      ],
      scientificBasis:
        'Near-roadway dispersion gradients decay exponentially over the first 50–150 meters.',
    });
  }

  // 3. INDOOR HACK: Filtration (DIY Corsi-Rosenthal or HEPA scheduling)
  if (profile.purifierSetup === 'none') {
    const useDiy = profile.budgetTier !== 'upgrade_ready';
    const reductionPct = isDrafty ? 38 : 46;
    actions.push({
      id: 'indoor-corsi-rosenthal-hepa',
      category: 'indoor_hack',
      title: useDiy
        ? 'Build a $60 Corsi-Rosenthal MERV-13 Clean-Air Box'
        : 'Deploy bedroom-first HEPA filtration on medium-high',
      summary: useDiy
        ? 'Tape four 20×20 MERV-13 furnace filters to a 20" box fan to match $400+ HEPA clean-air delivery rates.'
        : 'Run true-HEPA filtration continuously in sleeping rooms to create an 8-hour low-PM2.5 lung recovery zone.',
      whyItMatters:
        'Families spend 65–75% of winter hours indoors. High-CADR MERV-13 or HEPA filtration strips 50–70% of fine PM2.5 particles inside a closed room within 30 minutes.',
      tailoredReason: `Your home currently has no active purifier (${profile.homeType.replace(/_/g, ' ')}), leaving indoor PM2.5 near ~${indoorPm} µg/m³.`,
      pm25ExposureReductionPct: reductionPct,
      dailyInhaledPm25SavedUg: round1((dailyBaselineExposureUg * reductionPct) / 100),
      annualCo2eSavedKg: -28, // ~45W fan electricity offset accounted transparently
      annualPm25EmittedSavedG: 0,
      effort: 'quick_win',
      estimatedCost: useDiy ? '$55–$75 DIY' : '$140–$260',
      steps: useDiy
        ? [
            'Buy 4× MERV-13 pleated filters (20×20×1 in or 20×20×2 in) and one standard 20" box fan.',
            'Form a cube with arrows pointing INWARD, seal edges and cardboard base cleanly with duct tape.',
            'Add a cardboard shroud ring over the fan corners to stop air backflow and run on low/medium in the main bedroom.',
          ]
        : [
            'Place the HEPA unit in the main sleeping area away from curtains and walls.',
            'Run on medium-high during evening smog peaks and sleep hours (avoid ozone/ionizer modes).',
            'Vacuum the pre-filter biweekly and check filter loading every 3 months.',
          ],
      scientificBasis:
        'UC Davis & EPA chamber tests measure Corsi-Rosenthal boxes at 350–600 CFM CADR for PM2.5—without generating ozone.',
    });
  } else {
    actions.push({
      id: 'indoor-hepa-optimization',
      category: 'indoor_hack',
      title: 'Optimize purifier placement & midday purge schedule',
      summary:
        'Concentrate existing filtration into a sealed "clean room" during smog peaks and purge CO₂ briefly during the midday trough.',
      whyItMatters:
        'Running one purifier across an open, leaky apartment dilutes CADR. Closing interior doors doubles air changes per hour (ACH) in bedrooms where families sleep.',
      tailoredReason: `Maximizes your existing ${profile.purifierSetup.replace(/_/g, ' ')} setup for a ${profile.householdSize}-person household.`,
      pm25ExposureReductionPct: 24,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.24),
      annualCo2eSavedKg: 15,
      annualPm25EmittedSavedG: 0,
      effort: 'quick_win',
      estimatedCost: '$0',
      steps: [
        'Close bedroom doors at night so the purifier achieves 4+ air changes per hour.',
        `Crack two opposite windows for just 10–15 minutes inside ${bestVentilationWindow} to flush indoor CO₂, then seal again.`,
        'Disable any built-in "ionizer / plasma" toggle, which can emit lung-irritating ozone.',
      ],
      scientificBasis:
        'ASHRAE residential IAQ guidance confirms targeted zone filtration outperforms whole-home open-door operation.',
    });
  }

  // 4. INDOOR HACK: Draft sealing + wet dusting OR kitchen NO2/PM control
  if (isDrafty) {
    actions.push({
      id: 'indoor-weatherstrip-wet-clean',
      category: 'indoor_hack',
      title: 'Seal window drafts & switch to damp-mop dust control',
      summary:
        'Block infiltration leaks with foam weatherstripping/door sweeps and capture settled smog dust with damp microfiber instead of dry sweeping.',
      whyItMatters:
        'Drafty homes let 75%+ of outdoor winter PM2.5 seep indoors continuously. Dry brooms and unsealed vacuums kick settled toxic particles right back into breathing height.',
      tailoredReason: `Your ${profile.homeType.replace(/_/g, ' ')} leaks outdoor smog (~${Math.round(telemetry.pm25 * 0.76)} µg/m³ baseline infiltration).`,
      pm25ExposureReductionPct: 26,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.26),
      annualCo2eSavedKg: 180, // lower winter heating loss
      annualPm25EmittedSavedG: 15,
      effort: 'quick_win',
      estimatedCost: '$12–$30',
      steps: [
        'Apply self-adhesive EPDM foam tape around loose window frames and attach a threshold sweep to the main entry door.',
        'Replace dry sweeping with damp microfiber mopping every 2–3 days.',
        'Leave outdoor shoes at the entrance on a washable mat to keep heavy road dust out of bedrooms.',
      ],
      scientificBasis:
        'Reducing building air-change infiltration (ACH50) cuts indoor/outdoor PM2.5 ratio by ~30% and trims winter heating energy.',
    });
  }

  // Cooking indoor hack (always relevant if gas/biomass, or frying hack otherwise)
  if (profile.cookingFuel === 'lpg_piped_gas' || profile.cookingFuel === 'solid_biomass') {
    actions.push({
      id: 'indoor-cooking-exhaust-hack',
      category: 'indoor_hack',
      title: 'Use back burners, lid-on cooking & cross-exhaust capture',
      summary:
        'Cut indoor NO₂ and ultrafine cooking aerosols by 55–75% without waiting for a full kitchen remodel.',
      whyItMatters:
        'Cooking with gas or biomass indoors creates sharp bursts of PM2.5 and NO₂ that trigger childhood asthma—even when outdoor air looks hazy.',
      tailoredReason: `Your household cooks with ${profile.cookingFuel.replace(/_/g, ' ')}, adding ~${profile.cookingFuel === 'solid_biomass' ? 48 : 11} µg/m³ to indoor baseline PM2.5.`,
      pm25ExposureReductionPct: profile.cookingFuel === 'solid_biomass' ? 36 : 18,
      dailyInhaledPm25SavedUg: round1(
        dailyBaselineExposureUg * (profile.cookingFuel === 'solid_biomass' ? 0.36 : 0.18)
      ),
      annualCo2eSavedKg: 65,
      annualPm25EmittedSavedG: profile.cookingFuel === 'solid_biomass' ? 620 : 18,
      effort: 'quick_win',
      estimatedCost: '$0–$35 (electric kettle)',
      steps: [
        'Cook on the back burners directly under your exhaust hood (or beside an outward-facing window fan).',
        'Run exhaust 10 minutes after turning the flame off, and keep lids on pots to slash oil aerosols.',
        'Use an electric kettle or rice cooker for boiling water instead of open-flame burners.',
      ],
      scientificBasis:
        'Lawrence Berkeley National Lab studies show back-burner + range-hood capture reduces cooking NO₂ and PM2.5 exposure by >60%.',
    });
  }

  // 5. SUSTAINABLE ALTERNATIVE: Commute shift
  if (
    profile.commuteMode === 'petrol_car' ||
    profile.commuteMode === 'diesel_car' ||
    profile.commuteMode === 'two_wheeler'
  ) {
    const shiftFraction = 0.6; // shifting 3 of 5 workdays to transit/carpool/e-bike
    const co2Saved = Math.round(
      emissions.annualCommuteCo2eKg * shiftFraction * 0.72
    );
    const pmSaved = Math.round(
      emissions.annualCommutePm25G * shiftFraction * 0.75
    );
    actions.push({
      id: 'alt-sustainable-commute',
      category: 'sustainable_alt',
      title: 'Shift 3 days/week to metro, neighborhood carpool, or e-bike',
      summary:
        'Replacing 60% of solo combustion trips slashes your family’s annual tailpipe emissions while easing neighborhood street smog.',
      whyItMatters:
        'Urban winter smog is amplified by cold-weather exhaust NOx and primary soot. Shared electric transit or 3-family school carpools cut per-person emissions by 65–80%.',
      tailoredReason: `Eliminating ~${Math.round(profile.dailyCommuteKm * 150)} solo combustion km/yr directly removes ${pmSaved} g of urban tailpipe PM2.5 and ${co2Saved} kg CO₂e.`,
      pm25ExposureReductionPct: 10,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.1),
      annualCo2eSavedKg: co2Saved,
      annualPm25EmittedSavedG: pmSaved,
      effort: 'habit_shift',
      estimatedCost: 'Net savings on fuel & parking',
      steps: [
        'Start a 2- or 3-family school-run carpool rotation with neighbors on the same route.',
        'Use park-and-ride rail/metro for the congested inner-city leg during winter smog alerts.',
        'Equip winter e-bike/walk days with a washable particulate mask when AQI > 150.',
      ],
      scientificBasis:
        'Mode-shift lifecycle assessments show shared rail/bus emits 70–80% less CO₂e and PM2.5 per passenger-km than solo ICE cars.',
    });
  } else {
    actions.push({
      id: 'alt-community-carpool-advocacy',
      category: 'sustainable_alt',
      title: 'Organize a school "No-Idling & Walking Bus" zone',
      summary:
        'Coordinate with 5+ local families to replace drop-off car queues at school gates with supervised walking groups or staggered electric shuttles.',
      whyItMatters:
        'Your personal commute is already low-emission; organizing parents removes dozens of cold-idling cars right outside children’s classrooms.',
      tailoredReason: `Amplifies your ${profile.commuteMode.replace(/_/g, ' ')} leadership across ${telemetry.city}'s school community.`,
      pm25ExposureReductionPct: 9,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.09),
      annualCo2eSavedKg: 920,
      annualPm25EmittedSavedG: 210,
      effort: 'habit_shift',
      estimatedCost: '$0',
      steps: [
        'Drop off 300 meters away from the school gate ("park & stride") to clear congestion.',
        'Share the daily AQI bulletin in your parent/resident chat to align indoor-recess triggers.',
        'Partner with the PTA for a shared classroom DIY Corsi-Rosenthal filter build.',
      ],
      scientificBasis:
        'School-street anti-idling zones lower gate-side NO₂ and PM2.5 peaks by up to 23–36%.',
    });
  }

  // 6. SUSTAINABLE ALTERNATIVE: Clean Heating or Clean Cooking upgrade
  if (profile.heatingFuel === 'wood_coal') {
    actions.push({
      id: 'alt-clean-heating-transition',
      category: 'sustainable_alt',
      title: 'Pause solid-fuel burning on smog days & transition to heat pump',
      summary:
        'Eliminate indoor/neighborhood wood & coal smoke—the single highest-leverage winter air quality upgrade.',
      whyItMatters:
        'One wood-burning stove can emit as much PM2.5 per hour as dozens of diesel trucks, blanketing adjacent bedrooms and neighbors during inversions.',
      tailoredReason: `Your wood/coal heating currently drives ~${emissions.annualHomePm25G} g/yr of direct PM2.5 emissions.`,
      pm25ExposureReductionPct: 32,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.32),
      annualCo2eSavedKg: 1850,
      annualPm25EmittedSavedG: 4100,
      effort: 'investment',
      estimatedCost:
        profile.budgetTier === 'upgrade_ready'
          ? 'Eligible for clean-heat rebates'
          : '$0 to pause on high-AQI days',
      steps: [
        'Observe voluntary/municipal "no-burn" days whenever AQI exceeds 100.',
        'Use electric space heating or heat-pump zoning strictly in occupied rooms.',
        'Check municipal clean-air stove replacement rebates for cold-climate heat pumps.',
      ],
      scientificBasis:
        'WHO residential heating reviews identify solid-fuel combustion as the top reversible winter urban PM2.5 source.',
    });
  } else if (profile.cookingFuel === 'solid_biomass' || profile.cookingFuel === 'lpg_piped_gas') {
    const isBiomass = profile.cookingFuel === 'solid_biomass';
    actions.push({
      id: 'alt-induction-cooking-shift',
      category: 'sustainable_alt',
      title: isBiomass
        ? 'Switch primary meals to portable induction + electric pressure cooker'
        : 'Add a single-burner portable induction hob for daily winter cooking',
      summary:
        'Zero indoor combustion flame means zero cooking NO₂, CO, or soot inside tightly sealed winter windows.',
      whyItMatters:
        'A single $55–$90 countertop induction burner handles 70% of daily boiling, stir-frying, and simmering faster than gas while keeping indoor air clean.',
      tailoredReason: `Offsets your ${profile.cookingFuel.replace(/_/g, ' ')} emissions (${isBiomass ? '3,100 g/yr PM2.5' : '420 kg/yr CO₂e + indoor NO₂'}) even in a rented or sealed winter home.`,
      pm25ExposureReductionPct: isBiomass ? 40 : 15,
      dailyInhaledPm25SavedUg: round1(
        dailyBaselineExposureUg * (isBiomass ? 0.4 : 0.15)
      ),
      annualCo2eSavedKg: isBiomass ? 1160 : 180,
      annualPm25EmittedSavedG: isBiomass ? 2900 : 39,
      effort: profile.budgetTier === 'zero_cost' ? 'habit_shift' : 'investment',
      estimatedCost: '$55–$95 countertop unit',
      steps: [
        'Test pots with a fridge magnet—any magnetic steel/cast-iron cookware works on induction.',
        'Shift morning tea, porridge, and evening simmering onto the plug-in induction unit first.',
        'Combine with an electric pressure cooker to cut cooking energy by ~50%.',
      ],
      scientificBasis:
        'Induction transfers ~84% of energy directly to the pan vs ~40% for gas, eliminating flame-generated NO₂.',
    });
  } else {
    actions.push({
      id: 'alt-clean-grid-community-hub',
      category: 'sustainable_alt',
      title: 'Join community solar/green-tariff & share purifier filter bulk-buys',
      summary:
        'Pair your already low-emission electric home with clean electricity and lower neighborhood filter costs via group buying.',
      whyItMatters:
        'Cleaner electricity reduces regional coal/gas power-plant sulfate haze, while neighborhood bulk-buys drop MERV-13 filter costs by 30–40% for low-income families.',
      tailoredReason: `Your home already uses clean ${profile.cookingFuel} cooking—community bulk-buying multiplies neighborhood resilience.`,
      pm25ExposureReductionPct: 8,
      dailyInhaledPm25SavedUg: round1(dailyBaselineExposureUg * 0.08),
      annualCo2eSavedKg: 640,
      annualPm25EmittedSavedG: 95,
      effort: 'habit_shift',
      estimatedCost: '$0–$15 shared savings',
      steps: [
        'Opt into your utility’s renewable/green tariff or community solar subscription.',
        'Coordinate a 10-household bulk order of MERV-13 filters before November smog season.',
        'Donate spare DIY filter boxes to nearby senior centers or daycares.',
      ],
      scientificBasis:
        'Secondary sulfates and nitrates from fossil power plants contribute 20–35% of regional winter haze.',
    });
  }

  return actions;
}
