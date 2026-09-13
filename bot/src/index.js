// חברותא דיגיטלית - נקודת הכניסה
// הפעלה במצב בדיקה מקומי:  node src/index.js --console
// הפעלה מול קבוצת ווצאפ:    node src/index.js   (דרך whatsapp-claude-bridge)
import { handleMessage } from './conversation.js';
import { startScheduler } from './scheduler.js';
import { startConsoleChannel } from './channels/console.js';
import { startBridgeChannel } from './channels/bridge.js';
import { config } from './config.js';

const useConsole = process.argv.includes('--console') || !config.bridge.groupId;

console.log('חברותא דיגיטלית - מתחילים בעז"ה');
if (useConsole && !process.argv.includes('--console')) {
  console.log('(לא הוגדר TALMID_GROUP_ID ב-.env - עוברים למצב בדיקה מקומי)');
}

const send = useConsole
  ? startConsoleChannel(handleMessage)
  : startBridgeChannel(handleMessage);

startScheduler(send);
