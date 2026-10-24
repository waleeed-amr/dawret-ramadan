/* FCM client setup. Put the public Web Push (VAPID) key in firebase-config.js. */
async function enableTournamentNotifications() {
  const button = document.getElementById('enableNotifications');
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      await window.__nativePushReady;
      await window.registerNativePush?.();
      if (button) button.innerHTML = '<i class="fas fa-bell"></i>';
    } catch (error) { console.error(error); showToast('تعذر تفعيل إشعارات التطبيق'); }
    return;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    showToast('الإشعارات غير مدعومة على هذا الجهاز'); return;
  }
  if (!firebaseConfig.messagingVapidKey) {
    showToast('إعداد الإشعارات غير مكتمل: أضف مفتاح VAPID العام'); return;
  }
  try {
    if (button) button.disabled = true;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { showToast('لم يتم السماح بالإشعارات'); return; }
    await ensureAnonymousAuth().catch(e => { if (e.code !== 'auth/operation-not-allowed') throw e; });
    const registration = await navigator.serviceWorker.register(new URL('firebase-messaging-sw.js', window.APP_BASE_URL).href);
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: firebaseConfig.messagingVapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('لم يصدر Firebase رمز تسجيل لهذا الجهاز');
    await firebase.functions().httpsCallable('registerPushToken')({ token, platform: 'web' });
    localStorage.setItem('dawret_push_enabled', '1');
    showToast('تم تفعيل إشعارات الدورة ✅');
    if (button) button.innerHTML = '<i class="fas fa-bell"></i>';
  } catch (error) {
    console.error('FCM setup failed', error);
    showToast('تعذر تفعيل الإشعارات. راجع إعدادات Firebase.');
  } finally { if (button) button.disabled = false; }
}
if ('Notification' in window && Notification.permission === 'granted') {
  // Registration is explicit; do not silently enroll the audience.
  const b = document.getElementById('enableNotifications'); if (b) b.title = 'الإشعارات مسموحة على هذا الجهاز';
}
