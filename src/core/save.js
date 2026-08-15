// localStorage 래퍼. 어떤 경우에도 throw 하지 않는다.

import { SETTINGS } from '../config.js';

const KEY = 'neonpurge.save';
const VERSION = 1;

const DEFAULT = {
  v: VERSION,
  fragments: 0,
  upgrades: { core: 0, memory: 0, fan: 0, prefetch: 0, backup: 0 },
  best: { time: 0, kills: 0, cleared: false, clearTime: 0 },
  settings: { glow: true, muted: false, shake: 1.0 },
};

let data = clone(DEFAULT);

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === VERSION) {
        data = Object.assign(clone(DEFAULT), parsed);
        data.upgrades = Object.assign(clone(DEFAULT.upgrades), parsed.upgrades);
        data.best = Object.assign(clone(DEFAULT.best), parsed.best);
        data.settings = Object.assign(clone(DEFAULT.settings), parsed.settings);
      }
    }
  } catch {
    data = clone(DEFAULT);   // 손상된 저장은 조용히 버린다
  }
  SETTINGS.glow = data.settings.glow;
  SETTINGS.muted = data.settings.muted;
  SETTINGS.shake = data.settings.shake;
  return data;
}

export function getSave() { return data; }

export function persist() {
  try {
    data.settings.glow = SETTINGS.glow;
    data.settings.muted = SETTINGS.muted;
    data.settings.shake = SETTINGS.shake;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 시크릿 모드 등에서 실패할 수 있다. 게임 진행에는 영향 없음.
  }
}

export function resetSave() {
  data = clone(DEFAULT);
  persist();
  return data;
}
