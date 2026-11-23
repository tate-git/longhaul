// 풍경 만들기: 도로·차선·중앙분리대·가드레일·땅·나무·터널·다리·톨게이트·휴게소·표지판·물류센터
import * as THREE from 'three';
import { STEP, TOTAL, POI, EDGE, SCALE, at, pos, yaw, groundY, noise, valley } from './route.js';
import { tx } from './common.js';

const V = new THREE.Vector3();
const lambert = (color, o = {}) => new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...o });
export const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
export const NIGHT = [];   // 밤에만 켜지는 재질(투명도 = 밤 정도)

// 길 따라 쓸어 만드는 띠: cross(s) = [[off, dy], …] 가로 단면
function sweep(s0, s1, cross, color = null, step = STEP) {
  const rows = [], pts = [], cols = [], idx = [];
  for (let s = s0; s <= s1 + .001; s += step) rows.push(Math.min(s, s1));
  let m = 0;
  rows.forEach((s, i) => {
    const cs = typeof cross === 'function' ? cross(s) : cross; m = cs.length;
    for (const [off, dy, yAbs] of cs) {
      pos(s, off, V, dy); if (yAbs != null) V.y = yAbs;
      pts.push(V.x, V.y, V.z);
      if (color) { const c = color(s, off, V.y); cols.push(c.r, c.g, c.b); }
    }
    if (i) for (let j = 0; j < m - 1; j++) { const a = (i - 1) * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, b, c, b, d, c); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  if (color) geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
const merge = geos => {   // 같은 재질 띠들을 하나로
  const pts = [], nor = [], idx = []; let base = 0;
  for (const g of geos) { pts.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); idx.push(...g.index.array.map(i => i + base)); base += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx); return geo;
};
const inTunnel = s => s > POI.tunnel[0] && s < POI.tunnel[1];

// 상자 하나를 도로 좌표에 세우기
function place(obj, s, off, dy = 0, turn = 0) { pos(s, off, obj.position, dy); obj.rotation.y = yaw(at(s).h) + turn; return obj; }
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); return m; }
function signTex(lines, { bg = '#1b6e3a', w = 512, h = 256, fg = '#fff' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => { const fs = lines.length === 1 ? h * .5 : i ? h * .2 : h * .26; g.font = `bold ${fs}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; g.fillText(t, w / 2, h * (lines.length === 1 ? .5 : .33 + i * .36)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildWorld(scene) {
  // 도로(아스팔트) · 옆 벽(다리·높은 곳 가림)
  scene.add(new THREE.Mesh(sweep(0, TOTAL, [[-EDGE, 0], [EDGE, 0]]), lambert(0x44484f)));
  scene.add(new THREE.Mesh(merge([sweep(0, TOTAL, [[EDGE, 0], [EDGE, -1.6]]), sweep(0, TOTAL, [[-EDGE, 0], [-EDGE, -1.6]])]), lambert(0x6c6f75)));
  // 차선: 흰 점선(8m 칠·12m 빔, 터널 안은 실선) · 중앙 쪽 노란 실선 · 바깥 흰 실선
  const white = [], yellow = [];
  const line = (arr, off, w, s0, s1) => arr.push(sweep(s0, s1, [[off - w / 2, .03], [off + w / 2, .03]], null, 2));
  for (const sg of [1, -1]) {
    yellow.push(sweep(0, TOTAL, [[sg * .75 - .08, .03], [sg * .75 + .08, .03]]));
    white.push(sweep(0, TOTAL, [[sg * 7.5 - .1, .03], [sg * 7.5 + .1, .03]]));
    for (let s = 0; s < TOTAL; s += 20) { if (inTunnel(s)) continue; line(white, sg * 3.8, .16, s, s + 8); }
    line(white, sg * 3.8, .16, POI.tunnel[0], POI.tunnel[1]);
  }
  scene.add(new THREE.Mesh(merge(white), lambert(0xf1f3f5, { emissive: 0x2a2a2a, polygonOffset: true, polygonOffsetFactor: -2 })));
  scene.add(new THREE.Mesh(merge(yellow), lambert(0xf2c230, { emissive: 0x2a2000, polygonOffset: true, polygonOffsetFactor: -2 })));
  // 중앙분리대(콘크리트)
  scene.add(new THREE.Mesh(sweep(0, TOTAL, [[-.35, 0], [-.2, .9], [.2, .9], [.35, 0]]), lambert(0xb9b8ae)));
  // 가드레일(터널 안·휴게소 앞은 없음)
  const rails = [], postM = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .8, .12), lambert(0x9aa0a8), 4200); let pc = 0;
  const M4 = new THREE.Matrix4();
  for (const sg of [1, -1]) {
    let run = null;
    for (let s = 0; s <= TOTAL; s += STEP) {
      const gap = inTunnel(s) || (sg > 0 && s > POI.rest[0] - 40 && s < POI.rest[1] + 40);
      if (!gap && run == null) run = s;
      if ((gap || s >= TOTAL) && run != null) { rails.push(sweep(run, s, [[sg * 9.3, .45], [sg * 9.3, .8]])); run = null; }
      if (!gap && s % 4 === 0 && pc < 4200) { pos(s, sg * 9.35, V, .4); postM.setMatrixAt(pc++, M4.makeTranslation(V.x, V.y, V.z)); }
    }
  }
  postM.count = pc; scene.add(postM);
  scene.add(new THREE.Mesh(merge(rails), lambert(0xc9ced6)));

  // 땅: 양쪽 띠, 높이·색은 잡음 · 멀리는 산
  const OFF = [9.2, 12, 16, 22, 30, 42, 58, 80, 110, 150, 200, 260, 330];
  const C = new THREE.Color(), grass = new THREE.Color(0x6f9a4a), dark = new THREE.Color(0x3f6b35), rock = new THREE.Color(0x8a8270), sand = new THREE.Color(0xb9a77a);
  const tint = (s, off, y) => {
    const n = noise(s * .02, off * .03), base = at(s).y;
    C.copy(grass).lerp(dark, n * .8);
    if (y - base > 40) C.lerp(rock, Math.min(1, (y - base - 40) / 40));
    if (valley(s) > .3 && y < base - 9) C.lerp(sand, .7);
    return C;
  };
  for (const sg of [1, -1]) {
    const cross = s => (sg > 0 ? OFF : [...OFF].reverse()).map(a => [sg * a, 0, groundY(s, sg * a)]);
    scene.add(new THREE.Mesh(sweep(-200, TOTAL, cross, tint, 8), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  // 나무(원뿔) · 마을 불빛(밤)
  const TREES = 2600, tree = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 6).translate(0, 3.5, 0), lambert(0x2f5d34), TREES), Q = new THREE.Object3D();
  let tc = 0;
  for (let i = 0; i < TREES * 3 && tc < TREES; i++) {
    const s = Math.random() * TOTAL, sg = Math.random() < .5 ? -1 : 1, a = 15 + Math.pow(Math.random(), 1.6) * 230, off = sg * a;
    if (valley(s) > .1 || noise(s * .01, a * .02 + sg) < .38 || (s < 260 && a < 40)) continue;   // 출발점 근처는 비움(첫 화면 둘러보기)
    pos(s, off, Q.position); Q.position.y = groundY(s, off) - .3; const k = .6 + Math.random() * .9; Q.scale.set(k, k * (.8 + Math.random() * .6), k); Q.updateMatrix(); tree.setMatrixAt(tc++, Q.matrix);
  }
  tree.count = tc; scene.add(tree);
  const city = [];
  for (const [c, n] of [[900, 120], [3300, 90], [5900, 160], [7000, 140]]) for (let i = 0; i < n; i++) {
    const s = c + (Math.random() - .5) * 600, off = (Math.random() < .5 ? -1 : 1) * (60 + Math.random() * 220);
    pos(s, off, V); city.push(V.x, groundY(s, off) + 1 + Math.random() * 6, V.z);
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(city, 3));
  const cm = new THREE.PointsMaterial({ color: 0xffd08a, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }); NIGHT.push([cm, 1]);
  scene.add(new THREE.Points(cg, cm));
  // 아주 먼 바닥
  const far = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3f5f3a })); far.position.y = -40; scene.add(far);

  // 터널: 벽·천장·주황 등 · 입구 틀 · 위 덮개
  const [t0, t1] = POI.tunnel;
  scene.add(new THREE.Mesh(sweep(t0, t1, [[-9.4, 0], [-9.4, 7.2], [9.4, 7.2], [9.4, 0]]), lambert(0x6b6d70)));
  scene.add(new THREE.Mesh(sweep(t0 - 2, t1 + 2, [[-16, 7.3], [16, 7.3]]), lambert(0x4f6b3c)));
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffb347 }), lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .12, 1.6), lampM, 400); let lc = 0;
  for (let s = t0 + 6; s < t1; s += 12) for (const o of [-5, 5]) { pos(s, o, Q.position, 7.05); Q.rotation.set(0, yaw(at(s).h), 0); Q.scale.set(1, 1, 1); Q.updateMatrix(); lamps.setMatrixAt(lc++, Q.matrix); }
  lamps.count = lc; scene.add(lamps);
  const portal = lambert(0xa3a39a);
  for (const s of [t0, t1]) {
    const g = new THREE.Group(); place(g, s, 0);
    g.add(box(6, 14, 2, portal).translateX(-13).translateY(5), box(6, 14, 2, portal).translateX(13).translateY(5), box(32, 5, 2, portal).translateY(9.7));
    scene.add(g);
  }
  // 다리: 물 · 교각
  const [b0, b1] = POI.bridge, mid = (b0 + b1) / 2, water = new THREE.Mesh(new THREE.PlaneGeometry(900, 700).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x3d6f8f, shininess: 80, specular: 0x88aacc }));
  place(water, mid, 0, -11); water.position.y = at(mid).y - 11; scene.add(water);
  const pier = new THREE.InstancedMesh(new THREE.CylinderGeometry(.9, 1.1, 14, 10).translate(0, -7, 0), lambert(0xa8a69c), 200); let pi = 0;
  for (let s = b0 + 20; s < b1; s += 40) for (const o of [-5, 5]) { pos(s, o, Q.position, -.5); Q.rotation.set(0, 0, 0); Q.updateMatrix(); pier.setMatrixAt(pi++, Q.matrix); }
  pier.count = pi; scene.add(pier);

  // 톨게이트(하이패스) — 우리 쪽·반대쪽 지붕과 기둥
  const roofM = lambert(0x2f6fb5), postC = lambert(0xdfe3e8);
  {
    const g = new THREE.Group(); place(g, POI.toll, 0);
    g.add(box(22, 1.4, 8, roofM).translateY(7.2));
    for (const x of [-9.8, -.0, 9.8]) g.add(box(.8, 7, .8, postC).translateX(x).translateY(3.5));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ map: signTex([tx('하이패스 30km/h', 'Hi-pass 30 km/h')], { bg: '#1c4f9c', h: 128, w: 1024 }), side: THREE.DoubleSide }));
    sign.position.set(4.6, 7.2, 4.05); g.add(sign);   // 다가오는 쪽(+z)을 봄
    const s2 = sign.clone(); s2.position.set(-4.6, 7.2, -4.05); s2.rotation.y = Math.PI; g.add(s2);
    scene.add(g);
  }
  // 휴게소: 주차장·건물·간판·가로등
  {
    const [r0, r1] = POI.rest;
    scene.add(new THREE.Mesh(sweep(r0 - 40, r1 + 40, s => { const w = 9.4 + 45 * Math.min(1, Math.min(s - (r0 - 40), r1 + 40 - s) / 60); return [[9.4, -.02], [w, -.02]]; }), lambert(0x585c63)));
    const mid = (r0 + r1) / 2, g = new THREE.Group(); place(g, mid, 44);
    g.add(box(60, 7, 18, lambert(0xefe6d6)).translateY(3.5), box(64, 1, 22, lambert(0xb5523b)).translateY(7.5));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTex([tx('☕ 행복 휴게소', '☕ Happy Rest Stop')], { bg: '#ffffff', fg: '#b5523b', h: 128, w: 512 }), side: THREE.DoubleSide }));
    sign.position.set(0, 10, 0); g.add(sign);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(.4, 3, .4), postC); pole.position.set(0, 7.6, 0); g.add(pole);
    scene.add(g);
    for (let s = r0 - 20; s < r1 + 20; s += 40) lamp(scene, s, 11);
  }
  // 물류센터(도착): 오른쪽 큰 창고 · 하차 지점 표시
  {
    const g = new THREE.Group(); place(g, POI.dest + 60, 70);
    g.add(box(120, 16, 50, lambert(0xd8dde3)).translateY(8), box(124, 1.5, 54, lambert(0x5c6b7a)).translateY(16.5));
    for (let i = 0; i < 8; i++) g.add(box(6, 6, .4, lambert(0x495057)).translateX(-49 + i * 14).translateY(3).translateZ(25.1));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), new THREE.MeshBasicMaterial({ map: signTex([tx('대전 물류센터', 'Daejeon Logistics Center')], { bg: '#f76707', h: 128, w: 1024 }), side: THREE.DoubleSide }));
    sign.position.set(0, 13, 25.3); g.add(sign);
    g.rotation.y -= Math.PI / 2; scene.add(g);   // 문이 도로 쪽
    scene.add(new THREE.Mesh(sweep(POI.dest - 70, POI.dest + 130, [[3.9, .04], [9.2, .04]]), lambert(0x2f9e44, { transparent: true, opacity: .55, polygonOffset: true, polygonOffsetFactor: -3 })));
    for (let s = POI.dest - 60; s < POI.dest + 140; s += 40) lamp(scene, s, 10.5);
  }
  // 초록 표지판: 남은 거리 · 다음 지점
  const dest = tx('대전', 'Daejeon'), km = s => Math.round((POI.dest - s) * SCALE / 1000);
  const signs = [
    [300, [tx('대전 물류센터', 'Daejeon Logistics'), `${km(300)} km`]],
    [POI.toll - 200, [tx('톨게이트', 'Toll gate'), '2 km']],
    [POI.tunnel[0] - 300, [tx('행복터널', 'Happy Tunnel'), tx('500m · 전조등 켜기', '500 m · lights on')]],
    [3300, [tx('행복 휴게소', 'Happy Rest Stop'), '5 km']],
    [POI.bridge[0] - 250, [tx('은빛대교', 'Silver Bridge'), `${dest} ${km(POI.bridge[0] - 250)} km`]],
    [5800, [dest, `${km(5800)} km`]],
    [POI.dest - 400, [tx('대전 물류센터', 'Daejeon Logistics'), tx('4 km · 오른쪽 정차', '4 km · stop on right')]],
  ];
  for (const [s, lines] of signs) {
    const g = new THREE.Group(); place(g, s, 0);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), new THREE.MeshBasicMaterial({ map: signTex(lines), color: 0xdddddd }));
    board.position.set(4.6, 7.2, .2); g.add(board);   // 판은 다가오는 쪽(+z)을 봄
    g.add(box(.35, 9, .35, postC).translateX(9.8).translateY(4.5), box(8.5, .3, .3, postC).translateX(5.6).translateY(8.9));
    scene.add(g);
  }
}
// 가로등: 기둥 + 등 + 밤 빛무리
const lampPost = lambert(0x868e96), bulb = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
const haloM = new THREE.SpriteMaterial({ map: glowTex, color: 0xffd28a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); NIGHT.push([haloM, .9]);
function lamp(scene, s, off) {
  const g = new THREE.Group(); place(g, s, off);
  g.add(box(.25, 10, .25, lampPost).translateY(5), box(2.4, .2, .3, lampPost).translateY(10).translateX(1.1), box(.9, .2, .5, bulb).translateY(9.85).translateX(2.1));
  const h = new THREE.Sprite(haloM); h.scale.set(9, 9, 1); h.position.set(2.1, 9.6, 0); g.add(h);
  scene.add(g);
}
