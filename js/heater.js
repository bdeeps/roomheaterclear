// RoomHeaterClear's shared physics and parts: glow colour and Stefan–Boltzmann radiation, a catalogue
// of heaters with typical specs, a two-node room heat balance, PTC ceramic resistance, humidity,
// carbon monoxide build-up and blood COHb (Coburn–Forster–Kane), chart boards, particles, and 3D
// builders for seven heaters: radiant (rod, quartz, halogen), fan, oil-filled radiator, carbon
// tower, PTC ceramic, convector and the angithi (charcoal brazier).
// Scale: 1 scene unit = 10 cm. +y is up, heaters face +z.
import { THREE, M, box, beam, tube, rod, clamp, lerp } from './kit.js';

// ---------------------------------------------------------------- constants
export const SIGMA = 5.670374e-8;   // W/m²K⁴, Stefan–Boltzmann constant (CODATA 2018)
export const K0 = 273.15;
export const WIEN = 2897.77;        // µm·K, Wien's displacement constant (CODATA 2018)
export const V_MAINS = 230;         // V, Indian household supply (IS 12360)
export const TARIFF = 7;            // ₹ per kWh, a typical Indian household rate (slabs run ₹3 to ₹8+; check your bill)
export const TAU = Math.PI * 2;

// Radiant flux from a surface at T °C to surroundings at Ts °C, per m²: εσ(T⁴ − Ts⁴).
export const radFlux = (T, Ts = 20, eps = 0.9) => eps * SIGMA * ((T + K0) ** 4 - (Ts + K0) ** 4);
// Wavelength of peak emission, µm (Wien's law, T in °C).
export const wienPeak = (T) => WIEN / (T + K0);

// ---------------------------------------------------------------- glow colour
// Black-body colour (Tanner Helland's fit to the CIE chromaticity of a black body, 1000–40,000 K),
// with a brightness from Planck's law at 600 nm relative to a 2,500 K halogen filament, on a log
// scale. Visible glow starts near 525 °C (798 K, the "Draper point"), exactly where this fades in.
export function kelvinRGB(K) {
  const t = Math.max(1000, K) / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}
export function glowLevel(Tc) {
  const K = Tc + K0; if (K < 700) return 0;
  const rel = Math.exp(-23980 / K) / Math.exp(-23980 / 2500);
  return clamp((Math.log10(rel) + 9) / 9, 0, 1);
}
// Set an element material to glow for a temperature in °C (k scales it for fade-in/out).
export function setGlow(mat, Tc, k = 1, base = 0x8a8f98) {
  const lv = glowLevel(Tc) * k, [r, g, b] = kelvinRGB(Tc + K0);
  mat.emissive.setRGB(r, g, b);
  mat.emissiveIntensity = lv * 2.2;
  mat.color.set(base).lerp(new THREE.Color(r, g * 0.8, b * 0.6), Math.min(1, lv * 1.4));
}
export const glowCss = (Tc) => { const [r, g, b] = kelvinRGB(Tc + K0), lv = Math.max(0.15, glowLevel(Tc)); return `rgb(${Math.round(r * 255 * lv)},${Math.round(g * 255 * lv)},${Math.round(b * 255 * lv)})`; };
export function glowName(Tc) {
  if (Tc < 525) return 'no visible glow (infrared only)';
  if (Tc < 700) return 'dull red';
  if (Tc < 900) return 'cherry red';
  if (Tc < 1100) return 'orange';
  if (Tc < 1400) return 'yellow-orange';
  if (Tc < 2000) return 'yellow-white';
  return 'white';
}

// ---------------------------------------------------------------- the heater family
// Typical figures for heaters sold in India (manufacturer spec sheets; element temperatures from
// Wikipedia "Infrared heater" and emitter makers' data: halogen/tungsten up to ~2,500 K, carbon ~1,000 °C,
// nichrome coils in quartz 750–950 °C). "rad" is the share of the heat that leaves as infrared
// (≈0.86 for tube emitters per Wikipedia/IR emitter makers; oil radiators ≈0.3 because most fin
// area faces other fins; fan and PTC heaters almost none). "tau" is how long the heater takes to
// get most of the way to full output (first-order time constant, seconds). "gain" is how strongly a
// reflector aims the infrared forward (1 = spread over a whole sphere; 3 ≈ a good trough reflector).
export const HEATERS = {
  rod: { name: 'Rod heater', sub: 'nichrome coil on ceramic rods', W: 1000, T: 850, rad: 0.55, tau: 60, gain: 3, thermostat: false, color: 0xff8a3d, fuel: false },
  quartz: { name: 'Quartz heater', sub: 'coil inside quartz glass tubes', W: 800, T: 900, rad: 0.6, tau: 25, gain: 3, thermostat: false, color: 0xff6b3d, fuel: false },
  halogen: { name: 'Halogen heater', sub: 'tungsten filament in halogen gas', W: 1200, T: 2200, rad: 0.86, tau: 1, gain: 3, thermostat: false, color: 0xffd36b, fuel: false },
  carbon: { name: 'Carbon heater', sub: 'carbon-fibre ribbon in a quartz tube', W: 900, T: 1100, rad: 0.8, tau: 3, gain: 2.5, thermostat: false, color: 0xff9a4a, fuel: false },
  fan: { name: 'Fan heater', sub: 'hot coil with a fan behind it', W: 2000, T: 450, rad: 0.05, tau: 8, gain: 1, thermostat: true, color: 0x6fb6ff, fuel: false },
  ptc: { name: 'PTC ceramic heater', sub: 'self-limiting ceramic stones + fan', W: 2000, T: 220, rad: 0.04, tau: 25, gain: 1, thermostat: true, color: 0x5ce1a9, fuel: false },
  ofr: { name: 'Oil-filled radiator', sub: 'oil-filled steel fins, element at the bottom', W: 2000, T: 75, rad: 0.3, tau: 430, gain: 1, thermostat: true, color: 0xffb547, fuel: false },
  convector: { name: 'Convector', sub: 'finned element, warm air out of the top', W: 2000, T: 300, rad: 0.1, tau: 90, gain: 1, thermostat: true, color: 0xc49bff, fuel: false },
  hp: { name: 'AC in heat mode', sub: 'a heat pump: moves outdoor heat indoors', W: 700, T: 45, rad: 0.02, tau: 180, gain: 1, thermostat: true, color: 0x8ef0ff, fuel: false, cop: 3 },
  angithi: { name: 'Angithi', sub: 'burning charcoal in a metal or clay pot', W: 2400, T: 800, rad: 0.3, tau: 900, gain: 1, thermostat: false, color: 0xff5a3d, fuel: true },
};
export const FAMILY = ['rod', 'quartz', 'halogen', 'carbon', 'fan', 'ptc', 'ofr', 'convector', 'angithi'];
// Angithi heat: about 0.3 kg of charcoal an hour (a kilogram lasts an evening) × charcoal's heating
// value, about 29 MJ/kg (Engineering Toolbox; FAO "Simple technologies for charcoal making") ≈ 2.4 kW.
export const CHARCOAL = { kgph: 0.3, MJkg: 29 };

// Fan heater: the air flow that carries 2 kW away with a 40 K rise, Q = ṁ·cp·ΔT.
export const CP_AIR = 1005, RHO_AIR = 1.2;
export const airFlow = (W, dT) => W / (CP_AIR * dT) / RHO_AIR * 1000;   // litres a second

// Infrared reaching a person or a curtain at distance d (m) from a heater of size a (m): the
// forward share of the radiant power spread over a sphere, boosted by the reflector's gain and
// softened near the heater, E = rad·P·gain ÷ 4π(d² + a²).
export const irradiance = (h, W, d, a = 0.25) => (h.rad * W * h.gain) / (4 * Math.PI * (d * d + a * a));
// How much warmer the side facing the heater feels: the absorbed infrared (skin and clothes absorb
// ~0.7 of it) divided by the combined surface heat-transfer coefficient of a person, about 8 W/m²K
// (ASHRAE Fundamentals, ch. 9: radiative ~4.7 + convective ~3.1 for someone sitting still).
export const feelBoost = (E) => (0.7 * E) / 8;
// A fan heater's warm jet: outlet ΔT 40 K through an outlet about 12 cm across; the excess
// temperature on a round jet's centreline falls roughly as 5·D/x (Rajaratnam, Turbulent Jets, 1976).
export function jetExcess(d, dT0 = 40, D = 0.12) { return dT0 * Math.min(1, (5 * D) / Math.max(0.05, d)); }

// ---------------------------------------------------------------- the room
// A two-node model of a room (the usual "2R2C" grey-box model of building physics):
//  - an AIR node: the air plus light furniture, C = 3 × ρ·cp·V;
//  - a SURFACE node: the inner skin of walls, floor and ceiling. Brick's diffusivity (k 0.7 W/m·K,
//    ρ 1,800, c 840 → α 4.6e-7 m²/s) lets heat soak about 2–4 cm deep in the first hour; we count
//    30 kJ per m² per K of surface. That big store is why walls take hours to warm through.
// Heat flows: the heater's convective part warms the air; its infrared lands on the surfaces (and
// you). Air and surfaces swap heat by natural convection, h ≈ 3 W/m²K (ASHRAE Fundamentals ch. 4:
// 1.3–3.1 W/m²K for still room air on walls and ceilings). Air leaks out with the ventilation and through the window (U = 5.8 W/m²K for a
// single-glazed pane). Surfaces lose heat through outside walls (U-values: 115 mm half-brick ≈ 3.0,
// 230 mm plastered brick ≈ 2.0, insulated/cavity ≈ 0.6 W/m²K; CIBSE Guide A, ECBC 2017 tables),
// through a bare RCC roof on the top floor (≈ 3.2), and through partitions and floor into unheated
// neighbouring rooms, which we take to sit 4 °C above the outside air (an assumption).
export const INSULATION = {
  poor: { name: 'Poor', sub: 'half-brick walls, gappy windows, top floor', Uw: 3.0, Uwin: 5.8, ach: 1.5, roof: 3.2 },
  typical: { name: 'Typical', sub: '230 mm brick, single glass', Uw: 2.0, Uwin: 5.8, ach: 0.8, roof: 0 },
  good: { name: 'Good', sub: 'insulated walls, double glazing, sealed', Uw: 0.6, Uwin: 2.8, ach: 0.4, roof: 0 },
};
export const ROOMS = { 10: 'small bedroom', 14: 'bedroom', 20: 'living room', 30: 'hall' };
export function roomParams({ area = 14, h = 3, ins = 'typical', tout = 7.5 }) {
  const I = INSULATION[ins] || INSULATION.typical, side = Math.sqrt(area), V = area * h;
  const Atot = 4 * side * h + 2 * area, Awin = Math.max(1.2, area * 0.12);
  const Aext = 2 * side * h - Awin;                             // a corner room: two outside walls
  const Aint = 2 * side * h + (I.roof ? area : 2 * area);       // partitions + floor (+ ceiling unless the roof is outside)
  return {
    V, Atot, Awin, Aext, Aint, I, tout, tn: tout + 4,
    Ca: 3 * RHO_AIR * CP_AIR * V,
    Cs: 30e3 * Atot,
    Kas: 3.0 * Atot,
    Kvent: RHO_AIR * CP_AIR * I.ach * V / 3600 + I.Uwin * Awin,
    Kext: I.Uw * Aext + I.roof * area,
    Kint: 1.5 * Aint,
  };
}
// Simulate a night. heat: { id, W, cop } ; thermostat set (°C) or null.
// Returns samples every minute: { t, Ta, Ts, P (electric W), Q (heat W) } and totals.
export function simulateNight(p, { id = 'ofr', W = 2000, cop = 1, set = 22, stat = true, hours = 8, start = null }) {
  const H = HEATERS[id] || HEATERS.ofr, dt = 10;
  let Ta = start ?? p.tout + 5, Ts = Ta, on = true, out = 0, kWh = 0, tWarm = null;
  const samples = [];
  const N = Math.round((hours * 3600) / dt);
  for (let i = 0; i <= N; i++) {
    const t = i * dt;
    if (stat && H.thermostat) { if (Ta >= set + 0.5) on = false; else if (Ta <= set - 0.5) on = true; }
    const Pel = on ? W : 0;
    out += (Pel * cop - out) * (1 - Math.exp(-dt / H.tau));     // heater body lag (big for oil)
    const qRad = out * H.rad, qConv = out - qRad;
    const dTa = (qConv - p.Kas * (Ta - Ts) - p.Kvent * (Ta - p.tout)) / p.Ca;
    const dTs = (qRad + p.Kas * (Ta - Ts) - p.Kext * (Ts - p.tout) - p.Kint * (Ts - p.tn)) / p.Cs;
    if (i % 6 === 0) samples.push({ t: t / 3600, Ta, Ts, op: (Ta + Ts) / 2, P: Pel, Q: out });
    Ta += dTa * dt; Ts += dTs * dt;
    kWh += (Pel * dt) / 3.6e6;
    if (tWarm === null && Ta >= set - 0.3) tWarm = t / 3600;
  }
  // True steady state with the heater on flat out (solve the two linear balances).
  const Q = W * cop, qr = Q * H.rad, qc = Q - qr;
  // Ta: qc = Kas(Ta−Ts) + Kvent(Ta−To) ; Ts: qr + Kas(Ta−Ts) = Kext(Ts−To) + Kint(Ts−Tn)
  const a1 = p.Kas + p.Kvent, b1 = -p.Kas, c1 = qc + p.Kvent * p.tout;
  const a2 = -p.Kas, b2 = p.Kas + p.Kext + p.Kint, c2 = qr + p.Kext * p.tout + p.Kint * p.tn;
  const det = a1 * b2 - b1 * a2, TaS = (c1 * b2 - b1 * c2) / det, TsS = (a1 * c2 - c1 * a2) / det;
  const UA = Q / Math.max(0.1, (TaS + TsS) / 2 - p.tout);
  return { samples, kWh, tWarm, steady: { Ta: TaS, Ts: TsS, op: (TaS + TsS) / 2 }, UA, start: samples[0].Ta };
}

// ---------------------------------------------------------------- PTC ceramic
// Doped barium titanate turns from a conductor into a near-insulator just above its switching
// (Curie) temperature: resistance climbs by a factor of ten every ~12 °C (datasheet slopes for
// heater-grade PTC stones; switch points 120–250 °C, EPCOS/TDK "PTC thermistors for heating").
// R(T) = Rmin·(1 + 10^((T − Tsw)/12)). Rmin = 11 Ω gives the ~2 kW a 230 V fan heater draws.
export const PTC = { Rmin: 11, Tsw: 220, dec: 12, C: 150 };
export const ptcR = (T) => PTC.Rmin * (1 + Math.pow(10, (T - PTC.Tsw) / PTC.dec));
// Heat carried away by the air: natural convection only (fan off) ≈ 0.8 W/K; the fan adds ~4.5 W/K
// per m/s of air through the fins (so 2 m/s carries 2 kW away at about 225 °C).
export const ptcG = (v) => 0.8 + 4.5 * v;
export function ptcStep(T, v, Ta, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (let i = 0; i < n; i++) { const P = (V_MAINS ** 2) / ptcR(T); T += ((P - ptcG(v) * (T - Ta)) / PTC.C) * h; }
  return T;
}
// Steady operating point for a given air speed (bisection on V²/R(T) = G(T − Ta)).
export function ptcSteady(v, Ta = 20) {
  let lo = Ta, hi = 400;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, f = (V_MAINS ** 2) / ptcR(m) - ptcG(v) * (m - Ta); if (f > 0) lo = m; else hi = m; }
  const T = (lo + hi) / 2; return { T, R: ptcR(T), P: (V_MAINS ** 2) / ptcR(T) };
}
// Nichrome coil for comparison: resistance nearly flat with temperature (+~5% from 20 to 800 °C),
// so with the fan off it just gets hotter and hotter until a cut-out trips.
export const nichromeR = (T) => 26.5 * (1 + 0.00007 * (T - 20));

// ---------------------------------------------------------------- humidity
// Saturation vapour pressure over water, kPa (Magnus formula, WMO / Alduchov & Eskridge 1996).
export const psat = (T) => 0.6112 * Math.exp((17.62 * T) / (243.12 + T));
// Warming air without adding water keeps its vapour pressure, so RH falls: RH₂ = RH₁·psat(T₁)/psat(T₂).
export const rhAfter = (rh1, T1, T2) => clamp((rh1 * psat(T1)) / psat(T2), 0, 100);
export const gPerKg = (rh, T) => { const e = (rh / 100) * psat(T); return (622 * e) / (101.325 - e); };

// ---------------------------------------------------------------- carbon monoxide
// Burning fuel in a room: CO made per kg of fuel (emission factors vary a lot with the fire; rounded
// middle values for household burning from Zhang et al., Atmos. Environ. 34 (2000) 4537 and Smith
// et al., "Greenhouse implications of household stoves: an analysis for India", Annu. Rev. Energy
// Environ. 25 (2000) 741): charcoal ~150 g/kg (a smouldering charcoal bed makes a lot of CO), coal
// ~80 g/kg, wood ~60 g/kg, LPG ~3 g/kg in a good flame. Burn rates are for a typical small fire.
export const FUELS = {
  angithi: { name: 'Charcoal angithi', kgph: 0.3, gCO: 150, gO2: 2400, heat: 2400 },
  coal: { name: 'Coal sigri', kgph: 0.4, gCO: 80, gO2: 2000, heat: 2700 },
  wood: { name: 'Wood fire in a pot', kgph: 0.8, gCO: 60, gO2: 1300, heat: 3400 },
  gas: { name: 'LPG gas heater', kgph: 0.12, gCO: 3, gO2: 3500, heat: 1500 },
  electric: { name: 'Electric heater', kgph: 0, gCO: 0, gO2: 0, heat: 2000 },
};
// Ventilation, air changes an hour: a closed room with the gaps stuffed ~0.2, a normal closed room
// ~0.5, a window open a hand's width ~3 (ASHRAE Fundamentals ch. 16 infiltration ranges).
export const VENT = { sealed: { name: 'Sealed shut', ach: 0.2 }, closed: { name: 'Closed', ach: 0.5 }, ajar: { name: 'Window ajar', ach: 3 } };
export const MG_PER_PPM = 1.145;   // mg/m³ of CO in 1 ppm at 25 °C
// Coburn–Forster–Kane equation (J. Clin. Invest. 44, 1965, 1899) with the resting constants used by
// the US EPA (Peterson & Stewart 1975): blood volume Vb 5,500 mL, lung diffusing capacity for CO
// DL 30 mL/min/mmHg, alveolar ventilation VA 4,500 mL/min for someone asleep, dry-air pressure
// PL 713 mmHg, O₂ pressure in the lung capillaries 100 mmHg, Haldane constant M 218, CO made by the
// body 0.007 mL/min, blood holds 0.2 mL of O₂ (or CO) per mL when fully loaded.
export function cfkStep(cohb, ppm, dtMin, VA = 4500) {
  const Vb = 5500, DL = 30, PL = 713, Pc = 100, Mh = 218, Vco = 0.007, Hb = 0.2;
  const B = 1 / DL + PL / VA, Pi = ppm * 1e-6 * PL;
  const n = Math.max(1, Math.ceil(dtMin / 0.5)), h = dtMin / n;
  for (let i = 0; i < n; i++) {
    const o2hb = Math.max(0.01, Hb - cohb);
    cohb += ((Vco + Pi / B - (cohb * Pc) / (Mh * B * o2hb)) / Vb) * h;
  }
  return clamp(cohb, 0, Hb);
}
export const cohbPct = (c) => (c / 0.2) * 100;
// Effects by blood COHb (Ernst & Zibrak, NEJM 339 (1998) 1603; WHO Air Quality Guidelines for
// Europe 2000, ch. 5.5). Individual responses vary widely; asleep, people notice nothing.
export const COHB_EFFECTS = [
  [0, 'normal (0.5–3%, more in smokers)'],
  [10, 'headache, tiredness'],
  [20, 'throbbing headache, nausea, dizziness'],
  [30, 'confusion, weak legs, can’t get up'],
  [40, 'collapse, fast heartbeat'],
  [50, 'coma, fits'],
  [60, 'often fatal'],
];
export const effectAt = (pct) => { let e = COHB_EFFECTS[0][1]; for (const [p, t] of COHB_EFFECTS) if (pct >= p) e = t; return e; };
// A night in a closed room with a fire. Well-mixed box: dC/dt = G/V − ach·C.
export function coNight({ fuel = 'angithi', vent = 'closed', area = 12, h = 3, hours = 8, kgph = null }) {
  const F = FUELS[fuel], ach = VENT[vent].ach, V = area * h, rate = kgph ?? F.kgph;
  const G = rate * F.gCO * 1000;                       // mg of CO an hour
  const O2use = (rate * F.gO2) / 1.33;                 // litres of O₂ an hour (O₂ is 1.33 g/L)
  let C = 0, O2 = 20.9, cohb = 0.003;
  const out = [], dt = 1 / 60;
  let tHead = null, tDanger = null;
  for (let i = 0; i <= hours * 60; i++) {
    const t = i * dt, ppm = C / MG_PER_PPM, pct = cohbPct(cohb);
    if (i % 3 === 0) out.push({ t, ppm, cohb: pct, O2 });
    if (tHead === null && pct >= 10) tHead = t;
    if (tDanger === null && pct >= 30) tDanger = t;
    C += (G / V - ach * C) * dt;
    O2 += ((-O2use / 1000 / V) * 100 - ach * (O2 - 20.9)) * dt;
    cohb = cfkStep(cohb, C / MG_PER_PPM, 1);
  }
  return { out, G, V, ach, tHead, tDanger, steadyPpm: G / (ach * V) / MG_PER_PPM };
}

// ---------------------------------------------------------------- numbers people can read
export const fmtW = (W) => (Math.abs(W) >= 1000 ? (W / 1000).toFixed(W >= 10000 ? 0 : 1) + ' kW' : Math.round(W) + ' W');
export const fmtH = (h) => { if (h === null || h === undefined || !isFinite(h)) return '—'; const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };
export const rs = (v) => '₹' + Math.round(v).toLocaleString('en-IN');

// ---------------------------------------------------------------- chart boards
export function board(parent, w, h, pxW, pxH, draw, pos) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = (...a) => { draw(g, pxW, pxH, ...a); tex.needsUpdate = true; };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(...pos); parent.add(m);
  redraw();
  return { tex, redraw, canvas: c, mesh: m };
}
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 18) : g.rect(0, 0, w, h); g.fill(); }
export function title(g, text, sub = '') {
  g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText(text, 22, 38);
  if (sub) { g.font = '19px sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(sub, 22, 64); }
}
export function axes(g, { x0, x1, y0, y1, xMin = 0, xMax, yMin = 0, yMax, xTicks = [], yTicks = [], xFmt = String, yFmt = String, xLabel = '', yLabel = '', logY = false }) {
  const X = (x) => x0 + ((x - xMin) / (xMax - xMin)) * (x1 - x0);
  const Y = logY ? (y) => y0 - ((Math.log10(Math.max(y, 1e-9)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin))) * (y0 - y1)
    : (y) => y0 - ((y - yMin) / (yMax - yMin)) * (y0 - y1);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '18px sans-serif';
  for (const t of xTicks) { g.beginPath(); g.moveTo(X(t), y1); g.lineTo(X(t), y0); g.stroke(); const s = xFmt(t); g.fillText(s, X(t) - g.measureText(s).width / 2, y0 + 24); }
  for (const t of yTicks) { g.beginPath(); g.moveTo(x0, Y(t)); g.lineTo(x1, Y(t)); g.stroke(); const s = yFmt(t); g.fillText(s, x0 - 10 - g.measureText(s).width, Y(t) + 6); }
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '17px sans-serif';
  if (xLabel) g.fillText(xLabel, x1 - g.measureText(xLabel).width, y0 + 48);
  if (yLabel) g.fillText(yLabel, x0 + 8, y1 - 10);
  return { X, Y };
}
export function line(g, pts, X, Y, col, wdt = 4, dash = null) {
  if (pts.length < 2) return;
  g.strokeStyle = col; g.lineWidth = wdt; g.setLineDash(dash || []); g.lineJoin = 'round'; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
  g.stroke(); g.setLineDash([]);
}
export function dot(g, x, y, col, r = 9) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
export function legend(g, items, x, y) {
  g.font = 'bold 17px sans-serif';
  for (const [n, c] of items) { g.fillStyle = c; g.fillRect(x, y - 13, 16, 16); g.fillStyle = '#e8eef8'; g.fillText(n, x + 22, y + 1); x += 40 + g.measureText(n).width; }
}

// ---------------------------------------------------------------- particles
export function dots(n, r, color = 0xffffff, opacity = 0.9) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: opacity < 1, opacity, toneMapped: false, depthWrite: opacity >= 1 }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false;
  const o = new THREE.Object3D(), col = new THREE.Color(color);
  for (let i = 0; i < n; i++) mesh.setColorAt(i, col);
  mesh.place = (i, x, y, z, s = 1) => { o.position.set(x, y, z); o.scale.setScalar(Math.max(0.0001, s)); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); };
  mesh.tint = (i, c) => mesh.setColorAt(i, c);
  mesh.done = () => { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  mesh.hideAll = () => { for (let i = 0; i < n; i++) mesh.place(i, 0, -999, 0, 0.0001); mesh.done(); };
  return mesh;
}
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- materials and small parts
export const elemMat = (base = 0x8a8f98) => new THREE.MeshStandardMaterial({ color: base, metalness: 0.6, roughness: 0.4, emissive: 0x000000, emissiveIntensity: 0 });
function xrayable(mats, xo = 0.12) {
  mats.forEach((m) => { m.transparent = true; });
  return (on) => mats.forEach((m) => { m.opacity = on ? xo : 1; m.depthWrite = !on; });
}
// A wire guard: a grid of thin bars across a w×h rectangle in the XY plane.
export function grille(w, h, n, mat, horiz = true) {
  const g = new THREE.Group();
  for (let i = 0; i <= n; i++) {
    const k = -0.5 + i / n;
    g.add(horiz ? beam([-w / 2, k * h, 0], [w / 2, k * h, 0], 0.025, mat, 6) : beam([k * w, -h / 2, 0], [k * w, h / 2, 0], 0.025, mat, 6));
  }
  g.add(beam([-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], 0.04, mat, 8), beam([-w / 2, h / 2, 0], [w / 2, h / 2, 0], 0.04, mat, 8));
  g.traverse((o) => { o.castShadow = false; });
  return g;
}
// A coil of wire along X, radius R, around an optional core.
export function coilX(x0, x1, R, r, turns, mat) {
  const pts = [], N = Math.round(turns * 14);
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * TAU; pts.push([lerp(x0, x1, t), R * Math.cos(a), R * Math.sin(a)]); }
  return tube(pts, r, mat, false, N * 2);
}
// Move a mesh made by rod() (already centred in x) to height y and depth z.
function atYZ(m, y, z) { m.position.y = y; m.position.z = z; return m; }
function knob(mat, r = 0.22) { const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 20), mat); k.rotation.x = Math.PI / 2; k.castShadow = true; return k; }
function lamp() { const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), M.glow(0x3a2626)); l.set = (on) => l.material.color.set(on ? 0xff4a2a : 0x3a2626); return l; }

// ---------------------------------------------------------------- 1. radiant heater (rod / quartz / halogen)
// A floor-standing radiant heater about 40 cm wide and 50 cm tall: two or three horizontal tubes in
// front of a polished trough reflector, behind a wire guard. Origin: centre of the base, on the floor.
export function makeRadiant(kind = 'rod') {
  const g = new THREE.Group(), P = { kind };
  const n = kind === 'halogen' ? 3 : 2, W = 3.6, H0 = 0.7, H1 = 4.8;
  const bodyMat = M.plastic(0x2a2e37, { roughness: 0.35 });
  P.setXray = xrayable([bodyMat], 0.15);
  // Side cheeks, base and top.
  const cheekL = box(0.3, H1 - H0 + 0.3, 1.4, bodyMat); cheekL.position.set(-W / 2 - 0.15, (H0 + H1) / 2, 0);
  const cheekR = cheekL.clone(); cheekR.position.x = W / 2 + 0.15;
  const top = box(W + 0.6, 0.25, 1.4, bodyMat); top.position.y = H1 + 0.1;
  const base = box(W + 1.4, 0.3, 2.2, M.plastic(0x1d2027)); base.position.y = 0.15;
  const neck = box(W + 0.6, 0.45, 1.4, bodyMat); neck.position.y = H0 - 0.1;
  g.add(cheekL, cheekR, top, base, neck);
  // Polished reflector: one trough (half-cylinder) behind each tube.
  const refl = M.metal(0xe8edf5, { roughness: 0.12, side: THREE.DoubleSide });
  P.tubes = []; P.elems = []; P.mats = [];
  for (let i = 0; i < n; i++) {
    const y = H0 + 0.55 + ((H1 - H0 - 1.1) * (i + 0.5)) / n;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, W, 32, 1, true, Math.PI, Math.PI), refl);
    tr.rotation.z = Math.PI / 2; tr.position.set(0, y, -0.05); g.add(tr);
    const em = elemMat(kind === 'halogen' ? 0x9a8f7a : 0x8a8f98);
    P.mats.push(em);
    if (kind === 'rod') {
      // A white ceramic rod with nichrome wire wound round it.
      g.add(atYZ(rod(-W / 2, W / 2, 0.14, 0.14, M.matte(0xefe9dc)), y, 0.2));
      const c = coilX(-W / 2 + 0.1, W / 2 - 0.1, 0.16, 0.025, 42, em); c.position.set(0, y, 0.2); g.add(c); P.elems.push(c);
    } else {
      // A clear quartz tube; inside, a coil (quartz) or a thin straight filament (halogen).
      const glass = rod(-W / 2, W / 2, 0.16, 0.16, M.clear(0xf0f6ff, 0.28, { roughness: 0.05 })); glass.castShadow = false; glass.position.set(0, y, 0.2); g.add(glass);
      if (kind === 'halogen') {
        // Half the tube's back often carries a gold reflective coating.
        const gold = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, W - 0.2, 20, 1, true, Math.PI, Math.PI), M.metal(0xd8a642, { roughness: 0.2, side: THREE.DoubleSide }));
        gold.rotation.z = Math.PI / 2; gold.position.set(0, y, 0.2); g.add(gold);
        const f = coilX(-W / 2 + 0.15, W / 2 - 0.15, 0.028, 0.02, 45, em); f.position.set(0, y, 0.2); g.add(f); P.elems.push(f);
      } else {
        const c = coilX(-W / 2 + 0.15, W / 2 - 0.15, 0.07, 0.018, 60, em); c.position.set(0, y, 0.2); g.add(c); P.elems.push(c);
      }
    }
    // Metal end caps.
    [-1, 1].forEach((sd) => { const cap = rod(sd * W / 2 - 0.12, sd * W / 2 + 0.12, 0.19, 0.19, M.metal(0xb9bec8)); cap.position.set(0, y, 0.2); g.add(cap); });
    P.tubes.push(y);
  }
  // Front guard.
  P.guard = grille(W + 0.2, H1 - H0, 10, M.metal(0xcfd4dc, { roughness: 0.3 }), true); P.guard.position.set(0, (H0 + H1) / 2, 0.72); g.add(P.guard);
  // Switches, pilot lamp and tip-over switch plunger underneath.
  P.knobs = [knob(M.plastic(0xe6e9ee), 0.16), knob(M.plastic(0xe6e9ee), 0.16)];
  P.knobs[0].position.set(-0.5, H0 - 0.1, 0.72); P.knobs[1].position.set(0.5, H0 - 0.1, 0.72); g.add(...P.knobs);
  P.lamp = lamp(); P.lamp.position.set(0, H0 - 0.1, 0.72); g.add(P.lamp);
  P.tip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 12), M.plastic(0xd12f2f)); P.tip.position.set(0, -0.02, 0.3); g.add(P.tip);
  P.set = (Tc, k) => { P.mats.forEach((m) => setGlow(m, Tc, k, kind === 'halogen' ? 0x9a8f7a : 0x8a8f98)); P.lamp.set(k > 0.02); };
  P.size = { w: W + 1.4, h: H1 + 0.3, face: 0.72 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 2. fan heater
// About 25 × 28 × 14 cm: a fan at the back blows room air through a zig-zag nichrome coil on a mica
// frame. A thermostat and a thermal cut-out sit near the coil. Origin: floor, centre.
export function makeFan() {
  const g = new THREE.Group(), P = {};
  const shell = M.plastic(0xe9ecf1, { roughness: 0.35 });
  P.setXray = xrayable([shell], 0.12);
  const body = box(2.6, 2.8, 1.5, shell); body.position.y = 1.55; g.add(body);
  const foot = box(2.2, 0.15, 1.8, M.plastic(0x2a2e37)); foot.position.y = 0.08; g.add(foot);
  P.grille = grille(2.0, 1.7, 9, M.plastic(0x3a3f4a), true); P.grille.position.set(0, 1.45, 0.77); g.add(P.grille);
  // Fan (behind), with four blades, facing +z.
  P.fan = new THREE.Group(); P.fan.position.set(0, 1.45, -0.45);
  const bm = M.plastic(0x7a8394);
  for (let i = 0; i < 5; i++) { const b = box(0.28, 0.72, 0.03, bm); b.position.y = 0.4; const piv = new THREE.Group(); piv.rotation.z = (i / 5) * TAU; b.rotation.y = 0.45; piv.add(b); P.fan.add(piv); }
  P.fan.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16), bm).rotateX(Math.PI / 2));
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 20), M.metal(0x6b7280)); motor.rotation.x = Math.PI / 2; motor.position.set(0, 1.45, -0.72);
  g.add(P.fan, motor);
  // Mica frame and zig-zag coil in front of the fan.
  const mica = box(1.9, 1.5, 0.04, M.clear(0xd9c9a0, 0.45)); mica.position.set(0, 1.45, 0.25); g.add(mica);
  P.coilMat = elemMat();
  const pts = [];
  for (let i = 0; i <= 8; i++) { const y = 0.8 + (i / 8) * 1.3; pts.push([i % 2 ? 0.85 : -0.85, y, 0.3]); pts.push([i % 2 ? -0.85 : 0.85, y, 0.3]); }
  // Short wiggles along each run so it reads as a coil.
  P.coil = new THREE.Group();
  for (let i = 0; i < 8; i++) { const y = 0.85 + (i / 7) * 1.2; const c = coilX(-0.85, 0.85, 0.05, 0.014, 18, P.coilMat); c.position.set(0, y, 0.32); P.coil.add(c); }
  g.add(P.coil);
  P.stat = box(0.3, 0.2, 0.2, M.plastic(0x2a2e37)); P.stat.position.set(1.0, 2.55, 0.3); g.add(P.stat);
  P.cutout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), M.metal(0x9aa3b2)); P.cutout.rotation.x = Math.PI / 2; P.cutout.position.set(-1.0, 2.5, 0.3); g.add(P.cutout);
  P.knob = knob(M.plastic(0x2a2e37), 0.16); P.knob.position.set(0.8, 2.65, 0.77); g.add(P.knob);
  P.lamp = lamp(); P.lamp.position.set(-0.8, 2.65, 0.77); g.add(P.lamp);
  P.set = (Tc, k) => { setGlow(P.coilMat, Tc, k); P.lamp.set(k > 0.02); };
  P.outlet = [0, 1.45, 0.85];
  P.size = { w: 2.6, h: 2.95, face: 0.77 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 3. oil-filled radiator
// Eleven pressed-steel fins, 60 cm tall, sealed and part-filled with mineral oil. The element sits
// in the oil at the bottom; the control box on one end holds the switches, the thermostat and a
// thermal fuse. Origin: floor, centre.
export function makeOFR(fins = 11) {
  const g = new THREE.Group(), P = {};
  const steel = M.plastic(0xf1f2f4, { roughness: 0.3, metalness: 0.15 });
  const steelIn = steel.clone();
  P.setXray = xrayable([steel], 0.14);
  const pitch = 0.55, H = 5.6, D = 2.3, y0 = 0.9;
  P.fins = [];
  const finGeo = new THREE.BoxGeometry(0.22, H, D);
  for (let i = 0; i < fins; i++) {
    const x = (i - (fins - 1) / 2) * pitch;
    const f = new THREE.Mesh(finGeo, steel); f.position.set(x, y0 + H / 2, 0); f.castShadow = true; f.receiveShadow = true;
    // Rounded top and bottom so each fin reads as a pressed section.
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, D, 12), steel); tp.rotation.x = Math.PI / 2; tp.position.set(x, y0 + H, 0);
    g.add(f, tp); P.fins.push(f);
  }
  // Top and bottom channels joining the fins (the oil flows through these).
  const span = (fins - 1) * pitch;
  g.add(atYZ(rod(-span / 2, span / 2, 0.2, 0.2, steelIn), y0 + 0.35, 0));
  g.add(atYZ(rod(-span / 2, span / 2, 0.2, 0.2, steelIn), y0 + H - 0.3, 0));
  // Oil inside (seen in X-ray): an amber slab in each fin, to about 85% full.
  P.oilMat = new THREE.MeshBasicMaterial({ color: 0xd99a2b, transparent: true, opacity: 0.55, depthWrite: false });
  P.oil = new THREE.Group();
  for (let i = 0; i < fins; i++) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.14, H * 0.84, D - 0.2), P.oilMat); o.position.set((i - (fins - 1) / 2) * pitch, y0 + H * 0.44, 0); P.oil.add(o); }
  g.add(P.oil);
  // Element along the bottom channel, inside the oil.
  P.elemMat = elemMat(0xb87333);
  P.element = rod(-span / 2 + 0.2, span / 2 + 0.6, 0.08, 0.08, P.elemMat); P.element.position.set(0, y0 + 0.35, 0); g.add(P.element);
  // Control box at the +x end.
  P.box = new THREE.Group(); P.box.position.set(span / 2 + 0.75, y0 + 0.6, 0);
  P.box.add(box(0.9, 1.6, 2.0, M.plastic(0x2a2e37)));
  P.knob = knob(M.plastic(0xe6e9ee), 0.2); P.knob.rotation.set(0, 0, Math.PI / 2); P.knob.position.set(0.5, 0.35, 0.3); P.box.add(P.knob);
  P.sw1 = box(0.1, 0.22, 0.34, M.plastic(0xff5a3d)); P.sw1.position.set(0.47, -0.2, -0.3); P.box.add(P.sw1);
  P.sw2 = box(0.1, 0.22, 0.34, M.plastic(0xff5a3d)); P.sw2.position.set(0.47, -0.2, 0.2); P.box.add(P.sw2);
  P.lamp = lamp(); P.lamp.position.set(0.5, 0.65, 0); P.box.add(P.lamp);
  g.add(P.box);
  // Feet on castors.
  [-1, 1].forEach((sd) => {
    const x = sd * (span / 2 - pitch);
    const leg = box(0.3, 0.6, 2.8, M.plastic(0x2a2e37)); leg.position.set(x, 0.55, 0); g.add(leg);
    [-1.2, 1.2].forEach((z) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 16), M.plastic(0x1d2027)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.2, z); g.add(w); });
  });
  P.set = (Tc, k) => { setGlow(P.elemMat, Tc, k, 0xb87333); P.lamp.set(k > 0.02); };
  P.setSurface = (Tc) => { const c = new THREE.Color(0xf1f2f4).lerp(new THREE.Color(0xffb08a), clamp((Tc - 25) / 70, 0, 1) * 0.45); steel.color.copy(c); steelIn.color.copy(c); };
  P.dims = { span, H, D, y0, pitch, fins };
  P.size = { w: span + 1.6, h: y0 + H + 0.2, face: D / 2 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 4. carbon tower heater
// A standing tower about 75 cm tall: one vertical carbon-fibre filament in a quartz tube, in front of
// a curved reflector and behind a guard. It swings from side to side. Origin: floor, centre.
export function makeCarbon() {
  const g = new THREE.Group(), P = {};
  const shell = M.plastic(0x2a2e37, { roughness: 0.3 });
  P.setXray = xrayable([shell], 0.15);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.3, 40), M.plastic(0x1d2027)); base.position.y = 0.15; g.add(base);
  P.head = new THREE.Group(); P.head.position.y = 0.3; g.add(P.head);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6.6, 32, 1, false, Math.PI * 0.75, Math.PI * 1.5), shell); back.position.y = 3.6; P.head.add(back);
  const refl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 5.6, 32, 1, true, Math.PI * 0.6, Math.PI * 0.8), M.metal(0xe8edf5, { roughness: 0.1, side: THREE.DoubleSide }));
  refl.rotation.y = Math.PI; refl.position.set(0, 3.6, 0.2); P.head.add(refl);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.4, 20), M.clear(0xf0f6ff, 0.3)); glass.position.set(0, 3.6, 0.35); glass.castShadow = false; P.head.add(glass);
  P.mat = elemMat(0x3a3a3a);
  const fil = box(0.14, 5.0, 0.02, P.mat); fil.position.set(0, 3.6, 0.35); P.head.add(fil);
  const gr = grille(1.5, 5.8, 1, M.metal(0xcfd4dc), true); gr.position.set(0, 3.6, 0.95); P.head.add(gr);
  for (let i = 0; i <= 8; i++) { const x = -0.7 + (i * 1.4) / 8; P.head.add(beam([x, 0.8, 0.95], [x, 6.4, 0.95], 0.022, M.metal(0xcfd4dc), 6)); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 32), shell); cap.position.y = 7.0; P.head.add(cap);
  P.lamp = lamp(); P.lamp.position.set(0, 6.8, 0.93); P.head.add(P.lamp);
  P.set = (Tc, k) => { setGlow(P.mat, Tc, k, 0x3a3a3a); P.lamp.set(k > 0.02); };
  P.size = { w: 2.9, h: 7.4, face: 0.95 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 5. PTC ceramic heater
// A small box about 20 × 25 × 15 cm: a block of PTC ceramic "stones" clamped between corrugated
// aluminium fins, with a fan behind. Origin: floor, centre.
export function makePTC() {
  const g = new THREE.Group(), P = {};
  const shell = M.plastic(0xf3f4f6, { roughness: 0.35 });
  P.setXray = xrayable([shell], 0.12);
  const body = box(2.0, 2.5, 1.5, shell); body.position.y = 1.35; g.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 32), M.plastic(0x2a2e37)); foot.position.y = 0.06; g.add(foot);
  P.grille = grille(1.5, 1.2, 8, M.plastic(0x5ce1a9, { roughness: 0.4 }), false); P.grille.position.set(0, 1.4, 0.77); g.add(P.grille);
  // The PTC block: aluminium fins (a stack of thin plates) with ceramic stones between.
  P.block = new THREE.Group(); P.block.position.set(0, 1.4, 0.35);
  const alu = M.metal(0xc9ced6, { roughness: 0.35 });
  for (let i = 0; i < 9; i++) { const f = box(1.3, 0.035, 0.35, alu); f.position.y = -0.5 + i * 0.125; P.block.add(f); }
  P.stoneMat = elemMat(0x3a3f4a);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { const s = box(0.22, 0.05, 0.3, P.stoneMat); s.position.set(-0.45 + i * 0.3, -0.19 + r * 0.38, 0); P.block.add(s); }
  g.add(P.block);
  P.fan = new THREE.Group(); P.fan.position.set(0, 1.4, -0.35);
  for (let i = 0; i < 6; i++) { const b = box(0.2, 0.5, 0.03, M.plastic(0x7a8394)); b.position.y = 0.28; const piv = new THREE.Group(); piv.rotation.z = (i / 6) * TAU; b.rotation.y = 0.5; piv.add(b); P.fan.add(piv); }
  g.add(P.fan);
  P.knob = knob(M.plastic(0x2a2e37), 0.14); P.knob.position.set(0, 2.35, 0.77); g.add(P.knob);
  P.lamp = lamp(); P.lamp.position.set(0.5, 2.35, 0.77); g.add(P.lamp);
  P.set = (Tc, k) => { setGlow(P.stoneMat, Tc, k, 0x3a3f4a); P.stoneMat.emissive.setHex(0xff6a2a); P.stoneMat.emissiveIntensity = clamp((Tc - 60) / 300, 0, 1) * 0.5 * k; P.lamp.set(k > 0.02); };
  P.outlet = [0, 1.4, 0.85];
  P.size = { w: 2.4, h: 2.7, face: 0.77 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 6. convector
// A low panel about 60 × 40 × 12 cm on feet: cool air enters at the bottom, passes a finned element,
// rises out of louvres at the top. Origin: floor, centre.
export function makeConvector() {
  const g = new THREE.Group(), P = {};
  const shell = M.plastic(0xeef0f3, { roughness: 0.3 });
  P.setXray = xrayable([shell], 0.12);
  const body = box(6.0, 3.8, 1.2, shell); body.position.y = 2.6; g.add(body);
  [-2.4, 2.4].forEach((x) => { const f = box(0.25, 0.7, 2.0, M.plastic(0x2a2e37)); f.position.set(x, 0.35, 0); g.add(f); });
  const lv = M.plastic(0x5a6070);
  for (let i = 0; i < 16; i++) { const l = box(0.06, 0.05, 0.9, lv); l.position.set(-2.5 + i * 0.333, 4.52, 0); g.add(l); }
  const slot = box(5.4, 0.18, 0.05, lv); slot.position.set(0, 0.95, 0.61); g.add(slot);
  // Finned element near the bottom.
  P.elemMat = elemMat();
  P.element = rod(-2.6, 2.6, 0.07, 0.07, P.elemMat); P.element.position.set(0, 1.35, 0); g.add(P.element);
  const fin = M.metal(0xb9bec8, { roughness: 0.4 });
  for (let i = 0; i < 26; i++) { const f = box(0.03, 0.55, 0.7, fin); f.position.set(-2.5 + i * 0.2, 1.35, 0); g.add(f); }
  P.knob = knob(M.plastic(0x2a2e37), 0.16); P.knob.position.set(2.4, 4.0, 0.62); g.add(P.knob);
  P.lamp = lamp(); P.lamp.position.set(1.9, 4.0, 0.62); g.add(P.lamp);
  P.set = (Tc, k) => { setGlow(P.elemMat, Tc, k); P.lamp.set(k > 0.02); };
  P.size = { w: 6.0, h: 4.6, face: 0.62 };
  return { group: g, ...P };
}

// ---------------------------------------------------------------- 7. angithi
// A cast-iron or clay bowl about 30 cm across on three legs, full of glowing charcoal. No flue: all
// the smoke and carbon monoxide stay in the room. Origin: floor, centre.
export function makeAngithi() {
  const g = new THREE.Group(), P = {};
  const iron = M.metal(0x3a3430, { roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide });
  P.setXray = () => {};
  const prof = [[0, 0.0], [0.9, 0.05], [1.35, 0.4], [1.55, 1.1], [1.5, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), iron); bowl.position.y = 0.9; bowl.castShadow = true; g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.06, 8, 40), iron); rim.rotation.x = Math.PI / 2; rim.position.y = 2.1; g.add(rim);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; g.add(beam([Math.cos(a) * 0.8, 1.0, Math.sin(a) * 0.8], [Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2], 0.08, iron, 8)); }
  // Grate and charcoal lumps.
  P.coalMats = [elemMat(0x222222), elemMat(0x2b2b2b), elemMat(0x1c1c1c)];
  const r = rng(7);
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 1.15, s = 0.18 + r() * 0.14;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), P.coalMats[i % 3]);
    m.position.set(Math.cos(a) * d, 1.75 + r() * 0.3, Math.sin(a) * d); m.rotation.set(r() * 3, r() * 3, r() * 3); m.castShadow = true; g.add(m);
  }
  P.set = (Tc, k) => { P.coalMats.forEach((m, i) => setGlow(m, Tc - i * 60, k, 0x222222)); };
  P.top = [0, 2.1, 0];
  P.size = { w: 3.1, h: 2.2, face: 1.5 };
  return { group: g, ...P };
}

export function makeHeater(id) {
  if (id === 'rod' || id === 'quartz' || id === 'halogen') return makeRadiant(id);
  return { fan: makeFan, ofr: makeOFR, carbon: makeCarbon, ptc: makePTC, convector: makeConvector, angithi: makeAngithi }[id]();
}

// ---------------------------------------------------------------- the room and the people in it
// An open cut-away room (back and left walls, floor) with a window. w, d, h in scene units.
export function makeRoom(w = 36, d = 36, h = 28, { window = true, wallColor = 0x323846 } = {}) {
  const g = new THREE.Group();
  const wall = M.matte(wallColor, { side: THREE.DoubleSide });
  const floor = box(w, 0.3, d, M.matte(0x4a3f36)); floor.position.set(0, -0.15, 0); g.add(floor);
  const back = box(w, h, 0.4, wall); back.position.set(0, h / 2, -d / 2); g.add(back);
  const left = box(0.4, h, d, wall); left.position.set(-w / 2, h / 2, 0); g.add(left);
  g.floor = floor; g.back = back; g.left = left;
  if (window) {
    const win = new THREE.Group(); win.position.set(-w / 2 + 0.25, h * 0.55, -d * 0.1);
    const pane = box(0.1, 9, 8, M.clear(0x8fc4ff, 0.35)); win.add(pane);
    const frame = M.plastic(0xd9dde3);
    [[0, 4.6, 0, 8.6, 0.3], [0, -4.6, 0, 8.6, 0.3]].forEach(([x, y, z, L, t]) => { const b = box(0.3, t, L, frame); b.position.set(x, y, z); win.add(b); });
    [[-4.3], [4.3], [0]].forEach(([z]) => { const b = box(0.3, 9.5, 0.3, frame); b.position.set(0, 0, z); win.add(b); });
    g.add(win); g.win = win;
  }
  return g;
}
// A simple seated or lying person, about 1.7 m (17 units) when standing. pose: 'sit' | 'lie'.
export function makePerson(pose = 'sit', color = 0x5b7fd6) {
  const g = new THREE.Group(), cloth = M.matte(color), skin = M.matte(0xc68e62);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), skin); head.castShadow = true;
  if (pose === 'sit') {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 3.6, 6, 16), cloth); torso.position.y = 7.6; torso.castShadow = true;
    head.position.y = 10.9;
    const thigh = beam([0, 5.2, 0.3], [0, 5.2, 4.2], 0.75, cloth, 12), thigh2 = thigh.clone(); thigh.position.x = -0.8; thigh2.position.x = 0.8;
    const shin = beam([0, 5.2, 4.2], [0, 0.4, 4.4], 0.6, cloth, 12), shin2 = shin.clone(); shin.position.x = -0.8; shin2.position.x = 0.8;
    const arm = beam([-1.7, 9.2, 0], [-1.6, 6.0, 2.4], 0.45, cloth, 10), arm2 = beam([1.7, 9.2, 0], [1.6, 6.0, 2.4], 0.45, cloth, 10);
    const stool = box(3.6, 0.4, 3.6, M.plastic(0x6b4a2b)); stool.position.y = 4.6;
    [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].forEach(([x, z]) => { const l = box(0.3, 4.4, 0.3, M.plastic(0x6b4a2b)); l.position.set(x, 2.2, z); g.add(l); });
    g.add(torso, head, thigh, thigh2, shin, shin2, arm, arm2, stool);
    g.torso = torso;
  } else {
    // Lying on its back along +x, head at x = 0. Under a quilt.
    head.position.set(0, 0.9, 0);
    const quilt = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 11, 6, 16), M.matte(color)); quilt.rotation.z = Math.PI / 2; quilt.position.set(7.4, 0.7, 0); quilt.scale.set(1, 1, 1.6); quilt.castShadow = true;
    g.add(head, quilt); g.torso = quilt;
  }
  g.skin = skin; g.cloth = cloth;
  return g;
}

// ---------------------------------------------------------------- framing for tall screens
// The stage backs the camera off by k on narrow screens (stage.js). These helpers undo that so a
// portrait layout (phones, and the 1080×1920 video) can fill the frame.
export const inReel = () => document.body.classList.contains('gb-reel');
export const isPortrait = (stage) => stage.camera.aspect < 0.9;
// A tall stage that is a phone, not the portrait video: the readout covers the top, so charts are
// hidden (the readout carries the numbers) and the model is framed low.
export const isPhone = (stage) => isPortrait(stage) && !inReel();
export const aspectK = (stage) => Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, stage.camera.aspect)));
export function fitView(stage, target, dir, D) {
  const k = aspectK(stage), d = new THREE.Vector3(...dir).normalize().multiplyScalar(D / k);
  return { pos: [target[0] + d.x, target[1] + d.y, target[2] + d.z], target };
}
// Call every frame: when the screen flips between wide, tall and phone-narrow, re-lay the scene out
// and re-frame it (unless the viewer has orbited). On a narrow phone stage the readout covers the
// top left, so the picture is nudged down.
export function responsive(stage, views, relayout) {
  let last = null;
  const f = (force = false) => {
    const p = isPortrait(stage), narrow = !p && stage.host.clientWidth < 560, mode = p ? 'tall' : narrow ? 'narrow' : 'wide';
    if (mode === last && !force) return;
    last = mode;
    relayout?.(p);
    stage.setShift(0, narrow ? -0.16 : 0);
    const v = views(p);
    const pos = narrow ? v.pos.map((x, i) => v.target[i] + (x - v.target[i]) * 1.12) : v.pos;
    if (!stage.moved || force) stage.setView(pos, v.target, 0.6);
  };
  f.portrait = () => last === 'tall';
  return f;
}
export { clamp, lerp };
