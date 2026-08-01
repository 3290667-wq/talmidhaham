// ערוץ בדיקה מקומי: שיחה עם הבוט בטרמינל, בלי ווצאפ.
import readline from 'node:readline';

export function startConsoleChannel(onMessage) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const send = async (text) => {
    console.log('\n[הבוט]: ' + text + '\n');
  };
  console.log('=== מצב בדיקה מקומי - כתוב הודעה ולחץ Enter (Ctrl+C ליציאה) ===\n');
  const loop = () => {
    rl.question('[אתה]: ', async (line) => {
      await onMessage(line, send);
      loop();
    });
  };
  loop();
  return send;
}
