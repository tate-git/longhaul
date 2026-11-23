// 계기판: 속도·시각·다음 지점·알림 · 네비(진행 방향이 위인 지도·제한 속도·도착 예정)
import { POI, SCALE, STOPS, CAMS, limitAt, at } from './route.js';
import { $, tx, name } from './common.js';

const START = 16 * 60 + 40, SPAN = 230, REST = 15;   // 출발 16:40 · 도착까지 게임 속 230분 · 휴게소 15분
export const kmLeft = s => Math.max(0, (POI.dest - s) * SCALE / 1000);
export const fmtKm = k => k >= 10 ? `${Math.round(k)}km` : k >= 1 ? `${k.toFixed(1)}km` : `${Math.round(k * 20) * 50}m`;
const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
export const clock = (s, rested) => hhmm(START + Math.min(1, s / POI.dest) * SPAN + (rested ? REST : 0));

let toastT = 0;
export function toast(msg, sec = 2.6) { $('toast').textContent = msg; $('toast').classList.add('on'); toastT = sec; }

export function hud(T, th, at0, rested, dt) {
  $('kmh').textContent = Math.round(T.v * 3.6);
  $('cruiseOn').textContent = T.cruise ? `🎛️ ${tx('크루즈', 'Cruise')} ${Math.round(T.cruise * 3.6)}` : '';
  $('clock').textContent = clock(T.s, rested);
  const nx = STOPS.find(p => p.s > T.s - 20), dest = STOPS.at(-1), onlyDest = !nx || nx === dest;   // 남은 지점이 물류센터뿐이면 한 줄만
  $('next').textContent = onlyDest ? `${dest.ic} ${name(dest)} ${fmtKm(kmLeft(T.s))}` : `${nx.ic} ${name(nx)} ${fmtKm(kmLeft(T.s) - kmLeft(nx.s))}`;
  $('dest').textContent = onlyDest ? '' : `${name(dest)} ${fmtKm(kmLeft(T.s))}`;
  $('wheelIc').style.transform = `rotate(${T.steer * 90}deg)`;
  if ((toastT -= dt) <= 0) $('toast').classList.remove('on');
  navi(T, th, at0, rested);
}

const nv = $('naviCv'), g = nv.getContext('2d'), R = {};
const ICONS = [...CAMS.map(s => ({ s, ic: '📸' })), ...STOPS.slice(0, -1), { s: POI.dest, ic: '🏁' }];
const AHEAD = 1400, BEHIND = 400;
function navi(T, th, P0, rested) {
  const k = Math.min(2, devicePixelRatio || 1), W = nv.clientWidth, H = nv.clientHeight;
  if (nv.width !== W * k) { nv.width = W * k; nv.height = H * k; }
  g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = '#1b2742'; g.fillRect(0, 0, W, H);
  const c = Math.cos(th), sn = Math.sin(th), sc = H * .72 / 650, cx = W / 2, cy = H * .78;
  const to = s => { const r = at(s, R), dx = r.x - P0.x, dz = r.z - P0.z; return [cx + (-dx * sn + dz * c) * sc, cy - (dx * c + dz * sn) * sc]; };
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  const path = (s0, s1, color, w) => {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath();
    for (let s = Math.max(0, s0); s <= s1; s += 15) g.lineTo(...to(s));
    g.stroke();
  };
  const end = Math.min(POI.dest, T.s + AHEAD);
  path(T.s - BEHIND, T.s, '#5c677d', 6); path(T.s, end, '#1c7ed6', 9); path(T.s, end, '#74c0fc', 4);   // 지나온 길 · 갈 길
  g.font = '16px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  for (const p of ICONS) if (p.s > T.s - 100 && p.s < T.s + AHEAD) { const [x, y] = to(p.s); g.fillText(p.ic, x, y - 2); }
  g.fillStyle = '#ff922b'; g.strokeStyle = '#fff'; g.lineWidth = 2;   // 내 위치 화살표
  g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx + 8, cy + 8); g.lineTo(cx, cy + 4); g.lineTo(cx - 8, cy + 8); g.closePath(); g.fill(); g.stroke();
  const lim = limitAt(T.s);
  $('limit').textContent = lim; $('limit').classList.toggle('over', T.v * 3.6 > lim + 3);
  $('eta').textContent = `${tx('도착', 'ETA')} ${clock(POI.dest, rested)} · ${fmtKm(kmLeft(T.s))}`;
}
