// 다른 차: 같은 방향(1차로 빠름 · 2차로 느림, 앞차 따라가기) · 반대 방향(불빛) · 내 근처에서만 돌려 씀
import * as THREE from 'three';
import { at, pos, yaw, LANES, TOTAL } from './route.js';
import { glowTex } from './world.js';

const COLORS = [0xe9ecef, 0x343a40, 0xc92a2a, 0x1971c2, 0x868e96, 0xf1f3f5, 0x2b8a3e, 0xe8590c, 0x495057];
const glassM = new THREE.MeshLambertMaterial({ color: 0x1d2733 }), darkM = new THREE.MeshLambertMaterial({ color: 0x222428 });
const headM = new THREE.MeshBasicMaterial({ color: 0xfff6dc }), tailM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
export const glowHead = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
export const glowTail = new THREE.SpriteMaterial({ map: glowTex, color: 0xff3030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const geos = {};
const bx = (w, h, d) => geos[`${w}|${h}|${d}`] ??= new THREE.BoxGeometry(w, h, d);
function model(big) {
  const g = new THREE.Group(), color = new THREE.MeshLambertMaterial({ color: COLORS[Math.floor(Math.random() * COLORS.length)] });
  const L = big ? 11 : 4.5, W = big ? 2.5 : 1.85, add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); };
  if (big) { add(bx(W, 3, L), color, 0, 2, 0); add(bx(W - .05, 1, .05), glassM, 0, 2.7, -L / 2 - .01); }
  else { add(bx(W, .75, L), color, 0, .7, 0); add(bx(W - .15, .6, L * .5), color, 0, 1.35, .2); add(bx(W - .2, .5, .05), glassM, 0, 1.35, -L * .05); }
  add(bx(W - .1, .3, L - .6), darkM, 0, .25, 0);
  const hy = big ? 1 : .75;
  for (const x of [-W / 2 + .3, W / 2 - .3]) {
    add(bx(.35, .16, .05), headM, x, hy, -L / 2 - .02); add(bx(.35, .16, .05), tailM, x, hy, L / 2 + .02);
    const h = new THREE.Sprite(glowHead); h.scale.set(2, 2, 1); h.position.set(x, hy, -L / 2 - .2); g.add(h);
    const t = new THREE.Sprite(glowTail); t.scale.set(1.1, 1.1, 1); t.position.set(x, hy, L / 2 + .2); g.add(t);
  }
  g.userData.L = L; return g;
}
const P = new THREE.Vector3();
export function makeTraffic(scene, n = 12, m = 12) {
  const cars = [];
  for (let i = 0; i < n + m; i++) { const big = Math.random() < .25, mesh = model(big); scene.add(mesh); cars.push({ mesh, L: mesh.userData.L, dir: i < n ? 1 : -1, s: -9999, d: 0, v: 0, want: 0, big }); }
  return cars;
}
function spawn(c, T, first) {
  if (c.dir > 0) {
    const fast = Math.random() < .5;
    c.d = fast ? LANES[0] : LANES[1]; c.want = (fast ? 26 + Math.random() * 5 : 19 + Math.random() * 3.5) * (c.big ? .9 : 1);
    c.v = c.want;
    c.s = first ? T.s + 80 + Math.random() * 700 : c.want > T.v ? T.s - 250 - Math.random() * 60 : T.s + 650 + Math.random() * 200;
  } else {
    c.d = -LANES[Math.random() < .5 ? 0 : 1]; c.v = c.want = 22 + Math.random() * 6;
    c.s = first ? T.s + Math.random() * 900 : T.s + 700 + Math.random() * 300;
  }
  if (c.s > TOTAL - 50 || c.s < 0) c.s = -9999;
}
export function stepTraffic(cars, T, dt, first = false) {
  for (const c of cars) {
    if (first || c.s < -9000 || (c.dir > 0 ? c.s < T.s - 320 || c.s > T.s + 950 : c.s < T.s - 220)) spawn(c, T, first);
    if (c.s < -9000) { c.mesh.visible = false; continue; }
    if (c.dir > 0) {   // 같은 차로 바로 앞(다른 차·내 트럭) 따라가기
      let gap = 1e9, lead = c.want;
      for (const o of cars) if (o !== c && o.dir > 0 && Math.abs(o.d - c.d) < 2 && o.s > c.s && o.s - c.s < gap) { gap = o.s - c.s - (o.L + c.L) / 2; lead = o.v; }
      if (Math.abs(T.d - c.d) < 2.2 && T.s > c.s) { const g2 = T.s + 3 - 16 - (c.s + c.L / 2); if (g2 < gap) { gap = g2; lead = T.v; } }
      const target = gap < 40 ? Math.min(c.want, lead + (gap - 15) * .15) : c.want;
      c.v += Math.max(-6, Math.min(1.5, (target - c.v) * 1.5)) * dt; c.v = Math.max(0, c.v);
      c.s += c.v * dt;
    } else c.s -= c.v * dt;
    c.mesh.visible = true;
    const r = at(c.s); pos(c.s, c.d, c.mesh.position);
    const th = r.h + (c.dir < 0 ? Math.PI : 0);
    c.mesh.rotation.set(Math.atan(r.g) * c.dir, yaw(th), 0, 'YXZ');
  }
}
