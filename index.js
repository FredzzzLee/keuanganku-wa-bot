const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeWeb = require('qrcode');
const http = require('http');
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
  defaultWallet: 'cash'
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
// Fitur Chat Khusus Adik (Privat)
// ==========================================
const chatAdikPath = path.join(__dirname, 'chat_adik.json');
let chatAdikMessages = [];
if (fs.existsSync(chatAdikPath)) {
  try {
    chatAdikMessages = JSON.parse(fs.readFileSync(chatAdikPath, 'utf8'));
  } catch (e) {}
}

function saveChatAdik() {
  try {
    if (chatAdikMessages.length > 100) chatAdikMessages = chatAdikMessages.slice(-100);
    fs.writeFileSync(chatAdikPath, JSON.stringify(chatAdikMessages, null, 2), 'utf8');
  } catch (e) {}
}

function addAdikMessage(from, text) {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    from,
    text,
    time
  };
  chatAdikMessages.push(msg);
  saveChatAdik();
  return msg;
}

function notifyUbuntuDesktop(title, body) {
  if (process.platform === 'linux') {
    const cleanTitle = title.replace(/"/g, '\\"');
    const cleanBody = body.replace(/"/g, '\\"');
    exec(`notify-send -a "Chat Kakak" "${cleanTitle}" "${cleanBody}"`, err => {
      if (err) console.error('notify-send error:', err.message);
    });
  }
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

  // 1. Health check untuk UptimeRobot
  if (url === '/health' || url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // 2. API Chat Adik: Ambil riwayat chat
  if (url === '/api/pesan' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(chatAdikMessages));
  }

  // 3. API Chat Adik: Kirim pesan dari laptop adik ke WhatsApp Kakak
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

        const newMsg = addAdikMessage('adik', text);

        // Kirim WhatsApp ke grup atau nomor pribadi kakak
        const target = config.targetGroupId || (sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null);
        if (sock && target) {
          try {
            const sent = await sock.sendMessage(target, {
              text: `💬 *[Pesan dari Adik]:*\n"${text}"\n\n_Balas dengan: .adik <pesanmu>_`
            });
            if (sent?.key?.id) markSeen(sent.key.id);
          } catch (err) {
            console.error('Gagal kirim WA ke kakak:', err.message);
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

  // 4. Halaman Web Chat Privat Adik (http://localhost:3000/pesan)
  if (url === '/pesan' || url === '/chat') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Chat Kak Fando</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b141a; color: #e9edef; height: 100vh; display: flex; justify-content: center; }
          .chat-container { width: 100%; max-width: 500px; height: 100vh; display: flex; flex-direction: column; background: #111b21; border-left: 1px solid #202c33; border-right: 1px solid #202c33; }
          .header { background: #202c33; padding: 14px 18px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
          .avatar { width: 42px; height: 42px; border-radius: 50%; background: #00a884; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: #fff; }
          .header-info h2 { font-size: 16px; font-weight: 600; color: #e9edef; }
          .header-info p { font-size: 12px; color: #25d366; display: flex; align-items: center; gap: 5px; }
          .dot { width: 7px; height: 7px; background: #25d366; border-radius: 50%; }
          .messages-box { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background-color: #0b141a; background-image: radial-gradient(#1f2c34 1px, transparent 1px); background-size: 20px 20px; }
          .bubble-row { display: flex; width: 100%; }
          .bubble-row.adik { justify-content: flex-end; }
          .bubble-row.kakak { justify-content: flex-start; }
          .bubble { max-width: 78%; padding: 9px 13px; border-radius: 12px; font-size: 14.5px; line-height: 1.45; word-wrap: break-word; position: relative; }
          .bubble.adik { background: #005c4b; color: #e9edef; border-bottom-right-radius: 2px; }
          .bubble.kakak { background: #202c33; color: #e9edef; border-bottom-left-radius: 2px; }
          .sender-name { font-size: 11px; font-weight: 600; margin-bottom: 3px; color: #25d366; }
          .bubble.adik .sender-name { color: #53bdeb; }
          .msg-time { font-size: 10px; color: rgba(255,255,255,0.55); float: right; margin-left: 10px; margin-top: 4px; }
          .input-bar { background: #202c33; padding: 12px; display: flex; gap: 10px; align-items: center; }
          .input-box { flex: 1; background: #2a3942; border: none; outline: none; border-radius: 24px; padding: 12px 18px; color: #fff; font-size: 15px; }
          .input-box::placeholder { color: #8696a0; }
          .btn-send { background: #00a884; border: none; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; font-size: 18px; transition: 0.2s; shrink: 0; }
          .btn-send:hover { background: #029071; }
          .btn-send:active { transform: scale(0.95); }
        </style>
      </head>
      <body>
        <div class="chat-container">
          <div class="header">
            <div class="avatar">K</div>
            <div class="header-info">
              <h2>Kak Fando</h2>
              <p><span class="dot"></span> Online via WhatsApp</p>
            </div>
          </div>

          <div class="messages-box" id="msgBox">
            <div style="text-align: center; color: #8696a0; font-size: 12px; margin: 15px 0;">
              🔒 Pesan ini langsung terkirim ke WhatsApp Kak Fando secara aman.
            </div>
          </div>

          <form class="input-bar" id="chatForm" onsubmit="kirimPesan(event)">
            <input type="text" id="inputMsg" class="input-box" placeholder="Ketik pesan untuk Kak Fando..." autocomplete="off" />
            <button type="submit" class="btn-send" id="sendBtn">➤</button>
          </form>
        </div>

        <script>
          let lastCount = 0;

          // Suara notifikasi lembut via Web Audio API
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
                // Ada pesan baru dari kakak
                if (lastCount > 0) {
                  const newest = msgs[msgs.length - 1];
                  if (newest.from === 'kakak') {
                    playDing();
                    if (window.Notification && Notification.permission === 'granted') {
                      new Notification('Pesan dari Kak Fando', { body: newest.text });
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
            box.innerHTML = '<div style="text-align: center; color: #8696a0; font-size: 12px; margin: 15px 0;">🔒 Pesan ini langsung terkirim ke WhatsApp Kak Fando secara aman.</div>';
            msgs.forEach(m => {
              const row = document.createElement('div');
              row.className = 'bubble-row ' + m.from;
              row.innerHTML = \`
                <div class="bubble \${m.from}">
                  <div class="sender-name">\${m.from === 'adik' ? 'Adik' : 'Kak Fando'}</div>
                  <span class="text">\${escapeHtml(m.text)}</span>
                  <span class="msg-time">\${m.time}</span>
                </div>
              \`;
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

          setInterval(muatPesan, 1500);
          muatPesan();
        </script>
      </body>
      </html>
    `);
  }

  // 5. Halaman Scan QR Code di Browser (/qr)
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
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">● Online 24 Jam</div>
            <h1>✅ WhatsApp Terhubung!</h1>
            <p>Bot Keuanganku aktif dan siap digunakan di grup <b>"${config.targetGroupName}"</b>.</p>
            <p style="margin-top: 15px;"><a href="/pesan" style="color: #25d366; text-decoration: none; font-weight: 600;">👉 Buka Halaman Chat Adik</a></p>
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
            h1 { font-size: 20px; margin: 0 0 8px 0; color: #fff; }
            p { font-size: 13px; color: #8696a0; margin: 0 0 20px 0; line-height: 1.5; }
            .qr-box { background: #fff; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 16px; }
            img { display: block; width: 240px; height: 240px; }
            .hint { font-size: 12px; color: #00a884; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Tautkan WhatsApp</h1>
            <p>Buka WhatsApp di HP &gt; Titik 3 / Setelan &gt; <b>Perangkat Tertaut</b> &gt; <b>Tautkan Perangkat</b> lalu scan:</p>
            <div class="qr-box">
              <img src="${currentQrDataUrl}" alt="QR Code WhatsApp" />
            </div>
            <div class="hint">Halaman ini otomatis me-refresh jika ada QR baru.</div>
          </div>
        </body>
        </html>
      `);
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Memuat QR Code...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3">
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h2>Menyiapkan QR Code WhatsApp...</h2>
          <p style="color: #8696a0;">Halaman akan otomatis memuat dalam beberapa detik.</p>
        </div>
      </body>
      </html>
    `);
  }

  // 6. Status JSON default
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    connected: isConnected,
    group: config.targetGroupName,
    groupId: config.targetGroupId,
    chatAdikUrl: '/pesan',
    qrUrl: '/qr'
  }, null, 2));
});

server.listen(PORT, () => {
  console.log(`[Web Server] Aktif di port ${PORT}`);
  console.log(`[Chat Adik] Buka http://localhost:${PORT}/pesan untuk chat khusus adik`);
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

  async function syncGroups() {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const groupList = Object.values(groups);
      console.log(`Ditemukan ${groupList.length} grup WhatsApp.`);

      const found = groupList.find(g =>
        g.subject && g.subject.toLowerCase().includes(config.targetGroupName.toLowerCase())
      );

      if (found) {
        config.targetGroupId = found.id;
        saveConfig();
        console.log(`✅ Grup Keuangan Ditemukan: "${found.subject}" (ID: ${found.id})`);
        console.log('Bot siap mendengarkan pesan di grup ini!\n');
      } else {
        console.log(`⚠️ Belum menemukan grup bernama "${config.targetGroupName}".`);
        console.log(`Ketik ".setgroup" di grup keuangan Anda untuk menghubungkannya secara manual.\n`);
      }
    } catch (err) {
      console.error('Gagal sinkronisasi grup:', err.message);
    }
  }

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
      if (!text) continue;

      // Abaikan pesan balasan dari bot sendiri agar tidak terjadi looping
      if (
        /^[✅💰📊↩️⚠️•📖🤖💬]/.test(text) ||
        text.startsWith('Dompet default:') ||
        text.startsWith('Aku tidak menemukan') ||
        text.startsWith('Bagian ke-') ||
        text.startsWith('Peringatan:') ||
        text.startsWith('Dibatalkan:')
      ) {
        continue;
      }

      // Helper untuk kirim balasan sekaligus menandai ID pesan agar tidak diproses balik
      const replyMessage = async (jid, content) => {
        try {
          const sent = await sock.sendMessage(jid, content);
          if (sent?.key?.id) markSeen(sent.key.id);
          return sent;
        } catch (e) {
          console.error('Gagal kirim pesan:', e.message);
        }
      };

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

      if (!isGroup && !text.startsWith('.')) {
        continue;
      }

      const cleanText = text.replace(/^\./, '').trim();
      let low = cleanText.toLowerCase();

      try {
        // ==========================================
        // Perintah Balas ke Adik: ".adik <pesan>"
        // ==========================================
        if (low.startsWith('adik ') || low === 'adik') {
          const balasan = cleanText.replace(/^adik\s*/i, '').trim();
          if (!balasan) {
            await replyMessage(remoteJid, { text: 'Tulis pesan untuk adik, contoh: *.adik kakak lagi di jalan*' });
          } else {
            addAdikMessage('kakak', balasan);
            notifyUbuntuDesktop('Pesan dari Kak Fando', balasan);
            await replyMessage(remoteJid, { text: `✅ *Terkirim ke laptop adik:*\n"${balasan}"` });
          }
          continue;
        }

        // ==========================================
        // Logika Bot Keuangan
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
            `*4. Balas Chat Adik di Laptop:*\n` +
            `• ketik *.adik <pesan>* (misal: *.adik iya kakak pulang jam 6*)`;
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
