import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const DATA_DIR = join(ROOT, 'data');

// טעינת קובץ .env בלי תלות בחבילה חיצונית
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

export const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
  greenApi: {
    idInstance: process.env.GREENAPI_ID_INSTANCE || '',
    apiToken: process.env.GREENAPI_API_TOKEN || '',
    userPhone: process.env.USER_PHONE || '',
  },
};
