// 도로 한 줄(가운데 = 중앙분리대): 4m마다 위치·방향·굽음·경사 · 길 옆 땅 높이 · 지점(톨게이트·터널·휴게소·다리·도착)
export const STEP = 4, TOTAL = 8000, SCALE = 10;   // 게임 거리 ×10 = 표지판 거리(km)
export const POI = { toll: 1300, tunnel: [2400, 2900], rest: [3800, 4100], bridge: [4780, 5320], dest: 6950 };
export const LANES = [2.0, 5.6];   // 우리 방향 차로 가운데(1차로 · 2차로) · 반대편은 음수
export const EDGE = 9.4;
export const STOPS = [   // 네비·안내에 나오는 지점
  { s: POI.toll, ic: '🎫', ko: '톨게이트', en: 'Toll gate' }, { s: POI.tunnel[0], ic: '⛰️', ko: '행복터널', en: 'Happy Tunnel' },
  { s: POI.rest[0], ic: '☕', ko: '행복 휴게소', en: 'Happy Rest Stop' }, { s: POI.bridge[0], ic: '🌉', ko: '은빛대교', en: 'Silver Bridge' },
  { s: POI.dest, ic: '🏭', ko: '대전 물류센터', en: 'Daejeon Logistics' },
];
export const CAMS = [900, 3450, 5650, 6500];   // 과속 단속 카메라
export const limitAt = s => s > POI.toll - 300 && s < POI.toll + 20 ? 30 : 80;   // 고속도로 화물차(1.5t 초과) 최고 80 · 하이패스 30
export const yaw = h => Math.atan2(-Math.cos(h), -Math.sin(h));   // 앞이 -z 인 모형을 도로 방향 h 로 돌리는 각

const CURVES = [[500, 1050, 1 / 900], [1600, 2200, -1 / 700], [2450, 2850, 1 / 1500], [3050, 3600, -1 / 800], [4250, 4650, 1 / 650], [5500, 6050, -1 / 750], [6150, 6450, 1 / 1200], [7300, 7800, -1 / 900]];
const GRADES = [[200, 800, .02], [1600, 2300, .03], [3000, 3600, -.035], [4200, 4600, -.02], [5500, 6100, .015]];
export function ramp(s, a, b, r = 150) {   // a~b 구간 1, 앞뒤 r 만큼 부드럽게
  if (s <= a - r || s >= b + r) return 0;
  if (s < a) return .5 - .5 * Math.cos(Math.PI * (s - (a - r)) / r);
  if (s > b) return .5 + .5 * Math.cos(Math.PI * (s - b) / r);
  return 1;
}
const N = TOTAL / STEP + 1, X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), H = new Float32Array(N), K = new Float32Array(N), G = new Float32Array(N);
{
  let x = 0, y = 0, z = 0, h = -Math.PI / 2;
  for (let i = 0; i < N; i++) {
    const s = i * STEP, k = CURVES.reduce((a, [p, q, c]) => a + c * ramp(s, p, q), 0), g = GRADES.reduce((a, [p, q, c]) => a + c * ramp(s, p, q, 200), 0);
    X[i] = x; Y[i] = y; Z[i] = z; H[i] = h; K[i] = k; G[i] = g;
    h += k * STEP; x += Math.cos(h) * STEP; z += Math.sin(h) * STEP; y += g * STEP;
  }
}
export const R = { x: 0, y: 0, z: 0, h: 0, k: 0, g: 0 };   // at() 결과(매번 새 객체 만들지 않음)
export function at(s, o = R) {
  const f = Math.max(0, Math.min(N - 1.001, s / STEP)), i = Math.floor(f), t = f - i;
  o.x = X[i] + (X[i + 1] - X[i]) * t; o.y = Y[i] + (Y[i + 1] - Y[i]) * t; o.z = Z[i] + (Z[i + 1] - Z[i]) * t;
  o.h = H[i] + (H[i + 1] - H[i]) * t; o.k = K[i] + (K[i + 1] - K[i]) * t; o.g = G[i] + (G[i + 1] - G[i]) * t;
  return o;
}
// 도로 좌표(s 앞으로, d 오른쪽) → 세계 좌표
export function pos(s, d, out, dy = 0) { const r = at(s); out.x = r.x - Math.sin(r.h) * d; out.z = r.z + Math.cos(r.h) * d; out.y = r.y + dy; return out; }

// 값 잡음(언덕 모양)
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sm = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export const mountain = s => ramp(s, POI.tunnel[0] + 30, POI.tunnel[1] - 30, 260);
export const valley = s => ramp(s, POI.bridge[0] + 20, POI.bridge[1] - 20, 160);
export function groundY(s, off) {   // 길 옆 땅 높이(off = 가운데에서 떨어진 거리, 부호 = 쪽)
  const a = Math.abs(off), base = at(s).y, side = off < 0 ? 77 : 0;
  if (a <= 12) return base - .15 - (a - EDGE) * .12 - valley(s) * 14 * sm((a - 9) / 3);
  const t = sm((a - 12) / 90);
  let y = base - .5 + t * (22 * noise(s * .006 + side, a * .012) + 4) + sm((a - 160) / 140) * 45 * (.5 + noise(s * .003 + side, 3));
  y += mountain(s) * sm((a - 11) / 10) * (55 + 20 * noise(s * .02, a * .02));
  const v = valley(s);
  if (v) y += (base - 14 + Math.max(0, a - 140) * .2 - y) * v;
  return y;
}
