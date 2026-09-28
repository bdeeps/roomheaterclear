// Chapter 5: air and health. Two models.
// Dry air: warming air adds no water, so its vapour pressure stays the same while the saturation
//   pressure climbs (Magnus formula, heater.js psat). RH inside = RH outside × psat(T_out) ÷ psat(T_in)
//   (all heaters do this; burning fuel adds a little water). Comfort band 40–60% RH; below about 30%
//   people report dry eyes and skin (Wolkoff, Int. J. Hyg. Environ. Health 221 (2018) 376).
// Carbon monoxide: a well-mixed sealed room (12 m², 3 m high) with a fire: dC/dt = G/V − n·C, where G
//   is CO made per hour (fuel burn rate × emission factor, heater.js FUELS) and n the air changes an
//   hour (heater.js VENT). Blood COHb from the Coburn–Forster–Kane equation (heater.js cfkStep) for a
//   sleeping adult. O₂ falls as the fire uses it. Effects by COHb: Ernst & Zibrak, NEJM 1998.
// Deaths: Delhi Fire Service counted 15 angithi deaths in Delhi in January 2024 (IANS, via Siasat,
//   30 Jan 2024). AIIMS New Delhi autopsies 2010–15: 40 CO deaths, ~80% in winter, almost all in
//   closed rooms ("Fatal carbon monoxide poisoning: a lesson from a retrospective study at AIIMS,
//   New Delhi", J. Family Med. Prim. Care 6(4), 2017, 791–794). NCRB "Accidental Deaths & Suicides in
//   India 2022", Table 1.6, lists only 10 CO deaths for all India (13 in 2021), so most are probably
//   filed under other causes such as suffocation.
import { THREE, M, box } from '../kit.js';
import {
  FUELS, VENT, coNight, effectAt, COHB_EFFECTS, psat, rhAfter, gPerKg, makeAngithi, makeOFR, makeRoom, makePerson, board, panelBg, title, axes, line, dot, legend, dots, rng,
  fitView, responsive, inReel, isPhone, clamp,
} from '../heater.js';

const VIEW = { pos: [16, 29, 55], target: [12.5, 10, 0] };
const FUEL_KEYS = ['angithi', 'coal', 'wood', 'gas', 'electric'];

export default {
  id: 'air',
  short: 'Air and health',
  title: 'Dry air and the silent gas',
  subtitle: 'Why heated rooms feel dry, and why a fire in a closed room can kill while you sleep.',
  view: VIEW,
  learn: `<p><b>Dry air.</b> Warm air can hold much more water vapour than cold air: about twice as much for every 11 °C. Heating a room adds warmth but no water, so the <b>relative humidity</b> (RH) falls. Foggy Delhi night air at 7 °C and 85% RH, warmed to 22 °C, drops to about <b>32%</b>. Below about 30 to 40%, many people get <b>dry eyes, dry skin and a scratchy throat</b>. Radiant heaters feel worst because they also dry the skin they shine on. A bowl of water helps a little; opening a window now and then helps more.</p>
    <p><b>Carbon monoxide</b> (CO) is the real danger. Charcoal, coal and wood in an <b>angithi</b> or <b>sigri</b> never burn completely (why, see CombustionClear); a glowing charcoal bed makes a lot of CO. It has <b>no colour and no smell</b>. It grabs <b>haemoglobin</b> in your blood more than 200 times as tightly as oxygen, forming <b>COHb</b>, so your blood carries less and less oxygen.</p>
    <p>Asleep, you feel nothing. At 10 to 20% COHb comes a headache; at 30% you are too confused and weak to get up; above 50 to 60% it is often fatal. In a closed room this can happen in <b>two or three hours</b>. Every winter, families across North India are found dead this way. <b>Delhi Fire Service counted 15 angithi deaths in Delhi in January 2024 alone</b>. A study of autopsies at AIIMS New Delhi found about 80% of CO deaths happen in winter, nearly all in closed rooms. Official NCRB figures list only about ten CO deaths a year for all of India, so most are probably recorded under other causes. The true toll is not known, but it is far higher.</p>
    <p class="tip"><b>Try it:</b> put the angithi in a sealed room and run the night. Then open the window a little, and then switch to an electric heater. Change to “Dry air” to see humidity fall as the room warms.</p>`,
  terms: [
    { t: 'Relative humidity (RH)', d: 'How much water vapour the air holds compared with the most it could hold at that temperature, in %.' },
    { t: 'Carbon monoxide (CO)', d: 'A colourless, odourless gas made when fuel burns without enough oxygen. It stops blood carrying oxygen.' },
    { t: 'COHb', d: 'Carboxyhaemoglobin: haemoglobin with CO stuck to it. Its share of your blood’s haemoglobin, in %, measures CO poisoning.' },
    { t: 'ppm', d: 'Parts per million. 100 ppm of CO means 100 CO molecules in every million molecules of air.' },
    { t: 'Air change rate', d: 'How many times an hour a room’s air is swapped for fresh air. Closed rooms in winter may manage only 0.2 to 0.5.' },
    { t: 'CO alarm', d: 'A small battery alarm that beeps when CO builds up. Cheap, and it can save a family.' },
  ],
  defaults: { mode: 'co', fuel: 'angithi', vent: 'closed', hour: 0, play: true, rhOut: 85, tOut: 7.5, tIn: 22 },
  controls: [
    { key: 'mode', type: 'seg', label: 'Look at', options: [{ v: 'co', label: 'Carbon monoxide' }, { v: 'dry', label: 'Dry air' }] },
    { key: 'fuel', type: 'seg', label: 'Heat source', options: FUEL_KEYS.map((v) => ({ v, label: { angithi: 'Charcoal angithi', coal: 'Coal sigri', wood: 'Wood fire', gas: 'Gas heater', electric: 'Electric' }[v] })), fmt: (v) => (FUELS[v].kgph ? `${FUELS[v].kgph} kg/h, ~${FUELS[v].gCO} g CO per kg` : 'no flame, no CO') },
    { key: 'vent', type: 'seg', label: 'Room', options: Object.entries(VENT).map(([v, o]) => ({ v, label: o.name })), fmt: (v) => `${VENT[v].ach} air changes an hour` },
    { key: 'hour', type: 'range', label: 'Hours asleep', min: 0, max: 8, step: 0.05, fmt: (v) => `${Math.floor(v)} h ${String(Math.round((v % 1) * 60)).padStart(2, '0')} min` },
    { key: 'play', type: 'toggle', label: 'Run the night' },
    { key: 'rhOut', type: 'range', label: 'Dry air: outside humidity', min: 30, max: 100, step: 1, fmt: (v) => Math.round(v) + '% RH' },
    { key: 'tOut', type: 'range', label: 'Dry air: outside temperature', min: 0, max: 20, step: 0.5, fmt: (v) => v.toFixed(1) + ' °C' },
    { key: 'tIn', type: 'range', label: 'Dry air: room warmed to', min: 10, max: 28, step: 0.5, fmt: (v) => v.toFixed(1) + ' °C' },
  ],
  quiz: [
    { q: 'Why does a heated room feel dry, even though no water was removed?', options: ['Heaters burn water', 'Warm air can hold more water, so the same water is a smaller share of the most it could hold', 'Heat destroys water vapour', 'Heaters suck water out of walls'], answer: 1, why: 'Relative humidity is vapour ÷ the maximum at that temperature. Warming raises the maximum, so RH drops.' },
    { q: 'Why is carbon monoxide from an angithi so dangerous at night?', options: ['It smells so bad you can’t sleep', 'It has no colour or smell, and sleeping people don’t notice the symptoms', 'It is only dangerous in summer', 'It makes the room too hot'], answer: 1, why: 'CO is invisible and odourless. Asleep, you miss the headache and dizziness until you are too weak to move.' },
    { q: 'Which is safest for warming a bedroom overnight?', options: ['An angithi with the door shut', 'A coal sigri under the bed', 'An electric heater with a thermostat, away from fabric, with some fresh air', 'A gas stove left on'], answer: 2, why: 'Electric heaters burn nothing, so they make no CO. Never burn charcoal, coal or wood in a closed room.' },
  ],
  reel: [
    { ms: 5800, caption: 'An angithi in a closed room fills it with carbon monoxide you can’t see or smell.', set: { mode: 'co', fuel: 'angithi', vent: 'closed', play: false }, anim: { hour: [0, 3] }, spin: 0.2 },
    { ms: 5000, caption: 'Heating air adds no water, so the humidity falls and your eyes and skin dry out.', set: { mode: 'dry', rhOut: 85, tOut: 7.5, play: false }, anim: { tIn: [8, 24] }, spin: 0.2 },
  ],

  build({ stage, s }) {
    const root = new THREE.Group(); stage.root.add(root);
    const room = makeRoom(36, 36, 28); root.add(room);
    // Bed with someone asleep.
    const bed = new THREE.Group(); bed.position.set(4, 0, -9); root.add(bed);
    const frame = box(20, 2.2, 10, M.plastic(0x6b4a2b)); frame.position.y = 1.1; bed.add(frame);
    const mattress = box(19.6, 1.6, 9.6, M.matte(0xe8e2d6)); mattress.position.y = 3.0; bed.add(mattress);
    const sleeper = makePerson('lie', 0xb04a6a); sleeper.position.set(-8.4, 4.4, 0); bed.add(sleeper);
    // Heat sources.
    const ang = makeAngithi(); ang.group.position.set(-6, 0, 6); root.add(ang.group);
    const ofr = makeOFR(7); ofr.group.position.set(-9, 0, 4); ofr.group.rotation.y = 0.5; root.add(ofr.group);
    const gas = new THREE.Group(); gas.position.set(-7, 0, 5); root.add(gas);
    const gb = box(4, 6, 2.2, M.plastic(0xd9dde3)); gb.position.y = 3; gas.add(gb);
    const plaque = box(3, 3, 0.1, M.matte(0xff7a3d)); plaque.position.set(0, 3.6, 1.12); gas.add(plaque);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 24), M.plastic(0xc0392b)); cyl.position.set(3.6, 2.5, -0.5); gas.add(cyl);
    // Particles: grey CO, blue water vapour.
    const r = rng(4), NC = 260, NW = 160;
    const co = dots(NC, 0.32, 0x9aa3b2, 0.85); root.add(co);
    const cSeed = Array.from({ length: NC }, () => [r() * 34 - 17, r() * 27, r() * 34 - 17, r()]);
    const vap = dots(NW, 0.28, 0x6fb6ff, 0.9); root.add(vap);
    const wSeed = Array.from({ length: NW }, () => [r() * 34 - 17, r() * 27, r() * 34 - 17, r()]);
    const lSleeper = stage.label('', [0, 5, 0], sleeper, 'hot');
    const lWin = stage.label('', [0, 6, 0], room.win);

    let N = coNight(s), nkey = '';
    const bCO = board(root, 26, 16.9, 1000, 650, (g, w, h) => {
      panelBg(g, w, h);
      if (s.mode === 'co') {
        title(g, 'A night in the room', `${FUELS[s.fuel].name}, ${VENT[s.vent].name.toLowerCase()}`);
        const A = axes(g, { x0: 90, x1: w - 90, y0: h - 70, y1: 110, xMax: 8, yMin: 1, yMax: 10000, logY: true, xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8], yTicks: [1, 10, 100, 1000, 10000], yFmt: (v) => v.toLocaleString('en-IN'), xLabel: 'hours', yLabel: 'CO, ppm' });
        // WHO 8-hour guideline, 10 mg/m³ ≈ 9 ppm.
        line(g, [[0, 9], [8, 9]], A.X, A.Y, 'rgba(92,225,169,.7)', 2, [6, 6]);
        g.fillStyle = 'rgba(92,225,169,.9)'; g.font = '16px sans-serif'; g.fillText('WHO 8-hour limit, 9 ppm', A.X(0.15), A.Y(9) - 8);
        const pts = N.out.filter((q) => q.t <= s.hour + 1e-6);
        line(g, pts.map((q) => [q.t, Math.max(1, q.ppm)]), A.X, A.Y, '#9aa3b2', 5);
        // COHb on the right axis, 0–80%.
        const YB = (p) => (h - 70) - (p / 80) * (h - 180);
        g.strokeStyle = '#ff5a5a'; g.lineWidth = 5; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(A.X(q.t), YB(q.cohb)) : g.moveTo(A.X(q.t), YB(q.cohb)))); g.stroke();
        g.fillStyle = 'rgba(255,90,90,.9)'; g.font = '16px sans-serif';
        [0, 20, 40, 60, 80].forEach((p) => g.fillText(p + '%', w - 78, YB(p) + 6));
        g.fillText('COHb', w - 82, 100);
        [[10, 'headache'], [30, 'can’t get up'], [60, 'often fatal']].forEach(([p, t]) => { g.strokeStyle = 'rgba(255,90,90,.25)'; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(90, YB(p)); g.lineTo(w - 90, YB(p)); g.stroke(); g.setLineDash([]); g.fillText(t, w - 90 - g.measureText(t).width - 6, YB(p) - 6); });
        legend(g, [['CO in the air', '#9aa3b2'], ['COHb in blood', '#ff5a5a']], 110, 100 + 0);
        const q = pts[pts.length - 1]; if (q) { dot(g, A.X(q.t), A.Y(Math.max(1, q.ppm)), '#9aa3b2'); dot(g, A.X(q.t), YB(q.cohb), '#ff5a5a'); }
      } else {
        title(g, 'Warming air makes it drier', `outside ${s.tOut.toFixed(1)} °C at ${Math.round(s.rhOut)}% RH`);
        const A = axes(g, { x0: 90, x1: w - 30, y0: h - 70, y1: 110, xMin: 0, xMax: 30, yMax: 100, xTicks: [0, 5, 10, 15, 20, 25, 30], yTicks: [0, 20, 40, 60, 80, 100], yFmt: (v) => v + '%', xLabel: 'room °C', yLabel: 'RH' });
        g.fillStyle = 'rgba(92,225,169,.12)'; g.fillRect(A.X(0), A.Y(60), A.X(30) - A.X(0), A.Y(40) - A.Y(60));
        g.fillStyle = 'rgba(92,225,169,.9)'; g.font = '16px sans-serif'; g.fillText('comfortable 40–60%', A.X(0.5), A.Y(60) + 20);
        g.fillStyle = 'rgba(255,122,89,.10)'; g.fillRect(A.X(0), A.Y(30), A.X(30) - A.X(0), A.Y(0) - A.Y(30));
        g.fillStyle = 'rgba(255,122,89,.9)'; g.fillText('dry eyes and skin below ~30%', A.X(0.5), A.Y(30) + 20);
        const pts = []; for (let T = s.tOut; T <= 30; T += 0.25) pts.push([T, rhAfter(s.rhOut, s.tOut, T)]);
        line(g, pts, A.X, A.Y, '#6fb6ff', 5);
        dot(g, A.X(s.tIn), A.Y(rhAfter(s.rhOut, s.tOut, s.tIn)), '#6fb6ff', 11);
      }
    }, [32, 13, 0]);

    let t = 0, redraw = 0, lastMode = null;
    const resp = responsive(stage, (p) => (p ? (isPhone(stage) ? fitView(stage, [0, 22, 0], [0.3, 0.5, 1], 80) : fitView(stage, [0, 22, 0], [0.2, 0.5, 1], 98)) : VIEW), (p) => {
      bCO.mesh.visible = !isPhone(stage);
      bCO.mesh.position.set(p ? 0 : 32, p ? 46 : 13, 0); bCO.mesh.scale.setScalar(p ? 1.35 : 1);
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        const k = `${s.fuel}|${s.vent}`;
        if (k !== nkey) { nkey = k; N = coNight(s); }
        if (s.play && !inReel() && s.mode === 'co') s.hour = s.hour >= 8 ? 0 : Math.min(8, s.hour + dt * 0.35);
        const isCO = s.mode === 'co';
        const fuelOn = isCO ? s.fuel : 'electric';
        ang.group.visible = ['angithi', 'coal', 'wood'].includes(fuelOn); ofr.group.visible = fuelOn === 'electric'; gas.visible = fuelOn === 'gas';
        ang.set(fuelOn === 'wood' ? 900 : 800 + 40 * Math.sin(t * 3), 1);
        ofr.set(150, 1); ofr.setSurface(70);
        plaque.material.emissive?.setHex(0xff5a1a);
        room.win.children[0].material.opacity = s.vent === 'ajar' ? 0.08 : 0.35;
        lWin.element.innerHTML = isCO ? (s.vent === 'ajar' ? 'Window ajar' : s.vent === 'sealed' ? 'Gaps stuffed shut' : 'Window closed') : `Outside ${s.tOut.toFixed(1)} °C, ${Math.round(s.rhOut)}%`;
        const q = N.out[Math.min(N.out.length - 1, Math.round(s.hour * 20))];
        // CO dots: how many are visible grows with log(ppm).
        const nCO = isCO ? Math.round(NC * clamp(Math.log10(Math.max(1, q.ppm)) / 4, 0, 1)) : 0;
        for (let i = 0; i < NC; i++) {
          const c = cSeed[i];
          co.place(i, c[0] + Math.sin(t * 0.3 + i) * 0.6, c[1] + Math.sin(t * 0.2 + i * 1.3) * 0.5, c[2] + Math.cos(t * 0.25 + i) * 0.6, i < nCO ? 1 : 0);
        }
        co.done();
        // Water vapour: the same number of dots however warm the room: the water doesn't change.
        const nW = isCO ? 0 : Math.round(NW * clamp(gPerKg(s.rhOut, s.tOut) / 12, 0.1, 1));
        for (let i = 0; i < NW; i++) {
          const c = wSeed[i], sp = 0.3 + (s.tIn - 5) * 0.04;
          vap.place(i, c[0] + Math.sin(t * sp + i) * 1.2, c[1] + Math.cos(t * sp * 0.8 + i) * 1.0, c[2] + Math.sin(t * sp * 0.7 + i * 2) * 1.2, i < nW ? 1 : 0);
        }
        vap.done();
        if (isCO) {
          const c = q.cohb;
          sleeper.skin.color.set(0xc68e62).lerp(new THREE.Color(0xe0605a), clamp((c - 10) / 50, 0, 1) * 0.6);
          lSleeper.element.innerHTML = `COHb <b>${c.toFixed(0)}%</b>: ${effectAt(c)}`;
        } else { sleeper.skin.color.set(0xc68e62); lSleeper.element.innerHTML = `Room air <b>${Math.round(rhAfter(s.rhOut, s.tOut, s.tIn))}% RH</b>`; }
        redraw += dt;
        if (redraw > 0.15 || lastMode !== s.mode) { redraw = 0; lastMode = s.mode; bCO.redraw(); }
      },
      readout: (s) => {
        if (s.mode === 'dry') {
          const rh = rhAfter(s.rhOut, s.tOut, s.tIn);
          return `<div class="big">${Math.round(rh)}% RH indoors</div>
            <div class="row"><span>Outside</span><b>${s.tOut.toFixed(1)} °C, ${Math.round(s.rhOut)}% RH</b></div>
            <div class="row"><span>Water in the air (unchanged)</span><b>${gPerKg(s.rhOut, s.tOut).toFixed(1)} g per kg of air</b></div>
            <div class="row"><span>Most it could hold at ${s.tIn.toFixed(1)} °C</span><b>${gPerKg(100, s.tIn).toFixed(1)} g/kg</b></div>
            <div class="row"><span>Feels</span><b>${rh < 30 ? 'dry: eyes and skin suffer' : rh <= 60 ? 'comfortable' : 'damp'}</b></div>
            <small>Saturation pressure ${psat(s.tOut).toFixed(2)} → ${psat(s.tIn).toFixed(2)} kPa (Magnus formula).</small>`;
        }
        const q = N.out[Math.min(N.out.length - 1, Math.round(s.hour * 20))];
        if (s.fuel === 'electric') return `<div class="big">No carbon monoxide</div>
          <div class="row"><span>CO in the air</span><b>0 ppm</b></div><div class="row"><span>Oxygen</span><b>20.9%</b></div>
          <small>Electric heaters burn nothing. Keep them away from fabric and use a thermostat.</small>`;
        return `<div class="big">${Math.round(q.ppm).toLocaleString('en-IN')} ppm CO</div>
          <div class="row"><span>Sleeper’s blood COHb</span><b>${q.cohb.toFixed(0)}%</b></div>
          <div class="row"><span>Effect</span><b>${effectAt(q.cohb)}</b></div>
          <div class="row"><span>Headache level (10%) after</span><b>${N.tHead !== null ? N.tHead.toFixed(1) + ' h' : 'not in 8 h'}</b></div>
          <div class="row"><span>Too weak to get up (30%) after</span><b>${N.tDanger !== null ? N.tDanger.toFixed(1) + ' h' : 'not in 8 h'}</b></div>
          <div class="row"><span>Oxygen</span><b>${q.O2.toFixed(1)}%</b></div>
          <small>12 m² room. Model, not a safety test: fires and rooms vary a lot. Never burn fuel in a closed bedroom.</small>`;
      },
    };
  },
};
