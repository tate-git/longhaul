// 내 트럭: 모양(트랙터 + 트레일러) · 움직임(도로 좌표 s·d·ψ) · 차선 유지 보조 · 크루즈
import * as THREE from 'three';
import { at, pos, yaw, LANES, POI } from './route.js';
import { glowTex, NIGHT } from './world.js';

const lam = c => new THREE.MeshLambertMaterial({ color: c });
const B = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const wheelGeo = new THREE.CylinderGeometry(.52, .52, .4, 14).rotateZ(Math.PI / 2), tireM = lam(0x1e1f22), hubM = lam(0x9aa0a8);
function wheels(g, zs, list) { for (const z of zs) for (const x of [-1.05, 1.05]) { const w = new THREE.Mesh(wheelGeo, tireM); w.position.set(x, .52, z); g.add(w); list.push(w); } }
function trailerTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f8f9fa'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#f76707'; g.fillRect(0, 170, 1024, 26); g.fillStyle = '#1c4f9c'; g.fillRect(0, 200, 1024, 12);
  g.fillStyle = '#343a40'; g.font = 'bold 84px "Apple SD Gothic Neo", sans-serif'; g.textAlign = 'center'; g.fillText('LONG HAUL', 512, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeTruck(scene) {
  const tractor = new THREE.Group(), trailer = new THREE.Group(), spin = [];
  const body = lam(0xf76707), dark = lam(0x2b2f36), glass = new THREE.MeshLambertMaterial({ color: 0x223040, emissive: 0x0a1018 });
  // 트랙터(앞이 -z) — 운전석 · 차대 · 범퍼 · 등
  tractor.add(B(2.5, .5, 6.2, dark, 0, .95, 0), B(2.5, 2.7, 2.4, body, 0, 2.5, -1.8), B(2.4, .9, 2.2, body, 0, 4.2, -1.75), B(2.3, 1.1, .05, glass, 0, 3.05, -3.02), B(2.55, .45, .3, dark, 0, 1.15, -3.1));
  tractor.add(B(.12, 1.2, 1.9, glass, -1.27, 3.1, -1.8), B(.12, 1.2, 1.9, glass, 1.27, 3.1, -1.8));
  const headM = new THREE.MeshBasicMaterial({ color: 0xfff4d6 }), tailM = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  tractor.add(B(.5, .25, .05, headM, -.85, 1.55, -3.03), B(.5, .25, .05, headM, .85, 1.55, -3.03));
  wheels(tractor, [-2.2, 1.4, 2.6], spin);
  // 트레일러(길이 13m, 연결점 기준 뒤로)
  const side = new THREE.MeshLambertMaterial({ map: trailerTex() }), white = lam(0xf1f3f5);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.1, 13), [side, side, white, white, white, white]); box.position.set(0, 2.95, 6.2); box.material[0].map.wrapS = THREE.RepeatWrapping;
  trailer.add(box, B(2.4, .35, 12.6, dark, 0, 1.25, 6.2), B(.5, .2, .05, tailM, -.95, 1.3, 12.72), B(.5, .2, .05, tailM, .95, 1.3, 12.72));
  wheels(trailer, [9.8, 11.1, 12.3], spin);
  // 밤 빛무리(전조등·후미등)
  const glowHead = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowTail = new THREE.SpriteMaterial({ map: glowTex, color: 0xff3030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const x of [-.85, .85]) { const h = new THREE.Sprite(glowHead); h.scale.set(2.2, 2.2, 1); h.position.set(x, 1.55, -3.15); tractor.add(h); const t = new THREE.Sprite(glowTail); t.scale.set(1.3, 1.3, 1); t.position.set(x * 1.1, 1.3, 12.85); trailer.add(t); }
  // 전조등 빛
  const beam = new THREE.SpotLight(0xfff1d0, 0, 140, .42, .5, 1.2); beam.position.set(0, 1.6, -3); beam.target.position.set(0, 0, -40); tractor.add(beam, beam.target);
  scene.add(tractor, trailer);
  return { tractor, trailer, spin, beam, glowHead, glowTail };
}

// 움직임: 가속(무거워서 둔함) · 제동 · 오르막 · 90km/h 속도 제한 · 조향은 빠를수록 둔하게
export const VMAX = 25;   // 90 km/h(대형 화물차 속도제한장치) · 법정 최고는 80(app.js limitAt)
export function newState() { return { s: 40, d: LANES[1], psi: 0, v: 0, steer: 0, cruise: 0, th: null, rail: 0, railCd: 0, hit: 0, roll: 0 }; }
export function step(T, dt, inp, wantLane) {
  const r = at(T.s), k = r.k, g = r.g;
  // 페달
  if (inp.brake) T.cruise = 0;
  let thr = inp.gas ? 1 : 0;
  if (T.cruise && !inp.gas) thr = Math.max(0, Math.min(1, (T.cruise - T.v) * .6));
  let a = thr * 1.25 * (1 - T.v / (VMAX + 1)) - (inp.brake ? 5.5 : 0) - .12 - g * 4.5 - (T.cruise && T.v > T.cruise + .4 ? .8 : 0);
  if (T.auto) a = Math.min(a, -T.auto);   // 앞차·도착 자동 감속
  T.v = Math.max(0, Math.min(VMAX, T.v + a * dt));
  // 조향
  T.steer += (inp.steer - T.steer) * Math.min(1, dt * 5);
  const delta = T.steer * .5 / (1 + T.v / 9);
  let w = T.v * Math.tan(delta) / 4.2;
  if (Math.abs(inp.steer) < .05 && T.v > 1) {   // 차선 유지 보조: 굽은 길 따라가며 가까운 차로 가운데로
    const lane = wantLane ?? LANES.reduce((b, l) => Math.abs(l - T.d) < Math.abs(b - T.d) ? l : b);
    const psiD = Math.max(-.05, Math.min(.05, (lane - T.d) * .05));
    w = k * T.v + (psiD - T.psi) * 1.6;
  } else w += k * T.v * .7;   // 직접 돌릴 때도 굽은 길은 70% 도와줌
  T.psi = Math.max(-.5, Math.min(.5, T.psi + (w - k * T.v) * dt));
  T.s += T.v * Math.cos(T.psi) * dt; T.d += T.v * Math.sin(T.psi) * dt;
  // 가드레일·중앙분리대: 부드럽게 밀어냄
  T.railCd -= dt;
  const lo = 1.6, hi = (T.s > POI.dest - 80 && T.s < POI.dest + 140) ? 8.0 : 8.1;
  if (T.d < lo || T.d > hi) { T.d = Math.max(lo, Math.min(hi, T.d)); T.psi *= -.3; T.v *= .985; if (T.railCd <= 0) { T.rail++; T.railCd = 2; T.hit = .5; } }
  T.hit = Math.max(0, T.hit - dt);
  T.roll += T.v * dt;
}
// 그리기: 트랙터는 도로 위치·방향·경사, 트레일러는 연결점에서 뒤따라 꺾임
const P = new THREE.Vector3(), H = new THREE.Vector3();
export function pose(T, M, dt) {
  const r = at(T.s), th = r.h + T.psi;
  pos(T.s, T.d, P); M.tractor.position.copy(P);
  M.tractor.rotation.set(Math.atan(r.g), yaw(th), 0, 'YXZ');
  if (T.th == null) T.th = th;
  T.th += T.v / 10.5 * Math.sin(th - T.th) * dt;
  H.set(P.x - Math.cos(th) * 1.6, 0, P.z - Math.sin(th) * 1.6);
  const rt = at(T.s - 8);
  M.trailer.position.set(H.x, rt.y + (P.y - r.y), H.z);
  M.trailer.rotation.set(Math.atan(rt.g), yaw(T.th), 0, 'YXZ');
  for (const w of M.spin) w.rotation.x = -T.roll / .52;
  return th;
}
