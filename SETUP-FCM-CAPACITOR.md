# تشغيل التطبيق و FCM

## أول مرة

1. ثبّت Node.js 22 أو أحدث، ثم من مجلد المشروع شغّل `npm install`.
2. ثبّت Firebase CLI: `npm install -g firebase-tools`، ثم `firebase login`.
3. فعّل **Authentication > Sign-in method > Anonymous** في مشروع Firebase `kearshehta`.
4. من **Firebase Console > Project settings > Cloud Messaging > Web configuration** أنشئ Web Push key pair. انسخ **المفتاح العام VAPID فقط** إلى `messagingVapidKey` داخل `JS/firebase-config.js`.
5. من Google Cloud فعّل **Firebase Cloud Messaging API** و **Firebase Installations API** للمشروع.
6. اضبط كلمة مرور الإدارة كـ secret: `firebase functions:secrets:set ADMIN_PASSWORD`.
7. أنشئ ملفات الويب ثم انشر: `npm run build` ثم `firebase deploy --only functions,firestore:rules,hosting`.

## Android / Capacitor

1. في **Firebase Console > Project settings > Your apps** أضف تطبيق Android بالمعرّف `com.dawret.ramadan`.
2. نزّل `google-services.json` وضعه في `android/app/google-services.json` بعد إنشاء منصة Android.
3. شغّل `npx cap add android` مرة واحدة، ثم `npm run cap:sync`، وبعدها افتح Android Studio بالأمر `npx cap open android`.
4. جرّب الإشعارات على جهاز Android حقيقي بعد الموافقة عليها. لا ترفع `google-services.json` إلى مستودع عام إذا احتوى إعدادات داخلية، ولا تضع Service Account JSON داخل التطبيق.

## iOS

أضف منصة iOS بـ `npx cap add ios`، واربط تطبيق iOS في Firebase، فعّل Push Notifications و Background Modes في Xcode، ثم ارفع مفتاح APNs من Apple Developer إلى إعدادات Cloud Messaging في Firebase.

## ملاحظات

- مفتاح VAPID العام يوضع في تطبيق الويب؛ مفاتيح Service Account تظل على الخادم ولا تُرسل للمتصفح.
- حساب الإدارة الأولي: افتح لوحة `/admin` واستخدم كلمة المرور التي أدخلتها عند ضبط `ADMIN_PASSWORD`.
- قواعد Firestore الجديدة تعتمد على custom claim الإدارة. انشر Functions وRules معًا قبل اعتماد نسخة التطبيق الجديدة.
- عدّ الزيارات يسجل أول زيارة لكل حساب Firebase مجهول مستقر على ذلك المتصفح/التثبيت؛ لا يمكنه إثبات هوية شخص واحد عبر عدة أجهزة.
