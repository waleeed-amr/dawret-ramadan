import { PushNotifications } from '@capacitor/push-notifications';

let nativePushRegistered = false;
async function registerNativePush() {
  if (nativePushRegistered) return;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;
  await PushNotifications.createChannel({ id: 'tournament', name: 'إشعارات الدورة', importance: 5, sound: 'default' }).catch(() => {});
  await PushNotifications.register();
  nativePushRegistered = true;
}
window.registerNativePush = registerNativePush;
PushNotifications.addListener('registration', async ({ value: token }) => {
  try { await firebase.functions().httpsCallable('registerPushToken')({ token, platform: 'native' }); }
  catch (error) { console.error('Native push token registration failed', error); }
});
PushNotifications.addListener('registrationError', error => console.error('Native push registration failed', error));
PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
  const url = notification.data?.url || './';
  window.location.href = new URL(url, window.location.href).href;
});
