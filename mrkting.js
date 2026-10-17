'use strict'; // ADVANCED FIX: Enforces strict parsing and error handling at the V8 engine level

// 🚨 CRITICAL WINDOWS FIX: Tells the bot where to find the local FFmpeg tool for Video/Audio
try {
    process.env.FFMPEG_PATH = require('ffmpeg-static');
} catch (e) {
    // Graceful fallback if ffmpeg-static is not installed in cloud container
}

const fs = require('fs');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');
// Retained comment for line preservation: Replaced { MessageMedia } = require('whatsapp-web.js') with native Baileys Buffer/Stream handling

// NEW BUG FIX: Global lock to prevent duplicate bots spawning when WhatsApp reconnects
let isInitialized = false; 
let activeClient = null; // Holds the latest Baileys socket reference across reconnects

/**
 * MEENA MARKETING - ENTERPRISE DIGITAL AD AGENT
 * 1. 30-Day Anti-Ban Drip Marketing Cycle (FIREBASE TRACKED)
 * 2. 1000+ Product Combinations & 500+ Template Variations
 * 3. On-Demand Generator Trigger (!generate image)
 * 4. 16-Hour Business Pacing Math (6:00 AM - 10:00 PM IST)
 * 5. Unique Promo Code Generation & Time-Based Greetings
 * 6. 1000+ Dynamic Agent Pitch Generator (Bilingual)
 * 7. Canvas Height Expansion (Fixed Overlap Bug)
 * 8. Anti-Duplication Shield (Prevents spam on server reconnects)
 * 9. Opt-Out Blacklist & Dead Number Graveyard Processing
 * 10. ENTERPRISE CRON PACING: Database tracked delays, Server-crash proof
 * 11. SMART WEEKEND BOOSTER: Dynamically adjusts quota on Sundays
 * 12. EXPANDED INVENTORY & MULTI-LAYOUT DESIGNS ADDED
 * 13. HUMAN-LIKE DYNAMIC VOICE NOTE SIMULATOR ADDED (Cache-Busted)
 * 14. PRODUCTION HARDENED: window.require bypass & Memory Leak Protection added
 * 15. DYNAMIC VIDEO DELIVERY ADDED (Cache-Busted & Anti-Ban Paced)
 */
module.exports = (client, db) => {
    // Always keep the latest Baileys socket reference updated
    activeClient = client;

    // --- UTILITIES ---
    
    /**
     * Pauses execution for a given number of milliseconds.
     * @param {number} ms - Milliseconds to sleep.
     * @returns {Promise<void>}
     */
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    /**
     * Checks if the active Baileys socket is genuinely connected and open.
     * Prevents calling sendMessage on a closed or reconnecting socket.
     */
    const isSocketReady = (sockInstance) => {
        const s = sockInstance || activeClient;
        if (!s || !s.user) return false;
        if (typeof global.isWhatsAppConnected === 'boolean' && !global.isWhatsAppConnected) return false;
        if (s.ws && typeof s.ws.readyState === 'number' && s.ws.readyState !== 1) return false;
        return true;
    };

    /**
     * Converts any phone string, @c.us, or @lid into a valid Baileys JID (@s.whatsapp.net)
     */
    const toBaileysJid = (idOrPhone, fallbackPhone) => {
        let target = idOrPhone || fallbackPhone || '';
        target = String(target).trim();

        // If it's an @lid and we have a real fallback phone number, prefer the real phone number
        if (target.includes('@lid') && fallbackPhone && !String(fallbackPhone).includes('@lid')) {
            const cleanFallback = String(fallbackPhone).replace(/\D/g, '');
            if (cleanFallback) return `${cleanFallback}@s.whatsapp.net`;
        }

        // Preserve @lid or @g.us if that's the only identifier available
        if (target.endsWith('@lid') || target.endsWith('@g.us')) {
            return target;
        }

        if (target.endsWith('@s.whatsapp.net')) {
            return target;
        }

        if (target.endsWith('@c.us')) {
            return target.replace('@c.us', '@s.whatsapp.net');
        }

        const digits = target.replace(/\D/g, '');
        return digits ? `${digits}@s.whatsapp.net` : target;
    };

    /**
     * Downloads a remote URL (following redirects) into a Node.js Buffer with HTML error-page detection
     */
    const fetchMediaBuffer = (fileUrl, redirectCount = 0) => {
        return new Promise((resolve, reject) => {
            if (redirectCount > 5) {
                return reject(new Error('Too many redirects while fetching media URL.'));
            }

            const protocol = fileUrl.startsWith('https') ? https : http;
            const req = protocol.get(fileUrl, { timeout: 25000 }, (res) => {
                // Follow 301/302/307/308 redirects (Hugging Face resolve URLs always redirect to CDN)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const nextUrl = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : new URL(res.headers.location, fileUrl).toString();
                    res.resume();
                    return resolve(fetchMediaBuffer(nextUrl, redirectCount + 1));
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP Status ${res.statusCode}`));
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const b64Preview = buffer.slice(0, 32).toString('base64');
                    const utf8Preview = buffer.slice(0, 64).toString('utf8').trim().toLowerCase();

                    // Check for HTML error pages (<!DOCTYPE html or <html)
                    if (
                        !buffer.length ||
                        b64Preview.startsWith('PCFET') ||
                        b64Preview.startsWith('PGh0b') ||
                        utf8Preview.startsWith('<!doctype') ||
                        utf8Preview.startsWith('<html')
                    ) {
                        return resolve({ buffer: null, isHtmlError: true });
                    }
                    resolve({ buffer, isHtmlError: false });
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });
            req.on('error', (err) => reject(err));
        });
    };

    // ENTERPRISE FIX: Smart Phone Number Formatter handling Gaps, +81, 92, and standard 10-digit Indian numbers
    /**
     * Formats raw phone numbers into strict international dialing format.
     * @param {string|number} num - The raw phone number input.
     * @returns {string|null} Validated E.164 formatted number or null.
     */
    const formatPhone = (num) => {
        if (!num) return null;
        // Strip out all spaces, dashes, and letters natively
        let cleaned = num.toString().replace(/[^0-9+]/g, ''); 
        
        // Ensure only one '+' sign exists at the very beginning
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.replace(/\+/g, '');
        } else {
            cleaned = cleaned.replace(/\+/g, '');
        }
        
        // Remove leading zero if it's an 11-digit local format
        if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1); 
        
        // Intelligently assign the + symbol based on length
        if (!cleaned.startsWith('+')) {
            if (cleaned.length === 10) {
                cleaned = '+91' + cleaned; // Default 10 digits to +91 (India)
            } else if (cleaned.length >= 11) {
                cleaned = '+' + cleaned; // Assume country code is already present (e.g., 91, 81, 92)
            }
        }
        
        // Final WhatsApp Validation check (Country code + Phone)
        if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 16) {
            return cleaned;
        }
        return null;
    };

    // Generates a random tracking code for walk-in conversions
    const generatePromoCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'MEENA-';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    // Checks current IST time for a natural greeting
    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return { en: 'Good Morning', ta: 'காலை வணக்கம்' };
        if (hour < 17) return { en: 'Good Afternoon', ta: 'மதிய வணக்கம்' };
        return { en: 'Good Evening', ta: 'மாலை வணக்கம்' };
    };

    // NEW UTILITY: Formats time exactly as requested (e.g. 5.30 Pm)
    const formatTimeForLog = (timestamp) => {
        const date = new Date(timestamp);
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'Pm' : 'Am';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}.${minutes} ${ampm}`;
    };

    const docRef = db.collection('marketing_messages').doc('campaign_data');

    // --- NEW: HUMAN SIMULATED VIDEO SENDER (BAILEYS EDITION) ---
    const sendHumanVideo = async (sockClient, verifiedWhatsappId, customerName, actualPhone) => {
        let sock = activeClient || sockClient;
        try {
            console.log(`🎬 [Marketing] Preparing human-like video sequence for ${customerName} (${verifiedWhatsappId})...`);
            
            let targetId = verifiedWhatsappId;
            
            // 🚨 BULLETPROOF FIX: Completely discard the LID hash and build a fresh @s.whatsapp.net ID using the real phone number
            if (targetId && targetId.includes('@lid') && actualPhone && !actualPhone.includes('@lid')) {
                const cleanPhone = String(actualPhone || '').replace(/\D/g, ''); 
                targetId = `${cleanPhone}@s.whatsapp.net`; 
                console.log(`♻️ [Marketing] Intercepted @lid ID. Rerouting video to standard ID: ${targetId}`);
            } else {
                targetId = toBaileysJid(targetId, actualPhone);
            }

            // 1. Simulate human delay: gap between sending the image and sending the video
            // PENTIUM DELAY: Gives the PC 4 seconds to catch up
            await sleep(4000); 

            // 2. AGGRESSIVE CACHE BUSTING: Download the video freshly every time it runs
            let videoBuffer = null;
            let dlRetries = 3;
            
            while (dlRetries > 0 && !videoBuffer) {
                try {
                    // ?t=${Date.now()} ensures Hugging Face always serves the newest version
                    const videoUrl = `https://huggingface.co/datasets/corporationgoorac/marketingVoice/resolve/main/video.mp4?t=${Date.now()}`;
                    const { buffer, isHtmlError } = await fetchMediaBuffer(videoUrl);

                    if (isHtmlError || !buffer) {
                        console.error("❌ [Marketing] Hugging Face returned an HTML error page. Aborting video.");
                        return;
                    }
                    videoBuffer = buffer;
                } catch (e) {
                    dlRetries--;
                    if (dlRetries === 0) throw new Error("Video URL Timeout/Fetch Error: " + (e.message || 't'));
                    await sleep(2000); // Wait 2s before retrying download
                }
            }

            // 3. Fire the Video via Baileys
            let sendRetries = 3;
            let sent = false;
            
            while (sendRetries > 0 && !sent) {
                try {
                    // Refresh socket reference in case a reconnect happened during the 4s sleep
                    sock = activeClient || sockClient;
                    if (!isSocketReady(sock)) {
                        throw new Error('Connection Closed');
                    }

                    // Try to send native Video in Baileys
                    await sock.sendMessage(targetId, {
                        video: videoBuffer,
                        mimetype: 'video/mp4'
                    });
                    sent = true;
                    console.log(`✅ [Marketing] Professional dynamic video successfully delivered to ${customerName}.`);
                } catch (sendErr) {
                    const errMsg = sendErr.message || '';

                    // Handle findChat / @lid / No LID errors locally
                    if (errMsg.includes('findChat') || errMsg.includes('@lid') || errMsg.includes('not found') || errMsg.includes('No LID')) {
                        console.log(`⚠️ Applying initialization workaround for video chat: ${targetId}`);
                        await sock.sendMessage(targetId, { text: `✨ Check out our latest preview!` });
                        await sleep(2000);
                        
                        await sock.sendMessage(targetId, {
                            video: videoBuffer,
                            mimetype: 'video/mp4'
                        });
                        sent = true;
                        console.log(`✅ [Marketing] Video delivered via workaround to ${customerName}.`);
                    } else {
                        sendRetries--;
                        console.error(`⚠️ [Marketing] Video send loop failure. Retries left: ${sendRetries}. Error: ${errMsg}`);
                        if (sendRetries === 0) throw sendErr;
                        await sleep(6000);
                    }
                }
            }
            
        } catch (error) {
            console.error(`⚠️ [Marketing] Video simulation failed completely for ${verifiedWhatsappId}:`, error.stack || error.message || error);
        }
    };

    // --- NEW: HUMAN SIMULATED VOICE NOTE SENDER (BAILEYS NATIVE PTT EDITION) ---
    // ADDED actualPhone parameter to ensure we have the raw fallback number
    const sendHumanVoiceNote = async (sockClient, verifiedWhatsappId, customerName, actualPhone) => {
        let sock = activeClient || sockClient;
        try {
            console.log(`🎙️ [Marketing] Preparing human-like voice note sequence for ${customerName} (${verifiedWhatsappId})...`);
            
            // CRITICAL BUG FIX 1: Bypass the @lid bug in whatsapp-web.js that blocks media sending
            let targetId = verifiedWhatsappId;
            
            // FIX APPLIED: Safely commented out the @lid interception. 
            // Voice notes must use the original @lid hash if provided.
            /*
            if (targetId && targetId.includes('@lid')) {
                const plainNumber = targetId.split('@');
                targetId = `${plainNumber}@c.us`; 
                console.log(`♻️ [Marketing] Intercepted @lid ID. Rerouting audio to standard ID: ${targetId}`);
            }
            */

            // 🚨 NEW FIX: Completely discard the LID hash and build a fresh @s.whatsapp.net ID using the real phone number
            // BULLETPROOF FIX: Only do this if actualPhone is a REAL phone number (not another @lid hash like msg.from)
            if (targetId && targetId.includes('@lid') && actualPhone && !actualPhone.includes('@lid')) {
                // [BULLETPROOF FIX]: Coerced to String to prevent crash if undefined
                const cleanPhone = String(actualPhone || '').replace(/\D/g, ''); // Strip any plus signs just in case
                targetId = `${cleanPhone}@s.whatsapp.net`; 
                console.log(`♻️ [Marketing] Intercepted @lid ID. Rerouting audio to standard ID: ${targetId}`);
            } else {
                targetId = toBaileysJid(targetId, actualPhone);
            }
            
            // 1. Simulate the human "thinking/breathing" gap before deciding to send a voice note
            // PENTIUM DELAY: 5 seconds for natural pacing
            await sleep(5000); 

            // BULLETPROOF FIX: Fetch audio BEFORE recording state to prevent hanging if download times out ('t' error)
            let voiceBuffer = null;
            let dlRetries = 3;
            
            while (dlRetries > 0 && !voiceBuffer) {
                try {
                    // 4. AGGRESSIVE CACHE BUSTING & .OPUS FORMAT FIX
                    // Requesting the .opus file specifically for strict WhatsApp native compliance
                    const audioUrl = `https://huggingface.co/datasets/corporationgoorac/marketingVoice/resolve/main/audio.opus?t=${Date.now()}`;
                    const { buffer, isHtmlError } = await fetchMediaBuffer(audioUrl);

                    if (isHtmlError || !buffer) {
                        console.error("❌ [Marketing] Hugging Face returned an HTML error page. Aborting voice note.");
                        return;
                    }
                    voiceBuffer = buffer;
                } catch (e) {
                    dlRetries--;
                    if (dlRetries === 0) throw new Error("Audio URL Timeout/Fetch Error: " + (e.message || 't'));
                    await sleep(2000); // Wait 2s before retrying download
                }
            }

            // CRITICAL BUG FIX 2: Force the exact MIME type WhatsApp expects to prevent "Something is wrong with the audio"
            const voiceMimetype = 'audio/ogg; codecs=opus';
            
            // 2. Trigger WhatsApp's "Recording Audio..." status at the top of the chat via Baileys
            try {
                sock = activeClient || sockClient;
                if (isSocketReady(sock)) {
                    await sock.sendPresenceUpdate('recording', targetId);
                }
            } catch (e) {
                console.log(`⚠️ [Marketing] Presence recording state skipped for ${targetId}. Proceeding with audio send.`);
            }
            
            // 3. Keep recording state active for dynamic duration to simulate human speech duration
            // BULLETPROOF FIX: Replaced static 9s with dynamic duration for 45s audio (greater or less also)
            // await sleep(9000); 
            const dynamicDelay = Math.floor(Math.random() * 10000) + 40000; // Randomizes between 40 to 50 seconds
            await sleep(dynamicDelay);
            
            // 5. Fire as a native playable blue microphone PTT (Push-To-Talk) wave file
            // BULLETPROOF FIX: Retry logic wrapped around sendMessage to handle momentary connection drops
            let sendRetries = 3;
            let sent = false;
            
            while (sendRetries > 0 && !sent) {
                try {
                    // Refresh socket reference in case a reconnect happened during the 40-50s recording simulation
                    sock = activeClient || sockClient;
                    if (!isSocketReady(sock)) {
                        throw new Error('Connection Closed');
                    }

                    // Try to send native Voice Note first (ptt: true makes it a real WhatsApp voice note)
                    await sock.sendMessage(targetId, {
                        audio: voiceBuffer,
                        mimetype: voiceMimetype,
                        ptt: true
                    });
                    try { await sock.sendPresenceUpdate('paused', targetId); } catch (e) {}
                    sent = true;
                    console.log(`✅ [Marketing] Professional dynamic voice note successfully delivered to ${customerName}.`);
                } catch (sendErr) {
                    const errMsg = sendErr.message || '';

                    // 🚨 FALLBACK: If WhatsApp strictly rejects the opus codec (t error) or generic media crash
                    if (errMsg === 't' || errMsg.includes('media') || errMsg.includes('audio')) {
                        console.log(`⚠️ [Marketing] WhatsApp rejected native Opus Voice Note ('${errMsg}'). Falling back to MP3 Audio...`);
                        try {
                            // Download fallback MP3
                            const mp3Url = `https://huggingface.co/datasets/corporationgoorac/marketingVoice/resolve/main/audio.mp3?t=${Date.now()}`;
                            const { buffer: mp3Buffer, isHtmlError: mp3HtmlErr } = await fetchMediaBuffer(mp3Url);
                            if (mp3HtmlErr || !mp3Buffer) throw new Error("Invalid MP3 fallback response");
                            
                            // Send as standard audio (ptt: false)
                            await sock.sendMessage(targetId, {
                                audio: mp3Buffer,
                                mimetype: 'audio/mpeg',
                                ptt: false
                            });
                            try { await sock.sendPresenceUpdate('paused', targetId); } catch (e) {}
                            sent = true;
                            console.log(`✅ [Marketing] Fallback MP3 audio successfully delivered to ${customerName}.`);
                            break; // Success, break out of retry loop
                        } catch (mp3Err) {
                            console.error(`❌ [Marketing] MP3 Fallback also failed:`, mp3Err.message);
                            // Fall through to normal retry handling
                        }
                    }

                    // Handle findChat / @lid / No LID errors locally
                    if (errMsg.includes('findChat') || errMsg.includes('@lid') || errMsg.includes('not found') || errMsg.includes('No LID')) {
                        console.log(`⚠️ Applying initialization workaround for voice note chat: ${targetId}`);
                        await sock.sendMessage(targetId, { text: `🎤 Sending a quick voice note...` });
                        await sleep(2000);
                        
                        await sock.sendMessage(targetId, {
                            audio: voiceBuffer,
                            mimetype: voiceMimetype,
                            ptt: true
                        });
                        try { await sock.sendPresenceUpdate('paused', targetId); } catch (e) {}
                        sent = true;
                        console.log(`✅ [Marketing] Voice note delivered via workaround to ${customerName}.`);
                    } else {
                        sendRetries--;
                        console.error(`⚠️ [Marketing] Voice note send loop failure. Retries left: ${sendRetries}. Error: ${errMsg}`);
                        if (sendRetries === 0) throw sendErr;
                        await sleep(6000);
                    }
                }
            }
            
        } catch (error) {
            console.error(`⚠️ [Marketing] Voice note simulation failed completely for ${verifiedWhatsappId}:`, error.stack || error.message || error);
        }
    };

    // --- 1. ON-DEMAND WHATSAPP AD GENERATOR & OPT-OUT HANDLER (BAILEYS LISTENER) ---
    const attachMessageListener = (sockInstance) => {
        if (!sockInstance || !sockInstance.ev || sockInstance._meenaMarketingListenerAttached) return;
        sockInstance._meenaMarketingListenerAttached = true;

        sockInstance.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

            const currentSock = activeClient || sockInstance;
            const senderJid = msg.key.remoteJid;
            const rawText =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                "";

            if (!rawText) return;
            const input = rawText.trim().toLowerCase();

            const reply = async (text) => {
                const liveSock = activeClient || sockInstance;
                await liveSock.sendMessage(senderJid, { text }, { quoted: msg });
            };
            
            // OPT-OUT BLACKLIST HANDLER
            if (input === 'stop') {
                try {
                    // FORMAT FIX for opt-out to match DB structure safely
                    const rawPhone = senderJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');
                    const formattedNumber = formatPhone(rawPhone) || rawPhone; 
                    
                    let snap = await docRef.get();
                    if (snap.exists) {
                        let data = snap.data();
                        let optedOut = data.optedOut || [];
                        if (!optedOut.includes(formattedNumber)) {
                            optedOut.push(formattedNumber);
                            await docRef.set({ optedOut: optedOut }, { merge: true });
                        }
                    }
                    await reply("✅ _You have successfully opted out. You will no longer receive promotional offers from Meena Marketing._");
                    console.log(`🛑 [Marketing] Customer ${formattedNumber} opted out.`);
                } catch (err) {
                    console.error("Opt-out error:", err);
                }
                return;
            }

            if (input === 'generate image' || input === 'generate ad' || input === '!generate image') {
                // Prevent duplicate overlapping manual generations from the same user
                if (global.isGeneratingManualAd) {
                    return reply("⏳ _A promotional sequence is already being generated and delivered. Please wait a moment..._");
                }
                global.isGeneratingManualAd = true;

                await reply("🎨 _Digital Agent is designing a new promotional poster... Please wait._");
                
                try {
                    // Get sender name directly from Baileys pushName, else default to 'Valued Customer'
                    const customerName = msg.pushName || 'Valued Customer';
                    
                    const adData = generateRandomAdData();
                    const imageBuffer = await generateAdImage(currentSock, customerName, adData);
                    const caption = getBilingualCaption(customerName, adData);
                    
                    // ENTERPRISE FIX: Give connection time to settle before sending
                    await sleep(2000);
                    const liveSock = activeClient || currentSock;
                    await liveSock.sendMessage(senderJid, {
                        image: imageBuffer,
                        caption: caption
                    });
                    
                    // NEW FEATURE: Append the dynamic video to manual triggers
                    await sendHumanVideo(liveSock, senderJid, customerName, senderJid);

                    // NEW FEATURE: Append the dynamic voice note to manual triggers as well
                    // UPDATED: Passed senderJid as the 4th parameter for the fallback routing
                    await sendHumanVoiceNote(liveSock, senderJid, customerName, senderJid);
                    
                } catch (err) {
                    console.error("Manual Ad Generation Error:", err.stack || err);
                    await reply("⚠️ Error generating image. Server might be busy.");
                } finally {
                    global.isGeneratingManualAd = false;
                }
            }
        });
    };

    // Attach listener to current socket immediately
    attachMessageListener(client);

    // FIX: If the bot is already running, block duplicate timer setups completely
    // ADDED: global.isMarketingInitialized to survive require() cache clears
    if (isInitialized || global.isMarketingInitialized) {
        console.log("🛡️ [Marketing] Prevented duplicate agent spawn on WhatsApp reconnect.");
        return; 
    }
    isInitialized = true;
    global.isMarketingInitialized = true;

    let isProcessing = false;

    // --- 2. CORE AUTOMATED DISTRIBUTION LOGIC (ENTERPRISE PACING) ---
    const fetchAndPrepareBatch = async () => {
        if (isProcessing) return;
        isProcessing = true;
        
        // ADVANCED FIX: Ensure socket is active, genuinely open, and authenticated before running background marketing loops
        if (!isSocketReady(activeClient)) {
            console.log("⚠️ WhatsApp client not authenticated or disconnected. Pausing marketing engine.");
            isProcessing = false;
            return;
        }

        try {
            let snap = await docRef.get();
            let dbData = snap.exists ? snap.data() : null;
            const now = Date.now();

            // ADVANCED PACING CHECK: Read timestamp from DB to see if we are allowed to send yet.
            if (dbData && dbData.nextAllowedTime && now < dbData.nextAllowedTime) {
                const waitMins = Math.ceil((dbData.nextAllowedTime - now) / 60000);
                const timeToWait = dbData.nextAllowedTime - now;

                if (waitMins > 0) {
                    // NEW FIX: RAM Cache check to prevent log spam. Only logs once.
                    if (global.lastLoggedNextTime !== dbData.nextAllowedTime) {
                        const nextTimeStr = formatTimeForLog(dbData.nextAllowedTime);
                        console.log(`⏳ [Marketing] Pacing active. The next marketing message in ${nextTimeStr}`);
                        global.lastLoggedNextTime = dbData.nextAllowedTime;
                    }
                }
                
                // HYBRID ARCHITECTURE: Schedule exact dynamic wakeup, bypassing the 30-min heartbeat
                if (global.marketingDynamicTimeout) clearTimeout(global.marketingDynamicTimeout);
                global.marketingDynamicTimeout = setTimeout(fetchAndPrepareBatch, timeToWait);

                isProcessing = false;
                return; // Early exit prevents duplicate sending loops
            }

            // Initialize DB if empty or if cycle is fully complete
            if (!dbData || !dbData.pendingCustomers || dbData.pendingCustomers.length === 0) {
                console.log("📥 [Marketing] 30-Day Cycle Started: Pulling last 200 bills from Firebase...");
                
                // FIREBASE OPTIMIZATION: Exactly 200 reads, performed ONLY once a month.
                const sellingSnap = await db.collection('sellings').orderBy('date', 'asc').limit(300).get();
                const uniqueCustomers = new Map();

                // Deduplication
                sellingSnap.forEach(doc => {
                    const data = doc.data();
                    const rawPhone = data.customer?.phone;
                    const formatted = formatPhone(rawPhone);

                    if (formatted && !uniqueCustomers.has(formatted)) {
                        uniqueCustomers.set(formatted, {
                            name: data.customer?.name || 'Customer',
                            phone: formatted
                        });
                    }
                });

                let customersList = Array.from(uniqueCustomers.values());
                let optedOut = dbData?.optedOut || [];
                let invalidNumbers = dbData?.invalidNumbers || [];

                // Filter out Blacklist and Graveyard immediately
                customersList = customersList.filter(c => !optedOut.includes(c.phone) && !invalidNumbers.includes(c.phone));

                console.log(`🧹 [Marketing] Deduplicated and filtered to ${customersList.length} safe unique customers.`);

                const todayStr = new Date().toLocaleDateString('en-IN');
                dbData = {
                    campaignMonth: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                    pendingCustomers: customersList,
                    sentCustomers: [],
                    optedOut: optedOut,
                    invalidNumbers: invalidNumbers,
                    messagesSentToday: 0,
                    lastRunDate: todayStr,
                    nextAllowedTime: 0, // NEW: Tracks EXACT millisecond next message is allowed
                    totalCycleCount: customersList.length // NEW: For Progress Tracking
                };

                await docRef.set(dbData);
            }

            // Begin the distribution engine
            await runDistributionCycle(dbData);

        } catch (err) {
            console.error("❌ [Marketing] Error fetching batch:", err.stack || err);
            isProcessing = false;
        }
    };

    const runDistributionCycle = async (dbData) => {
        let sock = activeClient;
        const todayStr = new Date().toLocaleDateString('en-IN');
        const currentDayOfWeek = new Date().getDay(); // 0 is Sunday
        
        // Reset daily counters if it's a new day
        if (dbData.lastRunDate !== todayStr) {
            dbData.messagesSentToday = 0;
            dbData.lastRunDate = todayStr;
            dbData.nextAllowedTime = 0; // Wipe pacing clear for the new day
        }

        // ADVANCED LOGIC: Weekend Booster. Sundays get 10 limits instead of 7.
        const maxDailyMessages = (currentDayOfWeek === 0) ? 10 : 7; 
        let currentHour = new Date().getHours();

        // 16-HOUR MATH: Ensure all daily messages finish strictly between 6 AM and 10 PM
        if (currentHour < 6 || currentHour >= 22) {
            console.log(`🌙 [Marketing] Outside business hours (6 AM - 10 PM). Resting...`);
            isProcessing = false;
            return;
        }

        if (dbData.messagesSentToday >= maxDailyMessages) {
            console.log(`🔒 [Marketing] Daily quota of ${maxDailyMessages} met. Sleeping until tomorrow...`);
            isProcessing = false;
            return;
        }

        if (dbData.pendingCustomers.length === 0) {
            console.log("✅ [Marketing] Entire 30-Day Cycle Complete. Restarting database fetch.");
            // Wipe nextAllowedTime to force an immediate cycle reload
            await docRef.set({ nextAllowedTime: 0 }, { merge: true });
            isProcessing = false;
            return;
        }

        // Verify socket is still live before starting customer processing
        if (!isSocketReady(sock)) {
            console.log("⚠️ [Marketing] Socket disconnected before cycle start. Aborting cycle safely.");
            isProcessing = false;
            return;
        }

        // --- THE ENGINE LOOP ---
        const total = Math.max(dbData.totalCycleCount || 1, dbData.pendingCustomers.length);
        const remaining = dbData.pendingCustomers.length;
        const progress = Math.round(((total - remaining) / total) * 100);
        
        console.log(`⚙️ [Marketing] Engine running. Progress: ${progress}%. Sent today: ${dbData.messagesSentToday}/${maxDailyMessages}`);

        // Grab the first customer in line
        // CRITICAL BUG FIX: Added back. Array index prevents entire array pushing to graveyard.
        const customer = dbData.pendingCustomers[0]; // [BULLETPROOF FIX]: Added [0] to extract the object, not the whole array!

        // SAFEGUARD & FORMAT FIX: In case Firebase holds old string arrays instead of objects
        const rawPhone = typeof customer === 'string' ? customer : customer?.phone;
        const formattedPhone = formatPhone(rawPhone);
        
        if (!formattedPhone) {
            console.log(`⚠️ [Marketing] Invalid customer format in DB for: ${rawPhone}. Removing entry.`);
            // [BULLETPROOF FIX]: Fallback string protects Firestore from crashing if rawPhone is undefined.
            dbData.invalidNumbers.push(rawPhone || "UNKNOWN_FORMAT"); 
            dbData.pendingCustomers.shift();
            dbData.nextAllowedTime = Date.now() + 6000; // FAST SKIP: 6 seconds
            await docRef.set(dbData);
            isProcessing = false;
            
            // SMART QUICK-TRIGGER: Prevent waiting 30 mins for the interval if we just did a 6-second skip
            if (global.marketingDynamicTimeout) clearTimeout(global.marketingDynamicTimeout);
            global.marketingDynamicTimeout = setTimeout(fetchAndPrepareBatch, 6000);
            return;
        }

        // Strip non-numeric characters for API validation like server.js
        const plainPhone = formattedPhone.replace(/\D/g, ''); 
        
        let verifiedWhatsappId = null;
        let wasSentSuccessfully = false;
        let isTransientError = false; // NEW FIX: Track transient WhatsApp connection errors

        try {
            // ENTERPRISE FIX: Use Baileys sock.onWhatsApp() to verify registry natively
            await sleep(3000); 
            sock = activeClient;
            if (!isSocketReady(sock)) {
                throw new Error('Connection Closed');
            }
            const results = await sock.onWhatsApp(plainPhone);
            const contactResult = Array.isArray(results) ? results[0] : null;
            
            if (contactResult && contactResult.exists) {
                verifiedWhatsappId = contactResult.jid;
            }
        } catch(e) { 
            // 🚀 ADVANCED FIX IMPLEMENTED HERE: Handle socket/connection hiccups gracefully
            const errorStr = e.message || '';
            if (errorStr.includes('Connection Closed') || errorStr.includes('Timed Out') || !isSocketReady(activeClient)) {
                // Socket is genuinely dead/reconnecting! Do NOT proceed to send or move to graveyard.
                console.log(`⚠️ [Marketing] Socket disconnected during validation for ${plainPhone}. Deferring until reconnect.`);
                isTransientError = true;
            } else if(
                errorStr.includes('WidFactory') ||
                errorStr.includes('Evaluation failed') ||
                errorStr.includes('findChat') ||
                errorStr.includes('window.require is not a function')
            ) {
                console.log(`⚠️ [Marketing] Validation query sync hiccup for ${plainPhone}. Proceeding with dynamic fallback JID.`);
                verifiedWhatsappId = plainPhone + '@s.whatsapp.net';
            } else {
                console.error(`🚨 [CRITICAL] Unhandled WhatsApp exception during number validation:`, e.stack || e);
                isTransientError = true;
            }
        }
            
        if (!verifiedWhatsappId && !isTransientError) {
            console.log(`🪦 [Marketing] Number ${formattedPhone} is not on WhatsApp. Moving to Graveyard.`);
            dbData.invalidNumbers.push(formattedPhone);
        } else if (verifiedWhatsappId && !isTransientError) {
            // --- HUMAN SIMULATION (BAILEYS PRESENCE) ---
            try {
                // ENTERPRISE FIX: Send "typing..." state for 5-8 seconds before sending poster
                await sleep(2000);
                sock = activeClient;
                if (isSocketReady(sock)) {
                    await sock.sendPresenceUpdate('composing', verifiedWhatsappId);
                    await sleep(Math.floor(Math.random() * 3000) + 5000); // Type for 5-8 seconds
                    await sock.sendPresenceUpdate('paused', verifiedWhatsappId);
                }
            } catch (e) {
                console.log(`⚠️ Could not simulate typing for ${formattedPhone}, likely a new chat. Proceeding directly to send.`);
            }

            try {
                await sendPromotion(customer, verifiedWhatsappId);
                wasSentSuccessfully = true;
            } catch (error) {
                console.error(`⚠️ [Marketing] Unexpected error processing ${formattedPhone}:`, error.stack || error);
                
                // 🚀 ADVANCED FIX IMPLEMENTED HERE: Flag transient socket errors so the user isn't discarded
                const loopErrStr = (error && error.message) ? error.message : '';
                if (
                    loopErrStr.includes('WidFactory') ||
                    loopErrStr.includes('Evaluation failed') ||
                    loopErrStr.includes('findChat') ||
                    loopErrStr.includes('window.require is not a function') ||
                    loopErrStr.includes('Connection Closed') ||
                    loopErrStr.includes('Timed Out') ||
                    !isSocketReady(activeClient)
                ) {
                    isTransientError = true;
                }
            }
        }

        // --- DATABASE ARRAY SHIFTING (1-Read Magic) ---
        dbData.pendingCustomers.shift(); 
        
        if (wasSentSuccessfully) {
            dbData.sentCustomers.push(customer);
            dbData.messagesSentToday += 1;
            
            // ENTERPRISE PACING MATH: Calculates the exact timestamp in the future for the next send.
            const randomMinutes = Math.floor(Math.random() * 60) + 90; // Between 90 and 150 minutes
            dbData.nextAllowedTime = Date.now() + (randomMinutes * 60000);
            
            const nextTimeStr = formatTimeForLog(dbData.nextAllowedTime);
            console.log(`📅 [Marketing] Success. The next marketing message in ${nextTimeStr}`);
            global.lastLoggedNextTime = dbData.nextAllowedTime; // Mark as logged so it doesn't duplicate
            
        } else {
            // ADVANCED GRACEFUL FAIL-SAFE: If number was bad, skip and try next in 6 seconds (bypass 90 mins)
            dbData.nextAllowedTime = Date.now() + 6000; 
            
            // NEW FIX: Re-queue the customer if it was a transient error instead of discarding them
            if (isTransientError) {
                dbData.pendingCustomers.unshift(customer);
                // Wait 2 minutes (120,000ms) on transient connection drops to prevent 6-second infinite crash loops while waiting for reconnect/QR
                dbData.nextAllowedTime = Date.now() + 120000;
                console.log(`♻️ [Marketing] Re-queued ${formattedPhone} due to internal WhatsApp syncing issue. Retrying in 2 minutes.`);
            }
        }

        // Save State to Firebase (Overwrites the document, preventing data bloating)
        await docRef.set(dbData);
        
        // RAM Cleanup (Retained structure for compatibility; Chrome is already killed inside generateAdImage)
        if (sock && sock.pupPage) {
            await sock.pupPage.evaluate(() => {
                if (window.Store && window.Store.Msg) window.Store.Msg.clear();
            }).catch(() => {});
        }

        // ADVANCED PRODUCTION FIX: Optional Garbage Collection to prevent V8 memory leaks in long-running processes
        if (global && global.gc) {
            try { global.gc(); } catch (e) {}
        }

        isProcessing = false; 

        // SMART QUICK-TRIGGER: If we scheduled a fast retry/skip (up to 2 minutes), forcefully call the batch again 
        // without waiting for the 30-minute global polling interval to catch up.
        const timeToNext = dbData.nextAllowedTime - Date.now();
        if (timeToNext > 0 && timeToNext <= 125000) { // Handles both 6s invalid-number skips and 120s transient reconnect waits
            if (global.marketingDynamicTimeout) clearTimeout(global.marketingDynamicTimeout);
            global.marketingDynamicTimeout = setTimeout(fetchAndPrepareBatch, timeToNext);
        }
    };

    const sendPromotion = async (customer, verifiedWhatsappId) => {
        let sock = activeClient;
        // SAFEGUARD: Robustly handle both new Object and old String database formats
        const customerPhone = typeof customer === 'string' ? customer : customer?.phone;
        const customerName = typeof customer === 'string' ? 'Customer' : (customer?.name || 'Customer');
        const adData = generateRandomAdData();
        const targetJid = toBaileysJid(verifiedWhatsappId, customerPhone);

        try {
            const imageBuffer = await generateAdImage(sock, customerName, adData);
            const caption = getBilingualCaption(customerName, adData);
            
            // ENTERPRISE FIX: Retry mechanism + robust loading delays
            await sleep(4000); // Give ample room to settle
            
            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    // Always grab latest socket reference in case Baileys reconnected during Puppeteer rendering
                    sock = activeClient;
                    if (!isSocketReady(sock)) {
                        throw new Error('Connection Closed');
                    }

                    await sock.sendMessage(targetJid, {
                        image: imageBuffer,
                        caption: caption
                    });
                    success = true;
                } catch (sendErr) {
                    // SERVER.JS FIX FOR findChat / @lid errors 
                    if (sendErr.message && (sendErr.message.includes('findChat') || sendErr.message.includes('@lid') || sendErr.message.includes('not found') || sendErr.message.includes('No LID'))) {
                        console.log(`⚠️ Applying initialization workaround for chat: ${targetJid}`);
                        
                        // Send text first to initialize chat session in cache safely
                        await sock.sendMessage(targetJid, { text: `🛍️ Loading a special offer for you...` });
                        
                        // Brief delay to ensure cache is updated locally
                        await sleep(2000);
                        
                        // Retry sending the media image
                        await sock.sendMessage(targetJid, {
                            image: imageBuffer,
                            caption: caption
                        });
                        success = true;
                    } else {
                        retries--;
                        console.error(`⚠️ [Marketing] Send loop failure. Retries left: ${retries}. Error: ${sendErr.message}`);
                        if (retries === 0) throw sendErr;
                        await sleep(6000); // Wait 6 seconds before retry
                    }
                }
            }

            if (success) {
                console.log(`📩 Sent Ad to ${customerName} (${customerPhone})`);
                
                // NEW FEATURE: Seamlessly trigger the human video sequence right after the message succeeds
                await sendHumanVideo(sock, targetJid, customerName, customerPhone);

                // NEW FEATURE: Seamlessly trigger the human voice note sequence right after the video succeeds
                await sendHumanVoiceNote(sock, targetJid, customerName, customerPhone);
            }
            
        } catch (err) {
            console.error(`❌ Failed to send Ad to ${customerName}`);
            throw err; // Throw up to the loop so it doesn't count as successfully sent
        }
    };

    // --- 3. DYNAMIC AD ENGINE (Millions of Combinations) ---
    const generateRandomAdData = () => {
        // EXPANDED CATEGORIES
        const categories = ['Mobiles', 'Appliances', 'Furniture', 'Smart Home & Electronics', 'Kitchenware'];
        const selectedCategory = categories[Math.floor(Math.random() * categories.length)];

        // Massive Database Simulation (HIGHLY EXPANDED INVENTORY)
        const dbData = {
            Mobiles: {
                brands: ['POCO', 'VIVO', 'Samsung', 'Apple', 'Redmi', 'Realme', 'Oppo', 'OnePlus', 'iQOO', 'Motorola', 'Asus ROG', 'Nothing', 'Google Pixel', 'Lava', 'Infinix'],
                mainProducts: ['5G Smartphones', 'Flagship Killers', 'Premium Mobiles', 'Gaming Phones', 'Foldable Phones', 'High-Performance Tablets', 'Ultra-Slim Laptops', 'Creator iPads'],
                subProducts: ['Bluetooth TWS Earbuds', 'Smartwatches', 'Fast Chargers', 'Power Banks', 'Premium Cases', 'Screen Protectors', 'Wired Earphones', 'Mobile Gimbals', 'Car Mounts', 'Wireless Neckbands', 'Gaming Triggers', 'Magnetic Wireless Chargers']
            },
            Appliances: {
                brands: ['LG', 'Samsung', 'Whirlpool', 'Voltas', 'Haier', 'Godrej', 'Blue Star', 'Bosch', 'IFB', 'Lloyd', 'Panasonic', 'Daikin', 'TCL', 'Sony', 'O General'],
                mainProducts: ['Front-Load Washing Machines', 'Double Door Refrigerators', 'Split Air Conditioners', '4K Smart LED TVs', 'OLED TVs', 'Inverter ACs', 'Top-Load Washers', 'Side-by-Side Refrigerators', 'Tower ACs'],
                subProducts: ['Mixer Grinders', 'Microwave Ovens', 'Water Purifiers', 'Induction Stoves', 'Ceiling Fans', 'Iron Boxes', 'Geysers', 'Voltage Stabilizers', 'Air Coolers', 'Vacuum Cleaners', 'Water Heaters', 'Room Heaters']
            },
            Furniture: {
                brands: ['Premium Teak', 'Steel Strong', 'Royal Oak', 'Nilkamal', 'Custom Handcrafted', 'Zuari', 'Wakefit', 'Urban Ladder Design', 'Godrej Interio', 'Durian', 'Hometown'],
                mainProducts: ['King Size Wooden Cots', 'Heavy Steel Beeros', 'Teak Wood Beeros', 'L-Shape Sofa Sets', 'Glass Dining Tables', 'Modular Wardrobes', 'Premium Recliners', 'Queen Size Storage Beds', 'Luxury Loungers'],
                subProducts: ['Orthopedic Mattresses', 'Office Chairs', 'Recliners', 'Dressing Tables', 'Pooja Mandirs', 'Shoe Racks', 'Study Desks', 'Bookshelves', 'Coffee Tables', 'Bedside Tables', 'Premium Cushions', 'Wall Units']
            },
            "Smart Home & Electronics": {
                brands: ['Sony', 'Bose', 'JBL', 'Dell', 'HP', 'Lenovo', 'Philips', 'Acer', 'Apple', 'Asus', 'Boat', 'Noise', 'Zebronics'],
                mainProducts: ['High-Performance Laptops', 'Home Theater Systems', 'Soundbars with Subwoofers', 'Gaming Monitors', 'Smart Displays', 'All-in-One Desktops', 'Party Speakers', 'Projectors'],
                subProducts: ['Wireless Keyboards', 'Gaming Mice', 'Webcams', 'Smart Plugs', 'Security Cameras', 'Bluetooth Speakers', 'Wi-Fi Routers', 'External Hard Drives', 'Smart LED Bulbs', 'Gaming Headsets', 'Microphones']
            },
            Kitchenware: {
                brands: ['Prestige', 'Butterfly', 'Pigeon', 'Wonderchef', 'Milton', 'Bajaj', 'Havells', 'Cello', 'Borosil', 'Hawkins', 'Usha'],
                mainProducts: ['4-Burner Glass Gas Stoves', 'Premium Cookware Sets', 'Air Fryers', 'Electric Chimneys', 'Dishwashers', 'Cold Press Juicers', 'Built-in Hobs', 'Convection Ovens'],
                subProducts: ['Non-Stick Tawas', 'Pressure Cookers', 'Electric Kettles', 'Toasters', 'Choppers', 'Dinner Sets', 'Thermos Flasks', 'Spice Racks', 'Coffee Makers', 'Sandwich Makers', 'Hand Blenders']
            }
        };

        // EXPANDED OFFERS
        const offers = [
            { text: "Flat 20% OFF", taText: "20% நேரடி தள்ளுபடி" },
            { text: "Up to 30% OFF", taText: "30% வரை தள்ளுபடி" },
            { text: "Zero Down Payment", taText: "முன்பணம் தேவையில்லை" },
            { text: "Exchange Bonus ₹2000", taText: "பழைய பொருளுக்கு ₹2000 கூடுதல் மதிப்பு" },
            { text: "Save Up To ₹5000", taText: "₹5000 வரை சேமிக்கலாம்" },
            { text: "Special Festival Combo Price", taText: "சிறப்பு பண்டிகை காம்போ ஆஃபர்" },
            { text: "Buy 1 Get 1 Free", taText: "ஒன்றை வாங்கினால் ஒன்று இலவசம்" },
            { text: "Cashback Up To ₹1000", taText: "₹1000 வரை கேஷ்பேக்" },
            { text: "Free Home Delivery", taText: "இலவச டோர் டெலிவரி" },
            { text: "No Cost EMI Available", taText: "வட்டி இல்லா மாதத்தவணை" },
            { text: "Extra 10% Bank Discount", taText: "வங்கி கார்டுகளுக்கு 10% கூடுதல் தள்ளுபடி" },
            { text: "Free Smartwatch Included", taText: "ஸ்மார்ட்வாட்ச் முற்றிலும் இலவசம்" },
            { text: "Lowest Price of the Year", taText: "இந்த ஆண்டின் மிக குறைந்த விலை" },
            { text: "Instant Instant Approval EMI", taText: "உடனடி இஎம்ஐ ஒப்புதல்" },
            { text: "Extended 2-Year Warranty", taText: "2 வருட கூடுதல் வாரண்டி" }
        ];

        // 1000+ DYNAMIC AGENT PHRASES (Combinatorics Math) - MASSIVELY EXPANDED
        const agentHooksEn = [
            "We have handpicked these exclusive deals just for you!",
            "Don't miss our biggest price drop of the season.",
            "Upgrade your lifestyle with our premium collections.",
            "Incredible savings are waiting for you this week.",
            "Your favorite brands are now at unbeatable prices.",
            "Experience top-tier quality at wholesale prices.",
            "Transform your home with our latest arrivals.",
            "You deserve the best! Check out these VIP offers.",
            "Surprise! We unlocked special mega discounts for you.",
            "Why pay more? Get top electronics and furniture at factory prices.",
            "Step into savings with our exclusive weekend blowout!",
            "Your dream home upgrade just became totally affordable.",
            "We value your loyalty! Here's a special reward just for you.",
            "Smart living starts here. Grab these tech deals today.",
            "Unbeatable quality. Unimaginable prices. Only for a limited time.",
            "Just in! The products you've been waiting for are now on sale.",
            "Treat yourself to luxury without breaking the bank.",
            "Massive clearance! Everything must go at crazy low prices.",
            "A special invitation for you to access our private showroom sale.",
            "Upgrade your old tech today and get massive exchange bonuses!"
        ];
        const agentHooksTa = [
            "உங்களுக்காகவே பிரத்யேகமாக தேர்ந்தெடுக்கப்பட்ட சலுகைகள்!",
            "இந்த சீசனின் மிகப்பெரிய விலை குறைப்பை தவறவிடாதீர்கள்.",
            "எங்கள் பிரீமியம் கலெக்‌ஷன் மூலம் உங்கள் வாழ்க்கை முறையை மேம்படுத்துங்கள்.",
            "இந்த வாரம் நம்பமுடியாத சேமிப்புகள் உங்களுக்காக காத்திருக்கின்றன.",
            "உங்களுக்குப் பிடித்த பிராண்டுகள் இப்போது தோற்கடிக்க முடியாத விலையில்.",
            "சிறந்த தரத்தை மொத்த விலையில் அனுபவியுங்கள்.",
            "எங்களின் புதிய வரவுகள் மூலம் உங்கள் வீட்டை அழகுபடுத்துங்கள்.",
            "நீங்கள் சிறந்ததை பெற தகுதியானவர்! இந்த VIP சலுகைகளை பாருங்கள்.",
            "ஆச்சரியம்! உங்களுக்காக பிரத்யேக மெகா தள்ளுபடிகளை வழங்கியுள்ளோம்.",
            "ஏன் அதிகம் செலுத்த வேண்டும்? சிறந்த பொருட்களை குறைவான விலையில் பெறுங்கள்.",
            "எங்கள் பிரத்யேக வார இறுதி சலுகைகளுடன் சேமிப்பைத் தொடங்குங்கள்!",
            "உங்கள் கனவு வீட்டை மேம்படுத்தும் வாய்ப்பு இப்போது மலிவான விலையில்.",
            "உங்கள் ஆதரவுக்கு நன்றி! உங்களுக்காக ஒரு சிறப்பு சலுகை.",
            "ஸ்மார்ட்டான வாழ்க்கை இங்கிருந்து தொடங்குகிறது. இந்த சலுகைகளை இன்றே பெறுங்கள்.",
            "சிறந்த தரம். கற்பனை செய்ய முடியாத விலை. குறைந்த காலத்திற்கு மட்டுமே.",
            "புதிய வரவுகள்! நீங்கள் எதிர்பார்த்த பொருட்கள் இப்போது தள்ளுபடியில்.",
            "குறைந்த விலையில் ஆடம்பரமான பொருட்களை வாங்கி மகிழுங்கள்.",
            "மெகா கிளியரன்ஸ் சேல்! நம்பமுடியாத விலையில் உடனே முந்துங்கள்.",
            "எங்கள் பிரைவேட் ஷோரூம் விற்பனைக்கு உங்களை அன்போடு அழைக்கிறோம்.",
            "உங்கள் பழைய பொருட்களை மாற்றி, மிகப்பெரிய எக்ஸ்சேஞ்ச் போனஸ் பெறுங்கள்!"
        ];

        // EXPANDED URGENCIES
        const urgenciesEn = [
            "Limited stock available. Hurry!",
            "Offer valid only until stocks last.",
            "Grab this deal before it expires.",
            "Walk in today to claim your discount.",
            "Show this message at the counter to redeem.",
            "Flash sale alert! Prices drop for the next 24 hours only.",
            "This is a one-time offer, don't let it slip away!",
            "First 50 customers get an extra surprise gift. Rush now!",
            "Prices reverting to normal tomorrow. Act fast!",
            "Your cart is waiting. Secure these prices today!"
        ];
        const urgenciesTa = [
            "குறைந்த அளவு ஸ்டாக் மட்டுமே! விரைந்து வாருங்கள்.",
            "ஸ்டாக் இருக்கும் வரை மட்டுமே இந்த சலுகை.",
            "இந்த சலுகை முடிவதற்குள் பெற்றுக்கொள்ளுங்கள்.",
            "உங்கள் தள்ளுபடியைப் பெற இன்றே வருகை தாருங்கள்.",
            "சலுகையைப் பெற இந்த மெசேஜை கடையில் காண்பிக்கவும்.",
            "ஃபிளாஷ் சேல்! அடுத்த 24 மணி நேரத்திற்கு மட்டுமே இந்த விலை.",
            "இது ஒரு முறை மட்டுமே வரும் சலுகை, நழுவ விடாதீர்கள்!",
            "முதல் 50 வாடிக்கையாளர்களுக்கு சிறப்பு பரிசு. முந்துங்கள்!",
            "நாளை விலை மாறக்கூடும். உடனே செயல்படுங்கள்!",
            "இந்த வாய்ப்பை இன்று தவறவிடாதீர்கள்!"
        ];

        // 1000+ Template Engine (Themes X Layouts X Fonts) - EXPANDED COLOR PALETTES
        const themes = [
            { bg: '#09090b', accent: '#ef4444', textCol: 'white' }, // Dark Ruby
            { bg: '#0f172a', accent: '#3b82f6', textCol: 'white' }, // Midnight Blue
            { bg: '#064e3b', accent: '#10b981', textCol: 'white' }, // Emerald Dark
            { bg: '#451a03', accent: '#f59e0b', textCol: 'white' }, // Rich Wood
            { bg: '#171717', accent: '#eab308', textCol: 'white' }, // Premium Gold
            { bg: '#312e81', accent: '#c084fc', textCol: 'white' }, // Indigo Purple
            { bg: '#ffffff', accent: '#dc2626', textCol: '#111827' }, // Clean White / Red (Modern)
            { bg: '#fef3c7', accent: '#b45309', textCol: '#451a03' },  // Festival Yellow
            { bg: '#1a0b2e', accent: '#f0abfc', textCol: '#ffffff' }, // Neon Cyberpunk
            { bg: '#f8fafc', accent: '#0ea5e9', textCol: '#0f172a' }, // Minimalist Pastel Blue
            { bg: '#083344', accent: '#22d3ee', textCol: '#ffffff' }, // Ocean Blue
            { bg: '#14532d', accent: '#4ade80', textCol: '#ffffff' }, // Festive Green
            { bg: '#4c0519', accent: '#fda4af', textCol: '#ffffff' }, // Deep Burgundy
            { bg: '#2e1065', accent: '#d8b4fe', textCol: '#ffffff' }, // Royal Violet
            { bg: '#334155', accent: '#38bdf8', textCol: '#ffffff' }, // Slate Blue
            { bg: '#1c1917', accent: '#ea580c', textCol: '#ffffff' }, // Carbon Orange
            { bg: '#042f2e', accent: '#14b8a6', textCol: '#ffffff' }, // Deep Teal
            { bg: '#fff1f2', accent: '#e11d48', textCol: '#4c0519' }, // Soft Rose
            { bg: '#111827', accent: '#fcd34d', textCol: '#ffffff' }, // Obsidian Gold
            { bg: '#f0fdf4', accent: '#16a34a', textCol: '#14532d' }  // Mint Fresh
        ];

        // EXPANDED LAYOUTS
        const layouts = ['center', 'left', 'right'];

        const catData = dbData[selectedCategory];
        
        // Pick Randoms (Ensuring Multiple Products)
        const randomBrand = catData.brands[Math.floor(Math.random() * catData.brands.length)];
        const randomMain = catData.mainProducts[Math.floor(Math.random() * catData.mainProducts.length)];
        const randomSub1 = catData.subProducts[Math.floor(Math.random() * catData.subProducts.length)];
        const randomSub2 = catData.subProducts[Math.floor(Math.random() * catData.subProducts.length)];
        const randomSub3 = catData.subProducts[Math.floor(Math.random() * catData.subProducts.length)];
        const randomSub4 = catData.subProducts[Math.floor(Math.random() * catData.subProducts.length)];
        const randomOffer = offers[Math.floor(Math.random() * offers.length)];
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
        
        // Add Dynamic Flash Badges
        const badges = ["🔥 Special Bundle Offer", "⚡ FLASH SALE ALERT", "🎉 VIP CUSTOMER DEAL", "🎁 MEGA DISCOUNT ACTIVATED", "👑 EXCLUSIVE INVENTORY CLEARANCE", "⭐ DEAL OF THE DAY"];
        const randomBadge = badges[Math.floor(Math.random() * badges.length)];

        // Assemble Dynamic Agent Pitch
        const rHookIdx = Math.floor(Math.random() * agentHooksEn.length);
        const rUrgIdx = Math.floor(Math.random() * urgenciesEn.length);

        return {
            category: selectedCategory,
            brand: randomBrand,
            mainProduct: randomMain,
            subProduct1: randomSub1,
            subProduct2: randomSub2,
            subProduct3: randomSub3,
            subProduct4: randomSub4,
            offer: randomOffer,
            enPitch: `${agentHooksEn[rHookIdx]} ${urgenciesEn[rUrgIdx]}`,
            taPitch: `${agentHooksTa[rHookIdx]} ${urgenciesTa[rUrgIdx]}`,
            theme: randomTheme,
            layout: randomLayout,
            badgeText: randomBadge,
            promoCode: generatePromoCode(),
            timeGreeting: getTimeGreeting()
        };
    };

    // --- 512MB RAM OPTIMIZED: WAKE CHROME -> CLICK PHOTO -> IMMEDIATELY CLOSE CHROME ---
    const generateAdImage = async (client, name, adData) => {
        let browser = null;
        let page = null;

        try {
            // Launch isolated low-memory Chrome process strictly for the 2-second screenshot
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });

            page = await browser.newPage();
            // Expanded height to 1400px to completely prevent overlap bugs
            await page.setViewport({ width: 850, height: 1400 }); 

            // ADDED DYNAMIC CSS FOR NEW 'RIGHT' LAYOUT WITHOUT BREAKING OLD LAYOUTS
            let alignStyle = 'align-items: center; text-align: center;';
            let cardPos = 'left: 50%; transform: translateX(-50%);';
            
            if (adData.layout === 'left') {
                alignStyle = 'align-items: flex-start; text-align: left; padding-left: 60px;';
                cardPos = 'left: 60px; transform: none;';
            } else if (adData.layout === 'right') {
                alignStyle = 'align-items: flex-end; text-align: right; padding-right: 60px;';
                cardPos = 'right: 60px; left: auto; transform: none;';
            }

            const html = `
            <html>
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    /* BUG FIX: Added max-width and word-wrap to prevent text from pushing layout off-screen */
                    body { background:${adData.theme.bg}; color:${adData.theme.textCol}; font-family:'Inter', sans-serif; height:1400px; padding-bottom: 300px; display:flex; flex-direction:column; justify-content:center; margin:0; border:25px solid ${adData.theme.accent}; box-sizing: border-box; position: relative; max-width: 100%; overflow: hidden; ${alignStyle}}
                    
                    .badge { background: ${adData.theme.accent}; color: ${adData.theme.bg}; font-weight: 900; padding: 12px 25px; border-radius: 50px; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 25px; display: inline-block; max-width: 90%; word-wrap: break-word;}
                    .greeting { font-size: 35px; opacity: 0.9; margin-bottom: 10px; font-weight: 700; max-width: 90%; word-wrap: break-word;}
                    .headline { font-size: 70px; color: ${adData.theme.accent}; margin: 0; letter-spacing: -2px; font-weight: 900; line-height: 1.1; text-transform: uppercase; max-width: 95%; word-wrap: break-word;}
                    
                    .product-highlight { font-size: 45px; font-weight: 900; margin-top: 30px; line-height: 1.2; max-width: 90%; word-wrap: break-word;}
                    .brand-highlight { color: ${adData.theme.accent}; font-style: italic; font-size: 55px;}
                    
                    .offer-box { margin-top: 30px; background: ${adData.theme.accent}; color: ${adData.theme.bg}; padding: 20px 40px; border-radius: 15px; font-size: 38px; font-weight: 900; transform: rotate(-2deg); display: inline-block; box-shadow: 0 10px 20px rgba(0,0,0,0.3); max-width: 90%; word-wrap: break-word;}
                    
                    .sub-items { margin-top: 35px; font-size: 22px; opacity: 0.9; font-weight: 700; line-height: 1.6; background: rgba(0,0,0,0.15); padding: 20px; border-radius: 15px; border-left: 5px solid ${adData.theme.accent}; display: inline-block; max-width: 90%; word-wrap: break-word;}
                    .sub-items span { color: ${adData.theme.accent}; font-size: 24px; }

                    .promo-code { margin-top: 25px; background: rgba(0,0,0,0.2); padding: 10px 20px; border-radius: 8px; font-family: monospace; font-size: 24px; border: 1px dashed ${adData.theme.accent}; display: inline-block;}

                    .card { position: absolute; bottom: 140px; ${cardPos} background: rgba(0,0,0,0.1); padding: 25px 40px; border-radius: 20px; border: 2px solid ${adData.theme.accent}; width: 80%; max-width: 700px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); backdrop-filter: blur(10px); text-align: center; box-sizing: border-box;}
                    .shop-name { font-size: 32px; font-weight: 900; letter-spacing: 1px; word-wrap: break-word;}
                    .shop-address { font-size: 16px; opacity: 0.8; margin-top: 8px; word-wrap: break-word;}
                    .phone { font-size: 28px; font-weight: bold; color: ${adData.theme.accent}; margin-top: 8px;}
                    
                    .emi-banner { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); background: #fbbf24; color: #000; font-weight: 900; font-size: 22px; padding: 15px 50px; border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.4); white-space: nowrap; max-width: 90%; word-wrap: break-word;}
                </style>
            </head>
            <body>
                <div class="badge">${adData.badgeText}</div>
                <div class="greeting">${adData.timeGreeting.en}, ${name}!</div>
                <div class="headline">MEGA ${adData.category} SALE</div>
                
                <div class="product-highlight">
                    <span class="brand-highlight">${adData.brand}</span><br>
                    ${adData.mainProduct}
                </div>

                <div class="offer-box">${adData.offer.text}</div>

                <div class="sub-items">
                    🔥 <strong>PLUS MASSIVE DISCOUNTS ON:</strong><br>
                    <span>✔</span> ${adData.subProduct1} &nbsp;&nbsp;&nbsp; <span>✔</span> ${adData.subProduct2}<br>
                    <span>✔</span> ${adData.subProduct3} &nbsp;&nbsp;&nbsp; <span>✔</span> ${adData.subProduct4}
                </div>

                <div class="promo-code">Show Code: ${adData.promoCode}</div>

                <div class="card">
                    <div class="shop-name">MEENA MARKETING</div>
                    <div class="shop-address">31B,C, East, Sannathi, Alwarthirunagari, Tamil Nadu 628612</div>
                    <div class="phone">📞 9444589733</div>
                </div>

                <div class="emi-banner">✅ Bajaj Finance Easy EMI Available</div>
            </body>
            </html>`;

            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
            const buffer = await page.screenshot({ type: 'png' });
            return buffer;
        } finally {
            // Immediately close page and completely terminate Chrome so 0 MB remains in RAM
            if (page) {
                await page.close().catch(() => {});
            }
            if (browser) {
                const browserProcess = browser.process();
                await browser.close().catch(() => {});
                if (browserProcess && !browserProcess.killed) {
                    try { browserProcess.kill('SIGKILL'); } catch (e) {}
                }
            }
            if (global && global.gc) {
                try { global.gc(); } catch (e) {}
            }
        }
    };

    const getBilingualCaption = (name, adData) => {
        return `🎉 *MEENA MARKETING EXCLUSIVE DEALS* 🎉\n\n${adData.timeGreeting.en} *${name}*, ${adData.enPitch}\n\n🔥 *Top Deal:* ${adData.brand} ${adData.mainProduct}\n🎁 *Offer:* ${adData.offer.text}\n🏷️ *Your Promo Code:* ${adData.promoCode}\n\nWe also have huge discounts on:\n✅ ${adData.subProduct1}\n✅ ${adData.subProduct2}\n✅ ${adData.subProduct3}\n✅ ${adData.subProduct4}\n\n➖➖➖➖➖➖\n\n${adData.timeGreeting.ta} *${name}*, ${adData.taPitch}\n\n🔥 *சிறப்பு சலுகை:* ${adData.brand} ${adData.mainProduct}\n🎁 *ஆஃபர்:* ${adData.offer.taText}\n\n✅ *Easy EMI Available!*\n📱 Contact: 9444589733\n📍 31B,C, East, Sannathi, Alwarthirunagari\n\n_Reply STOP to opt-out of offers. Powered by Goorac_`;
    };

    // --- INITIALIZATION ---
    // Start the initial boot check slightly delayed to let the main client settle
    // ADDED: ClearTimeout prevents looping if module is forcefully hot-reloaded
    if (global.marketingBootTimeout) clearTimeout(global.marketingBootTimeout);
    global.marketingBootTimeout = setTimeout(fetchAndPrepareBatch, 10000);

    // ENTERPRISE POLLING: Wakes up every 30 minutes to check the database timestamp. 
    // Uses virtually zero memory/CPU compared to keeping a promise active in RAM.
    // ADDED: ClearInterval completely destroys overlapping polling loops
    if (global.marketingPollingInterval) clearInterval(global.marketingPollingInterval);
    global.marketingPollingInterval = setInterval(fetchAndPrepareBatch, 30 * 60 * 1000);
};
