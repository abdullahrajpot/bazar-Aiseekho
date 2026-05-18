const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db;
try {
  let serviceAccount;

  // 1. Try to load from the local JSON key copy in backend directory
  const localKeyPath = path.join(__dirname, '../bazar-77f15-firebase-adminsdk-fbsvc-fbcd7d5467 copy.json');
  if (fs.existsSync(localKeyPath)) {
    console.log('[Firebase Admin] Found local service account JSON copy. Loading...');
    serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
  } 
  // 2. Fallback to process.env if available
  else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY && process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY.includes('project_id')) {
    console.log('[Firebase Admin] Loading service account from environment key...');
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
      databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://bazar-77f15-default-rtdb.asia-southeast1.firebasedatabase.app',
    });
    console.log('[Firebase Admin] Initialized database with URL:', process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://bazar-77f15-default-rtdb.asia-southeast1.firebasedatabase.app');
  }

  db = admin.database();
} catch (error) {
  console.error('[Firebase Admin] Initialization error:', error.message);
}

module.exports = { db, admin };
