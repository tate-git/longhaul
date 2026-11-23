// 하늘: 진행에 따라 오후 → 노을 → 해 질 녘 → 밤 · 해·별·안개·빛 세기
import * as THREE from 'three';

const KEYS = [   // p, 하늘 위, 지평선, 안개, 햇빛 색, 햇빛, 주변광, 해 높이(도), 밤
  [0, 0x5d95d6, 0xcfe3f2, 0xc6dcef, 0xffffff, 2.2, 1.3, 35, 0],
  [.3, 0x5a86c8, 0xf6d2a2, 0xe6cfb0, 0xffd9a0, 2.0, 1.1, 16, 0],
  [.5, 0x3a4f8c, 0xff9a5c, 0xd2957a, 0xff9a60, 1.4, .8, 4, .1],
  [.64, 0x1f2a5a, 0x8a5a7a, 0x5a4660, 0xff7050, .5, .5, -3, .5],
  [.8, 0x0a1030, 0x2a2f55, 0x1e2340, 0x7080b0, .25, .3, -12, .9],
  [1, 0x04071a, 0x151b35, 0x10142a, 0x6070a0, .2, .25, -20, 1],
];
const MOON = new THREE.Vector3(-.4, .8, .3).normalize();
const cB = new THREE.Color(), WHITE = new THREE.Color(0xffffff);
const mix = (out, a, b, t) => out.set(a).lerp(cB.set(b), t);   // 매 프레임 새 색을 만들지 않음
export function makeSky(scene) {
  const uni = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0. ? mix(hor, top, pow(min(1., h * 1.6), .7)) : hor * .85;
        float sd = max(0., dot(d, normalize(sunDir)));
        c += sunCol * (pow(sd, 900.) * 3. + pow(sd, 10.) * .3) * smoothstep(-.12, .02, sunDir.y);
        gl_FragColor = vec4(c, 1.); }`,
  }));
  dome.renderOrder = -1; scene.add(dome);
  const sp = [];
  for (let i = 0; i < 1400; i++) { const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * .95); sp.push(Math.sin(v) * Math.cos(u) * 1700, Math.cos(v) * 1700, Math.sin(v) * Math.sin(u) * 1700); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starM = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(sg, starM); stars.renderOrder = -1; scene.add(stars);
  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x4a5a3a, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0xcfe3f2, 80, 900);
  const out = { night: 0 };
  return {
    out, update(p, cam, dim = 0) {   // dim: 터널 안(0~1)
      let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
      const a = KEYS[i], b = KEYS[i + 1], t = Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0])));
      mix(uni.top.value, a[1], b[1], t); mix(uni.hor.value, a[2], b[2], t);
      mix(scene.fog.color, a[3], b[3], t); scene.fog.far = 900 - 420 * (a[8] + (b[8] - a[8]) * t);
      const el = (a[7] + (b[7] - a[7]) * t) * Math.PI / 180;
      uni.sunDir.value.set(.35, Math.sin(el), -Math.cos(el)).normalize(); mix(uni.sunCol.value, a[4], b[4], t);
      sun.color.copy(uni.sunCol.value); sun.intensity = (a[5] + (b[5] - a[5]) * t) * (1 - dim * .85) * (el > -.05 ? 1 : .35);
      hemi.intensity = (a[6] + (b[6] - a[6]) * t) * (1 - dim * .7);
      hemi.color.copy(uni.hor.value).lerp(WHITE, .4);
      out.night = a[8] + (b[8] - a[8]) * t; starM.opacity = Math.max(0, out.night - .3) / .7;
      dome.position.copy(cam.position); stars.position.copy(cam.position);
      sun.position.copy(cam.position).addScaledVector(el > -.05 ? uni.sunDir.value : MOON, 300);   // 해가 지면 달빛 방향 sun.target.position.copy(cam.position);
    },
  };
}
