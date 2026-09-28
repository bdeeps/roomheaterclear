// Chapter 6: use it safely. Two checks you can play with.
// 1. Fabric near a heater. A curtain at distance d gets infrared E (heater.js irradiance; OFR fins at
//    ~75 °C) or, in front of a fan heater, the warm jet (heater.js jetExcess). A thin curtain settles
//    where what it absorbs equals what it loses from both faces:
//    α·E = f·[h·(T − Ta) + ε·σ·(T⁴ − Ta⁴)], α = 0.7, ε = 0.9, h = 4 W/m²K (still air), f = 1.3 faces
//    for a folded curtain, and Ta the air near the heater (20 °C plus up to 40 °C in its warm plume).
//    Touching the guard, it simply reaches the guard's temperature. All rough estimates.
//    Many fabrics soften, char or melt from about 200 °C and can ignite at 250–400 °C (Babrauskas,
//    Ignition Handbook, 2003); a curtain that falls onto a guard or element gets far hotter than this.
// 2. Current. I = P ÷ 230 V. Flexible cord ratings: 0.5 mm² 3 A, 0.75 mm² 6 A, 1.0 mm² 10 A, 1.5 mm²
//    16 A (IS 694 / IEC 60227 cords, typical current ratings as in BS 7671 Table 4F3A). Copper 0.0172
//    Ω·mm²/m. MCB (IS/IEC 60898): no trip at 1.13 × rating for an hour; sure to trip within an hour at
//    1.45 × rating; the magnetic trip (B curve) acts instantly at 3–5 × rating. See MCBClear.
import { THREE, M, box, beam, tube, torus } from '../kit.js';
import { HEATERS, makeHeater, makeRoom, irradiance, jetExcess, SIGMA, K0, V_MAINS, fmtW, fitView, responsive, isPhone, clamp } from '../heater.js';

const VIEW = { pos: [22, 18, 38], target: [-2, 6, -3] };
const KINDS = { rod: 'Rod heater 2 kW', fan: 'Fan heater 2 kW', ofr: 'Oil radiator 2 kW' };
const PLUGS = {
  wall16: { name: '16 A power socket', sock: 16, mcb: 16, cord: 1.5, len: 1.5, circuit: 'power circuit, 16 A MCB' },
  wall6: { name: '6 A socket (lights circuit)', sock: 6, mcb: 6, cord: 1.5, len: 1.5, circuit: 'lighting circuit, 6 A MCB' },
  board: { name: 'Cheap extension board', sock: 6, mcb: 16, cord: 0.5, len: 3, circuit: 'thin 0.5 mm² cord, 6 A board' },
};
const CORD_A = { 0.5: 3, 0.75: 6, 1: 10, 1.5: 16 };
const ALSO = { none: { name: 'Nothing else', W: 0 }, iron: { name: 'Iron, 1 kW', W: 1000 }, geyser: { name: 'Geyser, 2 kW', W: 2000 } };

// Guard/grille temperatures when fabric actually touches: radiant guards run a few hundred °C,
// fan-heater grilles and OFR fins far less (typical measured surface temperatures; estimates).
const TOUCH = { rod: 300, fan: 90, ofr: 75 };
export function curtainT(kind, d) {
  const h = HEATERS[kind];
  if (d <= 0.08) return TOUCH[kind];
  // Air near a heater is warmer than the room: its own convection plume (an estimate, +40 °C at the face).
  if (kind === 'fan') return 20 + jetExcess(d) * 0.9;
  const Ta = 20 + 40 * Math.exp(-d / 0.3);
  const E = irradiance(h, 2000, d, 0.25);
  // A hanging, folded curtain loses heat less freely than a flat sheet: count 1.3 faces, not 2.
  let lo = Ta, hi = 900;
  for (let i = 0; i < 60; i++) { const T = (lo + hi) / 2, loss = 1.3 * (4 * (T - Ta) + 0.9 * SIGMA * ((T + K0) ** 4 - (Ta + K0) ** 4)); if (loss < 0.7 * E) lo = T; else hi = T; }
  return kind === 'ofr' ? Math.min(TOUCH.ofr + 5, (lo + hi) / 2) : (lo + hi) / 2;
}
export function electric(s) {
  const P = PLUGS[s.plug], I = 2000 / V_MAINS, Iall = (2000 + ALSO[s.also].W) / V_MAINS;
  const Rcord = (0.0172 / s.cordMm(P)) * P.len * 2, cordW = I * I * Rcord;
  const mcb = P.mcb, k = Iall / mcb;
  const trip = k >= 3 ? 'trips at once' : k >= 1.45 ? 'will trip within the hour' : k > 1.13 ? 'may trip, after a long time' : k > 1 ? 'over its rating, may never trip' : 'fine';
  return { P, I, Iall, cordW, cordOK: I <= CORD_A[P.cord], sockOK: I <= P.sock, mcb, trip, k };
}
const verdict = (T) => (T < 60 ? ['Safe distance', 'ok'] : T < 120 ? ['Hot: move it further', 'no'] : T < 200 ? ['Scorching: fire risk', 'no'] : ['Danger: can catch fire', 'no']);

export default {
  id: 'safety',
  short: 'Use it safely',
  title: 'Use a heater safely',
  subtitle: 'Distance from fabric, the right socket, fresh air, and a heater that switches itself off.',
  view: VIEW,
  learn: `<p>Most heater accidents are fires, burns and poisoning, and each has a simple rule.</p>
    <p><b>Keep 1 metre clear.</b> Curtains, quilts, sofas, clothes drying on a chair: infrared heats them just as it heats you, and they can't move away. Never dry clothes on a heater or cover it.</p>
    <p><b>Plug it straight into a wall power socket.</b> A 2 kW heater draws <b>8.7 amps</b> for hours. A 6 A socket or a cheap extension board with a thin cord gets hot at the pins and in the wire, and that heat is where many house fires start. Heaters belong on a <b>16 A power socket</b> on a <b>16 A MCB</b> (see MCBClear). Don't run a heater and a geyser on one circuit.</p>
    <p><b>Switch it off when you sleep</b>, or use one with a thermostat and a timer. Never sleep in a closed room with a fire: an <b>angithi, coal or wood</b> needs a window open, and even then it is safer to put it out and take it outside before bed. A <b>CO alarm</b> costs less than a heater.</p>
    <p><b>Children and pets</b> touch things. Choose heaters with a guard, a <b>tip-over switch</b> and a cool-touch body, and keep them out of reach. Buy one with the <b>ISI mark</b>: in India, room heaters must meet <b>IS 302 (Part 2/Sec 30)</b> and be certified by BIS.</p>
    <p class="tip"><b>Try it:</b> slide the curtain towards the heater and watch its temperature. Then plug into the extension board and add a geyser on the same circuit.</p>`,
  terms: [
    { t: 'Clearance', d: 'The empty space to keep around a heater. One metre from anything that can burn is the usual advice.' },
    { t: 'Ampere (A)', d: 'The unit of electric current. Current = power ÷ voltage: 2,000 W ÷ 230 V = 8.7 A.' },
    { t: 'Current rating', d: 'The most current a socket, plug or cord can carry all day without overheating.' },
    { t: 'MCB', d: 'Miniature circuit breaker: a switch in your board that trips when a circuit draws too much current for too long.' },
    { t: 'ISI mark', d: 'The Bureau of Indian Standards’ certification mark, showing a product meets its Indian Standard.' },
    { t: 'Thermal cut-out', d: 'A switch inside the heater that turns it off if it overheats, for example when it is covered.' },
  ],
  defaults: { kind: 'rod', dist: 1.0, plug: 'wall16', also: 'none' },
  controls: [
    { key: 'kind', type: 'seg', label: 'Heater', options: [{ v: 'rod', label: 'Rod heater' }, { v: 'fan', label: 'Fan heater' }, { v: 'ofr', label: 'Oil radiator' }] },
    { key: 'dist', type: 'range', label: 'Curtain distance', min: 0.05, max: 2.0, step: 0.05, ends: ['touching', '2 m'], fmt: (v) => (v <= 0.08 ? 'touching the guard' : v < 1 ? Math.round(v * 100) + ' cm' : v.toFixed(2) + ' m') },
    { key: 'plug', type: 'seg', label: 'Plugged into', options: Object.entries(PLUGS).map(([v, o]) => ({ v, label: o.name })), fmt: (v) => PLUGS[v].circuit },
    { key: 'also', type: 'seg', label: 'Also on the same circuit', options: Object.entries(ALSO).map(([v, o]) => ({ v, label: o.name })) },
  ],
  quiz: [
    { q: 'How far should a heater be from curtains, beds and sofas?', options: ['10 cm', 'About 1 metre', 'It doesn’t matter if it has a guard', 'Touching is fine for oil heaters'], answer: 1, why: 'At a metre, the infrared and hot air reaching fabric are gentle. Close up, a curtain can pass 200 °C and char or catch fire.' },
    { q: 'A 2 kW heater is plugged into a cheap extension board with a thin 0.5 mm² cord. What is the problem?', options: ['None, electricity is electricity', 'The cord is rated for about 3 A but the heater draws 8.7 A, so it overheats', 'The heater will run slower', 'Extension boards make heaters more efficient'], answer: 1, why: 'Heat in a wire grows as I²R. Nearly three times its rated current makes the cord and plug pins hot for hours: a common cause of fires.' },
    { q: 'Why is it dangerous to sleep with an angithi burning in a closed room?', options: ['It uses too much electricity', 'It fills the room with odourless carbon monoxide', 'It makes the room too humid', 'It attracts insects'], answer: 1, why: 'Burning charcoal makes CO, which builds up in a closed room and poisons sleepers without waking them.' },
  ],
  reel: [
    { ms: 5000, caption: 'Keep a heater a metre from curtains: close up, fabric can pass 200 °C.', set: { kind: 'rod', plug: 'wall16', also: 'none' }, anim: { dist: [1.5, 0.15] }, spin: 0.2 },
    { ms: 5000, caption: 'Plug it into a 16 A wall socket, not a thin extension board, and never sleep beside a fire.', set: { kind: 'rod', dist: 1.0, also: 'none' }, anim: { plug: ['wall16', 'board'] }, spin: 0.2 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const room = makeRoom(40, 30, 26, { window: false }); root.add(room);
    const HX = -13, HZ = -4, AX = Math.PI / 2;   // the heater faces +x, towards the curtain
    const heaters = {};
    Object.keys(KINDS).forEach((id) => { const h = makeHeater(id); h.group.position.set(HX, 0, HZ); h.group.rotation.y = AX; root.add(h.group); heaters[id] = h; });
    const isi = stage.label('ISI mark · IS 302-2-30', [HX, 0.6, HZ + 4.2], root);
    // The 1 m clearance ring on the floor.
    const ringMat = M.glow(0x5ce1a9, { transparent: true, opacity: 0.8 });
    const ring = torus(10, 0.12, ringMat, 96); ring.rotation.x = Math.PI / 2; ring.position.set(HX, 0.1, HZ); ring.castShadow = false; root.add(ring);
    const lRing = stage.label('1 m clear', [HX + 3, 0.4, HZ + 10.5], root);
    // A curtain: a wavy hanging sheet, moved along the heater's axis.
    const cg = new THREE.PlaneGeometry(14, 18, 40, 1), pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.6) * 0.45);
    cg.computeVertexNormals();
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x000000 });
    const curtain = new THREE.Mesh(cg, curtainMat); curtain.rotation.y = AX; curtain.castShadow = true; root.add(curtain);
    const rail = beam([0, 0, -7.5], [0, 0, 7.5], 0.15, M.metal(0xb9bec8)); root.add(rail);
    const lCurt = stage.label('', [0, 0, 0], root, 'hot');
    // Wall socket, plug, cord; extension board; distribution board with the MCB.
    const wallZ = -14.8;
    const sock16 = box(1.8, 1.8, 0.25, M.plastic(0xf3f4f6)); sock16.position.set(8, 2.4, wallZ); root.add(sock16);
    const sock6 = box(1.4, 1.4, 0.25, M.plastic(0xf3f4f6)); sock6.position.set(11, 2.4, wallZ); root.add(sock6);
    const ext = new THREE.Group(); ext.position.set(4, 0, -10); root.add(ext);
    const extBody = box(5, 0.7, 1.6, M.plastic(0xf3f4f6)); extBody.position.y = 0.35; ext.add(extBody);
    for (let i = 0; i < 4; i++) { const hole = box(0.5, 0.05, 0.5, M.plastic(0x2a2e37)); hole.position.set(-1.5 + i * 1.1, 0.72, 0); ext.add(hole); }
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x2a2e37, roughness: 0.6, emissive: 0xff3a10, emissiveIntensity: 0 });
    let cord = null;
    const setCord = (pts, r) => { if (cord) { root.remove(cord); cord.geometry.dispose(); } cord = tube(pts, r, cordMat, false, 80); root.add(cord); };
    const db = new THREE.Group(); db.position.set(14, 16, wallZ + 0.4); root.add(db);
    db.add(box(6, 4, 0.6, M.plastic(0xd9dde3)));
    const levers = [];
    for (let i = 0; i < 4; i++) { const m = box(0.9, 2.2, 0.5, M.plastic(0xf3f4f6)); m.position.set(-2.1 + i * 1.3, 0, 0.5); db.add(m); const lv = box(0.35, 0.7, 0.3, M.plastic(0x2a2e37)); lv.position.set(-2.1 + i * 1.3, 0.35, 0.85); db.add(lv); levers.push(lv); }
    const lDB = stage.label('MCBs', [0, 2.8, 0.4], db);
    const lPlug = stage.label('', [0, 0, 0], root);

    let lastKey = '', flip = 0;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [-4, isPhone(stage) ? 12 : 8, -3], [0.45, 0.5, 1], 64) : VIEW));
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt);
        resp();
        Object.entries(heaters).forEach(([id, h]) => { h.group.visible = id === s.kind; });
        const H = heaters[s.kind], spec = HEATERS[s.kind];
        H.set(s.kind === 'ofr' ? 150 : spec.T, 1);
        if (H.setSurface) H.setSurface(75);
        if (H.fan) H.fan.rotation.z += dt * 22;
        const face = H.size.face, d = s.dist * 10;
        curtain.position.set(HX + face + d + 0.4, 9.4, HZ); rail.position.set(HX + face + d + 0.4, 18.5, HZ);
        const T = curtainT(s.kind, s.dist), [vText, vCls] = verdict(T);
        curtainMat.color.set(0xc9a46a).lerp(new THREE.Color(0x4a2a12), clamp((T - 120) / 180, 0, 1));
        curtainMat.emissive.setHex(0xff3a10); curtainMat.emissiveIntensity = clamp((T - 150) / 250, 0, 0.8);
        lCurt.position.set(HX + face + d + 0.4, 14, HZ + 7.5);
        lCurt.element.innerHTML = `Curtain about <b>${Math.round(T)} °C</b>: ${vText}`;
        ringMat.color.set(s.dist < 1 ? 0xff5a5a : 0x5ce1a9);
        lRing.element.textContent = s.dist < 1 ? 'Inside the 1 m zone!' : '1 m clear';
        // Cord route by plug choice.
        const e = electric({ ...s, cordMm: (P) => P.cord });
        const k = s.plug + s.kind;
        if (k !== lastKey) {
          lastKey = k;
          const from = [HX - 0.6, 0.3, HZ - 1.8];
          if (s.plug !== 'board') { const sx = s.plug === 'wall16' ? 8 : 11; setCord([from, [sx - 2, 0.2, wallZ + 1.5], [sx, 0.3, wallZ + 0.6], [sx, 2.2, wallZ + 0.3]], 0.14); }
          if (s.plug === 'board') setCord([from, [HX - 1, 0.2, -10], [-2, 0.3, -10.5], [1.5, 0.35, -10], [6.6, 0.3, -10], [8, 0.3, wallZ + 1], [8, 2.2, wallZ + 0.3]], 0.07);
        }
        cordMat.emissiveIntensity = clamp((e.I / CORD_A[e.P.cord] - 1) * 0.7, 0, 1.4);
        ext.visible = s.plug === 'board';
        lPlug.position.set(s.plug === 'board' ? 4 : s.plug === 'wall16' ? 8 : 11, s.plug === 'board' ? 2.2 : 4.4, s.plug === 'board' ? -10 : wallZ + 0.5);
        lPlug.element.innerHTML = `${e.P.name}: <b>${e.sockOK ? 'OK' : 'overloaded'}</b>`;
        // MCB lever: down (tripped) if the circuit will trip.
        const tripped = e.k >= 1.45;
        flip += ((tripped ? 1 : 0) - flip) * Math.min(1, dt * 4);
        const idx = e.mcb === 6 ? 0 : 2;
        levers.forEach((lv, i) => { lv.position.y = i === idx ? 0.35 - 0.7 * flip : 0.35; lv.material.color.set(i === idx && tripped ? 0xff5a5a : 0x2a2e37); });
        lDB.element.innerHTML = tripped ? `<b>${e.mcb} A MCB trips</b>` : 'MCBs';
      },
      readout: (s) => {
        const T = curtainT(s.kind, s.dist), [vText, vCls] = verdict(T), e = electric({ ...s, cordMm: (P) => P.cord });
        const E = s.kind === 'fan' ? null : irradiance(HEATERS[s.kind], 2000, s.dist);
        return `<div class="big">${KINDS[s.kind]}</div>
          <div class="row"><span>${E !== null ? 'Infrared on the curtain' : 'Warm jet at the curtain'}</span><b>${E !== null ? Math.round(E).toLocaleString('en-IN') + ' W/m²' : '+' + Math.round(jetExcess(s.dist)) + ' °C air'}</b></div>
          <div class="row"><span>Curtain settles at</span><b class="${vCls}">${Math.round(T)} °C · ${vText}</b></div>
          <div class="row"><span>Current, 2,000 W ÷ 230 V</span><b>${e.I.toFixed(1)} A</b></div>
          <div class="row"><span>Socket rating</span><b class="${e.sockOK ? 'ok' : 'no'}">${e.P.sock} A · ${e.sockOK ? 'OK' : 'overloaded'}</b></div>
          <div class="row"><span>Cord (${e.P.cord} mm², rated ${CORD_A[e.P.cord]} A)</span><b class="${e.cordOK ? 'ok' : 'no'}">${e.cordW.toFixed(0)} W of heat in the cord</b></div>
          <div class="row"><span>Circuit: ${e.Iall.toFixed(1)} A on a ${e.mcb} A MCB</span><b class="${e.k <= 1 ? 'ok' : 'no'}">${e.trip}</b></div>
          <small>Estimates for a thin curtain in still air; loose plugs make hot spots far worse.</small>`;
      },
    };
  },
};
