import fetch from "node-fetch";
import * as sdk from "node-appwrite";


function parseDate(dateStr) {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function daysDiffFromToday(dateStr) {
  if (!dateStr) return null;
  const date = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

async function sendNotification(userId, title, message) {
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
      headings: { en: title },
      contents: { en: message },
      include_external_user_ids: [userId],
    }),
  };

  const res = await fetch(url, options);
  return res.json();
}

export default async ({ req, res, log, error }) => {
  log("🚀 Début d'exécution de la fonction CRON");
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)

  const database = new sdk.Databases(client);
  const databaseId = "67ac5d080011ce7ff124";
  const collectionId = "67ac5d12002d34cea58a";

  try {
    log("🚀 Début d'exécution de la fonction CRON avec les tâches");
    const result = await database.listDocuments(databaseId, collectionId);
    const tasks = result.documents;

    for (const task of tasks) {
      const { user_id, title, start_date, end_date } = task;

      if (!user_id || !title) continue;

      const isSameDate = start_date && end_date && start_date === end_date;

      const startDiff = daysDiffFromToday(start_date);
      if (startDiff === 1) {
        await sendNotification(
          user_id,
          "📅 Tâche à venir",
          `Ta tâche « ${title} » commence demain ! Prépare-toi.`
        );
        log(`🔔 Pré-notif start pour ${title}`);
      } else if (startDiff === 0) {
        await sendNotification(
          user_id,
          "⏰ Tâche à faire aujourd’hui",
          `C’est aujourd’hui le début de ta tâche « ${title} ». À toi de jouer !`
        );
        log(`🔔 Jour-J start pour ${title}`);
      }

      const endDiff = daysDiffFromToday(end_date);
      if (endDiff === 0 && !isSameDate) {
        await sendNotification(
          user_id,
          "📌 Tâche à terminer aujourd’hui",
          `Aujourd’hui est le dernier jour pour la tâche « ${title} ». Termine-la !`
        );
        log(`🔔 Jour-J fin pour ${title}`);
      } else if (endDiff === -1) {
        await sendNotification(
          user_id,
          "✅ Tâche passée",
          `La tâche « ${title} » est passée hier. Pense à vérifier son statut ou à la clôturer.`
        );
        log(`🔔 Post-notif fin pour ${title}`);
      }
    }

    res.json({ status: "done", total: tasks.length,  });
  } catch (err) {
    error("❌ Erreur Appwrite :", err.message);
    res.json({ error: err.message }, { status: 500 });
  }
};
