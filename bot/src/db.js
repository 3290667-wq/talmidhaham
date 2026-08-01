import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.js';

const STORE_PATH = join(DATA_DIR, 'store.json');

const EMPTY = {
  user: null, // { onboarded, tracks:[{type, book, bookHe, pace, index, total}], sendHour, skipShabbat }
  state: { mode: 'idle' }, // onboarding / quiz / review / idle
  units: {}, // ref -> { refHe, learnedAt, questions:[{q,ideal}], reviews, intervalIdx, nextReview, scores:[] }
  daily: null, // { date, sentMorning, sentEvening, assignments:[{track, refs:[{ref,refHe}]}], completedTracks:[] }
  stats: { streak: 0, lastCompleted: null, totalLearned: 0 },
};

let store = null;

export function load() {
  if (store) return store;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(STORE_PATH)) {
    try {
      store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    } catch {
      store = structuredClone(EMPTY);
    }
  } else {
    store = structuredClone(EMPTY);
  }
  return store;
}

export function save() {
  if (!store) return;
  const tmp = STORE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, STORE_PATH);
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
