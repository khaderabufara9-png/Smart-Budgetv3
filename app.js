/* ==================== إعدادات Firebase والمزامنة السحابية ==================== */
const firebaseConfig = {
    apiKey: "AIzaSyAym2Ui4JxfvIH7Mh0kyoEJGOjN8OdRENk",
    authDomain: "smart-budget-83252.firebaseapp.com",
    projectId: "smart-budget-83252",
    storageBucket: "smart-budget-83252.firebasestorage.app",
    messagingSenderId: "71238238487",
    appId: "1:71238238487:web:a92d4d8cf28f3207df3752"
};

// تهيئة فايربيس
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* ==================== المتغيرات الأساسية ==================== */
let currentUserId = null;
let currentUserRole = null; // سيتم تحديثه لـ admin عند دخول المالك
let currentCurrency = localStorage.getItem('appCurrency') || "ج.م"; 
let currentLang = localStorage.getItem('appLang') || 'ar'; 
let personalName = localStorage.getItem('personalName') || ""; 
let isDarkMode = localStorage.getItem('isDarkMode') !== 'false'; 
let appPin = localStorage.getItem('appPin') || null; 
const APP_VERSION = "6.0"; // تحديث النسخة لحل المشاكل

let expenses = []; let savings = []; let budgetData = { amount: 0, startDate: '', endDate: '' }; let savedProducts = {}; let currencyWatchers = []; let coinSavings = 0;
let myChart; let catChart; let toastTimeout; let currentScannerTarget = 'expense'; let clockInterval; let exchangeRates = {};

const trans = {
    ar: { appLockTitle: "تطبيق مقفل", appLockSub: "أدخل رمز PIN", unlockBtn: "فتح", saveBtn: "حفظ", cancel: "إلغاء", expense: "مصروف", saving: "توفير", newProduct: "منتج", whatToAdd: "ماذا تريد أن تضيف؟", newExpTitle: "مصروف جديد", descLabel: "الوصف", amountLabel: "المبلغ", catLabel: "التصنيف", food: "طعام", transport: "مواصلات", bills: "فواتير", health: "صحة", ent: "ترفيه", other: "أخرى", addSavTitle: "رصيد حصالة", savTypeLabel: "النوع", savCurrent: "من الميزانية", savPrev: "إيداع خارجي", addSavBtn: "أضف", budgetSetupTitle: "إعداد الميزانية", budgetLabel: "الميزانية الكلية", fromDate: "من تاريخ", toDate: "إلى تاريخ", saveSettings: "حفظ بالسحابة", settingsTitle: "الإعدادات", nameSetting: "الاسم", langSettings: "اللغة والعملة", securitySettings: "الأمان", enablePin: "قفل التطبيق (PIN)", backupTitle: "النسخ الاحتياطي", exportData: "تصدير CSV", historyTitle: "السجل", filterAll: "الكل", savTitle: "الحصالة", totalSaved: "الإجمالي", depDetails: "سجل الإيداعات", analyticsTitle: "تحليل", topCat: "أعلى صرف", avgDaily: "متوسط يومي", catBreakdown: "تفصيل", navHome: "الرئيسية", converterNav: "محول", navHistory: "سجل", navSavings: "الحصالة", converterTitle: "محول العملات", fetchingRates: "جاري الجلب...", amountToConvert: "المبلغ", fromCurr: "من", toCurr: "إلى", convertResult: "النتيجة", watchListTitle: "مراقبة", addWatcherBtn: "إضافة", todayText: "اليوم", yesterdayText: "أمس", noDataFound: "لا توجد بيانات", goodMorning: "صباح الخير", goodEvening: "مساء الخير", myFriend: "يا صديقي", editExpTitle: "تعديل", saveEdit: "تحديث" }
};

/* ==================== نظام المصادقة والمزامنة (Authentication) ==================== */
auth.onAuthStateChanged((user) => {
    const splash = document.getElementById('splashScreen');
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const appLockScreen = document.getElementById('appLockScreen');
    
    if (user) {
        currentUserId = user.uid;
        currentUserRole = 'admin'; // منح صلاحيات الإدارة للوصول لكل الميزات
        
        document.getElementById('userEmailDisplay').innerText = user.email;
        if(user.photoURL) {
            const profImg = document.getElementById('userProfilePic');
            profImg.src = user.photoURL; profImg.classList.remove('hidden');
        }
        
        loadDataFromFirebase().then(() => {
            if (splash) splash.style.display = 'none';
            loginScreen.classList.add('hidden');
            
            if (appPin) { appLockScreen.classList.remove('hidden'); appContainer.classList.add('hidden'); } 
            else { appContainer.classList.remove('hidden'); bootApp(); }
        });
    } else {
        currentUserId = null;
        currentUserRole = null;
        if (splash) splash.style.display = 'none';
        loginScreen.classList.remove('hidden');
        appContainer.classList.add('hidden');
        appLockScreen.classList.add('hidden');
    }
});

window.loginWithGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => showToast("فشل الدخول: " + error.message, "error"));
}

window.logout = function() { auth.signOut().then(() => location.reload()); }

/* ==================== السحابة (Firestore) ==================== */
async function loadDataFromFirebase() {
    const syncStatus = document.getElementById('syncStatusSplash');
    if(syncStatus) syncStatus.innerText = "جاري تحميل بياناتك من السحابة...";
    
    try {
        const doc = await db.collection("users").doc(currentUserId).get();
        if (doc.exists) {
            const data = doc.data();
            expenses = data.expenses || [];
            savings = data.savings || [];
            budgetData = data.budgetData || { amount: 0, startDate: '', endDate: '' };
            currencyWatchers = data.watchers || [];
            coinSavings = data.coinSavings || 0;
            savedProducts = data.savedProducts || {};
        }
    } catch(e) { showToast("فشل الاتصال بالسحابة", "error"); }
}

function saveDataToFirebase() {
    if(!currentUserId) return;
    db.collection("users").doc(currentUserId).set({
        expenses: expenses, savings: savings, budgetData: budgetData,
        watchers: currencyWatchers, coinSavings: coinSavings, savedProducts: savedProducts,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(() => { console.log("تمت المزامنة!"); });
}

/* ==================== دوال التطبيق الأساسية ==================== */
function bootApp() {
    applyTheme(); setLanguage(currentLang); applyRoleRestrictions();
    const pInput = document.getElementById('personalNameInput'); if(pInput) pInput.value = personalName;
    const pToggle = document.getElementById('pinToggle'); if(pToggle) pToggle.checked = appPin !== null;
    const currSelect = document.getElementById('currencySelect'); if(currSelect) currSelect.value = currentCurrency; 
    
    try { initChart(); } catch(e){}
    updateGreeting(); startRealTimeClock(); renderExpenses(); renderSavingsList(); updateStats(); fetchExchangeRates(); updateCoinDisplay();
}

window.unlockApp = function() {
    const inputEl = document.getElementById('pinInput');
    if (inputEl && inputEl.value === appPin) { document.getElementById('appLockScreen').classList.add('hidden'); document.getElementById('appContainer').classList.remove('hidden'); inputEl.value = ''; bootApp(); } 
    else { showToast("الرمز غير صحيح", "error"); }
}

// حل مشكلة الدخول إلى إعدادات الميزانية
window.openBudgetModalSafe = function() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'user') return;
    
    // تعبئة البيانات القديمة في النافذة إذا كانت موجودة (حل مشكلة المسح كل مرة)
    if (budgetData) {
        document.getElementById('modalBudgetAmount').value = budgetData.amount || '';
        document.getElementById('modalStartDate').value = budgetData.startDate || '';
        document.getElementById('modalEndDate').value = budgetData.endDate || '';
    }
    
    openModal('budgetModal');
}

window.toggleAppPin = function() { const toggle = document.getElementById('pinToggle'); const isChecked = toggle ? toggle.checked : false; if (isChecked) { const newPin = prompt("أدخل رمز PIN من 4 أرقام:"); if (newPin && newPin.length >= 4) { appPin = newPin; localStorage.setItem('appPin', appPin); showToast("تم تفعيل القفل", "success"); } else { if(toggle) toggle.checked = false; } } else { appPin = null; localStorage.removeItem('appPin'); showToast("تم إلغاء القفل", "warning"); } }
function applyTheme() { const toggleBtn = document.getElementById('themeToggle'); if (toggleBtn) toggleBtn.checked = isDarkMode; if (isDarkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }
window.toggleTheme = function() { const toggleBtn = document.getElementById('themeToggle'); isDarkMode = toggleBtn ? toggleBtn.checked : true; localStorage.setItem('isDarkMode', isDarkMode); applyTheme(); }

window.changeCurrency = function(newSymbol) { currentCurrency = newSymbol; localStorage.setItem('appCurrency', currentCurrency); document.querySelectorAll('.currency-symbol').forEach(el => el.innerText = currentCurrency); updateStats(); renderExpenses(); renderSavingsList(); }
window.savePersonalName = function() { const pInput = document.getElementById('personalNameInput'); if(pInput) personalName = pInput.value.trim(); localStorage.setItem('personalName', personalName); updateGreeting(); showToast("تم الحفظ", "success"); }

function updateGreeting() { const hour = new Date().getHours(); const isMorning = hour >= 5 && hour < 17; let greetingText = isMorning ? trans[currentLang]['goodMorning'] : trans[currentLang]['goodEvening']; let nameText = personalName.trim() !== "" ? personalName : trans[currentLang]['myFriend']; const titleEl = document.getElementById('greetingTitle'); if(titleEl) titleEl.innerText = `${greetingText}، ${nameText} ✨`; }
function startRealTimeClock() { if(clockInterval) clearInterval(clockInterval); const clockEl = document.getElementById('realTimeClock'); const updateTime = () => { if(clockEl) clockEl.innerText = new Date().toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }; updateTime(); clockInterval = setInterval(updateTime, 1000); }

window.setLanguage = function(lang) {
    currentLang = lang; localStorage.setItem('appLang', lang); const htmlDoc = document.getElementById('htmlDoc'); if(htmlDoc) { htmlDoc.dir = lang === 'ar' ? 'rtl' : 'ltr'; htmlDoc.lang = lang; }
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (trans[lang] && trans[lang][key]) { if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = trans[lang][key]; else el.innerText = trans[lang][key]; } });
    updateGreeting(); if(currentUserId) { updateStats(); renderExpenses(); renderSavingsList(); updateAnalytics(); updateCoinDisplay(); }
}

function applyRoleRestrictions() { 
    const dangerZone = document.getElementById('dangerZone'); 
    if (currentUserRole === 'admin') { if(dangerZone) dangerZone.classList.remove('hidden'); } 
    else { if(dangerZone) dangerZone.classList.add('hidden'); } 
}

/* ==================== العمليات وحفظ البيانات في السحابة ==================== */
const bForm = document.getElementById('budgetSettingsForm'); if(bForm) { bForm.addEventListener('submit', (e) => { e.preventDefault(); budgetData = { amount: parseFloat(document.getElementById('modalBudgetAmount').value), startDate: document.getElementById('modalStartDate').value, endDate: document.getElementById('modalEndDate').value }; saveDataToFirebase(); updateStats(); closeModal('budgetModal'); showToast("تم مزامنة الميزانية", "success"); }); }

const eForm = document.getElementById('expenseForm'); if(eForm) { eForm.addEventListener('submit', (e) => { e.preventDefault(); const desc = document.getElementById('descInput').value.trim(); const amt = parseFloat(document.getElementById('amountInput').value); const cat = document.getElementById('categoryInput').value; expenses.push({ id: Date.now().toString(), amount: amt, category: cat, description: desc, date: new Date().toISOString() }); saveDataToFirebase(); updateStats(); renderExpenses(); document.getElementById('amountInput').value = ''; document.getElementById('descInput').value = ''; closeModal('expenseFormModal'); }); }

window.deleteExpense = function(id) { if(confirm('هل أنت متأكد من الحذف؟')) { expenses = expenses.filter(e => e.id !== id); saveDataToFirebase(); renderExpenses(); updateStats(); showToast("تم الحذف من السحابة", "success"); } }
window.openEditExpense = function(id) { const exp = expenses.find(e => e.id === id); if(!exp) return; document.getElementById('editExpId').value = exp.id; document.getElementById('editDescInput').value = exp.description; document.getElementById('editAmountInput').value = exp.amount; document.getElementById('editCategoryInput').value = exp.category; openModal('editExpenseModal'); };
const editEForm = document.getElementById('editExpenseForm'); if(editEForm) { editEForm.addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('editExpId').value; const index = expenses.findIndex(ex => ex.id === id); if(index !== -1) { expenses[index].description = document.getElementById('editDescInput').value.trim(); expenses[index].amount = parseFloat(document.getElementById('editAmountInput').value); expenses[index].category = document.getElementById('editCategoryInput').value; saveDataToFirebase(); updateStats(); renderExpenses(); closeModal('editExpenseModal'); showToast("تم تحديث السحابة", "success"); } }); }

const sForm = document.getElementById('savingsForm'); if(sForm) { sForm.addEventListener('submit', (e) => { e.preventDefault(); savings.push({ id: Date.now().toString(), amount: parseFloat(document.getElementById('savingsAmountInput').value), type: document.getElementById('savingsTypeInput').value, date: new Date().toISOString() }); saveDataToFirebase(); updateStats(); renderSavingsList(); document.getElementById('savingsAmountInput').value = ''; closeModal('savingsFormModal'); showToast("تم الإيداع", "success"); }); }
window.deleteSaving = function(id) { if(confirm('حذف الإيداع؟')) { savings = savings.filter(s => s.id !== id); saveDataToFirebase(); updateStats(); renderSavingsList(); showToast("تم الحذف", "success"); } }

/* ==================== حصالة الفضة (بالسحابة) ==================== */
window.addOneCoin = function(e) {
    coinSavings += 1; saveDataToFirebase(); updateCoinDisplay();
    if(navigator.vibrate) navigator.vibrate(30);
    const btn = document.getElementById('silverCoinBtn'); if(!btn) return;
    const rect = btn.getBoundingClientRect(); const floater = document.createElement('div'); floater.className = 'floating-plus'; floater.innerText = '+1';
    let clickX = rect.width / 2; let clickY = rect.height / 2;
    if(e.clientX) { clickX = e.clientX - rect.left; clickY = e.clientY - rect.top; } else if(e.touches && e.touches[0]) { clickX = e.touches[0].clientX - rect.left; clickY = e.touches[0].clientY - rect.top; }
    floater.style.left = `${clickX}px`; floater.style.top = `${clickY}px`; btn.appendChild(floater); setTimeout(() => { floater.remove(); }, 800);
}
window.setCoinsManual = function(val) { let parsed = parseInt(val); if(isNaN(parsed) || parsed < 0) parsed = 0; coinSavings = parsed; saveDataToFirebase(); updateCoinDisplay(); }
function updateCoinDisplay() { const el = document.getElementById('coinCounterInput'); if(el) el.value = coinSavings; }

/* ==================== المحول وقائمة المراقبة (بالسحابة) ==================== */
window.fetchExchangeRates = async function(manual) {
    try { const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD'); const data = await response.json(); if(data && data.rates) { const ratesLower = {}; for (let key in data.rates) { ratesLower[key.toLowerCase()] = data.rates[key]; } exchangeRates = ratesLower; localStorage.setItem('cachedRates', JSON.stringify(exchangeRates)); if(manual) showToast('تم التحديث بدقة', 'success'); convertCurrency(); renderWatchers(); } } 
    catch (e) { const c = localStorage.getItem('cachedRates'); if(c){ exchangeRates = JSON.parse(c); convertCurrency(); renderWatchers(); } }
}
window.convertCurrency = function() { const amount = parseFloat(document.getElementById('convertAmount').value) || 0; const fromCurr = document.getElementById('fromCurrency').value.toLowerCase(); const toCurr = document.getElementById('toCurrency').value.toLowerCase(); const resultEl = document.getElementById('convertedResultText'); if (Object.keys(exchangeRates).length === 0) return; const convertedAmount = (amount / exchangeRates[fromCurr]) * exchangeRates[toCurr]; if(resultEl) resultEl.innerText = convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + toCurr.toUpperCase(); }
window.addWatcher = function() { const from = document.getElementById('watchFrom').value; const to = document.getElementById('watchTo').value; if(from===to)return; currencyWatchers.push({ id: Date.now().toString(), from: from, to: to }); saveDataToFirebase(); renderWatchers(); }
window.deleteWatcher = function(id) { currencyWatchers = currencyWatchers.filter(w => w.id !== id); saveDataToFirebase(); renderWatchers(); }

/* ==================== واجهة العرض والسحب (UI & Swipe) ==================== */
function isSameDay(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }

window.renderExpenses = function() {
    const listContainer = document.getElementById('expensesList'); const filterVal = document.getElementById('filterInput') ? document.getElementById('filterInput').value : "الكل"; const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : ""; const totalDisplay = document.getElementById('filteredTotalDisplay');
    if(!listContainer) return; listContainer.innerHTML = '';
    let filtered = expenses.filter(e => { const matchFilter = (filterVal === "الكل") || (e.category === filterVal); const matchSearch = e.description.toLowerCase().includes(searchVal) || e.amount.toString().includes(searchVal); return matchFilter && matchSearch; });
    if (filtered.length === 0) { if(totalDisplay) totalDisplay.innerHTML = `0 <span class="currency-symbol">${currentCurrency}</span>`; listContainer.innerHTML = `<p class="text-sm text-gray-500 text-center mt-10">لا توجد بيانات</p>`; return; }
    
    const currentTotal = filtered.reduce((sum, e) => sum + e.amount, 0); if(totalDisplay) totalDisplay.innerHTML = `${currentTotal.toLocaleString()} <span class="currency-symbol">${currentCurrency}</span>`;
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const grouped = {}; const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    filtered.forEach(exp => { const expDate = new Date(exp.date); let dateKey = ""; if (isSameDay(expDate, today)) { dateKey = "اليوم"; } else if (isSameDay(expDate, yesterday)) { dateKey = "أمس"; } else { dateKey = expDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }); } if (!grouped[dateKey]) grouped[dateKey] = []; grouped[dateKey].push(exp); });

    for (const [dateGroup, expsArray] of Object.entries(grouped)) {
        const groupTotal = expsArray.reduce((s, e) => s + e.amount, 0);
        listContainer.innerHTML += `<div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-1 mt-4 mb-3"><span class="text-sm font-bold text-blue-600 dark:text-blue-400">${dateGroup}</span><span class="text-xs text-gray-500">${groupTotal} ${currentCurrency}</span></div>`;
        expsArray.forEach(exp => {
            const catTranslated = trans[currentLang][exp.category] || exp.category; const timeStr = new Date(exp.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
            listContainer.innerHTML += `<div class="swipe-container mb-3 rounded-xl border-s-4 border-s-blue-500 border border-gray-200 dark:border-gray-700 shadow-sm"><div class="swipe-actions rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"><button onclick="openEditExpense('${exp.id}')" class="swipe-action-btn bg-blue-600">✏️</button><button onclick="deleteExpense('${exp.id}')" class="swipe-action-btn bg-red-600">🗑️</button></div><div class="swipe-card bg-gray-50 dark:bg-gray-800 p-4 rounded-xl flex justify-between items-start" data-id="${exp.id}"><div class="flex flex-col"><span class="font-semibold text-gray-800 dark:text-gray-100 pointer-events-none">${exp.description}</span><div class="flex items-center gap-2 mt-1 pointer-events-none"><span class="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">${catTranslated}</span><span class="text-[10px] text-gray-500">${timeStr}</span></div></div><span class="font-bold text-red-500 dark:text-red-400 pointer-events-none">${exp.amount} ${currentCurrency}</span></div></div>`;
        });
    }
    initSwipe();
}

function renderSavingsList() {
    const list = document.getElementById('savingsList'); if(!list) return; list.innerHTML = '';
    if (savings.length === 0) { list.innerHTML = `<p class="text-sm text-gray-500 text-center mt-5 py-5">لا توجد بيانات</p>`; return; }
    savings.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => {
        const typeText = s.type === 'current' ? 'من الميزانية' : 'إيداع خارجي'; const typeColor = s.type === 'current' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'; const timeStr = new Date(s.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        list.innerHTML += `<div class="swipe-container mb-3 rounded-xl border-s-4 ${s.type === 'current' ? 'border-s-blue-500' : 'border-s-green-500'} border border-gray-200 dark:border-gray-700 shadow-sm"><div class="swipe-actions rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"><button onclick="deleteSaving('${s.id}')" class="swipe-action-btn bg-red-600 w-full px-6 flex justify-end">🗑️</button></div><div class="swipe-card bg-gray-50 dark:bg-gray-800 p-4 rounded-xl flex justify-between items-center" data-id="${s.id}"><div class="flex flex-col"><span class="font-bold text-gray-800 dark:text-gray-100 pointer-events-none">${typeText}</span><span class="text-[10px] text-gray-500 mt-1 pointer-events-none">${timeStr}</span></div><span class="font-bold ${s.type === 'current' ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400'} pointer-events-none">+ ${s.amount} ${currentCurrency}</span></div></div>`;
    });
    initSwipe(); 
}

function renderWatchers() {
    const list = document.getElementById('watchersList'); if(!list) return; list.innerHTML = '';
    if(currencyWatchers.length === 0) { list.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">لا توجد قائمة مراقبة</p>`; return; }
    currencyWatchers.forEach(w => {
        let rateDisplay = "---"; if (Object.keys(exchangeRates).length > 0) { const finalRate = (1 / exchangeRates[w.from]) * exchangeRates[w.to]; rateDisplay = finalRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " " + w.to.toUpperCase(); }
        list.innerHTML += `<li class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl flex justify-between items-center border border-gray-200 dark:border-gray-700 shadow-sm"><div class="flex items-center gap-3"><div class="flex flex-col text-center bg-gray-200 dark:bg-gray-800 rounded-lg p-2 min-w-[50px]"><span class="text-xs font-bold text-gray-800 dark:text-gray-200">1</span><span class="text-[10px] text-gray-500">${w.from.toUpperCase()}</span></div><svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg><div class="flex flex-col"><span class="font-bold text-blue-600 dark:text-blue-400">${rateDisplay}</span></div></div><button onclick="deleteWatcher('${w.id}')" class="text-gray-400 hover:text-red-500 p-2"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></li>`;
    });
}

function initSwipe() {
    const cards = document.querySelectorAll('.swipe-card:not(.swipe-initialized)');
    cards.forEach(card => {
        card.classList.add('swipe-initialized'); let startX = 0; let currentX = 0; let isDragging = false; const limit = 80;
        card.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isDragging = true; card.classList.add('dragging'); document.querySelectorAll('.swipe-card').forEach(c => { if (c !== card) c.style.transform = `translateX(0px)`; }); }, {passive: true});
        card.addEventListener('touchmove', (e) => { if (!isDragging) return; currentX = e.touches[0].clientX - startX; if (currentX > limit + 20) currentX = limit + 20; if (currentX < -limit - 20) currentX = -limit - 20; card.style.transform = `translateX(${currentX}px)`; }, {passive: true});
        card.addEventListener('touchend', () => { isDragging = false; card.classList.remove('dragging'); if (currentX > 40) { card.style.transform = `translateX(${limit}px)`; } else if (currentX < -40) { card.style.transform = `translateX(${-limit}px)`; } else { card.style.transform = `translateX(0px)`; } });
    });
}

/* ==================== نظام الإحصائيات والتنبيهات المزدوج (تمت الإضافة) ==================== */
function updateStats() {
    const exp = expenses.reduce((s, e) => s + e.amount, 0); 
    const curSav = savings.filter(s => s.type === 'current').reduce((s, a) => s + a.amount, 0); 
    const preSav = savings.filter(s => s.type === 'previous').reduce((s, a) => s + a.amount, 0);
    const totSav = curSav + preSav; 
    const rem = budgetData.amount - exp - curSav;
    
    // نظام التحذير اليومي المزدوج
    const warningEl = document.getElementById('budgetWarningAlert'); 
    const warningText = document.getElementById('warningMessageText');
    
    if (warningEl && warningText) { 
        let isWarning = false;
        let warningMessage = "";
        
        // 1. فحص تجاوز 80% من الميزانية الكلية
        if (budgetData.amount > 0 && (exp / budgetData.amount) >= 0.8) {
            isWarning = true;
            warningMessage = "⚠️ لقد استهلكت أكثر من 80% من ميزانيتك الكلية!";
        } 
        
        // 2. فحص الحد اليومي (إذا لم يكن هناك تحذير كلي)
        if (!isWarning && budgetData.amount > 0 && budgetData.startDate && budgetData.endDate) {
            const start = new Date(budgetData.startDate).setHours(0,0,0,0);
            const end = new Date(budgetData.endDate).setHours(0,0,0,0);
            const today = new Date().setHours(0,0,0,0);
            
            // تأكد أننا داخل فترة الميزانية
            if (today >= start && today <= end) {
                const totalDays = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
                const dailyLimit = budgetData.amount / totalDays;
                
                // حساب مصاريف اليوم فقط
                const todayExp = expenses.filter(e => isSameDay(new Date(e.date), new Date())).reduce((s, e) => s + e.amount, 0);
                
                if (todayExp > dailyLimit) {
                    isWarning = true;
                    warningMessage = `⚠️ تجاوزت الحد اليومي! صرفت اليوم ${todayExp} والحد المسموح ${Math.floor(dailyLimit)} ${currentCurrency}`;
                }
            }
        }
        
        if (isWarning) {
            warningText.innerText = warningMessage;
            warningEl.classList.remove('hidden');
            warningEl.classList.add('flex');
        } else {
            warningEl.classList.add('hidden');
            warningEl.classList.remove('flex');
        }
    }
    
    const totSavDisplay = document.getElementById('totalSavingsAmountDisplay'); if (totSavDisplay) { totSavDisplay.innerHTML = `${totSav.toLocaleString()} <span class="text-lg text-gray-500 currency-symbol">${currentCurrency}</span>`; }
    const curSavDisplay = document.getElementById('currentSavingsDisplay'); if(curSavDisplay) curSavDisplay.innerText = curSav.toLocaleString();
    const preSavDisplay = document.getElementById('previousSavingsDisplay'); if(preSavDisplay) preSavDisplay.innerText = preSav.toLocaleString();
    
    const chartCT = document.getElementById('chartCenterText'); if(chartCT) chartCT.innerText = budgetData.amount; 
    const lExp = document.getElementById('legendExp'); if(lExp) lExp.innerText = exp; 
    const lSav = document.getElementById('legendSav'); if(lSav) lSav.innerText = curSav; 
    const lRem = document.getElementById('legendRem'); if(lRem) { lRem.innerText = rem; lRem.className = rem < 0 ? "text-sm font-bold text-red-500" : "text-sm font-bold text-green-500"; }
    updateChartData(exp, curSav, rem);
}

function initChart() { const ctx = document.getElementById('budgetChart'); if(!ctx || typeof Chart === 'undefined') return; try { Chart.defaults.font.family = "'Cairo', sans-serif"; if(myChart) myChart.destroy(); myChart = new Chart(ctx.getContext('2d'), { type: 'doughnut', data: { labels: ['E', 'S', 'R'], datasets: [{ data: [0, 0, 1], backgroundColor: ['#ef4444', '#eab308', '#3b82f6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } }); } catch(err) {} }
function updateChartData(exp, sav, rem) { if (!myChart) return; if (budgetData.amount === 0) { myChart.data.datasets[0].data = [1]; myChart.data.datasets[0].backgroundColor = [isDarkMode?'#374151':'#e5e7eb']; } else { myChart.data.datasets[0].data = [exp, sav, rem < 0 ? 0 : rem]; myChart.data.datasets[0].backgroundColor = ['#ef4444', '#eab308', '#3b82f6']; } myChart.update(); }

function updateAnalytics() {
    if (expenses.length === 0) return;
    const catTotals = {}; let gTotal = 0; expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; gTotal += e.amount; });
    let tCat = ''; let tAmt = 0; for (const [c, a] of Object.entries(catTotals)) { if (a > tAmt) { tAmt = a; tCat = c; } }
    const topCatEl = document.getElementById('topCategoryText'); if(topCatEl) topCatEl.innerText = `${trans[currentLang][tCat] || tCat} (${tAmt})`;
    let days = 1; if(budgetData.startDate) days = Math.max(1, Math.ceil((new Date().setHours(0,0,0,0) - new Date(budgetData.startDate).setHours(0,0,0,0)) / 86400000) + 1);
    const avgEl = document.getElementById('avgDailySpendText'); if(avgEl) avgEl.innerHTML = `${Math.floor(gTotal / days)} <span class="text-xs text-gray-500">${currentCurrency}</span>`;
    
    const labels = Object.keys(catTotals).map(c => trans[currentLang][c] || c); const ctx = document.getElementById('categoryChart');
    if(ctx && typeof Chart !== 'undefined') { if(catChart) catChart.destroy(); catChart = new Chart(ctx.getContext('2d'), { type: 'bar', data: { labels: labels, datasets: [{ data: Object.values(catTotals), backgroundColor: '#3b82f6', borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
}

function showToast(message, type) {
    if(toastTimeout) clearTimeout(toastTimeout); const toast = document.getElementById('toastNotification'); const content = document.getElementById('toastContent'); if(!toast || !content) return;
    content.className = `p-4 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md w-full ${type==='success'?'bg-green-100 dark:bg-green-900/90 text-green-800 dark:text-green-100 border border-green-500':(type==='warning'?'bg-yellow-100 dark:bg-yellow-900/90 text-yellow-800 dark:text-yellow-100 border border-yellow-500':'bg-red-100 dark:bg-red-900/90 text-red-800 dark:text-red-100 border border-red-500')}`;
    content.innerHTML = `<span class="font-bold text-sm">${message}</span>`; toast.classList.add('toast-visible'); toastTimeout = setTimeout(() => toast.classList.remove('toast-visible'), 4000);
}

window.exportData = function() { if(expenses.length === 0 && savings.length === 0) return; let csv = "data:text/csv;charset=utf-8,%EF%BB%BFType,Date,Category,Description,Amount\n"; expenses.forEach(e => csv += `"Expense","${new Date(e.date).toLocaleDateString()}","${trans[currentLang][e.category]||e.category}","${e.description}","${e.amount}"\n`); savings.forEach(s => csv += `"Savings","${new Date(s.date).toLocaleDateString()}","${s.type}","Deposit","${s.amount}"\n`); const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "data.csv"; document.body.appendChild(link); link.click(); link.remove(); }
window.clearAllData = function() { if (currentUserRole !== 'admin') return; if(confirm("حذف كل البيانات من السحابة؟ (لا يمكن التراجع)")) { expenses = []; savings = []; budgetData = {amount:0,startDate:'',endDate:''}; savedProducts = {}; currencyWatchers = []; coinSavings = 0; saveDataToFirebase(); updateStats(); const f = document.getElementById('filterInput'); renderExpenses(f?f.value:"الكل"); renderSavingsList(); renderWatchers(); closeModal('settingsModal'); updateCoinDisplay(); showToast("تم مسح البيانات", "success"); } }
window.switchView = function(viewName) { document.querySelectorAll('.view-section').forEach(el => { el.classList.remove('block'); el.classList.add('hidden'); }); const view = document.getElementById(`view-${viewName}`); if(view) { view.classList.remove('hidden'); view.classList.add('block'); } document.querySelectorAll('.nav-btn').forEach(btn => { btn.classList.remove('text-blue-600'); btn.classList.add('text-gray-400'); }); if(viewName !== 'add') { const nav = document.getElementById(`nav-${viewName}`); if(nav) { nav.classList.remove('text-gray-400'); nav.classList.add('text-blue-600'); } } closeActionSheet(); if(viewName === 'analytics') updateAnalytics(); }
window.openActionSheet = function() { const s = document.getElementById('actionSheet'); if(s) { s.classList.remove('hidden'); setTimeout(() => { const c = document.getElementById('actionSheetContent'); if(c) c.classList.remove('translate-y-full'); }, 10); } }
window.closeActionSheet = function() { const c = document.getElementById('actionSheetContent'); if(c) { c.classList.add('translate-y-full'); setTimeout(() => { const s = document.getElementById('actionSheet'); if(s) s.classList.add('hidden'); }, 300); } }
window.openModal = function(id) { closeActionSheet(); const m = document.getElementById(id); if(m) { m.classList.remove('hidden'); m.classList.add('flex'); } }
window.closeModal = function(id) { const m = document.getElementById(id); if(m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
