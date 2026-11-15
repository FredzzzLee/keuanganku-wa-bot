const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { WALLETS, rupiah_ } = require('./parser');

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Gagal parse FIREBASE_SERVICE_ACCOUNT:', e.message);
  }
}
if (!serviceAccount) {
  const localSaPath = path.join(__dirname, 'service-account.json');
  if (fs.existsSync(localSaPath)) {
    serviceAccount = require(localSaPath);
  } else {
    console.error('Peringatan: service-account.json tidak ditemukan dan FIREBASE_SERVICE_ACCOUNT belum disetel!');
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://pencatatan-keuanganku-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const db = admin.database();

function normalizeData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const balances = data.balances && typeof data.balances === 'object' ? data.balances : {};
  Object.keys(WALLETS).forEach(k => {
    balances[k] = Number(balances[k]) || 0;
  });
  data.balances = balances;
  data.transactions = Array.isArray(data.transactions)
    ? data.transactions.filter(t => t != null)
    : (data.transactions && typeof data.transactions === 'object' ? Object.values(data.transactions).filter(t => t != null) : []);
  data.goals = Array.isArray(data.goals)
    ? data.goals.filter(g => g != null)
    : (data.goals && typeof data.goals === 'object' ? Object.values(data.goals).filter(g => g != null) : []);
  data.balance = Object.keys(WALLETS).reduce((s, k) => s + (Number(balances[k]) || 0), 0);
  return data;
}

async function updateUserData(uid, mutator) {
  const ref = db.ref(`users/${uid}/data`);
  const result = await ref.transaction(current => {
    const data = normalizeData(current);
    const res = mutator(data);
    if (res === null) return;
    return data;
  });

  if (!result.committed) {
    throw new Error('Gagal memperbarui database Firebase.');
  }
  return result.snapshot.val();
}

async function saveTransactions(uid, items) {
  const base = Date.now();
  const txs = items.map((p, i) => ({
    id: `tx_${base}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    type: p.type,
    amount: p.amount,
    source: p.source,
    category: p.category,
    title: p.title,
    date: p.date,
    via: 'whatsapp'
  }));

  let walletBalances = {};
  await updateUserData(uid, data => {
    txs.forEach(tx => {
      data.transactions.unshift(tx);
      if (tx.type === 'income') data.balances[tx.source] += tx.amount;
      else data.balances[tx.source] -= tx.amount;
    });
    data.balance = Object.keys(WALLETS).reduce((s, k) => s + (Number(data.balances[k]) || 0), 0);
    txs.forEach(tx => { walletBalances[tx.source] = data.balances[tx.source]; });
  });

  return { txs, walletBalances };
}

async function saveTransfer(uid, tf) {
  const txId = `tx_${Date.now()}_tf_${Math.random().toString(36).slice(2, 7)}`;
  const tx = {
    id: txId,
    type: 'transfer',
    amount: tf.amount,
    sourceFrom: tf.sourceFrom,
    sourceTo: tf.sourceTo,
    category: 'Transfer',
    title: `Transfer ${WALLETS[tf.sourceFrom]} → ${WALLETS[tf.sourceTo]}`,
    date: tf.date,
    via: 'whatsapp'
  };

  let balFrom = 0;
  let balTo = 0;
  await updateUserData(uid, data => {
    data.transactions.unshift(tx);
    data.balances[tf.sourceFrom] = (data.balances[tf.sourceFrom] || 0) - tf.amount;
    data.balances[tf.sourceTo] = (data.balances[tf.sourceTo] || 0) + tf.amount;
    data.balance = Object.keys(WALLETS).reduce((s, k) => s + (Number(data.balances[k]) || 0), 0);
    balFrom = data.balances[tf.sourceFrom];
    balTo = data.balances[tf.sourceTo];
  });

  return { tx, balFrom, balTo };
}

async function getSaldo(uid) {
  const snap = await db.ref(`users/${uid}/data`).once('value');
  const data = normalizeData(snap.val());
  const lines = Object.keys(WALLETS)
    .filter(k => data.balances[k] !== 0)
    .map(k => `• ${WALLETS[k]}: ${rupiah_(data.balances[k])}`);
  const locked = data.goals.reduce((s, g) => s + Number(g.collectedAmount || 0), 0);
  let out = `💰 *Saldo Anda*\n` + (lines.length ? lines.join('\n') : '(Semua dompet masih Rp 0)') +
    `\n\nTotal: *${rupiah_(data.balance)}*`;
  if (locked > 0) {
    out += `\nDitabung di goals: ${rupiah_(locked)}\nTersedia: ${rupiah_(data.balance - locked)}`;
  }
  return out;
}

async function getRekap(uid) {
  const snap = await db.ref(`users/${uid}/data`).once('value');
  const data = normalizeData(snap.val());

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let income = 0;
  let expense = 0;
  const byCat = {};

  data.transactions.forEach(t => {
    if (!t.date || !t.date.startsWith(yearMonth)) return;
    if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'expense') {
      expense += t.amount;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
  });

  const top = Object.keys(byCat)
    .sort((a, b) => byCat[b] - byCat[a])
    .slice(0, 3)
    .map(c => `• ${c}: ${rupiah_(byCat[c])}`);

  return `📊 *Rekap Bulan Ini*\n` +
    `Pemasukan: ${rupiah_(income)}\n` +
    `Pengeluaran: ${rupiah_(expense)}\n` +
    `Selisih: ${rupiah_(income - expense)}` +
    (top.length ? `\n\nPengeluaran Terbesar:\n${top.join('\n')}` : '');
}

async function undoLast(uid) {
  let removedTx = null;
  await updateUserData(uid, data => {
    if (!data.transactions.length) return null;
    const tx = data.transactions.shift();
    if (tx.type === 'transfer') {
      if (tx.sourceFrom) data.balances[tx.sourceFrom] += tx.amount;
      if (tx.sourceTo) data.balances[tx.sourceTo] -= tx.amount;
    } else if (tx.source) {
      if (tx.type === 'income') data.balances[tx.source] -= tx.amount;
      else if (tx.type === 'expense') data.balances[tx.source] += tx.amount;
    }
    data.balance = Object.keys(WALLETS).reduce((s, k) => s + (Number(data.balances[k]) || 0), 0);
    removedTx = tx;
  });

  if (!removedTx) {
    return 'Tidak ada transaksi yang bisa dibatalkan.';
  }
  return `↩️ *Dibatalkan:* ${removedTx.title} (${rupiah_(removedTx.amount)}).`;
}

async function getDefaultSource(uid) {
  const snap = await db.ref(`profiles/${uid}/waDefaultSource`).once('value');
  return snap.val() || 'cash';
}

async function setDefaultSource(uid, sourceKey) {
  await db.ref(`profiles/${uid}/waDefaultSource`).set(sourceKey);
}

// ==========================================
// Sinkronisasi Sesi WhatsApp ke Firebase
// ==========================================

async function restoreSessionFromFirebase(uid, authDir) {
  try {
    const snap = await db.ref(`waSession/${uid}`).once('value');
    const val = snap.val();
    if (!val || typeof val !== 'object') return false;

    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    let count = 0;
    for (const [encodedName, content] of Object.entries(val)) {
      if (typeof content !== 'string') continue;
      const fileName = Buffer.from(encodedName, 'base64url').toString('utf8');
      fs.writeFileSync(path.join(authDir, fileName), content, 'utf8');
      count++;
    }
    console.log(`[Firebase] Berhasil memulihkan ${count} file sesi WhatsApp dari cloud.`);
    return count > 0;
  } catch (err) {
    console.error('[Firebase] Gagal restore sesi:', err.message);
    return false;
  }
}

async function saveSessionToFirebase(uid, authDir) {
  try {
    if (!fs.existsSync(authDir)) return;
    const files = fs.readdirSync(authDir);
    const updates = {};
    for (const file of files) {
      const fullPath = path.join(authDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const encodedName = Buffer.from(file).toString('base64url');
        updates[encodedName] = content;
      }
    }
    if (Object.keys(updates).length) {
      await db.ref(`waSession/${uid}`).set(updates);
    }
  } catch (err) {
    console.error('[Firebase] Gagal simpan sesi ke cloud:', err.message);
  }
}

async function clearSessionInFirebase(uid) {
  try {
    await db.ref(`waSession/${uid}`).remove();
    console.log('[Firebase] Sesi di cloud dibersihkan.');
  } catch (err) {
    console.error('[Firebase] Gagal membersihkan sesi di cloud:', err.message);
  }
}

module.exports = {
  db,
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
};
