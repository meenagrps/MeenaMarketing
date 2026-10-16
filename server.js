const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino'); // Required for Baileys internal logging

async function connectToWhatsApp() {
    // 1. Setup Session Storage
    // This saves your login credentials to an 'auth_info' folder. 
    // Render's free tier will eventually wipe this folder, so for a production app, 
    // you will eventually want to save these credentials to a database (like Firebase).
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // 2. Initialize the Socket
    const sock = makeWASocket({
        auth: state,
        // Suppress massive debug logs, only show warnings/errors
        logger: pino({ level: 'warn' }), 
        // Masquerade as a standard browser to avoid detection
        browser: Browsers.macOS('Desktop'), 
        printQRInTerminal: false // Deprecated in latest Baileys, we handle it manually below
    });

    // 3. Handle Connection Updates and QR Code Generation
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Print the QR code to the Render Terminal
        if (qr) {
            console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect.error, ', reconnecting:', shouldReconnect);
            
            // Reconnect if not explicitly logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n✅ Successfully connected to WhatsApp Web!');
        }
    });

    // 4. Save Credentials on Update
    sock.ev.on('creds.update', saveCreds);

    // 5. Basic Message Listener (Echo Bot for Demo)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        // Ignore messages sent by the bot itself
        if (!msg.message || msg.key.fromMe) return; 

        console.log(`New message from ${msg.key.remoteJid}:`, msg.message);
        
        // Uncomment below to make the bot automatically reply to any message:
        // await sock.sendMessage(msg.key.remoteJid, { text: "Hello from Render!" });
    });
}

connectToWhatsApp();
