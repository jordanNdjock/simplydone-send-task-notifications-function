import fetch from "node-fetch";
const sdk = require("node-appwrite");

const databaseId = "67ac5d080011ce7ff124";
const collectionId = "67ac5d12002d34cea58a";

const shouldNotifyToday = (dateStr) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  const taskDate = new Date(year, month - 1, day);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  taskDate.setHours(0, 0, 0, 0);

  const diff = taskDate.getTime() - now.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);

  return diffDays === 1;
};


export default async ({ req, res, log, error }) => {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new sdk.Databases(client);

  try {
    const result = await db.listDocuments(databaseId, collectionId);
    const tasks = result.documents;

    for (const task of tasks) {
      if (shouldNotifyToday(task.deadline)) {
        await sendNotification(task.userId, task.title);
        log(`✅ Notification envoyée à ${task.userId} pour la tâche « ${task.title} »`);
      }
    }

    res.json({ status: "done" });
  } catch (err) {
    error("❌ Erreur :", err.message);
    res.json({ error: err.message }, { status: 500 });
  }
};

async function sendNotification(userId, taskTitle) {
  const url = "https://onesignal.com/api/v1/notifications";
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.ONESIGNAL_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      headings: { en: "⏰ Rappel de tâche" },
      contents: { en: `Ta tâche « ${taskTitle} » est prévue pour demain !` },
      include_external_user_ids: [userId],
    }),
  };

  const res = await fetch(url, options);
  return res.json();
}
