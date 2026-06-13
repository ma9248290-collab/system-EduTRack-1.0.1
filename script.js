// ==========================================
// 1. قواعد البيانات والتهيئة الأساسية
// ==========================================
const TEACHER_NAME = "شيفو"; 
let students = JSON.parse(localStorage.getItem("students")) || [];
let classSessions = JSON.parse(localStorage.getItem("classSessions")) || []; 
let exams = JSON.parse(localStorage.getItem("exams")) || []; 
let homeworks = JSON.parse(localStorage.getItem("homeworks")) || []; 
let financeRecords = JSON.parse(localStorage.getItem("financeRecords")) || {}; 
let expenses = JSON.parse(localStorage.getItem("expenses")) || []; 
let schedule = JSON.parse(localStorage.getItem("schedule")) || []; 
let isAssistantMode = localStorage.getItem("isAssistantMode") === "true";
let adminPin = localStorage.getItem("adminPin") || "1234";
let books = JSON.parse(localStorage.getItem("books")) || [];


// تحديث المجموعات
let groups = JSON.parse(localStorage.getItem("groups")) || [];
if (groups.length > 0 && typeof groups[0] === 'string') {
    groups = groups.map(g => ({ name: g, level: 'الثالث الثانوي' }));
    localStorage.setItem("groups", JSON.stringify(groups));
}

let currentActiveSessionId = null, currentActiveExamId = null, currentActiveHwId = null;
let currentActiveGroup = null, currentStudentProfileCode = null;
let attendanceChartInstance = null, groupsChartInstance = null, financeChartInstance = null;
let html5QrcodeScanner = null, currentScannerTarget = '';

// ==========================================
// 2. دوال المساعدة (Utils) والتنبيهات
// ==========================================
function formatTime12(timeStr) {
    if (!timeStr) return "";
    try {
        let [hours, minutes] = timeStr.split(':');
        hours = parseInt(hours);
        let period = hours >= 12 ? "مساءً" : "صباحاً";
        hours = hours % 12 || 12; 
        return `${hours}:${minutes} ${period}`;
    } catch (e) { return timeStr; }
}

function normalizeArabicName(text) {
    if (!text) return "";
    return text.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/[يى]/g, 'ي').replace(/\s+/g, ' ').trim();
}

function findStudentByCodeOrName(input) {
    const val = input.trim();
    const normalizedInput = normalizeArabicName(val);
    return students.find(s => s.code === val || normalizeArabicName(s.name) === normalizedInput);
}

// 🔊 تعريف ملفات الصوت (يجب وضع الملفين في فولدر المشروع)
const successSound = new Audio('success.mp3');
const errorSound = new Audio('error.mp3');
// تقليل مستوى الصوت شوية عشان ميكونش مزعج
successSound.volume = 0.7; 
errorSound.volume = 0.8;

function showToast(message, type = 'success') {
    // 🎵 تشغيل الصوت المناسب بناءً على نوع الإشعار
    try {
        if (type === 'success') {
            successSound.currentTime = 0; 
            successSound.play().catch(e => {}); 
        } else {
            errorSound.currentTime = 0;
            errorSound.play().catch(e => {});
        }
    } catch (e) {}

    // رسم الإشعار على الشاشة
    let container = document.getElementById('toast-container');
    if (!container) { 
        container = document.createElement('div'); 
        container.id = 'toast-container'; 
        document.body.appendChild(container); 
    }
    const toast = document.createElement('div'); 
    toast.className = `toast ${type}`;
    
    // تظبيط العرض عشان الأخطبوط يبقى جنب الكلام مظبوط
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';

    // 🐙 تحديد شخصية الأخطبوط (نجاح أو خطأ)
    const mascotClass = type === 'success' ? 'octo-success' : 'octo-error';

    toast.innerHTML = `
        <div class="octo-mascot ${mascotClass}" style="width: 35px; height: 35px; min-width: 35px; margin-left: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></div>
        <span style="font-weight: bold; font-size: 14px; line-height: 1.5;">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // إخفاء الإشعار بعد 3 ثواني
    setTimeout(() => { 
        toast.style.animation = 'slideOut 0.3s ease-in forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

let confirmCallback = null;
function customConfirm(message, callback) {
    document.getElementById('confirmMessage').innerText = message; confirmCallback = callback;
    document.getElementById('customConfirmModal').style.display = 'block';
}
document.getElementById('confirmYesBtn')?.addEventListener('click', function() {
    if(confirmCallback) confirmCallback(); closeModal('customConfirmModal');
});

function openModal(modalId) { 
    document.getElementById(modalId).style.display = "block"; 
    if(modalId === 'addStudentModal') document.getElementById('studentCode').value = generateStudentCode(); 
    if(modalId === 'addSessionModal') { document.getElementById('sessionDate').valueAsDate = new Date(); toggleAutoInputs(); } 
    if(modalId === 'addExamModal') document.getElementById('examDate').valueAsDate = new Date(); 
    if(modalId === 'addHwModal') document.getElementById('hwDate').valueAsDate = new Date(); 
    if(modalId === 'settingsModal') {
        const tInput = document.getElementById('teacherNameInput');
        const cInput = document.getElementById('centerNameInput');
        if(tInput) tInput.value = localStorage.getItem('teacherName') || TEACHER_NAME;
        if(cInput) cInput.value = localStorage.getItem('centerName') || "الأوائل";
    }
}
function closeModal(modalId) { document.getElementById(modalId).style.display = "none"; if(modalId === 'scannerModal') stopCameraScanner(); }

function populateDropdowns() {
    const selects = ["studentLevel", "editStudentLevel", "sessionLevelSelect", "examLevelSelect", "hwLevelSelect", "financeLevelSelect", "leaderboardLevel", "schedLevel"];
    selects.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
}

function isValidEgyptianPhone(phone) {
    const regex = /^(010|011|012|015)\d{8}$/;
    return regex.test(phone);
}

// ==========================================
// 3. تسجيل الدخول والتنقل
// ==========================================
const ADMIN_USER = "shefo", ADMIN_PASS = "12345"; 

if(sessionStorage.getItem("isLoggedIn") === "true") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    if(isAssistantMode) enableAssistantMode();
}
// دالة تسجيل الدخول (مع خاصية تذكرني)
document.getElementById("loginForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    const user = document.getElementById("loginUsername").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    const remember = document.getElementById("rememberMeCheck")?.checked;
    
    const savedUser = localStorage.getItem("adminUser");
    const savedPass = localStorage.getItem("adminPass");
    const currentKey = localStorage.getItem("licenseKey");


    // 🌟 --- بداية كود الحساب التجريبي --- 🌟
    if (user === "demo" && pass === "demo123") {
        // فحص هل سجل بياناته ولا لأ
        if (!localStorage.getItem("demo_registered")) {
            // لو مسجلش، نظهرله نافذة طلب الاسم والرقم ونوقف الدخول
            document.getElementById('demoRegistrationModal').style.display = 'flex';
            return; 
        }

        // لو مسجل بياناته قبل كده، نكمل فحص الـ 7 أيام
        let demoStart = localStorage.getItem("demo_start_date");
        let now = new Date().getTime();
        let daysPassed = (now - parseInt(demoStart)) / (1000 * 60 * 60 * 24);

        if (daysPassed > 7) {
            document.getElementById('loginError').innerText = "انتهت فترة التجربة المجانية (7 أيام). يرجى شراء كود تفعيل!";
            document.getElementById('loginError').style.display = 'block';
            return; 
        }

        // لو لسه في فترة التجربة، نسمحله بالدخول
        localStorage.setItem("is_demo_mode", "true"); 
        
        let daysLeft = Math.ceil(7 - daysPassed);
        showToast(`أهلاً بك! متبقي لك ${daysLeft} أيام في النسخة التجريبية ⏳`);
        
        setTimeout(() => { location.reload(); }, 800);
        return; 
    }

    
    // فحص لو بيحاول يسجل ومفيش حساب متفعل أصلاً
    if (!savedUser || !currentKey) {
        document.getElementById("loginError").innerText = "لم يتم تفعيل حسابك! اضغط على 'تسجيل كمدرس جديد'.";
        document.getElementById("loginError").style.display = "block";
        return;
    }

    // التحقق من البيانات
    if(user === savedUser && pass === savedPass) {
        if(remember) {
            localStorage.setItem("keepLoggedIn", "true"); // تذكرني للابد
        } else {
            localStorage.setItem("keepLoggedIn", "false"); // الجلسة دي بس
            sessionStorage.setItem("isLoggedIn", "true");
        }
        
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        
        // 👇 والسطر ده كمان عشان لو سجل دخول يدوي 👇
        if(document.getElementById("shefo-assistant-btn")) document.getElementById("shefo-assistant-btn").style.display = "block";
        
        setTimeout(renderDashboardCharts, 100);
        loadDataFromFirebase();
    } else {
        document.getElementById("loginError").innerText = "البيانات غير صحيحة!";
        document.getElementById("loginError").style.display = "block";
    }
});
// دوال التنقل بين شاشة الدخول وشاشة التفعيل
function showActivationScreen() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("activation-screen").style.display = "flex";
}
function showLoginScreen() {
    document.getElementById("activation-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
}
// تحديث زرار تسجيل الخروج لمسح "تذكرني" وحالة الديمو
window.logout = function() { 
    sessionStorage.removeItem("isLoggedIn"); 
    localStorage.setItem("keepLoggedIn", "false");
    localStorage.removeItem("is_demo_mode"); // 🛑 مهم عشان لو اشترى كود حقيقي يعرف يسجل
    location.reload(); 
};

function switchPage(pageId) {
    document.querySelectorAll(".view-section").forEach(el => el.style.display = "none");
    document.querySelectorAll(".nav-links li").forEach(el => el.classList.remove("active"));
    document.getElementById(pageId + "-view").style.display = "block";
    document.getElementById("nav-" + pageId).classList.add("active");

    // تظبيط الترحيب عشان ميقولش "مستر يا مدير" 😂
    let tName = localStorage.getItem("teacherName");
    let greeting = (tName && tName !== "null" && tName.trim() !== "") ? `أهلاً بك مستر ${tName} 👋` : "أهلاً بك يا مدير 👋";

    const titles = {
        "dashboard": [greeting, "الرسوم البيانية ونظرة عامة"],
        "schedule": ["الجدول الأسبوعي 📅", "ترتيب مواعيد حصصك على مدار الأسبوع"],
        "groups": ["إدارة المجموعات 📚", "إضافة، تعديل، وإدارة المجموعات"],
        "students": ["إدارة الطلاب 🎓", "سجل الطلاب الشامل والملفات"],
        "attendance": ["سجل الحضور 📋", "تسجيل غياب الطلاب"],
        "exams": ["الامتحانات 📝", "رصد درجات الامتحانات"],
        "homework": ["الواجبات 📝", "تقييم الواجبات"],
        "finance": ["الماليات (حساب الحصة) 💰", "الإيرادات والمصروفات وصافي الربح لكل حصة"],
        "leaderboard": ["لوحة الشرف 🏆", "أفضل 5 طلاب في المجموعات"],
       "backup": ["لوحة التحكم والصيانة الشاملة ⚙️", "تنظيف وقفل البيانات، ضبط المصنع، وإدارة الملفات الاحتياطية"],
        "atrisk": ["تحت الملاحظة 🚨", "الطلاب المعرضين للخطر (تأخر دراسي)"],
        "books": ["إدارة الكتب 📘", "حسابات الكتب والسناتر ونسب المبيعات"],
        "broadcast": ["الإرسال الجماعي 📢", "إرسال تنبيهات لكل الطلاب بضغطة زر"]
    };
    
    if(titles[pageId]) { 
        document.getElementById("page-title").innerText = titles[pageId][0]; 
        document.getElementById("page-desc").innerText = titles[pageId][1]; 
    }

    if (pageId === "dashboard") { renderDashboardCharts(); }
    if (pageId === "schedule") { renderSchedule(); }
    if (pageId === "students") { document.getElementById("students-overview").style.display = "block"; document.getElementById("student-profile-view").style.display = "none"; renderTable(); }
    if (pageId === "groups") { document.getElementById("groups-overview").style.display = "block"; document.getElementById("group-details-view").style.display = "none"; renderGroupCards(); }
    if (pageId === "attendance") { document.getElementById("sessions-overview").style.display = "block"; document.getElementById("session-details-view").style.display = "none"; renderSessionCards(); populateDropdowns(); }
    if (pageId === "exams") { document.getElementById("exams-overview").style.display = "block"; document.getElementById("exam-details-view").style.display = "none"; renderExamCards(); populateDropdowns(); }
    if (pageId === "homework") { document.getElementById("hw-overview").style.display = "block"; document.getElementById("hw-details-view").style.display = "none"; renderHwCards(); populateDropdowns(); }
    if (pageId === "finance") { populateDropdowns(); renderFinanceTable(); }
    if (pageId === "leaderboard") { populateDropdowns(); }
    if (pageId === "atrisk") { renderAtRiskStudents(); }
    if (pageId === "books") { renderBooksTable(); }
    
    if (pageId === "broadcast") { 
        const select = document.getElementById('broadcastTarget');
        if(select) {
            select.innerHTML = "<option value='all'>كل الطلاب</option>";
            groups.forEach(g => { select.innerHTML += `<option value="${g.name}">مجموعة: ${g.name}</option>`; });
            if(typeof updateBroadcastCount === "function") updateBroadcastCount();
        }
    }
}

// السمة (Theme)
const currentTheme = localStorage.getItem("theme") || "dark"; const themeBtn = document.getElementById("theme-btn");
if (currentTheme === "light") { document.documentElement.setAttribute("data-theme", "light"); themeBtn.innerText = "☀️ الوضع الفاتح"; }
function toggleTheme() {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") === "light") { root.removeAttribute("data-theme"); localStorage.setItem("theme", "dark"); themeBtn.innerText = "☀️ الوضع الفاتح"; } 
    else { root.setAttribute("data-theme", "light"); localStorage.setItem("theme", "light"); themeBtn.innerText = "🌙 الوضع الداكن"; }
    renderDashboardCharts(); 
}

// المساعد والأدمن
function toggleAssistantMode() {
    if(isAssistantMode) { openModal('pinModal'); } 
    else { enableAssistantMode(); showToast("تم تفعيل وضع المساعد وإغلاق الصلاحيات"); }
}
function enableAssistantMode() {
    isAssistantMode = true; localStorage.setItem("isAssistantMode", "true");
    document.body.classList.add('assistant-mode');
    document.getElementById('assistant-btn').innerText = "🔓 فتح الإدارة";
    document.getElementById('assistant-btn').style.borderColor = "var(--success-color)";
    document.getElementById('assistant-btn').style.color = "var(--success-color)";
    switchPage('dashboard');
}
function verifyPin() {
    const entered = document.getElementById('adminPinInput').value;
    if(entered === adminPin) {
        isAssistantMode = false; localStorage.setItem("isAssistantMode", "false");
        document.body.classList.remove('assistant-mode');
        document.getElementById('assistant-btn').innerText = "🔒 قفل الإدارة (للمساعد)";
        document.getElementById('assistant-btn').style.borderColor = "var(--danger-color)";
        document.getElementById('assistant-btn').style.color = "var(--danger-color)";
        closeModal('pinModal'); document.getElementById('adminPinInput').value = '';
        showToast("مرحباً بك يا شيفو! تم فتح الصلاحيات كاملة.");
        renderDashboardCharts();
    } else { showToast("الرقم السري خاطئ!", "error"); }
}

// ==========================================
// 12. نظام التفعيل وفصل البيانات (Multi-Tenancy) والمزامنة
// ==========================================
let isFirebaseLoaded = false;
let licenseKey = localStorage.getItem("licenseKey"); // بنقرأ الكود من جهاز المدرس

// الدالة دي بتولد مسار الداتابيز المخصوص للمدرس بناءً على كوده!
function getFirebaseUrl() {
    return `https://edutrack-system-1ded4-default-rtdb.firebaseio.com/teachers/${licenseKey}/data.json`;
}

// ==========================================
// 1. التحكم في الشاشات أول ما البرنامج يفتح
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderTable === "function") renderTable(); 
    if (typeof populateDropdowns === "function") populateDropdowns();

    let currentKey = localStorage.getItem("licenseKey");
    let currentUser = localStorage.getItem("adminUser");
    let keepLoggedIn = localStorage.getItem("keepLoggedIn") === "true";
    let sessionLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
    let isDemoMode = localStorage.getItem("is_demo_mode") === "true"; // 🌟 فحص وضع الديمو

    document.getElementById("activation-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";

    // 🌟 1. لو الحساب تجريبي (ديمو)
    if (isDemoMode) {
        let demoStart = localStorage.getItem("demo_start_date");
        let demoDeviceId = localStorage.getItem("demo_device_id"); // 🔒 رقم الجهاز
        let now = new Date().getTime();
        let daysPassed = (now - parseInt(demoStart)) / (1000 * 60 * 60 * 24);

        if (daysPassed > 7) {
            localStorage.removeItem("is_demo_mode"); 
            document.getElementById("login-screen").style.display = "flex";
            document.getElementById('loginError').innerText = "انتهت فترة التجربة المجانية (7 أيام). يرجى شراء كود تفعيل!";
            document.getElementById('loginError').style.display = 'block';
            return;
        }

        // 🛑 فحص الأمان: التأكد إن الإدارة موقفتش الحساب أو حذفته من السيرفر
        if (demoDeviceId) {
            fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/demo_users/${demoDeviceId}.json`)
            .then(res => res.json())
            .then(data => {
                // لو الداتا رجعت فاضية (أنت مسحته) أو حالته موقوف (أنت عملت إيقاف)
                if (!data || data.status === 'suspended') {
                    localStorage.removeItem("is_demo_mode");
                    localStorage.removeItem("demo_start_date");
                    localStorage.removeItem("demo_registered");
                    alert("تم إيقاف نسختك التجريبية من قبل الإدارة. يرجى تفعيل الحساب للاستمرار.");
                    location.reload();
                }
            }).catch(e => { /* تجاهل لو مفيش نت عشان يكمل أوفلاين عادي */ });
        }

        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        if(document.getElementById("shefo-assistant-btn")) document.getElementById("shefo-assistant-btn").style.display = "block";
        switchPage('dashboard'); 
        setTimeout(renderDashboardCharts, 500);
        return; 
    }

    // 🌟 2. لو مستخدم حقيقي (شاري كود)
    if ((keepLoggedIn || sessionLoggedIn) && currentKey && currentUser) {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        if(document.getElementById("shefo-assistant-btn")) document.getElementById("shefo-assistant-btn").style.display = "block";
        switchPage('dashboard'); 
        setTimeout(renderDashboardCharts, 500); 
        setTimeout(checkGlobalAnnouncements, 1500); // يفحص الإشعارات بعد الدخول بثانية ونص
        loadDataFromFirebase();
    } else {
        document.getElementById("login-screen").style.display = "flex";
    }
});

// 2. دالة تفعيل البرنامج وتثبيت العلامة التجارية
async function activateSoftware() {
    const elements = {
        key: document.getElementById("licenseKeyInput").value.trim(),
        tName: document.getElementById("actTeacherName").value.trim(),
        cName: document.getElementById("actCenterName").value.trim(),
        newUser: document.getElementById("newAdminUser").value.trim(),
        newPass: document.getElementById("newAdminPass").value.trim(),
        newPin: document.getElementById("newAdminPin").value.trim()
    };

    if (Object.values(elements).some(val => val === "")) {
        const err = document.getElementById("activationError");
        err.style.display = "block"; err.innerText = "يرجى ملء جميع الخانات لتأمين حسابك!";
        return;
    }
    
    try {
        let licRes = await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/licenses/${elements.key}.json`);
        let licData = await licRes.json();
        
        if (!licData || licData.status === 'suspended') {
            document.getElementById("activationError").style.display = "block";
            document.getElementById("activationError").innerText = "الكود غير صحيح أو موقوف!";
            return;
        }

        // حفظ البيانات محلياً
        localStorage.setItem("licenseKey", elements.key);
        localStorage.setItem("teacherName", elements.tName);
        localStorage.setItem("centerName", elements.cName);
        localStorage.setItem("adminUser", elements.newUser);
        localStorage.setItem("adminPass", elements.newPass);
        localStorage.setItem("adminPin", elements.newPin);
        
        licenseKey = elements.key; adminPin = elements.newPin;

        // رفع إعدادات الأمان للهوية المحفورة (Branding & Security Lock)
        const initialSettings = { 
            settings: { 
                teacherName: elements.tName, 
                centerName: elements.cName,
                adminUser: elements.newUser,
                adminPass: elements.newPass,
                adminPin: elements.newPin
            } 
        };
        
        await fetch(getFirebaseUrl(), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialSettings)
        });

        // تحديث لوحة المدير العام
        await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/licenses/${elements.key}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimedBy: elements.tName, activatedAt: new Date().toISOString() })
        });

        showToast("تم التفعيل وتأمين الحساب بنجاح!");
        document.getElementById("activation-screen").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        loadDataFromFirebase();
    } catch (e) { showToast("عطل في الاتصال بالخادم", "error"); }
}

// 3. المزامنة السحابية + التحقق من الإيقاف والتاريخ التلقائي والإنذار
async function loadDataFromFirebase() {
    // 🛑 منع التحميل من السحابة لو الحساب تجريبي (حماية للداتا)
    if (localStorage.getItem("is_demo_mode") === "true") {
        isFirebaseLoaded = true; // نديها true وهمي عشان السيستم يشتغل محلي
        return; 
    }
    if(!licenseKey) return; 
    try {
        let licRes = await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/licenses/${licenseKey}.json`);
        let licData = await licRes.json();
        
        if (licData) {
            let isExpired = false;
            
            // حساب هل الباقة انتهت زمنياً أم لا
            if (licData.activatedAt && licData.durationMonths) {
                let activationDate = new Date(licData.activatedAt);
                let expirationDate = new Date(activationDate.setMonth(activationDate.getMonth() + parseInt(licData.durationMonths)));
                let today = new Date();
                
                let timeDiff = expirationDate.getTime() - today.getTime();
                let daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24)); // حساب الأيام المتبقية

                if (daysLeft <= 0) {
                    isExpired = true;
                } else if (daysLeft <= 5) {
                    // 🚨 إظهار شريط الإنذار لو باقي 5 أيام أو أقل
                    document.getElementById("expiration-banner").style.display = "block";
                    document.getElementById("expire-days").innerText = daysLeft;
                }
            }

            // لو موقوف من الإدارة أو مدته انتهت
            if (licData.status === 'suspended' || isExpired) {
                document.getElementById("login-screen").style.display = "none";
                document.getElementById("main-app").style.display = "none";
                const suspendedScreen = document.getElementById("suspended-screen");
                suspendedScreen.style.display = "flex";
                
                // تغيير الرسالة بناءً على سبب الإيقاف
                if (isExpired) {
                    suspendedScreen.querySelector("h2").innerText = "انتهت فترة الاشتراك! ⏳";
                    suspendedScreen.querySelector("p").innerText = "لقد انتهت صلاحية باقتك الحالية. يرجى التواصل مع الإدارة لتجديد الاشتراك واستعادة بياناتك.";
                }
                return; // قفل السيستم
            }
        }

        // --- باقي دالة الـ loadDataFromFirebase لسحب الداتا ---
        let res = await fetch(getFirebaseUrl());
        let data = await res.json();
        // ... (تكملة الكود بتاع سحب الـ settings والـ students زي ما هو) ...
        
        if (data) {
            if(data.settings) {
                localStorage.setItem("teacherName", data.settings.teacherName);
                localStorage.setItem("centerName", data.settings.centerName);
                // السطرين الجداد دول 👇
                localStorage.setItem("adminUser", data.settings.adminUser);
                localStorage.setItem("adminPass", data.settings.adminPass);
                localStorage.setItem("adminPin", data.settings.adminPin);
                adminPin = data.settings.adminPin; // تحديث المتغير العالمي
            } else if (data.teacherName) {
                localStorage.setItem("teacherName", data.teacherName);
            }

            students = (data.students || []).filter(i => i !== null);
            groups = (data.groups || []).filter(i => i !== null);
            schedule = (data.schedule || []).filter(i => i !== null);
            expenses = (data.expenses || []).filter(i => i !== null);
            financeRecords = data.financeRecords || {};
            books = (data.books || []).filter(i => i !== null);
             onlineExams = (data.onlineExams || []).filter(i => i !== null);
            classSessions = (data.classSessions || []).filter(i => i !== null).map(s => ({...s, attendance: s.attendance || {}}));
            exams = (data.exams || []).filter(i => i !== null).map(e => ({...e, grades: e.grades || {}}));
            homeworks = (data.homeworks || []).filter(i => i !== null).map(h => ({...h, grades: h.grades || {}}));
            
            localStorage.setItem("students", JSON.stringify(students));
            localStorage.setItem("classSessions", JSON.stringify(classSessions));
            localStorage.setItem("exams", JSON.stringify(exams));
            localStorage.setItem("homeworks", JSON.stringify(homeworks));
            localStorage.setItem("schedule", JSON.stringify(schedule));
            localStorage.setItem("groups", JSON.stringify(groups));
            localStorage.setItem("financeRecords", JSON.stringify(financeRecords));
            localStorage.setItem("expenses", JSON.stringify(expenses));
            localStorage.setItem("books", JSON.stringify(books));
           
            localStorage.setItem("onlineExams", JSON.stringify(onlineExams));

            renderTable();
            if (document.getElementById("groups-list")) renderGroupCards();
            if (typeof renderBooksTable === "function") renderBooksTable();
            if(sessionStorage.getItem("isLoggedIn") === "true" && typeof renderDashboardCharts === "function") {
                renderDashboardCharts();
            }
        }
    } catch (e) {
        console.log("⚠️ تعذر الاتصال بالسحابة أو قاعدة البيانات فارغة.");
    }
    isFirebaseLoaded = true; 
}

async function syncDataToBot() {
    let isDemo = localStorage.getItem("is_demo_mode") === "true";
    if (!isDemo && (!isFirebaseLoaded || !licenseKey)) return; 

    // تجميع البيانات وضمان وجود أري الامتحانات الإلكترونية بدون تضارب
    const dataToSync = {
        settings: {
            teacherName: localStorage.getItem("teacherName") || "المدير",
            centerName: localStorage.getItem("centerName") || "السنتر",
            adminUser: localStorage.getItem("adminUser") || "shefo",
            adminPass: localStorage.getItem("adminPass") || "12345",
            adminPin: localStorage.getItem("adminPin") || "1234"
        },
        teacherName: localStorage.getItem("teacherName") || "المدير",
        centerName: localStorage.getItem("centerName") || "السنتر",
        adminUser: localStorage.getItem("adminUser"),
        adminPass: localStorage.getItem("adminPass"),
        adminPin: localStorage.getItem("adminPin"),
        
        students, classSessions, exams, homeworks, schedule, groups, financeRecords, expenses, books,
        onlineExams: onlineExams // ضفناها هنا عشان الفايربيز يحفظ هيكل الامتحانات
    };

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:") {
        try {
            await fetch('http://localhost:3000/sync-database', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSync) });
        } catch (e) {}
    }

    if (isDemo) return;

    try {
        await fetch(getFirebaseUrl(), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSync) });
    } catch (e) {}
}

["students", "classSessions", "exams", "homeworks", "schedule", "groups", "financeRecords", "expenses", "books"].forEach(key => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(k, v) {
        originalSetItem.apply(this, arguments);
        if(key === k) syncDataToBot();
    };
});

// ==========================================
// 5. إدارة الجدول الأسبوعي (المواعيد والتعديل)
// ==========================================
function renderSchedule() {
    const grid = document.getElementById("schedule-grid"); 
    if(!grid) return;
    grid.innerHTML = ""; 
    
    const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];

    let html = `<div class="schedule-table-container"><table class="timetable"><thead><tr><th>اليوم / الساعة</th>`;
    hours.forEach(h => {
        let hr = parseInt(h);
        let ampm = hr >= 12 ? 'م' : 'ص';
        let displayH = hr > 12 ? hr - 12 : hr;
        html += `<th>${displayH}:00 ${ampm}</th>`;
    });
    html += `</tr></thead><tbody>`;

    days.forEach(day => {
        html += `<tr><td class="day-head">${day}</td>`;
        hours.forEach(hour => {
            const items = schedule.filter(s => s.day === day && s.time.startsWith(hour));
            html += `<td>`;
            items.forEach(item => {
                const idx = schedule.findIndex(x => x.id === item.id);
                // ✏️ كارت الحصة متضمن زرار التعديل
                html += `
                    <div class="slot-card">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="slot-time">⏰ ${formatTime12(item.time)}</span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span class="edit-btn admin-only" onclick="openEditSlotModal(${idx})" style="cursor:pointer; font-size: 14px;">✏️</span>
                                <span class="del-btn admin-only" onclick="deleteScheduleItem(${item.id})" style="cursor:pointer; font-size: 16px; color: var(--danger-color);">&times;</span>
                            </div>
                        </div>
                        <div class="slot-group">👥 ${item.group}</div>
                        <div class="slot-location">📍 ${item.location || "غير محدد"}</div>
                    </div>`;
            });
            html += `</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    grid.innerHTML = html;
}

// إضافة موعد جديد
document.getElementById("addScheduleForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    schedule.push({
        id: Date.now(),
        day: document.getElementById("schedDay").value,
        time: document.getElementById("schedTime").value,
        group: document.getElementById("schedGroup").value,
        location: document.getElementById("schedLocation")?.value || document.getElementById("schedSubject")?.value || "السنتر"
    });
    localStorage.setItem("schedule", JSON.stringify(schedule));
    closeModal('addScheduleModal'); 
    this.reset(); 
    renderSchedule(); 
    showToast("تم إضافة الموعد للجدول بنجاح");
});

function deleteScheduleItem(id) { 
    customConfirm("حذف هذا الموعد من الجدول؟", () => { 
        schedule = schedule.filter(s => s.id !== id); 
        localStorage.setItem("schedule", JSON.stringify(schedule)); 
        renderSchedule(); 
    }); 
}

// ✏️ فتح نافذة التعديل للموعد
function openEditSlotModal(index) {
    const slot = schedule[index];
    if(!slot) return;
    document.getElementById('editSlotIndex').value = index;
    document.getElementById('editSlotDay').value = slot.day;
    document.getElementById('editSlotTime').value = slot.time;
    document.getElementById('editSlotGroup').value = slot.group;
    document.getElementById('editSlotLocation').value = slot.location || "";
    openModal('editSlotModal');
}

// ✏️ حفظ التعديلات في الموعد
function updateScheduleSlot() {
    const index = document.getElementById('editSlotIndex').value;
    if(index === "") return;
    
    schedule[index].day = document.getElementById('editSlotDay').value;
    schedule[index].time = document.getElementById('editSlotTime').value;
    schedule[index].group = document.getElementById('editSlotGroup').value;
    schedule[index].location = document.getElementById('editSlotLocation').value;
    
    localStorage.setItem("schedule", JSON.stringify(schedule));
    renderSchedule();
    closeModal('editSlotModal');
    showToast("تم تحديث الحصة بنجاح");
}


// ==========================================
// 6. إدارة الطلاب والمجموعات
// ==========================================
function filterGroupsByLevel(levelSelectId, groupSelectId) {
    const level = document.getElementById(levelSelectId).value;
    const groupSelect = document.getElementById(groupSelectId);
    if(!groupSelect) return;
    groupSelect.innerHTML = "<option value=''>اختر المجموعة...</option>";
    if(level) { groups.filter(g => g.level === level).forEach(g => { groupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`; }); }
}

function generateStudentCode() { let maxId = 0; students.forEach(s => { let num = parseInt(s.code, 10); if (!isNaN(num) && num > maxId) maxId = num; }); return (maxId + 1).toString(); }

document.getElementById("addStudentForm")?.addEventListener("submit", function(e) { 
    e.preventDefault(); 
    const code = document.getElementById("studentCode").value.trim(); 
    const name = document.getElementById("studentName").value.trim(); 
    const level = document.getElementById("studentLevel").value; 
    const gender = document.getElementById("studentGender").value; 
    const phone = document.getElementById("studentPhone").value.trim(); 
    const parentPhone = document.getElementById("parentPhone").value.trim(); 
    const group = document.getElementById("studentGroup").value; 
    
    if(group === "") return showToast("يرجى اختيار مجموعة!", "error"); 
    if (!isValidEgyptianPhone(phone)) return showToast("رقم هاتف الطالب خطأ!", "error");
    if (!isValidEgyptianPhone(parentPhone)) return showToast("رقم هاتف ولي الأمر خطأ!", "error");
    if (phone === parentPhone) return showToast("رقم الطالب يجب أن يختلف عن ولي الأمر", "error");

    const duplicate = students.find(s => s.code === code || s.phone === phone || s.parentPhone === parentPhone || normalizeArabicName(s.name) === normalizeArabicName(name));
    if(duplicate) return showToast(`مسجل مسبقاً: ${duplicate.name}`, "error");

    students.push({ code, name, level, gender, phone, parentPhone, group, behaviorPoints: 0 }); 
    localStorage.setItem("students", JSON.stringify(students)); 
    
    // 🔴 سطر السجل 
    if(typeof addSystemLog === "function") addSystemLog("إضافة طالب 🎓", `تسجيل الطالب: ${name} (كود: ${code}) في ${group}`);

    // إرسال واتساب للمدرس
    const currentKey = localStorage.getItem("licenseKey") || "";
    const portalLink = `https://system-edutrack.netlify.app/parent.html?id=${currentKey}`;
    const msg = `📢 *أهلاً بك في نظام ${localStorage.getItem("teacherName") || "السنتر"} التعليمي*\nتم تسجيل بيانات الطالب بنجاح.\n👤 *اسم الطالب:* ${name}\n🎓 *كود الطالب:* ${code}\n🔗 *رابط بوابة المتابعة:* ${portalLink}`;
    if (typeof sendAutoWhatsApp === "function") sendAutoWhatsApp(parentPhone, msg);

    this.reset(); closeModal('addStudentModal'); renderTable(); showToast("تم تسجيل الطالب وإرسال رابط البوابة"); 
});

function renderTable() { 
    const tbody = document.getElementById("students-list"); 
    if(!tbody) return;
    tbody.innerHTML = ""; 
    students.forEach((student) => { tbody.innerHTML += `<tr><td><strong style="color:var(--primary-color);">${student.code}</strong></td><td>${student.name}</td><td>${student.level}</td><td>${student.group}</td><td><button class="profile-btn" onclick="openStudentProfile('${student.code}')">👤 الملف</button></td></tr>`; }); 
    document.getElementById("total-students").innerText = students.length; 
}

function searchStudent() { 
    const filter = document.getElementById("searchInput").value.toLowerCase(); 
    const rows = document.getElementById("students-list").getElementsByTagName("tr"); 
    for (let i = 0; i < rows.length; i++) { 
        const codeCol = rows[i].getElementsByTagName("td")[0]; 
        const nameCol = rows[i].getElementsByTagName("td")[1]; 
        if (codeCol && nameCol) { 
            const txt = codeCol.innerText.toLowerCase() + " " + nameCol.innerText.toLowerCase(); 
            rows[i].style.display = (txt.indexOf(filter) > -1) ? "" : "none"; 
        } 
    } 
}


function backToStudents() { currentStudentProfileCode = null; document.getElementById("students-overview").style.display = "block"; document.getElementById("student-profile-view").style.display = "none"; }




// ==========================================
// 8. تهيئة الكاميرا والـ QR
// ==========================================
function startCameraScanner(targetInputId) { currentScannerTarget = targetInputId; document.getElementById('scannerModal').style.display = 'block'; html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false); html5QrcodeScanner.render(onScanSuccess, onScanFailure); }
function stopCameraScanner() { if(html5QrcodeScanner) { html5QrcodeScanner.clear().then(() => { document.getElementById('scannerModal').style.display = 'none'; }).catch(e => { document.getElementById('scannerModal').style.display = 'none'; }); } else { document.getElementById('scannerModal').style.display = 'none'; } }
function onScanSuccess(decodedText) { stopCameraScanner(); const targetInput = document.getElementById(currentScannerTarget); if(targetInput) { targetInput.value = decodedText; const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }); targetInput.dispatchEvent(enterEvent); } }
function onScanFailure() {}




// ملاحظة: دوال الواجبات والامتحانات والحضور اللي في كودك الأصلي موجودة وتعمل بنفس المنطق.


// ==========================================
// 10. تكملة ملف الطالب وتعديل بياناته
// ==========================================
function deleteStudentFromProfile() { 
    customConfirm("حذف الطالب نهائياً؟", () => { 
        const student = students.find(s => s.code === currentStudentProfileCode);
        if(typeof addSystemLog === "function" && student) addSystemLog("حذف طالب 🗑️", `تم مسح الطالب: ${student.name} (كود: ${student.code}) نهائياً من النظام`);
        
        students = students.filter(s => s.code !== currentStudentProfileCode); 
        localStorage.setItem("students", JSON.stringify(students)); 
        backToStudents(); renderTable(); showToast("تم الحذف"); 
    }); 
}

function changeBehaviorPoints(points) { const student = students.find(s => s.code === currentStudentProfileCode); if(student) { student.behaviorPoints = (student.behaviorPoints || 0) + points; localStorage.setItem("students", JSON.stringify(students)); document.getElementById("profile-behavior-points").innerText = student.behaviorPoints; showToast(points > 0 ? "تم إضافة نقاط تميز 🌟" : "تم خصم نقاط 🤫"); } }

function openEditStudentModal() { 
    const student = students.find(s => s.code === currentStudentProfileCode); 
    if(student) { 
        document.getElementById('editStudentCodeOriginal').value = student.code;
        document.getElementById('editStudentCode').value = student.code; 
        document.getElementById('editStudentName').value = student.name; 
        document.getElementById('editStudentLevel').value = student.level; 
        filterGroupsByLevel('editStudentLevel', 'editStudentGroup');
        document.getElementById('editStudentGroup').value = student.group; 
        document.getElementById('editStudentGender').value = student.gender; 
        document.getElementById('editStudentPhone').value = student.phone; 
        document.getElementById('editParentPhone').value = student.parentPhone; 
        openModal('editStudentModal'); 
    } 
}

document.getElementById('editStudentForm')?.addEventListener('submit', function(e) { 
    e.preventDefault(); 
    const originalCode = document.getElementById('editStudentCodeOriginal').value;
    const newCode = document.getElementById('editStudentCode').value.trim();
    const name = document.getElementById('editStudentName').value.trim();
    const phone = document.getElementById('editStudentPhone').value.trim();
    const parentPhone = document.getElementById('editParentPhone').value.trim();

    if (!isValidEgyptianPhone(phone)) return showToast("رقم هاتف الطالب خطأ!", "error");
    if (!isValidEgyptianPhone(parentPhone)) return showToast("رقم ولي الأمر خطأ!", "error");
    if (phone === parentPhone) return showToast("رقم الطالب يجب أن يختلف عن ولي الأمر", "error");

    const duplicate = students.find(s => s.code !== originalCode && (s.code === newCode || s.phone === phone || s.parentPhone === parentPhone || normalizeArabicName(s.name) === normalizeArabicName(name)));
    if(duplicate) return showToast(`تنبيه! مسجل مسبقاً`, "error");

    const studentIndex = students.findIndex(s => s.code === originalCode); 
    if(studentIndex > -1) { 
        const oldPhone = students[studentIndex].phone; 
        students[studentIndex].code = newCode; 
        students[studentIndex].name = name; 
        students[studentIndex].level = document.getElementById('editStudentLevel').value; 
        students[studentIndex].gender = document.getElementById('editStudentGender').value; 
        students[studentIndex].phone = phone; 
        students[studentIndex].parentPhone = parentPhone; 
        students[studentIndex].group = document.getElementById('editStudentGroup').value; 
        
        if(oldPhone !== phone) { 
            classSessions.forEach(s => { if(s.attendance[oldPhone]) { s.attendance[phone] = s.attendance[oldPhone]; delete s.attendance[oldPhone]; }}); 
            exams.forEach(ex => { if(ex.grades[oldPhone]) { ex.grades[phone] = ex.grades[oldPhone]; delete ex.grades[oldPhone]; }}); 
            homeworks.forEach(hw => { if(hw.grades[oldPhone]) { hw.grades[phone] = hw.grades[oldPhone]; delete hw.grades[oldPhone]; }}); 
        } 
        localStorage.setItem("students", JSON.stringify(students)); 
        closeModal('editStudentModal'); openStudentProfile(newCode); showToast("تم التحديث بنجاح"); 
    } 
});

// ==========================================
// 11. إدارة المجموعات
// ==========================================
document.getElementById("addGroupFormModal")?.addEventListener("submit", function(e) { 
    e.preventDefault(); 
    const groupName = document.getElementById("newGroupName").value.trim(); 
    const groupLevel = document.getElementById("newGroupLevel").value; 
    if (!groupName) return showToast("يرجى كتابة اسم المجموعة!", "error");
    if(groups.some(g => g.name === groupName)) return showToast("هذه المجموعة موجودة بالفعل!", "error"); 
    
    groups.push({ name: groupName, level: groupLevel }); 
    localStorage.setItem("groups", JSON.stringify(groups)); 
    
    // 🔴 سطر السجل 
    if(typeof addSystemLog === "function") addSystemLog("إنشاء مجموعة 📚", `تم إنشاء مجموعة جديدة باسم: ${groupName} (${groupLevel})`);

    showToast("تم الإضافة بنجاح"); 
    this.reset(); closeModal('addGroupModal'); renderGroupCards(); 
});

function renderGroupCards() { 
    const grid = document.getElementById("groups-list"); 
    if(!grid) return;
    grid.innerHTML = ""; 
    groups.forEach((group, index) => { 
        const studentsCount = students.filter(s => s.group === group.name).length; 
        grid.innerHTML += `<div class="session-card"><div class="session-header-card"><div><div class="session-group-name">📁 ${group.name}</div><div style="font-size: 12px; color: var(--primary-color);">${group.level}</div></div><span class="status-badge status-none">👥 ${studentsCount} طالب</span></div><div class="session-actions"><button class="enter-btn" onclick="openGroupDetails('${group.name}')">إدارة المجموعة</button><button class="icon-btn admin-only" onclick="openEditGroupModal('${group.name}')">✏️</button><button class="icon-btn danger admin-only" onclick="deleteGroup(${index})" title="حذف">🗑️</button></div></div>`; 
    }); 
    document.getElementById("total-groups").innerText = groups.length; 
}

function deleteGroup(index) { customConfirm("حذف هذه المجموعة نهائياً؟", () => { groups.splice(index, 1); localStorage.setItem("groups", JSON.stringify(groups)); renderGroupCards(); }); }

function openEditGroupModal(oldName) {
    const group = groups.find(g => g.name === oldName);
    if(group) {
        document.getElementById('editGroupOriginalName').value = group.name;
        document.getElementById('editGroupName').value = group.name;
        document.getElementById('editGroupLevel').value = group.level;
        openModal('editGroupModal');
    }
}

document.getElementById('editGroupFormModal')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const oldName = document.getElementById('editGroupOriginalName').value;
    const newName = document.getElementById('editGroupName').value.trim();
    const newLevel = document.getElementById('editGroupLevel').value;

    const groupIndex = groups.findIndex(g => g.name === oldName);
    if(groupIndex > -1) {
        if(newName !== oldName && groups.some(g => g.name === newName)) return showToast("الاسم الجديد مستخدم بالفعل!", "error");
        groups[groupIndex].name = newName; groups[groupIndex].level = newLevel;
        if(newName !== oldName) {
            students.forEach(s => { if(s.group === oldName) s.group = newName; });
            classSessions.forEach(s => { if(s.group === oldName) s.group = newName; });
            exams.forEach(e => { if(e.group === oldName) e.group = newName; });
            homeworks.forEach(h => { if(h.group === oldName) h.group = newName; });
            schedule.forEach(sc => { if(sc.group === oldName) sc.group = newName; });
        }
        localStorage.setItem("groups", JSON.stringify(groups));
        closeModal('editGroupModal'); renderGroupCards(); showToast("تم التعديل بنجاح");
    }
});

function openGroupDetails(groupName) { currentActiveGroup = groupName; document.getElementById("groups-overview").style.display = "none"; document.getElementById("group-details-view").style.display = "block"; document.getElementById("current-group-title").innerText = `مجموعة: ${groupName}`; renderGroupStudentsTable(); }
function backToGroups() { currentActiveGroup = null; document.getElementById("groups-overview").style.display = "block"; document.getElementById("group-details-view").style.display = "none"; renderGroupCards(); }

function renderGroupStudentsTable() { 
    const tbody = document.getElementById("group-students-list"); 
    tbody.innerHTML = ""; 
    const groupStudents = students.filter(s => s.group === currentActiveGroup); 
    if(groupStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا يوجد طلاب</td></tr>`; 
    groupStudents.forEach((student) => { 
        tbody.innerHTML += `<tr><td><strong style="color:var(--primary-color);">${student.code}</strong></td><td>${student.name}</td><td>${student.parentPhone}</td><td><button class="profile-btn" onclick="openStudentProfile('${student.code}')">👤 الملف</button><button class="icon-btn danger admin-only" style="margin-right: 5px;" onclick="removeStudentFromGroup('${student.code}')">❌ إزالة</button></td></tr>`; 
    }); 
}

function removeStudentFromGroup(code) { customConfirm("إزالة هذا الطالب من المجموعة؟", () => { const student = students.find(s => s.code === code); if(student) { student.group = ""; localStorage.setItem("students", JSON.stringify(students)); renderGroupStudentsTable(); renderGroupCards(); showToast("تمت الإزالة"); } }); }

// ==========================================
// 12. الحضور والانصراف (Sessions)
// ==========================================
function toggleAutoInputs() { const eCheck = document.getElementById("autoExamCheck").checked; const hCheck = document.getElementById("autoHwCheck").checked; document.getElementById("autoExamScore").style.display = eCheck ? "block" : "none"; document.getElementById("autoHwScore").style.display = hCheck ? "block" : "none"; }
document.getElementById("addSessionForm")?.addEventListener("submit", function(e) { 
    e.preventDefault(); 
    const group = document.getElementById("sessionGroupSelect").value; 
    const date = document.getElementById("sessionDate").value; 
    const topic = document.getElementById("sessionTopic").value || "حصة"; 
    classSessions.push({ id: Date.now().toString(), group, date, topic, status: "open", attendance: {} }); 
    if(document.getElementById("autoExamCheck").checked) exams.push({ id: Date.now().toString()+"_e", group, name: `امتحان: ${topic}`, maxScore: document.getElementById("autoExamScore").value, date, status: "open", grades: {} }); 
    if(document.getElementById("autoHwCheck").checked) homeworks.push({ id: Date.now().toString()+"_h", group, name: `واجب: ${topic}`, maxScore: document.getElementById("autoHwScore").value, date, status: "open", grades: {} }); 
    localStorage.setItem("classSessions", JSON.stringify(classSessions)); localStorage.setItem("exams", JSON.stringify(exams)); localStorage.setItem("homeworks", JSON.stringify(homeworks)); 
    
    // 🔴 سطر السجل 
    if(typeof addSystemLog === "function") addSystemLog("فتح حصة 🎯", `فتح حصة جديدة لمجموعة: ${group} بموضوع: ${topic}`);

    this.reset(); toggleAutoInputs(); closeModal('addSessionModal'); renderSessionCards(); showToast("تم الإنشاء"); 
});

function renderSessionCards() { 
    const grid = document.getElementById("sessions-grid"); if(!grid) return; grid.innerHTML = ""; 
    [...classSessions].reverse().forEach(session => { 
        const presentCount = Object.values(session.attendance).filter(v => v === 'present').length; 
        const total = students.filter(s => s.group === session.group).length; 
        const isClosed = session.status === 'closed'; 
        grid.innerHTML += `<div class="session-card"><div class="session-header-card"><div><div class="session-group-name">${session.group}</div><div class="session-date">${session.date}</div></div><span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed ? 'مغلقة' : 'مفتوحة'}</span></div><div class="session-topic">${session.topic}</div><div style="font-size: 14px; color: var(--text-muted);">الحضور: <strong>${presentCount} / ${total}</strong></div><div class="session-actions"><button class="enter-btn" onclick="openSessionDetails('${session.id}')" ${isClosed?'disabled':''}>تسجيل</button><button class="icon-btn admin-only" onclick="openEditSessionModal('${session.id}')">✏️</button><button class="icon-btn admin-only" onclick="toggleSessionStatus('${session.id}')">${isClosed?'🔓':'🔒 قفل وإرسال'}</button><button class="icon-btn danger admin-only" onclick="deleteSession('${session.id}')">🗑️</button></div></div>`; 
    }); 
}

function deleteSession(id) { customConfirm("حذف الحصة؟", () => { classSessions = classSessions.filter(s => s.id !== id); localStorage.setItem("classSessions", JSON.stringify(classSessions)); renderSessionCards(); }); }
function openSessionDetails(id) { currentActiveSessionId = id; const session = classSessions.find(s => s.id === id); document.getElementById("sessions-overview").style.display = "none"; document.getElementById("session-details-view").style.display = "block"; document.getElementById("current-session-title").innerText = session.group; renderAttendanceTable(session); }
function backToSessions() { document.getElementById("sessions-overview").style.display = "block"; document.getElementById("session-details-view").style.display = "none"; renderSessionCards(); }

function renderAttendanceTable(session) { 
    const tbody = document.getElementById("attendance-list"); const gStudents = students.filter(s => s.group === session.group); 
    if(gStudents.length===0) return tbody.innerHTML=`<tr><td colspan="6">لا يوجد طلاب</td></tr>`; tbody.innerHTML = ""; 
    const groupS = classSessions.filter(s => s.group === session.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); 
    const prevSession = groupS[groupS.findIndex(s => s.id === session.id) - 1]; 
    gStudents.forEach(st => { 
        const stat = session.attendance[st.phone]; 
        const statHtml = stat === 'present' ? '<span style="color:var(--success-color)">حاضر ✓</span>' : stat === 'absent' ? '<span style="color:var(--danger-color)">غائب ✗</span>' : 'لم يسجل'; 
        let pHT = '--'; if(prevSession) { const p = prevSession.attendance[st.phone]; pHT = p==='present'?'حاضر':p==='absent'?'غائب':'--'; } 
        tbody.innerHTML += `<tr><td><strong>${st.code}</strong></td><td>${st.name}</td><td>${st.phone}</td><td>${pHT}</td><td>${statHtml}</td><td><button class="btn-present" onclick="markAttendance('${st.phone}','present')">حاضر</button><button class="btn-absent" onclick="markAttendance('${st.phone}','absent')">غائب</button></td></tr>`; 
    }); 
}

function markAttendance(phone, status) { const s = classSessions.find(s => s.id === currentActiveSessionId); if(s && s.status==='open') { s.attendance[phone] = status; localStorage.setItem("classSessions", JSON.stringify(classSessions)); renderAttendanceTable(s); } }

document.getElementById('attendanceBarcode')?.addEventListener('keypress', function(e) { 
    if(e.key === 'Enter') { 
        e.preventDefault(); let val = this.value.trim(); let student = findStudentByCodeOrName(val); const session = classSessions.find(s => s.id === currentActiveSessionId); 
        if(!student) showToast(`طالب غير موجود!`, 'error'); else if(student.group !== session.group) showToast(`الطالب ليس في هذه المجموعة!`, 'error'); else if(session.status === 'closed') showToast(`الحصة مغلقة!`, 'error'); else { markAttendance(student.phone, 'present'); showToast(`تم حضور: ${student.name}`); }
        this.value = ''; 
    } 
});

// ==========================================
// 13. الامتحانات والواجبات (Exams & HW)
// ==========================================
document.getElementById("addExamForm")?.addEventListener("submit", function(e) { e.preventDefault(); exams.push({ id: Date.now().toString(), group: document.getElementById("examGroupSelect").value, name: document.getElementById("examName").value, maxScore: document.getElementById("examMaxScore").value, date: document.getElementById("examDate").value, status: "open", grades: {} }); localStorage.setItem("exams", JSON.stringify(exams)); this.reset(); closeModal('addExamModal'); renderExamCards(); showToast("تم الإنشاء"); });
function deleteExam(id) { customConfirm("حذف الامتحان؟", () => { exams = exams.filter(e => e.id !== id); localStorage.setItem("exams", JSON.stringify(exams)); renderExamCards(); }); }
function openExamDetails(id) { currentActiveExamId = id; const e = exams.find(e => e.id === id); document.getElementById("exams-overview").style.display = "none"; document.getElementById("exam-details-view").style.display = "block"; document.getElementById("current-exam-title").innerText = e.name; renderGradesTable(e, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); }
function backToExams() { document.getElementById("exams-overview").style.display = "block"; document.getElementById("exam-details-view").style.display = "none"; renderExamCards(); }
function saveExamGrade(phone) { const e = exams.find(e => e.id === currentActiveExamId); const v = document.getElementById(`grade_${phone}`).value; if(v !== "") { e.grades[phone] = v; localStorage.setItem("exams", JSON.stringify(exams)); renderGradesTable(e, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); } }

window.submitExamBarcodeGrade = function() {
    let c = document.getElementById('examBarcodeCode').value.trim(); let g = document.getElementById('examBarcodeGrade').value.trim();
    const ex = exams.find(e => e.id === currentActiveExamId);
    if(c !== "" && g !== "") {
        let student = findStudentByCodeOrName(c);
        if(student && ex && ex.status === 'open') {
            if(parseFloat(g) > parseFloat(ex.maxScore) || parseFloat(g) < 0) return showToast(`الدرجة غير منطقية!`, 'error');
            ex.grades[student.phone] = g; localStorage.setItem("exams", JSON.stringify(exams)); renderGradesTable(ex, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); showToast(`تم رصد ${g} لـ ${student.name}`);
            document.getElementById('examBarcodeCode').value = ''; document.getElementById('examBarcodeGrade').value = ''; document.getElementById('examBarcodeCode').focus();
        }
    }
};
// ==========================================
// ✏️ رسم كروت الامتحانات والواجبات (بإضافة زرار التعديل)
// ==========================================


function openEditExamModal(id) {
    const exam = exams.find(e => e.id === id); if(!exam) return;
    document.getElementById('editExamId').value = exam.id;
    document.getElementById('editExamName').value = exam.name;
    document.getElementById('editExamMaxScore').value = exam.maxScore;
    document.getElementById('editExamDate').value = exam.date;
    openModal('editExamModal');
}

document.getElementById('editExamForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('editExamId').value;
    const examIndex = exams.findIndex(e => e.id === id);
    if(examIndex > -1) {
        exams[examIndex].name = document.getElementById('editExamName').value.trim();
        exams[examIndex].maxScore = document.getElementById('editExamMaxScore').value;
        exams[examIndex].date = document.getElementById('editExamDate').value;
        localStorage.setItem("exams", JSON.stringify(exams)); closeModal('editExamModal'); renderExamCards(); showToast("تم تعديل بيانات الامتحان بنجاح ✏️");
    }
});



function openEditHwModal(id) {
    const hw = homeworks.find(h => h.id === id); if(!hw) return;
    document.getElementById('editHwId').value = hw.id;
    document.getElementById('editHwName').value = hw.name;
    document.getElementById('editHwMaxScore').value = hw.maxScore;
    document.getElementById('editHwDate').value = hw.date;
    openModal('editHwModal');
}

document.getElementById('editHwForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('editHwId').value;
    const hwIndex = homeworks.findIndex(h => h.id === id);
    if(hwIndex > -1) {
        homeworks[hwIndex].name = document.getElementById('editHwName').value.trim();
        homeworks[hwIndex].maxScore = document.getElementById('editHwMaxScore').value;
        homeworks[hwIndex].date = document.getElementById('editHwDate').value;
        localStorage.setItem("homeworks", JSON.stringify(homeworks)); closeModal('editHwModal'); renderHwCards(); showToast("تم تعديل بيانات الواجب بنجاح ✏️");
    }
});

document.getElementById("addHwForm")?.addEventListener("submit", function(e) { e.preventDefault(); homeworks.push({ id: Date.now().toString(), group: document.getElementById("hwGroupSelect").value, name: document.getElementById("hwName").value, maxScore: document.getElementById("hwMaxScore").value, date: document.getElementById("hwDate").value, status: "open", grades: {} }); localStorage.setItem("homeworks", JSON.stringify(homeworks)); this.reset(); closeModal('addHwModal'); renderHwCards(); });
function deleteHw(id) { customConfirm("حذف الواجب؟", () => { homeworks = homeworks.filter(h => h.id !== id); localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderHwCards(); }); }
function openHwDetails(id) { currentActiveHwId = id; const hw = homeworks.find(h => h.id === id); document.getElementById("hw-overview").style.display = "none"; document.getElementById("hw-details-view").style.display = "block"; document.getElementById("current-hw-title").innerText = hw.name; renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); }
function backToHw() { document.getElementById("hw-overview").style.display = "block"; document.getElementById("hw-details-view").style.display = "none"; renderHwCards(); }
function saveHwGrade(phone) { const hw = homeworks.find(h => h.id === currentActiveHwId); const v = document.getElementById(`grade_${phone}`).value; if(v !== "") { hw.grades[phone] = v; localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); } }

window.submitHwBarcodeGrade = function() {
    let c = document.getElementById('hwBarcodeCode').value.trim(); let g = document.getElementById('hwBarcodeGrade').value.trim();
    const hw = homeworks.find(h => h.id === currentActiveHwId);
    if(c !== "" && g !== "") {
        let student = findStudentByCodeOrName(c);
        if(student && hw && hw.status === 'open') {
            if(parseFloat(g) > parseFloat(hw.maxScore) || parseFloat(g) < 0) return showToast(`الدرجة غير منطقية!`, 'error');
            hw.grades[student.phone] = g; localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); showToast(`تم رصد ${g} لـ ${student.name}`);
            document.getElementById('hwBarcodeCode').value = ''; document.getElementById('hwBarcodeGrade').value = ''; document.getElementById('hwBarcodeCode').focus();
        }
    }
};

function renderGradesTable(itemDetails, tbodyId, saveFunction, itemId, itemType) {
    const tbody = document.getElementById(tbodyId); const gStudents = students.filter(s => s.group === itemDetails.group);
    if(gStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">لا يوجد طلاب</td></tr>`; tbody.innerHTML = ""; 
    let prevItem = null;
    if(itemType === 'exam') { const grpItems = exams.filter(e => e.group === itemDetails.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); prevItem = grpItems[grpItems.findIndex(e=>e.id===itemDetails.id)-1]; }
    if(itemType === 'hw') { const grpItems = homeworks.filter(h => h.group === itemDetails.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); prevItem = grpItems[grpItems.findIndex(h=>h.id===itemDetails.id)-1]; }

    gStudents.forEach(st => {
        const grade = itemDetails.grades[st.phone] !== undefined ? itemDetails.grades[st.phone] : '';
        const isHw = tbodyId === 'hw-grades-list'; const btnColor = isHw ? 'var(--hw-color)' : 'var(--exam-color)';
        let pHT = `<span style="color:var(--text-muted)">--</span>`;
        if(prevItem && prevItem.grades[st.phone] !== undefined) pHT = `<strong style="color:${btnColor}">${prevItem.grades[st.phone]} / ${prevItem.maxScore}</strong>`;
        tbody.innerHTML += `<tr><td><strong>${st.code}</strong></td><td>${st.name}</td><td>${st.phone}</td><td style="direction:ltr;">${pHT}</td><td style="direction: ltr;"><span style="color:var(--text-muted);">/ ${itemDetails.maxScore}</span><input type="number" id="grade_${st.phone}" class="custom-input" style="width:70px; padding:5px; text-align:center;" value="${grade}" max="${itemDetails.maxScore}"></td><td><button class="btn-present" onclick="${saveFunction.name}('${st.phone}')" style="background-color: ${btnColor}; color: #fff;">حفظ</button></td></tr>`;
    });
}

// ==========================================
// 14. الرسوم البيانية (Dashboard Full)
// ==========================================
function renderDashboardCharts() {
    // 🔴 السطر السحري اللي بيجيب اللينك ويحطه في المربع أوتوماتيك
    if(typeof updateParentLinkUI === "function") updateParentLinkUI(); 
    
    if(sessionStorage.getItem("isLoggedIn") !== "true") return;
    document.getElementById("total-students").innerText = students.length;
    document.getElementById("total-groups").innerText = groups.length;
    
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#fff';
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#3b82f6';
    
    // رسم الحضور
    const ctxAtt = document.getElementById('attendanceChart')?.getContext('2d');
    if(ctxAtt) {
        if(attendanceChartInstance) attendanceChartInstance.destroy();
        const sessionsByDate = {};
        classSessions.forEach(s => {
            if(!sessionsByDate[s.date]) { sessionsByDate[s.date] = { expected: 0, attended: 0 }; }
            const groupStudentsCount = students.filter(st => st.group === s.group).length;
            const presentCount = Object.values(s.attendance).filter(v => v === 'present').length;
            sessionsByDate[s.date].expected += groupStudentsCount;
            sessionsByDate[s.date].attended += presentCount;
        });
        const sortedDates = Object.keys(sessionsByDate).sort((a,b) => new Date(a) - new Date(b)).slice(-7);
        const sessionLabels = sortedDates.map(d => d.substring(5)); 
        const sessionData = sortedDates.map(d => { const exp = sessionsByDate[d].expected; return exp > 0 ? Math.round((sessionsByDate[d].attended / exp) * 100) : 0; });
        attendanceChartInstance = new Chart(ctxAtt, { type: 'line', data: { labels: sessionLabels, datasets: [{ label: 'متوسط الحضور (%)', data: sessionData, borderColor: primaryColor, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 3, fill: true, tension: 0.3 }] }, options: { plugins: { legend: { labels: { color: textColor } } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor }, min: 0, max: 100 } } } });
    }

    // رسم المجموعات
    const ctxGrp = document.getElementById('groupsChart')?.getContext('2d');
    if(ctxGrp) {
        if(groupsChartInstance) groupsChartInstance.destroy();
        const groupLabels = groups.map(g => g.name); 
        const groupData = groups.map(g => students.filter(s => s.group === g.name).length); 
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
        groupsChartInstance = new Chart(ctxGrp, { type: 'doughnut', data: { labels: groupLabels, datasets: [{ data: groupData, backgroundColor: colors, borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: textColor } } } } });
    }

    // إخفاء ماليّات المساعد
    if(isAssistantMode) return; 

    // رسم المالية
    const ctxFin = document.getElementById('financeChart')?.getContext('2d');
    if(ctxFin) {
        if(financeChartInstance) financeChartInstance.destroy();
        const monthlyData = {}; const defaultStudentFee = 50; const defaultCenterFee = 10;
        classSessions.forEach(s => { const month = s.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 }; });
        Object.keys(financeRecords).forEach(key => {
            if(key.startsWith('fin_session_')) {
                const sessionId = key.replace('fin_session_', ''); const session = classSessions.find(s => s.id === sessionId);
                if(session) {
                    const month = session.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 };
                    let paidCount = 0; Object.values(financeRecords[key]).forEach(status => { if(status === 'paid') paidCount++; });
                    monthlyData[month].income += paidCount * defaultStudentFee; monthlyData[month].expenses += paidCount * defaultCenterFee;
                }
            }
        });
        expenses.forEach(ex => {
            const session = classSessions.find(s => s.id === ex.sessionId);
            if(session) { const month = session.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 }; monthlyData[month].expenses += parseFloat(ex.amount); }
        });
        Object.keys(monthlyData).forEach(m => { monthlyData[m].net = monthlyData[m].income - monthlyData[m].expenses; });
        const sortedMonths = Object.keys(monthlyData).sort();
        financeChartInstance = new Chart(ctxFin, { type: 'bar', data: { labels: sortedMonths, datasets: [ { label: 'الإيرادات', data: sortedMonths.map(m => monthlyData[m].income), backgroundColor: '#10b981' }, { label: 'المصروفات', data: sortedMonths.map(m => monthlyData[m].expenses), backgroundColor: '#ef4444' }, { label: 'الربح', data: sortedMonths.map(m => monthlyData[m].net), backgroundColor: '#3b82f6' } ] }, options: { plugins: { legend: { labels: { color: textColor } } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } } });
    }
}

// ==========================================
// 15. المالية وتحت الملاحظة
// ==========================================
function filterSessionsForFinance() {
    const group = document.getElementById('financeGroupSelect').value; const finSelect = document.getElementById("financeSessionSelect");
    finSelect.innerHTML = "<option value=''>اختر الحصة...</option>";
    if(group) { [...classSessions].reverse().filter(s => s.group === group).forEach(s => { finSelect.innerHTML += `<option value="${s.id}">${s.date} - ${s.topic}</option>`; }); }
}

function renderFinanceTable() {
    const sessionId = document.getElementById("financeSessionSelect").value; const studentFee = parseFloat(document.getElementById("financeStudentFee").value) || 0; const centerFee = parseFloat(document.getElementById("financeCenterFee").value) || 0; const tbody = document.getElementById("finance-list");
    if(!sessionId) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">اختر الحصة</td></tr>`;
    const session = classSessions.find(s => s.id === sessionId); if(!session) return;
    const groupStudents = students.filter(s => s.group === session.group); if(groupStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب</td></tr>`;
    const recordKey = `fin_session_${sessionId}`; if(!financeRecords[recordKey]) financeRecords[recordKey] = {};
    tbody.innerHTML = ""; let totalPaidCount = 0;
    groupStudents.forEach(student => {
        const isPaid = financeRecords[recordKey][student.code] === 'paid'; if(isPaid) totalPaidCount++;
        const attendanceStatus = session.attendance[student.phone] || 'none'; let attBadge = `<span style="color:var(--text-muted)">لم يسجل</span>`; if(attendanceStatus === 'present') attBadge = `<span style="color:var(--success-color); font-weight:bold;">حاضر</span>`; if(attendanceStatus === 'absent') attBadge = `<span style="color:var(--danger-color); font-weight:bold;">غائب</span>`;
        const badge = isPaid ? `<span class="status-badge status-present">تم الدفع ✅</span>` : `<span class="status-badge status-absent">لم يدفع ❌</span>`; const btn = isPaid ? `<button class="icon-btn danger" onclick="togglePayment('${recordKey}', '${student.code}', 'unpaid')">إلغاء</button>` : `<button class="enter-btn" onclick="togglePayment('${recordKey}', '${student.code}', 'paid')">تأكيد</button>`;
        tbody.innerHTML += `<tr><td><strong>${student.code}</strong></td><td>${student.name}</td><td>${attBadge}</td><td>${badge}</td><td>${btn}</td></tr>`;
    });
    document.getElementById("total-income").innerText = `${totalPaidCount * studentFee} ج.م`; document.getElementById("total-income").dataset.income = totalPaidCount * studentFee; document.getElementById("total-income").dataset.centerCut = totalPaidCount * centerFee; renderExpensesList();
}
function togglePayment(recordKey, studentCode, status) { financeRecords[recordKey][studentCode] = status; localStorage.setItem("financeRecords", JSON.stringify(financeRecords)); renderFinanceTable(); }

function renderAtRiskStudents() {
    const tbody = document.getElementById("atrisk-list"); tbody.innerHTML = "";
    if(students.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب</td></tr>`;
    let atRiskCount = 0;
    students.forEach(student => {
        let reasons = [];
        const gSessions = classSessions.filter(s => s.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 2);
        if(gSessions.length === 2 && gSessions[0].attendance[student.phone] === 'absent' && gSessions[1].attendance[student.phone] === 'absent') { reasons.push("غياب آخر حصتين"); }
        const gExams = exams.filter(e => e.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 2);
        let failCount = 0; gExams.forEach(ex => { const grade = ex.grades[student.phone]; if(grade !== undefined && parseFloat(grade) < (parseFloat(ex.maxScore) / 2)) failCount++; });
        if(failCount === 2) reasons.push("رسوب في آخر امتحانين");
        if(reasons.length > 0) {
            atRiskCount++; const msg = encodeURIComponent(`تحذير من الإدارة: مستوى ${student.name} متراجع بسبب ${reasons.join(" و ")}.`); const waUrl = `https://wa.me/20${student.parentPhone.replace(/^0+/, '')}?text=${msg}`;
            tbody.innerHTML += `<tr><td><strong>${student.code}</strong></td><td>${student.name}</td><td>${student.group}</td><td style="color:var(--danger-color); font-weight:bold;">${reasons.join("<br>")}</td><td><button class="icon-btn" style="background-color:#128C7E; color:white;" onclick="window.open('${waUrl}','_blank')">إنذار</button></td></tr>`;
        }
    });
    if(atRiskCount === 0) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--success-color);">الطلاب في مستوى أمان!</td></tr>`;
}

function generateLeaderboard() {
    const group = document.getElementById("leaderboardGroup").value; const container = document.getElementById("leaderboard-results");
    if(!group) return container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">اختر المجموعة</p>`;
    const groupStudents = students.filter(s => s.group === group); if(groupStudents.length === 0) return container.innerHTML = `<p style="text-align: center;">لا طلاب هنا</p>`;
    let leaderboard = groupStudents.map(student => {
        let score = 0; classSessions.filter(s => s.group === group).forEach(session => { if(session.attendance[student.phone] === 'present') score += 10; }); exams.filter(e => e.group === group).forEach(exam => { if(exam.grades[student.phone]) { score += (parseFloat(exam.grades[student.phone]) / parseFloat(exam.maxScore)) * 50; } }); homeworks.filter(h => h.group === group).forEach(hw => { if(hw.grades[student.phone]) { score += (parseFloat(hw.grades[student.phone]) / parseFloat(hw.maxScore)) * 20; } }); score += (student.behaviorPoints || 0); return { name: student.name, code: student.code, score: Math.round(score) };
    });
    leaderboard.sort((a, b) => b.score - a.score); const top5 = leaderboard.slice(0, 5); container.innerHTML = ""; const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
    top5.forEach((st, index) => { container.innerHTML += `<div class="stat-card" style="display:flex; justify-content:space-between; align-items:center; border-left: 5px solid var(--exam-color);"><div style="display:flex; gap:15px; align-items:center;"><span style="font-size:30px;">${medals[index] || "🏅"}</span><div><h3 style="margin-bottom:5px;">${st.name}</h3><p style="color:var(--primary-color);">الكود: ${st.code}</p></div></div><div style="text-align:center;"><p style="color:var(--text-muted); font-size:12px;">مجموع النقاط</p><p style="font-size:24px; font-weight:bold; color:var(--exam-color);">${st.score}</p></div></div>`; });
}

// ==========================================
// 16. الإكسيل (Import / Export)
// ==========================================
function exportData() { const data = { students, groups, classSessions, exams, homeworks, financeRecords, expenses, schedule }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `EduTrack_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); showToast("تم تحميل النسخة الاحتياطية بنجاح"); }
function importData(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const imp = JSON.parse(e.target.result); if(imp.students && imp.groups) { localStorage.setItem("students", JSON.stringify(imp.students)); localStorage.setItem("groups", JSON.stringify(imp.groups)); localStorage.setItem("classSessions", JSON.stringify(imp.classSessions || [])); localStorage.setItem("exams", JSON.stringify(imp.exams || [])); localStorage.setItem("homeworks", JSON.stringify(imp.homeworks || [])); localStorage.setItem("financeRecords", JSON.stringify(imp.financeRecords || {})); localStorage.setItem("expenses", JSON.stringify(imp.expenses || [])); localStorage.setItem("schedule", JSON.stringify(imp.schedule || [])); alert("تم الاسترجاع بنجاح!"); location.reload(); } } catch(err) { showToast("ملف غير صالح!", "error"); } }; reader.readAsText(file); }
function downloadExcelTemplate() { const headers = [["الاسم", "الصف", "المجموعة", "هاتف الطالب", "هاتف ولي الأمر", "الجنس"]]; const worksheet = XLSX.utils.aoa_to_sheet(headers); worksheet['!cols'] = [{wch: 25}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 10}]; const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب"); XLSX.writeFile(workbook, "نموذج_إضافة_الطلاب.xlsx"); showToast("تم تحميل النموذج!"); }

function importStudentsFromExcel(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, {type: 'array'});
            const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            let addedCount = 0, errorCount = 0;
            
            excelData.forEach(row => {
                const name = row['الاسم'], level = row['الصف'], group = row['المجموعة'], phone = row['هاتف الطالب'] || '', parentPhone = row['هاتف ولي الأمر'] || '', gender = row['الجنس'] || 'ذكر';
                
                if(name && level && group) {
                    const duplicate = students.find(s => (phone && s.phone === phone.toString()) || (parentPhone && s.parentPhone === parentPhone.toString()) || normalizeArabicName(s.name) === normalizeArabicName(name.toString()));
                    
                    if(!duplicate) { 
                        // --- 🚀 الذكاء هنا: تنظيف اسم المجموعة ومطابقته بالسيستم ---
                        let excelGroup = group.toString().trim();
                        // بندور في المجموعات بتاعتك على اسم مشابه حتى لو فيه مسافات زيادة
                        let matchedGroup = groups.find(g => normalizeArabicName(g.name) === normalizeArabicName(excelGroup));
                        // لو لقاها بياخد الاسم الأصلي النظيف بتاع السيستم، لو ملقاهاش بياخد اللي في الإكسيل
                        let finalGroup = matchedGroup ? matchedGroup.name : excelGroup;

                        students.push({ 
                            code: generateStudentCode(), 
                            name: name.toString().trim(), 
                            level: level.toString().trim(), 
                            group: finalGroup, 
                            phone: phone.toString().trim(), 
                            parentPhone: parentPhone.toString().trim(), 
                            gender: gender.toString().trim(), 
                            behaviorPoints: 0 
                        }); 
                        addedCount++; 
                    } else { 
                        errorCount++; 
                    }
                }
            });
            localStorage.setItem("students", JSON.stringify(students)); 
            renderTable(); 
            showToast(`تم استيراد ${addedCount} بنجاح، وتجاهل ${errorCount} مكرر.`);
            
            // رفع البيانات على السحابة أوتوماتيك بعد الاستيراد
            if (typeof syncDataToBot === "function") syncDataToBot();
            
        } catch(err) { 
            showToast("خطأ أثناء قراءة الملف!", "error"); 
        }
    };
    reader.readAsArrayBuffer(file); event.target.value = "";
}

// ==========================================
// 17. الرصد الصوتي (EduVoice)
// ==========================================
let isListening = false; let speechRecog = null;
function toggleVoiceRecognition(mode, inputId) {
    if (navigator.brave && navigator.brave.isBrave) return showToast("Brave يمنع الرصد الصوتي. استخدم Chrome", "error");
    const btn = document.getElementById(`voiceBtn_${mode}`); const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast("متصفحك لا يدعم الرصد الصوتي.", "error");
    if (isListening) { isListening = false; if(speechRecog) speechRecog.stop(); btn.classList.remove('pulse-mic'); btn.innerText = "🎙️ رصد بالصوت"; return; }
    
    speechRecog = new SpeechRecognition(); speechRecog.lang = 'ar-EG'; speechRecog.continuous = true;
    speechRecog.onstart = function() { isListening = true; btn.classList.add('pulse-mic'); btn.innerText = "يستمع الآن..."; };
    speechRecog.onresult = function(event) { const transcript = event.results[event.results.length - 1][0].transcript.trim(); processVoiceCommand(transcript, mode, inputId); };
    speechRecog.onerror = function(event) { isListening = false; btn.classList.remove('pulse-mic'); btn.innerText = "🎙️ رصد بالصوت"; };
    speechRecog.onend = function() { if (isListening) { try { speechRecog.start(); } catch(e) {} } else { btn.classList.remove('pulse-mic'); btn.innerText = "🎙️ رصد بالصوت"; } };
    try { speechRecog.start(); } catch(e) {}
}

function processVoiceCommand(text, mode, inputId) {
    let activeGroupId = mode === 'attendance' ? classSessions.find(s => s.id === currentActiveSessionId)?.group : (mode === 'exam' ? exams.find(e => e.id === currentActiveExamId)?.group : homeworks.find(h => h.id === currentActiveHwId)?.group);
    if(!activeGroupId) return;
    let matchedStudent = null;
    for(let st of students.filter(s => s.group === activeGroupId)) {
        const nameParts = normalizeArabicName(st.name).split(' ');
        if(nameParts.length >= 2 && normalizeArabicName(text).includes(nameParts[0]) && normalizeArabicName(text).includes(nameParts[nameParts.length-1])) { matchedStudent = st; break; } 
        else if(normalizeArabicName(text).includes(nameParts[0])) { matchedStudent = st; break; }
    }
    if(!matchedStudent) return showToast(`لم أتعرف على الطالب!`, "error");

    if(mode === 'attendance') {
        if(text.includes('غايب')) { markAttendance(matchedStudent.phone, 'absent'); showToast(`🎙️ غياب: ${matchedStudent.name}`); } 
        else { markAttendance(matchedStudent.phone, 'present'); showToast(`🎙️ حضور: ${matchedStudent.name}`); }
    } else {
        let gradeMatch = text.match(/\d+/); let finalGrade = gradeMatch ? gradeMatch[0] : null;
        if(finalGrade !== null) { document.getElementById(inputId).value = matchedStudent.code; if(mode === 'exam') { document.getElementById('examBarcodeGrade').value = finalGrade; submitExamBarcodeGrade(); } else { document.getElementById('hwBarcodeGrade').value = finalGrade; submitHwBarcodeGrade(); } }
    }
}

// ==========================================
// 18. الواتساب والإرسال الجماعي (الخلفية)
// ==========================================
function getRandomGreeting() { const greetings = ["أهلاً بحضرتك", "مرحباً بك", "السلام عليكم"]; return greetings[Math.floor(Math.random() * greetings.length)]; }

async function sendAutoWhatsApp(phone, message) {
    if (!phone || String(phone).trim() === "") return false;
    let fPhone = String(phone).trim(); if (fPhone.startsWith("0") && fPhone.length === 11) fPhone = "20" + fPhone.substring(1);
    try {
        let response = await fetch('http://localhost:3000/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: fPhone, message: message }) });
        return (await response.json()).success === true; 
    } catch(e) { return false; }
}

function toggleSessionStatus(id) { 
    const session = classSessions.find(s => s.id === id); 
    if(!session) return;
    if(session.status === 'open') { 
        document.getElementById('closeSessionId').value = id;
        document.getElementById('sendExamCheck').parentElement.style.display = exams.some(e => e.group === session.group && e.date === session.date) ? 'flex' : 'none';
        document.getElementById('sendHwCheck').parentElement.style.display = homeworks.some(h => h.group === session.group && h.date === session.date) ? 'flex' : 'none';
        openModal('closeSessionModal');
    } else {
        session.status = 'open'; localStorage.setItem("classSessions", JSON.stringify(classSessions)); renderSessionCards(); showToast("تم فتح الحصة");
    }
}

async function confirmCloseSession(sendMessages) {
    const session = classSessions.find(s => s.id === document.getElementById('closeSessionId').value); 
    if(!session) return;
    
    session.status = 'closed'; 
    localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
    renderSessionCards(); 
    closeModal('closeSessionModal');
    
    if(!sendMessages) return showToast("تم الإغلاق بدون إرسال.");
    
    showToast("جاري الإرسال للطالب وولي الأمر... لا تغلق الصفحة!"); 
    let successCount = 0;
    
    const sessionExam = exams.find(e => e.group === session.group && e.date === session.date);
    const sessionHw = homeworks.find(h => h.group === session.group && h.date === session.date);

    for (let st of students.filter(s => s.group === session.group)) {
        // تجميع بيانات التقرير المشتركة
        let reportData = ``;
        if(document.getElementById('sendAttCheck').checked) reportData += `📋 *الحضور:* ${session.attendance[st.phone] === 'present' ? 'حاضر ✅' : 'غائب ❌'}\n`;
        if(document.getElementById('sendExamCheck').checked && sessionExam) reportData += `📝 *الامتحان:* ${sessionExam.grades[st.phone] ? sessionExam.grades[st.phone] + ' / ' + sessionExam.maxScore + ' ⭐' : 'لم يمتحن ⚠️'}\n`;
        if(document.getElementById('sendHwCheck').checked && sessionHw) reportData += `📚 *الواجب:* ${sessionHw.grades[st.phone] ? sessionHw.grades[st.phone] + ' / ' + sessionHw.maxScore + ' 📚' : 'لم يسلم ⚠️'}\n`;
        
        let currentTeacherName = localStorage.getItem("teacherName");
        let sig = (currentTeacherName && currentTeacherName !== "null" && currentTeacherName.trim() !== "") ? `إدارة مستر ${currentTeacherName}` : "الإدارة";
        
        // 1. صيغة رسالة ولي الأمر (رسمية)
        let parentMsg = `📢 *تقرير حصة:* ${session.topic}\n${getRandomGreeting()} ولي الأمر المحترم،\nنحيط سيادتكم علماً بتقرير الطالب: *${st.name}*\n\n${reportData}\n${sig}`;
        
        // 2. صيغة رسالة الطالب (تشجيعية وحماسية)
        let studentMsg = `🎯 *تقرير حصة:* ${session.topic}\nأهلاً بيك يا بطل *${st.name}* 👑\nعاش جداً، ده تقرير حصتك النهاردة:\n\n${reportData}\nبالتوفيق يا بطل! 💪\n${sig}`;

        // إرسال لولي الأمر
        if (st.parentPhone && await sendAutoWhatsApp(st.parentPhone, parentMsg)) {
            successCount++;
        }
        
        // إرسال للطالب (لو رقمه مش نفس رقم ولي الأمر عشان ميزعجهمش برسالتين)
        if (st.phone && st.phone !== st.parentPhone && await sendAutoWhatsApp(st.phone, studentMsg)) {
            successCount++;
        }
    }
    showToast(`تم إرسال ${successCount} رسالة تقرير بنجاح! ✅`);
}

function updateBroadcastCount() { const target = document.getElementById('broadcastTarget').value; document.getElementById('targetCount').innerText = target === 'all' ? students.length : students.filter(s => s.group === target).length; }


// ==========================================
// 1. عرض ملف الطالب كاملاً بالجداول (تم الإصلاح)
// ==========================================
function openStudentProfile(code) {
    const student = students.find(s => s.code === code); if(!student) return;
    currentStudentProfileCode = code;
    document.getElementById("students-overview").style.display = "none"; document.getElementById("student-profile-view").style.display = "block";
    document.getElementById("profile-name").innerText = student.name; document.getElementById("profile-code-group").innerText = `${student.code} | المجموعة: ${student.group}`;
    if(document.getElementById("profile-phone")) document.getElementById("profile-phone").innerText = student.phone;
    if(document.getElementById("profile-parent")) document.getElementById("profile-parent").innerText = student.parentPhone;
    if(document.getElementById("profile-level")) document.getElementById("profile-level").innerText = student.level;
    if(document.getElementById("profile-gender")) document.getElementById("profile-gender").innerText = student.gender;
    document.getElementById("profile-behavior-points").innerText = student.behaviorPoints || 0; 

    // جلب ورسم جدول الغياب
    const groupSessions = classSessions.filter(s => s.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let attended = 0; const attTbody = document.getElementById("profile-attendance-list"); if(attTbody) attTbody.innerHTML = "";
    groupSessions.forEach(s => { const st = s.attendance[student.phone]; if(st === 'present') attended++; const badge = st === 'present' ? `<span style="color:var(--success-color);">حاضر ✓</span>` : st === 'absent' ? `<span style="color:var(--danger-color);">غائب ✗</span>` : `-`; if(attTbody) attTbody.innerHTML += `<tr><td>${s.date}</td><td>${badge}</td></tr>`; });
    document.getElementById("profile-attendance").innerText = `${groupSessions.length > 0 ? Math.round((attended / groupSessions.length) * 100) : 0}%`;

    // جلب ورسم جدول الامتحانات
    const groupExams = exams.filter(e => e.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let tExam = 0, sExam = 0; const exTbody = document.getElementById("profile-exams-list"); if(exTbody) exTbody.innerHTML = "";
    groupExams.forEach(e => { if(e.grades[student.phone]) { tExam += parseFloat(e.maxScore); sExam += parseFloat(e.grades[student.phone]); } if(exTbody) exTbody.innerHTML += `<tr><td>${e.name}</td><td>${e.date}</td><td><strong>${e.grades[student.phone] || '--'}</strong> / ${e.maxScore}</td></tr>`; });
    document.getElementById("profile-exams").innerText = `${tExam > 0 ? Math.round((sExam / tExam) * 100) : 0}%`;

    // جلب ورسم جدول الواجبات
    const groupHw = homeworks.filter(h => h.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let tHw = 0, sHw = 0; const hwTbody = document.getElementById("profile-hw-list"); if(hwTbody) hwTbody.innerHTML = "";
    groupHw.forEach(h => { if(h.grades[student.phone]) { tHw += parseFloat(h.maxScore); sHw += parseFloat(h.grades[student.phone]); } if(hwTbody) hwTbody.innerHTML += `<tr><td>${h.name}</td><td>${h.date}</td><td><strong>${h.grades[student.phone] || '--'}</strong> / ${h.maxScore}</td></tr>`; });
    document.getElementById("profile-hw").innerText = `${tHw > 0 ? Math.round((sHw / tHw) * 100) : 0}%`;
}


// ==========================================
// 2. نظام الإرسال الجماعي المطور (حظر الزر والأنيميشن)
// ==========================================
async function startBroadcast() {
    const btn = document.getElementById('startBroadcastBtn');
    const target = document.getElementById('broadcastTarget').value;
    const msg = document.getElementById('broadcastMessage').value.trim();
    const recipientType = document.querySelector('input[name="recipientType"]:checked').value; 

    if(!msg) return showToast("اكتب الرسالة أولاً!", "error");

    let validTasks = [];
    (target === 'all' ? students : students.filter(s => s.group === target)).forEach(st => {
        if ((recipientType === 'parent' || recipientType === 'both') && st.parentPhone) validTasks.push(st.parentPhone);
        if ((recipientType === 'student' || recipientType === 'both') && st.phone) validTasks.push(st.phone);
    });

    if(validTasks.length === 0) return showToast("لا توجد أرقام صالحة للإرسال!", "error");

    // قفل الزرار لمنع الضغط المزدوج
    btn.disabled = true;
    btn.innerText = "⏳ جاري الإرسال، لا تغلق الصفحة...";
    btn.style.opacity = "0.7";
    btn.style.cursor = "not-allowed";

    document.getElementById('broadcastProgressContainer').style.display = 'block'; 
    let sent = 0;
    let successCount = 0;
    
    for (let phoneNum of validTasks) {
        const finalMsg = `📢 *إعلان هام*\n${msg}`;
        let isOk = await sendAutoWhatsApp(phoneNum, finalMsg);
        if (isOk) successCount++;
        sent++;
        
        let percent = Math.round((sent / validTasks.length) * 100);
        document.getElementById('broadcastProgressBar').style.width = percent + '%';
        document.getElementById('broadcastProgressText').innerText = `تم إرسال ${sent} من ${validTasks.length} (نجح: ${successCount})`;
    }
    
    document.getElementById('broadcastProgressContainer').style.display = 'none';
    document.getElementById('broadcastMessage').value = '';
    
    // فتح الزرار مرة أخرى
    btn.disabled = false;
    btn.innerText = "بدء الحملة الإعلانية 🚀";
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
// 🔴 سطر السجل 
    if(typeof addSystemLog === "function" && successCount > 0) {
        addSystemLog("إرسال جماعي 📢", `تم إرسال إعلان بنجاح لعدد ${successCount} شخص. محتوى الرسالة: ${msg.substring(0, 20)}...`);
    }
    // تشغيل الأنيميشن
    showSuccessAnimation(successCount, validTasks.length);
}

function showSuccessAnimation(successCount, total) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(16, 185, 129, 0.95); z-index: 9999999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: 'Cairo', sans-serif; animation: fadeIn 0.3s ease-out; backdrop-filter: blur(5px);`;
    overlay.innerHTML = `<div style="font-size: 100px; animation: bounceIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;">🎉</div><h1 style="margin: 20px 0 10px 0; font-size: 45px;">اكتملت الحملة بنجاح!</h1><p style="font-size: 22px; background: rgba(0,0,0,0.2); padding: 12px 30px; border-radius: 50px;">تم إرسال <strong style="font-size:28px;">${successCount}</strong> من أصل ${total} رسالة</p>`;
    document.body.appendChild(overlay);

    if (!document.getElementById('success-anim-styles')) {
        const style = document.createElement('style'); style.id = 'success-anim-styles';
        style.innerHTML = `@keyframes bounceIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`;
        document.head.appendChild(style);
    }
    setTimeout(() => { overlay.style.transition = 'opacity 0.5s'; overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 500); }, 4000);
}


// ==========================================
// إدارة الكتب والسناتر 📚
// ==========================================
function renderBooksTable() {
    const tbody = document.getElementById("books-list");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    // جلب كلمة البحث (لو موجودة)
    const searchInput = document.getElementById("searchBooksInput");
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";

    let totalExpected = 0, totalReceived = 0, totalRemaining = 0;

    books.forEach(book => {
        // فلترة البيانات بناءً على البحث
        const searchString = (book.bookName + " " + book.centerName).toLowerCase();
        if (filterText && !searchString.includes(filterText)) return; // لو مش مطابق للبحث، اتخطاه ومتحسبوش

        // حسابات الفلوس
        let commission = book.commissionType === 'percentage' ? (book.price * book.commissionValue / 100) : book.commissionValue;
        let netPrice = book.price - commission;
        let expected = netPrice * book.quantity;
        let received = book.receivedAmount || 0;
        let remaining = expected - received;

        totalExpected += expected; totalReceived += received; totalRemaining += remaining;

        let commText = book.commissionType === 'percentage' ? `${book.commissionValue}%` : `${book.commissionValue} ج`;
        let remainingStyle = remaining === 0 ? `color: var(--success-color); font-weight: bold;` : (remaining < 0 ? `color: var(--primary-color);` : `color: var(--danger-color); font-weight: bold;`);

        tbody.innerHTML += `
            <tr>
                <td><strong>${book.bookName}</strong></td>
                <td><span style="color: #0ea5e9; font-weight: bold;">${book.centerName}</span></td>
                <td>${book.quantity}</td>
                <td>${book.price} ج</td>
                <td>${commText}</td>
                <td>${expected} ج</td>
                <td style="color: var(--success-color); font-weight: bold;">${received} ج</td>
                <td style="${remainingStyle}">${remaining} ج</td>
                <td>
                    <button class="btn-present" style="background-color: var(--success-color);" onclick="openReceivePaymentModal('${book.id}')">استلام 💰</button>
                    <button class="icon-btn admin-only" style="margin-right: 5px;" onclick="openEditBookModal('${book.id}')">✏️</button>
                    <button class="icon-btn danger admin-only" onclick="deleteBookRecord('${book.id}')">🗑️</button>
                </td>
            </tr>
        `;
    });

    if (document.getElementById("books-total-expected")) {
        document.getElementById("books-total-expected").innerText = totalExpected + " ج.م";
        document.getElementById("books-total-received").innerText = totalReceived + " ج.م";
        document.getElementById("books-total-remaining").innerText = totalRemaining + " ج.م";
    }
}

// دالة تشغيل البحث
function searchBooks() {
    renderBooksTable();
}
document.getElementById("addBookForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    books.push({
        id: Date.now().toString() + "_b",
        bookName: document.getElementById("bookNameInput").value.trim(),
        centerName: document.getElementById("bookCenterInput").value.trim(),
        quantity: parseFloat(document.getElementById("bookQuantityInput").value),
        price: parseFloat(document.getElementById("bookPriceInput").value),
        commissionValue: parseFloat(document.getElementById("bookCommissionValue").value),
        commissionType: document.getElementById("bookCommissionType").value,
        receivedAmount: 0
    });
    localStorage.setItem("books", JSON.stringify(books));
    closeModal('addBookModal'); this.reset(); renderBooksTable(); showToast("تم تسجيل عهدة الكتب بنجاح!");
});

function openReceivePaymentModal(id) {
    document.getElementById("receiveBookId").value = id;
    document.getElementById("receiveBookAmount").value = "";
    openModal("receiveBookPaymentModal");
}

document.getElementById("receiveBookPaymentForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    const id = document.getElementById("receiveBookId").value;
    const amount = parseFloat(document.getElementById("receiveBookAmount").value);
    const book = books.find(b => b.id === id);
    if (book) {
        book.receivedAmount += amount;
        localStorage.setItem("books", JSON.stringify(books));
        
        // 🔴 سطر السجل 
        if(typeof addSystemLog === "function") addSystemLog("استلام نقدية 💰", `تم استلام مبلغ ${amount} ج.م من سنتر ${book.centerName} عن كتاب: ${book.bookName}`);

        closeModal("receiveBookPaymentModal"); renderBooksTable(); showToast(`تم استلام ${amount} ج.م بنجاح!`);
    }
});

function deleteBookRecord(id) {
    customConfirm("حذف سجل الكتب هذا نهائياً؟", () => {
        books = books.filter(b => b.id !== id);
        localStorage.setItem("books", JSON.stringify(books)); renderBooksTable(); showToast("تم الحذف!");
    });
}


// فتح نافذة تعديل الكتب
function openEditBookModal(id) {
    const book = books.find(b => b.id === id);
    if(book) {
        document.getElementById('editBookId').value = book.id;
        document.getElementById('editBookName').value = book.bookName;
        document.getElementById('editBookCenter').value = book.centerName;
        document.getElementById('editBookQuantity').value = book.quantity;
        document.getElementById('editBookPrice').value = book.price;
        document.getElementById('editBookCommissionValue').value = book.commissionValue;
        document.getElementById('editBookCommissionType').value = book.commissionType;
        openModal('editBookModal');
    }
}

// حفظ التعديلات
document.getElementById('editBookForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('editBookId').value;
    const bookIndex = books.findIndex(b => b.id === id);
    
    if(bookIndex > -1) {
        books[bookIndex].bookName = document.getElementById('editBookName').value.trim();
        books[bookIndex].centerName = document.getElementById('editBookCenter').value.trim();
        books[bookIndex].quantity = parseFloat(document.getElementById('editBookQuantity').value);
        books[bookIndex].price = parseFloat(document.getElementById('editBookPrice').value);
        books[bookIndex].commissionValue = parseFloat(document.getElementById('editBookCommissionValue').value);
        books[bookIndex].commissionType = document.getElementById('editBookCommissionType').value;
        
        // إعادة حساب الفلوس المستلمة لو حصل تغيير جذري (اختياري، بس هنا بنسيب المستلم زي ما هو)
        localStorage.setItem("books", JSON.stringify(books));
        closeModal('editBookModal');
        renderBooksTable();
        showToast("تم تعديل بيانات العهدة بنجاح! ✏️");
    }
});



// فحص حالة السيرفر لعرض الـ QR Code في الإعدادات
if (!document.getElementById('qrScript')) {
    let script = document.createElement('script');
    script.id = 'qrScript';
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    document.head.appendChild(script);
}

setInterval(async () => {
    const nodeStatus = document.getElementById("nodeStatus");
    const waStatus = document.getElementById("waStatus");
    const qrContainer = document.getElementById("qrContainer");
    const qrImage = document.getElementById("qrImage");

    if(!nodeStatus) return;

    try {
        const response = await fetch('http://localhost:3000/status');
        const data = await response.json();
        
        nodeStatus.innerHTML = '<span class="status-online">● يعمل (Online)</span>';
        
        if (data.status === 'connected') {
            waStatus.innerHTML = '<span class="status-online">متصل ✅</span>';
            if(qrContainer) qrContainer.style.display = "none";
        } else if (data.status === 'need_scan') {
            waStatus.innerHTML = '<span class="status-offline">بانتظار المسح 📱</span>';
            if(qrContainer) {
                qrContainer.style.display = "block";
                const qrResp = await fetch('http://localhost:3000/qr');
                const qrData = await qrResp.json();
                if (qrData.qr) {
                    qrImage.innerHTML = "";
                    new QRCode(qrImage, { text: qrData.qr, width: 200, height: 200 });
                }
            }
        } else {
            waStatus.innerHTML = 'جاري التهيئة...';
        }
    } catch (e) {
        nodeStatus.innerHTML = '<span class="status-offline">● متوقف (Offline)</span>';
        waStatus.innerHTML = '---';
        if(qrContainer) qrContainer.style.display = "none";
    }
}, 5000);


// ==========================================
// 🚀 تسريع الرصد (الانتقال بزر Enter مع التحقق)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. قسم الامتحانات ---
    document.getElementById('examBarcodeCode')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            let val = this.value.trim();
            if (val === "") return;
            
            let student = findStudentByCodeOrName(val);
            const ex = exams.find(e => e.id === currentActiveExamId);
            
            // التحقق من وجود الطالب
            if (!student) {
                showToast("الطالب غير موجود!", "error");
                this.value = ''; // تفريغ الخانة
                return;
            }
            // التحقق من إن الطالب في نفس المجموعة
            if (ex && student.group !== ex.group) {
                showToast("الطالب ليس في هذه المجموعة!", "error");
                this.value = ''; // تفريغ الخانة
                return;
            }
            
            // لو الطالب سليم 100%، انط لخانة الدرجة
            document.getElementById('examBarcodeGrade')?.focus();
        }
    });

    document.getElementById('examBarcodeGrade')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if(typeof submitExamBarcodeGrade === 'function') submitExamBarcodeGrade();
        }
    });

    // --- 2. قسم الواجبات ---
    document.getElementById('hwBarcodeCode')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            let val = this.value.trim();
            if (val === "") return;
            
            let student = findStudentByCodeOrName(val);
            const hw = homeworks.find(h => h.id === currentActiveHwId);
            
            // التحقق من وجود الطالب
            if (!student) {
                showToast("الطالب غير موجود!", "error");
                this.value = ''; // تفريغ الخانة
                return;
            }
            // التحقق من إن الطالب في نفس المجموعة
            if (hw && student.group !== hw.group) {
                showToast("الطالب ليس في هذه المجموعة!", "error");
                this.value = ''; // تفريغ الخانة
                return;
            }

            // لو الطالب سليم 100%، انط لخانة الدرجة
            document.getElementById('hwBarcodeGrade')?.focus();
        }
    });

    document.getElementById('hwBarcodeGrade')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if(typeof submitHwBarcodeGrade === 'function') submitHwBarcodeGrade();
        }
    });

});


// ==========================================
// 🔗 توليد ونسخ رابط بوابة أولياء الأمور
// ==========================================
function updateParentLinkUI() {
    const linkInput = document.getElementById("parentPortalLink");
    const currentKey = localStorage.getItem("licenseKey");
    if (linkInput && currentKey) {
        linkInput.value = `https://system-edutrack.netlify.app/parent.html?id=${currentKey}`;
    }
}

function copyParentLink() {
    const linkInput = document.getElementById("parentPortalLink");
    if (!linkInput || !linkInput.value) return;
    
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value).then(() => {
        showToast("تم نسخ الرابط بنجاح! تقدر تبعته دلوقتي 🚀", "success");
    }).catch(err => {
        showToast("فشل النسخ، يرجى نسخه يدوياً", "error");
    });
}

// ==========================================
// 🛠️ أدوات لوحة الإدارة وتنظيف البيانات المؤمنة
// ==========================================
function manageClearAction(type) {
    // نافذة تأكيد وطلب الرقم السري كأمان لمنع الأخطاء غير المقصودة
    const enteredPin = prompt("⚠️ تنبيه أمني حساس!\nهذه العملية ستؤدي لحذف البيانات نهائياً.\nالرجاء إدخال الرقم السري للإدارة (Admin PIN) لتأكيد الحذف:");
    
    if (enteredPin === null) return; // تم إلغاء الأمر من المستخدم
    
    const currentAdminPin = localStorage.getItem("adminPin") || "1234";
    if (enteredPin !== currentAdminPin) {
        showToast("الرقم السري للإدارة غير صحيح! تم كنسل العملية.", "error");
        return;
    }

    if (type === 'students') {
        students = [];
        localStorage.setItem("students", JSON.stringify(students));
        renderTable();
        showToast("تم حذف سجلات جميع الطلاب بنجاح 🗑️");
    } 
    else if (type === 'groups') {
        groups = [];
        localStorage.setItem("groups", JSON.stringify(groups));
        // تفريغ حقل المجموعة من الطلاب لمنع تعليق النظام
        students.forEach(s => s.group = "");
        localStorage.setItem("students", JSON.stringify(students));
        renderTable();
        if (typeof renderGroupCards === "function") renderGroupCards();
        showToast("تم مسح المجموعات وتفريغ الطلاب التابعين لها 🗑️");
    } 
    else if (type === 'level') {
        const levelVal = document.getElementById("clearLevelSelect").value;
        if (!levelVal) {
            showToast("الرجاء اختيار المرحلة المراد مسحها أولاً!", "error");
            return;
        }
        students = students.filter(s => s.level !== levelVal);
        localStorage.setItem("students", JSON.stringify(students));
        renderTable();
        showToast(`تم مسح جميع طلاب مرحلة [${levelVal}] بنجاح 🗑️`);
    } 
    else if (type === 'behavior') {
        students.forEach(s => s.behaviorPoints = 0);
        localStorage.setItem("students", JSON.stringify(students));
        renderTable();
        showToast("تم تصفير نقاط السلوك والتميز لجميع الطلاب 🌟");
    } 
    else if (type === 'all') {
        // تدمير شامل وعودة لضبط المصنع
        students = [];
        groups = [];
        classSessions = [];
        exams = [];
        homeworks = [];
        financeRecords = {};
        expenses = [];
        schedule = [];
        books = [];
        
        localStorage.setItem("students", JSON.stringify(students));
        localStorage.setItem("groups", JSON.stringify(groups));
        localStorage.setItem("classSessions", JSON.stringify(classSessions));
        localStorage.setItem("exams", JSON.stringify(exams));
        localStorage.setItem("homeworks", JSON.stringify(homeworks));
        localStorage.setItem("financeRecords", JSON.stringify(financeRecords));
        localStorage.setItem("expenses", JSON.stringify(expenses));
        localStorage.setItem("schedule", JSON.stringify(schedule));
        localStorage.setItem("books", JSON.stringify(books));
        
        // إعادة بناء الواجهات كلها على بياض
        renderTable();
        if (typeof renderGroupCards === "function") renderGroupCards();
        if (typeof renderSchedule === "function") renderSchedule();
        if (typeof renderBooksTable === "function") renderBooksTable();
        if (typeof renderSessionCards === "function") renderSessionCards();
        if (typeof renderExamCards === "function") renderExamCards();
        if (typeof renderHwCards === "function") renderHwCards();
        
        showToast("💥 تم تنفيذ تصفير شامل بنجاح (عودة لضبط المصنع الأصلي)");
    }

    // 🔄 رفع البيانات وحذفها من السحابة فوراً لتتطابق مع قاعدة البيانات المحلية
    if (typeof syncDataToBot === "function") syncDataToBot();
}

// ==========================================
// 🚀 إرسال وحفظ بيانات عميل الديمو
// ==========================================
document.getElementById('demoRegistrationForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('demoTeacherName').value.trim();
    const phone = document.getElementById('demoTeacherPhone').value.trim();

    if (!isValidEgyptianPhone(phone)) {
        showToast("يرجى إدخال رقم واتساب مصري صحيح!", "error"); return;
    }

    let now = new Date().getTime();
    let demoId = "device_" + Date.now(); // 🔒 توليد معرف فريد للجهاز
    
    // حفظ البيانات محلياً
    localStorage.setItem("demo_registered", "true");
    localStorage.setItem("demo_start_date", now);
    localStorage.setItem("is_demo_mode", "true");
    localStorage.setItem("teacherName", name);
    localStorage.setItem("demo_device_id", demoId); // حفظ البصمة

    // رفع بيانات العميل للوحة الإدارة (الفايربيز) بالحالة نشط
    fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/demo_users/${demoId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            teacherName: name,
            whatsapp: phone,
            timestamp: new Date().toISOString(), 
            startDate: now,
            status: 'active' // 👈 الحالة الافتراضية
        })
    });

    document.getElementById('demoRegistrationModal').style.display = 'none';
    showToast(`أهلاً بك يا مستر ${name}! بدأت تجربتك المجانية ⏳`);
    setTimeout(() => { location.reload(); }, 1000);
});


// ==========================================
// 💳 إرسال وحفظ طلبات كروت الـ ID البلاستيكية
// ==========================================
document.getElementById('requestIdCardsForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const teacherName = document.getElementById('idCardTeacherName').value.trim();
    const phone = document.getElementById('idCardTeacherPhone').value.trim();
    const address = document.getElementById('idCardAddress').value.trim();
    const fromCode = document.getElementById('idCardFrom').value;
    const toCode = document.getElementById('idCardTo').value;
    
    if (!isValidEgyptianPhone(phone)) {
        showToast("يرجى إدخال رقم واتساب مصري صحيح!", "error"); return;
    }

    // رفع الطلب لقاعدة بيانات الإدارة العليا (dashb.html)
    fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/id_orders/${Date.now()}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            teacherName: teacherName,
            phone: phone,
            address: address,
            fromCode: fromCode,
            toCode: toCode,
            timestamp: new Date().toISOString()
        })
    });

    closeModal('requestIdCardsModal');
    this.reset();
    
    // إشعار التأكيد الداخلي
    showToast("تم إتمام الطلب وسيتم التواصل معك قريبا لاستلام الشحنه 🚚");
});

// ==========================================
// 💸 نظام الإحالات المتكامل (Stats & Checkout)
// ==========================================

const DB_URL = "https://edutrack-system-1ded4-default-rtdb.firebaseio.com";
window.availableAffiliateBalance = 0; // متغير جلوبال لتخزين الرصيد المتاح للسحب

// 1. توليد كود إحالة عشوائي وفريد ومستحيل يتكرر
function getMyAffiliateCode() {
    let savedPromo = localStorage.getItem("my_promo_code");
    if (savedPromo) return savedPromo; // لو ليه كود قبل كده هيفضل ثابت معاه

    // لو معندوش، هنولد كود عشوائي من 8 حروف وأرقام
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 8; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    let uniqueCode = "REF-" + randomPart;
    localStorage.setItem("my_promo_code", uniqueCode); // حفظه في جهازه
    
    return uniqueCode;
}

// 2. تحديث الشاشة وجلب الإحصائيات الحقيقية من الفايربيز (محمية ومربوطة بتأكيد الإدارة)
async function fetchAffiliateStats() {
    const myCode = getMyAffiliateCode();
    
    try {
        let [ordRes, wdRes] = await Promise.all([
            fetch(`${DB_URL}/orders.json`),
            fetch(`${DB_URL}/withdraw_requests.json`)
        ]);

        let orders = await ordRes.json() || {};
        let withdraws = await wdRes.json() || {};

        let confirmedEarned = 0; // العمولات المؤكدة (العميل دفع والإدارة أكدت)
        let pendingEarned = 0;   // العمولات المعلقة (العميل سجل ولسه مدفعش)
        let purchasesCount = 0;  // عدد عمليات الشراء الناجحة
        
        let tbody = document.getElementById("affiliate-transactions");
        if(tbody) tbody.innerHTML = "";

        Object.keys(orders).reverse().forEach(key => {
            let o = orders[key];
            
            // لو الكود المستخدم هو كود المدرس ده
            if (o.promoCodeUsed === myCode) {
                let comm = parseFloat(o.commissionForAffiliate) || 0;
                let date = new Date(o.timestamp).toLocaleDateString('ar-EG');
                let maskedName = o.teacherName.substring(0, 3) + "***"; // تشفير الاسم
                
                // لو الإدارة أكدت الدفع (مؤكدة ✅)
                if (o.status && o.status.includes('تم')) {
                    confirmedEarned += comm;
                    purchasesCount++;
                    if(tbody) tbody.innerHTML += `<tr><td>${date}</td><td>${maskedName}</td><td>${o.plan}</td><td><span class="badge" style="background: rgba(16, 185, 129, 0.1); color:var(--success); font-weight:bold;">مؤكدة ✅</span></td><td style="color:var(--success); font-weight:bold;">${comm} ج</td></tr>`;
                } 
                // لو لسه قيد الانتظار (معلقة ⏳)
                else {
                    pendingEarned += comm;
                    if(tbody) tbody.innerHTML += `<tr><td>${date}</td><td>${maskedName}</td><td>${o.plan}</td><td><span class="badge" style="background: rgba(245, 158, 11, 0.1); color:#f59e0b; font-weight:bold;">منتظرة دفع العميل ⏳</span></td><td style="color:#f59e0b; font-weight:bold;">${comm} ج</td></tr>`;
                }
            }
        });

        if (tbody && tbody.innerHTML === "") {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا توجد إحالات حتى الآن. شارك كودك للبدء!</td></tr>`;
        }

        // حساب المسحوبات (اللي المدرس سحبها أو طلب سحبها)
        let totalWithdrawnPaid = 0;
        let totalWithdrawnPending = 0;

        Object.keys(withdraws).forEach(key => {
            let w = withdraws[key];
            if (w.promoCode === myCode) {
                if (w.status === 'paid') totalWithdrawnPaid += parseFloat(w.amount);
                else totalWithdrawnPending += parseFloat(w.amount);
            }
        });

        // 🛑 السحر هنا: الرصيد المتاح للسحب بيتحسب من (العمولات المؤكدة فقط) ناقص المسحوبات
        window.availableAffiliateBalance = confirmedEarned - (totalWithdrawnPaid + totalWithdrawnPending);

        // تحديث المربعات الملونة في الشاشة
        if(document.getElementById("affPending")) document.getElementById("affPending").innerText = `${pendingEarned} ج`;
        if(document.getElementById("affReceived")) document.getElementById("affReceived").innerText = `${totalWithdrawnPaid} ج`;
       if(document.getElementById("affAvailable")) document.getElementById("affAvailable").innerText = `${window.availableAffiliateBalance} ج`;
        if(document.getElementById("affPurchases")) document.getElementById("affPurchases").innerText = purchasesCount;

    } catch (e) {
        console.log("Error fetching stats:", e);
    }
}

// 3. دالة تهيئة صفحة الإحالة عند فتحها
function initAffiliatePage() {
    document.getElementById("myAffiliateCode").value = getMyAffiliateCode();
    
    let savedSettings = JSON.parse(localStorage.getItem("affiliateSettings"));
    if (savedSettings) {
        document.getElementById("withdrawMethod").value = savedSettings.method;
        document.getElementById("withdrawNumber").value = savedSettings.number;
    }
    
    // تشغيل جلب الداتا لايف
    fetchAffiliateStats();
}

function copyAffiliateCode() {
    const codeInput = document.getElementById("myAffiliateCode");
    codeInput.select();
    navigator.clipboard.writeText(codeInput.value).then(() => {
        showToast("تم نسخ كود الإحالة بنجاح! 📋");
    });
}

function saveAffiliateSettings() {
    const method = document.getElementById("withdrawMethod").value;
    const number = document.getElementById("withdrawNumber").value;
    
    if (method !== 'free_month' && !number) {
        return showToast("يرجى إدخال رقم الحساب للسحب!", "error");
    }

    localStorage.setItem("affiliateSettings", JSON.stringify({ method, number }));
    showToast("تم حفظ إعدادات السحب بنجاح ✅");
}


// 4. طلب السحب المحكوم بالرصيد المتاح
window.requestAffiliateWithdrawal = async function() {
    let savedSettings = JSON.parse(localStorage.getItem("affiliateSettings"));
    if (!savedSettings || (!savedSettings.number && savedSettings.method !== 'free_month')) {
        return showToast("يجب حفظ إعدادات السحب (رقم المحفظة) أولاً!", "error");
    }

    if (window.availableAffiliateBalance < 150) {
        return showToast("عفواً، رصيدك المتاح أقل من الحد الأدنى للسحب (150 ج.م).", "error");
    }

    // إظهار الرصيد المتاح وسؤاله هيسحب كام
    let amountToWithdraw = prompt(`رصيدك المتاح للسحب هو ${window.availableAffiliateBalance} ج.م\nأدخل المبلغ المراد سحبه:`, window.availableAffiliateBalance);
    
    if (!amountToWithdraw) return; // لو داس كنسل

    amountToWithdraw = parseFloat(amountToWithdraw);

    if (isNaN(amountToWithdraw) || amountToWithdraw < 150) {
        return showToast("المبلغ غير صالح أو أقل من الحد الأدنى!", "error");
    }

    // الفلترة الذكية (لو طلب أكتر من اللي حيلته)
    if (amountToWithdraw > window.availableAffiliateBalance) {
        return showToast(`رصيدك المتاح لا يكفي! أقصى مبلغ يمكنك سحبه هو ${window.availableAffiliateBalance} ج.م`, "error");
    }

    const requestData = {
        promoCode: getMyAffiliateCode(),
        method: savedSettings.method,
        number: savedSettings.number,
        amount: amountToWithdraw,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    try {
        await fetch(`${DB_URL}/withdraw_requests.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        showToast("تم إرسال طلب السحب للإدارة بنجاح! 💸");
        
        // خصم المبلغ وهمياً من الشاشة لتجنب طلب السحب مرتين ورا بعض
        window.availableAffiliateBalance -= amountToWithdraw;
        document.getElementById("affPending").innerText = `${window.availableAffiliateBalance} ج`;

    } catch (e) {
        showToast("حدث خطأ أثناء الإرسال", "error");
    }
};

// 🛒 دوال الـ Checkout زي ما هي شغالة مفيش تغيير فيها
const PRICING = {
    lifetime: { base: 2500, discount: 500 },
    monthly: { base: 350, discount: 100 }
};

let currentPromoApplied = false;

function calculateCheckout() {
    const plan = document.getElementById("checkoutPlan").value;
    const basePrice = PRICING[plan].base;
    let discount = 0;

    if (currentPromoApplied) discount = PRICING[plan].discount;
    const finalPrice = basePrice - discount;

    document.getElementById("checkoutBasePrice").innerText = `${basePrice} ج.م`;
    document.getElementById("checkoutDiscount").innerText = `${discount} ج.م`;
    document.getElementById("checkoutFinalPrice").innerText = `${finalPrice} ج.م`;
}

function applyPromoCode() {
    const code = document.getElementById("promoCodeInput").value.trim().toUpperCase();
    const msgLabel = document.getElementById("promoMsg");
    const plan = document.getElementById("checkoutPlan").value;

    if (code.startsWith("REF-") && code.length >= 8) {
        if (code === getMyAffiliateCode()) {
            currentPromoApplied = false;
            msgLabel.style.color = "var(--danger-color)";
            msgLabel.innerText = "❌ لا يمكنك استخدام كود الإحالة الخاص بك!";
            calculateCheckout();
            return;
        }

        currentPromoApplied = true;
        let discountVal = PRICING[plan].discount;
        msgLabel.style.color = "var(--success-color)";
        
        if (plan === 'monthly') {
            msgLabel.innerText = `✅ كود صحيح! تم خصم ${discountVal}ج من اشتراك الشهر الأول.`;
        } else {
            msgLabel.innerText = `✅ كود صحيح! تم خصم ${discountVal}ج على اشتراك مدى الحياة.`;
        }
    } else {
        currentPromoApplied = false;
        msgLabel.style.color = "var(--danger-color)";
        msgLabel.innerText = "❌ الكود غير صحيح أو منتهي الصلاحية.";
    }
    
    calculateCheckout();
}

function openCheckout() {
    currentPromoApplied = false;
    document.getElementById("promoCodeInput").value = "";
    document.getElementById("promoMsg").innerText = "";
    calculateCheckout();
    openModal('checkoutModal');
}

// رسم كروت الواجبات (بزرار التعديل الجديد)
function renderHwCards() { 
    const grid = document.getElementById("hw-grid"); if(!grid) return; grid.innerHTML = ""; 
    [...homeworks].reverse().forEach(hw => { 
        const isClosed = hw.status === 'closed'; 
        grid.innerHTML += `
        <div class="session-card hw-card">
            <div class="session-header-card">
                <div><div class="hw-group-name">${hw.name}</div><div class="session-date">${hw.group} | ${hw.date}</div></div>
                <span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed?'مغلق':'مفتوح'}</span>
            </div>
            <div class="session-actions">
                <button class="enter-btn enter-hw-btn" onclick="openHwDetails('${hw.id}')" ${isClosed?'disabled':''}>تقييم</button>
                <button class="icon-btn admin-only" style="background-color: #ffffff; color: black;" onclick="openEditHwModal('${hw.id}')" title="تعديل">✏️ تعديل</button>
                <button class="icon-btn danger admin-only" onclick="deleteHw('${hw.id}')">🗑️</button>
            </div>
        </div>`; 
    }); 
}

// رسم كروت الامتحانات (بزرار التعديل الجديد)
function renderExamCards() { 
    const grid = document.getElementById("exams-grid"); if(!grid) return; grid.innerHTML = ""; 
    [...exams].reverse().forEach(exam => { 
        const isClosed = exam.status === 'closed'; 
        grid.innerHTML += `
        <div class="session-card exam-card">
            <div class="session-header-card">
                <div><div class="exam-group-name">${exam.name}</div><div class="session-date">${exam.group} | ${exam.date}</div></div>
                <span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed?'مغلق':'مفتوح'}</span>
            </div>
            <div class="session-actions">
                <button class="enter-btn enter-exam-btn" onclick="openExamDetails('${exam.id}')" ${isClosed?'disabled':''}>رصد</button>
                <button class="icon-btn admin-only" style="background-color: #ffffff; color: black;" onclick="openEditExamModal('${exam.id}')" title="تعديل">✏️ تعديل</button>
                <button class="icon-btn danger admin-only" onclick="deleteExam('${exam.id}')">🗑️</button>
            </div>
        </div>`; 
    }); 
}



// ==========================================
// 🌟 1. إدارة بيانات الحساب والسيرفر (الاسم، اليوزر، الباسورد)
// ==========================================
window.saveAccountSettings = function() {
    const tName = document.getElementById('settingTeacherName').value.trim();
    const cName = document.getElementById('settingCenterName').value.trim();
    const aUser = document.getElementById('settingAdminUser').value.trim();
    const aPass = document.getElementById('settingAdminPass').value.trim();
    const aPin = document.getElementById('settingAdminPin').value.trim();

    if (!tName || !aUser || !aPass || !aPin) {
        return showToast("يرجى ملء جميع البيانات الأساسية (الاسم، اليوزر، الباسورد، والـ PIN)!", "error");
    }

    localStorage.setItem('teacherName', tName);
    localStorage.setItem('centerName', cName);
    localStorage.setItem('adminUser', aUser);
    localStorage.setItem('adminPass', aPass);
    localStorage.setItem('adminPin', aPin);
    
    window.adminPin = aPin; // تحديث الـ PIN في السيستم حالاً
    
    // تحديث رسالة الترحيب فوق
    const titleElement = document.getElementById('page-title');
    if (titleElement && titleElement.innerText.includes('أهلاً بك')) {
        titleElement.innerText = `أهلاً بك مستر ${tName} 👋`;
    }
    
    showToast("تم تحديث بيانات الحساب وكلمة المرور بنجاح! 💾");
    if (typeof syncDataToBot === "function") syncDataToBot(); // المزامنة مع السحابة
};


// ==========================================
// 🌟 2. تخصيص المراحل الدراسية (القائمة المنسدلة الذكية)
// ==========================================
const ALL_LEVELS = [
    "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
    "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
    "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
    "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"
];

let safeLevels = ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"];
try {
    let stored = JSON.parse(localStorage.getItem("activeLevels"));
    if (Array.isArray(stored) && stored.length > 0) safeLevels = stored;
} catch(e) {}
window.activeLevels = safeLevels;

window.renderAdminLevels = function() {
    const dropdown = document.getElementById("levelsDropdown");
    const tagsContainer = document.getElementById("selectedLevelsTags");
    if(!dropdown || !tagsContainer) return;

    let dropdownHTML = "";
    ALL_LEVELS.forEach(level => {
        let isChecked = (Array.isArray(window.activeLevels) && window.activeLevels.includes(level)) ? "checked" : "";
        dropdownHTML += `
            <label class="level-item" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--hover-bg); border-radius: 6px; cursor: pointer; transition: 0.2s; color: var(--text-main); font-weight: bold; margin-bottom: 3px; border-bottom: 1px solid var(--border-color);">
                <input type="checkbox" value="${level}" class="level-checkbox" ${isChecked} onchange="updateActiveLevels()" style="width: 18px; height: 18px; accent-color: var(--primary-color); cursor: pointer;">
                <span style="flex: 1;">${level}</span>
            </label>`;
    });
    dropdown.innerHTML = dropdownHTML;

    let tagsHTML = "";
    if(Array.isArray(window.activeLevels)) {
        window.activeLevels.forEach(level => {
            tagsHTML += `<span class="tag" style="background: var(--primary-color); color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">🎓 ${level}</span>`;
        });
    }
    tagsContainer.innerHTML = tagsHTML;
};

window.updateActiveLevels = function() {
    const checkboxes = document.querySelectorAll(".level-checkbox:checked");
    let selected = Array.from(checkboxes).map(cb => cb.value);

    if(selected.length === 0) {
        showToast("يجب اختيار مرحلة دراسية واحدة على الأقل!", "error");
        selected = ["الصف الأول الثانوي"];
        setTimeout(renderAdminLevels, 50); 
    } else {
        window.activeLevels = selected;
        const tagsContainer = document.getElementById("selectedLevelsTags");
        if(tagsContainer) {
            let tagsHTML = "";
            window.activeLevels.forEach(level => {
                tagsHTML += `<span class="tag" style="background: var(--primary-color); color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">🎓 ${level}</span>`;
            });
            tagsContainer.innerHTML = tagsHTML;
        }
    }
    localStorage.setItem("activeLevels", JSON.stringify(window.activeLevels));
    if (typeof populateLevelDropdowns === "function") populateLevelDropdowns();
    if (typeof syncDataToBot === "function") syncDataToBot();
};

window.populateLevelDropdowns = function() {
    const levelSelectIds = [
        "studentLevel", "editStudentLevel", "sessionLevelSelect", "hwLevelSelect", 
        "examLevelSelect", "financeLevelSelect", "leaderboardLevel", "schedLevel", 
        "newGroupLevel", "editGroupLevel", "clearLevelSelect"
    ];
    
    levelSelectIds.forEach(id => {
        const select = document.getElementById(id);
        if(select) {
            const firstOption = select.options[0]?.text.includes("اختر") ? select.options[0].outerHTML : '<option value="">اختر المرحلة...</option>';
            let selectHTML = firstOption;
            if(Array.isArray(window.activeLevels)){
                window.activeLevels.forEach(level => { selectHTML += `<option value="${level}">${level}</option>`; });
            }
            select.innerHTML = selectHTML;
        }
    });
};

// قفل القائمة لو المدرس ضغط في أي مكان بره الصندوق
document.addEventListener('click', function(e) {
    const container = document.querySelector('.multi-select-container');
    const dropdown = document.getElementById('levelsDropdown');
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});


// ==========================================
// 🌟 3. تشغيل الأكواد تلقائياً وربطها بلوحة الإدارة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof renderAdminLevels === "function") renderAdminLevels();
        if (typeof populateLevelDropdowns === "function") populateLevelDropdowns();
    }, 500);
});

const originalSwitchPage = window.switchPage;
window.switchPage = function(pageId) {
    if (originalSwitchPage) originalSwitchPage(pageId);
    
    if (pageId === "backup") { 
        // 1. ارسم المراحل
        if (typeof renderAdminLevels === "function") renderAdminLevels();
        
        // 2. املأ بيانات المدرس في الخانات أول ما يفتح التاب
        if(document.getElementById('settingTeacherName')) {
            document.getElementById('settingTeacherName').value = localStorage.getItem('teacherName') || '';
            document.getElementById('settingCenterName').value = localStorage.getItem('centerName') || '';
            document.getElementById('settingAdminUser').value = localStorage.getItem('adminUser') || '';
            document.getElementById('settingAdminPass').value = localStorage.getItem('adminPass') || '';
            document.getElementById('settingAdminPin').value = localStorage.getItem('adminPin') || '';
        }
    }
};


// ==========================================
// 🕵️‍♂️ 1. نظام السجل والمراقبة (Audit Trail)
// ==========================================
let systemLogs = JSON.parse(localStorage.getItem("systemLogs")) || [];

// دالة تسجيل أي حركة (بتحتفظ بآخر 500 حركة بس)
window.addSystemLog = function(actionType, details) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('ar-EG') + " - " + formatTime12(`${now.getHours()}:${now.getMinutes()}`);
    
    // إضافة الحركة الجديدة في أول المصفوفة
    systemLogs.unshift({
        date: formattedDate,
        type: actionType,
        details: details
    });

    // قص المصفوفة لو زادت عن 500 عشان السيستم ميهنجش
    if (systemLogs.length > 500) {
        systemLogs = systemLogs.slice(0, 500);
    }
    
    localStorage.setItem("systemLogs", JSON.stringify(systemLogs));
    if (document.getElementById("logs-view").style.display === "block") renderSystemLogs();
};

window.renderSystemLogs = function() {
    const tbody = document.getElementById("system-logs-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (systemLogs.length === 0) {
        return tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">السجل فارغ تماماً</td></tr>`;
    }

    systemLogs.forEach(log => {
        // تلوين نوع الحركة عشان تكون مريحة للعين
        let typeColor = "#3b82f6"; // أزرق افتراضي
        if (log.type.includes("إضافة") || log.type.includes("فتح") || log.type.includes("استلام")) typeColor = "#10b981"; // أخضر
        if (log.type.includes("حذف") || log.type.includes("مسح") || log.type.includes("إلغاء")) typeColor = "#ef4444"; // أحمر
        if (log.type.includes("تعديل") || log.type.includes("قفل") || log.type.includes("رصد")) typeColor = "#f59e0b"; // برتقالي

        tbody.innerHTML += `
            <tr>
                <td style="font-size: 13px; color: var(--text-muted);">${log.date}</td>
                <td><span style="background: ${typeColor}20; color: ${typeColor}; padding: 5px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; border: 1px solid ${typeColor}50;">${log.type}</span></td>
                <td style="font-weight: bold;">${log.details}</td>
            </tr>
        `;
    });
};

window.clearSystemLogs = function() {
    customConfirm("هل أنت متأكد من مسح سجل الحركات بالكامل؟", () => {
        systemLogs = [];
        localStorage.setItem("systemLogs", JSON.stringify(systemLogs));
        renderSystemLogs();
        showToast("تم تفريغ السجل بنجاح 🗑️");
    });
};


// ==========================================
// 📈 2. نظام التقارير الشاملة وتصدير الإكسيل
// ==========================================
window.generateAdvancedReport = function() {
    const type = document.getElementById("reportType").value;
    const groupFilter = document.getElementById("reportGroup").value;
    const fromDate = document.getElementById("reportDateFrom").value;
    const toDate = document.getElementById("reportDateTo").value;
    
    const thead = document.getElementById("report-table-head");
    const tbody = document.getElementById("report-table-body");
    
    thead.innerHTML = ""; tbody.innerHTML = "";

    // 1. تحديد الداتا بناءً على النوع المختار (حصص ولا امتحانات ولا واجبات)
    let sourceData = [];
    let itemName = ""; // اسم العمود (حصة / امتحان / واجب)
    if (type === 'attendance') { sourceData = classSessions; itemName = "الغياب (الحالة)"; }
    else if (type === 'exams') { sourceData = exams; itemName = "الامتحان (الدرجة)"; }
    else if (type === 'homework') { sourceData = homeworks; itemName = "الواجب (الدرجة)"; }

    // 2. فلترة الداتا بالتاريخ والمجموعة
    let filteredItems = sourceData.filter(item => {
        let matchGroup = (groupFilter === 'all') || (item.group === groupFilter);
        let matchDate = true;
        if (fromDate) matchDate = matchDate && (new Date(item.date) >= new Date(fromDate));
        if (toDate) matchDate = matchDate && (new Date(item.date) <= new Date(toDate));
        return matchGroup && matchDate;
    }).sort((a,b) => new Date(a.date) - new Date(b.date)); // ترتيب تصاعدي بالزمن

    if (filteredItems.length === 0) {
        thead.innerHTML = `<tr><th>لا توجد بيانات مطابقة لهذه الفلاتر</th></tr>`;
        return;
    }

    // 3. فلترة الطلاب (لو اختار مجموعة معينة نجيب طلابها بس، لو الكل نجيب الكل)
    let targetStudents = students;
    if (groupFilter !== 'all') targetStudents = students.filter(s => s.group === groupFilter);

    // 4. رسم رأس الجدول (الهيدر)
    let headHtml = `<tr><th>كود الطالب</th><th>الاسم</th><th>المجموعة</th>`;
    filteredItems.forEach(item => {
        let title = type === 'attendance' ? item.date : `${item.name} (${item.date})`;
        headHtml += `<th>${title}</th>`;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // 5. رسم جسم الجدول (الطلاب ونتائجهم)
    targetStudents.forEach(st => {
        let rowHtml = `<tr>
            <td style="font-weight: bold; color: var(--primary-color);">${st.code}</td>
            <td>${st.name}</td>
            <td>${st.group}</td>`;
        
        filteredItems.forEach(item => {
            let cellValue = "--";
            
            if (type === 'attendance') {
                let stat = item.attendance[st.phone];
                if (stat === 'present') cellValue = "حاضر";
                else if (stat === 'absent') cellValue = "غائب";
            } 
            else if (type === 'exams' || type === 'homework') {
                if (item.grades && item.grades[st.phone] !== undefined) {
                    cellValue = `${item.grades[st.phone]} / ${item.maxScore}`;
                } else {
                    cellValue = "لم يُمتحن/لم يُسلم";
                }
            }
            rowHtml += `<td>${cellValue}</td>`;
        });
        
        rowHtml += `</tr>`;
        tbody.innerHTML += rowHtml;
    });
    
    showToast("تم استخراج التقرير بنجاح! 📊");
};

// 📥 دالة تصدير الجدول لإكسيل باستخدام مكتبة XLSX الموجودة عندك
window.exportReportToExcel = function() {
    const table = document.getElementById("advanced-report-table");
    if (!table || table.rows.length <= 1) {
        return showToast("لا يوجد تقرير لتصديره! قم باستخراج تقرير أولاً.", "error");
    }
    
    // تحويل الـ HTML Table لـ شيت إكسيل
    const wb = XLSX.utils.table_to_book(table, {sheet: "التقرير"});
    
    // تسمية الملف بالتاريخ
    const dateStr = new Date().toLocaleDateString('ar-EG').replace(/\//g, '-');
    const typeStr = document.getElementById("reportType").options[document.getElementById("reportType").selectedIndex].text;
    const fileName = `EduTrack_${typeStr}_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    showToast("تم تحميل شيت الإكسيل بنجاح! 📥");
};


// ==========================================
// 🔧 3. دمج الصفحات الجديدة مع نظام التنقل
// ==========================================
// دي عشان لما تفتح صفحة التقارير، يملأ قائمة المجموعات أوتوماتيك
const oldSwitchPageForReports = window.switchPage;
window.switchPage = function(pageId) {
    if (oldSwitchPageForReports) oldSwitchPageForReports(pageId);
    
    if (pageId === "reports") {
        document.getElementById("page-title").innerText = "التقارير الشاملة 📈";
        document.getElementById("page-desc").innerText = "استخراج فلاتر وتصدير شيتات الإكسيل";
        
        // ملء قائمة المجموعات في الفلتر
        const groupSelect = document.getElementById("reportGroup");
        groupSelect.innerHTML = '<option value="all">جميع المجموعات</option>';
        groups.forEach(g => { groupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`; });
    }
    
    if (pageId === "logs") {
        document.getElementById("page-title").innerText = "سجل حركات النظام 🕵️‍♂️";
        document.getElementById("page-desc").innerText = "مراقبة كل صغيرة وكبيرة تحدث في النظام";
        renderSystemLogs();
    }
};

// ==========================================
// 🔗 تشغيل صفحة الإحالات وجلب الكود والإحصائيات
// ==========================================
const checkAffiliateSwitch = window.switchPage;
window.switchPage = function(pageId) {
    if (checkAffiliateSwitch) checkAffiliateSwitch(pageId);
    
    // أول ما يفتح صفحة الإحالات، شغل الدالة اللي بتجيب الكود والداتا
    if (pageId === "affiliate") {
        if (typeof initAffiliatePage === "function") {
            initAffiliatePage();
        }
    }
};


// ==========================================
// 💻 نظام الامتحانات الإلكترونية المتطور (Online Exams)
// ==========================================
let onlineExams = JSON.parse(localStorage.getItem("onlineExams")) || [];
let currentGradingExamId = null;
let currentGradingStudentPhone = null;

// تعديل رسم كروت الامتحانات لدمج الورقي والإلكتروني
const originalRenderExamCards = window.renderExamCards;
window.renderExamCards = function() {
    originalRenderExamCards(); // رسم الورقي أولاً
    const grid = document.getElementById("exams-grid"); if(!grid) return;
    
    // رسم الإلكتروني
    [...onlineExams].reverse().forEach(exam => { 
        const isClosed = exam.status === 'closed';
        const subCount = exam.submissions ? Object.keys(exam.submissions).length : 0;
        let groupsText = Array.isArray(exam.group) ? exam.group.join("، ") : exam.group;
        
        grid.innerHTML += `
        <div class="session-card exam-card" style="border-top: 4px solid #3b82f6;">
            <div class="session-header-card">
                <div>
                    <div class="exam-group-name" style="color: #3b82f6;">💻 ${exam.title}</div>
                    <div class="session-date" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${groupsText}">${groupsText} | ${exam.date}</div>
                </div>
                <span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed?'مغلق':'مفتوح'}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">تم التسليم: <strong>${subCount}</strong> ورقة</div>
            <div class="session-actions">
                <button class="enter-btn" style="background: #3b82f6;" onclick="openOnlineExamDetails('${exam.id}')">عرض النتائج</button>
                <button class="icon-btn admin-only" onclick="toggleOnlineExamStatus('${exam.id}')" title="فتح/قفل">${isClosed?'🔓':'🔒'}</button>
                <button class="icon-btn danger admin-only" onclick="deleteOnlineExam('${exam.id}')">🗑️</button>
            </div>
        </div>`; 
    }); 
};

// فتح منشئ الامتحانات (بدعم اختيار مجموعات متعددة)
window.openOnlineExamBuilder = function() {
    const groupContainer = document.getElementById("onlineExamGroupsContainer");
    groupContainer.innerHTML = groups.map(g => `<label style="display:flex; align-items:center; gap:5px; cursor:pointer; background: var(--card-bg); padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border-color);"><input type="checkbox" class="exam-group-cb" value="${g.name}" style="accent-color: var(--primary-color); width: 16px; height: 16px;"> ${g.name}</label>`).join('');
    
    document.getElementById("examQuestionsContainer").innerHTML = "";
    document.getElementById("onlineExamTitle").value = "";
    document.getElementById("onlineExamDuration").value = "60";
    addQuestionBlock('mcq'); openModal('buildOnlineExamModal');
};

// حفظ الامتحان
window.saveOnlineExam = function() {
    const title = document.getElementById("onlineExamTitle").value.trim();
    const selectedGroups = Array.from(document.querySelectorAll('.exam-group-cb:checked')).map(cb => cb.value);
    const duration = document.getElementById("onlineExamDuration").value;
    const autoShowResult = document.getElementById("onlineExamAutoShowResult").checked;
    
    if (!title || selectedGroups.length === 0 || !duration) return showToast("يرجى إكمال العنوان واختيار مجموعة واحدة على الأقل!", "error");
    
    const questionBlocks = document.querySelectorAll(".question-block");
    if (questionBlocks.length === 0) return showToast("يجب إضافة سؤال واحد على الأقل!", "error");

    let questions = []; let isValid = true; let totalScore = 0;
    questionBlocks.forEach((block, index) => {
        let qType = block.getAttribute("data-type");
        let qText = block.querySelector(".q-text").value.trim();
        let qPoints = parseFloat(block.querySelector(".q-points").value);
        if (!qText || isNaN(qPoints)) isValid = false;
        totalScore += qPoints;
        let questionObj = { id: "q_" + index, type: qType, text: qText, points: qPoints };

        if (qType === 'mcq') {
            let options = Array.from(block.querySelectorAll(".q-opt")).map(o => o.value.trim());
            if (options.some(o => o === "")) isValid = false; 
            let correctRadio = block.querySelector(`input[type="radio"]:checked`);
            if (!correctRadio) { showToast(`السؤال رقم ${index + 1} بلا إجابة صحيحة!`, "error"); isValid = false; }
            else { questionObj.options = options; questionObj.correctAnswerIndex = parseInt(correctRadio.value); }
        } 
        else if (qType === 'tf') {
            let correctRadio = block.querySelector(`input[type="radio"]:checked`);
            if (!correctRadio) { showToast(`السؤال رقم ${index + 1} حدد صح أم خطأ!`, "error"); isValid = false; }
            else { questionObj.correctAnswer = correctRadio.value === "true"; }
        }
        else if (qType === 'blank') {
            let correctAns = block.querySelector(".q-correct-blank").value.trim();
            if (!correctAns) isValid = false;
            questionObj.correctAnswerText = correctAns;
        }
        questions.push(questionObj);
    });

    if (!isValid) return showToast("يرجى مراجعة الأسئلة وتعبئة الحقول الفارغة!", "error");

    onlineExams.push({
        id: "online_" + Date.now().toString(),
        title: title, group: selectedGroups, duration: parseInt(duration), autoShowResult: autoShowResult,
        status: "open", date: new Date().toLocaleDateString('en-CA'), totalScore: totalScore, questions: questions, submissions: {}
    });

    localStorage.setItem("onlineExams", JSON.stringify(onlineExams));
    if(typeof addSystemLog === "function") addSystemLog("امتحان إلكتروني 💻", `تم نشر امتحان (${title})`);
    closeModal('buildOnlineExamModal'); renderExamCards(); showToast(`تم نشر الامتحان بنجاح 🚀`);
    if(typeof syncDataToBot === "function") syncDataToBot();
};

window.deleteOnlineExam = function(id) { customConfirm("حذف الامتحان الإلكتروني وجميع إجابات الطلاب؟", () => { onlineExams = onlineExams.filter(e => e.id !== id); localStorage.setItem("onlineExams", JSON.stringify(onlineExams)); renderExamCards(); showToast("تم الحذف"); }); };
window.toggleOnlineExamStatus = function(id) { const ex = onlineExams.find(e => e.id === id); if(ex) { ex.status = ex.status === 'open' ? 'closed' : 'open'; localStorage.setItem("onlineExams", JSON.stringify(onlineExams)); renderExamCards(); showToast(ex.status === 'open' ? "تم فتح الامتحان للطلاب" : "تم إغلاق الامتحان"); } };

// 📊 عرض تفاصيل الامتحان والطلاب (مرتبين بالأعلى درجة)


const originalBackToExams = window.backToExams;
window.backToExams = function() {
    originalBackToExams();
    document.getElementById("online-exam-details-view").style.display = "none";
};

// 📝 نافذة التصحيح اليدوي للمدرس
window.openGradeSubmission = function(examId, studentPhone) {
    currentGradingExamId = examId; currentGradingStudentPhone = studentPhone;
    const exam = onlineExams.find(e => e.id === examId);
    const sub = exam.submissions[studentPhone];
    const st = students.find(s => s.phone === studentPhone);
    
    document.getElementById("gradeStudentName").innerText = `إجابات: ${st ? st.name : 'طالب'}`;
    document.getElementById("gradeStudentScore").innerText = `المجموع الحالي: ${sub.score} / ${exam.totalScore}`;
    
    const container = document.getElementById("studentAnswersContainer"); container.innerHTML = "";
    
    exam.questions.forEach((q, idx) => {
        let studentAns = sub.answers[q.id];
        let qHtml = `<div style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <p style="font-weight: bold; margin-bottom: 10px; color: var(--text-main);">${idx+1}. ${q.text} <span style="font-size:12px; color:var(--text-muted);">(${q.points} درجات)</span></p>`;
        
        if (q.type === 'mcq') {
            let ansText = studentAns !== undefined && studentAns !== -1 ? q.options[studentAns] : "لم يُجب";
            let isCorrect = studentAns === q.correctAnswerIndex;
            qHtml += `<p style="color: ${isCorrect ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: bold;">إجابة الطالب: ${ansText} ${isCorrect ? '✅' : '❌'}</p>`;
            if(!isCorrect) qHtml += `<p style="color: var(--success-color); font-size: 13px;">الإجابة الصحيحة: ${q.options[q.correctAnswerIndex]}</p>`;
        } 
        else if (q.type === 'essay') {
            let manualGrade = sub.manualGrades ? sub.manualGrades[q.id] : "";
            qHtml += `
            <div style="background: var(--card-bg); padding: 10px; border-radius: 6px; border: 1px solid #d1d5db; margin-bottom: 10px;">
                <p style="margin: 0; color: #3b82f6;"><strong>ما كتبه الطالب:</strong></p>
                <p style="margin-top: 5px; white-space: pre-wrap;">${studentAns || "لم يكتب شيئاً"}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="color: var(--exam-color); font-weight: bold;">الدرجة المستحقة:</label>
                <input type="number" id="grade_${q.id}" class="custom-input manual-grade-input" style="width: 100px; text-align: center;" value="${manualGrade}" max="${q.points}" min="0">
                <span style="color: var(--text-muted);">من ${q.points}</span>
            </div>`;
        }
        else {
            qHtml += `<p style="color: var(--text-muted);">إجابة الطالب: <strong>${studentAns || "لم يُجب"}</strong></p>`;
        }
        
        qHtml += `</div>`;
        container.innerHTML += qHtml;
    });
    openModal('gradeOnlineExamModal');
};

// عرض تفاصيل الامتحان وجلب الإجابات لايف من العقدة المؤمنة
window.openOnlineExamDetails = async function(id) {
    const exam = onlineExams.find(e => e.id === id); if(!exam) return;
    document.getElementById("exams-overview").style.display = "none";
    document.getElementById("online-exam-details-view").style.display = "block";
    document.getElementById("current-online-exam-title").innerText = `💻 ${exam.title}`;
    
    let tbody = document.getElementById("online-exam-submissions-list");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">جاري جلب تسليمات الطلاب من السحابة... ⏳</td></tr>`;

    try {
        // جلب الإجابات لايف من العقدة المستقلة المحمية
        let res = await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/teachers/${licenseKey}/onlineSubmissions/${id}.json`);
        let subs = await res.json() || {};
        exam.submissions = subs; // حفظ مؤقت في الذاكرة لعملية التصحيح
        
        let subsArray = Object.keys(subs).map(phone => ({ phone: phone, data: subs[phone] }));
        subsArray.sort((a, b) => b.data.score - a.data.score); // الترتيب بالأعلى درجة
        
        document.getElementById("online-exam-stats").innerText = `إجمالي التسليمات: ${subsArray.length}`;
        tbody.innerHTML = "";
        
        if(subsArray.length === 0) return tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">لم يقم أي طالب بتسليم الامتحان حتى الآن</td></tr>`;

        subsArray.forEach(sub => {
            let st = students.find(s => s.phone === sub.phone);
            let name = st ? st.name : "طالب غير معروف";
            let code = st ? st.code : "--";
            let group = st ? st.group : "--";
            
            let needsGrading = exam.questions.some(q => q.type === 'essay' && sub.data.answers[q.id] !== undefined && sub.data.manualGrades?.[q.id] === undefined);
            let statusBadge = needsGrading ? `<span class="badge-absent" style="background:#fef3c7; color:#d97706;">يحتاج تقييم مقالي ⚠️</span>` : `<span class="badge-present">مكتمل التقييم ✅</span>`;
            let scoreColor = needsGrading ? "#d97706" : "#059669";

            tbody.innerHTML += `<tr>
                <td><strong>${code}</strong></td><td>${name}</td><td>${group}</td>
                <td><strong style="color:${scoreColor}; font-size: 16px;">${sub.data.score} / ${exam.totalScore}</strong></td>
                <td>${statusBadge}</td>
                <td><button class="btn-present" style="background: #3b82f6;" onclick="openGradeSubmission('${exam.id}', '${sub.phone}')">عرض وتصحيح 📝</button></td>
            </tr>`;
        });
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger-color);">خطأ أثناء جلب البيانات من السحابة!</td></tr>`;
    }
};

// حفظ الدرجات المقالية في العقدة المؤمنة
window.saveManualGrades = async function() {
    const exam = onlineExams.find(e => e.id === currentGradingExamId);
    const sub = exam.submissions[currentGradingStudentPhone];
    if(!sub.manualGrades) sub.manualGrades = {};
    
    exam.questions.filter(q => q.type === 'essay').forEach(q => {
        let input = document.getElementById(`grade_${q.id}`);
        if(input && input.value !== "") {
            let val = parseFloat(input.value);
            if(val > q.points) val = q.points;
            let oldVal = sub.manualGrades[q.id] || 0;
            sub.score = (sub.score - oldVal) + val;
            sub.manualGrades[q.id] = val;
        }
    });

    try {
        // رفع التعديل مباشرة للمكان المحمي
        await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/teachers/${licenseKey}/onlineSubmissions/${currentGradingExamId}/${currentGradingStudentPhone}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
        });
        closeModal('gradeOnlineExamModal');
        openOnlineExamDetails(currentGradingExamId);
        showToast("تم تحديث درجة الطالب بنجاح! 💾");
    } catch(e) {
        showToast("خطأ في حفظ الدرجة على السحابة!", "error");
    }
};

// ==========================================
// 🛠️ دوال بناء الأسئلة والمزامنة (اللي كانت ناقصة)
// ==========================================
window.addQuestionBlock = function(type) {
    const container = document.getElementById("examQuestionsContainer");
    const qId = Date.now().toString() + Math.floor(Math.random() * 1000); 
    
    let qHTML = `<div class="question-block" id="qb_${qId}" data-type="${type}" style="background: var(--card-bg); padding: 20px; border-radius: 12px; border: 2px solid var(--border-color); margin-bottom: 20px; position: relative;">
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; left: 10px; background: none; border: none; color: var(--danger-color); font-size: 20px; cursor: pointer;">🗑️</button>
        
        <div style="display: flex; gap: 15px; margin-bottom: 15px;">
            <div style="flex: 3;">
                <label style="color: var(--primary-color); font-weight: bold;">نص السؤال:</label>
                <textarea class="custom-input q-text" rows="2" required placeholder="اكتب سؤالك هنا..."></textarea>
            </div>
            <div style="flex: 1;">
                <label style="color: var(--exam-color); font-weight: bold;">درجة السؤال:</label>
                <input type="number" class="custom-input q-points" value="1" min="1" required>
            </div>
        </div>
    `;

    if (type === 'mcq') {
        qHTML += `
            <div class="options-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="display:flex; align-items:center; gap:5px;"><input type="radio" name="ans_${qId}" value="0" required> <input type="text" class="custom-input q-opt" placeholder="الاختيار الأول (أ)" required></div>
                <div style="display:flex; align-items:center; gap:5px;"><input type="radio" name="ans_${qId}" value="1"> <input type="text" class="custom-input q-opt" placeholder="الاختيار الثاني (ب)" required></div>
                <div style="display:flex; align-items:center; gap:5px;"><input type="radio" name="ans_${qId}" value="2"> <input type="text" class="custom-input q-opt" placeholder="الاختيار الثالث (ج)" required></div>
                <div style="display:flex; align-items:center; gap:5px;"><input type="radio" name="ans_${qId}" value="3"> <input type="text" class="custom-input q-opt" placeholder="الاختيار الرابع (د)" required></div>
            </div>
            <p style="font-size: 12px; color: var(--success-color); margin-top: 10px;">* حدد الدائرة بجوار الاختيار الصحيح ليقوم النظام بتصحيحه تلقائياً.</p>
        `;
    } 
    else if (type === 'tf') {
        qHTML += `
            <div style="display: flex; gap: 20px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:var(--success-color);"><input type="radio" name="ans_${qId}" value="true" required style="width:18px; height:18px;"> عبارة صحيحة ✔️</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:var(--danger-color);"><input type="radio" name="ans_${qId}" value="false" style="width:18px; height:18px;"> عبارة خاطئة ❌</label>
            </div>
        `;
    }
    else if (type === 'blank') {
        qHTML += `
            <div>
                <label>الإجابة الصحيحة المطابقة (للتصحيح التلقائي):</label>
                <input type="text" class="custom-input q-correct-blank" required placeholder="اكتب الكلمة الناقصة بالظبط...">
            </div>
        `;
    }
    else if (type === 'essay') {
        qHTML += `
            <div style="background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 8px; border: 1px dashed var(--exam-color);">
                <p style="color: var(--exam-color); font-size: 14px; margin: 0;">📝 هذا السؤال سيحله الطالب في مربع نص كبير. ستحتاج إلى مراجعته وتصحيحه يدوياً من لوحة التحكم لتحديد الدرجة.</p>
            </div>
        `;
    }

    qHTML += `</div>`;
    container.insertAdjacentHTML('beforeend', qHTML);
    
    const scrollArea = document.getElementById("examBuilderScrollArea");
    if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
};

// مزامنة الامتحانات الإلكترونية مع الفايربيز
const syncBotOriginalOnline = window.syncDataToBot;
window.syncDataToBot = async function() {
    if (syncBotOriginalOnline) await syncBotOriginalOnline();
    
    let isDemo = localStorage.getItem("is_demo_mode") === "true";
    if (!isDemo && isFirebaseLoaded && licenseKey) {
        try {
            await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/teachers/${licenseKey}/data/onlineExams.json`, { 
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(onlineExams) 
            });
        } catch (e) {}
    }
};

// ==========================================
// 📢 نظام إشعارات الإدارة العليا (Global Announcements)
// ==========================================
let currentAnnouncementId = null;

async function checkGlobalAnnouncements() {
    try {
        // سحب الإشعار من العقدة العامة في السيرفر
        let res = await fetch(`https://edutrack-system-1ded4-default-rtdb.firebaseio.com/global_announcement.json`);
        let ann = await res.json();
        
        if (ann && ann.id) {
            let dismissedId = localStorage.getItem("dismissed_announcement");
            // لو المدرس مقفلش الإشعار ده قبل كده، اظهرهوله
            if (dismissedId !== ann.id) {
                currentAnnouncementId = ann.id;
                document.getElementById("globalAnnTitle").innerText = ann.title || "📢 تنبيه من إدارة EduTrack";
                // استبدال المسافات عشان لو كاتب برجراف يظهر منسق
                document.getElementById("globalAnnMessage").innerHTML = ann.message.replace(/\n/g, '<br>');
                openModal('globalAnnouncementModal');
            }
        }
    } catch(e) {
        console.log("No global announcements at the moment.");
    }
}

window.dismissGlobalAnnouncement = function() {
    if (currentAnnouncementId) {
        // حفظ الـ ID في المتصفح عشان ميظهرش تاني
        localStorage.setItem("dismissed_announcement", currentAnnouncementId);
    }
    closeModal('globalAnnouncementModal');
};