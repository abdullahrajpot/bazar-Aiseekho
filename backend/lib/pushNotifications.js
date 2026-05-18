const axios = require('axios');
const { db } = require('./firebase-admin');
const { normalizeAreaKey } = require('./constants');

async function sendAreaPushNotification(area, role, { title, body, type }) {
  if (!db) return;
  try {
    const snap = await db.ref('users').once('value');
    const users = snap.val() || {};
    const areaKey = normalizeAreaKey(area);
    const tokens = [];

    Object.values(users).forEach((user) => {
      if (
        user?.expoPushToken &&
        user?.role === role &&
        (!user.area || normalizeAreaKey(user.area) === areaKey)
      ) {
        tokens.push(user.expoPushToken);
      }
    });

    if (tokens.length === 0) return;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      tokens.map((to) => ({ to, title, body, data: { type } })),
      { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
    );
  } catch (err) {
    console.warn('[Push] sendAreaPushNotification failed:', err.message);
  }
}

module.exports = { sendAreaPushNotification };
