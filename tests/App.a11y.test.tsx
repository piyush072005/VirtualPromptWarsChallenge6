import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTailoredActions } from '@shared/interventions.ts';
import {
  buildPresetTelemetry,
  CITY_PRESETS,
  DEFAULT_HOUSEHOLD_PROFILE,
} from '@shared/presets.ts';
import { computeImpactSummary } from '@shared/airQuality.ts';
import App from '@src/App.tsx';

function mockPlanFetch() {
  const telemetry = buildPresetTelemetry(CITY_PRESETS[0]!, true);
  const actions = buildTailoredActions(telemetry, DEFAULT_HOUSEHOLD_PROFILE);
  const impact = computeImpactSummary(
    telemetry,
    DEFAULT_HOUSEHOLD_PROFILE,
    actions
  );

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/chat')) {
      return new Response(
        JSON.stringify({
          answer:
            'Run a MERV-13 Corsi-Rosenthal box in bedrooms and ventilate briefly at 13:00.',
          keyTakeaways: ['Keep windows shut 18:00–22:00', 'Use damp mopping'],
          directImpactNote: 'Reduces daily inhaled PM2.5 by 52%.',
          suggestedFollowUps: ['What about gas stoves?'],
          provider: 'aeroguide-engine',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        telemetry,
        plan: {
          generatedAt: new Date().toISOString(),
          provider: 'aeroguide-engine',
          headline: `Winter Smog Action Plan for ${telemetry.city}`,
          executiveBrief: 'Cut household PM2.5 exposure via timed ventilation and filtration.',
          riskAlert: {
            level: telemetry.aqiCategory.label,
            advisory: telemetry.aqiCategory.healthGuidance,
            bestVentilationWindow: '12:00–15:00',
            peakSmogWindow: '19:00–22:00',
          },
          impact,
          actions,
          communityBulletin: {
            title: `${telemetry.city} Community Clean-Air Alert`,
            message: 'Share midday ventilation window and anti-idling school pledge.',
            schoolAdvisory: 'Keep recess indoors when PM2.5 > 55 µg/m³.',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
}

describe('App UI, Interactions & WCAG Accessibility', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockPlanFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes axe-core accessibility audit with zero WCAG A/AA violations', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText(/Winter Smog Action Plan for New Delhi/i)
      ).toBeInTheDocument();
    });

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('supports scenario toggling, GenAI chat, and community tab keyboard/click flows', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Direct Impact of Your Choices/i)).toBeInTheDocument();
    });

    // Toggle one action off and verify active count decreases
    const checkboxes = screen.getAllByRole('checkbox', {
      name: /Include .* in impact simulation/i,
    });
    expect(checkboxes.length).toBeGreaterThanOrEqual(4);
    const initialCount = checkboxes.length;
    await user.click(checkboxes[0]!);
    expect(
      screen.getByText(
        new RegExp(`Direct Impact of Your Choices \\(${initialCount - 1} of ${initialCount} active\\)`)
      )
    ).toBeInTheDocument();

    // Switch to Ask AeroGuide AI tab and send a question
    await user.click(screen.getByRole('tab', { name: /Ask AeroGuide AI/i }));
    const questionInput = screen.getByLabelText(/Ask AeroGuide a question/i);
    await user.type(questionInput, 'When should we open windows?');
    await user.click(screen.getByRole('button', { name: /^Ask$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Run a MERV-13 Corsi-Rosenthal box in bedrooms/i)
      ).toBeInTheDocument();
    });

    // Switch to Community & Schools tab
    await user.click(screen.getByRole('tab', { name: /Community & Schools/i }));
    expect(screen.getByText(/Neighborhood Ripple Simulator/i)).toBeInTheDocument();
  });
});
