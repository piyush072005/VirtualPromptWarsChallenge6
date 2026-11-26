# AeroShield Family — Urban Air Quality Assistant

GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution with tailored low-emission daily routines, indoor air quality hacks, sustainable alternatives, and transparent impact quantification.

## Key Features
- **Location & Winter Smog Telemetry**: Resolves live Open-Meteo air quality & weather data with SSRF-protected server proxies and calibrated regional winter-inversion presets (New Delhi, Lahore, Warsaw, Salt Lake City, Beijing, London).
- **24-Hour Thermal Inversion & Ventilation Planner**: Highlights safe midday solar-mixing windows and morning/evening inversion peaks with an accessible SVG chart and data table.
- **Tailored Routines, Indoor Hacks & Sustainable Shifts**: Generates household-specific guidance (commute mode, cooking/heating fuel, home seal quality, vulnerabilities, budget tier) with interactive scenario toggling.
- **Quantified Direct Impact**: Computes daily inhaled PM2.5 avoided (µg/day), indoor PM2.5 reduction (µg/m³), WHO 24-hour guideline ratio, comparative weekly burden relief, annual CO₂e & soot avoided, and neighborhood ripple impact.
- **GenAI Family & Community Coach**: Supports server-side Gemini (`GEMINI_API_KEY`) or OpenAI-compatible (`OPENAI_API_KEY`) providers with prompt-injection guards and a deterministic science-grounded fallback engine (`aeroguide-engine`) for zero-key / offline operation.
- **Community & School Action Hub**: Neighborhood ripple simulator and one-click shareable clean-air alert bulletin.

## Scripts
- `npm install` — Install dependencies
- `npm run dev` — Start backend API server (`http://127.0.0.1:3001`)
- `npm run dev:client` — Start Vite frontend dev server (`http://127.0.0.1:5173`)
- `npm run build` — Type-check and build production bundle to `dist/`
- `npm start` — Serve API + built production UI from `dist/`
- `npm test` — Run unit, API security/integration, and axe-core accessibility tests
