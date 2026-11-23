// 흐름: 첫 화면(트럭 둘러보기) → 운행(톨게이트·터널·휴게소·대교·단속 카메라) → 물류센터 정차 → 운행 일지
import * as THREE from 'three';
import { POI, LANES, CAMS, at, ramp } from './route.js';
import { buildWorld, NIGHT } from './world.js';
import { makeTruck, newState, step, pose } from './truck.js';
import { makeTraffic, stepTraffic, glowHead, glowTail } from './traffic.js';
import { makeSky } from './sky.js';
import { hud, toast, clock } from './hud.js';
import { $, keep, L, tx, touch, TEST } from './common.js';

document.body.classList.toggle('touch', touch);

// ───────── 장면
const renderer = new THREE.WebGLRenderer({ canvas: $('cv'), antialias: !touch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, .3, 4000);
const fit = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 1 ? 75 : 60; cam.updateProjectionMatrix(); };
fit(); addEventListener('resize', fit);
const sky = makeSky(scene);
buildWorld(scene);
const M = makeTruck(scene), cars = makeTraffic(scene);
const tunnelLight = new THREE.PointLight(0xffb066, 0, 40, 1.2); scene.add(tunnelLight);

// ───────── 상태
let T = newState(), state = 'home', view = keep.get('lh-view') === '1' ? 1 : 0, log = null, rested = false, said = {};
const inp = { gas: false, brake: false, steer: 0, keyL: false, keyR: false, touchSteer: 0 };
const setView = v => { state = v; document.body.dataset.view = v; };
if (TEST) window.__lh = { cam: () => cam, M: () => M, T: () => T, set: o => Object.assign(T, o), state: () => state, log: () => log, inp, cars };
const once = (k, f) => { if (!said[k]) { said[k] = true; f(); } };
const kmh = () => Math.round(T.v * 3.6);

// ───────── 운행 중 사건
function roadEvents(dt) {
  const s = T.s, v = kmh(), within = (a, b) => s > a && s < b;   // 구간 안에서만(휴게소 뒤 순간 이동에도 지난 일이 다시 안 뜨게)
  if (within(POI.toll - 260, POI.toll)) once('toll0', () => toast(tx('🎫 톨게이트 · 하이패스는 30km/h 이하로', '🎫 Toll gate · Hi-pass at 30 km/h or less')));
  if (within(POI.toll, POI.toll + 60)) once('toll', () => {
    if (v > 33) { log.toll = v; toast(tx(`삐빅! 하이패스 과속 (${v}km/h)`, `Beep! Too fast for Hi-pass (${v} km/h)`)); }
    else toast(tx('✅ 하이패스 통과 · 띵동', '✅ Hi-pass OK · ding'));
  });
  if (within(POI.tunnel[0] - 10, POI.tunnel[1])) once('tun', () => toast(tx('⛰️ 행복터널 · 전조등 켜짐 · 차로 변경 금지', '⛰️ Happy Tunnel · lights on · no lane changes')));
  if (within(POI.bridge[0], POI.bridge[1])) {
    once('br', () => toast(tx('🌉 은빛대교 · 옆바람 조심', '🌉 Silver Bridge · crosswinds')));
    const t = performance.now(); T.psi += Math.sin(t / 700) * Math.sin(t / 2300) * .012 * dt * T.v / 10;   // 옆바람
  }
  for (const c of CAMS) {   // 단속 카메라: 600m(표지 거리) 앞 안내 · 83km/h 넘게 지나면 찰칵
    if (within(c - 60, c)) once('cam0' + c, () => toast(tx('📸 600m 앞 과속 단속 · 80km/h', '📸 Speed camera in 600 m · 80 km/h')));
    if (within(c, c + 40)) once('cam' + c, () => { if (v > 83) { log.cam++; T.hit = .3; toast(tx(`📸 찰칵! 과속 단속 ${v}km/h`, `📸 Flash! Caught at ${v} km/h`)); } });
  }
  const nearRest = !rested && s > POI.rest[0] - 300 && s < POI.rest[0] + 120;
  $('rest').hidden = !nearRest;
  if (nearRest) once('rest0', () => toast(tx('☕ 휴게소 · 잠깐 쉬어 갈까요?', '☕ Rest stop ahead · take a break?')));
  if (s > POI.dest - 450) once('dest0', () => toast(tx('🏭 물류센터 · 오른쪽 초록 칸에 천천히 멈춰요', '🏭 Logistics center · stop slowly on the green lane'), 4));
  if (T.rail > log.rail) { log.rail = T.rail; toast(tx('🛡️ 가드레일 쿵!', '🛡️ Scraped the guardrail!'), 1.6); }
}
// 다른 차: 앞차에 가까우면 자동 감속 · 옆 차와 겹치면 밀어냄
const TRUCK_FRONT = 3.1, TRUCK_BACK = 14.5;
function trafficEvents(dt) {
  T.auto = 0; log.nearCd -= dt; log.sideCd -= dt;
  for (const c of cars) {
    if (c.dir < 0 || c.s < -9000) continue;
    const dd = Math.abs(c.d - T.d), gap = c.s - c.L / 2 - (T.s + TRUCK_FRONT);
    if (dd < 2.3 && gap > -2 && gap < 6 + T.v * .6 && T.v > c.v) {
      T.auto = gap < 8 ? 6 : 2.5;
      if (gap < 10 && log.nearCd <= 0) { log.near++; log.nearCd = 4; toast(tx('⚠️ 앞차 가까움 · 자동 감속', '⚠️ Too close · auto braking')); }
    }
    if (dd < 2.2 && c.s + c.L / 2 > T.s - TRUCK_BACK && c.s - c.L / 2 < T.s + TRUCK_FRONT) {
      T.d += Math.sign(T.d - c.d || 1) * 3 * dt; T.psi *= .8;
      if (log.sideCd <= 0) { log.side++; log.sideCd = 4; toast(tx('↔️ 옆 차 조심!', '↔️ Watch the car beside you!')); }
    }
  }
}
// 도착: 초록 칸(오른쪽)에 멈추면 끝 · 지나치면 알아서 멈춤
function arrival() {
  if (T.s > POI.dest + 100) T.auto = Math.max(T.auto, 5);
  if (T.s > POI.dest - 70 && T.v < .6) {
    if (T.d > 3.9 || T.s > POI.dest + 100) arrive();
    else once('lane', () => toast(tx('오른쪽 초록 칸으로 붙여 주세요', 'Pull over to the green lane on the right')));
  }
}

// ───────── 카메라: 뒤에서 따라가기(터널 안은 낮게) · 운전석 · 첫 화면은 천천히 둘러보기
const P = new THREE.Vector3(), F = new THREE.Vector3(), camPos = new THREE.Vector3();
let camYaw = null, orbit = 0;
function camera(th, dt, tun) {
  P.copy(M.tractor.position);
  const g = at(T.s).g, ease = k => 1 - Math.exp(-dt * k);
  if (state === 'home') {
    orbit += dt * .12;
    camPos.set(P.x + Math.cos(orbit) * 20, P.y + 5 + Math.sin(orbit * .7) * 2, P.z + Math.sin(orbit) * 20);
    cam.position.lerp(camPos, ease(3)); cam.lookAt(P.x, P.y + 2.5, P.z);
  } else if (view === 0) {
    camYaw = camYaw == null ? th : camYaw + Math.atan2(Math.sin(th - camYaw), Math.cos(th - camYaw)) * Math.min(1, dt * 3);
    F.set(Math.cos(camYaw), 0, Math.sin(camYaw));
    camPos.set(P.x - F.x * 19, P.y + 7 - tun * 2.2 + Math.atan(g) * 6, P.z - F.z * 19);
    cam.position.lerp(camPos, ease(6)); cam.lookAt(P.x + F.x * 12, P.y + 2.6, P.z + F.z * 12);
  } else {
    F.set(Math.cos(th), 0, Math.sin(th));
    cam.position.set(P.x + F.x * 3.3, P.y + 3.1, P.z + F.z * 3.3);   // 앞유리 바로 앞(안쪽이면 유리 뒷면이 화면을 가림)
    cam.lookAt(P.x + F.x * 60, P.y + 3 + g * 60, P.z + F.z * 60);
  }
  if (T.hit > 0) cam.position.y += Math.sin(performance.now() / 25) * T.hit * .3;
}
// 빛: 하늘 · 밤 불빛 · 전조등 · 터널 등
function lighting(tun) {
  sky.update(Math.min(1, T.s / POI.dest), cam, tun);
  const n = sky.out.night, dark = Math.max(n, tun);
  for (const [m, k] of NIGHT) m.opacity = n * k;
  glowHead.opacity = glowTail.opacity = M.glowHead.opacity = M.glowTail.opacity = Math.max(n, tun * .8);
  M.beam.intensity = dark > .15 ? 120 * Math.min(1, dark * 1.5) : 0;
  tunnelLight.intensity = tun * 70; tunnelLight.position.set(P.x, P.y + 6, P.z);
}

// ───────── 반복
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'drive') {
    inp.steer = inp.touchSteer || (inp.keyR - inp.keyL);
    step(T, dt, inp); roadEvents(dt); trafficEvents(dt); arrival();
    log.dist += T.v * dt; log.time += dt;
  }
  stepTraffic(cars, T, state === 'drive' || state === 'home' ? dt : 0);
  const th = pose(T, M, dt), tun = ramp(T.s, POI.tunnel[0], POI.tunnel[1], 20);
  camera(th, dt, tun); lighting(tun);
  if (state === 'drive') hud(T, th, M.tractor.position, rested, dt);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

// ───────── 단계
const card = html => { $('card').innerHTML = html; $('card').hidden = !html; };
function start() {
  T = newState(); log = { cam: 0, rail: 0, near: 0, side: 0, toll: 0, dist: 0, time: 0, nearCd: 0, sideCd: 0 }; said = {}; rested = false; camYaw = null;
  stepTraffic(cars, T, 0, true); setView('drive');
  toast(tx('🚛 출발! 대전 물류센터까지 70km', '🚛 Let\'s roll! 70 km to Daejeon'), 3);
}
function arrive() {
  if (state !== 'drive') return;
  inp.gas = inp.brake = false; setView('done');
  const penalties = (log.cam > 0) + (log.rail > 1) + (log.near > 1) + (log.side > 0) + (log.toll > 0), stars = Math.max(1, 3 - penalties);
  const avg = log.time ? log.dist / log.time * 3.6 : 0, mm = Math.floor(log.time / 60), ss = Math.round(log.time % 60);
  const rows = [
    [tx('🕗 도착 시각', '🕗 Arrival'), clock(T.s, rested)], [tx('⏱️ 운행 시간', '⏱️ Drive time'), tx(`${mm}분 ${ss}초`, `${mm}m ${ss}s`)], [tx('🚀 평균 속도', '🚀 Avg speed'), `${Math.round(avg)} km/h`],
    [tx('🛡️ 가드레일 접촉', '🛡️ Guardrail scrapes'), log.rail], [tx('⚠️ 앞차 근접', '⚠️ Tailgating'), log.near], [tx('↔️ 옆 차 접촉', '↔️ Side contact'), log.side],
    [tx('🎫 하이패스', '🎫 Hi-pass'), log.toll ? tx(`과속 ${log.toll}km/h`, `too fast ${log.toll} km/h`) : tx('정상', 'OK')],
    [tx('📸 과속 단속', '📸 Speed cameras'), log.cam ? tx(`${log.cam}번 찍힘`, `caught ${log.cam}×`) : 0], [tx('☕ 휴게소', '☕ Rest stop'), rested ? tx('들름', 'visited') : tx('안 들름', 'skipped')],
  ];
  card(`<p class="ic">🏁</p><h2>${tx('무사히 도착했어요', 'Delivered safely')}</h2>
    <p>${tx('🥬 신선식품 18t · 대전 물류센터', '🥬 Fresh produce 18 t · Daejeon Logistics')}</p>
    <ul>${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
    <p class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p>${stars === 3 ? tx('완벽한 안전 운행! 오늘도 수고했어요 🌙', 'A perfectly safe run! Great work tonight 🌙') : tx('오늘도 수고했어요 🌙 다음엔 더 부드럽게!', 'Great work tonight 🌙 Smoother next time!')}</p>
    <div class="row"><button id="again" type="button" class="btn big">${tx('🔁 한 번 더', '🔁 Drive again')}</button><button id="toHome" type="button" class="btn ghost">${tx('처음으로', 'Home')}</button></div>`);
  $('again').onclick = () => { card(''); start(); }; $('toHome').onclick = home;
}
function home() { card(''); T = newState(); setView('home'); stepTraffic(cars, T, 0, true); }
function rest() {
  if (rested || state !== 'drive') return;
  setView('rest'); $('fade').classList.add('on'); $('rest').hidden = true;
  setTimeout(() => {
    card(`<p class="ic">☕</p><h2>${tx('행복 휴게소', 'Happy Rest Stop')}</h2><p>${tx('커피 한 잔, 호두과자 한 봉지.<br>15분 쉬고 다시 출발해요.<br><small>화물차는 2시간 운전하면 15분 쉬어 가요</small>', 'A coffee and a bag of walnut cakes.<br>Rest 15 minutes, then back on the road.')}</p><div class="row"><button id="goOn" type="button" class="btn big">${tx('🚛 다시 출발', '🚛 Back on the road')}</button></div>`);
    $('goOn').onclick = () => {
      card(''); rested = true; camYaw = null; Object.assign(T, { s: POI.rest[1] + 60, d: LANES[1], psi: 0, v: 16, th: null });
      stepTraffic(cars, T, 0, true); setView('drive'); $('fade').classList.remove('on'); toast(tx('☕ 개운하다! 다시 출발', '☕ Refreshed! Back on the road'));
    };
  }, 650);
}

// ───────── 조작: 키보드 · 화면 페달 · 폰은 왼쪽을 끌어 핸들
const KEY = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'brake', ArrowLeft: 'keyL', KeyA: 'keyL', ArrowRight: 'keyR', KeyD: 'keyR' };
const press = (k, on) => { inp[k] = on; $(k)?.classList.toggle('on', on); };   // 페달 단추도 눌린 모양
addEventListener('keydown', e => {
  if (state !== 'drive') return;
  if (KEY[e.code]) { press(KEY[e.code], true); e.preventDefault(); }
  else if (e.code === 'KeyC') cruise();
  else if (e.code === 'KeyV') toggleView();
  else if (e.code === 'KeyH' && !$('rest').hidden) rest();
});
addEventListener('keyup', e => KEY[e.code] && press(KEY[e.code], false));
addEventListener('blur', () => { for (const k of ['gas', 'brake', 'keyL', 'keyR']) press(k, false); inp.touchSteer = 0; });
function cruise() {
  T.cruise = T.cruise ? 0 : Math.max(T.v, 50 / 3.6);
  toast(T.cruise ? tx(`🎛️ 크루즈 ${Math.round(T.cruise * 3.6)}km/h · 브레이크로 해제`, `🎛️ Cruise ${Math.round(T.cruise * 3.6)} km/h · brake to cancel`) : tx('크루즈 해제', 'Cruise off'), 1.8);
}
function toggleView() { view = 1 - view; keep.set('lh-view', String(view)); }
let steerId = null, sx = 0;
const cv = $('cv');
cv.addEventListener('pointerdown', e => { if (state !== 'drive' || e.pointerType === 'mouse' || e.clientX > innerWidth * .55) return; steerId = e.pointerId; sx = e.clientX; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (e.pointerId === steerId) inp.touchSteer = Math.max(-1, Math.min(1, (e.clientX - sx) / 90)); });
const endSteer = e => { if (e.pointerId === steerId) { steerId = null; inp.touchSteer = 0; } };
cv.addEventListener('pointerup', endSteer); cv.addEventListener('pointercancel', endSteer);
for (const k of ['gas', 'brake']) {
  const b = $(k), on = v => e => { e.preventDefault(); press(k, v); };
  b.addEventListener('pointerdown', on(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, on(false));
  b.addEventListener('contextmenu', e => e.preventDefault());
}
$('cruise').onclick = cruise; $('view').onclick = toggleView; $('rest').onclick = rest; $('quit').onclick = home; $('start').onclick = start;

// ───────── 글자 · 언어
const keyHint = k => touch ? '' : `<small>${k}</small>`;   // PC는 단축키도 보여 줌
const TEXT = {
  ko: { title: '밤샘 운행', sub: '노을 지는 고속도로, 화물 싣고 대전까지', job: '📋 오늘의 일감', cargo: '🥬 신선식품 18t', route: '서울 물류센터 → 대전 물류센터 · 70km', start: '🚛 출발', rotate: '📱 가로로 돌리면 더 넓게 보여요', cargoShort: '🥬 신선식품 18t', restBtn: '☕ 휴게소 들르기', steerHint: '좌우로 밀기', cruise: `🎛️ 크루즈 ${keyHint('C')}`, brake: `브레이크${keyHint('↓ S')}`, gas: `가속${keyHint('↑ W')}`,
    how: touch ? '왼쪽 화면을 좌우로 밀어 핸들 · 오른쪽 페달<br>손을 떼면 차선 유지 보조가 차로를 따라가요' : '↑ 가속 · ↓ 브레이크 · ←→ 핸들 · C 크루즈 · V 시점<br>손을 떼면 차선 유지 보조가 차로를 따라가요' },
  en: { title: 'Long Haul', sub: 'Sunset highway, a full trailer, all the way to Daejeon', job: '📋 Today\'s job', cargo: '🥬 Fresh produce 18 t', route: 'Seoul Logistics → Daejeon Logistics · 70 km', start: '🚛 Hit the road', rotate: '📱 Turn your phone sideways for a wider view', cargoShort: '🥬 Fresh produce 18 t', restBtn: '☕ Stop at the rest area', steerHint: 'slide to steer', cruise: `🎛️ Cruise ${keyHint('C')}`, brake: `Brake${keyHint('↓ S')}`, gas: `Gas${keyHint('↑ W')}`,
    how: touch ? 'Slide the left side to steer · pedals on the right<br>Let go and lane assist follows the road' : '↑ gas · ↓ brake · ←→ steer · C cruise · V camera<br>Let go and lane assist follows the road' },
};
function applyLang() {
  document.documentElement.lang = L.lang; document.title = TEXT[L.lang].title;
  for (const e of document.querySelectorAll('[data-t]')) e.innerHTML = TEXT[L.lang][e.dataset.t];
  $('langBtn').textContent = tx('🌐 English', '🌐 한국어');
}
$('langBtn').onclick = () => {   // 3D 표지판 글자까지 바꾸려고 다시 읽음(주소의 lang 은 지움)
  keep.set('lh-lang', tx('en', 'ko')); const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u;
};
const portrait = () => { $('rotTip').hidden = !(touch && innerHeight > innerWidth); };
addEventListener('resize', portrait); portrait();
applyLang();
stepTraffic(cars, T, 0, true);
requestAnimationFrame(frame);
