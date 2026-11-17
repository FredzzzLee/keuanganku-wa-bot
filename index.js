const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeWeb = require('qrcode');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const { parseMessage_, parseTransfer_, rupiah_, WALLETS } = require('./parser');
const {
  saveTransactions,
  saveTransfer,
  getSaldo,
  getRekap,
  undoLast,
  getDefaultSource,
  setDefaultSource,
  restoreSessionFromFirebase,
  saveSessionToFirebase,
  clearSessionInFirebase
} = require('./db');

const configPath = path.join(__dirname, 'config.json');
let config = {
  uid: 'IOb7TUEF4eWiKlow5C06AvWepqD3',
  targetGroupName: 'Duit Gua Tuh',
  targetGroupId: null,
  chatGroupName: 'Turu Lee',
  chatGroupId: null,
  defaultWallet: 'cash',
  ntfyTopic: 'fando-pesan-adik-2026',
  ntfyServer: 'https://ntfy.adminforge.de',
  tgBotToken: null,
  tgChatId: '1844869035',
  chatMembers: {
    '6283184997388': { name: 'Eisss', color: '#ff6b6b' }
  }
};

if (fs.existsSync(configPath)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  } catch (e) {
    console.error('Gagal membaca config.json:', e);
  }
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

const seenMessageIds = new Set();
function markSeen(id) {
  if (!id) return;
  seenMessageIds.add(id);
  if (seenMessageIds.size > 1000) {
    const first = seenMessageIds.values().next().value;
    seenMessageIds.delete(first);
  }
}

// ==========================================
// Fitur Chat Grup "Turu Lee" (3 orang)
// ==========================================
const chatGroupPath = path.join(__dirname, 'chat_group.json');
let chatGroupMessages = [];
if (fs.existsSync(chatGroupPath)) {
  try {
    chatGroupMessages = JSON.parse(fs.readFileSync(chatGroupPath, 'utf8'));
  } catch (e) {}
}

// Migrasi data lama chat_adik.json ke chat_group.json jika belum ada
const chatAdikPath = path.join(__dirname, 'chat_adik.json');
if (fs.existsSync(chatAdikPath) && chatGroupMessages.length === 0) {
  try {
    const old = JSON.parse(fs.readFileSync(chatAdikPath, 'utf8'));
    chatGroupMessages = old.map(m => ({ ...m, from: m.from === 'kakak' ? 'mas' : m.from }));
    saveChatGroup();
    console.log('[Migrasi] chat_adik.json → chat_group.json selesai.');
  } catch (e) {}
}

function saveChatGroup() {
  try {
    if (chatGroupMessages.length > 200) chatGroupMessages = chatGroupMessages.slice(-200);
    fs.writeFileSync(chatGroupPath, JSON.stringify(chatGroupMessages, null, 2), 'utf8');
  } catch (e) {}
}

// Bersihkan pesan lama yang sempat tersimpan dengan format @lid
function sanitizeOldMessages() {
  if (!Array.isArray(chatGroupMessages) || chatGroupMessages.length === 0) return;
  let changed = false;
  chatGroupMessages.forEach(m => {
    if (typeof m.from === 'string') {
      const lower = m.from.toLowerCase();
      if (lower.includes('lid') || lower === '6283184997388') {
        m.from = 'eisss';
        changed = true;
      } else if (lower === 'kakak') {
        m.from = 'mas';
        changed = true;
      } else if (lower === 'adik') {
        m.from = 'enat';
        changed = true;
      }
    }
  });
  if (changed) {
    saveChatGroup();
    console.log('[Sanitize] Berhasil membersihkan ID @lid pada riwayat pesan lama.');
  }
}
sanitizeOldMessages();

// Direktori penyimpanan Voice Notes
const vnDir = path.join(__dirname, 'voice_notes');
if (!fs.existsSync(vnDir)) fs.mkdirSync(vnDir, { recursive: true });

function addGroupMessage(from, text, type = 'text', audioFile = null) {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from,
    text,
    type,
    audioFile,
    time
  };
  chatGroupMessages.push(msg);
  saveChatGroup();
  return msg;
}

// ==========================================
// Identifikasi & Pemetaan Anggota (Solusi Masalah @lid)
// ==========================================
const jidToMemberCache = new Map();

function getBotOwnerInfo() {
  const ownPhone = sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
  const ownLid = sock?.user?.lid ? sock.user.lid.split(':')[0].split('@')[0] : '';
  return { ownPhone, ownLid };
}

async function syncGroupParticipants(groupId) {
  if (!sock || !groupId) return;
  try {
    const meta = await sock.groupMetadata(groupId);
    if (!meta || !Array.isArray(meta.participants)) return;

    const { ownPhone, ownLid } = getBotOwnerInfo();
    console.log(`[Turu Lee] Sinkronisasi ${meta.participants.length} peserta di grup:`);

    for (const p of meta.participants) {
      const pId = p.id || '';
      const pJid = p.jid || '';
      const pLid = p.lid || (pId.endsWith('@lid') ? pId : '');

      const isOwner = (ownPhone && (pId.includes(ownPhone) || pJid.includes(ownPhone))) ||
                      (ownLid && (pId.includes(ownLid) || pLid.includes(ownLid)));

      if (isOwner) {
        const ownerInfo = { name: 'Mas Fando', color: '#25d366', isOwner: true };
        jidToMemberCache.set('mas', ownerInfo);
        if (pId) jidToMemberCache.set(pId, ownerInfo);
        if (pLid) jidToMemberCache.set(pLid, ownerInfo);
        if (pJid) jidToMemberCache.set(pJid, ownerInfo);
      } else {
        // Anggota keluarga di Turu Lee (Eisss)
        const eisssInfo = config.chatMembers?.['6283184997388'] || { name: 'Eisss', color: '#ff6b6b' };
        const memberInfo = { ...eisssInfo, isOwner: false };
        if (pId) jidToMemberCache.set(pId, memberInfo);
        if (pLid) jidToMemberCache.set(pLid, memberInfo);
        if (pJid) jidToMemberCache.set(pJid, memberInfo);
        console.log(`✅ [Turu Lee Mapping] Peserta ${pId || pLid} terhubung ke ${memberInfo.name}`);
      }
    }
  } catch (err) {
    console.error('Gagal sinkronisasi peserta grup:', err.message);
  }
}

function resolveSender(msg, isChatGroup = false) {
  const senderJid = msg.key?.participant || msg.key?.remoteJid || '';
  const cleanSenderJid = senderJid.split(':')[0];
  const { ownPhone, ownLid } = getBotOwnerInfo();

  // 1. Jika pesan dari nomor sendiri (Mas Fando)
  if (
    msg.key?.fromMe ||
    (ownPhone && cleanSenderJid.includes(ownPhone)) ||
    (ownLid && cleanSenderJid.includes(ownLid))
  ) {
    return { key: 'mas', name: 'Mas Fando', isOwner: true };
  }

  // 2. Cek apakah JID/LID sudah tercatat di cache
  if (jidToMemberCache.has(cleanSenderJid)) {
    const info = jidToMemberCache.get(cleanSenderJid);
    return { key: info.name.toLowerCase(), name: info.name, isOwner: !!info.isOwner };
  }

  // 3. Cek nomor anggota di config.chatMembers
  if (config.chatMembers) {
    for (const [phone, info] of Object.entries(config.chatMembers)) {
      if (cleanSenderJid.includes(phone)) {
        jidToMemberCache.set(cleanSenderJid, info);
        return { key: info.name.toLowerCase(), name: info.name, isOwner: false };
      }
    }
  }

  // 4. Jika di grup Turu Lee dan bukan Mas Fando:
  // Karena anggota keluarga di grup ini hanya Mas Fando dan Eisss, pengirim ini 100% Eisss!
  if (isChatGroup) {
    const defaultMember = config.chatMembers?.['6283184997388'] || { name: 'Eisss', color: '#ff6b6b' };
    jidToMemberCache.set(cleanSenderJid, defaultMember);
    console.log(`[Auto-Map] Memetakan pengirim ${cleanSenderJid} sebagai ${defaultMember.name}`);
    return { key: defaultMember.name.toLowerCase(), name: defaultMember.name, isOwner: false };
  }

  // Fallback: gunakan pushName atau nomor bersih
  const fallbackName = msg.pushName || cleanSenderJid.replace('@s.whatsapp.net', '').replace('@lid', '');
  return {
    key: fallbackName.toLowerCase().replace(/\s+/g, '_'),
    name: fallbackName,
    isOwner: false
  };
}

let lastGroupIconUpdate = 0;
async function updateGroupIconIfPossible(groupId) {
  if (!sock || !groupId) return;
  const now = Date.now();
  if (now - lastGroupIconUpdate < 30000) {
    console.log('ℹ️ [WhatsApp] Foto profil grup baru saja diperbarui, mengabaikan...');
    return;
  }
  const photoPath = path.join(__dirname, 'turu-lee.jpg');
  if (!fs.existsSync(photoPath)) return;
  try {
    const imgBuffer = fs.readFileSync(photoPath);
    await sock.updateProfilePicture(groupId, imgBuffer);
    lastGroupIconUpdate = now;
    console.log('✅ [WhatsApp] Foto profil grup Turu Lee berhasil dipasang di WhatsApp!');
  } catch (err) {
    console.log('ℹ️ [WhatsApp] Info foto profil grup:', err.message);
  }
}

function notifyUbuntuDesktop(title, body) {
  if (process.platform === 'linux') {
    const cleanTitle = title.replace(/"/g, '\\"');
    const cleanBody = body.replace(/"/g, '\\"');
    exec(`notify-send -a "Turu Lee Chat" "${cleanTitle}" "${cleanBody}"`, err => {
      if (err) console.error('notify-send error:', err.message);
    });
  }
}

function escapeTgHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendTelegramNotification(senderName, message) {
  if (!config.tgBotToken || !config.tgChatId) {
    console.log('[Telegram] Tidak dikirim karena tgBotToken atau tgChatId belum diisi.');
    return;
  }

  const tgData = JSON.stringify({
    chat_id: String(config.tgChatId),
    text: `💬 <b>[Turu Lee — ${escapeTgHtml(senderName)}]:</b>\n"${escapeTgHtml(message)}"\n\n<i>Ketik balasan langsung di sini</i>`,
    parse_mode: 'HTML'
  });

  try {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${config.tgBotToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(tgData)
      },
      timeout: 5000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.ok) {
            console.log(`[Telegram] Notifikasi dari ${senderName} berhasil dikirim!`);
          } else {
            console.error('[Telegram] Gagal kirim notif:', json.description);
          }
        } catch (e) {}
      });
    });

    req.on('error', err => console.error('[Telegram] Error:', err.message));
    req.on('timeout', () => req.destroy());
    req.write(tgData);
    req.end();
  } catch (e) {
    console.error('[Telegram] Error request:', e.message);
  }
}

let tgPollingActive = false;
let lastTgUpdateId = 0;

function sendTelegramAck(chatId, text) {
  if (!config.tgBotToken) return;
  const payload = JSON.stringify({
    chat_id: String(chatId),
    text: text,
    parse_mode: 'HTML'
  });
  const req = https.request({
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${config.tgBotToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 5000
  }, res => res.resume());
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

function startTelegramPolling() {
  if (!config.tgBotToken || tgPollingActive) return;
  tgPollingActive = true;
  console.log('[Telegram Polling] Mendengarkan balasan chat dari Mas Fando di Telegram...');

  try {
    const delReq = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${config.tgBotToken}/deleteWebhook`,
      method: 'POST',
      headers: { 'Content-Length': 0 }
    }, res => res.resume());
    delReq.on('error', () => {});
    delReq.end();
  } catch (e) {}

  function poll() {
    if (!config.tgBotToken) {
      tgPollingActive = false;
      return;
    }

    try {
      const payload = JSON.stringify({
        offset: lastTgUpdateId + 1,
        timeout: 20,
        allowed_updates: ['message']
      });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.tgBotToken}/getUpdates`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 25000
      };

      const req = https.request(options, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.ok && Array.isArray(data.result)) {
              for (const update of data.result) {
                lastTgUpdateId = update.update_id;
                const m = update.message;
                if (!m || !m.text) continue;

                if (String(m.chat.id) !== String(config.tgChatId)) continue;

                const text = m.text.trim();
                if (text === '/start') {
                  sendTelegramAck(m.chat.id, '👋 <b>Halo Mas Fando!</b>\nBot Turu Lee sudah aktif. Ketik apa saja langsung di sini, dan pesanmu akan masuk ke grup Turu Lee dan laptop Enat!');
                  continue;
                }

                // Teruskan ke chat grup dan laptop Enat
                addGroupMessage('mas', text);
                notifyUbuntuDesktop('Pesan dari Mas Fando', text);

                // Kirim juga ke WA Grup Turu Lee agar semua anggota baca
                if (sock && config.chatGroupId) {
                  sock.sendMessage(config.chatGroupId, {
                    text: `💬 *[Mas Fando via Telegram]:*\n"${text}"`
                  }).then(sent => { if (sent?.key?.id) markSeen(sent.key.id); })
                    .catch(() => {});
                }

                sendTelegramAck(m.chat.id, `✅ <b>Terkirim ke Turu Lee:</b>\n"${escapeTgHtml(text)}"`);
              }
            }
          } catch (e) {}
          setTimeout(poll, 1000);
        });
      });

      req.on('error', () => {
        setTimeout(poll, 5000);
      });

      req.on('timeout', () => {
        req.destroy();
        setTimeout(poll, 1000);
      });

      req.write(payload);
      req.end();
    } catch (e) {
      setTimeout(poll, 5000);
    }
  }

  setTimeout(poll, 2000);
}

function sendPushNotification(title, message) {
  const topic = config.ntfyTopic || 'fando-pesan-adik-2026';
  const postData = Buffer.from(message, 'utf8');

  const servers = ['ntfy.adminforge.de', 'ntfy.sh'];
  servers.forEach(hostname => {
    try {
      const options = {
        hostname,
        port: 443,
        path: `/${encodeURIComponent(topic)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': postData.length,
          'Title': title,
          'Priority': 'high',
          'Tags': 'speech_balloon,loudspeaker',
          'Click': 'whatsapp://'
        },
        timeout: 4000
      };
      const req = https.request(options, res => res.resume());
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.write(postData);
      req.end();
    } catch (e) {}
  });
}

// ==========================================
// Status Global & HTTP Web Server
// ==========================================
let isConnected = false;
let currentQrDataUrl = null;
let currentRawQr = null;

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // 1. Health check
  if (url === '/health' || url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // 2. API Chat Grup: Ambil riwayat chat
  if (url === '/api/pesan' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(chatGroupMessages));
  }

  // 3. API Chat Grup: Kirim pesan teks dari laptop Enat ke WA grup Turu Lee
  if (url === '/api/kirim-pesan' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const text = String(data.text || '').trim();
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Pesan tidak boleh kosong' }));
        }

        const newMsg = addGroupMessage('enat', text);

        // 1. Kirim Notifikasi ke Telegram Mas Fando
        sendTelegramNotification('Enat', text);

        // 2. Kirim Push Notification (ntfy)
        sendPushNotification('Turu Lee — Enat', text);

        // 3. Kirim ke grup WA "Turu Lee"
        if (sock && config.chatGroupId) {
          try {
            const sent = await sock.sendMessage(config.chatGroupId, {
              text: `💬 *[Enat dari Laptop]:*\n"${text}"`
            });
            if (sent?.key?.id) markSeen(sent.key.id);
          } catch (err) {
            console.error('Gagal kirim WA ke Turu Lee:', err.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: newMsg }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3b. API: Kirim Voice Note dari laptop Enat
  if (url === '/api/kirim-vn' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', async () => {
      try {
        const rawBody = Buffer.concat(chunks);
        const vnFilename = 'vn_enat_' + Date.now() + '.ogg';
        const vnPath = path.join(vnDir, vnFilename);
        fs.writeFileSync(vnPath, rawBody);

        const newMsg = addGroupMessage('enat', '🎤 Voice Note', 'audio', vnFilename);

        // Kirim VN ke WA Grup Turu Lee sebagai audio message
        if (sock && config.chatGroupId) {
          try {
            const sent = await sock.sendMessage(config.chatGroupId, {
              audio: rawBody,
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true
            });
            if (sent?.key?.id) markSeen(sent.key.id);
          } catch (err) {
            console.error('Gagal kirim VN ke WA:', err.message);
          }
        }

        // Notif ke Telegram
        sendTelegramNotification('Enat', '🎤 [Voice Note]');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: newMsg }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3c. API: Serve voice note audio files
  if (url.startsWith('/api/vn/')) {
    const filename = decodeURIComponent(url.replace('/api/vn/', ''));
    const filePath = path.join(vnDir, filename);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'audio/ogg',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // 3d. API: Serve foto profil grup "Turu Lee" & avatar
  if (url === '/group-photo.jpg' || url === '/turu-lee.jpg' || url === '/foto-grup.jpg') {
    const photoPath = path.join(__dirname, 'turu-lee.jpg');
    if (fs.existsSync(photoPath)) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      });
      return fs.createReadStream(photoPath).pipe(res);
    } else {
      res.writeHead(404);
      return res.end('Foto tidak ditemukan');
    }
  }

  // 4. API Test Notifikasi Telegram
  if (url === '/api/test-tg') {
    if (!config.tgBotToken) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'tgBotToken belum diatur' }));
    }
    sendTelegramNotification('System', 'Halo Mas Fando! Notifikasi Telegram berhasil terhubung.');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, tgChatId: config.tgChatId }));
  }

  // 4b. API Test Notifikasi ntfy
  if (url === '/api/test-notif') {
    sendPushNotification('Test Turu Lee', 'Halo Mas Fando! Notifikasi ntfy berhasil terhubung.');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      topic: config.ntfyTopic || 'fando-pesan-adik-2026',
      server: config.ntfyServer || 'https://ntfy.adminforge.de'
    }));
  }

  // 5. Halaman Web Chat Grup "Turu Lee" (http://localhost:3000/pesan)
  if (url === '/pesan' || url === '/chat') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getChatHTML());
  }

  // 6. Halaman Scan QR Code di Browser (/qr)
  if (url === '/qr') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (isConnected) {
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Status Bot Keuanganku</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; text-align: center; }
            .card { background: #111b21; padding: 32px; border-radius: 24px; border: 1px solid #202c33; max-width: 400px; }
            .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(37,211,102,0.15); color: #25d366; padding: 8px 16px; border-radius: 99px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
            h1 { font-size: 22px; margin: 0 0 12px 0; color: #fff; }
            p { font-size: 14px; color: #8696a0; line-height: 1.6; margin: 0; }
            a { color: #25d366; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">● Online 24 Jam</div>
            <h1>✅ WhatsApp Terhubung!</h1>
            <p>Bot aktif di grup <b>"${config.targetGroupName}"</b> (keuangan) dan <b>"${config.chatGroupName}"</b> (obrolan).</p>
            <p style="margin-top: 15px;"><a href="/pesan">👉 Buka Turu Lee Chat</a></p>
          </div>
        </body>
        </html>
      `);
    }

    if (currentQrDataUrl) {
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Scan WhatsApp - Keuanganku</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="8">
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; text-align: center; }
            .card { background: #111b21; padding: 28px; border-radius: 24px; border: 1px solid #202c33; max-width: 380px; }
            img { width: 280px; height: 280px; border-radius: 12px; margin: 16px 0; }
            h1 { font-size: 20px; margin: 0 0 8px 0; }
            p { font-size: 13px; color: #8696a0; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>📱 Scan QR Code</h1>
            <p>Buka WhatsApp → ⋮ → Perangkat tertaut → Tautkan perangkat</p>
            <img src="${currentQrDataUrl}" alt="QR Code" />
            <p>Halaman akan otomatis refresh setiap 8 detik.</p>
          </div>
        </body>
        </html>
      `);
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bot Keuanganku</title>
        <meta http-equiv="refresh" content="5">
        <style>body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; text-align: center; }</style>
      </head>
      <body><p>⏳ Menunggu QR Code... Halaman akan otomatis refresh.</p></body>
      </html>
    `);
  }

  // 7. Status JSON default
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    connected: isConnected,
    financeGroup: config.targetGroupName,
    financeGroupId: config.targetGroupId,
    chatGroup: config.chatGroupName,
    chatGroupId: config.chatGroupId,
    chatUrl: '/pesan',
    qrUrl: '/qr'
  }, null, 2));
});

// ==========================================
// HTML Halaman Chat Grup "Turu Lee"
// ==========================================
function getChatHTML() {
  const memberColors = {};
  if (config.chatMembers) {
    for (const [num, info] of Object.entries(config.chatMembers)) {
      memberColors[info.name.toLowerCase()] = info.color || '#ff6b6b';
    }
  }
  memberColors['mas'] = '#25d366';
  memberColors['enat'] = '#53bdeb';
  memberColors['eisss'] = '#ff6b6b';

  const memberColorsJson = JSON.stringify(memberColors);

  const displayNames = { mas: 'Mas Fando', enat: 'Enat', eisss: 'Eisss' };
  if (config.chatMembers) {
    for (const [num, info] of Object.entries(config.chatMembers)) {
      displayNames[info.name.toLowerCase()] = info.name;
    }
  }
  const displayNamesJson = JSON.stringify(displayNames);

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Turu Lee Chat</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b141a; color: #e9edef; height: 100vh; display: flex; justify-content: center; }
        .chat-container { width: 100%; max-width: 500px; height: 100vh; display: flex; flex-direction: column; background: #111b21; border-left: 1px solid #202c33; border-right: 1px solid #202c33; }
        .header { background: #202c33; padding: 12px 16px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .header-photo-wrap { position: relative; width: 46px; height: 46px; flex-shrink: 0; }
        .header-group-photo { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid #00a884; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .online-dot { position: absolute; bottom: 0; right: 0; width: 13px; height: 13px; background: #25d366; border-radius: 50%; border: 2.5px solid #202c33; }
        .header-info h2 { font-size: 16px; font-weight: 600; color: #e9edef; display: flex; align-items: center; gap: 6px; }
        .header-info p { font-size: 12px; color: #8696a0; }
        .members-tag { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
        .tag { font-size: 10.5px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
        .messages-box { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background-color: #0b141a; background-image: radial-gradient(#1f2c34 1px, transparent 1px); background-size: 20px 20px; }
        .bubble-row { display: flex; width: 100%; }
        .bubble-row.enat { justify-content: flex-end; }
        .bubble-row.mas, .bubble-row.eisss { justify-content: flex-start; }
        .bubble { max-width: 80%; padding: 9px 13px; border-radius: 12px; font-size: 14.5px; line-height: 1.45; word-wrap: break-word; position: relative; }
        .bubble.enat { background: #005c4b; color: #e9edef; border-bottom-right-radius: 2px; }
        .bubble.mas { background: #202c33; color: #e9edef; border-bottom-left-radius: 2px; }
        .bubble.eisss { background: #2d1f2f; color: #e9edef; border-bottom-left-radius: 2px; border: 1px solid rgba(255,107,107,0.18); }
        .sender-header { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .sender-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
        .sender-name { font-size: 11.5px; font-weight: 600; }
        .msg-time { font-size: 10px; color: rgba(255,255,255,0.55); float: right; margin-left: 10px; margin-top: 4px; }
        .input-bar { background: #202c33; padding: 12px; display: flex; gap: 10px; align-items: center; }
        .input-box { flex: 1; background: #2a3942; border: none; outline: none; border-radius: 24px; padding: 12px 18px; color: #fff; font-size: 15px; }
        .input-box::placeholder { color: #8696a0; }
        .btn-send { background: #00a884; border: none; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; font-size: 18px; transition: 0.2s; flex-shrink: 0; }
        .btn-send:hover { background: #029071; }
        .btn-send:active { transform: scale(0.95); }
        .btn-mic { background: transparent; border: 2px solid #00a884; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #00a884; font-size: 20px; transition: 0.2s; flex-shrink: 0; }
        .btn-mic:hover { background: rgba(0,168,132,0.1); }
        .btn-mic.recording { background: #e53935; border-color: #e53935; color: #fff; animation: pulse-rec 1s ease-in-out infinite; }
        @keyframes pulse-rec {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .audio-player { width: 100%; max-width: 240px; height: 36px; border-radius: 18px; }
        .rec-indicator { display: none; color: #e53935; font-size: 12px; font-weight: 600; padding: 0 8px; align-items: center; gap: 4px; }
        .rec-indicator.active { display: flex; }
        .rec-dot { width: 8px; height: 8px; background: #e53935; border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      </style>
    </head>
    <body>
      <div class="chat-container">
        <div class="header">
          <div class="header-photo-wrap">
            <img src="/group-photo.jpg" alt="Turu Lee" class="header-group-photo" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=Turu+Lee&background=00a884&color=fff';" />
            <div class="online-dot" title="Online"></div>
          </div>
          <div class="header-info">
            <h2>🌙 Turu Lee</h2>
            <div class="members-tag">
              <span class="tag" style="background: rgba(37,211,102,0.15); color: #25d366;">Mas Fando</span>
              <span class="tag" style="background: rgba(83,189,235,0.15); color: #53bdeb;">Enat</span>
              <span class="tag" style="background: rgba(255,107,107,0.15); color: #ff6b6b;">Eisss</span>
            </div>
          </div>
        </div>

        <div class="messages-box" id="msgBox">
          <div style="text-align: center; color: #8696a0; font-size: 12px; margin: 15px 0;">
            🌙 Selamat datang di Turu Lee! Obrolan keluarga yang aman dan privat.
          </div>
        </div>

        <form class="input-bar" id="chatForm" onsubmit="kirimPesan(event)">
          <button type="button" class="btn-mic" id="btnMic" onclick="toggleRecord()" title="Voice Note">🎤</button>
          <div class="rec-indicator" id="recInd"><div class="rec-dot"></div><span id="recTimer">0:00</span></div>
          <input type="text" id="inputMsg" class="input-box" placeholder="Ketik pesan..." autocomplete="off" />
          <button type="submit" class="btn-send" id="sendBtn">➤</button>
        </form>
      </div>

      <script>
        const MEMBER_COLORS = ${memberColorsJson};
        const DISPLAY_NAMES = ${displayNamesJson};
        let lastCount = 0;

        function playDing() {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
          } catch(e) {}
        }

        if (window.Notification && Notification.permission !== 'granted') {
          Notification.requestPermission();
        }

        async function muatPesan() {
          try {
            const res = await fetch('/api/pesan');
            const msgs = await res.json();
            if (msgs.length > lastCount) {
              if (lastCount > 0) {
                const newest = msgs[msgs.length - 1];
                if (newest.from !== 'enat') {
                  playDing();
                  let normFrom = (newest.from || '').toLowerCase().trim();
                  if (normFrom.includes('lid') || normFrom === '6283184997388') normFrom = 'eisss';
                  const senderDisplay = DISPLAY_NAMES[normFrom] || (normFrom === 'mas' ? 'Mas Fando' : 'Eisss');
                  if (window.Notification && Notification.permission === 'granted') {
                    new Notification('Turu Lee — ' + senderDisplay, { body: newest.type === 'audio' ? '🎤 Voice Note' : newest.text });
                  }
                }
              }
              lastCount = msgs.length;
              renderMessages(msgs);
            }
          } catch(e) {}
        }

        function renderMessages(msgs) {
          const box = document.getElementById('msgBox');
          box.innerHTML = '<div style="text-align: center; color: #8696a0; font-size: 12px; margin: 15px 0;">🌙 Selamat datang di Turu Lee! Obrolan keluarga yang aman dan privat.</div>';
          msgs.forEach(m => {
            const row = document.createElement('div');
            let fromKey = (m.from || '').toLowerCase().trim();

            // Normalisasi agar tidak ada lagi @lid yang lolos
            if (fromKey.includes('lid') || fromKey === '6283184997388') {
              fromKey = 'eisss';
            } else if (fromKey === 'kakak') {
              fromKey = 'mas';
            } else if (fromKey === 'adik') {
              fromKey = 'enat';
            }

            row.className = 'bubble-row ' + fromKey;
            const senderColor = MEMBER_COLORS[fromKey] || (fromKey === 'mas' ? '#25d366' : fromKey === 'eisss' ? '#ff6b6b' : '#53bdeb');
            const senderDisplay = DISPLAY_NAMES[fromKey] || (fromKey === 'mas' ? 'Mas Fando' : fromKey === 'eisss' ? 'Eisss' : fromKey === 'enat' ? 'Enat' : m.from);

            let contentHtml = '';
            if (m.type === 'audio' && m.audioFile) {
              contentHtml = '<audio controls class="audio-player" preload="none"><source src="/api/vn/' + encodeURIComponent(m.audioFile) + '" type="audio/ogg"></audio>';
            } else {
              contentHtml = '<span class="text">' + escapeHtml(m.text) + '</span>';
            }

            const avatarHtml = fromKey === 'eisss' ? '<img src="/group-photo.jpg" class="sender-avatar" alt="Eisss" />' : '';

            row.innerHTML =
              '<div class="bubble ' + fromKey + '">' +
                '<div class="sender-header">' +
                  avatarHtml +
                  '<span class="sender-name" style="color: ' + senderColor + ';">' + escapeHtml(senderDisplay) + '</span>' +
                '</div>' +
                contentHtml +
                '<span class="msg-time">' + m.time + '</span>' +
              '</div>';
            box.appendChild(row);
          });
          box.scrollTop = box.scrollHeight;
        }

        function escapeHtml(t) {
          const div = document.createElement('div');
          div.textContent = t;
          return div.innerHTML;
        }

        async function kirimPesan(e) {
          e.preventDefault();
          const input = document.getElementById('inputMsg');
          const text = input.value.trim();
          if (!text) return;
          input.value = '';

          try {
            await fetch('/api/kirim-pesan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            muatPesan();
          } catch(e) {
            alert('Gagal mengirim pesan');
          }
        }

        // ==========================================
        // Voice Note Recording
        // ==========================================
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;
        let recStartTime = 0;
        let recTimerInterval = null;

        async function toggleRecord() {
          if (isRecording) {
            stopRecord();
          } else {
            startRecord();
          }
        }

        async function startRecord() {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunks = [];

            mediaRecorder.ondataavailable = e => {
              if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
              stream.getTracks().forEach(t => t.stop());
              const blob = new Blob(audioChunks, { type: 'audio/ogg' });
              if (blob.size > 500) {
                try {
                  await fetch('/api/kirim-vn', {
                    method: 'POST',
                    body: blob
                  });
                  muatPesan();
                } catch(err) {
                  alert('Gagal mengirim voice note');
                }
              }
            };

            mediaRecorder.start();
            isRecording = true;
            recStartTime = Date.now();
            document.getElementById('btnMic').classList.add('recording');
            document.getElementById('inputMsg').style.display = 'none';
            const recInd = document.getElementById('recInd');
            recInd.classList.add('active');

            recTimerInterval = setInterval(() => {
              const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
              const min = Math.floor(elapsed / 60);
              const sec = elapsed % 60;
              document.getElementById('recTimer').textContent = min + ':' + String(sec).padStart(2, '0');
            }, 500);
          } catch(e) {
            alert('Tidak bisa merekam. Pastikan izin mikrofon diberikan.');
          }
        }

        function stopRecord() {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          isRecording = false;
          clearInterval(recTimerInterval);
          document.getElementById('btnMic').classList.remove('recording');
          document.getElementById('inputMsg').style.display = '';
          document.getElementById('recInd').classList.remove('active');
          document.getElementById('recTimer').textContent = '0:00';
        }

        setInterval(muatPesan, 1500);
        muatPesan();
      </script>
    </body>
    </html>
  `;
}

server.listen(PORT, () => {
  console.log(`[Web Server] Aktif di port ${PORT}`);
  console.log(`[Turu Lee Chat] Buka http://localhost:${PORT}/pesan`);
  if (config.tgBotToken) {
    startTelegramPolling();
  }
});

// ==========================================
// Logika Bot WhatsApp (Baileys)
// ==========================================
process.on('uncaughtException', err => {
  console.error('Peringatan (uncaughtException):', err?.message || err);
});
process.on('unhandledRejection', reason => {
  console.error('Peringatan (unhandledRejection):', reason?.message || reason);
});

let sock = null;

async function startBot() {
  const authDir = path.join(__dirname, 'auth_info_baileys');

  if (!fs.existsSync(authDir) || !fs.readdirSync(authDir).length) {
    console.log('[Sesi] Memeriksa cadangan sesi di Firebase...');
    await restoreSessionFromFirebase(config.uid, authDir);
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    browser: Browsers.windows('Desktop'),
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    defaultQueryTimeoutMs: 60000
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await saveSessionToFirebase(config.uid, authDir);
  });

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentRawQr = qr;
      isConnected = false;
      qrcodeWeb.toDataURL(qr, (err, url) => {
        if (!err) currentQrDataUrl = url;
      });

      console.log('\n======================================================');
      console.log('📱 SCAN QR CODE INI DI WHATSAPP ANDA:');
      console.log('(Atau buka di browser: http://localhost:' + PORT + '/qr)');
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      currentQrDataUrl = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      console.log('Koneksi terputus (status: ' + statusCode + ').');

      if (isLoggedOut) {
        console.log('Sesi logout. Membersihkan sesi lokal & cloud, menyiapkan QR baru...');
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
        await clearSessionInFirebase(config.uid);
        setTimeout(startBot, 2000);
      } else {
        console.log('Menghubungkan ulang dalam 3 detik...');
        setTimeout(startBot, 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      currentQrDataUrl = null;
      console.log('\n======================================================');
      console.log('✅ WHATSAPP BERHASIL TERHUBUNG!');
      console.log('======================================================');

      await saveSessionToFirebase(config.uid, authDir);
      await syncGroups();
    }
  });

  // ==========================================
  // Sinkronisasi Grup WA
  // ==========================================
  async function syncGroups() {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const groupList = Object.values(groups);
      console.log(`Ditemukan ${groupList.length} grup WhatsApp.`);

      // Cari grup keuangan "Duit Gua Tuh"
      const financeGroup = groupList.find(g =>
        g.subject && g.subject.toLowerCase().includes(config.targetGroupName.toLowerCase())
      );

      if (financeGroup) {
        config.targetGroupId = financeGroup.id;
        console.log(`✅ Grup Keuangan: "${financeGroup.subject}" (ID: ${financeGroup.id})`);
      } else {
        console.log(`⚠️ Belum menemukan grup keuangan "${config.targetGroupName}".`);
      }

      // Cari grup obrolan "Turu Lee"
      const chatGroup = groupList.find(g =>
        g.subject && g.subject.toLowerCase().includes(config.chatGroupName.toLowerCase())
      );

      if (chatGroup) {
        config.chatGroupId = chatGroup.id;
        console.log(`✅ Grup Obrolan: "${chatGroup.subject}" (ID: ${chatGroup.id})`);
        await syncGroupParticipants(chatGroup.id);
      } else {
        console.log(`⚠️ Belum menemukan grup obrolan "${config.chatGroupName}".`);
        console.log(`   Ketik ".setchat" di grup obrolan Anda untuk menghubungkannya.\n`);
      }

      saveConfig();
    } catch (err) {
      console.error('Gagal sinkronisasi grup:', err.message);
    }
  }

  // ==========================================
  // Handler Pesan Masuk
  // ==========================================
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const id = msg.key.id;
      if (seenMessageIds.has(id)) continue;
      markSeen(id);

      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');

      const rawText = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      const text = rawText.trim();

      // Cek apakah pesan adalah audio/voice note
      const audioMsg = msg.message.audioMessage;
      const isVoiceNote = audioMsg && audioMsg.ptt;

      // Abaikan pesan balasan dari bot sendiri
      if (text && (
        /^[✅💰📊↩️⚠️•📖🤖💬]/.test(text) ||
        text.startsWith('Dompet default:') ||
        text.startsWith('Aku tidak menemukan') ||
        text.startsWith('Bagian ke-') ||
        text.startsWith('Peringatan:') ||
        text.startsWith('Dibatalkan:')
      )) {
        continue;
      }

      const replyMessage = async (jid, content) => {
        try {
          const sent = await sock.sendMessage(jid, content);
          if (sent?.key?.id) markSeen(sent.key.id);
          return sent;
        } catch (e) {
          console.error('Gagal kirim pesan:', e.message);
        }
      };

      // ==========================================
      // GRUP OBROLAN "TURU LEE"
      // ==========================================
      const isChatGroup = isGroup && (
        (config.chatGroupId && remoteJid === config.chatGroupId) ||
        false
      );

      // Perintah .setchat untuk menghubungkan grup obrolan
      if (isGroup && text.toLowerCase() === '.setchat') {
        config.chatGroupId = remoteJid;
        try {
          const meta = await sock.groupMetadata(remoteJid);
          if (meta.subject) config.chatGroupName = meta.subject;
        } catch (e) {}
        saveConfig();
        await syncGroupParticipants(remoteJid);
        await replyMessage(remoteJid, {
          text: `✅ *Grup ini terhubung sebagai Turu Lee Chat!*\nSemua pesan di sini akan muncul di layar laptop Enat.\nSemua anggota bisa ngobrol langsung tanpa awalan apapun!`
        });
        continue;
      }

      // Cek apakah ini pesan dari grup Turu Lee
      if (isChatGroup) {
        const sender = resolveSender(msg, true);
        const senderName = sender.name;
        const senderKey = sender.key;
        const senderIsBotOwner = sender.isOwner;

        // Command khusus di grup obrolan: .setfoto / .setphoto
        if (text && (text.toLowerCase() === '.setfoto' || text.toLowerCase() === '.setphoto')) {
          await updateGroupIconIfPossible(remoteJid);
          await replyMessage(remoteJid, {
            text: `✅ *Foto profil grup Turu Lee berhasil diperbarui!*`
          });
          continue;
        }

        // Deteksi Voice Note dari WA → simpan dan tampilkan di web
        if (isVoiceNote) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const vnFilename = 'vn_wa_' + Date.now() + '.ogg';
            const vnPath = path.join(vnDir, vnFilename);
            fs.writeFileSync(vnPath, buffer);

            addGroupMessage(senderKey, '🎤 Voice Note', 'audio', vnFilename);
            notifyUbuntuDesktop(`VN dari ${senderName}`, '🎤 Voice Note baru');

            if (!senderIsBotOwner) {
              sendTelegramNotification(senderName, '🎤 [Voice Note]');
            }
          } catch (err) {
            console.error('Gagal download VN:', err.message);
          }
          continue;
        }

        // Pesan teks dari WA Turu Lee → simpan ke chat dan notif
        if (text && !text.startsWith('.')) {
          addGroupMessage(senderKey, text);
          notifyUbuntuDesktop(`Pesan dari ${senderName}`, text);

          // Jika bukan Mas Fando, notif ke Telegram
          if (!senderIsBotOwner) {
            sendTelegramNotification(senderName, text);
          }
        }

        // Pesan dengan awalan "." di grup chat tetap bisa diproses sebagai command
        if (text && text.startsWith('.')) {
          const cleanText = text.replace(/^\./, '').trim();
          const low = cleanText.toLowerCase();

          if (low.startsWith('enat ') || low === 'enat' || low.startsWith('adik ') || low === 'adik') {
            const balasan = cleanText.replace(/^(enat|adik)\s*/i, '').trim();
            if (!balasan) {
              await replyMessage(remoteJid, { text: 'Tulis pesan, contoh: *.enat Mas lagi di jalan*' });
            } else {
              addGroupMessage('mas', balasan);
              notifyUbuntuDesktop('Pesan dari Mas Fando', balasan);
              await replyMessage(remoteJid, { text: `✅ *Terkirim ke laptop Enat:*\n"${balasan}"` });
            }
          }

          if (low.startsWith('token ') || low.startsWith('settoken ')) {
            const tkn = cleanText.replace(/^(settoken|token)\s*/i, '').trim();
            if (tkn) {
              config.tgBotToken = tkn;
              saveConfig();
              startTelegramPolling();
              sendTelegramNotification('System', 'Halo Mas Fando! Bot Token Telegram berhasil disimpan dan Turu Lee siap!');
              await replyMessage(remoteJid, { text: `✅ *Bot Token Telegram berhasil disimpan!*\nSekarang bisa balas langsung dari Telegram.` });
            }
          }
        }

        continue;
      }

      // ==========================================
      // Auto-detect grup Turu Lee berdasarkan nama jika belum di-set
      // ==========================================
      if (isGroup && !isChatGroup && !config.chatGroupId) {
        try {
          const meta = await sock.groupMetadata(remoteJid);
          if (meta.subject && meta.subject.toLowerCase().includes(config.chatGroupName.toLowerCase())) {
            config.chatGroupId = remoteJid;
            saveConfig();
            console.log(`✅ Grup Obrolan ditemukan otomatis: "${meta.subject}" (ID: ${remoteJid})`);
            await syncGroupParticipants(remoteJid);
          }
        } catch (e) {}
      }

      // ==========================================
      // GRUP KEUANGAN "DUIT GUA TUH"
      // ==========================================

      // Perintah setgroup
      if (isGroup && text.toLowerCase() === '.setgroup') {
        config.targetGroupId = remoteJid;
        saveConfig();
        await replyMessage(remoteJid, {
          text: `✅ *Grup ini berhasil dihubungkan ke Keuanganku!*\nSekarang kamu bisa langsung ketik transaksi di sini (misal: "makan siang 25rb gopay" atau "saldo").`
        });
        continue;
      }

      const isTargetGroup = isGroup && (config.targetGroupId ? remoteJid === config.targetGroupId : false);

      if (isGroup && !isTargetGroup) {
        try {
          const meta = await sock.groupMetadata(remoteJid);
          if (meta.subject && meta.subject.toLowerCase().includes(config.targetGroupName.toLowerCase())) {
            config.targetGroupId = remoteJid;
            saveConfig();
          } else {
            continue;
          }
        } catch (e) {
          continue;
        }
      }

      if (!text) continue;

      // Chat pribadi: hanya proses perintah (diawali ".")
      if (!isGroup && !text.startsWith('.')) {
        continue;
      }

      const cleanText = text.replace(/^\./, '').trim();
      let low = cleanText.toLowerCase();

      try {
        // ==========================================
        // Perintah Balas ke Enat: ".enat <pesan>"
        // ==========================================
        if (low.startsWith('enat ') || low === 'enat' || low.startsWith('adik ') || low === 'adik') {
          const balasan = cleanText.replace(/^(enat|adik)\s*/i, '').trim();
          if (!balasan) {
            await replyMessage(remoteJid, { text: 'Tulis pesan untuk Enat, contoh: *.enat Mas lagi di jalan*' });
          } else {
            addGroupMessage('mas', balasan);
            notifyUbuntuDesktop('Pesan dari Mas Fando', balasan);
            await replyMessage(remoteJid, { text: `✅ *Terkirim ke laptop Enat:*\n"${balasan}"` });
          }
          continue;
        }

        // ==========================================
        // Pengaturan Token Bot Telegram
        // ==========================================
        if (low.startsWith('token ') || low.startsWith('settoken ')) {
          const tkn = cleanText.replace(/^(settoken|token)\s*/i, '').trim();
          if (tkn) {
            config.tgBotToken = tkn;
            saveConfig();
            startTelegramPolling();
            sendTelegramNotification('System', 'Halo Mas Fando! Bot Token Telegram berhasil disimpan.');
            await replyMessage(remoteJid, { text: `✅ *Bot Token Telegram berhasil disimpan!*\nSekarang bisa balas langsung dari Telegram.` });
            continue;
          }
        }

        // ==========================================
        // Logika Bot Keuangan (hanya di Duit Gua Tuh)
        // ==========================================
        if (/^(start|bantuan|help|menu|halo+|hai+|hi+|\?)$/i.test(low)) {
          const help = `📖 *Panduan Penggunaan Bot Keuanganku*\n\n` +
            `*1. Catat Pengeluaran/Pemasukan:*\n` +
            `• makan siang 25rb gopay\n` +
            `• bensin pertalite 30k bca kemarin\n` +
            `• gajian 5jt bni\n` +
            `• jajan es kopi 15k, batagor 10k cash\n\n` +
            `*2. Transfer Antar Dompet:*\n` +
            `• tf 100k bca ke gopay\n` +
            `• pindah 50rb cash ke dana\n\n` +
            `*3. Cek Saldo & Rekap:*\n` +
            `• ketik *saldo* : Cek saldo semua dompet\n` +
            `• ketik *rekap* : Rekap pengeluaran bulan ini\n` +
            `• ketik *undo* atau *batal* : Batalkan transaksi terakhir\n` +
            `• ketik *default <dompet>* : Ganti dompet default (mis. default bca)\n\n` +
            `*4. Chat Grup Turu Lee:*\n` +
            `• Semua pesan di grup Turu Lee otomatis masuk ke laptop Enat\n` +
            `• Atau ketik *.enat <pesan>* di grup ini\n\n` +
            `*5. Pengaturan:*\n` +
            `• *.token <bot_token>* : Hubungkan bot Telegram\n` +
            `• *.setchat* : Set grup sebagai Turu Lee Chat\n` +
            `• *.setfoto* : Pasang foto profil grup Turu Lee`;
          await replyMessage(remoteJid, { text: help });
          continue;
        }

        if (/^(saldo|cek saldo)$/.test(low)) {
          const saldoText = await getSaldo(config.uid);
          await replyMessage(remoteJid, { text: saldoText });
          continue;
        }

        if (/^(rekap|laporan|bulan ini|rekap bulan ini)$/.test(low)) {
          const rekapText = await getRekap(config.uid);
          await replyMessage(remoteJid, { text: rekapText });
          continue;
        }

        if (/^(undo|batal|hapus terakhir)$/.test(low)) {
          const undoMsg = await undoLast(config.uid);
          await replyMessage(remoteJid, { text: undoMsg });
          continue;
        }

        if (/^default(\s|$)/.test(low)) {
          const arg = low.replace(/^default\s*/, '').trim();
          const names = Object.keys(WALLETS).map(k => WALLETS[k]).join(', ');
          if (!arg) {
            const cur = await getDefaultSource(config.uid);
            await replyMessage(remoteJid, {
              text: `Dompet default saat ini: *${WALLETS[cur] || 'Cash'}*.\nGanti dengan *default bca* (Pilihan: ${names}).`
            });
          } else {
            const match = Object.keys(WALLETS).find(k => k === arg || WALLETS[k].toLowerCase() === arg);
            if (match) {
              await setDefaultSource(config.uid, match);
              await replyMessage(remoteJid, {
                text: `✅ Dompet default diubah menjadi *${WALLETS[match]}*. Transaksi tanpa nama dompet akan otomatis masuk ke sini.`
              });
            } else {
              await replyMessage(remoteJid, {
                text: `Dompet "${arg}" tidak dikenal. Pilihan: ${names}.`
              });
            }
          }
          continue;
        }

        const tf = parseTransfer_(cleanText);
        if (tf.ok) {
          const { tx, balFrom, balTo } = await saveTransfer(config.uid, tf);
          const reply = `✅ *Transfer Dicatat*\n` +
            `${rupiah_(tx.amount)} : ${WALLETS[tf.sourceFrom]} ➡️ ${WALLETS[tf.sourceTo]}\n\n` +
            `• Saldo ${WALLETS[tf.sourceFrom]}: ${rupiah_(balFrom)}\n` +
            `• Saldo ${WALLETS[tf.sourceTo]}: ${rupiah_(balTo)}`;
          await replyMessage(remoteJid, { text: reply });
          continue;
        }

        const parsed = parseMessage_(cleanText);
        if (!parsed.ok) {
          if (isTargetGroup) {
            await replyMessage(remoteJid, { text: '⚠️ ' + parsed.message });
          }
          continue;
        }

        const items = parsed.items;
        const defaultWallet = await getDefaultSource(config.uid);
        items.forEach(it => {
          if (!it.source) it.source = defaultWallet;
        });

        const { txs, walletBalances } = await saveTransactions(config.uid, items);

        if (txs.length === 1) {
          const tx = txs[0];
          const label = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
          const sign = tx.type === 'income' ? '+' : '-';
          const reply = `✅ *${label} Dicatat*\n` +
            `${sign}${rupiah_(tx.amount)} · ${tx.category}\n` +
            `📝 ${tx.title}\n` +
            `👛 ${WALLETS[tx.source]}: Saldo ${rupiah_(walletBalances[tx.source])}`;
          await replyMessage(remoteJid, { text: reply });
        } else {
          const lines = txs.map((tx, i) => {
            const sign = tx.type === 'income' ? '+' : '-';
            return `${i + 1}. ${sign}${rupiah_(tx.amount)} · ${tx.category} — ${tx.title} (${WALLETS[tx.source]})`;
          });
          const walletLines = Object.keys(walletBalances).map(k => `• ${WALLETS[k]}: ${rupiah_(walletBalances[k])}`);
          const reply = `✅ *${txs.length} Transaksi Dicatat*\n` +
            lines.join('\n') + '\n\n' +
            `👛 *Saldo Terkait:*\n` + walletLines.join('\n');
          await replyMessage(remoteJid, { text: reply });
        }
      } catch (err) {
        console.error('Error saat memproses pesan:', err);
        if (isTargetGroup) {
          await replyMessage(remoteJid, {
            text: `⚠️ Maaf, terjadi kesalahan saat menyimpan transaksi:\n${err.message}`
          });
        }
      }
    }
  });
}

startBot().catch(console.error);
