// Chapter 3: inside an oil-filled radiator and a PTC ceramic heater.
// OFR (time-lapse, 1 s on screen = 1 min): a lumped body, C = 9 kg steel × 460 J/kg·K + 3.5 kg of
// mineral oil × 1,900 J/kg·K ≈ 10.8 kJ/K. It loses heat to a 20 °C room through about 3 m² of fin
// at h ≈ 8 W/m²K (natural convection + radiation): UA ≈ 25 W/K. A bimetal thermostat switches the
// element off at the knob's setting (with a 4 °C differential). For comparison, a fan heater's
// output follows its switch within seconds. Both are switched on at 0 and off at 45 min.
// PTC (real time): C dT/dt = V²/R(T) − G(v)·(T − 20), with R(T) from heater.js (ptcR, ptcG). The
// same balance for a plain nichrome coil (R nearly constant) runs away with the fan off, until the
// thermal cut-out trips (set here at 600 °C on the coil; real cut-outs sense the casing).
import { THREE, M, box } from '../kit.js';
import {
  makeOFR, makePTC, board, panelBg, title, axes, line, dot, legend, dots, rng, ptcR, ptcG, ptcStep, ptcSteady, PTC, nichromeR, V_MAINS,
  fmtW, fitView, responsive, inReel, isPhone, clamp,
} from '../heater.js';

const OFR = { C: 9 * 460 + 3.5 * 1900, UA: 25, room: 20, off: 45, span: 90 };
const VIEW = { pos: [6, 8.5, 28], target: [6.8, 4.6, 0] };

// OFR and fan heater over 90 minutes, sampled each minute, for a given power and thermostat setting.
export function ofrRun(W = 2000, set = 75) {
  let T = OFR.room, on = true; const pts = [];
  for (let m = 0; m <= OFR.span; m += 0.25) {
    const sw = m < OFR.off;
    if (!sw) on = false; else if (T >= set) on = false; else if (T <= set - 4) on = true;
    const out = OFR.UA * (T - OFR.room);
    if (Math.abs(m - Math.round(m)) < 1e-6) pts.push({ m, T, out, on, fan: sw ? W : 0 });
    T += ((on ? W : 0) - out) * 15 / OFR.C;
  }
  return pts;
}
const warmMin = (pts, frac = 0.9) => { const mx = Math.max(...pts.filter((p) => p.m < OFR.off).map((p) => p.out)); const p = pts.find((q) => q.out >= frac * mx); return p ? p.m : null; };

export default {
  id: 'inside',
  short: 'Oil and PTC inside',
  title: 'Inside an oil radiator and a PTC heater',
  subtitle: 'Oil that stores heat, a strip of two metals that switches it, and a stone that can’t overheat.',
  view: VIEW,
  learn: `<p>An <b>oil-filled radiator</b> has no oil to burn. The oil is sealed in for good. An element at the bottom heats it; hot oil rises inside each fin, gives its heat to the steel and sinks again: <b>convection inside</b>. The fins then warm the room air: <b>convection outside</b>.</p>
    <p>About 3.5 kg of oil and 9 kg of steel make a big <b>thermal mass</b>: over 10,000 joules for each degree. So an OFR takes many minutes to warm up where a fan heater takes seconds, runs at a gentle 70 to 80 °C, and keeps giving heat for 15 to 20 minutes after you switch it off.</p>
    <p>Its <b>thermostat</b> is a <b>bimetal strip</b>: brass and steel bonded together. Brass expands more when warm, so the strip bends and flicks a contact open. Turning the knob moves the contact. A <b>tip-over switch</b> in the base cuts the power if the heater falls, and a <b>thermal fuse</b> is the last line of defence.</p>
    <p>A <b>PTC ceramic heater</b> uses stones of doped <b>barium titanate</b>. Below about 220 °C they conduct well; just above it, their resistance shoots up ten times every 12 °C. So they draw full power when cool and <b>throttle themselves</b> when hot. Block the airflow and the power simply falls. A plain nichrome coil would keep getting hotter until a cut-out saved it.</p>
    <p class="tip"><b>Try it:</b> watch the OFR's heat keep flowing after the switch goes off. Then pick the PTC and turn the fan down to zero. Swap in a nichrome coil and do it again.</p>`,
  terms: [
    { t: 'Thermal mass', d: 'How much heat something must take in to warm up by one degree. Big thermal mass means slow to heat, slow to cool.' },
    { t: 'Bimetal strip', d: 'Two metals that expand differently, bonded together. Heat bends it, which can open or close a switch.' },
    { t: 'Thermostat', d: 'A switch worked by temperature that keeps something near a set temperature.' },
    { t: 'Tip-over switch', d: 'A switch in the base that is closed only while the heater stands upright.' },
    { t: 'PTC', d: 'Positive temperature coefficient: resistance rises as temperature rises, sharply above a switching point.' },
    { t: 'Thermal fuse', d: 'A one-time safety link that melts open if the heater gets dangerously hot.' },
  ],
  defaults: { focus: 'ofr', power: 2000, set: 75, clock: 0, play: true, tip: false, fan: 2, elem: 'ptc' },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look inside', options: [{ v: 'ofr', label: 'Oil radiator' }, { v: 'ptc', label: 'PTC heater' }] },
    { key: 'power', type: 'seg', label: 'OFR: switches', options: [{ v: 800, label: '800 W' }, { v: 1200, label: '1,200 W' }, { v: 2000, label: 'Both: 2,000 W' }] },
    { key: 'set', type: 'range', label: 'OFR: thermostat knob', min: 45, max: 85, step: 1, ends: ['low', 'high'], fmt: (v) => `cuts out at ${Math.round(v)} °C` },
    { key: 'clock', type: 'range', label: 'OFR: time since switching on', min: 0, max: 90, step: 0.5, ends: ['0', '90 min'], fmt: (v) => `${Math.round(v)} min${v >= OFR.off ? ' (switched off at 45)' : ''}` },
    { key: 'play', type: 'toggle', label: 'OFR: run the clock' },
    { key: 'tip', type: 'toggle', label: 'OFR: knock it over' },
    { key: 'fan', type: 'range', label: 'PTC: air through the fins', min: 0, max: 2.5, step: 0.05, ends: ['blocked', 'full fan'], fmt: (v) => v.toFixed(1) + ' m/s' },
    { key: 'elem', type: 'seg', label: 'PTC: element', options: [{ v: 'ptc', label: 'PTC stones' }, { v: 'nichrome', label: 'Plain nichrome coil' }] },
  ],
  onChange(s, key) { if (key === 'power' || key === 'set') s.clock = Math.min(s.clock, 90); if (key === 'elem' || key === 'focus') s._reset = true; },
  quiz: [
    { q: 'Why does an oil-filled radiator keep warming the room after you switch it off?', options: ['A battery inside keeps it on', 'The hot oil and steel store a lot of heat and release it slowly', 'The oil keeps burning', 'The thermostat is broken'], answer: 1, why: 'Thermal mass: over 10 kJ for each degree. At 75 °C it holds more than half a megajoule, which it gives out over the next 15 to 20 minutes.' },
    { q: 'How does a bimetal strip switch a heater off?', options: ['It melts', 'Its two metals expand by different amounts, so it bends and opens a contact', 'It becomes magnetic', 'It gets heavier'], answer: 1, why: 'Brass expands more than steel for each degree. Bonded together, they curl as they warm, and the moving end opens the contact.' },
    { q: 'A cloth falls over a PTC heater and blocks the air. What happens?', options: ['The stones glow red hot', 'Their resistance shoots up, so the power drops and they stay near 230 °C', 'The fan speeds up', 'The heater draws more current'], answer: 1, why: 'Above their switching temperature the stones’ resistance climbs steeply, so V²/R falls and they limit themselves. Still: never cover any heater.' },
  ],
  reel: [
    { ms: 5600, caption: 'An oil radiator stores heat in oil and steel, so it keeps warming after it is switched off.', set: { focus: 'ofr', power: 2000, set: 75, play: false, tip: false }, anim: { clock: [0, 80] }, spin: 0.2 },
  ],

  build({ stage, s }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---- OFR, cut open (X-ray) on a pivot so it can be knocked over.
    const ofrPivot = new THREE.Group(); ofrPivot.position.set(3.2, 0, 0); root.add(ofrPivot);
    const O = makeOFR(); O.setXray(true); ofrPivot.add(O.group);
    const { span, H, D, y0, pitch, fins } = O.dims;
    // Oil circulation: up the middle of each fin, down its front and back edges.
    const r = rng(5), NO = 150;
    const oil = dots(NO, 0.09, 0xffb547); O.group.add(oil);
    const oSeed = Array.from({ length: NO }, () => [r(), Math.floor(r() * fins), r()]);
    // The bimetal thermostat, magnified, floating above the control box.
    const bi = new THREE.Group(); bi.position.set(-5.6, 1.6, 2.5); bi.scale.setScalar(1.5); root.add(bi);
    const NSEG = 18, SEG = 0.2, brass = M.metal(0xd4a64a, { roughness: 0.3 }), steel = M.metal(0x9aa3b2, { roughness: 0.35 });
    const segs = [];
    for (let i = 0; i < NSEG; i++) { const g = new THREE.Group(); const a = box(SEG * 1.02, 0.07, 0.6, brass); a.position.y = 0.04; const b = box(SEG * 1.02, 0.07, 0.6, steel); b.position.y = -0.04; g.add(a, b); bi.add(g); segs.push(g); }
    const anchor = box(0.3, 0.6, 0.8, M.plastic(0x2a2e37)); anchor.position.set(-0.15, 0, 0); bi.add(anchor);
    const contact = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.metal(0xe0c080)); bi.add(contact);
    const tipC = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), M.metal(0xe0c080)); bi.add(tipC);
    const post = box(0.25, 0.8, 0.5, M.plastic(0x2a2e37)); bi.add(post);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.glow(0x8ef0ff, { transparent: true, opacity: 0.8 })); bi.add(spark);
    const lBi = stage.label('Thermostat bimetal (magnified)', [1.8, 1.4, 0], bi);
    const lBiState = stage.label('', [1.8, -1.1, 0], bi);
    const lOil = stage.label('Hot oil rises, cools and sinks', [-span / 2 - 0.4, y0 + H + 0.8, 0], O.group);
    const lTip = stage.label('Tip-over switch', [0, -0.2, 1.7], O.group);
    const lElem = stage.label('Element in the oil', [-1.6, 0.5, 1.4], O.group, 'hot');

    // ---- PTC heater, scaled up, with air through it.
    const ptcG0 = new THREE.Group(); ptcG0.position.set(3.2, 0, 0); root.add(ptcG0);
    const P = makePTC(); P.setXray(true); P.group.scale.setScalar(2.6); ptcG0.add(P.group);
    const coilAlt = new THREE.Group(); coilAlt.visible = false;
    const NA = 90, air = dots(NA, 0.13, 0x6fb6ff, 0.9); ptcG0.add(air);
    const aSeed = Array.from({ length: NA }, () => [r(), r(), r()]);
    const cold = new THREE.Color(0x6fb6ff), hot = new THREE.Color(0xff7a3d), tmp = new THREE.Color();
    const lStones = stage.label('PTC stones', [2.4, 4.2, 1.4], ptcG0, 'hot');
    const lFan = stage.label('Fan', [-2.6, 2.4, -1.2], ptcG0);
    const lPtcState = stage.label('', [0, 7.6, 0], ptcG0, 'hot');

    let t = 0, ptT = 20, ptP = 0, cut = false, tipK = 0, redraw = 0;
    // ---- Boards (right).
    const BX = 15.6, BY = 6.2;
    let runs = ofrRun(s.power, s.set), key = '';
    const bOfr = board(root, 11.4, 7.2, 1040, 656, (g, w, h) => {
      panelBg(g, w, h); title(g, 'Heat into the room', 'switched on at 0, off at 45 min');
      const A = axes(g, { x0: 90, x1: w - 30, y0: h - 70, y1: 110, xMax: 90, yMax: 2500, xTicks: [0, 15, 30, 45, 60, 75, 90], yTicks: [0, 500, 1000, 1500, 2000, 2500], yFmt: (v) => (v ? v / 1000 + ' kW' : '0'), xLabel: 'minutes' });
      legend(g, [['Oil radiator', '#ffb547'], ['Fan heater', '#6fb6ff']], w - 420, 100);
      line(g, runs.map((p) => [p.m, Math.min(p.fan, s.power)]), A.X, A.Y, '#6fb6ff', 4);
      line(g, runs.map((p) => [p.m, p.out]), A.X, A.Y, '#ffb547', 5);
      const c = runs[Math.min(runs.length - 1, Math.round(s.clock))];
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(A.X(s.clock), 110); g.lineTo(A.X(s.clock), h - 70); g.stroke(); g.setLineDash([]);
      dot(g, A.X(s.clock), A.Y(c.out), '#ffb547');
    }, [BX, BY, 0]);
    const bPtc = board(root, 11.4, 7.2, 1040, 656, (g, w, h) => {
      panelBg(g, w, h);
      title(g, s.elem === 'ptc' ? 'PTC stones: power in vs heat out' : 'Nichrome coil: power in vs heat out', 'they settle where the two lines cross');
      const A = axes(g, { x0: 90, x1: w - 90, y0: h - 70, y1: 110, xMax: 320, yMax: 4000, xTicks: [0, 50, 100, 150, 200, 250, 300], yTicks: [0, 1000, 2000, 3000, 4000], yFmt: (v) => (v ? v / 1000 + ' kW' : '0'), xLabel: 'element °C' });
      const pin = [], loss = [], Rl = [];
      for (let T = 0; T <= 320; T += 2) {
        const R = s.elem === 'ptc' ? ptcR(T) : nichromeR(T);
        pin.push([T, Math.min(4000, V_MAINS ** 2 / R)]); loss.push([T, clamp(ptcG(s.fan) * (T - 20), 0, 4000)]);
        Rl.push([T, R]);
      }
      // Resistance, log scale on the right axis: 10 Ω … 10 kΩ.
      const YR = (R) => (h - 70) - ((Math.log10(R) - 1) / 3) * (h - 180);
      g.strokeStyle = 'rgba(196,155,255,.8)'; g.lineWidth = 3; g.setLineDash([4, 5]); g.beginPath();
      Rl.forEach(([T, R], i) => { const y = YR(Math.min(1e4, R)); i ? g.lineTo(A.X(T), y) : g.moveTo(A.X(T), y); }); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(196,155,255,.9)'; g.font = '17px sans-serif';
      [10, 100, 1000, 10000].forEach((R) => g.fillText(R >= 1000 ? R / 1000 + 'k Ω' : R + ' Ω', w - 82, YR(R) + 6));
      line(g, pin, A.X, A.Y, '#ff7a3d', 5); line(g, loss, A.X, A.Y, '#6fb6ff', 4);
      legend(g, [['Power in, V²/R', '#ff7a3d'], ['Heat carried off', '#6fb6ff'], ['R', '#c49bff']], 110, 100);
      if (ptT <= 320) dot(g, A.X(ptT), A.Y(Math.min(4000, ptP)), '#fff', 10);
    }, [BX, BY, 0]);

    const resp = responsive(stage, (p) => (p ? (isPhone(stage) ? fitView(stage, [-1, 9, 0], [0.15, 0.3, 1], 34) : fitView(stage, [0, 9, 0], [0.1, 0.25, 1], 44)) : VIEW), (p) => {
      [bOfr, bPtc].forEach((b) => { b.mesh.position.set(p ? 0 : BX, p ? 16 : BY, 0); b.mesh.scale.setScalar(p ? 1.35 : 1); });
      ofrPivot.position.x = p ? 1 : 3.2; ptcG0.position.x = p ? 0 : 3.2; bi.position.set(isPhone(stage) ? -7.2 : p ? -4.5 : -5.6, p && !isPhone(stage) ? 9.5 : isPhone(stage) ? 0.6 : 1.6, isPhone(stage) ? 3.5 : 2.5);
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        const isO = s.focus === 'ofr';
        ofrPivot.visible = isO; bi.visible = isO; ptcG0.visible = !isO; bOfr.mesh.visible = isO && !isPhone(stage); bPtc.mesh.visible = !isO && !isPhone(stage);
        if (s._reset) { s._reset = false; ptT = 20; cut = false; }
        // ---- OFR
        const k = `${s.power}|${s.set}`;
        if (k !== key) { key = k; runs = ofrRun(s.power, s.set); }
        if (isO && s.play && !inReel()) s.clock = (s.clock + dt) % 90;
        const c = runs[Math.min(runs.length - 1, Math.floor(s.clock))];
        tipK += ((s.tip ? 1 : 0) - tipK) * Math.min(1, dt * 3);
        ofrPivot.rotation.z = -tipK * 1.35; ofrPivot.position.y = tipK * 1.6;
        const powered = c.on && !s.tip;
        O.set(powered ? 60 + (c.T - 20) * 1.5 : 20, powered ? 1 : 0);
        O.lamp.set(powered);
        O.setSurface(c.T);
        O.oilMat.color.set(0xd99a2b).lerp(new THREE.Color(0xff5a2a), clamp((c.T - 30) / 60, 0, 1));
        // Oil loop speed grows with the temperature difference that drives it.
        const vOil = 0.05 + clamp((c.T - 20) / 60, 0, 1) * 0.25;
        for (let i = 0; i < NO; i++) {
          const q = oSeed[i], u = (q[0] + t * vOil) % 1, x = (q[1] - (fins - 1) / 2) * pitch;
          let y, z;
          if (u < 0.5) { y = y0 + 0.4 + (u / 0.5) * (H - 0.8); z = (q[2] - 0.5) * 0.5; }
          else { y = y0 + H - 0.4 - ((u - 0.5) / 0.5) * (H - 0.8); z = (q[2] < 0.5 ? -1 : 1) * (D / 2 - 0.25); }
          oil.place(i, x, y, z, isO && c.T > 22 ? 1 : 0);
        }
        oil.done();
        // Bimetal: free curvature grows with temperature (brass α ≈ 19e-6/K vs steel ≈ 12e-6/K, drawn
        // hugely exaggerated). The knob sets how high the fixed contact props the strip's tip: the strip
        // rests on it (closed) until it bends up past it (open).
        const L = NSEG * SEG, cK = 0.004, freeTip = (c.T - 20) * cK * L * L / 2, needY = (s.set - 20) * cK * L * L / 2;
        const kappa = (Math.max(freeTip, needY) * 2) / (L * L);
        let px = 0, py = 0, ang = 0;
        segs.forEach((g) => { g.position.set(px + Math.cos(ang) * SEG / 2, py + Math.sin(ang) * SEG / 2, 0); g.rotation.z = ang; px += Math.cos(ang) * SEG; py += Math.sin(ang) * SEG; ang += kappa * SEG; });
        tipC.position.set(px, py - 0.1, 0);
        const kN = Math.max(1e-4, (needY * 2) / (L * L)), cx = Math.sin(kN * L) / kN, cy = (1 - Math.cos(kN * L)) / kN;
        contact.position.set(cx, cy - 0.28, 0);
        post.position.set(cx, cy - 0.7, 0);
        const closed = c.on && s.clock < OFR.off;
        spark.visible = closed && !s.tip; spark.position.copy(contact.position).add(new THREE.Vector3(0, 0.1, 0));
        lBiState.element.innerHTML = s.clock >= OFR.off ? 'Switched off at the wall' : c.on ? 'Contact closed: heating' : 'Bent open: element off';
        lTip.element.innerHTML = s.tip ? '<b>Tip-over switch: power cut</b>' : 'Tip-over switch';
        [lBi, lBiState, lOil, lTip, lElem].forEach((l) => { l.visible = isO && stage.host.clientWidth >= 560 || (isO && l === lTip); });
        // ---- PTC
        const R = s.elem === 'ptc' ? ptcR(ptT) : nichromeR(ptT);
        if (!isO) {
          if (s.elem === 'ptc') ptT = ptcStep(ptT, s.fan, 20, dt * 3);
          else {
            const n = 20, hh = (dt * 3) / n;
            for (let i = 0; i < n; i++) { const Pw = cut ? 0 : V_MAINS ** 2 / nichromeR(ptT); ptT += ((Pw - ptcG(s.fan) * (ptT - 20)) / 30) * hh; }
            if (ptT > 600) cut = true;
          }
        }
        ptP = cut && s.elem !== 'ptc' ? 0 : V_MAINS ** 2 / R;
        P.set(ptT, 1);
        if (s.elem !== 'ptc') { P.stoneMat.emissiveIntensity = clamp((ptT - 450) / 400, 0, 1) * 2; P.stoneMat.emissive.setHex(0xff4a1a); }
        P.fan.rotation.z += dt * 10 * s.fan;
        lPtcState.element.innerHTML = s.elem === 'ptc' ? `Stones at <b>${Math.round(ptT)} °C</b>, drawing <b>${fmtW(ptP)}</b>` : cut ? '<b>Cut-out tripped!</b> Coil too hot' : `Coil at <b>${Math.round(ptT)} °C</b>, drawing <b>${fmtW(ptP)}</b>`;
        [lStones, lFan].forEach((l) => { l.visible = !isO && stage.host.clientWidth >= 560; }); lPtcState.visible = !isO;
        for (let i = 0; i < NA; i++) {
          const q = aSeed[i], u = (q[0] + t * (0.05 + s.fan * 0.3)) % 1;
          const z = -3 + u * 9, warmK = clamp((z - 0.8) / 1.5, 0, 1) * clamp((ptT - 20) / 200, 0, 1);
          air.place(i, (q[1] - 0.5) * 3.2, 3.6 + (q[2] - 0.5) * 2.6, z, !isO && s.fan > 0.02 ? 1 : 0);
          air.tint(i, tmp.copy(cold).lerp(hot, warmK));
        }
        air.done();
        // Boards
        redraw += dt;
        if (redraw > 0.1) { redraw = 0; (isO ? bOfr : bPtc).redraw(); }
      },
      readout: (s) => {
        if (s.focus === 'ofr') {
          const c = runs[Math.min(runs.length - 1, Math.floor(s.clock))], warm = warmMin(runs);
          const stored = (OFR.C * (c.T - 20)) / 1000;
          return `<div class="big">Oil radiator, ${fmtW(s.power)}</div>
            <div class="row"><span>Oil and fins at</span><b>${Math.round(c.T)} °C</b></div>
            <div class="row"><span>Heat into the room now</span><b>${fmtW(c.out)}</b></div>
            <div class="row"><span>Heat stored in oil + steel</span><b>${Math.round(stored)} kJ</b></div>
            <div class="row"><span>Reaches 90% of full output</span><b>${warm !== null ? warm + ' min' : 'not before 45 min'}</b></div>
            <div class="row"><span>Element</span><b>${s.tip ? 'cut by tip-over switch' : c.on ? 'on' : 'off'}</b></div>
            <small>Thermal mass ${(OFR.C / 1000).toFixed(1)} kJ/K: 9 kg steel + 3.5 kg oil.</small>`;
        }
        const st = s.elem === 'ptc' ? ptcSteady(s.fan) : null;
        const R = s.elem === 'ptc' ? ptcR(ptT) : nichromeR(ptT);
        return `<div class="big">${s.elem === 'ptc' ? 'PTC stones' : 'Plain nichrome coil'}</div>
          <div class="row"><span>Element temperature</span><b>${Math.round(ptT)} °C</b></div>
          <div class="row"><span>Resistance</span><b>${R >= 1000 ? (R / 1000).toFixed(1) + ' kΩ' : R.toFixed(0) + ' Ω'}</b></div>
          <div class="row"><span>Power drawn, V²/R</span><b>${fmtW(ptP)}</b></div>
          ${st ? `<div class="row"><span>Settles at</span><b>${Math.round(st.T)} °C, ${fmtW(st.P)}</b></div>` : `<div class="row"><span>Settles at</span><b>${ptcG(s.fan) > 0 ? Math.round(20 + 1996 / ptcG(s.fan)) + ' °C (or the cut-out trips)' : '—'}</b></div>`}
          <small>PTC switching point ${PTC.Tsw} °C; resistance ×10 every ${PTC.dec} °C above it.</small>`;
      },
    };
  },
};
