/* ==========================================
   الدورة الرمضانية بششتا - Main Application v5
   Full Features: Comments, Polls, Live, MVP, Contact, Profile Photos
   Enhanced: Smart Caching, SEO, Direct Photo Upload, Search, Share
   ========================================== */

// ============ DATA CACHE ============
let cachedTeams = [], cachedPlayers = [], cachedMatches = [], cachedGoals = [], cachedNews = [], cachedSeason = null;
let dataLoaded = false, dataLoadingPromise = null;
let lastDataLoad = 0;
// ============ AUTH REMOVED - Everyone can interact ============
function requireAuth() { return true; }


// ============ UTILITY ============
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
function animatePageIn() { const app = document.getElementById('app'); if (app) { app.classList.remove('page-enter'); void app.offsetWidth; app.classList.add('page-enter'); } }

// Number counter animation
function animateValue(id, start, end, duration) {
  if (start === end) {
    const obj = document.getElementById(id);
    if (obj) obj.innerHTML = end;
    return;
  }
  let current = start;
  const range = end - start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range));
  const obj = document.getElementById(id);
  if (!obj) return;
  const timer = setInterval(() => {
    current += increment;
    obj.innerHTML = current;
    if (current == end) clearInterval(timer);
  }, stepTime);
}

// ============ DATA LOADERS ============
async function loadTeams() { try { const s = await db.collection('teams').where('active', '==', true).get(); cachedTeams = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { cachedTeams = []; } return cachedTeams; }
async function loadPlayers() { try { const s = await db.collection('players').get(); cachedPlayers = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { cachedPlayers = []; } return cachedPlayers; }
async function loadMatches() {
  try {
    const s = await db.collection('matches').orderBy('date', 'desc').get();
    const now = new Date().getTime();
    cachedMatches = s.docs.map(d => {
      const m = { id: d.id, ...d.data() };
      if (m.date) {
        const mt = new Date(m.date).getTime();
        if (m.status === 'upcoming' && now >= mt) m.status = 'live';
        if (m.status === 'live') {
          const et = m.endTime ? new Date(m.endTime).getTime() : mt + (50 * 60000); // 50 mins default
          if (now >= et) m.status = 'finished';
        }
      }
      return m;
    });
  } catch (e) { cachedMatches = []; console.error(e) }
  return cachedMatches;
}
async function loadGoals() { try { const s = await db.collection('goals').get(); cachedGoals = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { cachedGoals = []; } return cachedGoals; }
async function loadNews() { try { const s = await db.collection('news').where('published', '==', true).get(); cachedNews = s.docs.map(d => ({ id: d.id, ...d.data() })); cachedNews.sort((a, b) => new Date(b.date) - new Date(a.date)); } catch (e) { cachedNews = []; } return cachedNews; }
async function loadSeason() { try { const s = await db.collection('seasons').where('active', '==', true).limit(1).get(); cachedSeason = s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }; } catch (e) { cachedSeason = null; } return cachedSeason; }
async function loadAllData(force = false) {
  if (dataLoaded && !force) return;
  if (dataLoadingPromise) return dataLoadingPromise;

  const bar = document.getElementById('loadingBar');
  const status = document.getElementById('loadingStatus');
  if (bar) bar.style.width = '0%';
  if (status) status.textContent = 'جاري الاتصال بالخادم...';

  try {
    const tasks = [
      { name: 'الفرق', promise: loadTeams() },
      { name: 'اللاعبين', promise: loadPlayers() },
      { name: 'المباريات', promise: loadMatches() },
      { name: 'الأهداف', promise: loadGoals() },
      { name: 'الأخبار', promise: loadNews() },
      { name: 'الموسم', promise: loadSeason() }
    ];
    let completed = 0;

    dataLoadingPromise = Promise.all(tasks.map(async t => {
      await t.promise;
      completed++;
      if (bar) bar.style.width = Math.min((completed / tasks.length * 100), 100) + '%';
      if (status) status.textContent = `تم تحميل بيانات ${t.name}...`;
    }));
    await dataLoadingPromise;
    if (status) status.textContent = 'اكتمل التحميل!';
    if (bar) bar.style.width = '100%';

    dataLoaded = true; dataLoadingPromise = null;
    listenLiveMatches();
  } catch (e) {
    if (status) status.textContent = 'حدث خطأ!';
    console.error("Data load error:", e);
    showToast('حدث خطأ أثناء تحميل البيانات. يرجى تحديث الصفحة.');
    dataLoadingPromise = null;
  }
}
function refreshData() { dataLoaded = false; return loadAllData(true); }

// ============ HELPERS ============
// دالة البروكسي المجانية لتخطي حظر شبكات الإنترنت
function getSafeImageUrl(url) {
  if (!url) return '';
  // قائمة النطاقات المحتمل حظرها (مثل ImgBB وغيرها)
  const blockedDomains = ['ibb.co', 'imgbb.com', 'i.ibb.co'];
  
  if (blockedDomains.some(domain => url.includes(domain))) {
    // استخدام wsrv.nl كبروكسي أساسي لأنه سريع ومستقر
    return `https://wsrv.nl/?url=${url}`;
  }
  return url;
}

function getTeam(id) { return cachedTeams.find(t => t.id === id) }
function getPlayer(id) { return cachedPlayers.find(p => p.id === id) }
function getMatchGoals(mid) { return cachedGoals.filter(g => g.matchId === mid) }
function getTeamPlayers(tid) { return cachedPlayers.filter(p => p.teamId === tid) }

function teamLogo(t, sz, clickable) {
  const s = sz || '100%';
  const click = (clickable !== false && t) ? `onclick="navigateTo('#/team/${t.id}')" style="cursor:pointer"` : '';
  const c = t ? (t.color || '#D4AF37') : '#D4AF37';
  const fallbackDiv = `<div ${click} style="width:${s};height:${s};background:${c};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1em;color:#fff;flex-shrink:0">${t ? t.name.charAt(0) : '?'}</div>`;
  if (t && t.logo) {
    const esc = fallbackDiv.replace(/"/g, '&quot;');
    // استخدام البروكسي هنا
    const safeLogo = getSafeImageUrl(t.logo);
    return `<img src="${safeLogo}" alt="${t.name}" style="width:${s};height:${s};border-radius:50%;object-fit:cover" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='${esc}'" ${click}>`;
  }
  return fallbackDiv;
}
function playerPhoto(p, sz) {
  const s = sz || '100%';
  const fallbackDiv = `<div style="width:${s};height:${s};background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4em;flex-shrink:0">⚽</div>`;
  if (p && p.photo) {
    const esc = fallbackDiv.replace(/"/g, '&quot;');
    // استخدام البروكسي هنا
    const safePhoto = getSafeImageUrl(p.photo);
    return `<img src="${safePhoto}" alt="${p.name}" style="width:${s};height:${s};border-radius:50%;object-fit:cover;cursor:pointer" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='${esc}'" onclick="event.stopPropagation();openLightbox('${safePhoto.replace(/'/g, "\\'")}','${p.name}')">`;
  }
  return fallbackDiv;
}
function openLightbox(src, alt) {
  let lb = document.getElementById('imgLightbox');
  if (!lb) { lb = document.createElement('div'); lb.id='imgLightbox'; lb.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;opacity:0;transition:opacity .3s ease;padding:20px'; lb.onclick=()=>{lb.style.opacity='0';setTimeout(()=>lb.remove(),300)}; document.body.appendChild(lb); }
  lb.innerHTML = `<img src="${src}" alt="${alt||''}" style="max-width:90%;max-height:85vh;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);object-fit:contain">`;
  requestAnimationFrame(()=> lb.style.opacity='1');
}
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) }
function timeAgo(d) { if (!d) return ''; const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000); if (m < 1) return 'الآن'; if (m < 60) return `منذ ${m} دقيقة`; const h = Math.floor(m / 60); if (h < 24) return `منذ ${h} ساعة`; return formatDate(d) }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000) }
function updateSEO(title, desc, image) {
  const fullTitle = title + ' | الدورة الرمضانية بششتا';
  document.title = fullTitle;
  const m = document.querySelector('meta[name="description"]'); if (m) m.content = desc;
  // Open Graph dynamic
  const ogT = document.querySelector('meta[property="og:title"]'); if (ogT) ogT.content = fullTitle;
  const ogD = document.querySelector('meta[property="og:description"]'); if (ogD) ogD.content = desc;
  const ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.content = 'https://dawaretramadan.netlify.app/' + (window.location.hash || '');
  if (image) { const ogI = document.querySelector('meta[property="og:image"]'); if (ogI) ogI.content = image; }
  // Twitter dynamic
  const twT = document.querySelector('meta[name="twitter:title"]'); if (twT) twT.content = fullTitle;
  const twD = document.querySelector('meta[name="twitter:description"]'); if (twD) twD.content = desc;
  // Canonical
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.href = 'https://dawaretramadan.netlify.app/' + (window.location.hash || '');
}
function injectStructuredData(data) { let el = document.getElementById('dynamicLD'); if (el) el.remove(); el = document.createElement('script'); el.id = 'dynamicLD'; el.type = 'application/ld+json'; el.textContent = JSON.stringify(data); document.head.appendChild(el) }
function updateBottomNav(page) { document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('data-page') === (page || 'home'))) }
function emptyHTML(icon, text) { return `<div class="empty-state"><i class="${icon}"></i><p>${text}</p></div>` }

let cachedStandingsStr = '';
let cachedStandingsResult = null;
function calcStandings(teams, matches) {
  const hashStr = teams.length + '_' + matches.filter(m => m.status === 'finished' || (m.scoreA !== undefined && m.scoreB !== undefined && m.status !== 'upcoming')).map(m => m.id + m.scoreA + m.scoreB).join('');
  // Cache disabled intentionally because it ignored manual points and played stats additions/updates
  // if (cachedStandingsStr === hashStr && cachedStandingsResult) return cachedStandingsResult;

  const table = teams.map(t => ({ ...t, played: Number(t.manualPlayed) || 0, won: Number(t.manualWon) || 0, drawn: Number(t.manualDrawn) || 0, lost: Number(t.manualLost) || 0, gf: Number(t.manualGF) || 0, ga: Number(t.manualGA) || 0, points: Number(t.manualPoints) || 0, form: [] }));
  // Count finished matches AND matches with scores set (even if status not explicitly 'finished')
  // استبعاد مباريات نصف النهائي والنهائي من حسابات الترتيب
  matches.filter(m => (m.status === 'finished' || (m.scoreA !== undefined && m.scoreB !== undefined && m.status !== 'upcoming')) && m.stage !== 'semi_final' && m.stage !== 'final').forEach(m => {
    const tA = table.find(t => t.id === m.teamAId), tB = table.find(t => t.id === m.teamBId);
    if (!tA || !tB) return;
    // Prevent counting same match twice
    const matchKey = `counted_${m.id}`;
    if (tA[matchKey]) return; tA[matchKey] = true; tB[matchKey] = true;
    const sA = Number(m.scoreA) || 0, sB = Number(m.scoreB) || 0;
    tA.played++; tB.played++; tA.gf += sA; tA.ga += sB; tB.gf += sB; tB.ga += sA;
    if (sA > sB) { tA.won++; tA.points += 3; tB.lost++; tA.form.push('W'); tB.form.push('L') }
    else if (sA < sB) { tB.won++; tB.points += 3; tA.lost++; tA.form.push('L'); tB.form.push('W') }
    else { tA.drawn++; tB.drawn++; tA.points++; tB.points++; tA.form.push('D'); tB.form.push('D') }
  });
  table.forEach(t => { Object.keys(t).filter(k => k.startsWith('counted_')).forEach(k => delete t[k]) });
  table.sort((a, b) => { if (b.points !== a.points) return b.points - a.points; const ga = a.gf - a.ga, gb = b.gf - b.ga; if (gb !== ga) return gb - ga; return b.gf - a.gf });

  cachedStandingsStr = hashStr;
  cachedStandingsResult = table;
  return table;
}

let liveMatchesUnsubscribe = null;
function listenLiveMatches() {
  if (liveMatchesUnsubscribe) return;
  liveMatchesUnsubscribe = db.collection('matches').where('status', '==', 'live').onSnapshot(snap => {
    let changed = false;
    snap.docChanges().forEach(change => {
      const data = { id: change.doc.id, ...change.doc.data() };
      const idx = cachedMatches.findIndex(m => m.id === data.id);
      if (change.type === 'modified' || change.type === 'added') {
        if (idx >= 0) {
          const old = cachedMatches[idx];
          if (old.scoreA !== data.scoreA || old.scoreB !== data.scoreB || old.liveMinute !== data.liveMinute || old.status !== data.status) {
            cachedMatches[idx] = data;
            changed = true;
          }
        } else {
          cachedMatches.unshift(data);
          changed = true;
        }
      } else if (change.type === 'removed') {
        if (idx >= 0) {
          cachedMatches[idx].status = 'finished';
          changed = true;
        }
      }
    });
    if (changed) {
      cachedStandingsStr = ''; // invalidate cache
      const hash = window.location.hash.slice(2) || '';
      const page = hash.split('/')[0] || 'home';
      if (page === 'home') renderHome();
      else if (page === 'matches') renderMatches();
      else if (page === 'match') {
        const matchId = hash.split('/')[1];
        if (snap.docs.some(d => d.id === matchId)) renderMatchDetail(matchId);
      }
    }
  });
}

// ============ REACTIONS (6-emoji) ============
const REACTIONS = [{ key: 'like', emoji: '❤️' }, { key: 'fire', emoji: '🔥' }, { key: 'clap', emoji: '👏' }, { key: 'laugh', emoji: '😂' }, { key: 'wow', emoji: '😮' }, { key: 'sad', emoji: '😢' }];

function reactionBarHTML(collection, id, reactions) {
  const userR = localStorage.getItem(`reaction_${collection}_${id}`);
  return `<div class="reaction-bar">${REACTIONS.map(r => {
    const count = (reactions && reactions[r.key]) || 0;
    return `<button class="reaction-btn ${userR === r.key ? 'active' : ''}" onclick="toggleReaction('${collection}','${id}','${r.key}',this)"><span class="emoji">${r.emoji}</span> <span>${count}</span></button>`;
  }).join('')}</div>`;
}

async function toggleReaction(col, id, type, btn) {
  if (!requireAuth('التفاعل')) return;
  const key = `reaction_${col}_${id}`; const current = localStorage.getItem(key);
  const allBtns = btn.parentElement.querySelectorAll('.reaction-btn');
  allBtns.forEach(b => b.classList.remove('active'));
  let inc = {};
  if (current === type) { localStorage.removeItem(key); inc[`reactions.${type}`] = firebase.firestore.FieldValue.increment(-1); const sp = btn.querySelector('span:last-child'); sp.textContent = Math.max(0, (parseInt(sp.textContent) || 0) - 1) }
  else {
    localStorage.setItem(key, type); btn.classList.add('active'); inc[`reactions.${type}`] = firebase.firestore.FieldValue.increment(1); const sp = btn.querySelector('span:last-child'); sp.textContent = (parseInt(sp.textContent) || 0) + 1;
    if (current) { inc[`reactions.${current}`] = firebase.firestore.FieldValue.increment(-1); const idx = REACTIONS.findIndex(r => r.key === current); if (idx >= 0) { const old = allBtns[idx]; if (old) { const os = old.querySelector('span:last-child'); os.textContent = Math.max(0, (parseInt(os.textContent) || 0) - 1) } } }
  }
  try { await db.collection(col).doc(id).update(inc) } catch (e) { console.error('Reaction err', e) }
}

// ============ VISITOR COUNTER ============
async function initVisitorCounter() {
  try {
    if (!auth.currentUser) await ensureAnonymousAuth();
    if (localStorage.getItem('dawret_visit_recorded_v1') !== '1') {
      await firebase.functions().httpsCallable('recordUniqueVisit')();
      localStorage.setItem('dawret_visit_recorded_v1', '1');
    }
  } catch (e) { console.warn('Unique visitor counter unavailable', e); }
  try {
    const doc = await db.collection('statistics').doc('general').get();
    if (doc.exists) {
      const v = doc.data().visits || 0;
      ['visitorCount', 'visitorCountHeader'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = v; });
      const footer = document.getElementById('visitorStats'), header = document.getElementById('visitorStatsHeader');
      if (footer) footer.style.display = 'block'; if (header) header.style.display = 'inline-flex';
    }
  } catch (e) { }
}

// ============ ROUTER ============
function navigateTo(hash) { window.location.hash = hash }

async function router() {
  const hash = window.location.hash.slice(2) || ''; const parts = hash.split('/'); const page = parts[0]; const param = parts[1] || null;
  if (page === 'admin') { document.getElementById('mainHeader').style.display = 'none'; document.getElementById('mainFooter').style.display = 'none'; document.getElementById('bottomNav').style.display = 'none'; updateExtraUIVisibility('admin'); await loadAdminScript(); if (typeof renderAdmin === 'function') renderAdmin(parts.slice(1).join('/')); return }
  document.getElementById('mainHeader').style.display = ''; document.getElementById('mainFooter').style.display = ''; document.getElementById('bottomNav').style.display = '';
  updateExtraUIVisibility(page || 'home');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('data-page') === (page || 'home')));
  updateBottomNav(page || 'home');
  document.getElementById('mainNav').classList.remove('open');
  if (page === 'archive') {
    if (param) await renderArchiveSeason(param, parts[2] || 'overview');
    else await renderArchiveList();
    animatePageIn();
    window.scrollTo(0, 0);
    return;
  }
  await loadAllData();
  switch (page) {
    case 'standings': renderStandings(); break; case 'matches': renderMatches(); break; case 'match': renderMatchDetail(param); break;
    case 'teams': renderTeams(); break; case 'team': renderTeamDetail(param); break; case 'player': renderPlayer(param); break;
    case 'statistics': renderStatistics(); break; case 'news': renderNews(); break; case 'news-detail': showNewsDetail(param); break;
    case 'highlights': renderHighlights(); break;
    case 'contact': renderContactPage(); break; case 'search': renderSearchResults(param); break;
    default: renderHome();
  }
  animatePageIn();
  window.scrollTo(0, 0);
}

// ============ SEASON ARCHIVE (READ ONLY) ============
async function renderArchiveList() {
  const app = document.getElementById('app');
  updateSEO('أرشيف الدورات', 'تصفح نتائج وإحصائيات الدورات الرمضانية السابقة');
  app.innerHTML = '<div class="page-content"><div class="container"><section class="section"><div class="admin-loading">جاري تحميل الأرشيف...</div></section></div></div>';
  try {
    const snapshot = await db.collection('seasons').where('archiveReady', '==', true).get();
    const seasons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.year || 0) - (a.year || 0));
    app.innerHTML = `<div class="page-content"><div class="container"><section class="section">
      <div class="section-header"><h2 class="section-title"><i class="fas fa-box-archive"></i> أرشيف الدورات</h2></div>
      <p class="text-muted mb-3">الدورات السابقة محفوظة للعرض، وتقدر ترجع لنتائجها وفرقها وأخبارها.</p>
      ${seasons.length ? `<div class="admin-cards-grid">${seasons.map(season => `<a class="admin-item-card" href="#/archive/${season.id}" style="text-decoration:none;color:inherit">
        <div style="font-size:2rem">🏆</div><h3 style="color:var(--gold)">${escapeHTML(season.name || 'دورة رمضانية')}</h3>
        <p class="text-muted">${season.year || ''}</p><span class="admin-badge badge-blue">عرض الأرشيف <i class="fas fa-arrow-left"></i></span>
      </a>`).join('')}</div>` : emptyHTML('fas fa-box-archive', 'لسه مفيش دورات مؤرشفة')}
    </section></div></div>`;
  } catch (error) {
    app.innerHTML = `<div class="page-content"><div class="container">${emptyHTML('fas fa-triangle-exclamation', 'تعذر تحميل الأرشيف')}</div></div>`;
  }
}

async function renderArchiveSeason(seasonId, section = 'overview') {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="page-content"><div class="container"><section class="section"><div class="admin-loading">جاري تحميل الدورة...</div></section></div></div>';
  try {
    const seasonSnap = await db.collection('seasons').doc(seasonId).get();
    const archiveRef = db.collection('seasonArchive').doc(seasonId);
    const archiveSnap = await archiveRef.get();
    if (!seasonSnap.exists || !archiveSnap.exists || archiveSnap.data().status !== 'complete') throw new Error('archive-missing');
    const season = seasonSnap.data();
    const collectionNames = ['teams', 'players', 'matches', 'goals', 'cards', 'news'];
    const snapshots = await Promise.all(collectionNames.map(name => archiveRef.collection(name).get()));
    const data = Object.fromEntries(collectionNames.map((name, index) => [name, snapshots[index].docs.map(doc => ({ id: doc.id, ...doc.data() }))]));
    data.matches.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const teamById = Object.fromEntries(data.teams.map(team => [team.id, team]));
    const standings = calcStandings(data.teams, data.matches);
    const tab = ['overview', 'matches', 'teams', 'news'].includes(section) ? section : 'overview';
    const tabs = [['overview', 'ملخص الدورة'], ['matches', 'المباريات والنتائج'], ['teams', 'الفرق واللاعبون'], ['news', 'الأخبار']];
    const tabNav = tabs.map(([id, label]) => `<a class="btn btn-sm ${tab === id ? 'btn-primary' : 'btn-outline'}" href="#/archive/${seasonId}/${id}">${label}</a>`).join('');
    let content = '';
    if (tab === 'overview') {
      const championMatch = data.matches.find(match => match.stage === 'final' && match.status === 'finished');
      const champion = championMatch ? teamById[championMatch.scoreA > championMatch.scoreB ? championMatch.teamAId : championMatch.teamBId] : null;
      const scorers = [...data.players].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 5);
      content = `<div class="dashboard-stats">
        ${[["fa-users", data.teams.length, 'الفرق'], ["fa-user-tag", data.players.length, 'اللاعبون'], ["fa-futbol", data.matches.length, 'المباريات'], ["fa-bullseye", data.goals.length, 'الأهداف']].map(([icon, value, label]) => `<div class="stat-card"><div class="stat-icon"><i class="fas ${icon}"></i></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`).join('')}
      </div>${champion ? `<div class="card mt-3" style="text-align:center"><div style="font-size:2rem">🏆</div><h3 style="color:var(--gold)">بطل ${escapeHTML(season.name || 'الدورة')}: ${escapeHTML(champion.name)}</h3></div>` : ''}
      <h3 class="section-title mt-3">الترتيب النهائي</h3>${standings.length ? `<div class="table-responsive"><table class="admin-table"><thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>النقاط</th></tr></thead><tbody>${standings.map((team, index) => `<tr><td>${index + 1}</td><td>${escapeHTML(team.name)}</td><td>${team.played}</td><td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td><td>${team.gf}</td><td>${team.ga}</td><td><strong>${team.points}</strong></td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted">لا توجد نتائج محفوظة.</p>'}
      <h3 class="section-title mt-3">أبرز الهدافين</h3><div class="grid-3">${scorers.map(player => `<div class="card"><strong>${escapeHTML(player.name)}</strong><p class="text-muted">${escapeHTML(teamById[player.teamId]?.name || '')} · ${player.goals || 0} هدف</p></div>`).join('') || '<p class="text-muted">لا توجد بيانات هدافين.</p>'}</div>`;
    } else if (tab === 'matches') {
      content = data.matches.length ? `<div class="table-responsive"><table class="admin-table"><thead><tr><th>الفريق الأول</th><th>النتيجة</th><th>الفريق الثاني</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${data.matches.map(match => `<tr><td>${escapeHTML(teamById[match.teamAId]?.name || '—')}</td><td><strong>${match.scoreA ?? '—'} - ${match.scoreB ?? '—'}</strong></td><td>${escapeHTML(teamById[match.teamBId]?.name || '—')}</td><td>${formatDate(match.date)}</td><td>${match.status === 'finished' ? 'انتهت' : match.status === 'live' ? 'مباشر' : 'قادمة'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted">لا توجد مباريات محفوظة.</p>';
    } else if (tab === 'teams') {
      content = `<div class="grid-3">${data.teams.map(team => {
        const players = data.players.filter(player => player.teamId === team.id);
        return `<div class="card"><h3 style="color:var(--gold)">${escapeHTML(team.name)}</h3><p class="text-muted">${players.length} لاعب</p><p>${players.map(player => `${escapeHTML(player.name)}${player.goals ? ` · ${player.goals}⚽` : ''}`).join('<br>') || 'لا توجد أسماء لاعبين محفوظة.'}</p></div>`;
      }).join('') || '<p class="text-muted">لا توجد فرق محفوظة.</p>'}</div>`;
    } else {
      content = data.news.length ? `<div class="grid-2">${data.news.map(item => `<article class="card"><h3 style="color:var(--gold)">${escapeHTML(item.title || 'خبر')}</h3><p>${escapeHTML(item.body || '').replace(/\n/g, '<br>')}</p><small class="text-muted">${formatDate(item.date)}</small></article>`).join('')}</div>` : '<p class="text-muted">لا توجد أخبار محفوظة.</p>';
    }
    updateSEO(`أرشيف ${season.name || season.year || ''}`, 'عرض نتائج وبيانات دورة رمضانية سابقة');
    app.innerHTML = `<div class="page-content"><div class="container"><section class="section">
      <a class="btn btn-sm btn-outline mb-3" href="#/archive"><i class="fas fa-arrow-right"></i> كل الدورات</a>
      <div class="section-header"><h2 class="section-title"><i class="fas fa-box-archive"></i> ${escapeHTML(season.name || 'الدورة المؤرشفة')} ${season.year || ''}</h2><span class="admin-badge badge-blue">أرشيف للعرض</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">${tabNav}</div><div class="card">${content}</div>
    </section></div></div>`;
  } catch (error) {
    app.innerHTML = `<div class="page-content"><div class="container"><section class="section">${emptyHTML('fas fa-triangle-exclamation', 'الدورة غير موجودة أو أرشيفها لم يكتمل')}<a href="#/archive" class="btn btn-outline mt-3">العودة للأرشيف</a></section></div></div>`;
  }
}

// ============ MATCH CARD ============
function matchCardHTML(m) {
  const tA = getTeam(m.teamAId), tB = getTeam(m.teamBId); if (!tA || !tB) return '';
  const isLive = m.status === 'live', isFin = m.status === 'finished';
  const statusLabel = isLive ? 'مباشر 🔴' : isFin ? 'انتهت' : 'قادمة';
  const statusClass = isLive ? 'live' : isFin ? 'finished' : 'upcoming';
  const hasPenalty = (m.penaltyA != null && m.penaltyB != null);
  const stageLabel = m.stage === 'final' ? '🏆 النهائي 🏆' : m.stage === 'semi_final' ? '⚡ نصف النهائي' : `الجولة ${m.round || '-'}`;
  const isFinalStage = m.stage === 'final' || m.stage === 'semi_final';
  return `<div class="match-card ${isLive ? 'live-match' : ''} ${m.stage === 'final' ? 'final-match-card' : ''} ${m.stage === 'semi_final' ? 'semifinal-match-card' : ''}" onclick="navigateTo('#/match/${m.id}')">
    <div class="match-header"><span>${stageLabel} • ${formatDate(m.date)}</span><span class="match-status ${statusClass}">${statusLabel}</span></div>
    <div class="match-teams">
      <div class="match-team">${teamLogo(tA, '52px')}<span class="team-name">${tA.name}</span></div>
      <div class="match-score">${isFin || isLive ? `<span>${m.scoreA || 0}</span><span class="divider">-</span><span>${m.scoreB || 0}</span>` : `<span style="font-size:.85rem;color:var(--text-muted)">${formatTime(m.date)}</span>`}</div>
      <div class="match-team">${teamLogo(tB, '52px')}<span class="team-name">${tB.name}</span></div>
    </div>
    ${hasPenalty ? `<div style="text-align:center;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)"><span style="font-size:.78rem;color:var(--accent);font-weight:700">ركلات الترجيح: ${m.penaltyA} - ${m.penaltyB}</span></div>` : ''}
    ${isLive && m.liveMinute ? `<div style="text-align:center;margin-top:8px"><span class="live-minute">⏱ الدقيقة ${m.liveMinute}'</span></div>` : ''}
  </div>`;
}

// ============ STANDINGS TABLE ============
function standingsTableHTML(standings, showGD) {
  return `<div class="standings-wrapper"><table class="standings-table">
    <thead><tr><th>#</th><th>الفريق</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th>${showGD ? '<th>+/-</th>' : ''}<th>نقاط</th></tr></thead>
    <tbody>${standings.map((t, i) => {
    const gd = t.gf - t.ga; return `<tr onclick="navigateTo('#/team/${t.id}')" style="cursor:pointer">
      <td><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i + 1}</span></td>
      <td><div class="team-cell">${teamLogo(t, '30px')} ${t.name}</div></td>
      <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf}</td><td>${t.ga}</td>
      ${showGD ? `<td style="color:${gd >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${gd >= 0 ? '+' : ''}${gd}</strong></td>` : ''}
      <td><strong style="color:var(--gold);font-size:1.05rem">${t.points}</strong></td>
    </tr>`}).join('')}</tbody></table></div>`;
}

// ============ HOME ============
async function renderHome() {
  updateSEO('الرئيسية', 'الدورة الرمضانية بششتا - بطولة كرة القدم الرمضانية');
  const app = document.getElementById('app');
  app.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>';

  const upcoming = cachedMatches.filter(m => m.status === 'upcoming').sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const liveMatches = cachedMatches.filter(m => m.status === 'live');
  const latestResults = cachedMatches.filter(m => m.status === 'finished').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
  const standings = calcStandings(cachedTeams, cachedMatches); // Show all instead of slice
  const topScorers = [...cachedPlayers].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 5);
  const topAssists = [...cachedPlayers].sort((a, b) => (b.assists || 0) - (a.assists || 0)).slice(0, 5);
  const topCleanSheets = [...cachedPlayers]
    .filter(p => p.isGoalkeeper)
    .map(p => {
      const teamStanding = standings.find(st => st.id === p.teamId);
      return { ...p, conceded: teamStanding ? (teamStanding.ga || 0) : 0 };
    })
    .sort((a, b) => a.conceded - b.conceded)
    .slice(0, 5);

  const upcomingList = cachedMatches.filter(m => m.status === 'upcoming').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
  const topNews = cachedNews.slice(0, 2);
  const totalGoals = cachedGoals.length;
  const finishedMatches = cachedMatches.filter(m => m.status === 'finished').length;

  // ============ بطل الدورة الرمضانية ============
  let championBannerHTML = '';
  const finalMatch = cachedMatches.find(m => m.stage === 'final' && m.status === 'finished');
  if (finalMatch) {
    let championTeam = null;
    const sA = finalMatch.scoreA || 0, sB = finalMatch.scoreB || 0;
    if (sA > sB) championTeam = getTeam(finalMatch.teamAId);
    else if (sB > sA) championTeam = getTeam(finalMatch.teamBId);
    else {
      // ركلات الترجيح
      const pA = finalMatch.penaltyA || 0, pB = finalMatch.penaltyB || 0;
      if (pA > pB) championTeam = getTeam(finalMatch.teamAId);
      else if (pB > pA) championTeam = getTeam(finalMatch.teamBId);
    }
    if (championTeam) {
      const loserTeam = championTeam.id === finalMatch.teamAId ? getTeam(finalMatch.teamBId) : getTeam(finalMatch.teamAId);
      championBannerHTML = `<section class="champion-banner">
        <div class="champion-confetti"></div>
        <div class="champion-glow"></div>
        <div class="champion-content">
          <div class="champion-trophy-icon">🏆</div>
          <h2 class="champion-title">بطل الدورة الرمضانية بششتا</h2>
          <div class="champion-team-logo">${teamLogo(championTeam, '120px', false)}</div>
          <h1 class="champion-team-name">${championTeam.name}</h1>
          <div class="champion-score">النهائي: ${finalMatch.scoreA || 0} - ${finalMatch.scoreB || 0}${(finalMatch.penaltyA != null && finalMatch.penaltyB != null) ? ' (ترجيح: ' + finalMatch.penaltyA + '-' + finalMatch.penaltyB + ')' : ''}</div>
          <div class="champion-vs">${championTeam.name} ضد ${loserTeam?.name || '---'}</div>
          <div class="champion-stars">⭐⭐⭐</div>
        </div>
      </section>`;
    }
  }

  let highlightsHTML = '';
  try {
    const s = await db.collection('highlights').orderBy('createdAt', 'desc').limit(6).get();
    const highlights = s.docs.map(d => d.data());
    if (highlights.length > 0) {
      const shorts = highlights.filter(h => h.type === 'shorts');
      const others = highlights.filter(h => h.type !== 'shorts');
      highlightsHTML = `<section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-video"></i> أحدث اللقطات</h2><a href="#/highlights" class="btn btn-sm btn-outline">عرض الكل</a></div>
      ${shorts.length > 0 ? `<div class="shorts-scroll mb-3">${shorts.map(h => `<div class="shorts-scroll-item">${highlightMediaHTML(h, '260px')}<div style="margin-top:8px;font-weight:bold;font-size:.85rem">${h.title || 'شورتز'}</div></div>`).join('')}</div>` : ''}
      ${others.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px">
        ${others.map(h => `<div class="highlight-card">${highlightMediaHTML(h, '160px')}
          <div class="highlight-card-body"><div style="font-weight:bold;font-size:.9rem">${h.title || 'لقطة مميزة'}</div></div>
        </div>`).join('')}
      </div>` : ''}
      </section>`;
    }
  } catch (e) { }

  const newsHTML = topNews.length > 0 ? `<section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-newspaper"></i> أحدث الأخبار</h2><a href="#/news" class="btn btn-sm btn-outline">عرض الكل</a></div>
    <div class="grid-2">
      ${topNews.map(n => `<div class="news-card" style="cursor:pointer;margin-bottom:0px" onclick="navigateTo('#/news-detail/${n.id}')">
        ${n.image ? `<img src="${getSafeImageUrl(n.image)}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:150px;object-fit:cover;border-radius:8px 8px 0 0" onerror="this.style.display='none'">` : ''}
        <div class="news-body"><div class="news-meta" style="margin-bottom:6px"><i class="far fa-clock"></i> ${formatDate(n.date)}</div>
        <h3 style="font-size:1.05rem;margin-bottom:8px">${n.title}</h3></div></div>`).join('')}
    </div></section>` : '';

  app.innerHTML = `
    <!-- NEW PREMIUM HERO -->
    <section class="hero hero-v2">
      <div class="hero-v2-bg">
        <div class="hero-v2-orb hero-v2-orb1"></div>
        <div class="hero-v2-orb hero-v2-orb2"></div>
        <div class="hero-v2-orb hero-v2-orb3"></div>
        <div class="hero-v2-grid"></div>
      </div>
      <div class="hero-v2-content">
        <div class="hero-v2-badge">
          <span class="hero-live-dot ${liveMatches.length > 0 ? 'pulsing' : ''}"></span>
          ${liveMatches.length > 0 ? `<span style="color:var(--red);font-weight:700">${liveMatches.length} مباراة مباشرة الآن</span>` : `<span>🌙 رمضان كريم${cachedSeason ? ' ' + cachedSeason.year : ''}</span>`}
        </div>
        <div class="hero-v2-logo-wrap">
          <img src="icon-192.png" alt="شعار الدورة" class="hero-v2-logo" width="96" height="96">
          <div class="hero-v2-logo-ring"></div>
        </div>
        <h1 class="hero-v2-title">الدورة الرمضانية<br><span class="hero-v2-title-sub">بششتا</span></h1>
        <p class="hero-v2-subtitle">بطولة كرة القدم الرمضانية • تابع المباريات والنتائج لحظة بلحظة</p>

        <!-- Live Match Banner -->
        ${liveMatches.length > 0 ? `<div class="hero-live-matches">${liveMatches.map(m => {
    const tA = getTeam(m.teamAId), tB = getTeam(m.teamBId);
    return `<div class="hero-live-card" onclick="navigateTo('#/match/${m.id}')">
            <span class="live-dot"></span>
            <span style="font-weight:700">${tA?.name || '?'}</span>
            <span class="hero-live-score">${m.scoreA || 0} - ${m.scoreB || 0}</span>
            <span style="font-weight:700">${tB?.name || '?'}</span>
            ${m.liveMinute ? `<span class="live-minute">${m.liveMinute}'</span>` : ''}
          </div>`;
  }).join('')}</div>` : ''}

        <!-- Countdown -->
        ${upcoming && liveMatches.length === 0 ? `<div class="hero-v2-countdown">
          <div class="countdown">
            <div class="countdown-item"><span class="num" id="cd-days">00</span><span class="label">يوم</span></div>
            <div class="countdown-item"><span class="num" id="cd-hours">00</span><span class="label">ساعة</span></div>
            <div class="countdown-item"><span class="num" id="cd-mins">00</span><span class="label">دقيقة</span></div>
            <div class="countdown-item"><span class="num" id="cd-secs">00</span><span class="label">ثانية</span></div>
          </div>
          <p class="text-muted" style="font-size:.84rem;margin-top:8px">⏱ العد التنازلي للمباراة القادمة</p>
        </div>` : ''}

        <!-- Stats Row -->
        <div class="hero-v2-stats">
          <div class="hero-stat-item">
            <div class="hero-stat-num" id="home-stat-teams">0</div>
            <div class="hero-stat-lbl">فريق</div>
          </div>
          <div class="hero-stat-divider"></div>
          <div class="hero-stat-item">
            <div class="hero-stat-num" id="home-stat-matches">0</div>
            <div class="hero-stat-lbl">مباراة</div>
          </div>
          <div class="hero-stat-divider"></div>
          <div class="hero-stat-item">
            <div class="hero-stat-num" id="home-stat-goals">0</div>
            <div class="hero-stat-lbl">هدف</div>
          </div>
          <div class="hero-stat-divider"></div>
          <div class="hero-stat-item">
            <div class="hero-stat-num" id="home-stat-players">0</div>
            <div class="hero-stat-lbl">لاعب</div>
          </div>
        </div>

        <!-- CTA Buttons -->
        <div class="hero-actions" style="margin-top:24px">
          <a href="#/matches" class="btn btn-primary btn-lg"><i class="fas fa-futbol"></i> المباريات</a>
          <a href="#/standings" class="btn btn-glass btn-lg"><i class="fas fa-trophy"></i> الترتيب</a>
          <a href="#/statistics" class="btn btn-glass btn-lg"><i class="fas fa-chart-bar"></i> الإحصائيات</a>
        </div>
      </div>
    </section>

    <div class="container">
      ${championBannerHTML}
      ${latestResults.length > 0 ? `<section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-clock"></i> آخر النتائج</h2><a href="#/matches" class="btn btn-sm btn-outline">عرض الكل</a></div><div class="grid-3">${latestResults.map(m => matchCardHTML(m)).join('')}</div></section>` : ''}
      
      ${newsHTML}
      
      ${highlightsHTML}
      
      ${standings.length > 0 ? `<section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-trophy"></i> جدول الترتيب</h2><a href="#/standings" class="btn btn-sm btn-outline">عرض الكامل</a></div>${standingsTableHTML(standings, false)}</section>` : ''}
      
      <!-- Hybrid Dashboard Stats -->
      ${topScorers.length > 0 || topAssists.length > 0 || topCleanSheets.length > 0 ? `
      <section class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-chart-pie"></i> إحصائيات سريعة</h2><a href="#/statistics" class="btn btn-sm btn-outline">كل الإحصائيات</a></div>
        <div class="grid-3">
          ${topScorers.length > 0 ? `<div><h3 class="section-title" style="font-size: 1.1rem; margin-bottom: 12px;"><i class="fas fa-crosshairs text-gold"></i> هدافو البطولة</h3><div class="card" style="padding: 14px;">${topScorers.map((p, i) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < topScorers.length - 1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="navigateTo('#/player/${p.id}')"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>${playerPhoto(p, '42px')}<div style="flex:1"><div style="font-weight:800; font-size: 0.95rem;">${p.name}</div><div class="text-muted" style="font-size:.75rem">${getTeam(p.teamId)?.name || ''}</div></div><div style="font-size:1.2rem;font-weight:900;color:var(--gold)">⚽ ${p.goals || 0}</div></div>`).join('')}</div></div>` : ''}
          ${topAssists.length > 0 ? `<div><h3 class="section-title" style="font-size: 1.1rem; margin-bottom: 12px;"><i class="fas fa-hands-helping text-gold"></i> صانعو الأهداف</h3><div class="card" style="padding: 14px;">${topAssists.map((p, i) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < topAssists.length - 1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="navigateTo('#/player/${p.id}')"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>${playerPhoto(p, '42px')}<div style="flex:1"><div style="font-weight:800; font-size: 0.95rem;">${p.name}</div><div class="text-muted" style="font-size:.75rem">${getTeam(p.teamId)?.name || ''}</div></div><div style="font-size:1.2rem;font-weight:900;color:var(--gold)">🅰️ ${p.assists || 0}</div></div>`).join('')}</div></div>` : ''}
          ${topCleanSheets.length > 0 ? `<div><h3 class="section-title" style="font-size: 1.1rem; margin-bottom: 12px;"><i class="fas fa-hand-paper text-gold"></i> أفضل حارس 🧤🏆</h3><div class="card" style="padding: 14px;">${topCleanSheets.map((p, i) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < topCleanSheets.length - 1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="navigateTo('#/player/${p.id}')"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>${playerPhoto(p, '42px')}<div style="flex:1"><div style="font-weight:800; font-size: 0.95rem;">${p.name}</div><div class="text-muted" style="font-size:.75rem">${getTeam(p.teamId)?.name || ''}</div></div><div style="font-size:1.2rem;font-weight:900;color:var(--green)">🧤 ${p.conceded || 0} أهداف</div></div>`).join('')}</div></div>` : ''}
        </div>
      </section>
      ` : ''}

      ${upcomingList.length > 0 ? `<section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-calendar"></i> المباريات القادمة</h2><a href="#/matches" class="btn btn-sm btn-outline">عرض الكل</a></div><div class="grid-3">${upcomingList.map(m => matchCardHTML(m)).join('')}</div></section>` : ''}
      ${cachedTeams.length === 0 && cachedMatches.length === 0 ? `<section class="section"><div class="card" style="text-align:center;padding:50px 20px"><div style="margin-bottom:14px"><img src="icon-192.png" alt="شعار الدورة" style="width:80px;height:80px;border-radius:50%" loading="lazy"></div><h2 style="color:var(--gold);margin-bottom:10px">مرحباً بكم في الدورة الرمضانية بششتا</h2><p class="text-muted" style="max-width:480px;margin:0 auto;line-height:1.8">البطولة قيد التجهيز. يتم إضافة الفرق والمباريات من لوحة التحكم.<br>تابعونا قريباً!</p></div></section>` : ''}
    </div>`;
  if (upcoming && liveMatches.length === 0) startCountdown(upcoming.date);

  // Trigger animations
  setTimeout(() => {
    animateValue('home-stat-teams', 0, cachedTeams.length, 1200);
    animateValue('home-stat-matches', 0, finishedMatches, 1200);
    animateValue('home-stat-goals', 0, totalGoals, 1200);
    animateValue('home-stat-players', 0, cachedPlayers.length, 1200);
  }, 100);
}

function startCountdown(targetDate) {
  const target = new Date(targetDate).getTime();
  const update = () => { const diff = target - Date.now(); if (diff <= 0) return; const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v).padStart(2, '0') }; set('cd-days', Math.floor(diff / 86400000)); set('cd-hours', Math.floor((diff % 86400000) / 3600000)); set('cd-mins', Math.floor((diff % 3600000) / 60000)); set('cd-secs', Math.floor((diff % 60000) / 1000)) };
  update(); setInterval(update, 1000);
}

// ============ STANDINGS PAGE ============
function renderStandings() {
  updateSEO('جدول الترتيب', 'ترتيب فرق الدورة الرمضانية بششتا');
  const standings = calcStandings(cachedTeams, cachedMatches);
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-trophy"></i> جدول الترتيب</h2></div>
    ${standings.length > 0 ? standingsTableHTML(standings, true) + `<div class="card mt-3" style="padding:14px"><p class="text-muted" style="font-size:.83rem"><i class="fas fa-info-circle text-gold"></i> الترتيب حسب: النقاط ← فارق الأهداف ← عدد الأهداف المسجلة</p></div>` : emptyHTML('fas fa-trophy', 'لا توجد فرق مسجلة بعد')}
  </section></div></div>`;
}

// ============ MATCHES PAGE ============
function renderMatches() {
  updateSEO('المباريات', 'جدول مباريات الدورة الرمضانية بششتا');
  const rounds = [...new Set(cachedMatches.filter(m => !m.stage || m.stage === 'group').map(m => m.round))].filter(Boolean).sort((a, b) => a - b);
  const hasSemiFinal = cachedMatches.some(m => m.stage === 'semi_final');
  const hasFinal = cachedMatches.some(m => m.stage === 'final');
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-futbol"></i> المباريات</h2></div>
    ${cachedMatches.length > 0 ? `<div class="tabs" id="matchTabs">
      <button class="tab-btn active" onclick="filterMatches('all',this)">الكل</button>
      <button class="tab-btn" onclick="filterMatches('live',this)">🔴 مباشر</button>
      <button class="tab-btn" onclick="filterMatches('finished',this)">منتهية</button>
      <button class="tab-btn" onclick="filterMatches('upcoming',this)">قادمة</button>
      ${rounds.map(r => `<button class="tab-btn" onclick="filterMatches('round-${r}',this)">الجولة ${r}</button>`).join('')}
      ${hasSemiFinal ? '<button class="tab-btn" onclick="filterMatches(\'stage-semi_final\',this)">⚡ نصف النهائي</button>' : ''}
      ${hasFinal ? '<button class="tab-btn" onclick="filterMatches(\'stage-final\',this)">🏆 النهائي</button>' : ''}
    </div><div class="grid-2" id="matchesGrid">${cachedMatches.map(m => `<div data-status="${m.status}" data-round="${m.round}" data-stage="${m.stage || 'group'}">${matchCardHTML(m)}</div>`).join('')}</div>` : emptyHTML('fas fa-futbol', 'لا توجد مباريات بعد')}
  </section></div></div>`;
}
function filterMatches(f, btn) {
  document.querySelectorAll('#matchTabs .tab-btn').forEach(b => b.classList.remove('active')); if (btn) btn.classList.add('active');
  document.querySelectorAll('#matchesGrid > div').forEach(c => {
    if (f === 'all') { c.style.display = ''; return }
    if (f === 'finished' || f === 'upcoming' || f === 'live') { c.style.display = c.dataset.status === f ? '' : 'none' }
    else if (f.startsWith('stage-')) { c.style.display = c.dataset.stage === f.split('-')[1] ? '' : 'none' }
    else if (f.startsWith('round-')) { c.style.display = c.dataset.round == f.split('-')[1] ? '' : 'none' }
  });
}

// ============ MATCH DETAIL ============
async function renderMatchDetail(matchId) {
  const match = cachedMatches.find(m => m.id === matchId); if (!match) { renderHome(); return }
  const tA = getTeam(match.teamAId), tB = getTeam(match.teamBId);
  const goals = getMatchGoals(matchId).sort((a, b) => (a.minute || 0) - (b.minute || 0));
  const mvp = match.mvpId ? getPlayer(match.mvpId) : null;
  const isLive = match.status === 'live', isFin = match.status === 'finished';
  const statusLabel = isLive ? '🔴 مباشر' : isFin ? 'انتهت' : 'لم تبدأ';
  const duration = match.endTime && match.date ? Math.round((new Date(match.endTime) - new Date(match.date)) / 60000) : null;

  // Load match cards
  let matchCards = [];
  try { const cs = await db.collection('cards').where('matchId', '==', matchId).get(); matchCards = cs.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { }
  const cardsA = matchCards.filter(c => c.teamId === match.teamAId);
  const cardsB = matchCards.filter(c => c.teamId === match.teamBId);
  const yellowA = cardsA.filter(c => c.type === 'yellow').length, redA = cardsA.filter(c => c.type === 'red').length;
  const yellowB = cardsB.filter(c => c.type === 'yellow').length, redB = cardsB.filter(c => c.type === 'red').length;
  const goalsA = goals.filter(g => g.teamId === match.teamAId).length;
  const goalsB = goals.filter(g => g.teamId === match.teamBId).length;

  updateSEO(`${tA?.name || '?'} vs ${tB?.name || '?'}`, `تفاصيل مباراة في الدورة الرمضانية بششتا`);

  const matchStatBar = (label, vA, vB, icon) => {
    const total = vA + vB || 1; const pA = Math.round(vA / total * 100), pB = Math.round(vB / total * 100);
    return `<div class="match-stat-row"><div class="match-stat-val" style="color:${tA?.color || 'var(--gold)'}">${vA}</div><div class="match-stat-center"><div class="match-stat-label">${icon ? `<i class="fas ${icon}"></i> ` : ''}${label}</div><div class="match-stat-bars"><div class="match-stat-bar-left" style="width:${pA}%;background:${tA?.color || 'var(--gold)'}"></div><div class="match-stat-bar-right" style="width:${pB}%;background:${tB?.color || 'var(--blue)'}"></div></div></div><div class="match-stat-val" style="color:${tB?.color || 'var(--blue)'}">${vB}</div></div>`;
  };

  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <a href="#/matches" class="btn btn-sm btn-outline mb-3"><i class="fas fa-arrow-right"></i> العودة</a>
    <div class="match-detail-header">
      <div style="font-size:.88rem;color:var(--text-muted);margin-bottom:14px">الجولة ${match.round || '-'} • ${formatDate(match.date)} <span class="match-status ${isLive ? 'live' : isFin ? 'finished' : 'upcoming'}" style="margin-right:10px">${statusLabel}</span></div>
      <div class="match-detail-teams">
        <div class="match-detail-team">${teamLogo(tA, '75px')}<h3>${tA?.name || '---'}</h3></div>
        <div class="match-detail-score">${isFin || isLive ? `${match.scoreA || 0} - ${match.scoreB || 0}` : formatTime(match.date)}</div>
        <div class="match-detail-team">${teamLogo(tB, '75px')}<h3>${tB?.name || '---'}</h3></div>
      </div>
      ${(match.penaltyA != null && match.penaltyB != null) ? `<div style="text-align:center;margin-top:8px;padding:8px 16px;background:rgba(124,92,252,0.08);border-radius:12px;display:inline-block"><span style="font-size:.88rem;color:var(--accent);font-weight:800">⚡ ركلات الترجيح: ${match.penaltyA} - ${match.penaltyB}</span></div>` : ''}
      ${isLive && match.liveMinute ? `<div style="margin-top:8px"><span class="live-minute">⏱ الدقيقة ${match.liveMinute}'</span></div>` : ''}
      ${duration ? `<div style="margin-top:8px;font-size:.85rem;color:var(--text-muted)"><i class="fas fa-stopwatch text-gold"></i> مدة المباراة: ${duration} دقيقة</div>` : ''}
      ${match.endTime ? `<div style="margin-top:4px;font-size:.82rem;color:var(--text-muted)">انتهت: ${formatTime(match.endTime)}</div>` : ''}
      ${mvp ? `<div class="mvp-badge" style="margin-top:12px"><i class="fas fa-star"></i> أفضل لاعب: ${mvp.name}</div>` : ''}
    </div>
    
    ${goals.length > 0 ? `<div class="goals-timeline mb-3"><h3 style="margin-bottom:14px;color:var(--gold)"><i class="fas fa-futbol"></i> الأهداف</h3>${goals.map(g => { const sc = getPlayer(g.playerId); const as = g.assistId ? getPlayer(g.assistId) : null; return `<div class="goal-item"><span class="goal-minute">${g.minute}'</span><div class="goal-info"><div class="goal-scorer">⚽ ${sc?.name || 'غير معروف'}</div>${as ? `<div class="goal-assist">🅰️ صنع: ${as.name}</div>` : ''}</div><span class="text-muted" style="font-size:.83rem">${getTeam(g.teamId)?.name || ''}</span></div>` }).join('')}</div>` : ''}
    ${(isFin || isLive) ? `<div class="card match-stats-card mb-3">
      <h3 style="margin-bottom:18px;color:var(--gold);text-align:center"><i class="fas fa-chart-bar"></i> إحصائيات المباراة</h3>
      <div class="match-stats-grid">
        ${matchStatBar('الأهداف', goalsA, goalsB, 'fa-futbol')}
        ${matchStatBar('بطاقات صفراء', yellowA, yellowB, 'fa-square')}
        ${matchStatBar('بطاقات حمراء', redA, redB, 'fa-square')}
        ${matchStatBar('إجمالي البطاقات', yellowA + redA, yellowB + redB, 'fa-exclamation-triangle')}
      </div>
    </div>` : ''}
    ${matchCards.length > 0 ? `<div class="card mb-3"><h3 style="margin-bottom:14px;color:var(--gold)"><i class="fas fa-square"></i> البطاقات</h3>
      ${matchCards.sort((a, b) => (a.minute || 0) - (b.minute || 0)).map(c => { const p = getPlayer(c.playerId); const t = getTeam(c.teamId); return `<div class="goal-item"><span class="goal-minute">${c.minute}'</span><div class="goal-info"><div class="goal-scorer"><span style="display:inline-block;width:14px;height:18px;border-radius:2px;background:${c.type === 'red' ? 'var(--red)' : 'var(--yellow)'};vertical-align:middle;margin-left:6px"></span> ${p?.name || 'غير معروف'}</div></div><span class="text-muted" style="font-size:.83rem">${t?.name || ''}</span></div>` }).join('')}
    </div>` : ''}
    ${match.report ? `<div class="card"><h3 style="margin-bottom:10px;color:var(--gold)"><i class="fas fa-file-alt"></i> تقرير المباراة</h3><p style="line-height:1.8;color:var(--text-secondary)">${match.report}</p></div>` : ''}
    ${isFin ? renderMVPVoting(match) : ''}
    <div id="matchHighlightsSection"></div>
  </section></div></div>`;
  // Load highlights for this match
  loadMatchHighlights(matchId);
}

// ============ MVP VOTING ============
function renderMVPVoting(match) {
  const tA = getTeam(match.teamAId), tB = getTeam(match.teamBId);
  const allPlayers = [...getTeamPlayers(match.teamAId), ...getTeamPlayers(match.teamBId)];
  if (allPlayers.length === 0) return '';
  const userVote = localStorage.getItem(`mvp_${match.id}`);
  const votes = match.mvpVotes || {};
  return `<div class="card mt-3"><h3 style="margin-bottom:14px;color:var(--gold)"><i class="fas fa-medal"></i> 🏅 صوّت لرجل المباراة</h3>
    ${userVote ? `<p class="text-muted mb-2" style="font-size:.85rem">✅ تم تسجيل صوتك</p>` : '<p class="text-muted mb-2" style="font-size:.85rem">اختر أفضل لاعب في المباراة</p>'}
    <div class="mvp-vote-grid">${allPlayers.map(p => {
    const cnt = votes[p.id] || 0; return `<div class="mvp-vote-card ${userVote === p.id ? 'selected' : ''}" onclick="voteMVP('${match.id}','${p.id}')">
      ${playerPhoto(p, '48px')}<h5>${p.name}</h5><div class="vote-count">👍 ${cnt}</div>
      <div class="text-muted" style="font-size:.72rem">${getTeam(p.teamId)?.name || ''}</div>
    </div>`}).join('')}</div></div>`;
}

async function voteMVP(matchId, playerId) {
  const key = `mvp_${matchId}`; if (localStorage.getItem(key)) { showToast('لقد صوّت بالفعل!'); return }
  localStorage.setItem(key, playerId);
  try { await db.collection('matches').doc(matchId).update({ [`mvpVotes.${playerId}`]: firebase.firestore.FieldValue.increment(1) }); showToast('تم تسجيل صوتك! 🏅'); await loadMatches(); renderMatchDetail(matchId) } catch (e) { showToast('حدث خطأ'); localStorage.removeItem(key) }
}

// ============ TEAMS ============
function renderTeams() {
  updateSEO('الفرق', 'فرق الدورة الرمضانية بششتا');
  const fullStandings = calcStandings(cachedTeams, cachedMatches);
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-users"></i> الفرق المشاركة</h2></div>
    ${cachedTeams.length > 0 ? `<div class="grid-3">${cachedTeams.map(t => {
    // Find the team in the pre-calculated full standings
    const s = fullStandings.find(st => st.id === t.id) || t; return `<div class="team-card" onclick="navigateTo('#/team/${t.id}')">${teamLogo(t, '75px')}<h3>${t.name}</h3><p>${s.played || 0} مباراة • ${s.points || 0} نقطة</p>
      <div style="display:flex;justify-content:center;gap:14px;margin-top:10px">
        <div style="text-align:center"><div style="font-size:1.2rem;font-weight:900;color:var(--green)">${s.won || 0}</div><div class="text-muted" style="font-size:.72rem">فوز</div></div>
        <div style="text-align:center"><div style="font-size:1.2rem;font-weight:900;color:var(--text-muted)">${s.drawn || 0}</div><div class="text-muted" style="font-size:.72rem">تعادل</div></div>
        <div style="text-align:center"><div style="font-size:1.2rem;font-weight:900;color:var(--red)">${s.lost || 0}</div><div class="text-muted" style="font-size:.72rem">خسارة</div></div>
      </div></div>`}).join('')}</div>` : emptyHTML('fas fa-users', 'لا توجد فرق مسجلة بعد')}
  </section></div></div>`;
}

function renderTeamDetail(teamId) {
  const team = cachedTeams.find(t => t.id === teamId); if (!team) { renderTeams(); return }
  const players = getTeamPlayers(teamId); const teamMatches = cachedMatches.filter(m => m.teamAId === teamId || m.teamBId === teamId);
  const fullStandings = calcStandings(cachedTeams, cachedMatches);
  const s = fullStandings.find(st => st.id === team.id) || {};
  const gd = (s.gf || 0) - (s.ga || 0);
  const rank = fullStandings.findIndex(st => st.id === team.id) + 1;
  const topScorer = players.sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
  const topAssist = [...players].sort((a, b) => (b.assists || 0) - (a.assists || 0))[0];

  updateSEO(team.name, `صفحة فريق ${team.name} في الدورة الرمضانية بششتا`);
  injectStructuredData({ "@context": "https://schema.org", "@type": "SportsTeam", "name": team.name, "sport": "كرة القدم", "memberOf": { "@type": "SportsOrganization", "name": "الدورة الرمضانية بششتا" }, "url": "https://dawaretramadan.netlify.app/#/team/" + teamId });

  const teamLogoHTML = team.logo
    ? `<img src="${getSafeImageUrl(team.logo)}" alt="${team.name}" class="team-hero-logo" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\'team-hero-logo-placeholder\' style=\'background:${(team.color || '#D4AF37').replace(/'/g,'')}\'>${team.name.charAt(0)}</div>'">`
    : `<div class="team-hero-logo-placeholder" style="background:${team.color || '#D4AF37'}">${team.name.charAt(0)}</div>`;

  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <a href="#/teams" class="btn btn-sm btn-outline mb-3"><i class="fas fa-arrow-right"></i> العودة للفرق</a>

    <!-- TEAM HERO -->
    <div class="team-hero">
      <div class="team-hero-content">
        ${teamLogoHTML}
        <h2>${team.name}</h2>
        <div style="font-size:.85rem;opacity:.7;margin-bottom:6px">المركز ${rank > 0 ? rank : '-'} في الترتيب</div>

        <div class="team-hero-stats">
          <div class="team-hero-stat"><div class="val">${s.points || 0}</div><div class="lbl">نقاط</div></div>
          <div class="team-hero-stat"><div class="val">${s.played || 0}</div><div class="lbl">مباراة</div></div>
          <div class="team-hero-stat"><div class="val" style="color:var(--green)">${s.won || 0}</div><div class="lbl">فوز</div></div>
          <div class="team-hero-stat"><div class="val">${s.drawn || 0}</div><div class="lbl">تعادل</div></div>
          <div class="team-hero-stat"><div class="val" style="color:var(--red)">${s.lost || 0}</div><div class="lbl">خسارة</div></div>
          <div class="team-hero-stat"><div class="val">${s.gf || 0}</div><div class="lbl">أهداف له</div></div>
          <div class="team-hero-stat"><div class="val">${s.ga || 0}</div><div class="lbl">أهداف عليه</div></div>
          <div class="team-hero-stat"><div class="val" style="color:${gd >= 0 ? 'var(--green)' : 'var(--red)'}">${gd >= 0 ? '+' : ''}${gd}</div><div class="lbl">الفارق</div></div>
        </div>

        ${s.form && s.form.length > 0 ? `<div class="team-hero-form">${s.form.slice(-5).map(f => `<span class="form-indicator form-${f.toLowerCase()}">${f === 'W' ? 'ف' : f === 'D' ? 'ت' : 'خ'}</span>`).join('')}</div>` : ''}

        <div class="team-hero-actions">
          <button class="btn btn-sm btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="shareContent('فريق ${team.name} - الدورة الرمضانية بششتا', '${window.location.href.split('#')[0]}#/team/${teamId}')"><i class="fas fa-share-alt"></i> مشاركة</button>

        </div>
      </div>
    </div>

    <!-- Quick Highlights -->
    ${topScorer && (topScorer.goals || 0) > 0 ? `<div class="card mb-3" style="padding:14px; border-right:4px solid var(--gold);">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px"><i class="fas fa-crown text-gold"></i> <strong>هداف الفريق:</strong> ${topScorer.name} <span style="color:var(--gold);font-weight:900">(${topScorer.goals} أهداف)</span></div>
        ${topAssist && (topAssist.assists || 0) > 0 ? `<div style="flex:1;min-width:200px"><i class="fas fa-hands-helping text-gold"></i> <strong>صانع الألعاب:</strong> ${topAssist.name} <span style="color:var(--gold);font-weight:900">(${topAssist.assists} تمريرة)</span></div>` : ''}
      </div>
    </div>` : ''}

    <!-- Players Grid v2 -->
    ${players.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-users"></i> اللاعبون (${players.length})</h3>
    <div class="grid-4 mt-2">${players.map(p => `<div class="player-card-v2" onclick="navigateTo('#/player/${p.id}')">
      ${playerPhoto(p, '60px')}
      <h4>${p.name}</h4>
      <div class="pc-stats">
        <div class="pc-stat"><div class="v">${p.goals || 0}</div><div class="l">أهداف</div></div>
        <div class="pc-stat"><div class="v">${p.assists || 0}</div><div class="l">صناعة</div></div>
        ${p.isGoalkeeper ? `<div class="pc-stat"><div class="v" style="color:var(--green)">${(() => { const st = fullStandings.find(s => s.id === p.teamId); return st ? (st.ga || 0) : 0; })()}</div><div class="l">مستقبلة</div></div>` : `<div class="pc-stat"><div class="v" style="color:var(--yellow)">${p.yellowCards || 0}</div><div class="l">بطاقات</div></div>`}
      </div>
    </div>`).join('')}</div>` : ''}

    <!-- Team Matches -->
    ${teamMatches.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-futbol"></i> المباريات</h3><div class="grid-2 mt-2">${teamMatches.map(m => matchCardHTML(m)).join('')}</div>` : ''}
  </section></div></div>`;
}

// ============ PLAYER ============
async function renderPlayer(playerId) {
  const player = cachedPlayers.find(p => p.id === playerId); if (!player) { renderTeams(); return }
  const team = getTeam(player.teamId); const pGoals = cachedGoals.filter(g => g.playerId === playerId);

  // Smart Matches Calculation: Manual matches + Team finished matches
  const teamFinishedMatches = cachedMatches.filter(m => (m.teamAId === player.teamId || m.teamBId === player.teamId) && m.status === 'finished').length;
  const totalMatches = (Number(player.matches) || 0) + teamFinishedMatches;

  let concededGoals = 0;
  if (player.isGoalkeeper && team) {
    const fullStandings = calcStandings(cachedTeams, cachedMatches);
    const ts = fullStandings.find(st => st.id === team.id);
    if (ts) concededGoals = ts.ga || 0;
  }

  // Calculate OVR rating based on stats
  let ovr = 50;
  if (player.isGoalkeeper) {
    const csScore = Math.min((player.cleanSheets || 0) * 15, 45);
    const matchesScore = Math.min(totalMatches * 3, 20);
    // Goals conceded penalty or inverse score
    const gaPenalty = Math.max(0, 10 - concededGoals); // very simple
    ovr = Math.min(99, Math.max(50, 60 + csScore + matchesScore + gaPenalty));
  } else {
    const goalsScore = Math.min((player.goals || 0) * 8, 40);
    const assistsScore = Math.min((player.assists || 0) * 6, 25);
    const matchesScore = Math.min(totalMatches * 3, 15);
    const cleanSheetsScore = Math.min((player.cleanSheets || 0) * 10, 20);
    ovr = Math.min(99, Math.max(50, 50 + goalsScore + assistsScore + matchesScore + cleanSheetsScore));
  }

  // Progress bar calculations (0-100)
  const allPlayers = cachedPlayers;
  const maxGoals = Math.max(...allPlayers.map(p => p.goals || 0), 1);
  const maxAssists = Math.max(...allPlayers.map(p => p.assists || 0), 1);
  const maxCS = Math.max(...allPlayers.map(p => p.cleanSheets || 0), 1);

  const attackPct = Math.round(((player.goals || 0) / maxGoals) * 100) || 0;
  const passingPct = Math.round(((player.assists || 0) / maxAssists) * 100) || 0;
  const defensePct = Math.round(((player.cleanSheets || 0) / maxCS) * 100) || 0;
  const disciplinePct = Math.max(0, 100 - ((player.yellowCards || 0) * 15 + (player.redCards || 0) * 35));

  // تحديد الشارات (Badges) الذكية
  let badgesHTML = '';
  if (player.goals >= 3) badgesHTML += `<span class="player-badge premium-badge"><i class="fas fa-fire"></i> هداف خطير</span>`;
  if (player.assists >= 2) badgesHTML += `<span class="player-badge passing-badge"><i class="fas fa-magic"></i> مايسترو الأسيست</span>`;
  if (player.isGoalkeeper && player.cleanSheets >= 2) badgesHTML += `<span class="player-badge gk-badge"><i class="fas fa-shield-alt"></i> جدار عازل</span>`;
  if (ovr >= 85) badgesHTML += `<span class="player-badge elite-badge"><i class="fas fa-star"></i> لاعب النخبة</span>`;

  updateSEO(player.name, `ملف اللاعب ${player.name} - الدورة الرمضانية بششتا`);
  injectStructuredData({ "@context": "https://schema.org", "@type": "Person", "name": player.name, "url": "https://dawaretramadan.netlify.app/#/player/" + playerId, "memberOf": { "@type": "SportsTeam", "name": team?.name || '' }, "description": `لاعب في الدورة الرمضانية بششتا - ${player.goals || 0} أهداف` });

  const fifaPhoto = player.photo
    ? `<img src="${getSafeImageUrl(player.photo)}" alt="${player.name}" class="fifa-card-photo" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\'fifa-card-photo-placeholder\'>⚽</div>'">`
    : `<div class="fifa-card-photo-placeholder">⚽</div>`;

  // تحديد الستايل الديناميكي لكارت فيفا بناءً على الـ OVR
  let cardClass = 'fifa-card';
  if (ovr >= 90) cardClass += ' fifa-card-elite';
  else if (ovr >= 80) cardClass += ' fifa-card-gold';
  else if (ovr >= 70) cardClass += ' fifa-card-silver';
  else cardClass += ' fifa-card-bronze';

  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <a href="${team ? '#/team/' + team.id : '#/teams'}" class="btn btn-sm btn-outline"><i class="fas fa-arrow-right"></i> العودة</a>
      <button class="btn btn-sm btn-outline" onclick="shareContent('اللاعب ${player.name} - الدورة الرمضانية بششتا', '${window.location.href.split('#')[0]}#/player/${playerId}')"><i class="fas fa-share-alt"></i> مشاركة</button>
    </div>

    <!-- FIFA STYLE CARD PREMIUM -->
    <div class="${cardClass}">
      <div class="fifa-card-shine"></div>
      <div class="fifa-card-ovr">${ovr}<small>OVR</small></div>
      ${fifaPhoto}
      <h3>${player.name}</h3>
      <div class="team-label">${team?.name || 'بدون فريق'}</div>
      <div class="fifa-card-stats">
        <div class="fifa-card-stat"><div class="val">${player.isGoalkeeper ? concededGoals : (player.goals || 0)}</div><div class="lbl">${player.isGoalkeeper ? 'أهداف في مرماه' : 'أهداف'}</div></div>
        <div class="fifa-card-stat"><div class="val">${player.isGoalkeeper ? (player.cleanSheets || 0) : (player.assists || 0)}</div><div class="lbl">${player.isGoalkeeper ? 'أفضل حارس' : 'صناعة'}</div></div>
        <div class="fifa-card-stat"><div class="val">${totalMatches}</div><div class="lbl">مباريات</div></div>
      </div>
    </div>
    
    ${badgesHTML ? `<div class="player-badges-container" style="text-align:center; margin-bottom: 20px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">${badgesHTML}</div>` : ''}

    <!-- DETAILED STATS GRID -->
    <div class="card mb-3" style="padding:18px">
      <h3 style="color:var(--gold);margin-bottom:16px;font-size:1rem"><i class="fas fa-chart-pie"></i> الإحصائيات التفصيلية</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:14px;text-align:center">
        ${player.isGoalkeeper ? `
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--red)">${concededGoals}</div><div class="text-muted" style="font-size:.78rem">أهداف مستقبلة</div></div>
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--green)">${player.cleanSheets || 0}</div><div class="text-muted" style="font-size:.78rem">أفضل حارس</div></div>
        ` : `
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--gold)">${player.goals || 0}</div><div class="text-muted" style="font-size:.78rem">أهداف</div></div>
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--emerald)">${player.assists || 0}</div><div class="text-muted" style="font-size:.78rem">تمريرات حاسمة</div></div>
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--green)">${player.cleanSheets || 0}</div><div class="text-muted" style="font-size:.78rem">أفضل حارس</div></div>
        `}
        <div><div style="font-size:1.4rem;font-weight:900">${totalMatches}</div><div class="text-muted" style="font-size:.78rem">مباريات</div></div>
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--yellow)">${player.yellowCards || 0}</div><div class="text-muted" style="font-size:.78rem">بطاقة صفراء</div></div>
        <div><div style="font-size:1.4rem;font-weight:900;color:var(--red)">${player.redCards || 0}</div><div class="text-muted" style="font-size:.78rem">بطاقة حمراء</div></div>
      </div>
    </div>

    <!-- ANALYSIS PROGRESS BARS -->
    <div class="card mb-3 player-analysis" style="padding:18px">
      <h3 style="color:var(--gold);margin-bottom:16px;font-size:1rem"><i class="fas fa-chart-bar"></i> تحليل مستوى اللاعب</h3>
      ${player.isGoalkeeper ? `
      <div class="progress-stat">
        <div class="label">🧤 التصديات</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:0%;background:linear-gradient(90deg,var(--green),var(--emerald))" id="bar-defense"></div></div>
        <div class="val">${defensePct}%</div>
      </div>
      ` : `
      <div class="progress-stat">
        <div class="label">⚽ الهجوم</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:0%" id="bar-attack"></div></div>
        <div class="val">${attackPct}%</div>
      </div>
      <div class="progress-stat">
        <div class="label">🅰️ التمرير</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:0%" id="bar-passing"></div></div>
        <div class="val">${passingPct}%</div>
      </div>
      <div class="progress-stat">
        <div class="label">🧤 الدفاع</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:0%;background:linear-gradient(90deg,var(--green),var(--emerald))" id="bar-defense"></div></div>
        <div class="val">${defensePct}%</div>
      </div>
      `}
      <div class="progress-stat">
        <div class="label">📋 الانضباط</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:0%;background:linear-gradient(90deg,${disciplinePct > 50 ? 'var(--green),var(--emerald)' : 'var(--red),var(--yellow)'})" id="bar-discipline"></div></div>
        <div class="val">${disciplinePct}%</div>
      </div>
    </div>

    <!-- PHOTO UPLOAD -->
    <div class="card mt-3" id="playerPhotoUploadCard">
      <h4 style="color:var(--gold);margin-bottom:12px"><i class="fas fa-camera"></i> رفع صورة اللاعب</h4>
      <p class="text-muted" style="font-size:.85rem;margin-bottom:12px">ارفع صورة لـ ${player.name} وسيتم تحديثها مباشرة</p>
      <input type="file" id="playerPhotoInput" accept="image/*" style="display:none" onchange="handlePlayerPhotoUpload(this, '${playerId}', '${player.name}')">
      <button class="btn btn-sm btn-outline" onclick="document.getElementById('playerPhotoInput').click()"><i class="fas fa-upload"></i> اختر صورة</button>
    </div>

    <!-- GOALS TIMELINE -->
    ${pGoals.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-futbol"></i> أهداف اللاعب</h3><div class="goals-timeline mt-2">${pGoals.map(g => { const match = cachedMatches.find(m => m.id === g.matchId); const oppId = match ? (match.teamAId === player.teamId ? match.teamBId : match.teamAId) : null; const opp = oppId ? getTeam(oppId) : null; return `<div class="goal-item"><span class="goal-minute">${g.minute}'</span><div class="goal-info"><div class="goal-scorer">⚽ ضد ${opp?.name || '---'}</div><div class="goal-assist">${match ? formatDate(match.date) : ''}</div></div></div>` }).join('')}</div>` : ''}
    <div id="playerHighlightsSection"></div>
  </section></div></div>`;

  // Animate progress bars
  setTimeout(() => {
    const bA = document.getElementById('bar-attack'); if (bA) bA.style.width = attackPct + '%';
    const bP = document.getElementById('bar-passing'); if (bP) bP.style.width = passingPct + '%';
    const bD = document.getElementById('bar-defense'); if (bD) bD.style.width = defensePct + '%';
    const bDi = document.getElementById('bar-discipline'); if (bDi) bDi.style.width = disciplinePct + '%';
  }, 200);

  // Load highlights for this player
  loadPlayerHighlights(playerId);
}

async function handlePlayerPhotoUpload(input, playerId, playerName) {
  const file = input.files[0]; if (!file) return;
  // Show upload progress
  const card = document.getElementById('playerPhotoUploadCard');
  if (card) card.innerHTML = `<div style="text-align:center;padding:20px"><i class="fas fa-futbol fa-spin-roll" style="font-size:2rem;color:var(--gold)"></i><p style="margin-top:10px;color:var(--text-muted)">جاري رفع وضغط الصورة...</p></div>`;
  showToast('⏳ جاري رفع الصورة...');
  const url = await uploadToImgBB(file);
  if (!url) { showToast('فشل رفع الصورة ❌'); renderPlayer(playerId); return }
  try {
    await db.collection('players').doc(playerId).update({ photo: url });
    const p = cachedPlayers.find(x => x.id === playerId);
    if (p) p.photo = url;
    showToast('تم تحديث صورة اللاعب بنجاح! ✅');
    renderPlayer(playerId);
  } catch (e) { showToast('حدث خطأ: ' + e.message); renderPlayer(playerId); }
}

// ============ STATISTICS ============
function renderStatistics() {
  updateSEO('الإحصائيات', 'إحصائيات الدورة الرمضانية بششتا');
  const standings = calcStandings(cachedTeams, cachedMatches);
  const topScorers = [...cachedPlayers].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 5);
  const topAssists = [...cachedPlayers].sort((a, b) => (b.assists || 0) - (a.assists || 0)).slice(0, 5);
  const bestAttack = [...standings].sort((a, b) => b.gf - a.gf).slice(0, 3);
  const bestDefense = [...standings].sort((a, b) => a.ga - b.ga).slice(0, 3);
  const totalGoals = standings.reduce((s, t) => s + t.gf, 0); const totalMatches = cachedMatches.filter(m => m.status === 'finished').length;
  const avg = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0';

  // Best Goalkeeper leaderboard (least conceded goals)
  const topCleanSheets = [...cachedPlayers]
    .filter(p => p.isGoalkeeper)
    .map(p => {
      const teamStanding = standings.find(st => st.id === p.teamId);
      return { ...p, conceded: teamStanding ? (teamStanding.ga || 0) : 0 };
    })
    .sort((a, b) => a.conceded - b.conceded)
    .slice(0, 5);
  const totalCleanSheets = cachedPlayers.reduce((s, p) => s + (p.cleanSheets || 0), 0);

  // Most MVP leaderboard - count mvpId across all finished matches
  const mvpCounts = {};
  cachedMatches.filter(m => m.status === 'finished' && m.mvpId).forEach(m => { mvpCounts[m.mvpId] = (mvpCounts[m.mvpId] || 0) + 1; });
  const topMVPs = Object.entries(mvpCounts).map(([id, count]) => ({ ...getPlayer(id), mvpCount: count })).filter(p => p && p.name).sort((a, b) => b.mvpCount - a.mvpCount).slice(0, 5);

  const pList = (list, field) => list.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < list.length - 1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="navigateTo('#/player/${p.id}')"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i + 1}</span>${playerPhoto(p, '36px')}<div style="flex:1"><div style="font-weight:700">${p.name}</div><div class="text-muted" style="font-size:.78rem">${getTeam(p.teamId)?.name || ''}</div></div><div style="font-size:1.2rem;font-weight:900;color:var(--gold)">${p[field] || 0}</div></div>`).join('');
  const tList = (list, field, color, unit) => list.map((t, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < list.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i + 1}</span>${teamLogo(t, '34px')}<div style="flex:1;font-weight:700">${t.name}</div><div style="font-size:1.1rem;font-weight:900;color:var(--${color})">${t[field]} ${unit}</div></div>`).join('');
  // MVP list renderer (uses mvpCount field)
  const mvpList = (list) => list.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < list.length - 1 ? 'border-bottom:1px solid var(--border)' : ''};cursor:pointer" onclick="navigateTo('#/player/${p.id}')"><span class="rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-default'}">${i + 1}</span>${playerPhoto(p, '36px')}<div style="flex:1"><div style="font-weight:700">${p.name}</div><div class="text-muted" style="font-size:.78rem">${getTeam(p.teamId)?.name || ''}</div></div><div style="font-size:1.2rem;font-weight:900;color:var(--gold)"><i class="fas fa-medal" style="margin-left:4px"></i> ${p.mvpCount}</div></div>`).join('');

  // Best goalkeeper (most clean sheets)
  const bestGK = topCleanSheets[0];

  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-chart-bar"></i> إحصائيات البطولة</h2></div>
    ${cachedTeams.length > 0 || cachedPlayers.length > 0 ? `
    <div class="grid-4 mb-3">
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-futbol"></i></div><div class="stat-value" id="stat-total-goals">0</div><div class="stat-label">إجمالي الأهداف</div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-gamepad"></i></div><div class="stat-value" id="stat-total-matches">0</div><div class="stat-label">مباريات لُعبت</div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-value">${avg}</div><div class="stat-label">معدل أهداف/مباراة</div></div>
      <div class="stat-card"><div class="stat-icon" style="color:var(--green)"><i class="fas fa-hand-paper"></i></div><div class="stat-value" id="stat-clean-sheets">0</div><div class="stat-label">أهداف الحراس</div></div>
    </div>
    ${bestGK ? `<div class="card best-gk-card mb-3">
      <div class="best-gk-inner">
        <div class="best-gk-icon">🧤</div>
        <div class="best-gk-content">
          <div class="best-gk-title"><i class="fas fa-award"></i> أفضل حارس في البطولة</div>
          <div class="best-gk-player" onclick="navigateTo('#/player/${bestGK.id}')" style="cursor:pointer">
            ${playerPhoto(bestGK, '60px')}
            <div><h3>${bestGK.name}</h3><p class="text-muted">${getTeam(bestGK.teamId)?.name || ''}</p></div>
            <div class="best-gk-stat"><div class="val">${bestGK.conceded}</div><div class="lbl">أهداف مستقبلة</div></div>
          </div>
        </div>
      </div>
    </div>` : ''}
    <div class="grid-2">
      <div><h3 class="section-title"><i class="fas fa-crosshairs"></i> هدافو البطولة</h3><div class="card mt-2">${topScorers.length > 0 ? pList(topScorers, 'goals') : '<p class="text-muted" style="padding:14px">لا توجد بيانات</p>'}</div></div>
      <div><h3 class="section-title"><i class="fas fa-hands-helping"></i> صانعو الأهداف</h3><div class="card mt-2">${topAssists.length > 0 ? pList(topAssists, 'assists') : '<p class="text-muted" style="padding:14px">لا توجد بيانات</p>'}</div></div>
    </div>
    <div class="grid-2 mt-3">
      <div><h3 class="section-title"><i class="fas fa-hand-paper"></i> أفضل حارس 🧤🏆</h3><div class="card mt-2">${topCleanSheets.length > 0 ? pList(topCleanSheets, 'conceded') : '<p class="text-muted" style="padding:14px">لا توجد بيانات</p>'}</div></div>
      <div><h3 class="section-title"><i class="fas fa-medal"></i> أكثر فوزاً بـ MVP 🏅</h3><div class="card mt-2">${topMVPs.length > 0 ? mvpList(topMVPs) : '<p class="text-muted" style="padding:14px">لا توجد بيانات</p>'}</div></div>
    </div>
    <div class="grid-2 mt-3">
      <div><h3 class="section-title"><i class="fas fa-fire"></i> أقوى هجوم</h3><div class="card mt-2">${tList(bestAttack, 'gf', 'green', 'هدف')}</div></div>
      <div><h3 class="section-title"><i class="fas fa-shield-alt"></i> أقوى دفاع</h3><div class="card mt-2">${tList(bestDefense, 'ga', 'blue', 'هدف')}</div></div>
    </div>`: emptyHTML('fas fa-chart-bar', 'لا توجد إحصائيات بعد')}
  </section></div></div>`;

  // Trigger animations
  setTimeout(() => {
    animateValue('stat-total-goals', 0, totalGoals, 1000);
    animateValue('stat-total-matches', 0, totalMatches, 1000);
    animateValue('stat-clean-sheets', 0, totalCleanSheets, 1000); // optional if you want to sum conceded goals instead
  }, 100);
}

// ============ NEWS ============
function renderNews() {
  updateSEO('الأخبار', 'أخبار الدورة الرمضانية بششتا');
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-newspaper"></i> أخبار البطولة</h2></div>
    ${cachedNews.length > 0 ? `<div class="grid-3">${cachedNews.map(n => {
    return `<div class="news-card"><div onclick="navigateTo('#/news-detail/${n.id}')" style="cursor:pointer">
        ${n.image ? `<img class="news-img" src="${getSafeImageUrl(n.image)}" alt="${n.title}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="news-img-placeholder">📰</div>`}
        <div class="news-body"><div class="news-date"><i class="fas fa-calendar"></i> ${formatDate(n.date)}</div><h3>${n.title}</h3><p>${(n.body || '').substring(0, 90)}...</p></div>
      </div></div>`;
  }).join('')}</div>` : emptyHTML('fas fa-newspaper', 'لا توجد أخبار حالياً')}
  </section></div></div>`;
}

// ============ POLL ============
function renderPollMini(n) {
  if (!n.poll || !n.poll.question) return '';
  const voted = localStorage.getItem(`poll_${n.id}`);
  const opts = n.poll.options || []; const votes = n.poll.votes || [];
  const total = votes.reduce((s, v) => s + (v || 0), 0);
  return `<div class="poll-widget"><div class="poll-question">📊 ${n.poll.question}</div>
    ${opts.map((o, i) => {
    const cnt = votes[i] || 0; const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
    if (voted !== null) return `<div class="poll-bar-wrap"><div class="poll-bar-fill" style="width:${pct}%"></div><div class="poll-bar-label"><span>${o}</span><span class="poll-pct">${pct}%</span></div></div>`;
    return `<div class="poll-option"><button class="poll-option-btn" onclick="event.stopPropagation();votePoll('${n.id}',${i})">${o}</button></div>`;
  }).join('')}
    ${total > 0 ? `<div class="poll-total">${total} صوت</div>` : ''}
  </div>`;
}

function renderPollFull(n) {
  if (!n.poll || !n.poll.question) return '';
  const voted = localStorage.getItem(`poll_${n.id}`);
  const opts = n.poll.options || []; const votes = n.poll.votes || [];
  const total = votes.reduce((s, v) => s + (v || 0), 0);
  return `<div class="poll-widget" style="margin-top:20px"><div class="poll-question">📊 ${n.poll.question}</div>
    ${opts.map((o, i) => {
    const cnt = votes[i] || 0; const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
    if (voted !== null) return `<div class="poll-bar-wrap"><div class="poll-bar-fill" style="width:${pct}%"></div><div class="poll-bar-label"><span>${o} (${cnt})</span><span class="poll-pct">${pct}%</span></div></div>`;
    return `<div class="poll-option"><button class="poll-option-btn" onclick="votePoll('${n.id}',${i})">${o}</button></div>`;
  }).join('')}
    ${total > 0 ? `<div class="poll-total">${total} صوت</div>` : ''}
  </div>`;
}

async function votePoll(newsId, optIdx) {
  if (!requireAuth('التصويت')) return;
  if (localStorage.getItem(`poll_${newsId}`)) { showToast('لقد صوّت بالفعل!'); return }
  localStorage.setItem(`poll_${newsId}`, String(optIdx));
  try {
    const docRef = db.collection('news').doc(newsId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error('الخبر غير موجود');
    const data = doc.data();
    const votes = data.poll && data.poll.votes ? [...data.poll.votes] : [];
    while (votes.length <= optIdx) votes.push(0);
    votes[optIdx] = (votes[optIdx] || 0) + 1;
    await docRef.update({ 'poll.votes': votes });
    showToast('تم تسجيل صوتك! ✅');
    await loadNews();
    const hash = window.location.hash.slice(2) || '';
    if (hash.startsWith('news-detail')) showNewsDetail(newsId); else renderNews();
  } catch (e) { showToast('حدث خطأ'); localStorage.removeItem(`poll_${newsId}`) }
}

// ============ NEWS DETAIL + COMMENTS ============
async function showNewsDetail(newsId) {
  const news = cachedNews.find(n => n.id === newsId); if (!news) { renderNews(); return }
  updateSEO(news.title, (news.body || '').substring(0, 160));
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <a href="#/news" class="btn btn-sm btn-outline mb-3"><i class="fas fa-arrow-right"></i> العودة</a>
    <article class="card" style="padding:28px">
      ${news.image ? `<img src="${getSafeImageUrl(news.image)}" alt="${news.title}" style="width:100%;border-radius:var(--radius);margin-bottom:20px" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <div class="news-date mb-2"><i class="fas fa-calendar"></i> ${formatDate(news.date)}</div>
      <h1 style="font-size:1.5rem;margin-bottom:14px;color:var(--gold)">${news.title}</h1>
      <p style="line-height:2;color:var(--text-secondary);font-size:1.02rem">${news.body || ''}</p>
      ${renderPollFull(news)}
    </article>
  </section></div></div>`;
}

async function loadCommentsHTML(newsId) {
  try {
    let snap;
    try { snap = await db.collection('comments').where('newsId', '==', newsId).orderBy('createdAt', 'desc').get(); }
    catch (indexErr) { snap = await db.collection('comments').where('newsId', '==', newsId).get(); }
    if (snap.empty) return '<p class="text-muted" style="font-size:.85rem;padding:10px">لا توجد تعليقات بعد. كن أول من يعلّق!</p>';
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // load approved profiles
    let profiles = {};
    try { const ps = await db.collection('userProfiles').where('status', '==', 'approved').get(); ps.docs.forEach(d => { const p = d.data(); profiles[p.name] = p.photo }); } catch (e) { }
    return comments.map(c => {
      const photo = profiles[c.name];
      const safeName = escapeHTML(c.name || 'مجهول');
      const avatarHTML = photo ? `<div class="comment-avatar"><img src="${getSafeImageUrl(photo)}" alt="${safeName}" loading="lazy"></div>` : `<div class="comment-avatar">${escapeHTML((c.name || '?').charAt(0))}</div>`;
      return `<div class="comment-item">${avatarHTML}<div class="comment-body"><div class="comment-name">${safeName}</div><div class="comment-text">${escapeHTML(c.text || '').replace(/\n/g, '<br>')}</div><div class="comment-time">${timeAgo(c.createdAt)}</div></div></div>`;
    }).join('');
  } catch (e) { console.error('Comments error:', e); return '<p class="text-muted" style="font-size:.85rem;padding:10px">تعذر تحميل التعليقات</p>' }
}

async function postComment(newsId) {
  if (!requireAuth('التعليق')) return;
  const name = document.getElementById('commentName').value.trim(); const text = document.getElementById('commentText').value.trim();
  if (!name || !text) { showToast('يرجى كتابة اسمك والتعليق'); return }
  localStorage.setItem('profile_name', name);
  try {
    await db.collection('comments').add({ newsId, name, text, createdAt: new Date().toISOString(), uid: auth.currentUser?.uid || '' });
    showToast('تم إضافة تعليقك ✅'); document.getElementById('commentText').value = '';
    document.getElementById('commentList').innerHTML = await loadCommentsHTML(newsId);
  } catch (e) { showToast('حدث خطأ: ' + e.message) }
}

// ============ PROFILE PHOTO ============
function getLocalProfileName() { return localStorage.getItem('profile_name') || '' }
function getLocalProfilePhoto() { return localStorage.getItem('profile_photo_url') || '' }
function getLocalProfileStatus() { return localStorage.getItem('profile_photo_status') || 'none' }
function getProfileStatusText() {
  const photo = getLocalProfilePhoto();
  if (photo) return '✅ صورة محفوظة';
  return '📷 اضغط لإضافة صورة';
}
async function handleProfilePhotoUpload(input) {
  const file = input.files[0]; if (!file) return;
  const name = document.getElementById('commentName')?.value.trim();
  if (!name) { showToast('يرجى كتابة اسمك أولاً'); return }
  showToast('⏳ جاري رفع الصورة...');
  const url = await uploadToImgBB(file);
  if (!url) { showToast('فشل رفع الصورة ❌'); return }
  try {
    // Save profile directly without approval
    const existing = await db.collection('userProfiles').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ photo: url, status: 'approved', updatedAt: new Date().toISOString() });
    } else {
      await db.collection('userProfiles').add({ name, photo: url, status: 'approved', createdAt: new Date().toISOString() });
    }
    localStorage.setItem('profile_name', name);
    localStorage.setItem('profile_photo_url', url);
    localStorage.setItem('profile_photo_status', 'approved');
    const preview = document.getElementById('profileAvatarPreview');
    if (preview) preview.innerHTML = `<img src="${getSafeImageUrl(url)}" alt="صورتي" loading="lazy">`;
    const statusEl = document.getElementById('profileStatusText');
    if (statusEl) { statusEl.textContent = '✅ صورة محفوظة'; statusEl.className = 'profile-status approved' }
    showToast('تم رفع صورتك بنجاح! ✅');
  } catch (e) { showToast('حدث خطأ: ' + e.message) }
}

// ============ LINEUP / FORMATION PAGE ============
const FORMATIONS = {
  '4-3-3': { name: '4-3-3', rows: [[9], [7, 8, 10], [2, 5, 6, 3], [1]] },
  '4-4-2': { name: '4-4-2', rows: [[9, 11], [7, 8, 10, 4], [2, 5, 6, 3], [1]] },
  '4-2-3-1': { name: '4-2-3-1', rows: [[9], [7, 8, 11], [4, 6], [2, 5, 3, 12], [1]] },
  '3-5-2': { name: '3-5-2', rows: [[9, 11], [7, 8, 10, 4, 6], [2, 5, 3], [1]] },
  '5-3-2': { name: '5-3-2', rows: [[9, 11], [7, 8, 10], [2, 3, 5, 6, 4], [1]] },
};

async function renderLineupPage(teamId) {
  await loadAllData();
  const team = teamId ? cachedTeams.find(t => t.id === teamId) : null;
  const players = teamId ? getTeamPlayers(teamId) : [];
  updateSEO('التشكيلة التكتيكية', 'عرض التشكيلة التكتيكية للفرق');
  const teamOpts = cachedTeams.map(t => `<option value="${t.id}" ${t.id === teamId ? 'selected' : ''}>${t.name}</option>`).join('');
  const fOpts = Object.keys(FORMATIONS).map(k => `<option value="${k}">${k}</option>`).join('');
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-th"></i> التشكيلة التكتيكية</h2></div>
    <div class="card" style="margin-bottom:20px">
      <div class="grid-2" style="gap:12px">
        <div class="form-group" style="margin:0"><label>اختر الفريق</label>
          <select id="lineupTeamSel" onchange="navigateTo('#/lineup/'+this.value)" style="width:100%">
            <option value="">-- اختر فريق --</option>${teamOpts}
          </select>
        </div>
        <div class="form-group" style="margin:0"><label>التشكيلة</label>
          <select id="lineupFormSel" onchange="renderLineupField()" style="width:100%">${fOpts}</select>
        </div>
      </div>
    </div>
    <div id="lineupFieldWrap">${team && players.length > 0 ? buildLineupField(team, players, '4-3-3') : '<div class="empty-state"><i class="fas fa-futbol"></i><p>اختر فريق لعرض التشكيلة</p></div>'}</div>
  </section></div></div>`;
  window._lineupTeam = team;
  window._lineupPlayers = players;
}

function buildLineupField(team, players, formation) {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const color = team ? (team.color || '#D4AF37') : '#D4AF37';
  // Distribute players into rows
  const positions = ['حارس', 'قلب دفاع', 'قلب دفاع', 'دفاع أيمن', 'دفاع أيسر', 'وسط (%دفاعي)', 'وسط', 'وسط (هجومي)', 'جناح أيمن', 'جناح أيسر', 'مهاجم', 'مهاجم ثاني'];
  const totalSlots = f.rows.reduce((s, r) => s + r.length, 0);
  const usedPlayers = players.slice(0, totalSlots);
  let pIdx = 0;
  const rowsHTML = [...f.rows].reverse().map(row => {
    const cellsHTML = row.map(() => {
      const p = usedPlayers[pIdx++];
      if (!p) return `<div class="lineup-player-slot empty"><div class="lineup-player-circle" style="background:rgba(255,255,255,.15)">?</div><span class="lineup-player-name">-</span></div>`;
      const photo = p.photo ? `<img src="${getSafeImageUrl(p.photo)}" alt="${p.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" loading="lazy">` : `<span style="font-size:1.3rem;color:#fff">${p.name.charAt(0)}</span>`;
      return `<div class="lineup-player-slot" onclick="navigateTo('#/player/${p.id}')">
        <div class="lineup-player-circle" style="background:${color};border:3px solid rgba(255,255,255,.7)">${photo}</div>
        <span class="lineup-player-name">${p.name.split(' ')[0]}</span>
        ${p.goals ? `<span class="lineup-player-stat">⚽${p.goals}</span>` : ''}
      </div>`;
    }).join('');
    return `<div class="lineup-row">${cellsHTML}</div>`;
  }).join('');
  return `<div class="lineup-field">
    <div class="lineup-field-inner">
      <div class="lineup-field-header">${team ? teamLogo(team, '40px', false) : ''}<span style="color:#fff;font-weight:900;font-size:1.1rem">${team?.name || ''}</span></div>
      <div class="lineup-rows">${rowsHTML}</div>
      <div class="lineup-field-middle-line"></div>
    </div>
  </div>
  <div style="text-align:center;margin-top:8px;color:var(--text-muted);font-size:.82rem"><i class="fas fa-info-circle"></i> انقر على اللاعب لعرض ملفه</div>`;
}

function renderLineupField() {
  const formation = document.getElementById('lineupFormSel')?.value || '4-3-3';
  const wrap = document.getElementById('lineupFieldWrap');
  if (wrap && window._lineupTeam) wrap.innerHTML = buildLineupField(window._lineupTeam, window._lineupPlayers, formation);
}

// ============ SEARCH ============
function renderSearchResults(query) {
  if (!query) query = '';
  query = decodeURIComponent(query).trim();
  updateSEO('بحث: ' + query, 'نتائج البحث عن ' + query + ' في الدورة الرمضانية بششتا');
  const q = query.toLowerCase();
  const teamResults = cachedTeams.filter(t => t.name.toLowerCase().includes(q));
  const playerResults = cachedPlayers.filter(p => p.name.toLowerCase().includes(q));
  const matchResults = cachedMatches.filter(m => {
    const tA = getTeam(m.teamAId), tB = getTeam(m.teamBId);
    return (tA?.name.toLowerCase().includes(q)) || (tB?.name.toLowerCase().includes(q));
  });
  const newsResults = cachedNews.filter(n => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q));
  const total = teamResults.length + playerResults.length + matchResults.length + newsResults.length;
  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="section-header"><h2 class="section-title"><i class="fas fa-search"></i> نتائج البحث</h2></div>
    <div class="card mb-3" style="padding:14px"><div style="display:flex;gap:10px;align-items:center">
      <input type="text" id="searchInput" class="search-input-box" placeholder="ابحث عن فريق، لاعب، خبر..." value="${query}" style="flex:1" onkeydown="if(event.key==='Enter')doSearch()">
      <button class="btn btn-primary btn-sm" onclick="doSearch()"><i class="fas fa-search"></i></button>
    </div></div>
    ${total === 0 && query ? '<div class="empty-state"><i class="fas fa-search"></i><p>لا توجد نتائج لبحثك</p></div>' : ''}
    ${!query ? '<div class="empty-state"><i class="fas fa-search"></i><p>اكتب كلمة للبحث</p></div>' : ''}
    ${teamResults.length > 0 ? `<h3 class="section-title mt-2"><i class="fas fa-users"></i> فرق (${teamResults.length})</h3><div class="grid-3 mt-2">${teamResults.map(t => `<div class="team-card" onclick="navigateTo('#/team/${t.id}')">${teamLogo(t, '60px')}<h3>${t.name}</h3></div>`).join('')}</div>` : ''}
    ${playerResults.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-user"></i> لاعبون (${playerResults.length})</h3><div class="grid-4 mt-2">${playerResults.map(p => `<div class="player-card" onclick="navigateTo('#/player/${p.id}')">${playerPhoto(p, '55px')}<h4>${p.name}</h4><div class="text-muted" style="font-size:.78rem">${getTeam(p.teamId)?.name || ''}</div></div>`).join('')}</div>` : ''}
    ${matchResults.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-futbol"></i> مباريات (${matchResults.length})</h3><div class="grid-2 mt-2">${matchResults.slice(0, 6).map(m => matchCardHTML(m)).join('')}</div>` : ''}
    ${newsResults.length > 0 ? `<h3 class="section-title mt-3"><i class="fas fa-newspaper"></i> أخبار (${newsResults.length})</h3><div class="grid-3 mt-2">${newsResults.slice(0, 6).map(n => `<div class="news-card" style="cursor:pointer" onclick="navigateTo('#/news-detail/${n.id}')"><div class="news-body"><h3>${n.title}</h3><p>${(n.body || '').substring(0, 80)}...</p></div></div>`).join('')}</div>` : ''}
  </section></div></div>`;
}
function doSearch() { const v = document.getElementById('searchInput')?.value.trim(); if (v) navigateTo('#/search/' + encodeURIComponent(v)) }

// ============ SHARE ============
async function shareContent(title, url) {
  try {
    if (navigator.share) await navigator.share({ title, url });
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); showToast('تم نسخ رابط البطولة 📎'); }
    else showToast(url);
  } catch (error) { if (error.name !== 'AbortError') showToast('تعذرت المشاركة من هذا الجهاز'); }
}

// ============ HIGHLIGHTS (ImgBB + YouTube + Shorts) ============
function highlightMediaHTML(h, height = '180px') {
  if (h.type === 'shorts') {
    return `<div class="shorts-card-wrap"><div class="shorts-player" style="height:${parseInt(height) > 200 ? '320px' : '280px'}"><iframe src="https://www.youtube.com/embed/${h.url}?rel=0&loop=1&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" webkit-playsinline playsinline></iframe><div class="shorts-badge"><i class="fab fa-youtube"></i> Shorts</div></div></div>`;
  }
  if (h.type === 'youtube') {
    return `<div style="position:relative;width:100%;height:${height};background:#000;border-radius:12px;overflow:hidden"><iframe width="100%" height="100%" src="https://www.youtube.com/embed/${h.url}?rel=0&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" webkit-playsinline playsinline></iframe></div>`;
  }
  return `<a href="${h.url}" target="_blank"><img src="${getSafeImageUrl(h.url)}" loading="lazy" style="width:100%;height:${height};object-fit:cover;border-radius:12px;cursor:pointer"></a>`;
}

async function loadMatchHighlights(matchId) {
  const sec = document.getElementById('matchHighlightsSection'); if (!sec) return;
  try {
    const s = await db.collection('highlights').where('matchId', '==', matchId).orderBy('createdAt', 'desc').get();
    const highlights = s.docs.map(d => d.data());
    if (highlights.length === 0) { sec.innerHTML = ''; return; }
    const shorts = highlights.filter(h => h.type === 'shorts');
    const others = highlights.filter(h => h.type !== 'shorts');
    sec.innerHTML = `<div class="card mt-3"><h3 style="margin-bottom:14px;color:var(--gold)"><i class="fas fa-images"></i> أهم لقطات المباراة (${highlights.length})</h3>
      ${shorts.length > 0 ? `<div class="shorts-scroll mb-3">${shorts.map(h => `<div class="shorts-scroll-item">${highlightMediaHTML(h, '280px')}<div style="margin-top:8px;font-weight:700;font-size:.85rem">${h.title || 'شورتز'}</div></div>`).join('')}</div>` : ''}
      ${others.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${others.map(h => `<div style="position:relative">
          ${highlightMediaHTML(h, '160px')}
          <div style="margin-top:8px"><div style="font-weight:700;font-size:.9rem">${h.title || 'لقطة مميزة'}</div>
            ${h.playerId ? `<div style="font-size:.82rem;color:var(--gold);margin-top:3px"><i class="fas fa-user"></i> ${getPlayer(h.playerId)?.name || ''}</div>` : ''}
          </div></div>`).join('')}
      </div>` : ''}
    </div>`;
  } catch (e) { sec.innerHTML = ''; }
}

async function loadPlayerHighlights(playerId) {
  const sec = document.getElementById('playerHighlightsSection'); if (!sec) return;
  try {
    const s = await db.collection('highlights').where('playerId', '==', playerId).orderBy('createdAt', 'desc').get();
    const highlights = s.docs.map(d => d.data());
    if (highlights.length === 0) { sec.innerHTML = ''; return; }
    const shorts = highlights.filter(h => h.type === 'shorts');
    const others = highlights.filter(h => h.type !== 'shorts');
    sec.innerHTML = `<h3 class="section-title mt-3"><i class="fas fa-images"></i> لقطات اللاعب (${highlights.length})</h3>
      ${shorts.length > 0 ? `<div class="shorts-scroll mt-2">${shorts.map(h => `<div class="shorts-scroll-item">${highlightMediaHTML(h, '260px')}<div style="margin-top:6px;font-weight:700;font-size:.85rem">${h.title || 'شورتز'}</div></div>`).join('')}</div>` : ''}
      ${others.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:10px">
        ${others.map(h => `<div>${highlightMediaHTML(h, '140px')}<div style="font-weight:700;font-size:.85rem;margin-top:6px">${h.title || 'لقطة'}</div></div>`).join('')}
      </div>` : ''}`;
  } catch (e) { sec.innerHTML = ''; }
}

async function renderHighlights() {
  const container = document.getElementById('app');
  container.innerHTML = '<div class="page-content"><div class="container"><section class="section"><div class="section-header"><h2 class="section-title"><i class="fas fa-star"></i> أهم اللقطات</h2></div><div style="text-align:center;padding:40px"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div></section></div></div>';
  updateSEO('أهم اللقطات', 'شاهد أجمل اللقطات والشورتز من البطولة.', '/highlights');

  try {
    const s = await db.collection('highlights').orderBy('createdAt', 'desc').get();
    const highlights = s.docs.map(d => d.data());
    const shorts = highlights.filter(h => h.type === 'shorts');
    const others = highlights.filter(h => h.type !== 'shorts');

    container.innerHTML = `
      <div class="page-content"><div class="container"><section class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-star"></i> أهم اللقطات</h2></div>
        ${shorts.length > 0 ? `
          <div class="shorts-section-header"><i class="fab fa-youtube" style="color:#FF0000"></i> <span>شورتز البطولة</span> <span class="shorts-count">${shorts.length}</span></div>
          <div class="shorts-scroll mb-3">${shorts.map(h => {
      const player = h.playerId ? getPlayer(h.playerId) : null;
      return `<div class="shorts-scroll-item">${highlightMediaHTML(h, '340px')}
        <div style="margin-top:8px"><div style="font-weight:700;font-size:.9rem">${h.title || 'شورتز'}</div>
        ${player ? `<div style="font-size:.82rem;color:var(--gold);margin-top:3px;cursor:pointer" onclick="navigateTo('#/player/${h.playerId}')"><i class="fas fa-user"></i> ${player.name}</div>` : ''}
        </div></div>`;
    }).join('')}</div>` : ''}
        ${others.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:16px">
          ${others.map(h => {
      const player = h.playerId ? getPlayer(h.playerId) : null;
      const match = h.matchId ? cachedMatches.find(m => m.id === h.matchId) : null;
      const tA = match ? getTeam(match.teamAId) : null, tB = match ? getTeam(match.teamBId) : null;
      return `<div class="highlight-card">${highlightMediaHTML(h, '180px')}
        <div class="highlight-card-body">
          <h3>${h.title || 'لقطة مميزة'}</h3>
          ${player ? `<div class="highlight-player" onclick="navigateTo('#/player/${h.playerId}')"><i class="fas fa-user"></i> ${player.name}</div>` : ''}
          ${match ? `<div class="highlight-match" onclick="navigateTo('#/match/${h.matchId}')"><i class="fas fa-futbol"></i> ${tA?.name || '?'} vs ${tB?.name || '?'}</div>` : ''}
          <div class="highlight-date"><i class="far fa-clock"></i> ${formatDate(h.createdAt)}</div>
        </div></div>`;
    }).join('')}
        </div>` : ''}
        ${highlights.length === 0 ? emptyHTML('fas fa-images', 'لا توجد لقطات متاحة حالياً') : ''}
      </section></div></div>`;
  } catch (err) {
    container.innerHTML = `<div class="page-content"><div class="container"><section class="section">${emptyHTML('fas fa-exclamation-triangle', 'تعذر تحميل اللقطات')}</section></div></div>`;
  }
}

// ============ CONTACT - COMMUNITY MESSAGES ============
let _publicChatHistory = [];

function renderContactPage() {
  updateSEO('تواصل معنا', 'تواصل مع إدارة الدورة الرمضانية بششتا');
  const d = document.getElementById('contactRedDot'); if (d) d.style.display = 'none';
  localStorage.setItem('last_seen_reply', new Date().toISOString());
  const savedName = localStorage.getItem('contact_name') || '';

  // Load chat history from localStorage
  try { _publicChatHistory = JSON.parse(localStorage.getItem('public_chat_history') || '[]').filter(h => h && (h.role === 'user' || h.role === 'admin')); } catch (e) { _publicChatHistory = []; }

  document.getElementById('app').innerHTML = `<div class="page-content"><div class="container"><section class="section">
    <div class="pub-chat-wrap">
      <div class="pub-chat-header">
        <div class="pub-chat-header-avatar">
          <div class="pub-chat-avatar-ring"></div>
          <span class="pub-chat-bot-icon">🏆</span>
        </div>
        <div class="pub-chat-header-info">
          <h2>رسائل الإدارة</h2>
          <span class="pub-chat-status"><span class="pub-chat-online-dot"></span> فريق الدورة • الرد عند التفرغ</span>
        </div>
        <div class="pub-chat-header-badge">الإدارة</div>
      </div>

      <div class="pub-chat-quick-chips">
        <button class="pub-chip" onclick="pubQuickCmd('عندي اقتراح للدورة: ')"><i class="fas fa-lightbulb"></i> اقتراح</button>
        <button class="pub-chip" onclick="pubQuickCmd('عندي استفسار عن مباراة: ')"><i class="fas fa-futbol"></i> استفسار مباراة</button>
        <button class="pub-chip" onclick="pubQuickCmd('أريد الإبلاغ عن مشكلة: ')"><i class="fas fa-flag"></i> الإبلاغ عن مشكلة</button>
      </div>

      <div class="pub-chat-box" id="pubChatBox">
        <div class="chat-msg chat-msg-bot pub-chat-welcome">
          <div class="chat-msg-avatar">🏆</div>
          <div class="chat-msg-bubble">
            أهلاً بيك في الدورة الرمضانية بششتا! 🌙⚽<br>
            ابعت اقتراحك أو سؤالك، وفريق الإدارة هيرد عليك أول ما يقدر.
          </div>
        </div>
        ${_publicChatHistory.map(h => {
    const isUser = h.role === 'user';
    const isAdmin = h.role === 'admin';
    const parsedText = escapeHTML(h.text).replace(/\n/g, '<br>');
    if (isAdmin) {
      return `<div class="chat-msg chat-msg-bot"><div class="chat-msg-avatar" style="background:linear-gradient(135deg,var(--gold),var(--gold-dark));font-size:.7rem;color:#fff">👑</div><div class="chat-msg-bubble" style="border-color:var(--gold);border-right:3px solid var(--gold)"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:.78rem;font-weight:700;color:var(--gold)"><i class="fas fa-shield-check"></i> الإدارة (Admin) <span style="background:var(--gold);color:#fff;padding:1px 6px;border-radius:10px;font-size:.65rem">✓ موثّق</span></div>${parsedText}</div></div>`;
    }
    return `<div class="chat-msg chat-msg-${isUser ? 'user' : 'bot'}">
      ${isUser ? '' : '<div class="chat-msg-avatar">🏆</div>'}
      <div class="chat-msg-bubble">${parsedText}</div>
      ${isUser ? '<div class="chat-msg-avatar">👤</div>' : ''}
    </div>`;
  }).join('')}
      </div>

      ${!savedName ? `<div class="pub-chat-name-bar" id="pubNameBar">
        <input type="text" id="contactName" class="pub-chat-name-input" placeholder="اسمك (مطلوب لأول مرة)" maxlength="50">
      </div>` : ''}

      <div class="pub-chat-input-area">
        <label for="pubChatImage" class="pub-chat-attach-btn" title="إرفاق صورة">
          <i class="fas fa-image"></i>
          <input type="file" id="pubChatImage" accept="image/*" style="display:none" onchange="pubPreviewImage(this)">
        </label>
        <div class="pub-chat-input-wrap">
          <div id="pubImagePreview" style="display:none"></div>
          <input type="text" id="pubChatInput" placeholder="اكتب سؤالك هنا..." maxlength="500" onkeydown="if(event.key==='Enter')sendPublicChat()">
        </div>
        <button class="pub-chat-send-btn" id="pubSendBtn" onclick="sendPublicChat()">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>

      <div class="pub-chat-footer">
        <i class="fas fa-lock"></i> رسالتك بتوصل لفريق الإدارة • من فضلك ما تبعتش بيانات حساسة
      </div>
    </div>
  </section></div></div>`;

  // Scroll to bottom of chat
  const chatBox = document.getElementById('pubChatBox');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

  // Focus input
  setTimeout(() => {
    const inp = document.getElementById('pubChatInput');
    if (inp) inp.focus();
  }, 200);

  // Set up real-time listener for incoming replies
  setupChatRealtimeListener();
}

let _chatListenerUnsubscribe = null;

function setupChatRealtimeListener() {
  if (_chatListenerUnsubscribe) _chatListenerUnsubscribe();

  if (!auth.currentUser) ensureAnonymousAuth().then(setupChatRealtimeListener).catch(() => {});
  if (!auth.currentUser) return;

  // Listen only to messages owned by this signed-in anonymous installation.
  _chatListenerUnsubscribe = db.collection('messages')
    .where('uid', '==', auth.currentUser.uid)
    .onSnapshot(snapshot => {
      let hasNewReplies = false;
      const chatBox = document.getElementById('pubChatBox');

      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const m = change.doc.data();
          // If there is an admin reply that we haven't shown yet
          if (m.reply && m.replySource === 'admin' && m.replyAt) {
            const alreadyShown = _publicChatHistory.some(h => h.text === m.reply && h.role === 'admin');
            if (!alreadyShown && chatBox) {
              const parsedText = escapeHTML(m.reply).replace(/\n/g, '<br>');
              chatBox.innerHTML += `<div class="chat-msg chat-msg-bot"><div class="chat-msg-avatar" style="background:linear-gradient(135deg,var(--gold),var(--gold-dark));font-size:.7rem;color:#fff">👑</div><div class="chat-msg-bubble" style="border-color:var(--gold);border-right:3px solid var(--gold)"><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:.78rem;font-weight:700;color:var(--gold)"><i class="fas fa-shield-check"></i> الإدارة (Admin) <span style="background:var(--gold);color:#fff;padding:1px 6px;border-radius:10px;font-size:.65rem">✓ موثّق</span></div>${parsedText}</div></div>`;
              _publicChatHistory.push({ role: 'admin', text: m.reply });
              hasNewReplies = true;
            }
          }
        }
      });

      if (hasNewReplies) {
        try { localStorage.setItem('public_chat_history', JSON.stringify(_publicChatHistory.slice(-30))); } catch (e) { }
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }
    });
}

function pubPreviewImage(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wrap = document.getElementById('pubImagePreview');
    if (wrap) {
      wrap.style.display = 'block';
      wrap.innerHTML = `<div class="pub-img-preview">
        <img src="${e.target.result}" alt="مرفق">
        <button onclick="document.getElementById('pubChatImage').value='';document.getElementById('pubImagePreview').style.display='none'" class="pub-img-remove">✕</button>
      </div>`;
    }
  };
  reader.readAsDataURL(file);
}

function pubQuickCmd(text) {
  const input = document.getElementById('pubChatInput');
  if (input) { input.value = text; sendPublicChat(); }
}

function getDeviceId() {
  let id = localStorage.getItem('contact_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('contact_device_id', id);
  }
  return id;
}

async function sendPublicChat() {
  const input = document.getElementById('pubChatInput');
  const chatBox = document.getElementById('pubChatBox');
  const btn = document.getElementById('pubSendBtn');
  if (!input || !chatBox) return;
  const text = input.value.trim();
  if (!text) return;

  // Get or prompt for name
  let name = localStorage.getItem('contact_name') || '';
  const nameInput = document.getElementById('contactName');
  if (!name && nameInput) {
    name = nameInput.value.trim();
    if (!name) { showToast('يرجى كتابة اسمك أولاً'); nameInput.focus(); return; }
    localStorage.setItem('contact_name', name);
    const nameBar = document.getElementById('pubNameBar');
    if (nameBar) nameBar.style.display = 'none';
  }
  if (!name) { showToast('يرجى كتابة اسمك أولاً'); return; }

  input.value = '';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i>';

  // Handle image
  const fileInput = document.getElementById('pubChatImage');
  const file = fileInput ? fileInput.files[0] : null;
  let imgHtml = '';
  let imageUrl = '';

  if (file) {
    imgHtml = `<br><div class="pub-chat-img-msg"><img src="${URL.createObjectURL(file)}" alt="مرفق"></div>`;
    fileInput.value = '';
    const preview = document.getElementById('pubImagePreview');
    if (preview) preview.style.display = 'none';
  }

  // Add user message
  const safeText = escapeHTML(text);
  chatBox.innerHTML += `<div class="chat-msg chat-msg-user"><div class="chat-msg-bubble">${safeText}${imgHtml}</div><div class="chat-msg-avatar">👤</div></div>`;
  chatBox.scrollTop = chatBox.scrollHeight;

  // Save to history
  _publicChatHistory.push({ role: 'user', text: text });

  try {
    // Upload image if present
    if (file) {
      showToast('⏳ جاري رفع الصورة...');
      imageUrl = await uploadToImgBB(file);
    }

    // Save message to Firebase
    if (!auth.currentUser) await ensureAnonymousAuth();
    const deviceId = getDeviceId();
    const msgData = { uid: auth.currentUser.uid, name, deviceId, message: text, read: false, createdAt: new Date().toISOString() };
    if (imageUrl) msgData.image = imageUrl;
    await db.collection('messages').add(msgData);

    chatBox.innerHTML += `<div class="chat-msg chat-msg-bot"><div class="chat-msg-avatar">🏆</div><div class="chat-msg-bubble">وصلت رسالتك للإدارة ✅ هتظهر هنا أول ما يوصلك رد.</div></div>`;

    // Save chat history
    try { localStorage.setItem('public_chat_history', JSON.stringify(_publicChatHistory.slice(-30))); } catch (e) { }

    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (e) {
    chatBox.innerHTML += `<div class="chat-msg chat-msg-bot"><div class="chat-msg-avatar">🏆</div><div class="chat-msg-bubble">حصلت مشكلة في إرسال الرسالة. جرّب تاني بعد شوية.</div></div>`;

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ============ THEME TOGGLE ============
function initTheme() {
  const saved = localStorage.getItem('site_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = saved === 'light' ? '#f4f6f9' : '#02040a';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('site_theme', next);
  updateThemeIcon(next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = next === 'light' ? '#f4f6f9' : '#02040a';
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

// ============ BACK TO TOP ============
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', debounce(() => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, 100));
}

// ============ ADMIN VISIBILITY ============
function updateExtraUIVisibility(page) {
  const btt = document.getElementById('backToTop');
  const isAdmin = page === 'admin';
  if (btt) btt.style.display = isAdmin ? 'none' : '';
}

// ============ LAZY LOAD ADMIN ============
let _adminScriptLoaded = false;
function loadAdminScript() {
  return new Promise((resolve) => {
    if (_adminScriptLoaded) { resolve(); return; }
    const s = document.createElement('script');
    s.src = new URL('JS/admin.js?v=36', window.APP_BASE_URL).href;
    s.onload = () => { _adminScriptLoaded = true; resolve(); };
    s.onerror = () => { showToast('فشل تحميل لوحة الإدارة'); resolve(); };
    document.head.appendChild(s);
  });
}

// ============ INIT ============
// Apply theme immediately before anything loads
initTheme();

window.addEventListener('hashchange', router);
window.addEventListener('load', async () => {
  // Start loading data with 5-second max timeout
  const dataReady = loadAllData();
  const timeout = new Promise(r => setTimeout(r, 5000));
  try { await Promise.race([dataReady, timeout]) } catch (e) { }
  lastDataLoad = Date.now();
  const ls = document.getElementById('loadingScreen');
  if (ls) { ls.classList.add('hide'); setTimeout(() => ls.style.display = 'none', 500) }
  window.addEventListener('scroll', debounce(() => { const h = document.getElementById('mainHeader'); if (h) h.classList.toggle('scrolled', window.scrollY > 50) }, 50));
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('mainNav').classList.toggle('open'));
  document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => document.getElementById('mainNav').classList.remove('open')));
  initVisitorCounter();
  initBackToTop();
  db.collection('statistics').doc('general').onSnapshot(doc => { if (doc.exists) { const v = doc.data().visits || 0; const el = document.getElementById('visitorCountHeader'); if (el) { el.textContent = v; document.getElementById('visitorStatsHeader').style.display = 'inline-flex' } const el2 = document.getElementById('visitorCount'); if (el2) { el2.textContent = v; document.getElementById('visitorStats').style.display = 'block' } } });
  checkUserUnreadMessages();
  router();
});

async function checkUserUnreadMessages() {
  try {
    if (!auth.currentUser) await ensureAnonymousAuth();
    let docs = [];
    if (auth.currentUser) {
      const snap1 = await db.collection('messages').where('uid', '==', auth.currentUser.uid).get();
      docs = [...snap1.docs];
    }
    const lastSeen = localStorage.getItem('last_seen_reply') || '0';
    let hasUnread = false;
    docs.forEach(d => {
      const m = d.data();
      if (m.reply && m.replyAt && new Date(m.replyAt).getTime() > new Date(lastSeen).getTime()) hasUnread = true;
      if (m.reply && !m.replyAt && lastSeen === '0') hasUnread = true;
    });
    const dot = document.getElementById('contactRedDot');
    if (dot && hasUnread) dot.style.display = 'block';
  } catch (e) { }
}
