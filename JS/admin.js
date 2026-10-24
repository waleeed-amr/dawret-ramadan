/* Admin Panel v3 - الدورة الرمضانية بششتا */
let isAdminLoggedIn = false;
async function renderAdmin(subpath) {
  try {
    if (!auth.currentUser) await ensureAnonymousAuth();
    const result = await auth.currentUser.getIdTokenResult(true);
    isAdminLoggedIn = result.claims.admin === true;
  } catch (error) { isAdminLoggedIn = false; }
  if (isAdminLoggedIn) renderAdminLayout(subpath || 'dashboard');
  else renderAdminLogin();
}

function renderAdminLogin() {
  document.getElementById('app').innerHTML = `<div class="admin-login"><div class="admin-login-card">
    <div style="font-size:4rem;margin-bottom:16px">🏆</div><h2>لوحة التحكم</h2><p>أدخل كلمة المرور للوصول</p>
    <div class="form-error" id="loginError"></div>
    <form onsubmit="handleAdminLogin(event)"><div class="form-group"><label><i class="fas fa-lock"></i> كلمة المرور</label><input type="password" id="adminPassInput" required autofocus></div>
    <button type="submit" class="btn btn-primary" style="width:100%" id="loginBtn"><i class="fas fa-sign-in-alt"></i> دخول</button></form>
    <a href="#/" style="display:inline-block;margin-top:20px;font-size:.85rem;color:var(--text-muted)"><i class="fas fa-arrow-right"></i> العودة للموقع</a>
  </div></div>`;
}

async function handleAdminLogin(e) {
  e.preventDefault(); const pass = document.getElementById('adminPassInput').value; const err = document.getElementById('loginError'); const btn = document.getElementById('loginBtn');
  btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i> جاري التحقق...'; btn.disabled = true;
  try {
    if (!auth.currentUser) await ensureAnonymousAuth();
    await firebase.functions().httpsCallable('claimAdminAccess')({ password: pass });
    await auth.currentUser.getIdToken(true);
    isAdminLoggedIn = true;
    navigateTo('#/admin/dashboard');
  } catch (error) {
    err.textContent = error.code === 'functions/permission-denied' ? 'كلمة المرور غير صحيحة أو لم يتم إعداد الإدارة على الخادم.' : 'تعذر الدخول: ' + error.message;
    err.style.display = 'block'; document.getElementById('adminPassInput').value = '';
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول'; btn.disabled = false;
  }
}

function adminLogout() { isAdminLoggedIn = false; auth.signOut().catch(() => { }); navigateTo('#/') }

const adminMenu = [
  { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'لوحة التحكم' },
  { id: 'teams', icon: 'fa-users', label: 'إدارة الفرق' },
  { id: 'players', icon: 'fa-user-tag', label: 'إدارة اللاعبين' },
  { id: 'matches', icon: 'fa-futbol', label: 'إدارة المباريات' },
  { id: 'livescore', icon: 'fa-broadcast-tower', label: 'النتائج المباشرة' },
  { id: 'goals', icon: 'fa-bullseye', label: 'تسجيل الأهداف' },
  { id: 'cards', icon: 'fa-square', label: 'البطاقات' },
  { id: 'highlights', icon: 'fa-star', label: 'أهم اللقطات' },
  { id: 'compare', icon: 'fa-balance-scale', label: 'مقارنة الفرق' },
  { id: 'news', icon: 'fa-newspaper', label: 'إدارة الأخبار' },
  { id: 'messages', icon: 'fa-envelope', label: 'الرسائل' },
  { id: 'broadcast', icon: 'fa-bullhorn', label: 'رسالة للجميع' },
  { id: 'notifications', icon: 'fa-bell', label: 'إشعارات التطبيق' },
  { id: 'seasons', icon: 'fa-calendar-alt', label: 'إدارة المواسم' },
  { id: 'profiles', icon: 'fa-image', label: 'صور المستخدمين' },
  { id: 'playerPhotos', icon: 'fa-camera', label: 'صور اللاعبين' },
  { id: 'advstats', icon: 'fa-chart-pie', label: 'إحصائيات متقدمة' },
  { id: 'settings', icon: 'fa-cog', label: 'الإعدادات' },
];

let _unreadMessages = 0;
async function checkUnread() { try { const s = await db.collection('messages').where('read', '==', false).get(); _unreadMessages = s.size } catch (e) { _unreadMessages = 0 } }

async function renderAdminLayout(section) {
  await checkUnread();
  document.getElementById('app').innerHTML = `<div class="admin-layout">
    <aside class="admin-sidebar" id="adminSidebar"><div class="admin-sidebar-header"><h3>🏆 لوحة التحكم</h3><p style="font-size:.78rem;color:var(--text-muted)">الدورة الرمضانية بششتا</p></div>
    <nav class="admin-nav">${adminMenu.map(m => `<a href="#/admin/${m.id}" class="${section === m.id ? 'active' : ''}"><i class="fas ${m.icon}"></i> ${m.label} ${m.id === 'messages' && _unreadMessages > 0 ? `<span class="unread-badge">${_unreadMessages}</span>` : ''}</a>`).join('')}
    <a href="#" onclick="adminLogout();return false;" class="admin-logout-btn"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</a></nav></aside>
    <div class="admin-overlay" onclick="document.getElementById('adminSidebar').classList.remove('open')"></div>
    <main class="admin-main"><div class="admin-topbar"><button class="admin-menu-btn" onclick="document.getElementById('adminSidebar').classList.toggle('open')"><i class="fas fa-bars"></i></button>
    <h3>${adminMenu.find(m => m.id === section)?.label || 'لوحة التحكم'}</h3><button onclick="refreshData().then(() => navigateTo('#/'))" class="btn btn-sm btn-outline"><i class="fas fa-eye"></i> معاينة</button></div>
    <div class="admin-content-inner" id="adminInner"></div></main></div>`;
  const fn = { dashboard: adminDashboard, teams: adminTeams, players: adminPlayers, matches: adminMatches, livescore: adminLivescore, goals: adminGoals, cards: adminCards, news: adminNews, messages: adminMessages, broadcast: adminBroadcast, notifications: adminNotifications, seasons: adminSeasons, profiles: adminProfiles, playerPhotos: adminPlayerPhotos, highlights: adminHighlights, settings: adminSettings, lineup: adminLineup, compare: adminCompare, advstats: adminAdvStats };
  (fn[section] || adminDashboard)();
}

// ========== DASHBOARD ==========
async function adminDashboard() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i> جاري التحميل...</div>';
  let counts = { teams: 0, players: 0, matches: 0, news: 0, goals: 0, visits: 0 };
  try {
    const [t, p, m, n, g, stats] = await Promise.all([db.collection('teams').get(), db.collection('players').get(), db.collection('matches').get(), db.collection('news').get(), db.collection('goals').get(), db.collection('statistics').doc('general').get()]);
    counts = { teams: t.size, players: p.size, matches: m.size, news: n.size, goals: g.size, visits: stats.exists ? (stats.data().visits || 0) : 0 };
  } catch (e) { }
  c.innerHTML = `<div class="dashboard-stats">${[['fa-users', counts.teams, 'الفرق', 'gold'], ['fa-user-tag', counts.players, 'اللاعبون', 'blue'], ['fa-futbol', counts.matches, 'المباريات', 'green'], ['fa-bullseye', counts.goals, 'الأهداف', 'red'], ['fa-newspaper', counts.news, 'الأخبار', 'yellow'], ['fa-envelope', _unreadMessages, 'رسائل جديدة', 'purple'], ['fa-eye', counts.visits, 'أجهزة زارت الموقع', 'blue']].map(([i, v, l, col]) => `<div class="stat-card" style="cursor:default"><div class="stat-icon" style="color:var(--${col})"><i class="fas ${i}"></i></div><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`).join('')}</div>
  <div class="grid-2 mt-3"><div class="card"><h3 style="color:var(--gold);margin-bottom:14px"><i class="fas fa-bolt"></i> إجراءات سريعة</h3><div style="display:flex;flex-wrap:wrap;gap:8px">
    <a href="#/admin/teams" class="btn btn-sm btn-outline"><i class="fas fa-plus"></i> فريق</a><a href="#/admin/players" class="btn btn-sm btn-outline"><i class="fas fa-plus"></i> لاعب</a>
    <a href="#/admin/matches" class="btn btn-sm btn-outline"><i class="fas fa-plus"></i> مباراة</a><a href="#/admin/news" class="btn btn-sm btn-outline"><i class="fas fa-plus"></i> خبر</a>
    <a href="#/admin/livescore" class="btn btn-sm btn-outline"><i class="fas fa-broadcast-tower"></i> نتائج مباشرة</a><a href="#/admin/messages" class="btn btn-sm btn-outline"><i class="fas fa-envelope"></i> الرسائل</a>
    <a href="#/admin/lineup" class="btn btn-sm btn-outline"><i class="fas fa-th"></i> التشكيلات</a><a href="#/admin/compare" class="btn btn-sm btn-outline"><i class="fas fa-balance-scale"></i> مقارنة</a>
    <a href="#/admin/advstats" class="btn btn-sm btn-outline"><i class="fas fa-chart-pie"></i> إحصائيات</a>
  </div></div><div class="card"><h3 style="color:var(--gold);margin-bottom:14px"><i class="fas fa-info-circle"></i> دليل الاستخدام</h3><ul style="color:var(--text-secondary);line-height:2.2;font-size:.88rem;padding-right:14px">
    <li>1️⃣ أضف الفرق أولاً</li><li>2️⃣ أضف اللاعبين</li><li>3️⃣ أنشئ المباريات</li><li>4️⃣ سجّل النتائج والأهداف</li><li>5️⃣ أضف أخبار مع استطلاعات رأي</li><li>6️⃣ إدر التشكيلات والمقارنات</li></ul></div></div>`;
}

// ========== TEAMS ==========
async function adminTeams() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let teams = []; try { const s = await db.collection('teams').get(); teams = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openTeamModal()"><i class="fas fa-plus"></i> إضافة فريق</button><span class="text-muted">${teams.length} فريق</span></div>
  ${teams.length > 0 ? `<div class="admin-cards-grid">${teams.map(t => `<div class="admin-item-card"><div class="admin-item-top">${teamLogo(t, '55px')}<div><h4>${t.name}</h4><span class="admin-badge ${t.active !== false ? 'badge-green' : 'badge-red'}">${t.active !== false ? 'نشط' : 'معطل'}</span></div></div>
  <div class="admin-item-actions"><button class="btn btn-sm btn-outline" onclick="openTeamModal('${t.id}')"><i class="fas fa-edit"></i> تعديل</button><button class="btn btn-sm btn-danger" onclick="delDoc('teams','${t.id}',adminTeams)"><i class="fas fa-trash"></i></button></div></div>`).join('')}</div>` : emptyHTML('fas fa-users', 'لا توجد فرق')}`
}

const teamColors = [{ n: 'Gold', c: '#D4AF37' }, { n: 'Red', c: '#ef4444' }, { n: 'Blue', c: '#3b82f6' }, { n: 'Green', c: '#22c55e' }, { n: 'Black', c: '#000' }, { n: 'White', c: '#fff' }, { n: 'Yellow', c: '#eab308' }, { n: 'Purple', c: '#a855f7' }, { n: 'Orange', c: '#f97316' }];

async function openTeamModal(id) {
  const swatches = teamColors.map(tc => `<div onclick="document.getElementById('fColor').value='${tc.c}'" style="width:22px;height:22px;border-radius:50%;background:${tc.c};cursor:pointer;border:2px solid var(--border)" title="${tc.n}"></div>`).join('');
  showModal(id ? 'تعديل فريق' : 'إضافة فريق', `<form onsubmit="saveTeam(event,'${id || ''}')">
    <div class="form-group"><label>اسم الفريق *</label><input type="text" id="fName" required></div>
    <div class="form-group"><label>شعار (صورة)</label><input type="file" id="fLogo" accept="image/*"></div>
    <div class="form-group"><label>لون الفريق</label><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><input type="color" id="fColor" value="#D4AF37" style="height:36px;width:50px"><div style="display:flex;gap:5px;flex-wrap:wrap">${swatches}</div></div></div>
    <details style="margin:14px 0;background:var(--bg-secondary);padding:10px;border-radius:8px"><summary style="cursor:pointer;font-weight:bold;margin-bottom:6px">🔢 إحصائيات يدوية</summary>
    <div class="grid-3" style="gap:6px"><div class="form-group"><label>نقاط</label><input type="number" id="mPoints" value="0"></div><div class="form-group"><label>لعب</label><input type="number" id="mPlayed" value="0"></div><div class="form-group"><label>فوز</label><input type="number" id="mWon" value="0"></div><div class="form-group"><label>تعادل</label><input type="number" id="mDrawn" value="0"></div><div class="form-group"><label>خسارة</label><input type="number" id="mLost" value="0"></div><div class="form-group"><label>له</label><input type="number" id="mGF" value="0"></div><div class="form-group"><label>عليه</label><input type="number" id="mGA" value="0"></div></div></details>
    <div class="form-group"><label><input type="checkbox" id="fActive" checked> فريق نشط</label></div>
    <button type="submit" class="btn btn-primary" style="width:100%" id="saveTeamBtn"><i class="fas fa-save"></i> حفظ</button></form>`, async () => { if (!id) return; try { const d = await db.collection('teams').doc(id).get(); if (d.exists) { const t = d.data(); document.getElementById('fName').value = t.name || ''; document.getElementById('fColor').value = t.color || '#D4AF37'; document.getElementById('fActive').checked = t.active !== false; document.getElementById('mPoints').value = t.manualPoints || 0; document.getElementById('mPlayed').value = t.manualPlayed || 0; document.getElementById('mWon').value = t.manualWon || 0; document.getElementById('mDrawn').value = t.manualDrawn || 0; document.getElementById('mLost').value = t.manualLost || 0; document.getElementById('mGF').value = t.manualGF || 0; document.getElementById('mGA').value = t.manualGA || 0 } } catch (e) { } });
}

async function saveTeam(e, id) {
  e.preventDefault(); const btn = document.getElementById('saveTeamBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i>';
  const data = { name: document.getElementById('fName').value, color: document.getElementById('fColor').value, active: document.getElementById('fActive').checked, updatedAt: new Date().toISOString(), manualPoints: +document.getElementById('mPoints').value || 0, manualPlayed: +document.getElementById('mPlayed').value || 0, manualWon: +document.getElementById('mWon').value || 0, manualDrawn: +document.getElementById('mDrawn').value || 0, manualLost: +document.getElementById('mLost').value || 0, manualGF: +document.getElementById('mGF').value || 0, manualGA: +document.getElementById('mGA').value || 0 };
  const file = document.getElementById('fLogo').files[0]; if (file) { const url = await uploadToImgBB(file); if (url) data.logo = url }
  try { if (id) await db.collection('teams').doc(id).update(data); else { data.createdAt = new Date().toISOString(); await db.collection('teams').add(data) } showToast('تم الحفظ ✅'); closeModal(); adminTeams() } catch (err) { showToast('خطأ: ' + err.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ' }
}

// ========== PLAYERS ==========
async function adminPlayers() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let players = [], teams = [];
  try { const [ps, ts] = await Promise.all([db.collection('players').get(), db.collection('teams').get()]); players = ps.docs.map(d => ({ id: d.id, ...d.data() })); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { } window._adminTeams = teams;
  // Search + filter
  const teamFilter = `<select id="playerTeamFilter" onchange="filterPlayerTable()" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-family:var(--font)"><option value="">كل الفرق</option>${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>`;
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openPlayerModal()"><i class="fas fa-plus"></i> إضافة لاعب</button><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${teamFilter}<input id="playerSearch" placeholder="🔍 ابحث عن لاعب" oninput="filterPlayerTable()" style="padding:7px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-family:var(--font)"><span class="text-muted">${players.length} لاعب</span></div></div>
  ${players.length > 0 ? `<div class="table-responsive"><table class="admin-table" id="playerTable"><thead><tr><th>الصورة</th><th>الاسم</th><th>الفريق</th><th>⚽</th><th>🅰️</th><th>🟨</th><th>🟥</th><th>مباريات</th><th>🧤 أفضل حارس</th><th>إجراءات</th></tr></thead><tbody>${players.map(p => { const t = teams.find(x => x.id === p.teamId); return `<tr data-team="${p.teamId || ''}" data-name="${p.name.toLowerCase()}"><td>${playerPhoto(p, '34px')}</td><td><strong>${p.name}</strong>${p.isGoalkeeper ? ' <span title="حارس مرمى">🧤</span>' : ''}</td><td style="color:${t?.color || 'inherit'}">${t?.name || '-'}</td><td class="text-gold"><strong>${p.goals || 0}</strong></td><td>${p.assists || 0}</td><td style="color:var(--yellow)">${p.yellowCards || 0}</td><td style="color:var(--red)">${p.redCards || 0}</td><td>${p.matches || 0}</td><td style="color:var(--green)">${p.cleanSheets || 0}</td><td class="actions"><button class="btn btn-sm btn-outline" onclick="openPlayerModal('${p.id}')"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-danger" onclick="delDoc('players','${p.id}',adminPlayers)"><i class="fas fa-trash"></i></button></td></tr>` }).join('')}</tbody></table></div>` : emptyHTML('fas fa-user-tag', 'لا يوجد لاعبون')}`
}

function filterPlayerTable() {
  const q = (document.getElementById('playerSearch')?.value || '').toLowerCase();
  const tf = document.getElementById('playerTeamFilter')?.value || '';
  document.querySelectorAll('#playerTable tbody tr').forEach(tr => {
    const nameMatch = !q || tr.dataset.name.includes(q);
    const teamMatch = !tf || tr.dataset.team === tf;
    tr.style.display = nameMatch && teamMatch ? '' : 'none';
  });
}

function openPlayerModal(id, preTeam) {
  const teams = window._adminTeams || []; showModal(id ? 'تعديل لاعب' : 'إضافة لاعب', `<form onsubmit="savePlayer(event,'${id || ''}')">
  <div class="form-group"><label for="pName">الاسم *</label><input type="text" id="pName" required></div>
  <div class="form-group"><label for="pTeam">الفريق *</label><select id="pTeam" required><option value="">اختر</option>${teams.map(t => `<option value="${t.id}" ${t.id === preTeam ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
  <div class="form-group"><label><input type="checkbox" id="pIsGoalkeeper"> 🧤 لاعب كحارس مرمى</label></div>
  <div class="form-group"><label for="pPhoto">صورة</label><input type="file" id="pPhoto" accept="image/*"></div>
  <div class="grid-2"><div class="form-group"><label for="pGoals">⚽ أهداف</label><input type="number" id="pGoals" value="0" min="0"></div><div class="form-group"><label for="pAssists">🅰️ تمريرات</label><input type="number" id="pAssists" value="0" min="0"></div></div>
  <div class="grid-2"><div class="form-group"><label for="pMatches">مباريات</label><input type="number" id="pMatches" value="0" min="0"></div><div class="form-group"><label for="pCleanSheets">🧤 أفضل حارس</label><input type="number" id="pCleanSheets" value="0" min="0"></div></div>
  <div class="grid-2"><div class="form-group"><label for="pYellow">🟨 صفراء</label><input type="number" id="pYellow" value="0" min="0"></div><div class="form-group"><label for="pRed">🟥 حمراء</label><input type="number" id="pRed" value="0" min="0"></div></div>
  <button type="submit" class="btn btn-primary" style="width:100%" id="savePlayerBtn"><i class="fas fa-save"></i> حفظ</button></form>`, async () => { if (!id) return; try { const d = await db.collection('players').doc(id).get(); if (d.exists) { const p = d.data(); document.getElementById('pName').value = p.name || ''; document.getElementById('pTeam').value = p.teamId || ''; document.getElementById('pGoals').value = p.goals || 0; document.getElementById('pAssists').value = p.assists || 0; document.getElementById('pMatches').value = p.matches || 0; document.getElementById('pYellow').value = p.yellowCards || 0; document.getElementById('pRed').value = p.redCards || 0; document.getElementById('pCleanSheets').value = p.cleanSheets || 0; document.getElementById('pIsGoalkeeper').checked = !!p.isGoalkeeper } } catch (e) { } })
}

async function savePlayer(e, id) {
  e.preventDefault(); const btn = document.getElementById('savePlayerBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i>';
  const data = { name: document.getElementById('pName').value, teamId: document.getElementById('pTeam').value, goals: +document.getElementById('pGoals').value, assists: +document.getElementById('pAssists').value, matches: +document.getElementById('pMatches').value, yellowCards: +document.getElementById('pYellow').value, redCards: +document.getElementById('pRed').value, cleanSheets: +document.getElementById('pCleanSheets').value, isGoalkeeper: document.getElementById('pIsGoalkeeper').checked, updatedAt: new Date().toISOString() };
  const file = document.getElementById('pPhoto').files[0]; if (file) { const url = await uploadToImgBB(file); if (url) data.photo = url }
  try { if (id) await db.collection('players').doc(id).update(data); else { data.createdAt = new Date().toISOString(); await db.collection('players').add(data) } showToast('تم الحفظ ✅'); closeModal(); adminPlayers() } catch (err) { showToast('خطأ: ' + err.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ' }
}

// ========== MATCHES ==========
async function adminMatches() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let matches = [], teams = [], players = [];
  try { const [ms, ts, ps] = await Promise.all([db.collection('matches').orderBy('date', 'desc').get(), db.collection('teams').get(), db.collection('players').get()]); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); players = ps.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  window._adminTeams = teams; window._adminPlayers = players;
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openMatchModal()"><i class="fas fa-plus"></i> إضافة مباراة</button><span class="text-muted">${matches.length} مباراة</span></div>
  ${matches.length > 0 ? `<div class="table-responsive"><table class="admin-table"><thead><tr><th>المرحلة</th><th>الأول</th><th>النتيجة</th><th>الثاني</th><th>التاريخ</th><th>الحالة</th><th>MVP</th><th>إجراءات</th></tr></thead>
  <tbody>${matches.map(m => {
    const a = teams.find(t => t.id === m.teamAId), b = teams.find(t => t.id === m.teamBId); const mvp = m.mvpId ? players.find(p => p.id === m.mvpId) : null;
    const stageLabel = m.stage === 'final' ? '🏆 النهائي' : m.stage === 'semi_final' ? '⚡ نصف النهائي' : `ج${m.round || '-'}`;
    return `<tr><td><strong>${stageLabel}</strong></td><td>${a?.name || '-'}</td><td class="text-gold" style="font-weight:900">${m.status === 'finished' || m.status === 'live' ? `${m.scoreA || 0} - ${m.scoreB || 0}` : '—'}</td><td>${b?.name || '-'}</td><td style="font-size:.78rem">${formatDate(m.date)}</td><td><span class="admin-badge ${m.status === 'finished' ? 'badge-green' : m.status === 'live' ? 'badge-red' : 'badge-blue'}">${m.status === 'finished' ? 'انتهت' : m.status === 'live' ? '🔴 مباشر' : 'قادمة'}</span></td><td style="font-size:.78rem">${mvp?.name || '-'}</td>
  <td class="actions"><button class="btn btn-sm btn-outline" onclick="openMatchModal('${m.id}')"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-danger" onclick="delDoc('matches','${m.id}',adminMatches)"><i class="fas fa-trash"></i></button></td></tr>`
  }).join('')}</tbody></table></div>` : emptyHTML('fas fa-futbol', 'لا توجد مباريات')}`
}

function openMatchModal(id) {
  const teams = window._adminTeams || [], players = window._adminPlayers || []; const tOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join(''); const pOpts = players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  showModal(id ? 'تعديل مباراة' : 'إضافة مباراة', `<form onsubmit="saveMatch(event,'${id || ''}')">
  <div class="grid-2"><div class="form-group"><label>الفريق الأول *</label><select id="mTeamA" required><option value="">اختر</option>${tOpts}</select></div><div class="form-group"><label>الفريق الثاني *</label><select id="mTeamB" required><option value="">اختر</option>${tOpts}</select></div></div>
  <div class="grid-2"><div class="form-group"><label>نتيجة الأول</label><input type="number" id="mScoreA" min="0" placeholder="0"></div><div class="form-group"><label>نتيجة الثاني</label><input type="number" id="mScoreB" min="0" placeholder="0"></div></div>
  <div class="grid-2"><div class="form-group"><label>تاريخ البدء *</label><input type="datetime-local" id="mDate" required></div><div class="form-group"><label>موعد الانتهاء</label><input type="datetime-local" id="mEndTime"></div></div>
  <div class="grid-2"><div class="form-group"><label>رقم الجولة</label><input type="number" id="mRound" value="1" min="1"></div><div class="form-group"><label>الدقيقة (مباشر)</label><input type="number" id="mLiveMin" min="0" placeholder="45"></div></div>
  <div class="form-group"><label>🏟️ نوع المباراة (المرحلة)</label><select id="mStage"><option value="group">📋 مرحلة المجموعات</option><option value="semi_final">⚡ نصف النهائي</option><option value="final">🏆 النهائي</option></select></div>
  <div class="form-group"><label>حالة المباراة</label><select id="mStatus"><option value="upcoming">⏳ قادمة</option><option value="live">🔴 مباشر</option><option value="finished">✅ انتهت</option></select></div>
  <div id="penaltyFields" style="display:none"><div class="grid-2"><div class="form-group"><label>⚡ ركلات ترجيح الأول</label><input type="number" id="mPenaltyA" min="0" placeholder="0"></div><div class="form-group"><label>⚡ ركلات ترجيح الثاني</label><input type="number" id="mPenaltyB" min="0" placeholder="0"></div></div></div>
  <div class="form-group"><label>⭐ أفضل لاعب MVP</label><select id="mMvp"><option value="">لا يوجد</option>${pOpts}</select></div>
  <div class="form-group"><label>📝 تقرير</label><textarea id="mReport" rows="3" placeholder="ملخص المباراة..."></textarea></div>
  <button type="submit" class="btn btn-primary" style="width:100%" id="saveMatchBtn"><i class="fas fa-save"></i> حفظ</button></form>`, async () => {
    // Show/hide penalty fields based on stage
    const stageEl = document.getElementById('mStage');
    if (stageEl) stageEl.addEventListener('change', function() { document.getElementById('penaltyFields').style.display = (this.value === 'semi_final' || this.value === 'final') ? 'block' : 'none'; });
    if (!id) return; try { const d = await db.collection('matches').doc(id).get(); if (d.exists) { const m = d.data(); document.getElementById('mTeamA').value = m.teamAId || ''; document.getElementById('mTeamB').value = m.teamBId || ''; document.getElementById('mScoreA').value = m.scoreA ?? ''; document.getElementById('mScoreB').value = m.scoreB ?? ''; document.getElementById('mDate').value = m.date || ''; document.getElementById('mEndTime').value = m.endTime || ''; document.getElementById('mRound').value = m.round || 1; document.getElementById('mLiveMin').value = m.liveMinute || ''; document.getElementById('mStatus').value = m.status || 'upcoming'; document.getElementById('mMvp').value = m.mvpId || ''; document.getElementById('mReport').value = m.report || ''; document.getElementById('mStage').value = m.stage || 'group'; if (m.stage === 'semi_final' || m.stage === 'final') document.getElementById('penaltyFields').style.display = 'block'; if (m.penaltyA != null) document.getElementById('mPenaltyA').value = m.penaltyA; if (m.penaltyB != null) document.getElementById('mPenaltyB').value = m.penaltyB; } } catch (e) { } })
}

async function saveMatch(e, id) {
  e.preventDefault(); const btn = document.getElementById('saveMatchBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i>';
  const sa = document.getElementById('mScoreA').value, sb = document.getElementById('mScoreB').value;
  const stageVal = document.getElementById('mStage').value; const pA = document.getElementById('mPenaltyA')?.value; const pB = document.getElementById('mPenaltyB')?.value;
  const data = { teamAId: document.getElementById('mTeamA').value, teamBId: document.getElementById('mTeamB').value, scoreA: sa !== '' ? +sa : null, scoreB: sb !== '' ? +sb : null, date: document.getElementById('mDate').value, endTime: document.getElementById('mEndTime').value || null, round: +document.getElementById('mRound').value, liveMinute: +document.getElementById('mLiveMin').value || null, status: document.getElementById('mStatus').value, mvpId: document.getElementById('mMvp').value || null, report: document.getElementById('mReport').value, stage: stageVal || 'group', penaltyA: pA !== '' && pA != null ? +pA : null, penaltyB: pB !== '' && pB != null ? +pB : null, updatedAt: new Date().toISOString() };
  try {
    if (id) await db.collection('matches').doc(id).update(data); else { data.createdAt = new Date().toISOString(); await db.collection('matches').add(data) }
    showToast('تم الحفظ ✅'); closeModal(); adminMatches()
  } catch (err) { showToast('خطأ: ' + err.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ' }
}

// ========== LIVE SCORE ==========
async function adminLivescore() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>';
  let matches = [], teams = []; try { const [ms, ts] = await Promise.all([db.collection('matches').get(), db.collection('teams').get()]); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  const active = matches.filter(m => m.status === 'live' || m.status === 'upcoming');
  c.innerHTML = `<p class="text-muted mb-3">تحديث النتائج والدقائق مباشرة بدون الحاجة لفتح نافذة تعديل</p>
  ${active.length > 0 ? active.map(m => {
    const a = teams.find(t => t.id === m.teamAId), b = teams.find(t => t.id === m.teamBId);
    return `<div class="live-score-card" id="lsc_${m.id}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="admin-badge ${m.status === 'live' ? 'badge-red' : 'badge-blue'}">${m.status === 'live' ? '🔴 مباشر' : '⏳ قادمة'}</span><span class="text-muted" style="font-size:.78rem">${formatDate(m.date)}</span></div>
  <div class="live-score-controls"><strong>${a?.name || '?'}</strong><input type="number" class="live-score-input" id="lsA_${m.id}" value="${m.scoreA || 0}" min="0"><span class="live-score-vs">-</span><input type="number" class="live-score-input" id="lsB_${m.id}" value="${m.scoreB || 0}" min="0"><strong>${b?.name || '?'}</strong></div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center"><div class="form-group" style="margin:0;flex:0"><label style="margin:0;font-size:.78rem">الدقيقة</label><input type="number" id="lsMin_${m.id}" value="${m.liveMinute || ''}" min="0" style="width:70px;padding:6px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font)"></div>
  <select id="lsSt_${m.id}" style="padding:6px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font)"><option value="upcoming" ${m.status === 'upcoming' ? 'selected' : ''}>قادمة</option><option value="live" ${m.status === 'live' ? 'selected' : ''}>مباشر</option><option value="finished" ${m.status === 'finished' ? 'selected' : ''}>انتهت</option></select>
  <button class="btn btn-sm btn-primary" onclick="saveLiveScore('${m.id}')"><i class="fas fa-save"></i> تحديث</button></div></div>`
  }).join('') : emptyHTML('fas fa-broadcast-tower', 'لا توجد مباريات قادمة أو مباشرة')}`
}

async function saveLiveScore(id) {
  const newStatus = document.getElementById('lsSt_' + id).value;
  try {
    await db.collection('matches').doc(id).update({ scoreA: +document.getElementById('lsA_' + id).value || 0, scoreB: +document.getElementById('lsB_' + id).value || 0, liveMinute: +document.getElementById('lsMin_' + id).value || null, status: newStatus, updatedAt: new Date().toISOString() });
    showToast('تم التحديث ✅');
  } catch (e) { showToast('خطأ: ' + e.message) }
}


// ========== GOALS ==========
async function adminGoals() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let matches = [], teams = [], goals = [], players = [];
  try { const [ms, ts, gs, ps] = await Promise.all([db.collection('matches').get(), db.collection('teams').get(), db.collection('goals').get(), db.collection('players').get()]); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); goals = gs.docs.map(d => ({ id: d.id, ...d.data() })); players = ps.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  window._adminTeams = teams; window._adminPlayers = players; window._adminMatches = matches;
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openGoalModal()"><i class="fas fa-plus"></i> تسجيل هدف</button><span class="text-muted">${goals.length} هدف</span></div>
  ${goals.length > 0 ? `<div class="table-responsive"><table class="admin-table"><thead><tr><th>المباراة</th><th>⚽ الهداف</th><th>🅰️ الصانع</th><th>⏱</th><th>الفريق</th><th>حذف</th></tr></thead><tbody>${goals.map(g => { const m = matches.find(x => x.id === g.matchId); const p = players.find(x => x.id === g.playerId); const a = g.assistId ? players.find(x => x.id === g.assistId) : null; const t = teams.find(x => x.id === g.teamId); const tA = m ? teams.find(x => x.id === m.teamAId) : null; const tB = m ? teams.find(x => x.id === m.teamBId) : null; return `<tr><td style="font-size:.82rem">${tA?.name || '?'} vs ${tB?.name || '?'}</td><td class="text-gold"><strong>${p?.name || '-'}</strong></td><td>${a?.name || '-'}</td><td><span class="goal-minute">${g.minute}'</span></td><td>${t?.name || '-'}</td><td class="actions"><button class="btn btn-sm btn-danger" onclick="delDoc('goals','${g.id}',adminGoals)"><i class="fas fa-trash"></i></button></td></tr>` }).join('')}</tbody></table></div>` : emptyHTML('fas fa-bullseye', 'لا توجد أهداف')}`
}

function openGoalModal() {
  const matches = window._adminMatches || [], teams = window._adminTeams || [], players = window._adminPlayers || []; const fin = matches.filter(m => m.status === 'finished' || m.status === 'live');
  const mOpts = fin.map(m => { const a = teams.find(t => t.id === m.teamAId), b = teams.find(t => t.id === m.teamBId); return `<option value="${m.id}">${a?.name || '?'} ${m.scoreA || 0}-${m.scoreB || 0} ${b?.name || '?'}</option>` }).join('');
  const pOpts = players.map(p => `<option value="${p.id}">${p.name}</option>`).join(''); const tOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  showModal('تسجيل هدف ⚽', `<form onsubmit="saveGoal(event)"><div class="form-group"><label>المباراة *</label><select id="gMatch" required><option value="">اختر</option>${mOpts}</select></div><div class="form-group"><label>⚽ الهداف *</label><select id="gPlayer" required><option value="">اختر</option>${pOpts}</select></div><div class="form-group"><label>🅰️ الصانع</label><select id="gAssist"><option value="">لا يوجد</option>${pOpts}</select></div><div class="form-group"><label>الفريق *</label><select id="gTeam" required><option value="">اختر</option>${tOpts}</select></div><div class="form-group"><label>⏱ الدقيقة *</label><input type="number" id="gMinute" min="1" max="120" required></div><button type="submit" class="btn btn-primary" style="width:100%"><i class="fas fa-save"></i> تسجيل</button></form>`)
}

async function saveGoal(e) { e.preventDefault(); try { await db.collection('goals').add({ matchId: document.getElementById('gMatch').value, playerId: document.getElementById('gPlayer').value, assistId: document.getElementById('gAssist').value || null, teamId: document.getElementById('gTeam').value, minute: +document.getElementById('gMinute').value, createdAt: new Date().toISOString() }); showToast('تم التسجيل ⚽'); closeModal(); adminGoals() } catch (err) { showToast('خطأ: ' + err.message) } }

// ========== CARDS ==========
async function adminCards() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let cards = [], matches = [], teams = [], players = [];
  try { const [cs, ms, ts, ps] = await Promise.all([db.collection('cards').get(), db.collection('matches').get(), db.collection('teams').get(), db.collection('players').get()]); cards = cs.docs.map(d => ({ id: d.id, ...d.data() })); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); players = ps.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  window._adminTeams = teams; window._adminPlayers = players; window._adminMatches = matches;
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openCardModal()"><i class="fas fa-plus"></i> تسجيل بطاقة</button><span class="text-muted">${cards.length} بطاقة</span></div>
  ${cards.length > 0 ? `<div class="table-responsive"><table class="admin-table"><thead><tr><th>المباراة</th><th>اللاعب</th><th>النوع</th><th>الدقيقة</th><th>الفريق</th><th>حذف</th></tr></thead><tbody>${cards.map(cd => { const m = matches.find(x => x.id === cd.matchId); const p = players.find(x => x.id === cd.playerId); const t = teams.find(x => x.id === cd.teamId); const tA = m ? teams.find(x => x.id === m.teamAId) : null; const tB = m ? teams.find(x => x.id === m.teamBId) : null; return `<tr><td style="font-size:.82rem">${tA?.name || '?'} vs ${tB?.name || '?'}</td><td><strong>${p?.name || '-'}</strong></td><td><span style="display:inline-block;width:18px;height:24px;border-radius:3px;background:${cd.type === 'red' ? 'var(--red)' : 'var(--yellow)'};vertical-align:middle"></span> ${cd.type === 'red' ? 'حمراء' : 'صفراء'}</td><td><span class="goal-minute">${cd.minute}'</span></td><td>${t?.name || '-'}</td><td class="actions"><button class="btn btn-sm btn-danger" onclick="delDoc('cards','${cd.id}',adminCards)"><i class="fas fa-trash"></i></button></td></tr>` }).join('')}</tbody></table></div>` : emptyHTML('fas fa-square', 'لا توجد بطاقات')}`
}

function openCardModal() {
  const matches = window._adminMatches || [], teams = window._adminTeams || [], players = window._adminPlayers || []; const fin = matches.filter(m => m.status === 'finished' || m.status === 'live'); const mOpts = fin.map(m => { const a = teams.find(t => t.id === m.teamAId), b = teams.find(t => t.id === m.teamBId); return `<option value="${m.id}">${a?.name || '?'} vs ${b?.name || '?'}</option>` }).join(''); const pOpts = players.map(p => `<option value="${p.id}">${p.name}</option>`).join(''); const tOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  showModal('تسجيل بطاقة 🟨🟥', `<form onsubmit="saveCard(event)"><div class="form-group"><label>المباراة *</label><select id="cdMatch" required><option value="">اختر</option>${mOpts}</select></div><div class="form-group"><label>اللاعب *</label><select id="cdPlayer" required><option value="">اختر</option>${pOpts}</select></div><div class="form-group"><label>الفريق *</label><select id="cdTeam" required><option value="">اختر</option>${tOpts}</select></div><div class="form-group"><label>النوع *</label><select id="cdType" required><option value="yellow">🟨 صفراء</option><option value="red">🟥 حمراء</option></select></div><div class="form-group"><label>الدقيقة *</label><input type="number" id="cdMinute" min="1" max="120" required></div><button type="submit" class="btn btn-primary" style="width:100%"><i class="fas fa-save"></i> تسجيل</button></form>`)
}

async function saveCard(e) { e.preventDefault(); try { await db.collection('cards').add({ matchId: document.getElementById('cdMatch').value, playerId: document.getElementById('cdPlayer').value, teamId: document.getElementById('cdTeam').value, type: document.getElementById('cdType').value, minute: +document.getElementById('cdMinute').value, createdAt: new Date().toISOString() }); showToast('تم التسجيل ✅'); closeModal(); adminCards() } catch (err) { showToast('خطأ: ' + err.message) } }

// ========== NEWS (with Polls) ==========
async function adminNews() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let news = [];
  try { const s = await db.collection('news').orderBy('date', 'desc').get(); news = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openNewsModal()"><i class="fas fa-plus"></i> إضافة خبر</button><span class="text-muted">${news.length} خبر</span></div>
  ${news.length > 0 ? `<div class="admin-cards-grid">${news.map(n => `<div class="admin-item-card">
    <div class="admin-item-top">${n.image ? `<img src="${n.image}" style="width:80px;height:60px;border-radius:8px;object-fit:cover" alt="${n.title || 'صورة'}" loading="lazy">` : '<div style="width:80px;height:60px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">📰</div>'}
    <div style="flex:1"><h4 style="font-size:.9rem">${n.title}</h4><div style="display:flex;gap:6px;margin-top:4px"><span class="admin-badge ${n.published ? 'badge-green' : 'badge-yellow'}">${n.published ? 'منشور' : 'مسودة'}</span>${n.poll ? '<span class="admin-badge badge-purple">📊 استطلاع</span>' : ''}</div><div class="text-muted" style="font-size:.75rem;margin-top:4px">${formatDate(n.date)}</div></div></div>
    <div class="admin-item-actions"><button class="btn btn-sm btn-outline" onclick="openNewsModal('${n.id}')"><i class="fas fa-edit"></i> تعديل</button><button class="btn btn-sm btn-outline" onclick="viewComments('${n.id}','${n.title}')"><i class="fas fa-comments"></i></button><button class="btn btn-sm btn-danger" onclick="delDoc('news','${n.id}',adminNews)"><i class="fas fa-trash"></i></button></div>
  </div>`).join('')}</div>` : emptyHTML('fas fa-newspaper', 'لا توجد أخبار')}`
}

function openNewsModal(id) {
  showModal(id ? 'تعديل خبر' : 'إضافة خبر', `<form onsubmit="saveNews(event,'${id || ''}')">
  <div class="form-group"><label>العنوان *</label><input type="text" id="nTitle" required></div>
  <div class="form-group"><label>المحتوى *</label><textarea id="nBody" rows="5" required></textarea></div>
  <div class="form-group"><label>صورة</label><input type="file" id="nImage" accept="image/*"></div>
  <div class="form-group"><label>التاريخ</label><input type="datetime-local" id="nDate"></div>
  <div class="form-group"><label><input type="checkbox" id="nPublished" checked> منشور</label></div>
  <hr style="border-color:var(--border);margin:18px 0">
  <div class="form-group"><label><input type="checkbox" id="nHasPoll" onchange="document.getElementById('pollFields').style.display=this.checked?'block':'none'"> 📊 إضافة استطلاع رأي</label></div>
  <div id="pollFields" style="display:none;background:var(--bg-secondary);padding:14px;border-radius:10px;margin-bottom:14px">
    <div class="form-group"><label>سؤال الاستطلاع</label><input type="text" id="pollQ" placeholder="مثال: مين هيكسب المباراة؟"></div>
    <div class="form-group"><label>الخيار 1</label><input type="text" id="pollO1" placeholder="الخيار الأول"></div>
    <div class="form-group"><label>الخيار 2</label><input type="text" id="pollO2" placeholder="الخيار الثاني"></div>
    <div class="form-group"><label>الخيار 3 (اختياري)</label><input type="text" id="pollO3" placeholder="الخيار الثالث"></div>
    <div class="form-group"><label>الخيار 4 (اختياري)</label><input type="text" id="pollO4" placeholder="الخيار الرابع"></div>
  </div>
  <button type="submit" class="btn btn-primary" style="width:100%" id="saveNewsBtn"><i class="fas fa-save"></i> حفظ</button></form>`, async () => {
    if (!id) return; try {
      const d = await db.collection('news').doc(id).get(); if (d.exists) {
        const n = d.data(); document.getElementById('nTitle').value = n.title || ''; document.getElementById('nBody').value = n.body || ''; document.getElementById('nDate').value = n.date || ''; document.getElementById('nPublished').checked = n.published !== false;
        if (n.poll && n.poll.question) { document.getElementById('nHasPoll').checked = true; document.getElementById('pollFields').style.display = 'block'; document.getElementById('pollQ').value = n.poll.question; const opts = n.poll.options || []; if (opts[0]) document.getElementById('pollO1').value = opts[0]; if (opts[1]) document.getElementById('pollO2').value = opts[1]; if (opts[2]) document.getElementById('pollO3').value = opts[2]; if (opts[3]) document.getElementById('pollO4').value = opts[3] }
      }
    } catch (e) { }
  })
}

async function saveNews(e, id) {
  e.preventDefault(); const btn = document.getElementById('saveNewsBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i>';
  const data = { title: document.getElementById('nTitle').value, body: document.getElementById('nBody').value, date: document.getElementById('nDate').value || new Date().toISOString(), published: document.getElementById('nPublished').checked, updatedAt: new Date().toISOString() };
  if (document.getElementById('nHasPoll').checked) {
    const q = document.getElementById('pollQ').value.trim(); const opts = [document.getElementById('pollO1').value.trim(), document.getElementById('pollO2').value.trim(), document.getElementById('pollO3').value.trim(), document.getElementById('pollO4').value.trim()].filter(Boolean);
    if (q && opts.length >= 2) data.poll = { question: q, options: opts, votes: opts.map(() => 0) }; else { showToast('الاستطلاع يحتاج سؤال و خيارين على الأقل'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ'; return }
  } else if (!id) { data.poll = null }
  const file = document.getElementById('nImage').files[0]; if (file) { const url = await uploadToImgBB(file); if (url) data.image = url }
  try { if (id) await db.collection('news').doc(id).update(data); else { data.createdAt = new Date().toISOString(); data.reactions = {}; await db.collection('news').add(data) } showToast('تم الحفظ ✅'); closeModal(); adminNews() } catch (err) { showToast('خطأ: ' + err.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ' }
}

async function viewComments(newsId, title) {
  let comments = []; try { const s = await db.collection('comments').where('newsId', '==', newsId).orderBy('createdAt', 'desc').get(); comments = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  showModal(`💬 تعليقات: ${title}`, comments.length > 0 ? `<div class="comment-list">${comments.map(c => `<div class="comment-item"><div class="comment-avatar">${(c.name || '?').charAt(0)}</div><div class="comment-body" style="flex:1"><div class="comment-name">${c.name}</div><div class="comment-text">${c.text}</div><div class="comment-time">${timeAgo(c.createdAt)}</div></div><button class="btn btn-xs btn-danger" onclick="delComment('${c.id}','${newsId}','${title}')"><i class="fas fa-trash"></i></button></div>`).join('')}</div>` : '<p class="text-muted">لا توجد تعليقات</p>')
}

async function delComment(commentId, newsId, title) { if (!confirm('حذف هذا التعليق؟')) return; try { await db.collection('comments').doc(commentId).delete(); showToast('تم الحذف'); viewComments(newsId, title) } catch (e) { showToast('خطأ: ' + e.message) } }

// ========== HIGHLIGHTS (ImgBB) ==========
async function adminHighlights() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>';
  let highlights = [], matches = [], teams = [], players = [];
  try {
    const [hs, ms, ts, ps] = await Promise.all([
      db.collection('highlights').orderBy('createdAt', 'desc').get(),
      db.collection('matches').orderBy('date', 'desc').get(),
      db.collection('teams').get(),
      db.collection('players').get()
    ]);
    highlights = hs.docs.map(d => ({ id: d.id, ...d.data() }));
    matches = ms.docs.map(d => ({ id: d.id, ...d.data() }));
    teams = ts.docs.map(d => ({ id: d.id, ...d.data() }));
    players = ps.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { }
  window._adminTeams = teams; window._adminPlayers = players; window._adminMatches = matches;

  const getT = id => teams.find(t => t.id === id);
  const getP = id => players.find(p => p.id === id);

  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openHighlightModal()"><i class="fas fa-plus-circle"></i> إضافة لقطة جديدة</button><span class="text-muted">${highlights.length} لقطة</span></div>
  ${highlights.length > 0 ? `<div class="admin-grid">${highlights.map(h => {
    const p = h.playerId ? getP(h.playerId) : null;
    const m = h.matchId ? matches.find(x => x.id === h.matchId) : null;
    const tA = m ? getT(m.teamAId) : null, tB = m ? getT(m.teamBId) : null;
    return `<div class="stat-card" style="position:relative;padding:10px">
      ${h.type === 'shorts' ? `<div style="position:relative;width:100%;height:150px;background:#000;border-radius:8px;overflow:hidden"><img src="https://i.ytimg.com/vi/${h.url}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;opacity:0.8"><div style="position:absolute;top:8px;right:8px;background:rgba(255,0,0,.9);color:#fff;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:700"><i class="fab fa-youtube"></i> Shorts</div><i class="fab fa-youtube" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2.5rem;color:red"></i></div>` : h.type === 'youtube' ? `<div style="position:relative;width:100%;height:150px;background:#000;border-radius:8px;overflow:hidden"><img src="https://i.ytimg.com/vi/${h.url}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;opacity:0.8"><i class="fab fa-youtube" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3rem;color:red"></i></div>` : `<img src="${h.url}" style="width:100%;height:150px;object-fit:cover;border-radius:8px" loading="lazy" referrerpolicy="no-referrer">`}
      <div style="margin-top:10px;font-weight:bold;font-size:.9rem">${h.title || 'لقطة مميزة'}</div>
      ${p ? `<div style="font-size:.8rem;color:var(--gold);margin-top:4px"><i class="fas fa-user"></i> ${p.name}</div>` : ''}
      ${m ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:2px"><i class="fas fa-futbol"></i> ${tA?.name || '?'} vs ${tB?.name || '?'}</div>` : ''}
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px"><i class="far fa-clock"></i> ${formatDate(h.createdAt)}</div>
      <button class="btn btn-xs btn-danger" style="position:absolute;top:8px;right:8px;border-radius:50%;width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center" onclick="delDoc('highlights','${h.id}',adminHighlights)"><i class="fas fa-trash"></i></button>
    </div>`}).join('')}</div>` : emptyHTML('fas fa-images', 'لا توجد لقطات بعد. أضف أول لقطة!')}`;
}

function openHighlightModal(preMatchId) {
  const matches = window._adminMatches || [];
  const players = window._adminPlayers || [];
  const teams = window._adminTeams || [];
  const mOpts = matches.map(m => {
    const a = teams.find(t => t.id === m.teamAId), b = teams.find(t => t.id === m.teamBId);
    return `<option value="${m.id}" ${m.id === preMatchId ? 'selected' : ''}>${a?.name || '?'} vs ${b?.name || '?'} (ج${m.round || '-'})</option>`;
  }).join('');
  const pOpts = players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  showModal('📸 إضافة لقطة جديدة', `<form onsubmit="saveHighlight(event)">
    <div class="form-group"><label for="hlTitle">عنوان اللقطة</label><input type="text" id="hlTitle" class="form-control" placeholder="مثال: هدف خرافي من نص الملعب"></div>
    <div class="form-group"><label for="hlMatch">المباراة *</label><select id="hlMatch" class="form-control" required><option value="">اختر المباراة</option>${mOpts}</select></div>
    <div class="form-group"><label for="hlPlayer">اللاعب *</label><select id="hlPlayer" class="form-control" required><option value="">اختر اللاعب</option>${pOpts}</select></div>
    <div style="background:var(--bg-secondary);padding:14px;border-radius:12px;margin-bottom:14px">
      <h4 style="color:var(--gold);margin-bottom:12px"><i class="fas fa-photo-video"></i> نوع اللقطة</h4>
      <div class="form-group"><label for="hlVideoUrl"><i class="fab fa-youtube" style="color:#FF0000"></i> رابط فيديو (يوتيوب أو شورتز)</label><input type="text" id="hlVideoUrl" class="form-control" placeholder="https://youtube.com/shorts/... أو https://youtube.com/watch?v=..."></div>
      <div style="text-align:center;margin:8px 0;font-weight:bold;color:var(--text-muted)">أو</div>
      <div class="form-group"><label for="hlFile"><i class="fas fa-image"></i> رفع صورة اللقطة</label><input type="file" id="hlFile" accept="image/*" class="form-control"></div>
    </div>
    <div class="alert alert-info" style="font-size:.8rem;margin-top:10px"><i class="fas fa-info-circle"></i> ألصق رابط الفيديو من يوتيوب أو شورتز وسيتم التعرف عليه تلقائياً. الشورتز ستظهر بتصميم عمودي مميز!</div>
    <button type="submit" class="btn btn-primary" style="width:100%" id="saveHlBtn"><i class="fas fa-upload"></i> حفظ اللقطة</button>
  </form>`);
}

function detectVideoType(url) {
  if (!url) return null;
  url = url.trim();
  // Check if it's a Shorts URL (handles www., m., etc.)
  const shortsMatch = url.match(/(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) {
    const id = shortsMatch[1].length >= 11 ? shortsMatch[1].substring(0, 11) : shortsMatch[1];
    return { type: 'shorts', id: id };
  }
  // Check standard YouTube formats (handles www., m., youtu.be, etc.)
  const ytMatch = url.match(/(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  return null;
}

async function saveHighlight(e) {
  e.preventDefault();
  const fileInput = document.getElementById('hlFile');
  const videoUrl = document.getElementById('hlVideoUrl').value.trim();

  if (!fileInput.files[0] && !videoUrl) { showToast('يرجى إدخال رابط فيديو أو اختيار صورة'); return; }

  const btn = document.getElementById('saveHlBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-futbol fa-spin-roll"></i> جاري الحفظ...';

  try {
    let finalUrl = '';
    let type = 'image';

    if (videoUrl) {
      const detected = detectVideoType(videoUrl);
      if (detected) {
        finalUrl = detected.id;
        type = detected.type;
      } else {
        throw new Error('رابط الفيديو غير صالح. تأكد من لصق رابط يوتيوب أو شورتز صحيح');
      }
    } else if (fileInput.files[0]) {
      finalUrl = await uploadToImgBB(fileInput.files[0]);
      if (!finalUrl) throw new Error('فشل رفع الصورة');
    }

    const data = {
      title: document.getElementById('hlTitle').value.trim(),
      matchId: document.getElementById('hlMatch').value,
      playerId: document.getElementById('hlPlayer').value,
      url: finalUrl,
      type: type,
      createdAt: new Date().toISOString()
    };

    await db.collection('highlights').add(data);
    showToast('تم حفظ اللقطة بنجاح ✅');
    closeModal();
    adminHighlights();
  } catch (err) {
    showToast('خطأ: ' + err.message);
    btn.innerHTML = '<i class="fas fa-upload"></i> حفظ اللقطة'; btn.disabled = false;
  }
}

// ========== MESSAGES ==========
async function adminMessages() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let msgs = [];
  try { const s = await db.collection('messages').orderBy('createdAt', 'desc').get(); msgs = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { try { const s2 = await db.collection('messages').get(); msgs = s2.docs.map(d => ({ id: d.id, ...d.data() })); msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) } catch (e2) { } }
  c.innerHTML = `<p class="text-muted mb-3"><i class="fas fa-inbox"></i> الرسائل الواردة من الزوار (<span id="msgCountBadge">${msgs.length}</span> رسالة)</p>
  ${msgs.length > 0 ? msgs.map(m => `<div class="message-item ${m.read ? '' : 'unread'}" id="msgRow_${m.id}">
    <div class="message-item-header"><span class="message-sender"><i class="fas fa-user"></i> ${escapeHTML(m.name || 'مجهول')} ${!m.read ? '<span class="admin-badge badge-yellow" style="font-size:.68rem">جديد</span>' : ''}</span><span class="message-time">${timeAgo(m.createdAt)}</span></div>
    <div class="message-text">${escapeHTML(m.message || '')}</div>
    ${m.image ? `<div style="margin-top:8px"><a href="${m.image}" target="_blank"><img src="${m.image}" style="max-width:140px;border-radius:8px;object-fit:cover" loading="lazy" referrerpolicy="no-referrer"></a></div>` : ''}
    ${m.reply ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(240,192,64,.06);border-radius:12px;border-right:3px solid var(--gold)"><div style="font-size:.78rem;color:var(--gold);font-weight:700;margin-bottom:4px"><i class="fas fa-reply"></i> ردك</div><div style="font-size:.88rem">${escapeHTML(m.reply)}</div></div>` : `<div style="margin-top:10px" id="replyBox_${m.id}"><textarea id="replyText_${m.id}" placeholder="اكتب ردك هنا..." rows="2" style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text-primary);font-family:var(--font);font-size:.85rem;margin-bottom:6px;resize:vertical"></textarea><button class="btn btn-sm btn-primary" onclick="replyToMessage('${m.id}')"><i class="fas fa-reply"></i> إرسال الرد</button></div>`}
    <div class="message-actions" style="margin-top:8px">${!m.read ? `<button class="btn btn-xs btn-outline" onclick="markRead('${m.id}')"><i class="fas fa-check"></i> مقروء</button>` : ''}<button class="btn btn-xs btn-danger" onclick="delMessageFast('${m.id}')"><i class="fas fa-trash"></i></button></div>
  </div>`).join('') : emptyHTML('fas fa-envelope', 'لا توجد رسائل')}`
}

async function markRead(id) { try { await db.collection('messages').doc(id).update({ read: true }); showToast('تم ✅'); adminMessages() } catch (e) { showToast('خطأ') } }
async function replyToMessage(id) {
  const text = document.getElementById('replyText_' + id)?.value.trim();
  if (!text) { showToast('اكتب الرد أولاً'); return }
  try { await db.collection('messages').doc(id).update({ reply: text, replyAt: new Date().toISOString(), replySource: 'admin', read: true }); showToast('تم إرسال الرد ✅'); adminMessages() } catch (e) { showToast('خطأ: ' + e.message) }
}

let _msgRefreshTimer = null;
async function delMessageFast(id) {
  if (!confirm('هل أنت متأكد من الحذف؟')) return;
  
  // 1. Instantly remove from DOM to prevent UI freeze
  const row = document.getElementById('msgRow_' + id);
  if (row) row.remove();
  
  // Update counter visually if possible
  const counterSpan = document.getElementById('msgCountBadge');
  if (counterSpan) {
    const current = parseInt(counterSpan.innerText) || 1;
    counterSpan.innerText = Math.max(0, current - 1);
  }

  try { 
    // 2. Delete from DB in background
    await db.collection('messages').doc(id).delete(); 
    showToast('تم الحذف ✅'); 
    
    // 3. Debounce the full refresh by 30 seconds so it doesn't freeze when mass-deleting
    if (_msgRefreshTimer) clearTimeout(_msgRefreshTimer);
    _msgRefreshTimer = setTimeout(() => {
      // Only refresh if still on messages tab
      if (document.querySelector('.admin-page-header') || document.querySelector('.message-item')) {
         adminMessages();
      }
    }, 30000); 
  } catch (e) { showToast('خطأ في الحذف: ' + e.message) }
}

// ========== BROADCAST MESSAGES ==========
async function adminBroadcast() {
  const c = document.getElementById('adminInner');
  c.innerHTML = `
    <div class="card">
      <h3 style="color:var(--gold);margin-bottom:18px"><i class="fas fa-bullhorn"></i> إرسال رسالة للجميع</h3>
      <p class="text-muted" style="margin-bottom:14px;font-size:.9rem">هذه الرسالة ستظهر لجميع المستخدمين في قسم "تواصل معنا" كرد (باسم الإدارة).</p>
      
      <div class="form-group">
        <label>نص الرسالة</label>
        <textarea id="broadcastText" rows="4" style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--text-primary);font-family:var(--font);resize:vertical" placeholder="اكتب الرسالة التي تريد إرسالها للجميع هنا..."></textarea>
      </div>
      
      <button class="btn btn-primary" onclick="sendBroadcastMessage()"><i class="fas fa-paper-plane"></i> إرسال الرسالة للجميع الآن</button>
    </div>
  `;
}

async function sendBroadcastMessage() {
  const text = document.getElementById('broadcastText').value.trim();
  if (!text) { showToast('يرجى كتابة الرسالة أولاً'); return; }

  if (!confirm('هل أنت متأكد من إرسال هذه الرسالة لجميع المستخدمين الذين تواصلوا معنا؟')) return;

  const c = document.getElementById('adminInner');
  c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i> جاري الإرسال للجميع...</div>';

  try {
    const snap = await db.collection('messages').get();

    // Group messages by user name so we only send one broadcast per user thread
    const uniqueUsers = new Set();
    const batch = db.batch();

    snap.docs.forEach(doc => {
      const msgData = doc.data();
      const audienceId = msgData.uid;
      if (msgData.name && audienceId && !uniqueUsers.has(audienceId)) {
        uniqueUsers.add(audienceId);

        // Create a new "fake" interaction that looks like a reply from the admin
        const newMsgRef = db.collection('messages').doc();
        batch.set(newMsgRef, {
          uid: audienceId,
          name: msgData.name,
          message: "إعلان من الإدارة لجميع الأعضاء:",
          replySource: 'admin',
          read: true,
          createdAt: new Date().toISOString(),
          reply: text,
          replyAt: new Date().toISOString(),
          isBroadcast: true
        });
      }
    });

    await batch.commit();
    showToast(`تم الإرسال إلى ${uniqueUsers.size} مستخدم بنجاح ✅`);
    adminBroadcast();
  } catch (e) {
    showToast('خطأ: ' + e.message);
    adminBroadcast();
  }
}

// ========== PUSH NOTIFICATIONS (FCM) ==========
async function adminNotifications() {
  const c = document.getElementById('adminInner');
  c.innerHTML = `<div class="card">
    <h3 style="color:var(--gold);margin-bottom:12px"><i class="fas fa-bell"></i> إشعار لكل المشتركين</h3>
    <p class="text-muted" style="margin-bottom:16px">الإرسال يتم من Cloud Functions بعد تفعيل صلاحية الإدارة الآمنة وإعداد FCM.</p>
    <div class="form-group"><label>عنوان الإشعار</label><input id="pushTitle" maxlength="80" placeholder="مثال: مباراة الليلة"></div>
    <div class="form-group"><label>نص الإشعار</label><textarea id="pushBody" rows="3" maxlength="220" placeholder="اكتب رسالة قصيرة للجمهور"></textarea></div>
    <button class="btn btn-primary" onclick="sendTournamentPush()"><i class="fas fa-paper-plane"></i> إرسال الإشعار</button>
    <p id="pushStatus" class="text-muted" style="margin-top:12px"></p>
  </div>`;
}
async function sendTournamentPush() {
  const title = document.getElementById('pushTitle')?.value.trim();
  const body = document.getElementById('pushBody')?.value.trim();
  const status = document.getElementById('pushStatus');
  if (!title || !body) { showToast('اكتب عنوان الإشعار ونصه'); return; }
  if (!confirm('إرسال الإشعار الآن لكل المشتركين؟')) return;
  try {
    await firebase.functions().httpsCallable('sendTournamentNotification')({ title, body });
    status.textContent = 'تم إرسال الإشعار ✅ إلى قائمة المشتركين.';
    showToast('تم إرسال الإشعار ✅');
  } catch (err) {
    status.textContent = err.code === 'functions/permission-denied'
      ? 'حساب الإدارة يحتاج custom claim باسم admin قبل الإرسال.'
      : `تعذر الإرسال: ${err.message}`;
    showToast('تعذر إرسال الإشعار');
  }
}

// ========== SEASONS ==========
async function adminSeasons() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>'; let seasons = [];
  try { const s = await db.collection('seasons').get(); seasons = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  c.innerHTML = `<div class="admin-page-header"><button class="btn btn-primary" onclick="openSeasonModal()"><i class="fas fa-plus"></i> إضافة موسم</button></div>
  <div class="admin-cards-grid">${seasons.length > 0 ? seasons.map(s => `<div class="admin-item-card" style="text-align:center"><h3 style="font-size:1.2rem;color:var(--gold)">${s.name || s.year || '-'}</h3>
    <span class="admin-badge ${s.active ? 'badge-green' : 'badge-red'}" style="margin-top:12px">${s.active ? '✅ موسم نشط' : '📦 أرشيف'}</span>
    <div class="admin-item-actions" style="margin-top:16px;justify-content:center"><button class="btn btn-sm ${s.active ? 'btn-outline' : 'btn-primary'}" onclick="toggleSeason('${s.id}',${!s.active})"><i class="fas fa-${s.active ? 'archive' : 'play'}"></i> ${s.active ? 'أرشفة' : 'تفعيل'}</button><button class="btn btn-sm btn-danger" onclick="delDoc('seasons','${s.id}',adminSeasons)"><i class="fas fa-trash"></i></button></div>
  </div>`).join('') : '<div style="grid-column:1/-1">' + emptyHTML('fas fa-calendar-alt', 'لا توجد مواسم') + '</div>'}</div>`
}

function openSeasonModal() { showModal('إضافة موسم', `<form onsubmit="saveSeason(event)"><div class="form-group"><label>اسم الموسم</label><input type="text" id="sName" required placeholder="مثال: رمضان 2025"></div><div class="form-group"><label>السنة</label><input type="number" id="sYear" value="2025"></div><div class="form-group"><label><input type="checkbox" id="sActive" checked> موسم نشط</label></div><button type="submit" class="btn btn-primary" style="width:100%"><i class="fas fa-save"></i> حفظ</button></form>`) }
async function saveSeason(e) { e.preventDefault(); try { await db.collection('seasons').add({ name: document.getElementById('sName').value, year: +document.getElementById('sYear').value, active: document.getElementById('sActive').checked, createdAt: new Date().toISOString() }); showToast('تم الحفظ ✅'); closeModal(); adminSeasons() } catch (err) { showToast('خطأ: ' + err.message) } }
async function toggleSeason(id, val) { try { await db.collection('seasons').doc(id).update({ active: val }); showToast('تم التحديث ✅'); adminSeasons() } catch (e) { showToast('خطأ') } }

// ========== PLAYER PHOTO APPROVALS ==========
async function adminPlayerPhotos() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i> جاري التحميل...</div>';
  let reqs = []; try { const s = await db.collection('playerPhotoRequests').get(); reqs = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  const pending = reqs.filter(r => r.status === 'pending');
  const approved = reqs.filter(r => r.status === 'approved');
  c.innerHTML = `<div class="admin-page-header"><span class="text-gold" style="font-weight:700"><i class="fas fa-camera"></i> صور اللاعبين</span><span class="text-muted">${pending.length} بانتظار الموافقة</span></div>
  ${pending.length > 0 ? `<h4 style="color:var(--yellow);margin-bottom:12px">⏳ بانتظار الموافقة (${pending.length})</h4>${pending.map(p => `<div class="approval-card"><img src="${p.photo}" alt="${p.playerName}" loading="lazy" referrerpolicy="no-referrer"><div class="approval-info"><h4>${p.playerName}</h4><p>${timeAgo(p.createdAt)}</p></div><div class="approval-actions"><button class="btn btn-sm btn-primary" onclick="approvePlayerPhoto('${p.id}','${p.playerId}')"><i class="fas fa-check"></i> موافقة</button><button class="btn btn-sm btn-danger" onclick="rejectPlayerPhoto('${p.id}')"><i class="fas fa-times"></i> رفض</button></div></div>`).join('')}` : ''}
  ${approved.length > 0 ? `<h4 style="color:var(--green);margin:22px 0 12px">✅ معتمدة (${approved.length})</h4>${approved.map(p => `<div class="approval-card"><img src="${p.photo}" alt="${p.playerName}" loading="lazy" referrerpolicy="no-referrer"><div class="approval-info"><h4>${p.playerName}</h4><p>معتمدة</p></div></div>`).join('')}` : ''}
  ${reqs.length === 0 ? emptyHTML('fas fa-camera', 'لا توجد طلبات بعد') : ''}`;
}
async function approvePlayerPhoto(reqId, playerId) {
  try {
    const reqDoc = await db.collection('playerPhotoRequests').doc(reqId).get();
    const photoUrl = reqDoc.data().photo;
    await db.collection('playerPhotoRequests').doc(reqId).update({ status: 'approved' });
    await db.collection('players').doc(playerId).update({ photo: photoUrl });
    // Delete other pending requests for same player
    const others = await db.collection('playerPhotoRequests').where('playerId', '==', playerId).where('status', '==', 'pending').get();
    const batch = db.batch(); others.docs.forEach(d => batch.delete(d.ref)); await batch.commit();
    showToast('تم اعتماد الصورة وتحديث اللاعب ✅'); adminPlayerPhotos();
  } catch (e) { showToast('خطأ: ' + e.message) }
}
async function rejectPlayerPhoto(reqId) {
  if (!confirm('حذف هذا الطلب؟')) return;
  try { await db.collection('playerPhotoRequests').doc(reqId).delete(); showToast('تم الحذف'); adminPlayerPhotos() } catch (e) { showToast('خطأ: ' + e.message) }
}

// ========== PROFILE APPROVALS ==========
async function adminProfiles() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i> جاري التحميل...</div>';
  let profiles = []; try { const s = await db.collection('userProfiles').orderBy('createdAt', 'desc').get(); profiles = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { try { const s = await db.collection('userProfiles').get(); profiles = s.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e2) { } }
  const pending = profiles.filter(p => p.status === 'pending');
  const approved = profiles.filter(p => p.status === 'approved');
  c.innerHTML = `<div class="admin-page-header"><span class="text-gold" style="font-weight:700"><i class="fas fa-image"></i> صور المستخدمين</span><span class="text-muted">${pending.length} بانتظار الموافقة</span></div>
  ${pending.length > 0 ? `<h4 style="color:var(--yellow);margin-bottom:12px">⏳ بانتظار الموافقة (${pending.length})</h4>${pending.map(p => `<div class="approval-card"><img src="${p.photo}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer"><div class="approval-info"><h4>${p.name}</h4><p>${timeAgo(p.createdAt)}</p></div><div class="approval-actions"><button class="btn btn-sm btn-primary" onclick="approveProfile('${p.id}')"><i class="fas fa-check"></i> موافقة</button><button class="btn btn-sm btn-danger" onclick="rejectProfile('${p.id}')"><i class="fas fa-times"></i> رفض</button></div></div>`).join('')}` : ''}
  ${approved.length > 0 ? `<h4 style="color:var(--green);margin:22px 0 12px">✅ معتمدة (${approved.length})</h4>${approved.map(p => `<div class="approval-card"><img src="${p.photo}" alt="${p.name}" loading="lazy" referrerpolicy="no-referrer"><div class="approval-info"><h4>${p.name}</h4><p>معتمدة</p></div><div class="approval-actions"><button class="btn btn-sm btn-danger" onclick="rejectProfile('${p.id}')"><i class="fas fa-trash"></i></button></div></div>`).join('')}` : ''}
  ${profiles.length === 0 ? emptyHTML('fas fa-image', 'لا توجد صور بعد') : ''}`;
}
async function approveProfile(id) { try { await db.collection('userProfiles').doc(id).update({ status: 'approved' }); showToast('تم الاعتماد ✅'); adminProfiles() } catch (e) { showToast('خطأ: ' + e.message) } }
async function rejectProfile(id) { if (!confirm('حذف هذه الصورة؟')) return; try { await db.collection('userProfiles').doc(id).delete(); showToast('تم الحذف'); adminProfiles() } catch (e) { showToast('خطأ: ' + e.message) } }

// ========== SETTINGS ==========
async function adminSettings() {
  const c = document.getElementById('adminInner'); let stats = {}; try { const d = await db.collection('statistics').doc('general').get(); if (d.exists) stats = d.data() } catch (e) { }
  c.innerHTML = `<div class="card"><h3 style="color:var(--gold);margin-bottom:18px"><i class="fas fa-cog"></i> إعدادات عامة</h3>
    <div class="form-group"><label>الأجهزة الفريدة التي زارت الموقع</label><input type="number" value="${stats.visits || 0}" readonly style="width:200px;opacity:.8"></div>
    <p class="text-muted">العدّ يتم مرة واحدة لكل تثبيت/متصفح باستخدام Firebase، ولا يُحسب تكرار الدخول كزائر جديد.</p>
    <hr style="border-color:var(--border);margin:22px 0"><h4 style="color:var(--gold);margin-bottom:12px"><i class="fas fa-key"></i> حماية الإدارة</h4>
    <p class="text-muted">كلمة مرور الإدارة محفوظة كـ Secret على الخادم، وليست في قاعدة البيانات أو المتصفح. لتغييرها استخدم الأمر <code>firebase functions:secrets:set ADMIN_PASSWORD</code> ثم أعد نشر Functions.</p>
    <hr style="border-color:var(--border);margin:22px 0"><h4 style="color:var(--text-secondary);margin-bottom:12px">🗑️ إجراءات خطيرة</h4>
    <button class="btn btn-sm btn-danger" onclick="resetAllReactions()"><i class="fas fa-redo"></i> إعادة تعيين جميع التفاعلات</button>
  </div>`}

async function resetAllReactions() { if (!confirm('هل أنت متأكد من إعادة تعيين كل التفاعلات؟')) return; try { const s = await db.collection('news').get(); const batch = db.batch(); s.docs.forEach(d => batch.update(d.ref, { reactions: {} })); await batch.commit(); showToast('تم إعادة التعيين ✅') } catch (e) { showToast('خطأ: ' + e.message) } }

// ========== LINEUP MANAGEMENT ==========
async function adminLineup() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>';
  let teams = [], players = []; try { const [ts, ps] = await Promise.all([db.collection('teams').get(), db.collection('players').get()]); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); players = ps.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  window._adminTeams = teams; window._adminPlayers = players;
  const FMTS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2'];
  const teamOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  const fmtOpts = FMTS.map(f => `<option value="${f}">${f}</option>`).join('');
  c.innerHTML = `<div class="card">
    <h3 style="color:var(--gold);margin-bottom:18px"><i class="fas fa-th"></i> إدارة التشكيلات</h3>
    <div class="grid-2" style="gap:12px;margin-bottom:16px">
      <div class="form-group"><label>الفريق</label><select id="luTeam" style="width:100%"><option value="">اختر</option>${teamOpts}</select></div>
      <div class="form-group"><label>التشكيلة</label><select id="luForm" style="width:100%">${fmtOpts}</select></div>
    </div>
    <button class="btn btn-primary" onclick="previewAdminLineup()"><i class="fas fa-eye"></i> معاينة التشكيلة</button>
    <button class="btn btn-outline" style="margin-right:8px" onclick="saveLineupConfig()"><i class="fas fa-save"></i> حفظ التشكيلة الافتراضية</button>
    <a href="#/lineup" target="_blank" class="btn btn-sm btn-outline" style="margin-right:8px"><i class="fas fa-external-link-alt"></i> فتح صفحة التشكيلة</a>
  </div>
  <div id="luPreview" style="margin-top:20px"></div>`;
  // Load saved lineup config
  try { const d = await db.collection('settings').doc('lineup').get(); if (d.exists) { const cfg = d.data(); if (cfg.teamId) document.getElementById('luTeam').value = cfg.teamId; if (cfg.formation) document.getElementById('luForm').value = cfg.formation; } } catch (e) { }
}

function previewAdminLineup() {
  const teamId = document.getElementById('luTeam').value;
  const formation = document.getElementById('luForm').value;
  const team = (window._adminTeams || []).find(t => t.id === teamId);
  const players = (window._adminPlayers || []).filter(p => p.teamId === teamId);
  const wrap = document.getElementById('luPreview');
  if (!team) { wrap.innerHTML = '<p class="text-muted">اختر فريقاً أولاً</p>'; return; }
  if (typeof buildLineupField === 'function') wrap.innerHTML = buildLineupField(team, players, formation);
  else { navigateTo('#/lineup/' + teamId); }
}

async function saveLineupConfig() {
  const teamId = document.getElementById('luTeam').value;
  const formation = document.getElementById('luForm').value;
  try { await db.collection('settings').doc('lineup').set({ teamId, formation }, { merge: true }); showToast('تم حفظ التشكيلة الافتراضية ✅') } catch (e) { showToast('خطأ: ' + e.message) }
}

// ========== COMPARE TEAMS ==========
async function adminCompare() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>';
  let teams = [], matches = [], goals = []; try { const [ts, ms, gs] = await Promise.all([db.collection('teams').get(), db.collection('matches').get(), db.collection('goals').get()]); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); goals = gs.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  const tOpts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  c.innerHTML = `<div class="card">
    <h3 style="color:var(--gold);margin-bottom:18px"><i class="fas fa-balance-scale"></i> مقارنة الفرق</h3>
    <div class="grid-2" style="gap:12px;margin-bottom:16px">
      <div class="form-group"><label>الفريق الأول</label><select id="cmpA" style="width:100%"><option value="">اختر</option>${tOpts}</select></div>
      <div class="form-group"><label>الفريق الثاني</label><select id="cmpB" style="width:100%"><option value="">اختر</option>${tOpts}</select></div>
    </div>
    <button class="btn btn-primary" onclick="runCompare()"><i class="fas fa-search"></i> قارن الآن</button>
  </div>
  <div id="cmpResult" style="margin-top:20px"></div>`;
  window._cmpData = { teams, matches, goals };
}

function runCompare() {
  const idA = document.getElementById('cmpA').value;
  const idB = document.getElementById('cmpB').value;
  if (!idA || !idB || idA === idB) { showToast('اختر فريقين مختلفين'); return; }
  const { teams, matches, goals } = window._cmpData || {};
  const tA = teams.find(t => t.id === idA), tB = teams.find(t => t.id === idB);
  const h2h = matches.filter(m => (m.teamAId === idA && m.teamBId === idB) || (m.teamAId === idB && m.teamBId === idA)).filter(m => m.status === 'finished');
  let wA = 0, wB = 0, draws = 0, gfA = 0, gfB = 0;
  h2h.forEach(m => {
    const sA = m.teamAId === idA ? (m.scoreA || 0) : (m.scoreB || 0);
    const sB = m.teamAId === idA ? (m.scoreB || 0) : (m.scoreA || 0);
    gfA += sA; gfB += sB;
    if (sA > sB) wA++; else if (sB > sA) wB++; else draws++;
  });
  const goalsA = goals.filter(g => g.teamId === idA).length;
  const goalsB = goals.filter(g => g.teamId === idB).length;
  const stat = (lbl, vA, vB) => { const maxV = Math.max(vA, vB, 1); return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="color:${tA?.color || 'var(--gold)'}">${vA}</strong><span style="font-size:.82rem;color:var(--text-muted)">${lbl}</span><strong style="color:${tB?.color || 'var(--blue)'}">${vB}</strong></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);position:relative"><div style="position:absolute;right:0;height:100%;border-radius:4px;background:${tA?.color || 'var(--gold)'};width:${Math.round(vA / maxV * 100)}%"></div></div><div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);position:relative"><div style="position:absolute;left:0;height:100%;border-radius:4px;background:${tB?.color || 'var(--blue)'};width:${Math.round(vB / maxV * 100)}%"></div></div></div></div>`; };
  document.getElementById('cmpResult').innerHTML = `
  <div class="card">
    <div style="display:flex;justify-content:space-around;align-items:center;margin-bottom:24px">
      <div style="text-align:center">${teamLogo(tA, '70px', false)}<h3 style="margin-top:10px;color:${tA?.color || 'var(--gold)'}">${tA?.name || '؟'}</h3></div>
      <div style="text-align:center;font-size:2rem;font-weight:900;color:var(--text-muted)">VS</div>
      <div style="text-align:center">${teamLogo(tB, '70px', false)}<h3 style="margin-top:10px;color:${tB?.color || 'var(--blue)'}">${tB?.name || '؟'}</h3></div>
    </div>
    <h4 style="color:var(--gold);margin-bottom:18px;text-align:center">المواجهات المباشرة (${h2h.length} مباراة)</h4>
    <div class="grid-3" style="text-align:center;margin-bottom:24px">
      <div class="card"><div style="font-size:2rem;font-weight:900;color:${tA?.color || 'var(--gold)'}">${wA}</div><div class="text-muted">فوز ${tA?.name || ''}</div></div>
      <div class="card"><div style="font-size:2rem;font-weight:900;color:var(--text-muted)">${draws}</div><div class="text-muted">تعادل</div></div>
      <div class="card"><div style="font-size:2rem;font-weight:900;color:${tB?.color || 'var(--blue)'}">${wB}</div><div class="text-muted">فوز ${tB?.name || ''}</div></div>
    </div>
    ${stat('الأهداف في المواجهات', gfA, gfB)}
    ${stat('إجمالي الأهداف في البطولة', goalsA, goalsB)}
    ${h2h.length > 0 ? h2h.slice(0, 5).map(m => { const sA = m.teamAId === idA ? (m.scoreA || 0) : (m.scoreB || 0); const sB = m.teamAId === idA ? (m.scoreB || 0) : (m.scoreA || 0); return `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:6px;font-size:.85rem"><span style="color:${tA?.color || 'var(--gold)'}">${sA}</span><span class="text-muted">${m.date ? new Date(m.date).toLocaleDateString('ar-EG') : ''}</span><span style="color:${tB?.color || 'var(--blue)'}">${sB}</span></div>` }).join('') : '<p class="text-muted" style="text-align:center">لا توجد مواجهات مباشرة</p>'}
  </div>`;
}

// ========== ADVANCED STATS ==========
async function adminAdvStats() {
  const c = document.getElementById('adminInner'); c.innerHTML = '<div class="admin-loading"><i class="fas fa-futbol fa-spin-roll"></i></div>';
  let teams = [], players = [], matches = [], goals = [], cards = [];
  try { const [ts, ps, ms, gs, cs] = await Promise.all([db.collection('teams').get(), db.collection('players').get(), db.collection('matches').get(), db.collection('goals').get(), db.collection('cards').get()]); teams = ts.docs.map(d => ({ id: d.id, ...d.data() })); players = ps.docs.map(d => ({ id: d.id, ...d.data() })); matches = ms.docs.map(d => ({ id: d.id, ...d.data() })); goals = gs.docs.map(d => ({ id: d.id, ...d.data() })); cards = cs.docs.map(d => ({ id: d.id, ...d.data() })) } catch (e) { }
  const finished = matches.filter(m => m.status === 'finished');
  const totalGoals = goals.length;
  const avgGoals = finished.length > 0 ? (totalGoals / finished.length).toFixed(2) : 0;
  const yellowCards = cards.filter(c => c.type === 'yellow').length;
  const redCards = cards.filter(c => c.type === 'red').length;
  // top scorer
  const topP = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 3);
  // highest scoring match
  const topMatch = [...finished].sort((a, b) => ((b.scoreA || 0) + (b.scoreB || 0)) - ((a.scoreA || 0) + (a.scoreB || 0)))[0];
  const topMatchStr = topMatch ? `${teams.find(t => t.id === topMatch.teamAId)?.name || '؟'} ${topMatch.scoreA || 0} - ${topMatch.scoreB || 0} ${teams.find(t => t.id === topMatch.teamBId)?.name || '؟'}` : '-';
  // wins by team
  const teamWins = teams.map(t => { const w = finished.filter(m => (m.teamAId === t.id && (m.scoreA || 0) > (m.scoreB || 0)) || (m.teamBId === t.id && (m.scoreB || 0) > (m.scoreA || 0))).length; return { ...t, wins: w }; }).sort((a, b) => b.wins - a.wins);
  c.innerHTML = `
  <div class="grid-4 mb-3">${[
      ['fa-futbol', 'إجمالي الأهداف', totalGoals, 'gold'],
      ['fa-calculator', 'معدل أهداف/مباراة', avgGoals, 'green'],
      ['fa-square text-yellow', 'البطاقات الصفراء', yellowCards, 'yellow'],
      ['fa-square text-red', 'البطاقات الحمراء', redCards, 'red'],
    ].map(([i, l, v, col]) => `<div class="stat-card"><div class="stat-icon" style="color:var(--${col})"><i class="fas ${i}"></i></div><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`).join('')}</div>
  <div class="grid-2">
  <div class="card"><h3 style="color:var(--gold);margin-bottom:16px"><i class="fas fa-medal"></i> أعلى الهدافين</h3>
    ${topP.map((p, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < 2 ? 'border-bottom:1px solid var(--border)' : ''}"><span class="rank rank-${i + 1}" style="width:28px;height:28px;${i > 2 ? 'background:var(--bg-secondary)' : ''};font-size:.8rem">${i + 1}</span>${playerPhoto(p, '36px')}<div style="flex:1"><div style="font-weight:700">${p.name}</div><div class="text-muted" style="font-size:.76rem">${teams.find(t => t.id === p.teamId)?.name || ''}</div></div><strong style="color:var(--gold)">${p.goals || 0} ⚽</strong></div>`).join('')}
  </div>
  <div class="card"><h3 style="color:var(--gold);margin-bottom:16px"><i class="fas fa-trophy"></i> الفرق حسب الفوز</h3>
    ${teamWins.slice(0, 5).map((t, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < 4 ? 'border-bottom:1px solid var(--border)' : ''}">${teamLogo(t, '32px', false)}<div style="flex:1;font-weight:700">${t.name}</div><strong style="color:var(--green)">${t.wins} فوز</strong></div>`).join('')}
  </div></div>
  <div class="card mt-3"><h3 style="color:var(--gold);margin-bottom:12px"><i class="fas fa-star"></i> أعلى مباراة تسجيلاً</h3><p style="font-size:1.1rem;font-weight:700">${topMatchStr}</p></div>`;
}

// ========== MODAL SYSTEM ==========
function showModal(title, content, onLoaded) {
  let overlay = document.getElementById('modalOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id = 'modalOverlay'; overlay.className = 'modal-overlay'; document.body.appendChild(overlay) }
  overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button></div><div class="modal-body">${content}</div></div>`;
  overlay.classList.add('show'); overlay.onclick = e => { if (e.target === overlay) closeModal() };
  if (onLoaded) setTimeout(onLoaded, 50);
}
function closeModal() { const o = document.getElementById('modalOverlay'); if (o) { o.classList.remove('show'); setTimeout(() => o.remove(), 300) } }

// ========== DELETE HELPER ==========
async function delDoc(col, id, refreshFn) { if (!confirm('هل أنت متأكد من الحذف؟')) return; try { await db.collection(col).doc(id).delete(); showToast('تم الحذف ✅'); if (refreshFn) refreshFn() } catch (e) { showToast('خطأ: ' + e.message) } }

// ========== IMAGE UPLOAD - see firebase-config.js for uploadToImgBB ==========
