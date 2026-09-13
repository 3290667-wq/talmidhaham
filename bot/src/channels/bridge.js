// ערוץ ווצאפ דרך whatsapp-claude-bridge (Evolution API).
//
// למה לא webhook ישיר ל-Evolution: ל-instance יש webhook יחיד, והוא כבר תפוס
// ע"י הברידג'. לכן הברידג' מזהה את הקבוצה ומעביר לכאן, ואנחנו שולחים תשובות
// דרך ה-API שלו (/send-text). כך אין התנגשות ואין צורך במספר ווצאפ נוסף.
//
// POST /message  { senderId, senderName, text }  -> 200 מיד (התשובות נשלחות אסינכרונית)
// GET  /health
import http from 'node:http';
import { config } from '../config.js';
import { loadUser } from '../db.js';

const MAX_LEN = 3500; // מרווח ביטחון מתחת למגבלת ההודעה של ווצאפ

async function post(path, body) {
  const res = await fetch(`${config.bridge.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`bridge ${path} failed:`, res.status, await res.text());
  return res.ok;
}

// payload = מחרוזת, או { text, buttons: [{id, text}] }
// הכפתורים נשלחים כשורת פקודות בטקסט, לא כהודעת כפתורים אינטראקטיבית:
// Evolution מאשר הודעות interactiveMessage (201) אבל ווצאפ רגיל לא מציג
// אותן בכלל - התשובה "נשלחת" ואיש לא רואה אותה.
async function sendToGroup(payload) {
  const { groupId } = config.bridge;
  let text = typeof payload === 'string' ? payload : payload.text;
  const buttons = typeof payload === 'string' ? null : payload.buttons;
  if (buttons?.length) {
    text += `\n\n⚡ ${buttons.map((b) => `*${b.id}*`).join(' · ')}`;
  }

  for (let i = 0; i < text.length; i += MAX_LEN) {
    const chunk = text.slice(i, i + MAX_LEN);
    if (!(await post('/send-text', { chatId: groupId, text: chunk }))) return;
  }
}

// בקבוצה כמה אנשים לומדים במקביל - כל תשובה נפתחת בשם הנמען.
function addressed(userId, payload) {
  const name = loadUser(userId).name;
  if (typeof payload === 'string') return name ? `👤 ${name}\n${payload}` : payload;
  return { ...payload, text: name ? `👤 ${name}\n${payload.text}` : payload.text };
}

export function startBridgeChannel(onMessage) {
  const { groupId, port } = config.bridge;
  if (!groupId) throw new Error('חסר TALMID_GROUP_ID בקובץ .env (מזהה הקבוצה בווצאפ)');

  // send(userId, text) - לשימוש ה-scheduler ולתשובות בשיחה
  const send = (userId, text) => sendToGroup(addressed(userId, text));

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, group: groupId }));
      return;
    }
    if (req.method === 'POST' && req.url === '/message') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        // עונים לברידג' מיד; מהלך שלם (בוחן) שולח כמה הודעות בזו אחר זו.
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return;
        }
        const { senderId, senderName, text } = payload || {};
        if (!senderId || !text) return;
        // תיעוד זמן טיפול מקצה לקצה - כדי שאיטיות עתידית תהיה גלויה בלוגים
        const t0 = Date.now();
        console.log(`[MSG] ${senderName || senderId}: "${text.slice(0, 60)}"`);
        onMessage(senderId, senderName, text, (t) => send(senderId, t))
          .then(() => console.log(`[MSG] טופל תוך ${Date.now() - t0}ms`))
          .catch((err) => console.error('handleMessage:', err));
      });
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`מאזין להודעות מהקבוצה ${groupId} דרך הברידג' (פורט ${port})`);
  });

  return send;
}
