# تشغيل التطبيق و FCM

## أول مرة

1. ثبّت Node.js 22 أو أحدث، ثم من مجلد المشروع شغّل `npm install`.
2. ثبّت Firebase CLI: `npm install -g firebase-tools`، ثم `firebase login`.
3. فعّل **Authentication > Sign-in method > Anonymous** في مشروع Firebase `kearshehta`.
4. من **Project settings > General > Your apps** تأكد أن تطبيق الويب الموجود يطابق إعدادات `JS/firebase-config.js`.
5. من **Authentication > Settings > Authorized domains** أضف نطاق الاستضافة الفعلي لو مش موجود.
6. مشروعك ظاهر على خطة Spark. نشر Cloud Functions يتطلب ترقية المشروع إلى خطة Blaze وربط حساب فوترة؛ توجد حصة استخدام مجانية للدوال على Blaze، لكن قد تُفرض رسوم على الاستخدام أو التخزين، فاضبط تنبيهات ميزانية قبل النشر.
7. من **Firebase Console > Project settings > Cloud Messaging > Web configuration** أنشئ Web Push key pair. انسخ **المفتاح العام VAPID فقط** إلى `messagingVapidKey` داخل `JS/firebase-config.js`.
8. من Google Cloud فعّل **Firebase Cloud Messaging API** و **Firebase Installations API** للمشروع.
9. اضبط كلمة مرور الإدارة كـ secret: `firebase functions:secrets:set ADMIN_PASSWORD`.
10. انشر وظائف الخادم والقواعد معًا: `firebase deploy --only functions,firestore:rules`.
11. انشر ملفات الموقع المحدّثة على فرع GitHub Pages المستخدم للموقع. رابط Pages عندك يعمل تحت `/dawret-ramadan/`، لذلك يجب نشر مجلد المشروع نفسه مع مساراته النسبية.
12. افتح `/admin` واستخدم كلمة المرور نفسها التي ضبطتها في الخطوة 9. إذا كان المشروع لم ينشر وظائف الإدارة سابقًا، انشرها أولًا ثم جرّب مجددًا.

## أرشيف الدورات

من لوحة الإدارة افتح **إدارة المواسم** ثم **أرشفة الحالية وإنشاء دورة جديدة**. ينسخ الخادم الفرق واللاعبين والمباريات والأهداف والبطاقات والأخبار واللقطات والتعليقات إلى أرشيف للقراءة، ثم يبدأ الدورة الجديدة ببيانات رياضية فارغة. تظهر الدورات المكتملة للجمهور في رابط **الأرشيف** بالموقع. أثناء النسخ تُوقف الكتابة مؤقتًا لحماية البيانات؛ إذا انقطع تنفيذ الخادم، أعد تشغيل إنشاء الدورة من لوحة الإدارة ليكمل من الأرشيف المحفوظ.

## Android / Capacitor

1. في **Firebase Console > Project settings > Your apps** أضف تطبيق Android بالمعرّف `com.dawret.ramadan`.
2. نزّل `google-services.json` وضعه في `android/app/google-services.json` بعد إنشاء منصة Android. هذا الملف لازم لتفعيل إشعارات Firebase الأصلية على Android.
3. شغّل `npx cap add android` مرة واحدة، ثم `npm run cap:sync`، وبعدها افتح Android Studio بالأمر `npx cap open android`.
4. جرّب الإشعارات على جهاز Android حقيقي بعد الموافقة عليها. لا ترفع `google-services.json` إلى مستودع عام إذا احتوى إعدادات داخلية، ولا تضع Service Account JSON داخل التطبيق.

## iOS

أضف منصة iOS بـ `npx cap add ios`، واربط تطبيق iOS في Firebase، فعّل Push Notifications و Background Modes في Xcode، ثم ارفع مفتاح APNs من Apple Developer إلى إعدادات Cloud Messaging في Firebase.

## ملاحظات

- مفتاح VAPID العام يوضع في تطبيق الويب؛ مفاتيح Service Account تظل على الخادم ولا تُرسل للمتصفح.
- حساب الإدارة الأولي: افتح لوحة `/admin` واستخدم كلمة المرور التي أدخلتها عند ضبط `ADMIN_PASSWORD`. إذا ظهر أن وظيفة تسجيل الدخول غير موجودة، انشر Cloud Functions؛ وإذا ظهر خطأ نطاق، أضف `waleeed-amr.github.io` إلى Authorized domains.
- قواعد Firestore الجديدة تعتمد على custom claim الإدارة. انشر Functions وRules معًا قبل اعتماد نسخة التطبيق الجديدة.
- عدّ الزيارات يسجل أول زيارة لكل حساب Firebase مجهول مستقر على ذلك المتصفح/التثبيت؛ لا يمكنه إثبات هوية شخص واحد عبر عدة أجهزة.
