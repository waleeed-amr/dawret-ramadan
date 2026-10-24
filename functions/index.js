const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const crypto = require('node:crypto');

initializeApp();
const db = getFirestore();
const adminPassword = defineSecret('ADMIN_PASSWORD');
const topic = 'tournament_updates';
const requireAdmin = request => {
  if (!request.auth?.token?.admin) throw new HttpsError('permission-denied', 'Administrator access required.');
};

exports.claimAdminAccess = onCall({ secrets: [adminPassword], maxInstances: 3 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const supplied = String(request.data?.password || '');
  const expected = adminPassword.value();
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpsError('permission-denied', 'Invalid administrator password.');
  }
  await getAuth().setCustomUserClaims(request.auth.uid, { admin: true });
  return { ok: true };
});


exports.recordUniqueVisit = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const visitorRef = db.collection('visitorSessions').doc(request.auth.uid);
  const statsRef = db.collection('statistics').doc('general');
  const counted = await db.runTransaction(async tx => {
    const existing = await tx.get(visitorRef);
    if (existing.exists) return false;
    tx.create(visitorRef, { createdAt: FieldValue.serverTimestamp() });
    tx.set(statsRef, { visits: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  return { counted };
});

exports.registerPushToken = onCall({ maxInstances: 10 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to register this device.');
  const token = String(request.data?.token || '');
  const platform = request.data?.platform === 'native' ? 'native' : 'web';
  if (token.length < 40 || token.length > 4096) throw new HttpsError('invalid-argument', 'Invalid device token.');
  const tokenId = crypto.createHash('sha256').update(token).digest('hex');
  await db.collection('pushTokens').doc(tokenId).set({
    uid: request.auth.uid, token, platform, active: true,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await getMessaging().subscribeToTopic([token], topic);
  return { ok: true };
});

const seasonCollections = ['teams', 'players', 'matches', 'goals', 'cards', 'news', 'highlights', 'comments'];

async function copyCollectionToArchive(collectionName, archiveRef) {
  const source = db.collection(collectionName);
  let cursor = null;
  let total = 0;
  while (true) {
    let query = source.orderBy(FieldPath.documentId()).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.set(archiveRef.collection(collectionName).doc(doc.id), doc.data()));
    await batch.commit();
    total += snapshot.size;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 400) break;
  }
  return total;
}

async function clearCollection(collectionName) {
  const source = db.collection(collectionName);
  let removed = 0;
  while (true) {
    const snapshot = await source.orderBy(FieldPath.documentId()).limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    removed += snapshot.size;
    if (snapshot.size < 400) break;
  }
  return removed;
}

exports.createTournamentSeason = onCall({ maxInstances: 1, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  requireAdmin(request);
  const name = String(request.data?.name || '').trim().slice(0, 80);
  const year = Number(request.data?.year);
  if (!name || !Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new HttpsError('invalid-argument', 'Enter a season name and a valid year.');
  }

  const activeSeasons = await db.collection('seasons').where('active', '==', true).get();
  const previous = activeSeasons.docs[0] || null;
  const archiveId = previous?.id || db.collection('seasons').doc().id;
  const previousData = previous?.data() || {};
  const archiveName = String(previousData.name || previousData.year || request.data?.archiveName || 'الموسم السابق').trim().slice(0, 80);
  const archiveYear = Number(previousData.year) || Number(request.data?.archiveYear) || new Date().getFullYear();
  const archiveRef = db.collection('seasonArchive').doc(archiveId);
  const seasonControl = db.collection('settings').doc('seasonControl');

  // Freeze client writes while copying and clearing the current season.
  await seasonControl.set({ archiveInProgress: true, startedAt: FieldValue.serverTimestamp() }, { merge: true });

  const existingArchive = await archiveRef.get();
  let counts = existingArchive.data()?.counts || {};
  if (existingArchive.data()?.status !== 'complete') {
    await archiveRef.set({
      name: archiveName, year: archiveYear, status: 'archiving',
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    counts = {};
    for (const collectionName of seasonCollections) {
      counts[collectionName] = await copyCollectionToArchive(collectionName, archiveRef);
    }
    await archiveRef.set({ status: 'complete', counts, completedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  // Only clear the active collections after every archive copy has completed.
  for (const collectionName of seasonCollections) await clearCollection(collectionName);

  if (previous) {
    await previous.ref.set({ active: false, archived: true, archiveReady: true, archivedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await db.collection('seasons').doc(archiveId).set({
      name: archiveName, year: archiveYear, active: false, archived: true,
      archiveReady: true, createdAt: FieldValue.serverTimestamp(), archivedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  for (const oldSeason of activeSeasons.docs.slice(1)) {
    await oldSeason.ref.set({ active: false, archived: true }, { merge: true });
  }

  const newSeasonRef = db.collection('seasons').doc();
  await newSeasonRef.set({
    name, year, active: true, archived: false,
    createdAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid
  });
  await seasonControl.set({ archiveInProgress: false, activeSeasonId: newSeasonRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, archiveId, seasonId: newSeasonRef.id, counts };
});

exports.sendTournamentNotification = onCall({ maxInstances: 2 }, async request => {
  requireAdmin(request);
  const title = String(request.data?.title || '').trim().slice(0, 80);
  const body = String(request.data?.body || '').trim().slice(0, 220);
  if (!title || !body) throw new HttpsError('invalid-argument', 'Title and message are required.');
  const id = await getMessaging().send({
    topic,
    notification: { title, body },
    data: { url: './', sentAt: new Date().toISOString() },
    android: { priority: 'high', notification: { channelId: 'tournament' } },
    apns: { payload: { aps: { sound: 'default' } } }
  });
  await db.collection('notificationCampaigns').add({ title, body, messageId: id, sentBy: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { messageId: id, successCount: 1 };
});
