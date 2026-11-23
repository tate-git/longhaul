// 공용: 요소 찾기 · 저장소 · 언어 · 폰 여부
export const $ = id => document.getElementById(id);
export const keep = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const qs = new URLSearchParams(location.search);
export const TEST = qs.has('test');
export const L = { lang: [qs.get('lang'), keep.get('lh-lang')].find(l => l === 'ko' || l === 'en') ?? (navigator.language?.startsWith('ko') ? 'ko' : 'en') };
export const tx = (ko, en) => L.lang === 'en' ? en : ko;
export const name = o => tx(o.ko, o.en);
export const touch = matchMedia('(pointer: coarse)').matches;
