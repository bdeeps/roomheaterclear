// Chapter 2: three ways heat moves, and which heater warms YOU and which warms the ROOM.
// Scene: a cut-away room (1 unit = 10 cm) with one heater and a person sitting in front of it.
//  - Radiation: a forward share of the heater's radiant power, E = rad·P·gain ÷ 4π(d² + a²)
//    (heater.js irradiance). What you feel on the facing side: +0.7·E ÷ 8 W/m²K (heater.js feelBoost).
//  - Convection: the rest of the heat goes into the air as a rising plume (or a fan's jet, whose
//    excess temperature falls as ~5·D/x, heater.js jetExcess). That air warms the whole room slowly.
//  - Conduction: heat through the wall to the cold outside, q = U·A·ΔT (230 mm brick, U ≈ 2 W/m²K).
// A test coil on the left shows glow colour vs temperature: Stefan–Boltzmann σT⁴ (per cm²) and
// Wien's peak λ = 2,898 µm·K ÷ T.
import { THREE, M, beam, box } from '../kit.js';
import {
  HEATERS, makeHeater, makeRoom, makePerson, dots, rng, irradiance, feelBoost, jetExcess, radFlux, wienPeak, glowName, setGlow, elemMat,
  coilX, K0, fmtW, fitView, responsive, isPhone, clamp,
} from '../heater.js';

const KINDS = ['halogen', 'rod', 'carbon', 'fan', 'ofr', 'convector'];
const VIEW = { pos: [1, 12.5, 33], target: [-1.5, 5.5, 0] };
const HX = -12, HZ = -2;         // heater position on the floor
const AX = Math.PI / 2;          // the heater faces +x, towards the person

export function split(id, d) {
  const h = HEATERS[id], W = h.W, rad = W * h.rad, conv = W - rad;
  const E = irradiance(h, W, d);
  const jet = id === 'fan' ? jetExcess(d) : 0;
  const feel = feelBoost(E) + jet * 0.6;
  const onYou = E * 0.6;                 // a seated person shows about 0.6 m² to the heater
  return { W, rad, conv, E, jet, feel, onYou, share: onYou / W };
}

export default {
  id: 'ways',
  short: 'Three ways heat moves',
  title: 'Glow, flow and touch',
  subtitle: 'Radiation warms you. Convection warms the air. Conduction lets it leak out through the walls.',
  view: VIEW,
  learn: `<p>Heat moves in three ways (all three are in HeatClear). A heater uses the first two.</p>
    <p><b>Radiation</b> is heat carried by light, mostly <b>infrared</b> that you can't see but can feel. Everything warm glows; hot things glow far more, because the power follows the <b>Stefan–Boltzmann law</b>: <b>P = εσAT⁴</b>, with T in kelvin. Double the temperature and the glow is <b>16 times</b> stronger. Infrared is the same kind of electromagnetic wave as the radio signals in RadioClear, FMClear and TVStationClear, only with wavelengths a million times shorter. Above about 525 °C some of the glow becomes visible: dull red, then orange, then yellow-white. A halogen filament at 2,200 °C is bright; an oil radiator at 75 °C glows only in infrared.</p>
    <p>Infrared crosses the air without warming it and lands on <b>you</b>, the floor and the walls. So a radiant heater warms whatever it points at, fast. Step out of its beam and you feel cold again.</p>
    <p><b>Convection</b> is heat carried by moving air. Air touching something hot warms, gets lighter and rises; cooler air flows in below. A fan simply pushes harder. Convection heaters warm the <b>room air</b>, so the whole room slowly gets comfortable, not just one side of you.</p>
    <p><b>Conduction</b> is heat passed on by touch. In a room it works against you: heat seeps out through walls, windows and the roof to the cold outside.</p>
    <p class="tip"><b>Try it:</b> switch between the halogen and the oil radiator, and watch how much heat lands on the person. Then slide the test coil from 300 to 2,500 °C.</p>`,
  terms: [
    { t: 'Infrared', d: 'Light with wavelengths longer than red, about 0.7 to 1,000 µm. We feel it as warmth.' },
    { t: 'Stefan–Boltzmann law', d: 'A surface radiates εσT⁴ watts per square metre, with T in kelvin and σ = 5.67 × 10⁻⁸ W/m²K⁴.' },
    { t: 'Wien’s law', d: 'The brightest wavelength of a glowing body is 2,898 µm·K ÷ T. Hotter means shorter, bluer light.' },
    { t: 'Convection', d: 'Heat carried by a moving fluid. Warm air rises, cool air sinks, and a loop forms.' },
    { t: 'Conduction', d: 'Heat passed through a solid from hot to cold, like through a wall to the outside.' },
    { t: 'Irradiance', d: 'How much radiant power falls on each square metre, in W/m². Midday sun is about 1,000.' },
  ],
  defaults: { kind: 'halogen', dist: 1.5, coil: 850, show: 'all' },
  controls: [
    { key: 'kind', type: 'seg', label: 'Heater', options: KINDS.map((id) => ({ v: id, label: { halogen: 'Halogen', rod: 'Rod', carbon: 'Carbon', fan: 'Fan', ofr: 'Oil radiator', convector: 'Convector' }[id] })), fmt: (v) => `${fmtW(HEATERS[v].W)}, ${Math.round(HEATERS[v].rad * 100)}% infrared` },
    { key: 'dist', type: 'range', label: 'You sit this far away', min: 0.8, max: 3.5, step: 0.1, ends: ['0.8 m', '3.5 m'], fmt: (v) => v.toFixed(1) + ' m' },
    { key: 'show', type: 'seg', label: 'Show', options: [{ v: 'all', label: 'All three' }, { v: 'rad', label: 'Radiation' }, { v: 'conv', label: 'Convection' }, { v: 'cond', label: 'Conduction' }] },
    { key: 'coil', type: 'range', label: 'Test coil temperature', min: 100, max: 2500, step: 10, ends: ['100 °C', '2,500 °C'], fmt: (v) => `${Math.round(v).toLocaleString('en-IN')} °C · ${glowName(v)}` },
  ],
  quiz: [
    { q: 'You sit in front of a halogen heater. Why does your face warm up long before the room air does?', options: ['Halogen heaters blow hot air', 'Its infrared crosses the air and is absorbed by your skin', 'The air near your face is thinner', 'Your face is closer to the ceiling'], answer: 1, why: 'Air lets infrared pass almost untouched. Your skin absorbs it, so you warm first; the air only warms later, from the surfaces the light has heated.' },
    { q: 'A coil goes from 500 K to 1,000 K. How much more does it radiate?', options: ['Twice as much', 'Four times', 'Eight times', 'Sixteen times'], answer: 3, why: 'Radiated power goes as T⁴. Doubling the kelvin temperature multiplies it by 2⁴ = 16.' },
    { q: 'Which heater is best for warming a whole bedroom evenly for the evening?', options: ['A halogen pointed at the bed', 'A convection heater like an oil radiator or convector', 'Any heater, placed in a corner facing the wall', 'A heater inside a cupboard'], answer: 1, why: 'Convection heaters warm the air, which carries heat all round the room. Radiant heaters are best for warming one person quickly.' },
  ],
  reel: [
    { ms: 5400, caption: 'A halogen heater’s infrared crosses the air and warms you, not the room.', set: { kind: 'halogen', dist: 1.5, show: 'rad', coil: 850 }, anim: { dist: [2.8, 1.2] }, spin: 0.2 },
    { ms: 5400, caption: 'Hotter glows brighter: radiated power rises as temperature to the fourth power.', set: { kind: 'ofr', show: 'conv' }, anim: { coil: [300, 2400] }, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const room = makeRoom(40, 30, 26); room.position.set(0, 0, 0); root.add(room);
    const heaters = {};
    KINDS.forEach((id) => { const h = makeHeater(id); h.group.position.set(HX, 0, HZ); h.group.rotation.y = AX; root.add(h.group); heaters[id] = h; });
    const person = makePerson('sit'); person.rotation.y = -AX; root.add(person);
    const lFeel = stage.label('', [0, 13.2, 0], person, 'hot');

    // Test coil on a little stand at the back left.
    const coilG = new THREE.Group(); coilG.position.set(12, 0, -11); root.add(coilG);
    const post = box(0.4, 7, 0.4, M.plastic(0x2a2e37)); post.position.y = 3.5; coilG.add(post);
    const coilMat = elemMat();
    const coil = coilX(-2.2, 2.2, 0.35, 0.09, 12, coilMat); coil.position.y = 7.4; coilG.add(coil);
    coilG.add(beam([-2.4, 7.4, 0], [2.4, 7.4, 0], 0.12, M.matte(0xefe9dc), 12));
    const lCoil = stage.label('', [0, 9.4, 0], coilG);

    // Infrared: little arrows of light flying from the heater, faster than anything else here.
    const r = rng(11), NP = 90, NA = 140, NC = 26;
    const photons = dots(NP, 0.16, 0xff5aa0); root.add(photons);
    const pSeed = Array.from({ length: NP }, () => [r(), r() - 0.5, r() - 0.5]);
    const air = dots(NA, 0.18, 0xffb547, 0.85); root.add(air);
    const aSeed = Array.from({ length: NA }, () => [r(), r(), r(), r()]);
    const cond = dots(NC, 0.16, 0x6fb6ff); root.add(cond);
    const cSeed = Array.from({ length: NC }, () => [r(), r(), r()]);
    const cold = new THREE.Color(0x6fb6ff), warm = new THREE.Color(0xffb547), tmp = new THREE.Color();

    let t = 0;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [-1, isPhone(stage) ? 13 : 9, 0], [0.25, 0.4, 1], 58) : VIEW));
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        KINDS.forEach((id) => { heaters[id].group.visible = id === s.kind; });
        const H = heaters[s.kind], spec = HEATERS[s.kind];
        H.set(s.kind === 'ofr' ? 150 : spec.T, 1);
        if (H.setSurface) H.setSurface(spec.T);
        if (H.fan) H.fan.rotation.z += dt * 22;
        // Person on the heater's axis at the chosen distance.
        const ax = Math.sin(AX), az = Math.cos(AX), d = s.dist * 10;
        const face = H.size.face;
        person.position.set(HX + ax * (d + face), 0, HZ + az * (d + face));
        const sp = split(s.kind, s.dist);
        lFeel.element.innerHTML = `You feel <b>+${sp.feel.toFixed(1)} °C</b> on the side facing it`;
        setGlow(coilMat, s.coil, 1);
        lCoil.element.innerHTML = `Test coil: <b>${Math.round(s.coil).toLocaleString('en-IN')} °C</b> · ${glowName(s.coil)}`;

        const showR = s.show === 'all' || s.show === 'rad', showC = s.show === 'all' || s.show === 'conv', showK = s.show === 'all' || s.show === 'cond';
        // Photons: count and spread scale with the radiant power and the reflector's aim.
        const nOn = Math.round(NP * clamp(sp.rad / 1100, 0.08, 1));
        const hy = s.kind === 'ofr' ? 3.8 : s.kind === 'carbon' ? 3.9 : s.kind === 'fan' ? 1.5 : 2.8;
        const spread = spec.gain > 1.5 ? 0.35 : 1.2;
        for (let i = 0; i < NP; i++) {
          const q = pSeed[i], u = (q[0] + t * 0.9) % 1, L = u * (d + face + 4);
          const dx = Math.sin(AX + q[1] * spread * 2), dz = Math.cos(AX + q[1] * spread * 2);
          photons.place(i, HX + dx * (face + L), hy + q[2] * 4 + L * q[2] * 0.3, HZ + dz * (face + L), showR && i < nOn ? 1 : 0);
        }
        photons.done();
        // Warm air: a plume above convection heaters (a jet for the fan), rising and spreading along the ceiling.
        const convK = clamp(sp.conv / 1800, 0.06, 1), nA = Math.round(NA * convK);
        for (let i = 0; i < NA; i++) {
          const q = aSeed[i], u = (q[0] + t * 0.12) % 1;
          let x, y, z;
          if (s.kind === 'fan') {
            const L = u * 26; x = HX + ax * (face + L) + (q[1] - 0.5) * (1 + L * 0.35); y = 1.5 + (q[2] - 0.5) * (0.8 + L * 0.3) + L * L * 0.012; z = HZ + az * (face + L) + (q[3] - 0.5) * (1 + L * 0.3);
          } else {
            const top = 24.5, yRise = 2 + u * 30;
            if (yRise < top) { x = HX + (q[1] - 0.5) * (2 + yRise * 0.15); y = Math.max(2, yRise); z = HZ + (q[2] - 0.5) * 2; }
            else { const L = (yRise - top) * 1.4; x = HX + (q[1] - 0.5) * 4 + L * (q[3] - 0.3); y = top - L * 0.1; z = HZ + L * (q[2] - 0.2); }
          }
          air.place(i, x, y, z, showC && i < nA ? 1 - u * 0.6 : 0);
          air.tint(i, tmp.copy(warm).lerp(cold, u * 0.6));
        }
        air.done();
        // Conduction: dots creeping through the left wall to the outside.
        for (let i = 0; i < NC; i++) {
          const q = cSeed[i], u = (q[0] + t * 0.1) % 1;
          cond.place(i, -20 + 0.6 - u * 1.8, 3 + q[1] * 20, -14 + q[2] * 26, showK ? 1 : 0);
        }
        cond.done();
      },
      readout: (s) => {
        const sp = split(s.kind, s.dist), h = HEATERS[s.kind], K = s.coil + K0;
        return `<div class="big">${h.name}, ${fmtW(sp.W)}</div>
          <div class="row"><span>Leaves as infrared</span><b>${fmtW(sp.rad)}</b></div>
          <div class="row"><span>Goes into the air</span><b>${fmtW(sp.conv)}</b></div>
          <div class="row"><span>Infrared on you at ${s.dist.toFixed(1)} m</span><b>${Math.round(sp.E)} W/m²</b></div>
          ${sp.jet ? `<div class="row"><span>Warm jet reaching you</span><b>+${sp.jet.toFixed(0)} °C air</b></div>` : ''}
          <div class="row"><span>Test coil radiates</span><b>${(radFlux(s.coil, 20, 0.9) / 1e4).toFixed(s.coil < 400 ? 2 : 1)} W per cm²</b></div>
          <div class="row"><span>Its brightest wavelength</span><b>${wienPeak(s.coil).toFixed(2)} µm</b></div>
          <small>Midday sun is about 1,000 W/m². ${(K / (100 + K0)) ** 4 > 1 ? `The coil radiates ${Math.round(((K ** 4) - (293 ** 4)) / ((373 ** 4) - (293 ** 4)))}× what it would at 100 °C.` : ''}</small>`;
      },
    };
  },
};
