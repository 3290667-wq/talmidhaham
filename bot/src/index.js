// חברותא דיגיטלית - נקודת הכניסה
// הפעלה במצב בדיקה מקומי:  node src/index.js --console
// הפעלה עם ווצאפ (Green API): node src/index.js
import { handleMessage } from './conversation.js';
import { startScheduler } from './scheduler.js';
import { startConsoleChannel } from './channels/console.js';
import { startGreenApiChannel } from './channels/greenapi.js';
import { config } from './config.js';

const useConsole = process.argv.includes('--console') || !config.greenApi.idInstance;

console.log('חברותא דיגיטלית - מתחילים בעז"ה');
if (useConsole && !process.argv.includes('--console')) {
  console.log('(לא הוגדר חיבור ווצאפ ב-.env - עוברים למצב בדיקה מקומי)');
}

const send = useConsole
  ? startConsoleChannel(handleMessage)
  : startGreenApiChannel(handleMessage);

startScheduler(send);
