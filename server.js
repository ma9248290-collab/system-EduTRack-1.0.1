const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer'); // هنحتاجها عشان نظبط المسار

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let lastQR = null;

// 1. حل مشكلة الصلاحيات: توجيه مسار الواتساب لفولدر (AppData) في الويندوز
const authPath = path.join(os.homedir(), 'AppData', 'Roaming', 'EduTrack System', 'whatsapp_session');
if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
}

// 2. حل مشكلة المتصفح المخفي جوه ملف الـ exe (استخراج المسار الصحيح)
let chromePath = puppeteer.executablePath();
if (chromePath.includes('app.asar')) {
    chromePath = chromePath.replace('app.asar', 'app.asar.unpacked');
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }), // استخدام المسار الآمن
    puppeteer: { 
        headless: true, 
        executablePath: chromePath, // استخدام مسار الكروميوم المفكوك
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', qr => {
    lastQR = qr;
});

client.on('ready', () => {
    console.log("✅ الواتساب متصل!");
    lastQR = null; 
});

let globalBatchCount = 0;
async function safeSend(phone, msg, isLast = false) {
    let retries = 3;
    let attempt = 0;
    let chatId = phone + "@c.us";
    
    while (attempt < retries) {
        try {
            // 1. التأكد إن الرقم عليه واتساب
            const isRegistered = await client.isRegisteredUser(chatId);
            if (!isRegistered) return false;
            
            const chat = await client.getChatById(chatId);
            
            // 2. محاكاة إن في شخص بيكتب (Typing...) "أقوى حماية من الحظر"
            await chat.sendStateTyping();
            
            // حساب وقت الكتابة بناءً على طول الرسالة (من 2 لـ 5 ثواني)
            const typingTime = Math.max(2000, Math.min(msg.length * 40, 5000));
            await new Promise(r => setTimeout(r, typingTime));
            
            await chat.clearState();
            
            // 3. إرسال الرسالة
            await client.sendMessage(chatId, msg);
            
            // 4. خوارزمية الفواصل الزمنية الذكية
            if (!isLast) {
                globalBatchCount++;
                if (globalBatchCount >= 15) { // كل 15 رسالة
                    // استراحة طويلة (من 3 لـ 5 دقايق) عشان خوارزميات واتساب ترتاح
                    const pauseTime = Math.floor(Math.random() * 120000) + 180000; 
                    console.log(`⏳ استراحة إجبارية لتجنب الحظر لمدة ${Math.round(pauseTime/1000)} ثانية...`);
                    await new Promise(r => setTimeout(r, pauseTime));
                    globalBatchCount = 0;
                } else {
                    // استراحة قصيرة عشوائية بين كل رسالة والتانية (من 8 لـ 15 ثانية)
                    const delayTime = Math.floor(Math.random() * 7000) + 8000; 
                    await new Promise(r => setTimeout(r, delayTime));
                }
            }
            return true;
        } catch (error) {
            attempt++;
            if (attempt > retries) return false;
            await new Promise(res => setTimeout(res, 3000)); // استراحة لو حصل إيرور قبل المحاولة التانية
        }
    }
}
app.post('/send', async (req, res) => {
    const { phone, message, isLast } = req.body; 
    const success = await safeSend(phone, message, isLast);
    res.json({ success });
});

app.get('/status', (req, res) => {
    const state = client.info ? 'connected' : (lastQR ? 'need_scan' : 'initializing');
    res.json({ status: state });
});

app.get('/qr', (req, res) => {
    res.json({ qr: lastQR });
});

try {
    client.initialize();
} catch(e) {
    console.error("خطأ في تهيئة الواتساب:", e);
}

try {
    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    }).on('error', (err) => {
        console.error("السيرفر لم يتمكن من التشغيل (ربما البورت مشغول):", err);
    });
} catch (e) {}