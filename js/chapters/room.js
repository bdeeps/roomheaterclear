// Chapter 4: heat a room. A two-node heat balance of a real room on a Delhi January night (heater.js
// roomParams + simulateNight): air and wall surfaces each store heat; heat leaks out through walls,
// window, roof and draughts. Outside: 7.5 °C, the January mean minimum at Safdarjung, Delhi (IMD
// climatological normals 1971–2020, IMD Delhi monthly weather report, January 2026).
// "Heat output" is what the heater gives the room. Electric resistance heaters draw the same in
// electricity; an AC in heat mode (a heat pump, see ACClear) draws about a third of it, COP ≈ 3 at
// 7 °C outside (typical inverter split AC; real COP falls as it gets colder).
// Money: kWh × tariff. Indian household tariffs run in slabs from about ₹3 to ₹8+ a unit; ₹7 is the
// default here, and you can set your own.
import { THREE, M, box } from '../kit.js';
import {
  HEATERS, INSULATION, ROOMS, roomParams, simulateNight, makeHeater, makeRoom, board, panelBg, title, axes, line, dot, legend, dots, rng,
  fmtW, fmtH, rs, fitView, responsive, inReel, isPhone, clamp,
} from '../heater.js';

const KINDS = ['fan', 'ofr', 'convector', 'halogen', 'hp'];
const NAMES = { fan: 'Fan', ofr: 'Oil radiator', convector: 'Convector', halogen: 'Halogen', hp: 'AC heat mode' };
const VIEW = { pos: [11, 36, 70], target: [9, 15, 0] };

export function run(s) {
  const p = roomParams({ area: s.area, ins: s.ins, tout: s.tout });
  const H = HEATERS[s.kind], cop = H.cop || 1;
  const r = simulateNight(p, { id: s.kind, W: s.watts / cop, cop, set: s.set, stat: true, hours: s.hours });
  return { p, r, cop, H, rupees: r.kWh * s.tariff };
}
const tempCol = (T, out = new THREE.Color()) => {
  const k = clamp((T - 5) / 20, 0, 1);
  return out.setRGB(0.25 + 0.75 * k, 0.55 + 0.2 * Math.sin(k * Math.PI), 1 - 0.75 * k);
};

export default {
  id: 'room',
  short: 'Heat a room',
  title: 'Heat a room on a Delhi winter night',
  subtitle: 'How long it takes, how warm it gets, and what the night costs.',
  view: VIEW,
  learn: `<p>A room is a leaky box. Heat escapes through the <b>walls</b>, the <b>window</b>, the <b>roof</b> and every <b>draught</b>. The rate is roughly <b>U × A × ΔT</b>: how leaky each surface is, how big, and how much warmer inside is than outside. Add it all up and a typical Indian bedroom loses about <b>100 watts for every degree</b> you hold it above the outside air.</p>
    <p>So a heater can only warm a room until the leaks match its power. That is the <b>steady temperature</b>. A 2 kW heater in a leaky room might never reach 20 °C; the same heater in a small, sealed room can make it too hot.</p>
    <p>The <b>walls</b> matter too. Brick and concrete soak up heat for hours before they warm, which is why a heater warms the air quickly but the room still feels chilly near the walls. Heaters with a <b>thermostat</b> switch off when the air is warm enough, which saves money; plain radiant heaters just run flat out.</p>
    <p>An <b>AC in heat mode</b> is a heat pump: it moves heat in from outdoors and gives about <b>3 units of heat for 1 unit of electricity</b> (see ACClear). Every other heater here gives exactly 1. The energy itself follows EnergyClear: every joule you pay for ends up leaking outside.</p>
    <p class="tip"><b>Try it:</b> pick your room and a Delhi January night, then compare the fan heater, the oil radiator and the AC. Change the insulation and watch the bill.</p>`,
  terms: [
    { t: 'U-value', d: 'How many watts leak through each square metre of a wall or window for each degree of difference, in W/m²K.' },
    { t: 'Heat loss coefficient', d: 'The whole room’s leakiness, in watts per degree: all the U × A values plus the draughts.' },
    { t: 'Steady temperature', d: 'The temperature where the heat leaking out equals the heater’s power, so it stops rising.' },
    { t: 'Air change rate', d: 'How many times an hour the room’s air is replaced by outside air through gaps and openings.' },
    { t: 'kWh (unit)', d: 'One kilowatt for one hour: the “unit” on your electricity bill. A 2 kW heater uses 2 units an hour.' },
    { t: 'COP', d: 'Coefficient of performance: heat delivered ÷ electricity used. 1 for any resistance heater, about 3 for a heat pump.' },
  ],
  defaults: { area: 14, ins: 'typical', tout: 7.5, kind: 'fan', watts: 2000, set: 22, hours: 8, tariff: 7, hour: 1, play: true },
  controls: [
    { key: 'area', type: 'seg', label: 'Room', options: Object.keys(ROOMS).map((a) => ({ v: +a, label: `${a} m²` })), fmt: (v) => ROOMS[v] + ', 3 m ceiling' },
    { key: 'ins', type: 'seg', label: 'Walls and windows', options: Object.entries(INSULATION).map(([v, o]) => ({ v, label: o.name })), fmt: (v) => INSULATION[v].sub },
    { key: 'tout', type: 'range', label: 'Outside at night', min: -2, max: 15, step: 0.5, ends: ['cold wave', 'mild'], fmt: (v) => `${v.toFixed(1)} °C${Math.abs(v - 7.5) < 0.3 ? ' · Delhi January average low' : ''}` },
    { key: 'kind', type: 'seg', label: 'Heater', options: KINDS.map((id) => ({ v: id, label: NAMES[id] })), fmt: (v) => (HEATERS[v].thermostat ? 'has a thermostat' : 'no thermostat: runs flat out') },
    { key: 'watts', type: 'seg', label: 'Heat output', options: [1000, 1500, 2000, 2500].map((v) => ({ v, label: (v / 1000).toFixed(1).replace('.0', '') + ' kW' })) },
    { key: 'set', type: 'range', label: 'Thermostat set to', min: 16, max: 26, step: 0.5, fmt: (v) => v.toFixed(1) + ' °C air' },
    { key: 'hours', type: 'range', label: 'Hours switched on', min: 1, max: 10, step: 0.5, fmt: (v) => v + ' h' },
    { key: 'tariff', type: 'range', label: 'Your tariff', min: 3, max: 10, step: 0.5, fmt: (v) => `₹${v.toFixed(1)} per kWh (unit)` },
    { key: 'hour', type: 'range', label: 'Show the room at', min: 0, max: 10, step: 0.05, fmt: (v, s) => fmtH(Math.min(v, s.hours)) + ' after switching on' },
    { key: 'play', type: 'toggle', label: 'Run the clock' },
  ],
  onChange(s) { s.hour = Math.min(s.hour, s.hours); },
  quiz: [
    { q: 'Your 2 kW heater never gets a leaky room above 17 °C. What is happening?', options: ['The heater is broken', 'Heat leaks out as fast as the heater makes it', 'Heat can’t go above 17 °C', 'The thermostat is too high'], answer: 1, why: 'At the steady temperature, the loss (heat loss coefficient × ΔT) equals the heater’s 2 kW. Only less leakage or more power can raise it.' },
    { q: 'A 2 kW fan heater runs flat out for 8 hours. How many units (kWh) does it use?', options: ['2', '8', '16', '250'], answer: 2, why: '2 kW × 8 h = 16 kWh. At ₹7 a unit that is about ₹112 for the night.' },
    { q: 'Why does an AC in heat mode cost about a third as much to run for the same warmth?', options: ['It makes heat from nothing', 'It moves heat from the outdoor air into the room, using electricity only to pump it', 'It heats only your face', 'It uses gas'], answer: 1, why: 'A heat pump is a fridge run the other way round. It moves about 3 units of heat for each unit of electricity at 7 °C outside.' },
  ],
  reel: [
    { ms: 5400, caption: 'A 2 kW heater warms a Delhi bedroom until its leaks match its power.', set: { area: 14, ins: 'typical', tout: 7.5, kind: 'fan', watts: 2000, set: 22, hours: 8, play: false }, anim: { hour: [0, 8] }, spin: 0.2 },
    { ms: 5000, caption: 'Eight hours at 2 kW is 16 units: over ₹100 a night. An AC in heat mode needs a third.', set: { kind: 'hp', hour: 8, play: false }, anim: { ins: ['poor', 'good'] }, spin: 0.2 },
  ],

  build({ stage, s }) {
    const root = new THREE.Group(); stage.root.add(root);
    let R = run(s), key = '';
    // Room: rebuilt when its size changes.
    const roomG = new THREE.Group(); root.add(roomG);
    let room = null, airBox = null, side = 0, heaterObj = {}, bed = null, lAir, lWall, lOut;
    const ac = new THREE.Group();
    const acBody = box(8, 2.8, 2.4, M.plastic(0xf3f4f6)); ac.add(acBody);
    const acVent = box(7, 0.3, 0.3, M.plastic(0x5a6070)); acVent.position.set(0, -1.2, 1.1); ac.add(acVent);
    function buildRoom(area) {
      // Drop the old room (and its labels' DOM elements); heaters are kept and re-added.
      roomG.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
      [...roomG.children].forEach((c) => { roomG.remove(c); if (c === room || c === airBox) c.traverse((o) => { o.geometry?.dispose(); }); });
      side = Math.sqrt(area) * 10;
      room = makeRoom(side, side, 30); roomG.add(room);
      airBox = new THREE.Mesh(new THREE.BoxGeometry(side - 0.6, 29.5, side - 0.6), new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.12, depthWrite: false }));
      airBox.position.set(0.1, 14.9, 0.1); roomG.add(airBox);
      bed = new THREE.Group();
      const frame = box(10, 2.2, 19, M.plastic(0x6b4a2b)); frame.position.y = 1.1;
      const mat = box(9.6, 1.6, 18.6, M.matte(0xe8e2d6)); mat.position.y = 3.0;
      const quilt = box(9.8, 0.8, 12, M.matte(0x8a5bd6)); quilt.position.set(0, 4.1, 3.2);
      bed.add(frame, mat, quilt); bed.position.set(side / 2 - 7, 0, -side / 2 + 11); roomG.add(bed);
      KINDS.forEach((id) => {
        if (id === 'hp') { ac.position.set(0, 25, -side / 2 + 1.5); roomG.add(ac); heaterObj.hp = { group: ac, set() {} }; return; }
        const h = heaterObj[id] || makeHeater(id); heaterObj[id] = h;
        h.group.position.set(-side / 2 + 7, 0, -side / 2 + 7); h.group.rotation.y = 0.6; roomG.add(h.group);
      });
      lAir = stage.label('', [0, 20, 0], roomG, 'hot');
      lWall = stage.label('', [side / 2 - 2, 26, -side / 2 + 0.5], roomG);
      lOut = stage.label('', [-side / 2 - 1, 22, side / 4], roomG);
    }
    buildRoom(s.area);
    let lastArea = s.area;

    // Warm air leaving the heater.
    const r = rng(9), NA = 120, air = dots(NA, 0.3, 0xffb547, 0.8); root.add(air);
    const seed = Array.from({ length: NA }, () => [r(), r(), r(), r()]);

    // Temperature chart.
    const bT = board(root, 25, 16.25, 1000, 650, (g, w, h) => {
      panelBg(g, w, h);
      const { r: res, p } = R;
      title(g, 'Temperature through the night', `${INSULATION[s.ins].name} ${s.area} m² room, ${fmtW(s.watts)} ${NAMES[s.kind].toLowerCase()}`);
      const yMin = Math.floor(Math.min(s.tout, res.start) - 2), yMax = Math.max(26, Math.ceil(Math.max(...res.samples.map((q) => q.Ta)) + 1));
      const A = axes(g, { x0: 80, x1: w - 30, y0: h - 90, y1: 100, xMax: s.hours, yMin, yMax, xTicks: Array.from({ length: Math.floor(s.hours) + 1 }, (_, i) => i), yTicks: Array.from({ length: 20 }, (_, i) => Math.ceil(yMin / 5) * 5 + i * 5).filter((v) => v <= yMax), yFmt: (v) => v + '°', xLabel: 'hours' });
      g.fillStyle = 'rgba(111,182,255,.12)'; g.fillRect(A.X(0), A.Y(s.tout), A.X(s.hours) - A.X(0), A.Y(yMin) - A.Y(s.tout));
      line(g, [[0, s.tout], [s.hours, s.tout]], A.X, A.Y, '#6fb6ff', 3, [8, 6]);
      line(g, [[0, s.set], [s.hours, s.set]], A.X, A.Y, 'rgba(255,255,255,.45)', 2, [4, 6]);
      line(g, res.samples.map((q) => [q.t, q.Ts]), A.X, A.Y, '#c49bff', 4);
      line(g, res.samples.map((q) => [q.t, q.Ta]), A.X, A.Y, '#ff7a59', 5);
      // Heater on/off strip.
      const yS = h - 50;
      res.samples.forEach((q, i) => { if (q.P > 0 && i) { g.fillStyle = '#ffb547'; g.fillRect(A.X(res.samples[i - 1].t), yS, A.X(q.t) - A.X(res.samples[i - 1].t) + 0.5, 12); } });
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '16px sans-serif'; g.fillText('heater on', 80, yS + 30);
      legend(g, [['Air', '#ff7a59'], ['Walls', '#c49bff'], ['Outside', '#6fb6ff']], w - 360, 92);
      const q = res.samples[Math.min(res.samples.length - 1, Math.round(Math.min(s.hour, s.hours) * 60))];
      dot(g, A.X(q.t), A.Y(q.Ta), '#ff7a59');
    }, [side / 2 + 15.5, 14, 0]);

    let t = 0, redraw = 0;
    const resp = responsive(stage, (p) => (p ? (isPhone(stage) ? fitView(stage, [0, 24, 0], [0.3, 0.5, 1], 88) : fitView(stage, [0, 22, 0], [0.2, 0.55, 1], 105)) : VIEW), (p) => {
      bT.mesh.visible = !isPhone(stage);
      bT.mesh.position.set(p ? 0 : side / 2 + 15.5, p ? 48 : 14, 0); bT.mesh.scale.setScalar(p ? 1.5 : 1);
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const k = JSON.stringify([s.area, s.ins, s.tout, s.kind, s.watts, s.set, s.hours, s.tariff]);
        if (k !== key) { key = k; R = run(s); bT.redraw(); }
        if (s.area !== lastArea) { lastArea = s.area; buildRoom(s.area); resp(true); }
        resp();
        if (s.play && !inReel()) s.hour = (s.hour + dt * 0.5) % (s.hours + 0.5);
        const hr = Math.min(s.hour, s.hours);
        const q = R.r.samples[Math.min(R.r.samples.length - 1, Math.round(hr * 60))];
        KINDS.forEach((id) => { heaterObj[id].group.visible = id === s.kind; });
        const H = heaterObj[s.kind], spec = HEATERS[s.kind], k1 = clamp(q.Q / (s.watts || 1), 0, 1);
        if (H.set) H.set(s.kind === 'ofr' ? 150 : spec.T, q.P > 0 ? 1 : 0.15 * k1);
        if (H.setSurface) H.setSurface(20 + (spec.T - 20) * k1);
        if (H.fan) H.fan.rotation.z += dt * 22 * (q.P > 0 ? 1 : 0);
        airBox.material.color.copy(tempCol(q.Ta)); airBox.material.opacity = 0.1;
        room.back.material.color.copy(tempCol(q.Ts)).multiplyScalar(0.45);
        lAir.element.innerHTML = `Air <b>${q.Ta.toFixed(1)} °C</b>`;
        lWall.element.innerHTML = `Walls ${q.Ts.toFixed(1)} °C`;
        lOut.element.innerHTML = `Outside ${s.tout.toFixed(1)} °C`;
        // Warm air rising from the heater (or blown from the AC), spreading under the ceiling.
        const hp = H.group.position, on = k1 > 0.05;
        for (let i = 0; i < NA; i++) {
          const sd = seed[i], u = (sd[0] + t * 0.1) % 1;
          let x, y, z;
          if (s.kind === 'hp') { x = hp.x + (sd[1] - 0.5) * 8; y = hp.y - 1.5 - u * 16; z = hp.z + 2 + u * side * 0.6 * sd[2]; }
          else { const Y = u * 40; if (Y < 28) { x = hp.x + (sd[1] - 0.5) * 3; y = 3 + Y; z = hp.z + (sd[2] - 0.5) * 3; } else { const L = (Y - 28) * 2.4; x = hp.x + L * sd[3]; y = 29 - L * 0.08; z = hp.z + L * sd[2]; } }
          air.place(i, x, y, z, on ? 1 - u * 0.5 : 0);
        }
        air.done();
        redraw += dt; if (redraw > 0.25) { redraw = 0; bT.redraw(); }
      },
      readout: (s) => {
        const { r: res, cop } = R, eW = s.watts / cop;
        const warm = res.tWarm !== null ? fmtH(res.tWarm) : `not in ${s.hours} h`;
        return `<div class="big">${res.kWh.toFixed(1)} kWh · ${rs(R.rupees)}</div>
          <div class="row"><span>Air reaches ${s.set} °C after</span><b>${warm}</b></div>
          <div class="row"><span>Steady temperature, left on</span><b>${R.r.steady.Ta.toFixed(1)} °C air</b></div>
          <div class="row"><span>Room loses</span><b>${Math.round(res.UA)} W per °C</b></div>
          <div class="row"><span>Electricity drawn when on</span><b>${fmtW(eW)}${cop > 1 ? ` for ${fmtW(s.watts)} of heat` : ''}</b></div>
          <div class="row"><span>A month of nights like this</span><b>${rs(R.rupees * 30)}</b></div>
          <small>At ₹${s.tariff}/kWh (your tariff). Starts ${res.start.toFixed(1)} °C: unheated rooms sit ~5 °C above outside.</small>`;
      },
    };
  },
};
