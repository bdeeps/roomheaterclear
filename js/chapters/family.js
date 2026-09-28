// Chapter 1: the family of heaters, side by side on one floor. Pick one to walk up to it and X-ray
// it. Every heater turns electricity into heat with 100% efficiency (the angithi burns charcoal);
// they differ in HOW the heat leaves: as infrared from something glowing, or as warm air.
// Figures per heater: js/heater.js (HEATERS). Nichrome resistance from P = V²/R at 230 V.
import { THREE, M } from '../kit.js';
import { HEATERS, FAMILY, makeHeater, dots, rng, wienPeak, glowName, radFlux, airFlow, fmtW, V_MAINS, fitView, responsive, inReel, isPhone } from '../heater.js';

// Two rows on a wide screen (tall heaters at the back), three rows of three on a tall one.
const GAP = 7.2;
const ROWS = { wide: [['rod', 'ofr', 'carbon', 'convector'], ['quartz', 'halogen', 'fan', 'ptc', 'angithi']], tall: [['ofr', 'carbon', 'convector'], ['rod', 'quartz', 'halogen'], ['fan', 'ptc', 'angithi']] };
const POS = {};
function layout(tall) {
  const rows = ROWS[tall ? 'tall' : 'wide'], dz = 8.5;
  rows.forEach((row, r) => row.forEach((id, i) => { POS[id] = [(i - (row.length - 1) / 2) * GAP + (tall ? 0 : r ? 0 : 0.4), (r - rows.length + 1) * dz]; }));
}
layout(false);
const VIEW_ALL = { pos: [2.5, 14.5, 29], target: [0.5, 2.6, -3.8] };
const viewOf = (id) => ({ pos: [POS[id][0] + 5.5, 6.5, POS[id][1] + 13.5], target: [POS[id][0] + 0.6, 2.8, POS[id][1]] });
const warmup = (tau) => (tau < 5 ? 'seconds' : tau < 120 ? `about ${Math.round((tau * 2.3) / 60) || 1} min` : `about ${Math.round((tau * 2.3) / 60)} min`);

export default {
  id: 'family',
  short: 'The heater family',
  title: 'A family of heaters',
  subtitle: 'Nine ways to warm a winter room: glowing tubes, hot oil, blowing air and a pot of charcoal.',
  view: VIEW_ALL,
  learn: `<p>Every electric heater does the same simple thing: it pushes current through a wire with <b>resistance</b>, and the wire gets hot. A 2,000 W heater on 230 V mains has about <b>26 Ω</b> of wire, from <b>P = V² ÷ R</b> (see OhmsLawClear). All of the electricity becomes heat, so every electric heater is <b>100% efficient</b>, exactly like the element in a geyser (WaterHeaterClear). What differs is <b>how the heat reaches you</b>.</p>
    <p><b>Radiant heaters</b> (the rod, quartz, halogen and carbon types) make something glow. Their <b>infrared</b> shines straight onto you, like sunshine, and a shiny <b>reflector</b> aims it forward. They feel warm in seconds, but only where they point.</p>
    <p><b>Convection heaters</b> warm the air. A <b>fan heater</b> blows air past a hot coil, just like a big HairDryerClear; a <b>PTC ceramic heater</b> uses clever stones that can't overheat; a <b>convector</b> lets warm air rise out of its top. The <b>oil-filled radiator</b> (OFR) heats oil sealed inside steel fins: slow to start, gentle, and still warm for a while after you switch it off.</p>
    <p>The <b>angithi</b>, a pot of burning charcoal, is the old way. It gives real heat, but it also fills a closed room with invisible <b>carbon monoxide</b>. More on that in chapter 5.</p>
    <p class="tip"><b>Try it:</b> pick a heater to walk up to it, then switch on X-ray to see its insides. Compare how brightly each one glows.</p>`,
  terms: [
    { t: 'Heating element', d: 'The part that gets hot: a resistance wire (usually nichrome), a tungsten or carbon filament, or a PTC ceramic stone.' },
    { t: 'Nichrome', d: 'A nickel–chromium alloy. It has high resistance and grows a tough oxide skin, so it can glow red for years without burning away.' },
    { t: 'Radiant heater', d: 'A heater that sends most of its heat as infrared light, which warms whatever it shines on.' },
    { t: 'Convection heater', d: 'A heater that warms the air, which then carries the heat round the room.' },
    { t: 'Oil-filled radiator (OFR)', d: 'Sealed steel fins full of oil with an element at the bottom. The oil stores heat and spreads it over a big, not-too-hot surface.' },
    { t: 'Angithi', d: 'A metal or clay brazier of burning charcoal or coal, used across North India in winter. It has no chimney.' },
  ],
  defaults: { pick: 'all', xray: false, on: true },
  controls: [
    { key: 'pick', type: 'seg', label: 'Walk up to', options: [{ v: 'all', label: 'All' }, ...FAMILY.map((id) => ({ v: id, label: { rod: 'Rod', quartz: 'Quartz', halogen: 'Halogen', carbon: 'Carbon', fan: 'Fan', ptc: 'PTC', ofr: 'OFR', convector: 'Convector', angithi: 'Angithi' }[id] }))], fmt: (v) => (v === 'all' ? '' : HEATERS[v].name) },
    { key: 'xray', type: 'toggle', label: 'X-ray the casings' },
    { key: 'on', type: 'toggle', label: 'Switched on' },
  ],
  quiz: [
    { q: 'A 2,000 W fan heater and a 2,000 W oil-filled radiator run for an hour. Which turns more electricity into heat?', options: ['The fan heater', 'The oil-filled radiator', 'Both make exactly the same heat', 'Neither, most is wasted'], answer: 2, why: 'Every electric heater turns all its electricity into heat. 2 kW for an hour is 2 kWh of heat either way. They only differ in where the heat goes first.' },
    { q: 'Why does a halogen heater feel warm the moment you switch it on?', options: ['It warms the whole room instantly', 'Its infrared shines straight onto your skin, like sunlight', 'It blows hot air', 'It stores heat from yesterday'], answer: 1, why: 'Its thin filament reaches over 2,000 °C in about a second and radiates infrared, which crosses the room at the speed of light and warms you directly.' },
    { q: 'What does the shiny curved metal behind a radiant heater’s tubes do?', options: ['Cools the tubes', 'Reflects the infrared forward, towards you', 'Makes the heater lighter', 'Stores electricity'], answer: 1, why: 'Polished metal reflects infrared well. The curved reflector aims the glow forward instead of into the wall behind.' },
  ],
  reel: [
    { ms: 5600, caption: 'Every electric heater turns all its electricity into heat; they differ in how it reaches you.', set: { pick: 'all', xray: false, on: true }, view: VIEW_ALL, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const H = {}, labels = {}, sub = [];
    FAMILY.forEach((id) => {
      const h = makeHeater(id); root.add(h.group); H[id] = h;
      labels[id] = stage.label(`<b>${HEATERS[id].name}</b>`, [0, h.size.h + 0.9, 0], h.group);
    });
    // Parts labels, shown when you walk up to one heater with X-ray on.
    const P = (id, t, pos, cls = '') => { const l = stage.label(t, pos, H[id].group, cls); sub.push([id, l]); };
    P('rod', 'Nichrome coil on a ceramic rod', [0, 3.9, 1.2], 'hot'); P('rod', 'Polished reflector', [-1.2, 2.2, -0.6]); P('rod', 'Wire guard', [1.9, 4.6, 0.9]); P('rod', 'Tip-over switch', [0.4, -0.3, 0.8]);
    P('quartz', 'Coil inside a quartz tube', [0, 3.6, 1.2], 'hot'); P('quartz', 'Reflector', [-1.3, 2.1, -0.6]);
    P('halogen', 'Tungsten filament, halogen gas', [0, 4.3, 1.2], 'hot'); P('halogen', 'Gold-coated back', [-1.4, 2.8, 0.3]);
    P('carbon', 'Carbon-fibre ribbon', [0, 5.8, 1.2], 'hot'); P('carbon', 'Curved reflector', [-1.1, 3.0, 0]); P('carbon', 'Turns side to side', [0, 0.7, 1.4]);
    P('fan', 'Fan', [0, 2.0, -0.5]); P('fan', 'Nichrome coil', [0, 1.0, 0.8], 'hot'); P('fan', 'Thermal cut-out', [-1.1, 2.8, 0.3]); P('fan', 'Thermostat', [1.1, 2.8, 0.3]);
    P('ptc', 'PTC stones between aluminium fins', [0, 2.0, 0.9], 'hot'); P('ptc', 'Fan', [0, 1.0, -0.6]);
    P('ofr', 'Oil fills the fins', [-1.5, 5.4, 1.2]); P('ofr', 'Element in the oil', [0, 1.0, 1.3], 'hot'); P('ofr', 'Thermostat + switches', [3.7, 2.4, 0.3]);
    P('convector', 'Finned element', [0, 1.9, 0.7], 'hot'); P('convector', 'Warm air out', [0, 5.0, 0]); P('convector', 'Cool air in', [0, 0.6, 0.8]);
    P('angithi', 'Glowing charcoal', [0, 2.8, 0], 'hot'); P('angithi', 'No chimney', [1.8, 1.2, 0.8]);

    // Warm air leaving the convection heaters; smoke above the angithi.
    const r = rng(3), NA = 160;
    const air = dots(NA, 0.07, 0xff9a5a, 0.8); root.add(air);
    const seeds = Array.from({ length: NA }, () => [r(), r(), r(), r()]);
    const src = ['fan', 'ptc', 'convector', 'ofr', 'angithi'];
    const smokeC = new THREE.Color(0x8a8f98), warmC = new THREE.Color(0xff9a5a);
    for (let i = 0; i < NA; i++) air.tint(i, src[i % src.length] === 'angithi' ? smokeC : warmC);

    let t = 0, lastPick = null, on = 1;
    const allView = (p) => (p ? fitView(stage, [0, isPhone(stage) ? 7.5 : 2.5, -8.5], [0.05, 0.75, 1], isPhone(stage) ? 62 : 58) : VIEW_ALL);
    const resp = responsive(stage, allView, (p) => {
      layout(p);
      FAMILY.forEach((id) => H[id].group.position.set(POS[id][0], 0, POS[id][1]));
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        if (s.pick !== lastPick) {
          lastPick = s.pick;
          if (!inReel() || s.pick !== 'all') {
            const v = s.pick === 'all' ? allView(resp.portrait()) : viewOf(s.pick);
            stage.setView(v.pos, v.target, 1.0);
          }
        }
        on += ((s.on ? 1 : 0) - on) * Math.min(1, dt * 2.5);
        FAMILY.forEach((id) => {
          const h = H[id], spec = HEATERS[id];
          h.setXray(s.xray && (s.pick === 'all' || s.pick === id));
          // Slow heaters take longer to glow up; the OFR's element runs under oil at ~150 °C.
          const Te = id === 'ofr' ? 150 : id === 'angithi' ? 850 : spec.T;
          h.set(Te, on);
          if (h.setSurface) h.setSurface(20 + (spec.T - 20) * on);
          if (h.fan) h.fan.rotation.z += dt * 22 * on;
          if (id === 'carbon') h.head.rotation.y = Math.sin(t * 0.5) * 0.6;
          labels[id].visible = (s.pick === 'all' && !isPhone(stage)) || s.pick === id;
        });
        sub.forEach(([id, l]) => { l.visible = s.xray && s.pick === id && stage.host.clientWidth >= 560; });
        // Air: rises from each convection source, drifts forward from the fan types.
        for (let i = 0; i < NA; i++) {
          const id = src[i % src.length], h = H[id], sd = seeds[i], u = (sd[0] + t * (id === 'fan' || id === 'ptc' ? 0.45 : 0.22)) % 1;
          const x0 = h.group.position.x, z0 = h.group.position.z;
          let x, y, z;
          if (id === 'fan' || id === 'ptc') { x = x0 + (sd[1] - 0.5) * (0.8 + u * 2); y = 1.45 + (sd[2] - 0.5) * 0.9 + u * 1.2; z = z0 + 0.9 + u * 5; }
          else if (id === 'convector') { x = x0 + (sd[1] - 0.5) * 5; y = 4.7 + u * 4; z = z0 + (sd[2] - 0.5) * 0.8 + u * 0.8; }
          else if (id === 'ofr') { x = x0 + (sd[1] - 0.5) * 5.5; y = 6.6 + u * 3.5; z = z0 + (sd[2] - 0.5) * 1.8; }
          else { x = x0 + (sd[1] - 0.5) * (1.2 + u * 2); y = 2.3 + u * 6; z = z0 + (sd[2] - 0.5) * (1 + u); }
          air.place(i, x, y, z, on > 0.3 ? (1 - u) * (id === 'angithi' ? 2.2 : 1) : 0);
        }
        air.done();
      },
      readout: (s) => {
        if (s.pick === 'all') return `<div class="big">Nine heaters</div>
          <div class="row"><span>Radiant (glow)</span><b>rod, quartz, halogen, carbon</b></div>
          <div class="row"><span>Convection (warm air)</span><b>fan, PTC, OFR, convector</b></div>
          <div class="row"><span>Burning fuel</span><b>angithi</b></div>
          <small>Each electric one turns all its electricity into heat.</small>`;
        const h = HEATERS[s.pick], R = (V_MAINS ** 2) / h.W, Tsurf = s.pick === 'ofr' ? h.T : h.T;
        const rows = [`<div class="row"><span>Power</span><b>${fmtW(h.W)}${h.fuel ? ' of heat' : ''}</b></div>`];
        if (!h.fuel) rows.push(`<div class="row"><span>Resistance, R = V²/P</span><b>${R.toFixed(0)} Ω · ${(h.W / V_MAINS).toFixed(1)} A</b></div>`);
        rows.push(`<div class="row"><span>Hottest part</span><b>about ${Tsurf.toLocaleString('en-IN')} °C · ${glowName(Tsurf)}</b></div>`);
        rows.push(`<div class="row"><span>Leaves as infrared</span><b>${Math.round(h.rad * 100)}%</b></div>`);
        if (h.T > 400) rows.push(`<div class="row"><span>Brightest wavelength</span><b>${wienPeak(Tsurf).toFixed(1)} µm (infrared)</b></div>`);
        if (s.pick === 'fan') rows.push(`<div class="row"><span>Air blown, warmed by 40 °C</span><b>${airFlow(h.W, 40).toFixed(0)} L/s</b></div>`);
        if (s.pick === 'ofr') rows.push(`<div class="row"><span>Fin surface radiates</span><b>${Math.round(radFlux(75, 20))} W/m²</b></div>`);
        rows.push(`<div class="row"><span>Up to full heat</span><b>${warmup(h.tau)}</b></div>`);
        return `<div class="big">${h.name}</div>${rows.join('')}<small>${h.sub}.</small>`;
      },
    };
  },
};
