// ==========================================
// 🤖 المساعد الشخصي (ميرا) - النسخة الأسطورية (المتحكم الشامل للسناتر والكتب) 🚀🔥
// ==========================================

const GEMINI_API_KEY = "AIzaSyAahfKY9BlzA_sRDSzvIArKICAJSdhOTCs"; 
const chatOverlay = document.getElementById('shefo-chat-overlay');
const chatMessages = document.getElementById('shefo-chat-messages');
const textInput = document.getElementById('shefo-text-input');
const micBtn = document.getElementById('shefo-mic-btn');
const statusText = document.getElementById('shefo-status');

// 🧠 ذاكرة ميرا 
let chatHistory = [];
let pendingAction = { action: "NONE", data: {} };

// فتح وقفل الشات
function openShefoChat() { chatOverlay.style.display = 'flex'; }
function closeShefoChat() { chatOverlay.style.display = 'none'; }

// إعدادات الاستماع (Voice to Text)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'ar-EG'; 
recognition.interimResults = false;
let isRecording = false;

// ==========================================
// 🎙️ إعدادات النطق وتأثير الكتابة
// ==========================================
const ELEVENLABS_API_KEY = "sk_66d9fea5b1a52c541431d3cc9c90c6f6ba52392bed6e23c4"; 
const VOICE_ID = "ErXwobaYiN019PkySvjV"; 
let currentAudio = null;

async function shefoSpeak(text, msgElement) {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    const cleanText = text.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim(); 
    try {
        statusText.innerText = "ميرا بتسجل فويس... 🎙️"; statusText.style.color = "#8b5cf6";
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?optimize_streaming_latency=1`, {
            method: 'POST',
            headers: { 'Accept': 'audio/mpeg', 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
        });
        if (!response.ok) throw new Error("مشكلة في سيرفر الصوت");
        const blob = await response.blob();
        currentAudio = new Audio(URL.createObjectURL(blob));
        currentAudio.onplay = () => { typeWriterEffect(msgElement, text); };
        currentAudio.play();
        currentAudio.onended = () => { statusText.innerText = "متصل الآن ✅"; statusText.style.color = "#10b981"; };
    } catch (error) { fallbackSpeak(text, cleanText, msgElement); }
}

function fallbackSpeak(originalText, cleanText, msgElement) {
    const synth = window.speechSynthesis; if (synth.speaking) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-EG'; utterance.rate = 1.3;
    utterance.onstart = () => { typeWriterEffect(msgElement, originalText); };
    synth.speak(utterance);
    statusText.innerText = "متصل الآن ✅"; statusText.style.color = "#10b981";
}

function typeWriterEffect(element, text) {
    let i = 0; element.innerHTML = ''; const typingSpeed = 30; 
    function typeWriter() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i); i++;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            setTimeout(typeWriter, typingSpeed);
        }
    }
    typeWriter();
}

function appendMessage(sender, text, animate = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `shefo-message ${sender === 'user' ? 'user-message' : 'bot-message'}`;
    chatMessages.appendChild(msgDiv);
    if (animate && sender === 'bot') { typeWriterEffect(msgDiv, text); } 
    else { msgDiv.innerText = text; chatMessages.scrollTop = chatMessages.scrollHeight; }
    chatHistory.push({ role: sender === 'user' ? "user" : "model", parts: [{ text: text }] });
    if (chatHistory.length > 15) chatHistory.shift(); 
}

// التحكم في الإدخال
function toggleShefoMic() { if (isRecording) recognition.stop(); else { try { recognition.start(); } catch(e) {} } }
recognition.onstart = () => { isRecording = true; micBtn.classList.add('recording'); statusText.innerText = "ميرا بتسمعك... 🎙️"; statusText.style.color = "#ef4444"; };
recognition.onresult = async (event) => { handleUserInput(event.results[0][0].transcript); };
recognition.onend = () => { isRecording = false; micBtn.classList.remove('recording'); if(statusText.innerText.includes("بيسمعك")) { statusText.innerText = "متصل الآن ✅"; statusText.style.color = "#10b981"; } };
function handleShefoKeyPress(event) { if (event.key === 'Enter') sendShefoMessage(); }
function sendShefoMessage() { const text = textInput.value.trim(); if (text) handleUserInput(text); }

async function handleUserInput(text) {
    textInput.value = ''; appendMessage('user', text); 
    statusText.innerText = "ميرا بتفكر... 🧠"; statusText.style.color = "#3b82f6";
    await processShefoCommand(text);
}

// ==========================================
// 🔑 Load Balancer
// ==========================================
const API_KEYS = [
    "AIzaSyAIte5VJNd0bUt66wJc07uGjqmI8xGz2h0", 
    "AIzaSyCxJ0kjJoAIOhgKK-xgrU4NuaQmc7BpcqY",
    "AIzaSyDcMSHkp6eSepgvhlK7G1J4w61gkz31vO0",
    "AIzaSyCFPu4LhULZ8oVpWYxBP6abpjY5nb7_niw",
    "AIzaSyCDmAjXpYMi6pL7mM_AQq-uwmAOE2c4az0",
    "AIzaSyALKAVnZPQaB5l-6BGrUQ463IWaiyCxt5E",
    "AIzaSyAKQ8fruFZCBZDC_2fEjacZ86_hjBSEmhs",
    "AIzaSyDM3hOAJCOugpZUXy9ldm7tBI5yyd0UI5c",
    "AIzaSyAKRv1mhre4LGw6sewMzeyBlfwQKkT-RqI",
    "AIzaSyC9RSm1pyrTghobfWqX3p3QC_-Jfewr9zU"
];
let currentKeyIndex = 0; let useFallbackModel = false; 

// ==========================================
// 🧠 عقل ميرا (الذكاء الاصطناعي الشامل)
// ==========================================
async function processShefoCommand(userText) {
    const currentStudents = JSON.parse(localStorage.getItem("students")) || [];
    const currentGroups = JSON.parse(localStorage.getItem("groups")) || [];
    const currentExams = JSON.parse(localStorage.getItem("exams")) || [];
    const currentHw = JSON.parse(localStorage.getItem("homeworks")) || [];
    const currentSessions = JSON.parse(localStorage.getItem("classSessions")) || [];
    const currentSchedule = JSON.parse(localStorage.getItem("schedule")) || [];
    const currentBooks = JSON.parse(localStorage.getItem("books")) || [];

    let smartContext = `- عدد المجموعات: ${currentGroups.length} | إجمالي الطلاب: ${currentStudents.length}\n- المجموعات: ${currentGroups.map(g => g.name).join('، ')}\n`;
    
    // فلترة سريعة لتوفير الكوتة
    if (userText.includes("امتحان") || userText.includes("واجب")) {
        smartContext += `- الامتحانات: ${currentExams.slice(-4).map(e => `ID:${e.id} | ${e.name}`).join(' / ')}\n`;
        smartContext += `- الواجبات: ${currentHw.slice(-4).map(h => `ID:${h.id} | ${h.name}`).join(' / ')}\n`;
    }
    
    // فلترة بيانات الكتب
    if (userText.includes("كتاب") || userText.includes("كتب") || userText.includes("مذكرة") || userText.includes("سنتر") || userText.includes("فلوس") || userText.includes("استلمت")) {
        smartContext += `- سجل الكتب بالسناتر: ${currentBooks.map(b => `[ID:${b.id}] كتاب ${b.bookName} بسنتر ${b.centerName} | تم استلام: ${b.receivedAmount}ج`).join(' / ')}\n`;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dayName = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });
    const historyText = chatHistory.map(msg => `${msg.role === 'user' ? 'المدير' : 'ميرا'}: ${msg.parts[0].text}`).join('\n');

    const systemPrompt = `
    أنت "ميرا"، المسئوله الأوله والمتحكمه في نظام (EduTrack).
    أسلوبك: مدير محترف، حاسم، لهجتك مصرية قوية، ترد بـ "حاضر يا مدير".
    اليوم: ${dayName} ${todayStr}.
    
    📊 معلومات السيستم الحالية:
    ${smartContext}
    
 👑 قوانين الإدارة:
    1. **الحذف:** لا تحذف أبداً بدون تأكيد. استخدم "REQUIRE_CONFIRMATION".
    2. **التأكيد:** إذا أكد المدير الحذف، نفذ الأمر. إذا ألغى، استخدم "CANCEL_ACTION".
    3. **الأرقام والهواتف (الضربة القاضية):** إياك كتابة الأرقام ككتلة واحدة. يجب أن تكتب أي رقم هاتف مفصولاً بمسافات بين كل رقم والآخر في الـ speech والـ data معاً (مثال: 0 1 0 1 9 6 6 4 4 6 2). هذا أمر حتمي لمنع عكس الأرقام.
    4. **توحيد الصفوف:** أي صف دراسي يتم إرساله في "level" يجب أن يكون حرفياً: "الأول الثانوي" أو "الثاني الثانوي" أو "الثالث الثانوي".
    5. **المجموعات:** أرسل اسم المجموعة (group) كما هي مسجلة بالضبط في معلومات السيستم.
    6. **الكتب:** نوع العمولة commissionType يكون إما "fixed" (ثابت) أو "percentage" (نسبة).


    
    يجب أن ترد بصيغة JSON فقط:
    { "speech": "ردك", "action": "الأمر", "data": { "key": "value" } }
    
    🤖 الأوامر المتاحة:
    - إضافة: "ADD_GROUP" (name, level)، "ADD_STUDENT" (name, phone, parentPhone, group, level)، "ADD_SCHEDULE" (day, time_24h, group, location).
    - الكتب والماليات: 
      * "ADD_BOOK": يتطلب (bookName, centerName, quantity, price, commissionType, commissionValue).
      * "RECEIVE_BOOK_PAYMENT": لاستلام نقدية من سنتر. يتطلب (bookId, amount).
    - التنقل: "NAVIGATE" (page: dashboard, schedule, students, groups, attendance, homework, exams, finance, leaderboard, broadcast, books).
    - فتح نوافذ: "OPEN_MODAL" (modalId: addStudentModal, addBookModal, receiveBookPaymentModal).
    - الحذف (يتطلب تأكيد): "DELETE_STUDENT" (studentCode), "DELETE_GROUP" (groupName), "DELETE_BOOK" (id), "DELETE_ALL_DATA".
    - أخرى: "PENDING_DATA" (لنقص البيانات)، "REQUIRE_CONFIRMATION" (لطلب تأكيد الحذف)، "CANCEL_ACTION"، "NONE".
    * "EDIT_BOOK": لتعديل داتا عهدة. يتطلب (bookId, bookName, centerName, quantity, price, commissionType, commissionValue).
    - فتح نوافذ: "OPEN_MODAL" (modalId: addStudentModal, addBookModal, receiveBookPaymentModal, editBookModal).

    البيانات المعلقة: ${JSON.stringify(pendingAction)}
    المحادثة:
    ${historyText}
    `;

    try {
        let success = false; let aiText = ""; let loopCounter = 0; const maxAttempts = API_KEYS.length * 2; 
        while (!success && loopCounter < maxAttempts) {
            if (currentKeyIndex >= API_KEYS.length) currentKeyIndex = 0;
            const currentModel = useFallbackModel ? "gemini-flash-lite-latest" : "gemini-2.0-flash";
            const currentKey = API_KEYS[currentKeyIndex];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${currentKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: systemPrompt }] }], generationConfig: { responseMimeType: "application/json" } })
            });

            if (!response.ok) {
                const errCode = response.status || 500;
                if ([429, 503, 500, 400].includes(errCode)) { currentKeyIndex++; loopCounter++; if (currentKeyIndex >= API_KEYS.length) { currentKeyIndex = 0; useFallbackModel = true; } continue; } 
                else throw new Error("مشكلة في الاتصال بجوجل");
            }
            const data = await response.json(); aiText = data.candidates[0].content.parts[0].text; success = true;
        }

        if (!success) throw new Error("كل السيرفرات مشغولة دلوقتي 🚨");

        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("صيغة الرد غير صحيحة");
        const aiResponse = JSON.parse(jsonMatch[0]);

       // --- 🛡️ حائط الصد (Validation Interceptor) ---
        if (aiResponse.action === "ADD_STUDENT") {
            // 1. تجميع الأرقام المفرطة عشان نلغي غباء الذكاء الاصطناعي
            if (aiResponse.data.phone) aiResponse.data.phone = aiResponse.data.phone.replace(/\s/g, '');
            if (aiResponse.data.parentPhone) aiResponse.data.parentPhone = aiResponse.data.parentPhone.replace(/\s/g, '');

            const isDuplicate = currentStudents.some(s => s.phone === aiResponse.data.phone || (s.parentPhone && s.parentPhone === aiResponse.data.parentPhone));
            const isSamePhone = aiResponse.data.phone === aiResponse.data.parentPhone;
            
            // 2. التحقق من المجموعات والصفوف
            const targetGroup = currentGroups.find(g => g.name === aiResponse.data.group);

            if (!targetGroup && aiResponse.data.group) {
                aiResponse.action = "NONE";
                aiResponse.speech = `يا مدير، مفيش مجموعة متسجلة عندي باسم "${aiResponse.data.group}". ياريت تعملها الأول من صفحة إدارة المجموعات.`;
            } else if (targetGroup && targetGroup.level !== aiResponse.data.level) {
                aiResponse.action = "NONE";
                aiResponse.speech = `ستوب يا باشا! مجموعة "${targetGroup.name}" دي متسجلة إنها لـ "${targetGroup.level}"، وإنت بتقولي ضيف الطالب في "${aiResponse.data.level}". راجع الداتا وقولي تاني!`;
            } else if (isSamePhone) {
                aiResponse.action = "NONE";
                aiResponse.speech = "يا مدير، مينفعش رقم الطالب يكون هو هو رقم ولي الأمر! راجع الأرقام وقولي تاني.";
            } else if (isDuplicate) {
                aiResponse.action = "NONE";
                aiResponse.speech = "يا باشا الرقم اللي إنت مليتهولي ده متسجل عندنا في السيستم بالفعل لطالب تاني!";
            }
        }
        // ---------------------------------------------- ----------------------------------------------

        const msgDiv = document.createElement('div'); msgDiv.className = 'shefo-message bot-message';
        msgDiv.innerHTML = '<span style="color: #8b5cf6; font-size: 13px;">⏳ بيجهز الرد...</span>';
        chatMessages.appendChild(msgDiv); chatMessages.scrollTop = chatMessages.scrollHeight;

        chatHistory.push({ role: "model", parts: [{ text: aiResponse.speech }] });
        shefoSpeak(aiResponse.speech, msgDiv);

        if (["PENDING_DATA", "REQUIRE_CONFIRMATION"].includes(aiResponse.action)) {
            pendingAction.action = aiResponse.data.intendedAction || "PENDING";
            pendingAction.data = { ...pendingAction.data, ...aiResponse.data };
        } 
        else if (aiResponse.action === "CANCEL_ACTION") { pendingAction = { action: "NONE", data: {} }; }
        else if (aiResponse.action !== "NONE") {
            const finalData = { ...pendingAction.data, ...aiResponse.data };
            executeShefoAction(aiResponse.action, finalData);
            pendingAction = { action: "NONE", data: {} }; 
        }

    } catch (error) { appendMessage('bot', `⚠️ عطل: ${error.message}`); } 
    finally { statusText.innerText = "متصل الآن ✅"; statusText.style.color = "#10b981"; }
}

// ==========================================
// 🛠️ أذرع ميرا (التنفيذ المباشر والتحديث اللحظي الشامل)
// ==========================================
function executeShefoAction(action, data) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. أوامر التنقل وفتح النوافذ
        if (action === "OPEN_MODAL" && typeof openModal === "function") { 
            openModal(data.modalId); setTimeout(closeShefoChat, 300); 
        }
        else if (action === "NAVIGATE" && typeof switchPage === "function") { 
            switchPage(data.page); setTimeout(closeShefoChat, 300); 
        }
        else if (action === "OPEN_PROFILE" && typeof openStudentProfile === "function") { 
            openStudentProfile(data.studentCode); setTimeout(closeShefoChat, 300); 
        }

        // 2. أوامر الكتب والماليات
        else if (action === "ADD_BOOK" && typeof books !== 'undefined') {
            books.push({
                id: Date.now().toString() + "_b",
                bookName: data.bookName, centerName: data.centerName,
                quantity: parseFloat(data.quantity), price: parseFloat(data.price),
                commissionType: data.commissionType, commissionValue: parseFloat(data.commissionValue),
                receivedAmount: 0
            });
            localStorage.setItem("books", JSON.stringify(books));
            if (typeof renderBooksTable === "function") renderBooksTable(); 
            showToast("تم تسجيل عهدة الكتب 📚");
        }
        else if (action === "RECEIVE_BOOK_PAYMENT" && typeof books !== 'undefined') {
            const bIndex = books.findIndex(b => b.id == data.bookId);
            if (bIndex > -1) {
                books[bIndex].receivedAmount += parseFloat(data.amount);
                localStorage.setItem("books", JSON.stringify(books));
                if (typeof renderBooksTable === "function") renderBooksTable(); 
                showToast(`تم استلام ${data.amount} ج.م بنجاح 💰`);
            }
        }
        else if (action === "EDIT_BOOK" && typeof books !== 'undefined') {
            const bIndex = books.findIndex(b => b.id == data.bookId);
            if (bIndex > -1) {
                books[bIndex].bookName = data.bookName;
                books[bIndex].centerName = data.centerName;
                books[bIndex].quantity = parseFloat(data.quantity);
                books[bIndex].price = parseFloat(data.price);
                books[bIndex].commissionType = data.commissionType;
                books[bIndex].commissionValue = parseFloat(data.commissionValue);
                localStorage.setItem("books", JSON.stringify(books));
                if (typeof renderBooksTable === "function") renderBooksTable();
                showToast("تم تعديل العهدة بنجاح ✏️");
            }
        }
        else if (action === "DELETE_BOOK" && typeof books !== 'undefined') {
            const bIndex = books.findIndex(b => b.id == data.id);
            if (bIndex > -1) {
                books.splice(bIndex, 1);
                localStorage.setItem("books", JSON.stringify(books));
                if (typeof renderBooksTable === "function") renderBooksTable(); 
                showToast("تم حذف عهدة الكتب 🗑️", "error");
            }
        }

        // 3. أوامر الإضافة (الطلاب، المجموعات، الحصص، الخ)
        else if (action === "ADD_STUDENT" && typeof students !== 'undefined') {
            if (students.some(s => s.phone === data.phone)) {
                return showToast("رقم الهاتف مسجل مسبقاً!", "error");
            }
            
            // طريقة أضمن لتوليد الكود الجديد
            let newCodeStr = "1";
            if (students.length > 0) {
                // بنجيب أكبر كود موجود، حتى لو الأكواد مش بالترتيب
                let maxId = Math.max(...students.map(s => {
                    let n = parseInt(s.code, 10);
                    return isNaN(n) ? 0 : n;
                }));
                newCodeStr = (maxId + 1).toString();
            }

            students.push({ 
                id: Date.now(), 
                code: newCodeStr, 
                name: data.name, 
                phone: data.phone, 
                parentPhone: data.parentPhone, 
                group: data.group, 
                level: data.level, 
                gender: "ذكر", 
                behaviorPoints: 0 
            });
            localStorage.setItem("students", JSON.stringify(students)); 
            
            if (typeof renderTable === "function") renderTable(); 
            if (typeof renderDashboardCharts === "function") renderDashboardCharts();
            showToast(`تم تسجيل الطالب (كود: ${newCodeStr}) بنجاح 🎓`);
        }
        else if (action === "ADD_GROUP" && typeof groups !== 'undefined') {
            if (!groups.some(g => g.name === data.name)) { 
                groups.push({ name: data.name, level: data.level }); 
                localStorage.setItem("groups", JSON.stringify(groups)); 
                if (typeof renderGroupCards === "function") renderGroupCards(); 
                if (typeof renderDashboardCharts === "function") renderDashboardCharts();
                showToast("تم إنشاء المجموعة 📁");
            }
        }
        else if (action === "ADD_SESSION" && typeof classSessions !== 'undefined') {
            classSessions.push({ id: Date.now().toString(), group: data.group, date: todayStr, topic: data.topic || "حصة جديدة", status: "open", attendance: {} });
            localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
            if (typeof renderSessionCards === "function") renderSessionCards(); 
            showToast("تم فتح الحصة 🎯");
        }
        else if (action === "ADD_EXAM" && typeof exams !== 'undefined') {
            exams.push({ id: Date.now().toString() + "_e", name: data.name, maxScore: data.maxScore, group: data.group, date: todayStr, status: "open", grades: {} });
            localStorage.setItem("exams", JSON.stringify(exams)); 
            if (typeof renderExamCards === "function") renderExamCards(); 
            showToast("تم إضافة الامتحان 📝");
        }
        else if (action === "ADD_HW" && typeof homeworks !== 'undefined') {
            homeworks.push({ id: Date.now().toString() + "_h", name: data.name, maxScore: data.maxScore, group: data.group, date: todayStr, status: "open", grades: {} });
            localStorage.setItem("homeworks", JSON.stringify(homeworks)); 
            if (typeof renderHwCards === "function") renderHwCards(); 
            showToast("تم إضافة الواجب 📚");
        }
        else if (action === "ADD_SCHEDULE" && typeof schedule !== 'undefined') {
            schedule.push({ id: Date.now(), day: data.day, time: data.time, group: data.group, location: data.location || "السنتر" });
            localStorage.setItem("schedule", JSON.stringify(schedule)); 
            if (typeof renderSchedule === "function") renderSchedule(); 
            showToast("تم الإضافة للجدول 📅");
        }
        else if (action === "CHANGE_POINTS" && typeof students !== 'undefined') {
            const st = students.find(s => s.code == data.studentCode);
            if (st) { 
                st.behaviorPoints = (st.behaviorPoints || 0) + parseInt(data.points); 
                localStorage.setItem("students", JSON.stringify(students)); 
                const pEl = document.getElementById("profile-behavior-points"); 
                if(pEl && typeof currentStudentProfileCode !== 'undefined' && currentStudentProfileCode == data.studentCode) {
                    pEl.innerText = st.behaviorPoints; 
                }
                showToast("تم تعديل نقاط السلوك ⭐"); 
            }
        }

        // 4. أوامر الحذف (المدمرة - بتحديث لحظي)
        else if (action === "DELETE_STUDENT" && typeof students !== 'undefined') {
            const idx = students.findIndex(s => s.code == data.studentCode); 
            if (idx > -1) { 
                students.splice(idx, 1); 
                localStorage.setItem("students", JSON.stringify(students)); 
                if (typeof renderTable === "function") renderTable(); 
                if (typeof renderDashboardCharts === "function") renderDashboardCharts();
                showToast("تم فرم بيانات الطالب 🗑️", "error");
            }
        }
        else if (action === "DELETE_GROUP" && typeof groups !== 'undefined') {
            const idx = groups.findIndex(g => g.name === data.groupName); 
            if (idx > -1) { 
                groups.splice(idx, 1); 
                localStorage.setItem("groups", JSON.stringify(groups)); 
                if (typeof renderGroupCards === "function") renderGroupCards(); 
                if (typeof renderDashboardCharts === "function") renderDashboardCharts();
                showToast("تم نسف المجموعة 🗑️", "error");
            }
        }
        else if (action === "DELETE_SESSION" && typeof classSessions !== 'undefined') {
            const idx = classSessions.findIndex(s => s.id == data.id); 
            if (idx > -1) { 
                classSessions.splice(idx, 1); 
                localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
                if (typeof renderSessionCards === "function") renderSessionCards(); 
                showToast("تم مسح الحصة 🗑️", "error");
            }
        }
        else if (action === "DELETE_EXAM" && typeof exams !== 'undefined') {
            const idx = exams.findIndex(e => e.id == data.id); 
            if (idx > -1) { 
                exams.splice(idx, 1); 
                localStorage.setItem("exams", JSON.stringify(exams)); 
                if (typeof renderExamCards === "function") renderExamCards(); 
                showToast("تم مسح الامتحان 🗑️", "error");
            }
        }
        else if (action === "DELETE_HW" && typeof homeworks !== 'undefined') {
            const idx = homeworks.findIndex(h => h.id == data.id); 
            if (idx > -1) { 
                homeworks.splice(idx, 1); 
                localStorage.setItem("homeworks", JSON.stringify(homeworks)); 
                if (typeof renderHwCards === "function") renderHwCards(); 
                showToast("تم مسح الواجب 🗑️", "error");
            }
        }
        else if (action === "DELETE_SCHEDULE" && typeof schedule !== 'undefined') {
            const idx = schedule.findIndex(s => s.id == data.id); 
            if (idx > -1) { 
                schedule.splice(idx, 1); 
                localStorage.setItem("schedule", JSON.stringify(schedule)); 
                if (typeof renderSchedule === "function") renderSchedule(); 
                showToast("تم مسح الميعاد 🗑️", "error");
            }
        }
        else if (action === "DELETE_ALL_STUDENTS" && typeof students !== 'undefined') {
            students.splice(0, students.length); 
            localStorage.setItem("students", JSON.stringify(students)); 
            if (typeof renderTable === "function") renderTable(); 
            if (typeof renderDashboardCharts === "function") renderDashboardCharts();
            showToast("تم فرم جميع الطلاب! 🚨", "error");
        }
        else if (action === "DELETE_ALL_DATA") {
            if (typeof groups !== 'undefined') { groups.splice(0, groups.length); localStorage.setItem("groups", JSON.stringify(groups)); if (typeof renderGroupCards === "function") renderGroupCards(); }
            if (typeof classSessions !== 'undefined') { classSessions.splice(0, classSessions.length); localStorage.setItem("classSessions", JSON.stringify(classSessions)); if (typeof renderSessionCards === "function") renderSessionCards(); }
            if (typeof exams !== 'undefined') { exams.splice(0, exams.length); localStorage.setItem("exams", JSON.stringify(exams)); if (typeof renderExamCards === "function") renderExamCards(); }
            if (typeof homeworks !== 'undefined') { homeworks.splice(0, homeworks.length); localStorage.setItem("homeworks", JSON.stringify(homeworks)); if (typeof renderHwCards === "function") renderHwCards(); }
            if (typeof schedule !== 'undefined') { schedule.splice(0, schedule.length); localStorage.setItem("schedule", JSON.stringify(schedule)); if (typeof renderSchedule === "function") renderSchedule(); }
            if (typeof books !== 'undefined') { books.splice(0, books.length); localStorage.setItem("books", JSON.stringify(books)); if (typeof renderBooksTable === "function") renderBooksTable(); }
            
            showToast("تم تصفير السيستم بالكامل يا مدير! 🚀🗑️", "success");
        }

        // تحديث السحابة بعد أي أكشن
        if (typeof syncDataToBot === "function") syncDataToBot();
        
    } catch (e) { 
        console.error("Shefo Execution Error:", e); 
    }
}