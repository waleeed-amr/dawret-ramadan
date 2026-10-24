// Firebase Configuration - دورة رمضان ب ششتا
const firebaseConfig = {
    apiKey: "AIzaSyAvH3aQzUQJDQTWbMIjxaQAsXWAh-ysr-8",
    authDomain: "kearshehta.firebaseapp.com",
    projectId: "kearshehta",
    storageBucket: "kearshehta.firebasestorage.app",
    messagingSenderId: "856762365647",
    appId: "1:856762365647:web:9089379c117568363a29ba",
    measurementId: "G-0359MXDQMJ",
    messagingVapidKey: "" // Add Firebase Console > Cloud Messaging > Web Push certificate key pair
};

// ImgBB API Key
const IMGBB_API_KEY = 'd043eaa8557d5bb59c526cae6214b958';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const functions = firebase.functions();

// Enable offline persistence — multi-tab aware.
//
// Using `synchronizeTabs: true` instead of the deprecated
// `experimentalTabSynchronization`. This lets multiple tabs share the same
// IndexedDB persistence layer without "failed-precondition" errors.
//
// Also set cacheSizeBytes to UNLIMITED so Firestore doesn't auto-evict data.
db.settings({ cacheSizeBytes: 50 * 1024 * 1024, merge: true });

db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
      if (err.code === 'failed-precondition') {
          // Multiple tabs open — one couldn't get persistence. Harmless.
          console.warn('Firestore: multi-tab persistence conflict — using memory cache.');
      } else if (err.code === 'unimplemented') {
          console.warn('Firestore: persistence unsupported in this browser — using memory cache.');
      }
  });


const auth = firebase.auth();
let _anonymousAuthPromise = null;
async function ensureAnonymousAuth() {
    if (auth.currentUser) return auth.currentUser;
    if (!_anonymousAuthPromise) {
        _anonymousAuthPromise = auth.signInAnonymously().then(result => result.user).finally(() => { _anonymousAuthPromise = null; });
    }
    return _anonymousAuthPromise;
}

// Helper: Compress image before upload (fixes slow display)
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        // If file is small enough, skip compression
        if (file.size < 100 * 1024) { resolve(file); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else { resolve(file); }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// Helper: Upload image to ImgBB with compression + retry
async function uploadToImgBB(file, retries = 2) {
    try {
        // Compress image first for faster upload & display
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append('image', compressed);
        formData.append('key', IMGBB_API_KEY);
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);
                const res = await fetch('https://api.imgbb.com/1/upload', {
                    method: 'POST', body: formData, signal: controller.signal
                });
                clearTimeout(timeout);
                const data = await res.json();
                if (data.success) return data.data.display_url || data.data.url;
                if (attempt === retries) throw new Error('Upload failed');
            } catch (err) {
                if (attempt === retries) throw err;
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    } catch (err) {
        console.error('ImgBB upload error:', err);
        return null;
    }
}

// Helper: Get active season
async function getActiveSeason() {
    const snap = await db.collection('seasons').where('active', '==', true).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
