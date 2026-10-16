const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const pino = require('pino');
const puppeteer = require('puppeteer'); // Required for the receipt generator

// 🛠️ FIX 2: Gracefully handle dotenv for Hugging Face compatibility
try {
    require('dotenv').config(); // Ensure dotenv is loaded for process.env.PHONE locally
} catch (e) {
    console.log("ℹ️ 'dotenv' module not found. Relying on native environment variables (Hugging Face Secrets).");
}

// FORCE ENTIRE SERVER NATIVELY INTO INDIAN STANDARD TIME (IST)
process.env.TZ = "Asia/Kolkata";

// =========================================================
// 📱 CONFIGURE YOUR WHATSAPP NUMBER HERE 
// Securely pulling from environment variables / Hugging Face Secrets.
// =========================================================
const LINKING_PHONE_NUMBER = process.env.PHONE;

if (!LINKING_PHONE_NUMBER) {
    console.error("⚠️ [CRITICAL WARNING] 'PHONE' secret is missing! Warning kept for backward compatibility.");
}

// ---------------------------------------------------------
// PRODUCTION FIX: GLOBAL ERROR HANDLERS & GRACEFUL SHUTDOWN
// Prevents background library errors from crashing the app
// ---------------------------------------------------------
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL] Background Promise Rejection caught:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ [CRITICAL] Background Exception caught:', error);
});

// Advanced: Graceful termination to prevent session corruption on Hugging Face restarts
const shutdownHandler = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Executing graceful shutdown sequence...`);
    try {
        // Since Baileys doesn't use a browser, we just exit cleanly
        process.exit(0);
    } catch (err) {
        console.error("⚠️ Error during shutdown:", err);
        process.exit(1);
    }
};
process.on('SIGINT', shutdownHandler);
process.on('SIGTERM', shutdownHandler);

// ---------------------------------------------------------
// 1. FIREBASE & EXPRESS WEB SERVER SETUP
// ---------------------------------------------------------
// Initialize Firebase (Ensure you have your service account JSON in the root folder or as a Secret)
let serviceAccount;

if (process.env.FIREBASE_CREDENTIALS) {
    // Attempt 1: Load from Hugging Face Secrets (Production)
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        console.log("🔒 Firebase Credentials loaded securely from secrets.");
    } catch (err) {
        console.error("❌ ERROR: Your FIREBASE_CREDENTIALS secret is not valid JSON.");
        process.exit(1);
    }
} else {
    // Attempt 2: Load from local file (Local Testing)
    try {
        serviceAccount = require('./serviceAccountKey.json');
        console.log("⚠️ Firebase Credentials loaded from local file.");
    } catch (err) {
        console.error("❌ FATAL ERROR: No Firebase credentials found! Please add the FIREBASE_CREDENTIALS secret in Hugging Face Settings.");
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Initialize Express for the Web Dashboard
const app = express();
const PORT = process.env.PORT || 7860;

let isGeneratingNewCode = false; // Tracks if a manual code refresh was just triggered
let globalQRString = null;
let globalSocket = null;
let isSocketConnected = false;

// --- NEW API ENDPOINT: Force WA Client Restart for Fresh Code ---
app.post('/api/refresh-code', async (req, res) => {
    try {
        isGeneratingNewCode = true; 
        console.log("🔄 Manual client restart requested for a fresh QR code...");
        
        // Remove Baileys session folder completely
        fs.rmSync('./whatsapp-session-baileys', { recursive: true, force: true });
        globalQRString = null;
        
        setTimeout(startWhatsAppClient, 2000);
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to refresh code:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- NEW API ENDPOINT: Smart status checking ---
app.get('/api/pairing-status', async (req, res) => {
    if (globalQRString) {
        isGeneratingNewCode = false; 
        try {
            // Generate base64 dynamically from the Baileys QR string
            const qrBase64DataUrl = await qrcode.toDataURL(globalQRString, {
                color: { dark: '#000000', light: '#ffffff' }
            });
            res.json({ ready: true, qr: qrBase64DataUrl, linked: false });
        } catch (err) {
            console.error("⚠️ QR Generation Error:", err.message);
            res.json({ ready: false, linked: false });
        }
    } else {
        if (isGeneratingNewCode) {
            res.json({ ready: false, linked: false });
        } 
        else if (isSocketConnected) {
            res.json({ ready: false, linked: true });
        } 
        else {
            res.json({ ready: false, linked: false });
        }
    }
});

// --- ROOT WEBPAGE TO VIEW PAIRING CODE (DARK THEME REAL-TIME UI) ---
app.get('/', (req, res) => {
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>WhatsApp Device Link - Meena Marketing</title>
        <style>
            body {
                margin: 0; padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #0b111a;
                color: #e9edef;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                min-height: 100vh;
            }
            .container {
                background-color: #131b26; padding: 40px 25px;
                border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                border: 1px solid #1e293b;
                text-align: center; max-width: 400px; width: 85%;
                box-sizing: border-box;
            }
            h2 { 
                color: #10b981;
                margin-top: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;
            }
            p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin-bottom: 30px; }
            .code-container {
                background: #ffffff; padding: 10px; border-radius: 12px;
                display: inline-block; margin-bottom: 25px; border: 1px solid #1e293b;
                width: 100%; max-width: 280px;
                box-sizing: border-box;
            }
            .code-container img {
                width: 100%; height: auto; border-radius: 8px; display: block;
            }
            .btn {
                background-color: #10b981; color: #0b111a;
                border: none; padding: 14px 24px; border-radius: 24px;
                font-weight: 700; font-size: 15px; cursor: pointer;
                transition: background 0.2s; width: 100%; margin-bottom: 12px;
                box-sizing: border-box;
            }
            .btn:active { background-color: #059669; }
            .btn-secondary {
                background-color: transparent; color: #10b981;
                border: 1px solid #10b981; padding: 14px 24px; border-radius: 24px;
                font-weight: 700; font-size: 15px; cursor: pointer;
                transition: all 0.2s; width: 100%; margin-bottom: 12px; box-sizing: border-box;
            }
            .btn-secondary:active { background-color: rgba(16, 185, 129, 0.1); }
            .btn:disabled, .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
            .loader {
                border: 4px solid #1e293b; border-top: 4px solid #10b981;
                border-radius: 50%; width: 45px; height: 45px;
                animation: spin 1s linear infinite; margin: 0 auto 25px;
            }
            .footer { margin-top: 25px; font-size: 12px; color: #64748b; font-weight: 500;}
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            
            /* Success Animation */
            .success-icon {
                font-size: 60px; margin-bottom: 15px; display: inline-block;
                animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .pulse { display: inline-block; width: 18px; height: 18px; background-color: #10b981; border-radius: 50%; box-shadow: 0 0 0 rgba(16, 185, 129, 0.4); animation: pulse 2s infinite; vertical-align: middle; margin-right: 8px; }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
            @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Meena Marketing Server</h2>
            <div id="dynamic-content">
                <div class="loader"></div>
                <p>Checking system status...</p>
            </div>
        </div>
        <div class="footer">Securely managed by Goorac Systems</div>

        <script>
            let currentState = "INIT";
            let currentCode = "";
            
            function renderCode(qrSrc) {
                document.getElementById('dynamic-content').innerHTML = \`
                    <p>Open WhatsApp on your primary phone, navigate to <b>Linked Devices</b>, and scan the QR code below.</p>
                    <div class="code-container">
                      <img src="\` + qrSrc + \`" alt="WhatsApp QR Code">
                    </div>
                    <button class="btn-secondary" id="refresh-btn" onclick="forceNewCode()">🔄 Generate New QR</button>
                \`;
            }

            function forceNewCode() {
                const btn = document.getElementById('refresh-btn');
                if (btn) { btn.innerText = '⏳ Generating...'; btn.disabled = true; }
                
                // Tell backend to restart client
                fetch('/api/refresh-code', { method: 'POST' }).catch(err => console.error(err));
                
                // Immediately switch to waiting state visually
                currentState = 'WAITING';
                currentCode = '';
                document.getElementById('dynamic-content').innerHTML = \`
                    <div class="loader"></div>
                    <p>Requesting fresh QR code from WhatsApp...<br><br>Please wait a few seconds.</p>
                \`
            }
            
            function checkStatus() {
                fetch('/api/pairing-status')
                    .then(res => res.json())
                    .then(data => {
                        const container = document.getElementById('dynamic-content');
                        if (!container) return;

                        if (data.ready && data.qr) {
                            // Detected a pairing QR
                            if (currentState !== 'CODE' || currentCode !== data.qr) {
                                currentState = 'CODE';
                                currentCode = data.qr;
                                renderCode(data.qr);
                            }
                        } else if (data.linked) {
                            // Session connected
                            if (currentState !== 'LINKED') {
                                currentState = 'LINKED';
                                container.innerHTML = \`
                                    <div class="success-icon">✅</div>
                                    <p style="color: #10b981; font-weight: bold; font-size: 22px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;"><span class="pulse"></span> Online</p>
                                    <p>Meena Marketing WhatsApp Server is securely connected and actively listening.</p>
                                    <button class="btn-secondary" style="margin-top: 15px;" onclick="forceNewCode()">🔄 Re-Link Device</button>
                                \`;
                            }
                        } else {
                            // Booting up
                            if (currentState !== 'WAITING') {
                                currentState = 'WAITING';
                                container.innerHTML = \`
                                    <div class="loader"></div>
                                    <p>The system is generating the QR Code.<br><br>Waiting for WhatsApp Engine...</p>
                                \`;
                            }
                        }
                    })
                    .catch(err => console.error('Polling Error:', err))
                    .finally(() => {
                        setTimeout(checkStatus, 2500); 
                    });
            }
            checkStatus();
        </script>
    </body>
    </html>
    `;
    res.send(htmlTemplate);
});

// PRODUCTION FIX: Catch Express binding errors
app.listen(PORT, () => {
    console.log(`🌐 Web Dashboard running on port ${PORT}`);
}).on('error', (err) => {
    console.error('⚠️ [CRITICAL] Express Server Error:', err);
});

// ---------------------------------------------------------
// 2. WHATSAPP CLIENT (BAILEYS)
// ---------------------------------------------------------
// Helper for Baileys JID formatting
function getJid(phoneStr) {
    if (!phoneStr) return null;
    let num = String(phoneStr).replace(/\D/g, '');
    if (!num.endsWith('@s.whatsapp.net') && !num.endsWith('@c.us')) {
        num = num + '@s.whatsapp.net';
    } else {
        num = num.replace('@c.us', '@s.whatsapp.net'); // Baileys prefers s.whatsapp.net
    }
    return num;
}

async function startWhatsAppClient() {
    console.log('🚀 Booting Baileys WhatsApp Client...');
    const { state, saveCreds } = await useMultiFileAuthState('whatsapp-session-baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Suppress massive debug logs
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false
    });

    globalSocket = sock;

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('🔄 Authentication required. Capturing Baileys QR code string...');
            globalQRString = qr;
        }

        if (connection === 'close') {
            isSocketConnected = false;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect.error, ', reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                setTimeout(startWhatsAppClient, 5000);
            } else {
                console.log('User logged out. Please request a new QR code.');
                fs.rmSync('./whatsapp-session-baileys', { recursive: true, force: true });
                globalQRString = null;
                setTimeout(startWhatsAppClient, 2000);
            }
        } else if (connection === 'open') {
            console.log('✅ Baileys WhatsApp is ready!');
            isSocketConnected = true;
            globalQRString = null;
            loadDynamicModules();
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // --- ATTACH MESSAGE LISTENER TO BAILEYS SOCKET ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        
        // Ignore status broadcasts and bot's own messages
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

        const senderJid = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        if (!textMessage) return;

        const input = textMessage.trim();
        const normalizedInput = input.toLowerCase();

        // Helper for quick replies in Baileys
        const reply = async (text) => {
            await sock.sendMessage(senderJid, { text }, { quoted: msg });
        };

        try { 
            // -- ADMIN 1 REALTIME SALES TOGGLE FLOWS (HIGHLY OPTIMIZED WRITES) --
            if (normalizedInput === 'admin 1 off') {
                try {
                    admin1AlertsEnabled = false;
                    await db.collection('system_folder').doc('config').set({ admin1AlertsEnabled: false }, { merge: true });
                    return reply("📴 *Admin 1 Sales Alerts Suspended.*\nYou will no longer receive messaging alerts when a sales transaction is completed.");
                } catch (err) {
                    console.error("Failed turning off Admin 1 sales notification configuration:", err);
                    return reply("⚠️ Error connecting to database.");
                }
            }

            if (normalizedInput === 'admin 1 on') {
                try {
                    admin1AlertsEnabled = true;
                    await db.collection('system_folder').doc('config').set({ admin1AlertsEnabled: true }, { merge: true });
                    return reply("🔔 *Admin 1 Sales Alerts Restored.*\nYou will now seamlessly receive real-time updates for newly generated invoices.");
                } catch (err) {
                    console.error("Failed turning on Admin 1 sales notification configuration:", err);
                    return reply("⚠️ Error connecting to database.");
                }
            }

            // -- A. Change Admin 1 Flow --
            if (normalizedInput === 'change admin 1 number' || normalizedInput === 'change admin 1 phone number') {
                waitingForAdminUpdate[senderJid] = 1;
                return reply("🛡️ *Admin 1 Configuration*\nPlease enter the new Admin 1 Mobile Number.\n_(Example: 98765 43210 or +91 9876543210)_");
            }

            // -- B. Change Admin 2 Flow --
            if (normalizedInput === 'change admin 2 number' || normalizedInput === 'change admin 2 phone number') {
                waitingForAdminUpdate[senderJid] = 2;
                return reply("🛡️ *Admin 2 Configuration*\nPlease enter the new Admin 2 Mobile Number.\n_(Example: 98765 43210 or +91 9876543210)_");
            }

            // -- Change Admin 3 Flow --
            if (normalizedInput === 'change admin 3 number' || normalizedInput === 'change admin 3 phone number') {
                waitingForAdminUpdate[senderJid] = 3;
                return reply("🛡️ *Admin 3 Configuration*\nPlease enter the new Admin 3 Mobile Number.\n_(Example: 98765 43210 or +91 9876543210)_");
            }

            // -- Change Shop Number Flow --
            if (normalizedInput === 'change shop number' || normalizedInput === 'change shop phone number') {
                waitingForAdminUpdate[senderJid] = 'shop';
                return reply("🏪 *Shop Configuration*\nPlease enter the new Shop Mobile Number.\n_(Example: 98765 43210 or +91 9876543210)_");
            }

            // -- C. List Admins Flow --
            if (normalizedInput === 'list admin numbers' || normalizedInput === 'list admin phone number') {
                return reply(`📋 *Current Admin Configuration*\n\n👑 *Admin 1:* ${currentAdminPhone1 || 'Not set'} (Alerts: ${admin1AlertsEnabled ? 'Enabled' : 'Muted'})\n👑 *Admin 2:* ${currentAdminPhone2 || 'Not set'}\n👑 *Admin 3:* ${currentAdminPhone3 || 'Not set'}\n🏪 *Shop:* ${currentShopPhone || 'Not set'}`);
            }

            // -- E. Remove Admin 1 Flow --
            if (normalizedInput === 'remove admin 1 number' || normalizedInput === 'remove admin 1 phone number') {
                try {
                    await db.collection('system_folder').doc('config').set({ adminPhone1: null, adminPhone: null }, { merge: true });
                    currentAdminPhone1 = null;
                    return reply("🗑️ *Admin 1 Successfully Removed.*\nNo further alerts will be sent to this slot.");
                } catch (err) {
                    return reply("⚠️ Error updating database.");
                }
            }

            // -- F. Remove Admin 2 Flow --
            if (normalizedInput === 'remove admin 2 number' || normalizedInput === 'remove admin 2 phone number') {
                try {
                    await db.collection('system_folder').doc('config').set({ adminPhone2: null }, { merge: true });
                    currentAdminPhone2 = null;
                    return reply("🗑️ *Admin 2 Successfully Removed.*\nNo further alerts will be sent to this slot.");
                } catch (err) {
                    return reply("⚠️ Error updating database.");
                }
            }

            // -- Remove Admin 3 Flow --
            if (normalizedInput === 'remove admin 3 number' || normalizedInput === 'remove admin 3 phone number') {
                try {
                    await db.collection('system_folder').doc('config').set({ adminPhone3: null }, { merge: true });
                    currentAdminPhone3 = null;
                    return reply("🗑️ *Admin 3 Successfully Removed.*\nNo further alerts will be sent to this slot.");
                } catch (err) {
                    return reply("⚠️ Error updating database.");
                }
            }

            // -- Remove Shop Number Flow --
            if (normalizedInput === 'remove shop number' || normalizedInput === 'remove shop phone number') {
                try {
                    await db.collection('system_folder').doc('config').set({ shopPhone: null }, { merge: true });
                    currentShopPhone = null;
                    return reply("🗑️ *Shop Number Successfully Removed.*\nNo further alerts will be sent to this slot.");
                } catch (err) {
                    return reply("⚠️ Error updating database.");
                }
            }

            // -- Process Admin Input --
            if (waitingForAdminUpdate[senderJid]) {
                const adminSlot = waitingForAdminUpdate[senderJid];
                const formattedNewNumber = formatPhone(input);
                
                if (!formattedNewNumber) {
                    return reply("❌ *Invalid Number Format.*\nPlease enter a valid 10-digit Indian number.");
                }

                try {
                    if (adminSlot === 'shop') {
                        await db.collection('system_folder').doc('config').set({ shopPhone: formattedNewNumber }, { merge: true });
                        currentShopPhone = formattedNewNumber;
                        delete waitingForAdminUpdate[senderJid];
                        return reply(`✅ *Shop Number Successfully Updated*\nAll future inquiry confirmations will be sent to:\n*${formattedNewNumber}*`);
                    }

                    const fieldName = adminSlot === 1 ? 'adminPhone1' : (adminSlot === 2 ? 'adminPhone2' : 'adminPhone3');
                    await db.collection('system_folder').doc('config').set({ [fieldName]: formattedNewNumber }, { merge: true });
                    
                    if (adminSlot === 1) currentAdminPhone1 = formattedNewNumber;
                    else if (adminSlot === 2) currentAdminPhone2 = formattedNewNumber;
                    else currentAdminPhone3 = formattedNewNumber;
                    
                    delete waitingForAdminUpdate[senderJid];
                    
                    return reply(`✅ *Admin ${adminSlot} Successfully Updated*\nAll future billing alerts will be sent to:\n*${formattedNewNumber}*`);
                } catch (err) {
                    return reply("⚠️ Error updating database.");
                }
            }

            // -- D. Marketing Total Flow --
            if (normalizedInput === 'marketing total') {
                await reply("📊 _Calculating today's sales..._");
                
                try {
                    const today = new Date();
                    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
                    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

                    const q = await db.collection('sellings')
                        .where('date', '>=', startOfDay)
                        .where('date', '<=', endOfDay)
                        .get();

                    let cashTotal = 0;
                    let onlineTotal = 0;
                    let grandTotal = 0;
                    let count = 0;

                    q.forEach(doc => {
                        const data = doc.data();
                        const total = data.totals?.grand || 0;
                        const mode = (data.paymentMode || data.paymentMethod || 'Cash').toLowerCase();
                        
                        grandTotal += total;
                        count++;

                        if (mode === 'online') onlineTotal += total;
                        else cashTotal += total;
                    });

                    const summaryMsg = `📈 *MEENA MARKETING - DAILY SUMMARY*\n📅 ${today.toLocaleDateString('en-IN')}\n\n🧾 *Total Invoices:* ${count}\n💵 *Cash Sales:* ₹${cashTotal.toLocaleString()}\n📱 *Online Sales:* ₹${onlineTotal.toLocaleString()}\n\n🏆 *GRAND TOTAL: ₹${grandTotal.toLocaleString()}*`;
                    
                    return reply(summaryMsg);

                } catch (error) {
                    return reply("⚠️ Could not fetch sales data right now.");
                }
            }
        } catch (globalMsgError) {
            console.error("⚠️ [CRITICAL] Unhandled error in bot message listener:", globalMsgError);
        }
    });
}

// ---------------------------------------------------------
// 3. CORE UTILITIES & DUAL ADMIN SETUP
// ---------------------------------------------------------
const serverStartTime = new Date();
const sleep = (ms) => new Promise(res => setTimeout(res, ms)); 

let currentAdminPhone1 = null;
let currentAdminPhone2 = null;
let currentAdminPhone3 = null;
let currentShopPhone = null;
let admin1AlertsEnabled = true; 

// Fetch admins on boot
async function fetchAdminPhone() {
    try { 
        const docSnap = await db.collection('system_folder').doc('config').get();
        if (docSnap.exists) {
            const data = docSnap.data();
            currentAdminPhone1 = data.adminPhone1 || data.adminPhone || null;
            currentAdminPhone2 = data.adminPhone2 || null;
            currentAdminPhone3 = data.adminPhone3 || null;
            currentShopPhone = data.shopPhone || null;
            
            if (data.admin1AlertsEnabled !== undefined) {
                admin1AlertsEnabled = data.admin1AlertsEnabled;
            }
            
            console.log(`👑 Admin 1 Phone Loaded: ${currentAdminPhone1 || 'Not Set'} (Sales Alert State: ${admin1AlertsEnabled ? 'ACTIVE' : 'MUTED'})`);
            console.log(`👑 Admin 2 Phone Loaded: ${currentAdminPhone2 || 'Not Set'}`);
            console.log(`👑 Admin 3 Phone Loaded: ${currentAdminPhone3 || 'Not Set'}`);
            console.log(`🏪 Shop Phone Loaded: ${currentShopPhone || 'Not Set'}`);
        }
    } catch (err) {
        console.error("⚠️ Failed to fetch admin phones on boot:", err);
    }
}
fetchAdminPhone();

function formatPhone(num) {
    if (!num) return null;
    let cleaned = String(num).replace(/[^0-9+]/g, ''); 
    if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1); 
    if (cleaned.length === 10) cleaned = '+91' + cleaned; 
    if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = '+' + cleaned; 
    if (cleaned.length === 13 && cleaned.startsWith('+91')) return cleaned;
    return null;
}

// ---------------------------------------------------------
// 5. REAL-TIME BILLING TRIGGER (From Firebase)
// ---------------------------------------------------------
db.collection('sellings').where('createdAt', '>=', serverStartTime).onSnapshot(async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const billData = change.doc.data();
            if (billData.createdAt && billData.createdAt.toDate() < serverStartTime) return;
            if (!globalSocket || !isSocketConnected) return; // Prevent sending if socket is dead
            
            const invNo = billData.invoiceNo || 'N/A';
            const grandTotal = billData.totals?.grand || 0;
            const payMode = billData.paymentMode || 'Cash';
            let dateStr = billData.date ? billData.date.toDate().toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

            const activeAdmins = [];
            if (currentAdminPhone1 && admin1AlertsEnabled) activeAdmins.push(currentAdminPhone1);
            if (currentAdminPhone2) activeAdmins.push(currentAdminPhone2);
            if (currentAdminPhone3) activeAdmins.push(currentAdminPhone3);
            
            if (activeAdmins.length > 0) {
                let itemListText = '';
                if (billData.items && Array.isArray(billData.items)) {
                    billData.items.forEach(item => {
                        const modelText = item.model ? ` (Model: ${item.model})` : '';
                        itemListText += `- ${item.qty}x ${item.name}${modelText}\n`;
                    });
                }

                const adminAlert = `🚨 *NEW SALE ALERT*\n\n📄 *Invoice:* ${invNo}\n👤 *Customer:* ${billData.customer?.name || 'Cash Customer'}\n🛍️ *Purchased Items:*\n${itemListText}💰 *Amount:* ₹${grandTotal.toLocaleString()}\n💳 *Mode:* ${payMode}\n\n_Meena Marketing Backend_`;
                
                for (const adminPhone of activeAdmins) {
                    let messageToSend = adminAlert;

                    if (adminPhone === currentAdminPhone2 || adminPhone === currentAdminPhone3) {
                        const tamilNumbers = {
                            1: 'ஒன்று', 2: 'இரண்டு', 3: 'மூன்று', 4: 'நான்கு', 5: 'ஐந்து',
                            6: 'ஆறு', 7: 'ஏழு', 8: 'எட்டு', 9: 'ஒன்பது', 10: 'பத்து'
                        };

                        let parsedItemText = '';
                        if (billData.items && Array.isArray(billData.items) && billData.items.length > 0) {
                            if (billData.items.length === 1) {
                                const item = billData.items[0]; 
                                const pName = item.name || 'பொருள்';
                                const pQty = parseInt(item.qty) || 1;
                                const qtyInTamil = tamilNumbers[pQty] || pQty.toString();
                                parsedItemText = `${pName} ${qtyInTamil}`;
                            } else {
                                let parts = [];
                                billData.items.forEach((item) => {
                                    const pName = item.name || 'பொருள்';
                                    const pQty = parseInt(item.qty) || 1;
                                    const qtyInTamil = tamilNumbers[pQty] || pQty.toString();
                                    parts.push(`${pName} ${qtyInTamil}`);
                                });
                                const lastPart = parts.pop();
                                parsedItemText = parts.join(', ') + ', மற்றும் ' + lastPart;
                            }
                        } else {
                            parsedItemText = 'பொருட்கள்';
                        }
                        messageToSend = `கடையில், ${parsedItemText}, ரூ ${grandTotal.toLocaleString()}-க்கு விற்பனை ஆகி உள்ளது`;
                    }

                    try {
                        const targetJid = getJid(adminPhone);
                        await globalSocket.sendMessage(targetJid, { text: messageToSend });
                    } catch (e) {
                        console.log(`Failed to send admin alert to ${adminPhone} Error:`, e.message);
                    }
                }
            }

            const rawCustPhone = billData.customer?.phone;
            const formattedCustPhone = formatPhone(rawCustPhone);

            if (formattedCustPhone) {
                try {
                    const targetJid = getJid(formattedCustPhone);
                    const imageBuffer = await generateReceiptImage(billData);
                    
                    const receiptCaption = `🎉 *Thank you for shopping at Meena Marketing!*\n📄 Bill No: *${invNo}*\n💰 Total Amount: *₹${grandTotal.toLocaleString()}*\n📅 Date: ${dateStr}\n\n🎉 *மீனா மார்க்கெட்டிங்கில் பொருட்கள் வாங்கியமைக்கு நன்றி!*\n📄 பில் எண்: *${invNo}*\n💰 மொத்த தொகை: *₹${grandTotal.toLocaleString()}*\n📅 தேதி: ${dateStr}\n\n_System Generated Receipt_\n⚡ *Powered by Goorac*`;
                    
                    await globalSocket.sendMessage(targetJid, { image: imageBuffer, caption: receiptCaption });
                    console.log(`✅ Sent receipt to customer for ${invNo}`);
                    
                    const thankYouUrl = `https://huggingface.co/datasets/corporationgoorac/marketingVoice/resolve/main/image.png?t=${Date.now()}`;
                    const thankYouCaption = `🎉 *Thank you for choosing Meena Marketing!*\n🎉 *மீனா மார்க்கெட்டிங்கைத் தேர்ந்தெடுத்ததற்கு நன்றி!*\n\n⚡ _Powered by Goorac_`;
                    
                    await sleep(2000); 
                    await globalSocket.sendMessage(targetJid, { image: { url: thankYouUrl }, caption: thankYouCaption });
                    console.log(`✅ Sent Thank You image to customer for ${invNo}`);
                    
                } catch (err) {
                    console.error("Error sending customer receipt:", err.message);
                }
            } else {
                console.log(`ℹ️ Bill ${invNo} saved with no valid customer phone. Admin alerted.`);
            }
        }
    });
}, (error) => {
    console.error('🔥 [FATAL] Firestore Sellings Snapshot Error:', error);
});

// ---------------------------------------------------------
// 5B. REAL-TIME PRODUCT INQUIRY TRIGGER ("ASK" HOOK)
// ---------------------------------------------------------
db.collection('ask').doc('ask').onSnapshot(async (docSnap) => {
    if (!docSnap.exists) return;
    const askData = docSnap.data();

    let clickedDate = null;
    if (askData.clickedTime) {
        clickedDate = typeof askData.clickedTime.toDate === 'function' ? askData.clickedTime.toDate() : new Date(askData.clickedTime);
    }
    if (clickedDate && clickedDate < serverStartTime) return;
    if (!globalSocket || !isSocketConnected) return;

    if (!currentAdminPhone1) {
        console.log("⚠️ Product inquiry received but Admin 1 phone number is unset. Dispatch aborted.");
        return;
    }

    const prodName = askData.name || 'N/A';
    const prodModel = askData.model || 'N/A';
    const prodBase = askData.basePrice || askData.price || 0;
    const prodMrp = askData.mrp || 0;
    const prodMyRate = askData.myRate || 0;
    const prodQty = askData.qty || 0;

    const inquiryMessage = `📦 *PRODUCT INQUIRY ALERT*
━━━━━━━━━━━━━━━━━━
🔹 *Item:* ${prodName}
🔖 *Model:* ${prodModel}
📦 *Stock Qty:* ${prodQty}

💰 *Base Price:* Rs. ${prodBase.toLocaleString()}
🏷️ *MRP:* Rs. ${prodMrp.toLocaleString()}
⭐ *MY RATE:* Rs. ${prodMyRate.toLocaleString()} 👈

━━━━━━━━━━━━━━━━━━
_Meena Marketing Internal_`;

    try {
        const adminJid = getJid(currentAdminPhone1);
        await globalSocket.sendMessage(adminJid, { text: inquiryMessage });
        console.log(`✅ Inquiry details for "${prodName}" dispatched successfully to Admin 1.`);
    } catch (err) {
        console.error("Error processing text delivery for product inquiry alert stream:", err.message);
    }

    if (currentShopPhone) {
        let shopInquiryMessage = "";
        const parsedBasePrice = parseFloat(prodBase) || 0;
        const parsedMyRate = parseFloat(prodMyRate) || 0;

        if (!parsedMyRate || parsedMyRate <= 0 || parsedMyRate >= parsedBasePrice) {
            shopInquiryMessage = `✅ *INQUIRY CONFIRMATION*
━━━━━━━━━━━━━━━━━━
🔹 *Product:* ${prodName}
🔖 *Model:* ${prodModel}
📦 *Stock Qty:* ${prodQty}

_Request has been successfully dispatched to Admin._`;
        } else {
            const profit = parsedBasePrice - parsedMyRate;
            let targetDiscount = parsedBasePrice < 3000 ? parsedBasePrice * 0.04 : (parsedBasePrice <= 10000 ? parsedBasePrice * 0.025 : parsedBasePrice * 0.015);
            if (targetDiscount > 500) targetDiscount = 500;
            const profitShield = profit * 0.15;
            let maxAllowedDiscount = Math.min(targetDiscount, profitShield);
            maxAllowedDiscount = Math.floor(maxAllowedDiscount); 
            const bottomPrice = parsedBasePrice - maxAllowedDiscount;

            shopInquiryMessage = `✅ *INQUIRY LOGGED & ANALYZED*
━━━━━━━━━━━━━━━━━━
🔹 *Product:* ${prodName}
🔖 *Model:* ${prodModel}
📦 *Stock Qty:* ${prodQty}

💰 *Standard Price:* Rs. ${parsedBasePrice.toLocaleString()}
🟢 *Max AI Discount Allowed:* Rs. ${maxAllowedDiscount.toLocaleString()}
🛑 *Absolute Bottom Price:* Rs. ${bottomPrice.toLocaleString()}

_Request has been successfully dispatched to Admin for final review if further negotiation is needed._`;
        }

        try {
            const shopJid = getJid(currentShopPhone);
            await globalSocket.sendMessage(shopJid, { text: shopInquiryMessage });
            console.log(`✅ Inquiry confirmation dispatched successfully to the Shop number.`);
        } catch (err) {
            console.error("Error processing text delivery for shop confirmation stream:", err.message);
        }
    }
}, (error) => {
    console.error('🔥 [FATAL] Firestore Ask Snapshot Error:', error);
});

// ---------------------------------------------------------
// 5C. REAL-TIME INVENTORY REDUCTION ALERT 
// ---------------------------------------------------------
db.collection('alerts').doc('stock_reduction').onSnapshot(async (docSnap) => {
    if (!docSnap.exists) return;
    const alertData = docSnap.data();

    let editTime = null;
    if (alertData.lastUpdated) editTime = new Date(alertData.lastUpdated);
    if (editTime && editTime < serverStartTime) return;
    if (!globalSocket || !isSocketConnected) return;

    const activeAdmins = [];
    if (currentAdminPhone1) activeAdmins.push(currentAdminPhone1);
    if (currentAdminPhone2) activeAdmins.push(currentAdminPhone2);
    if (currentAdminPhone3) activeAdmins.push(currentAdminPhone3);

    if (activeAdmins.length === 0) return;

    const prodName = alertData.name || 'N/A';
    const prodModel = alertData.model || 'N/A';
    const oldQty = alertData.previousQty || 0;
    const newQty = alertData.qty || 0;
    const reducedBy = oldQty - newQty;
    const prodPrice = alertData.price || 0;
    const staffName = alertData.lastEditBy || 'Unknown Staff';
    const editReason = alertData.lastEditReason || 'No reason provided';

    let timeString = "Unknown Time";
    if (editTime) {
        timeString = editTime.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: '2-digit', month: 'short', year: 'numeric' });
    }

    const englishAlertMessage = `📉 *STOCK REDUCTION ALERT*
━━━━━━━━━━━━━━━━━━
📦 *Product:* ${prodName}
🔖 *Model:* ${prodModel}
💰 *Base Price:* Rs. ${prodPrice.toLocaleString()}

📉 *Stock Change:* ${oldQty} ➔ ${newQty} (-${reducedBy})
👤 *Edited By:* ${staffName}
⏱️ *Time:* ${timeString}

🚨 *Reason:* _*${editReason}*_
━━━━━━━━━━━━━━━━━━
_Meena Marketing Security_`;

    const tamilNumbers = { 1: 'ஒன்று', 2: 'இரண்டு', 3: 'மூன்று', 4: 'நான்கு', 5: 'ஐந்து', 6: 'ஆறு', 7: 'ஏழு', 8: 'எட்டு', 9: 'ஒன்பது', 10: 'பத்து' };
    const qtyInTamil = tamilNumbers[reducedBy] || reducedBy.toString();
    const tamilAlertMessage = `கடையில், ${prodName} ${qtyInTamil} இருப்பு குறைக்கப்பட்டுள்ளது.`;

    for (const adminPhone of activeAdmins) {
        let messageToSend = (adminPhone === currentAdminPhone1) ? englishAlertMessage : tamilAlertMessage;
        try {
            const adminJid = getJid(adminPhone);
            await globalSocket.sendMessage(adminJid, { text: messageToSend });
            console.log(`✅ Stock reduction alert sent to Admin (${adminPhone}) for "${prodName}"`);
        } catch (err) {
            console.error("Error sending stock reduction alert:", err.message);
        }
    }
}, (error) => {
    console.error('🔥 [FATAL] Firestore Stock Alert Snapshot Error:', error);
});

// ---------------------------------------------------------
// 6. PUPPETEER IMAGE GENERATOR (Adapted for Baileys)
// ---------------------------------------------------------
async function generateReceiptImage(data) {
    // Launch an isolated Puppeteer instance since Baileys doesn't have one
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
        const page = await browser.newPage(); 
        await page.setViewport({ width: 600, height: 800 }); 

        const isLightMode = Math.random() < 0.5;
        const themeVars = isLightMode ? `
            --bg-body: #f3f4f6; --bg-card: #ffffff; --border-color: #e5e7eb; --border-dashed: #d1d5db;
            --text-main: #111827; --text-muted: #6b7280; --brand-color: #dc2626; --shadow: 0 10px 40px rgba(0,0,0,0.08);
            --meta-bg: #f8fafc; --tag-bg: #2563eb; --tag-text: #ffffff; --total-color: #059669;
        ` : `
            --bg-body: #000000; --bg-card: #0f0f11; --border-color: #27272a; --border-dashed: #3f3f46;
            --text-main: #ffffff; --text-muted: #a1a1aa; --brand-color: #ef4444; --shadow: 0 10px 40px rgba(0,0,0,0.8);
            --meta-bg: #18181b; --tag-bg: #3b82f6; --tag-text: #ffffff; --total-color: #10b981;
        `;

        const itemsHtml = (data.items || []).map(item => {
            const modelHtml = item.model ? `<div style="color:var(--text-muted); font-size:11px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width: 100%;">Model: ${item.model}</div>` : '';
            return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:15px; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                <div style="flex: 1; min-width: 0; word-break: break-word; overflow-wrap: break-word;">
                    <div style="font-weight:700; font-size:16px; line-height:1.4; color: var(--text-main);">${item.name}</div>
                    ${modelHtml}
                    <div style="color:var(--text-muted); font-size:13px; margin-top:4px;">${item.qty} x Rs. ${(item.price || 0).toLocaleString()}</div>
                </div>
                <div style="font-weight:700; font-size:16px; white-space:nowrap; text-align:right; min-width:80px; color: var(--text-main);">Rs. ${(item.finalTotal || 0).toLocaleString()}</div>
            </div>
            `;
        }).join('');

        const htmlContent = `
        <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Noto+Sans+Tamil:wght@400;700&display=swap');
                :root { ${themeVars} }
                body { background: var(--bg-body); color: var(--text-main); font-family: 'Inter', 'Noto Sans Tamil', sans-serif; padding: 30px; margin: 0; box-sizing: border-box;}
                .receipt-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 30px; box-shadow: var(--shadow);}
                .header { text-align: center; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); }
                .brand { font-size: 28px; font-weight: 900; color: var(--brand-color); letter-spacing: -0.5px; margin-bottom: 4px;}
                .sub { color: var(--text-muted); font-size: 14px; font-weight: 500;}
                .loc { color: var(--text-muted); font-size: 12px; margin-top: 2px;}
                .meta { display: flex; justify-content: space-between; align-items: center; background: var(--meta-bg); padding: 15px; border-radius: 10px; margin-bottom: 25px; border: 1px solid var(--border-color); }
                .meta-left { display: flex; flex-direction: column; gap: 4px; }
                .meta-name { font-weight: 700; font-size: 16px; color: var(--text-main); }
                .meta-inv { color: var(--text-muted); font-size: 13px; font-weight: 500; }
                .pay-tag { background: var(--tag-bg); padding: 6px 14px; border-radius: 8px; font-weight: 700; color: var(--tag-text); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
                .totals { margin-top: 25px; padding-top: 20px; border-top: 2px dashed var(--border-dashed); }
                .t-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; color: var(--text-main); }
                .t-row span:last-child { white-space: nowrap; text-align: right; font-weight: 600; }
                .t-grand { font-size: 22px; font-weight: 900; color: var(--total-color); margin-top: 20px; padding-top: 15px; border-top: 1px solid var(--border-color); }
                .footer { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 35px; line-height: 1.6; font-weight: 500;}
            </style>
        </head>
        <body>
            <div class="receipt-card">
                <div class="header">
                    <div class="brand">MEENA MARKETING</div>
                    <div class="sub">Electronics & Furnitures</div>
                    <div class="loc">Alwarthirunagiri</div>
                </div>
                <div class="meta">
                    <div class="meta-left">
                        <span class="meta-name">${data.customer?.name || 'Cash Customer'}</span>
                        <span class="meta-inv">Inv: ${data.invoiceNo}</span>
                    </div>
                    <div><span class="pay-tag">${data.paymentMode || 'Cash'}</span></div>
                </div>
                <div class="items">${itemsHtml}</div>
                <div class="totals">
                    <div class="t-row"><span style="color:var(--text-muted)">Subtotal</span><span>Rs. ${(data.totals?.sub || 0).toLocaleString()}</span></div>
                    <div class="t-row"><span style="color:var(--text-muted)">Tax (GST)</span><span>Rs. ${(data.totals?.gst || 0).toLocaleString()}</span></div>
                    <div class="t-row t-grand"><span>TOTAL</span><span>Rs. ${(data.totals?.grand || 0).toLocaleString()}</span></div>
                </div>
                <div class="footer">Thank you for your business!<br>Powered by Goorac Software Solutions</div>
            </div>
        </body>
        </html>`;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const screenshot = await page.screenshot({ type: 'png', fullPage: true });
        return screenshot;
    } finally {
        await browser.close();
    }
}

// ---------------------------------------------------------
// 7. DYNAMIC MODULE LOADER 
// ---------------------------------------------------------
let modulesLoaded = false; 

function loadDynamicModules() {
    if (modulesLoaded) {
        console.log('📦 Modules already loaded. Skipping re-initialization on reconnect.');
        return;
    }
    modulesLoaded = true;

    // To use these modules with Baileys, their internal code (sendMessage, message events) 
    // must also be updated to the Baileys API format.
    if (fs.existsSync('./marketing.js')) {
        console.log('📦 Loading marketing.js module...');
        require('./marketing.js')(globalSocket, db);
    } else if (fs.existsSync('./mrkting.js')) {
        console.log('📦 Loading mrkting.js module...');
        require('./mrkting.js')(globalSocket, db);
    }

    if (fs.existsSync('./other.js')) {
        console.log('📦 Loading other.js module...');
        require('./other.js')(globalSocket, db);
    }

    if (fs.existsSync('./gstReporter.js')) {
        console.log('📦 Loading gstReporter.js module...');
        require('./gstReporter.js')(globalSocket, db);
    }
}

// Start the engine
startWhatsAppClient();
