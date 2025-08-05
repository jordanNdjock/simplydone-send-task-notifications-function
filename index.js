import fetch from "node-fetch";
import * as sdk from "node-appwrite";


function parseDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}



function daysDiffFromToday(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diff = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}


async function sendNotification(userId, title, message, log) {
  log(`🔔 Envoi de la notification à l'utilisateur ${userId} : ${title} - ${message}`);
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
      web_push_topic : `${userId}-${title}-${Date.now()}`,
    }),
  };

  const res = await fetch(url, options);
  log(`retour de la requête sendNotification :`, res.status, res.statusText);
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
  log(`Nombre de tâches récupérées : ${tasks.length}`);

  for (const task of tasks) {
    log("🚀 Début de la tâche");
    const { user_id, title, start_date, end_date } = task;

    if (!user_id || !title) continue;

    if (!start_date || !end_date) {
      continue;
    }

    const isSameDate = start_date === end_date;

    const startDiff = daysDiffFromToday(start_date, log);
    if (startDiff === null) {
      continue;
    }
    log(`start_date pour la tâche « ${title} » :`, start_date);
    log(`Différence de jours pour début de la tâche « ${title} » : ${startDiff}`);

    if (startDiff === 1) {
      log(`startDiff === 1`);
      await sendNotification(
        user_id,
        "📅 Tâche à venir",
        `Votre tâche « ${title} » commence demain ! Préparez-vous.`,
        log
      );
      log(`🔔 Pré-notif start pour ${title}`);
    } else if (startDiff === 0) {
      log(`startDiff === 0`);
      await sendNotification(
        user_id,
        "⏰ Tâche à faire aujourd’hui",
        `C’est aujourd’hui le début de votre tâche « ${title} ». À vous de jouer !`,
        log
      );
      log(`🔔 Jour-J start pour ${title}`);
    }

    const endDiff = daysDiffFromToday(end_date, log);
    if (endDiff === null) {
      continue;
    }
    if(endDiff < -1) {
      log(`endDiff < -1, la tâche « ${title} » est déjà passée et ignorée.`);
      continue;
    }
    log(`end_date pour la tâche « ${title} » :`, start_date);
    log(`Différence de jours pour fin de la tâche « ${title} » : ${endDiff}`);

    if (endDiff === 0 && !isSameDate) {
      log(`endDiff === 0`);
      await sendNotification(
        user_id,
        "📌 Tâche à terminer aujourd’hui",
        `Aujourd’hui est le dernier jour pour la tâche « ${title} ». Terminez-la !`, 
        log
      );
      log(`🔔 Jour-J fin pour ${title}`);
    } else if (endDiff === -1) {
      log(`endDiff === -1`);
      await sendNotification(
        user_id,
        "✅ Tâche passée",
        `La tâche « ${title} » est passée hier. Pensez à vérifier son statut ou à la clôturer.`,
        log
      );
      log(`🔔 Post-notif fin pour ${title}`);
    }

    if (startDiff < 0 && endDiff > 0) {
      await sendNotification(
        user_id,
        "🕒 Tâche en cours",
        `La tâche « ${title} » est toujours en cours. Il vous reste ${endDiff} jour${endDiff > 1 ? 's' : ''} pour la clôturer. Courage 🔥💪`,
        log
      );
      log(`🔔 Notif quotidienne pour tâche en cours : ${title}`);
    }
  }

  return res.json({ status: "done", total: tasks.length });
} catch (err) {
  error("❌ Erreur Appwrite :", err.message);
  return res.json({ error: err.message }, { status: 500 });
}

};




