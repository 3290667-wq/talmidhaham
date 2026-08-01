// ערוץ ווצאפ דרך Green API: משיכת הודעות נכנסות ושליחת תשובות.
// מגיב אך ורק למספר הטלפון שהוגדר ב-.env (בוט אישי).
import { config } from '../config.js';

const base = () =>
  `https://api.green-api.com/waInstance${config.greenApi.idInstance}`;

export function chatId() {
  return `${config.greenApi.userPhone}@c.us`;
}

export async function sendWhatsApp(text) {
  const res = await fetch(`${base()}/sendMessage/${config.greenApi.apiToken}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatId: chatId(), message: text }),
  });
  if (!res.ok) console.error('greenapi send failed:', res.status, await res.text());
}

export function startGreenApiChannel(onMessage) {
  const { idInstance, apiToken, userPhone } = config.greenApi;
  if (!idInstance || !apiToken || !userPhone) {
    throw new Error('חסרות הגדרות Green API בקובץ .env (ראה README)');
  }
  console.log('מאזין להודעות ווצאפ דרך Green API...');

  const poll = async () => {
    try {
      const res = await fetch(`${base()}/receiveNotification/${apiToken}?receiveTimeout=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const note = await res.json();
      if (note) {
        const { receiptId, body } = note;
        try {
          if (body?.typeWebhook === 'incomingMessageReceived' && body.senderData?.chatId === chatId()) {
            const md = body.messageData || {};
            const text =
              md.textMessageData?.textMessage ||
              md.extendedTextMessageData?.text || '';
            if (text) await onMessage(text, sendWhatsApp);
          }
        } finally {
          await fetch(`${base()}/deleteNotification/${apiToken}/${receiptId}`, { method: 'DELETE' });
        }
      }
    } catch (err) {
      console.error('greenapi poll:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
    setImmediate(poll);
  };
  poll();
  return sendWhatsApp;
}
