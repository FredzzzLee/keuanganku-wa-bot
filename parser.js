const WALLETS = {
  cash: 'Cash', dana: 'DANA', shopeepay: 'ShopeePay', gopay: 'GoPay', ovo: 'OVO',
  bca: 'BCA', bni: 'BNI', bri: 'BRI', seabank: 'SeaBank', btn: 'BTN'
};

const WALLET_ALIASES = [
  ['cash', 'cash|tunai|uang\\s+tunai|cas|kes'],
  ['dana', 'dana(?!\\s+(?:darurat|pensiun|talangan|desa|bos|cadangan|sosial|hibah|bantuan|investasi|kuliah|pendidikan|liburan|nikah))'],
  ['shopeepay', 'shopeepay|shopee\\s*pay|s-?pay'],
  ['gopay', 'gopay|go-pay|go\\s*pay|gopey'],
  ['ovo', 'ovo'],
  ['bca', 'bca|m-?bca|my\\s*bca|bank\\s*bca|klik\\s*bca'],
  ['bni', 'bni|bank\\s*bni|wondr'],
  ['bri', 'bri|bank\\s*bri|brimo|bri\\s*mo|m-?bri'],
  ['seabank', 'seabank|sea\\s*bank|sea-bank'],
  ['btn', 'btn|bank\\s*btn']
];

const EXPENSE_CATEGORIES = [
  ['Makanan', [
    'makan', 'makanan', 'makan siang', 'makan malam', 'sarapan', 'sahur', 'buka puasa', 'bukber', 'takjil', 'lunch', 'dinner', 'brunch',
    'kopi', 'ngopi', 'kopi susu', 'latte', 'americano', 'cappuccino',
    'jajan', 'jajanan', 'snack', 'camilan', 'cemilan', 'ngemil', 'nyemil',
    'minum', 'minuman', 'teh', 'susu', 'jus', 'boba', 'es', 'es krim', 'eskrim', 'air mineral', 'aqua',
    'nasi', 'nasgor', 'nasi goreng', 'ayam', 'bebek', 'lele', 'ikan', 'geprek', 'bakso', 'mie', 'mi', 'mie ayam', 'indomie',
    'soto', 'sate', 'sop', 'rawon', 'pecel', 'gado-gado', 'lontong', 'bubur', 'siomay', 'batagor', 'seblak', 'cilok', 'cimol', 'pentol',
    'otak-otak', 'kebab', 'burger', 'pizza', 'sushi', 'ramen', 'dimsum', 'padang', 'lalapan',
    'roti', 'kue', 'donat', 'martabak', 'gorengan', 'pisang goreng', 'cokelat', 'coklat', 'permen',
    'kantin', 'warung', 'warteg', 'angkringan', 'burjo', 'cafe', 'kafe', 'resto', 'restoran', 'catering', 'katering',
    'starbucks', 'kfc', 'mcd', 'mcdonalds', 'mixue', 'chatime',
    'gofood', 'grabfood', 'shopeefood',
    'telur', 'beras', 'sayur', 'buah', 'daging', 'tempe', 'tahu', 'minyak goreng', 'gula', 'tepung', 'bumbu'
  ]],
  ['Transport', [
    'bensin', 'bbm', 'pertalite', 'pertamax', 'pertamax turbo', 'dexlite', 'solar', 'pertamina', 'spbu', 'shell', 'isi bensin',
    'parkir', 'tol', 'etoll', 'e-toll', 'emoney', 'e-money', 'tapcash', 'flazz', 'brizzi',
    'ojek', 'ojol', 'grab', 'grabbike', 'grabcar', 'gojek', 'gocar', 'goride', 'gotransit', 'maxim', 'indrive', 'bluebird',
    'angkot', 'bus', 'bis', 'damri', 'kereta', 'krl', 'commuter', 'kai', 'whoosh', 'taksi', 'taxi', 'travel', 'shuttle',
    'transport', 'transportasi', 'busway', 'transjakarta', 'jaklingko', 'mrt', 'lrt',
    'tiket kereta', 'tiket bus', 'tiket pesawat', 'pesawat', 'garuda', 'lion air', 'citilink', 'airasia', 'kapal', 'feri', 'ferry', 'becak',
    'servis', 'service', 'bengkel', 'oli', 'ganti oli', 'ban', 'tambal ban', 'cuci motor', 'cuci mobil',
    'stnk', 'bikin sim', 'perpanjang sim', 'pajak motor', 'pajak mobil', 'pajak kendaraan', 'sewa motor', 'sewa mobil', 'rental'
  ]],
  ['Tagihan', [
    'listrik', 'token', 'token listrik', 'pln', 'pdam', 'air pdam', 'tagihan air', 'bayar air',
    'wifi', 'internet', 'indihome', 'biznet', 'firstmedia', 'first media', 'myrepublic', 'iconnet', 'speedy',
    'pulsa', 'paket data', 'paket internet', 'kuota', 'telkomsel', 'indosat', 'xl', 'axis', 'smartfren', 'by.u', 'simpati', 'telepon', 'telpon',
    'gas', 'elpiji', 'lpg',
    'cicilan', 'cicil', 'angsuran', 'kredit', 'pinjaman', 'paylater', 'spaylater', 'shopee paylater', 'kredivo', 'akulaku',
    'bayar utang', 'bayar hutang', 'pelunasan', 'lunasi',
    'kos', 'kost', 'kosan', 'kontrakan', 'sewa', 'sewa kos',
    'tagihan', 'asuransi', 'premi', 'bpjs', 'pajak', 'iuran', 'iuran warga', 'ipl', 'ronda', 'kebersihan', 'sampah',
    'denda', 'biaya admin', 'bunga', 'laundry', 'londri'
  ]],
  ['Hiburan', [
    'nonton', 'bioskop', 'cgv', 'xxi', 'cinepolis', 'film',
    'game', 'gaming', 'steam', 'diamond', 'mobile legends', 'mlbb', 'genshin', 'valorant', 'pubg', 'free fire', 'roblox', 'robux',
    'playstation', 'ps5', 'ps plus', 'nintendo', 'voucher game', 'topup game', 'top up game', 'gacha', 'battle pass',
    'netflix', 'disney', 'hbo', 'vidio', 'viu', 'iqiyi', 'wetv', 'prime video', 'spotify', 'joox', 'apple music', 'youtube', 'youtube premium', 'yt premium',
    'konser', 'tiket konser', 'karaoke', 'festival', 'event', 'tiket',
    'wisata', 'liburan', 'jalan-jalan', 'healing', 'staycation', 'hotel', 'penginapan', 'villa', 'homestay', 'dufan', 'wahana', 'pantai', 'camping', 'hiking', 'pendakian',
    'hobi', 'hiburan', 'nongkrong', 'main', 'billiard', 'biliar', 'bowling', 'futsal', 'badminton', 'renang', 'mancing'
  ]],
  ['Kesehatan', [
    'obat', 'dokter', 'dokter gigi', 'apotek', 'rumah sakit', 'rs', 'rsud', 'puskesmas', 'klinik', 'bidan',
    'vitamin', 'suplemen', 'periksa', 'cek kesehatan', 'check up', 'checkup', 'mcu', 'lab', 'laboratorium', 'cek darah',
    'vaksin', 'imunisasi', 'suntik', 'kesehatan', 'medical', 'dentist', 'scaling', 'behel', 'kawat gigi', 'tambal gigi', 'cabut gigi',
    'rawat', 'rawat inap', 'rawat jalan', 'berobat', 'psikolog', 'psikiater', 'konseling', 'terapi', 'pijat', 'urut', 'refleksi',
    'tolak angin', 'paracetamol', 'panadol', 'paramex', 'bodrex', 'antibiotik', 'salep', 'betadine', 'balsem', 'minyak kayu putih',
    'masker', 'plester', 'hansaplast', 'kacamata', 'softlens', 'lensa kontak',
    'gym', 'fitness', 'fitnes', 'olahraga'
  ]],
  ['Pendidikan', [
    'buku', 'kursus', 'kuliah', 'uang kuliah', 'spp', 'ukt', 'sekolah', 'les', 'les privat', 'bimbel', 'bimbingan', 'kelas',
    'fotocopy', 'fotokopi', 'foto kopi', 'print', 'cetak', 'jilid', 'laminating', 'atk', 'alat tulis', 'pensil', 'pulpen', 'bolpen', 'spidol', 'kertas', 'tinta', 'tinta printer', 'flashdisk',
    'seminar', 'workshop', 'webinar', 'ujian', 'pendidikan', 'bootcamp', 'udemy', 'coursera', 'ruangguru', 'skillacademy',
    'sertifikasi', 'sertifikat', 'toefl', 'ielts', 'toeic', 'wisuda', 'pendaftaran', 'skripsi', 'tesis', 'jurnal', 'praktikum', 'modul', 'diktat',
    'study tour', 'uang gedung', 'ospek'
  ]],
  ['Belanja', [
    'belanja', 'belanjaan', 'shopping',
    'baju', 'kaos', 'kemeja', 'dress', 'gamis', 'rok', 'celana', 'jeans', 'jaket', 'hoodie', 'sweater', 'kaos kaki', 'kaus kaki', 'dalaman',
    'sepatu', 'sneakers', 'sandal', 'tas', 'topi', 'jam tangan', 'dompet', 'aksesoris', 'gelang', 'kalung', 'cincin', 'jilbab', 'hijab', 'kerudung',
    'parfum', 'skincare', 'sunscreen', 'serum', 'pelembab', 'moisturizer', 'lipstik', 'lipstick', 'bedak', 'makeup', 'make up', 'kosmetik',
    'sabun', 'shampo', 'sampo', 'sikat gigi', 'pasta gigi', 'odol', 'tisu', 'tissue', 'pembalut', 'deterjen', 'detergen', 'pewangi', 'pelembut', 'sapu', 'pel',
    'shopee', 'tokopedia', 'lazada', 'blibli', 'bukalapak', 'tiktokshop', 'tiktok shop', 'zalora', 'shein', 'temu', 'olshop', 'ongkir', 'ongkos kirim', 'kurir', 'paket',
    'indomaret', 'alfamart', 'alfamidi', 'superindo', 'hypermart', 'transmart', 'giant', 'carrefour', 'minimarket', 'supermarket', 'galon', 'sembako',
    'elektronik', 'hp', 'handphone', 'charger', 'kabel', 'earphone', 'headset', 'headphone', 'powerbank', 'casing', 'tempered glass', 'laptop', 'mouse', 'keyboard',
    'kipas', 'lampu', 'baterai', 'kado',
    'perabot', 'kasur', 'bantal', 'sprei', 'gorden', 'karpet', 'rak', 'lemari', 'meja', 'kursi', 'ember', 'piring', 'gelas', 'panci', 'wajan', 'kompor', 'rice cooker', 'setrika'
  ]]
];

const INCOME_CATEGORIES = [
  ['Gaji', ['gaji', 'gajih', 'gajian', 'digaji', 'salary', 'payroll', 'upah']],
  ['Freelance', ['freelance', 'freelancer', 'proyek', 'project', 'honor', 'honorarium', 'fee', 'jasa', 'komisi', 'jualan', 'dagang', 'jual', 'terjual', 'laku', 'omzet', 'untung', 'laba', 'profit', 'orderan', 'ngajar', 'mengajar', 'endorse', 'sponsor', 'royalti']],
  ['Bonus', ['bonus', 'thr', 'cashback', 'insentif', 'tunjangan', 'lembur', 'uang lembur', 'reward', 'dividen', 'bunga', 'cuan']],
  ['Hadiah', [
    'hadiah', 'dikasih', 'dikasi', 'dikasihin', 'dikasihkan', 'ngasih', 'ngasi', 'ngasihin', 'kasih', 'angpao', 'ang pao', 'angpau', 'kado',
    'kiriman', 'dikirimi', 'dikirimin', 'dikirimkan', 'dikirim', 'ngirim', 'ngirimin', 'kirim', 'ditransfer', 'ditransferin', 'transferan', 'transfer', 'tf',
    'uang saku', 'uang jajan', 'uang bulanan', 'jatah', 'jatah bulanan', 'sangu', 'diberi', 'diberikan',
    'menang', 'juara', 'undian', 'giveaway', 'saweran', 'warisan', 'hibah', 'santunan'
  ]]
];

const INCOME_WORDS = [
  'gaji', 'gajih', 'gajian', 'digaji', 'salary', 'payroll', 'upah',
  'pemasukan', 'masuk', 'terima', 'diterima', 'menerima', 'dapat', 'dapet', 'dapetin',
  'bonus', 'thr', 'freelance', 'honor', 'honorarium', 'cashback', 'refund', 'reimburse', 'pengembalian', 'dikembalikan', 'dibalikin',
  'komisi', 'insentif', 'tunjangan', 'lembur', 'reward', 'dividen', 'bunga', 'cuan', 'untung', 'laba', 'profit', 'omzet', 'jualan', 'terjual', 'laku',
  'dikasih', 'dikasi', 'dikasihin', 'dikasihkan', 'dikirimi', 'dikirimin', 'dikirimkan', 'dikirim', 'dibayar', 'ditransfer', 'ditransferin', 'transferan',
  'diberi', 'diberikan', 'angpao', 'ang pao', 'angpau', 'hadiah', 'kiriman', 'uang saku', 'uang jajan', 'uang bulanan', 'jatah', 'sangu',
  'pinjam', 'pinjem', 'minjem', 'ngutang', 'dapat pinjaman',
  'menang', 'juara', 'undian', 'giveaway', 'saweran', 'warisan', 'hibah', 'santunan'
];

const EXPENSE_WORDS = [
  'beli', 'membeli', 'beliin', 'belikan', 'bli', 'bayar', 'byr', 'membayar', 'pembayaran', 'bayarin', 'bayarkan', 'lunasin', 'melunasi', 'cicil', 'nyicil', 'angsur',
  'jajan', 'belanja', 'belanjaan', 'shopping', 'checkout', 'order', 'pesan', 'pesen', 'booking', 'langganan', 'berlangganan', 'perpanjang',
  'keluar', 'pengeluaran', 'isi', 'ngisi', 'isiin', 'isi ulang', 'bensin', 'topup', 'top up', 'transfer ke', 'tf ke', 'kirim ke',
  'biaya', 'ongkir', 'denda', 'pajak', 'tiket', 'karcis', 'retribusi',
  'traktir', 'nraktir', 'mentraktir', 'donasi', 'sedekah', 'infaq', 'infak', 'zakat', 'sumbang', 'nyumbang', 'sumbangan', 'patungan', 'urunan', 'iuran',
  'ngasih', 'ngasi', 'kasih', 'kasi', 'memberi', 'memberikan', 'ngirim', 'kirim', 'mengirim',
  'pinjamin', 'pinjamkan', 'minjamin', 'ngutangin', 'ganti uang',
  'ditarik', 'ditagih', 'dimintai', 'diminta', 'dipalak', 'kecopetan', 'kehilangan', 'ketipu', 'kena', 'rugi', 'boncos'
];

const STRONG_INCOME_WORDS = [
  'dikasih', 'dikasi', 'dikasihin', 'dikasihkan', 'dikirimi', 'dikirimin', 'dikirimkan', 'ditransfer', 'ditransferin',
  'diberi', 'diberikan', 'dibalikin', 'dikembalikan', 'digaji', 'gajian',
  'pinjam uang', 'pinjem uang', 'minjem uang'
];

const STRONG_EXPENSE_WORDS = [
  'bayar utang', 'bayar hutang', 'bayar pinjaman', 'pinjamkan', 'pinjamin', 'minjamin', 'ngutangin', 'ganti uang',
  'ditarik', 'ditagih', 'dimintai', 'diminta', 'dipalak', 'ngasih', 'ngasi', 'ngirim', 'nyumbang', 'nraktir', 'mentraktir',
  'membayar', 'membeli', 'beliin', 'belikan', 'bayarin', 'bayarkan', 'kecopetan', 'kehilangan', 'ketipu', 'transfer ke', 'tf ke', 'kirim ke'
];

const TRANSFER_WORDS = [
  'tf', 'transfer', 'pindah', 'pindahin', 'pindahkan', 'mindahin', 'mindahkan',
  'kirim', 'alihkan', 'alih', 'tarik dari', 'geser', 'geserin'
];

const GIVER_SUBJECT_RE = /(?<![a-z0-9])(?:ibu|ibuk|bunda|mama|mamah|mami|ayah|bapak|bpk|papa|papah|ortu|orang\s+tua|kakak|mbak|mas|abang|adek|adik|teman|temen|bos|dosen|om|tante|paman|bibi|nenek|kakek|pacar|doi|sepupu)\s+(?:ngasih|ngasi|ngasihin|kasih|kasi|ngirim|ngirimin|kirim|transfer|ngetransfer|nransfer|tf)(?![a-z0-9])/;

const NUM_ONES = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
const SLANG_AMOUNTS = { seceng: 1000, noceng: 2000, goceng: 5000, ceban: 10000, goban: 50000, gocap: 50000 };
const NUM_WORD_TOKENS = 'satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|setengah|belas|puluh|ratus|ribu|juta';

function splitSegments_(text) {
  const SEP = '\u0001';
  const parts = String(text)
    .replace(/^\s*\d{1,2}[.)]\s+/gm, '')
    .replace(/[\r\n;]+/g, SEP)
    .replace(/(?:(?<!\d),|,(?!\d))/g, SEP)
    .replace(/\.\s+(?=[a-z])/gi, SEP)
    .replace(/\s+[&+]\s+/g, SEP)
    .replace(/(?<![a-z0-9])(?:terus|trus|trs|(?<!(?:hari|hr|yang|seminggu)\s)lalu|kemudian|abis itu|habis itu|setelah itu|sesudah itu|sekalian|serta|dan|plus)(?![a-z0-9])/gi, SEP)
    .split(SEP)
    .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
    .filter(function (s) { return s; });

  const out = [];
  let prefix = '';
  parts.forEach(function (seg) {
    if (/\d/.test(seg)) {
      out.push((prefix + ' ' + seg).trim());
      prefix = '';
      return;
    }
    const prev = out.length ? out[out.length - 1] : null;
    if (prev && detectSource_(seg.toLowerCase()).key && !detectSource_(prev.toLowerCase()).key) {
      out[out.length - 1] = prev + ' ' + seg;
    } else {
      prefix = (prefix + ' ' + seg).trim();
    }
  });
  if (prefix) {
    if (out.length) out[out.length - 1] += ' ' + prefix;
    else out.push(prefix);
  }
  return out;
}

function normalizeAmountWords_(low) {
  let s = String(low)
    .replace(/(?<![a-z0-9])(?:(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+)?(seceng|noceng|goceng|ceban|goban|gocap)(?![a-z0-9])/g,
      function (m, mul, w) { return ' ' + (SLANG_AMOUNTS[w] * (mul ? NUM_ONES[mul] : 1)) + ' '; })
    .replace(/(?<![a-z0-9])seribu(?![a-z0-9])/g, ' 1000 ')
    .replace(/(?<![a-z0-9])sejuta(?![a-z0-9])/g, ' 1000000 ');
  const re = new RegExp('(?<![a-z0-9])((?:(?:' + NUM_WORD_TOKENS + ')\\s+)+(?:ribu|juta))(?![a-z0-9])', 'g');
  s = s.replace(re, function (m, phrase) {
    const v = wordsToNumber_(phrase);
    return v === null ? m : ' ' + v + ' ';
  });
  return s;
}

function wordsToNumber_(phrase) {
  const toks = String(phrase).trim().split(/\s+/);
  let total = 0, chunk = 0, pending = 0, half = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (Object.prototype.hasOwnProperty.call(NUM_ONES, t)) pending = NUM_ONES[t];
    else if (t === 'sepuluh') chunk += 10;
    else if (t === 'sebelas') chunk += 11;
    else if (t === 'seratus') chunk += 100;
    else if (t === 'belas') { chunk += 10 + pending; pending = 0; }
    else if (t === 'puluh') { chunk += (pending || 1) * 10; pending = 0; }
    else if (t === 'ratus') { chunk += (pending || 1) * 100; pending = 0; }
    else if (t === 'setengah') half = true;
    else if (t === 'ribu' || t === 'juta') {
      let n = chunk + pending + (half ? 0.5 : 0);
      if (n === 0) n = 1;
      total += n * (t === 'ribu' ? 1000 : 1000000);
      chunk = 0; pending = 0; half = false;
    } else return null;
  }
  return total > 0 ? Math.round(total) : null;
}

function extractDate_(work) {
  let daysAgo = null;
  const m = /(?<![a-z0-9])(\d{1,3})\s*(?:hari|hr)\s+(?:yang\s+)?lalu(?![a-z0-9])/.exec(work);
  if (m) {
    daysAgo = Math.min(Number(m[1]), 365);
    work = work.substring(0, m.index) + ' ' + work.substring(m.index + m[0].length);
  }

  const rules = [
    [/(?<![a-z0-9])seminggu\s+(?:yang\s+)?lalu(?![a-z0-9])/, 7],
    [/(?<![a-z0-9])(?:kemarin|kemaren|kmrn)\s+(?:lusa|dulu)(?![a-z0-9])|(?<![a-z0-9])lusa\s+kemarin(?![a-z0-9])/, 2],
    [/(?<![a-z0-9])(?:kemarin|kemaren|kmrn)(?:\s+(?:pagi|siang|sore|malam))?(?![a-z0-9])|(?<![a-z0-9])(?:semalam|tadi\s+malam|malam\s+tadi)(?![a-z0-9])/, 1]
  ];
  rules.forEach(function (r) {
    if (work.search(r[0]) !== -1) {
      if (daysAgo === null) daysAgo = r[1];
      work = work.replace(r[0], ' ');
    }
  });

  const today = /(?<![a-z0-9])(?:hari\s+ini|barusan|baru\s+saja|baru\s+aja|tadi\s+(?:pagi|siang|sore)|(?:pagi|siang|sore)\s+tadi|sekarang|tadi)(?![a-z0-9])/g;
  if (work.search(today) !== -1) {
    if (daysAgo === null) daysAgo = 0;
    work = work.replace(today, ' ');
  }

  return { daysAgo: daysAgo, work: work };
}

function extractAmount_(low) {
  const re = /(?<![a-z0-9])(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(juta|jt|jeti|ribu|rebu|rb|k)?(?![a-z0-9])/g;
  const cands = [];
  let m;
  while ((m = re.exec(low)) !== null) {
    cands.push({
      value: toAmount_(m[1], m[2]),
      hasUnit: !!m[2],
      start: m.index,
      end: m.index + m[0].length
    });
    if (m[0].length === 0) re.lastIndex++;
  }
  if (!cands.length) {
    return { ok: false, message: 'Aku tidak menemukan nominal di pesanmu 🤔\nCoba tulis seperti: *jajan kopi 18k*, *gajian 5jt*, atau *jajan lima ribu*.' };
  }
  let pick = cands.filter(function (c) { return c.hasUnit; })[0];
  if (!pick) {
    const big = cands.filter(function (c) { return c.value >= 1000; });
    if (big.length) pick = big.reduce(function (a, b) { return b.value > a.value ? b : a; });
  }
  if (!pick) {
    const n = cands[0].value;
    return { ok: false, message: 'Nominal "' + n + '" terlalu kecil. Maksudnya ' + rupiah_(n * 1000) + '? Tulis *' + n + 'k* atau ' + n + '.000 ya.' };
  }
  if (!(pick.value > 0) || pick.value > 1e12) {
    return { ok: false, message: 'Nominalnya tampak tidak wajar. Coba tulis ulang, contoh: *18k* atau *18.000*.' };
  }
  return { ok: true, value: pick.value, start: pick.start, end: pick.end };
}

function toAmount_(numStr, unit) {
  const grouped = /^\d{1,3}([.,]\d{3})+$/.test(numStr);
  const n = grouped ? Number(numStr.replace(/[.,]/g, '')) : parseFloat(numStr.replace(',', '.'));
  const mult = { k: 1e3, rb: 1e3, rebu: 1e3, ribu: 1e3, jt: 1e6, jeti: 1e6, juta: 1e6 }[unit] || 1;
  return Math.round(n * mult);
}

function detectSource_(low) {
  const found = [];
  for (let i = 0; i < WALLET_ALIASES.length; i++) {
    const re = new RegExp('(?<![a-z0-9])((?:pakai|pake|pakek|memakai|menggunakan|via|lewat|dari|dengan|dgn|di)\\s+)?(?:' + WALLET_ALIASES[i][1] + ')(?![a-z0-9])', 'i');
    const m = re.exec(low);
    if (m) found.push({ key: WALLET_ALIASES[i][0], start: m.index, end: m.index + m[0].length, hasConnector: !!m[1] });
  }
  if (!found.length) return { key: null };
  found.sort(function (a, b) {
    if (a.hasConnector !== b.hasConnector) return a.hasConnector ? -1 : 1;
    return a.start - b.start;
  });
  return found[0];
}

function containsWord_(low, word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![a-z0-9])' + esc + '(?![a-z0-9])').test(low);
}

function detectType_(low) {
  const t = String(low).replace(/(?<![a-z0-9])uang\s+jajan(?![a-z0-9])/g, ' uang saku ');
  if (GIVER_SUBJECT_RE.test(t)) return 'income';

  const strongIn = STRONG_INCOME_WORDS.some(function (w) { return containsWord_(t, w); });
  const strongEx = STRONG_EXPENSE_WORDS.some(function (w) { return containsWord_(t, w); });
  if (strongIn && !strongEx) return 'income';
  if (strongEx && !strongIn) return 'expense';

  const hasExpense = EXPENSE_WORDS.some(function (w) { return containsWord_(t, w); });
  const hasIncome = INCOME_WORDS.some(function (w) { return containsWord_(t, w); });
  if (hasIncome && !hasExpense) return 'income';
  return 'expense';
}

function detectCategory_(low, type) {
  const table = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  for (let i = 0; i < table.length; i++) {
    if (table[i][1].some(function (w) { return containsWord_(low, w); })) return table[i][0];
  }
  return 'Lainnya';
}

function parseTransaction_(raw, inheritDaysAgo) {
  let text = String(raw || '').trim();
  let signType = null;
  if (/^\+/.test(text)) { signType = 'income'; text = text.replace(/^\+\s*/, ''); }
  else if (/^-/.test(text)) { signType = 'expense'; text = text.replace(/^-\s*/, ''); }

  let work = text.toLowerCase();
  const d = extractDate_(work);
  work = d.work;
  let daysAgo = d.daysAgo;
  if (daysAgo === null) daysAgo = inheritDaysAgo || 0;

  const amt = extractAmount_(work);
  if (!amt.ok) return { ok: false, message: amt.message };
  work = work.substring(0, amt.start) + ' ' + work.substring(amt.end);

  const src = detectSource_(work);
  if (src.key) work = work.substring(0, src.start) + ' ' + work.substring(src.end);

  const type = signType || detectType_(work);
  const category = detectCategory_(work, type);

  let title = work
    .replace(/(?<![a-z])(aku|saya|gue|gw|gua|td|pakai|pake|pakek|memakai|menggunakan|via|lewat|sebesar|seharga|sebanyak|sejumlah|rp|rupiah|udah|sudah|nih|deh|dong|sih|tuh|ya|yaa|yah|aja|doang|cuma|cuman)(?![a-z])/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-\/&+.,()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,\-+]+|[\s.,\-+]+$/g, '');
  if (!title) title = category;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 60) title = title.slice(0, 60).trim();

  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { ok: true, type: type, amount: amt.value, source: src.key, category: category, title: title, date: date, daysAgo: daysAgo };
}

function parseMessage_(raw) {
  const norm = normalizeAmountWords_(String(raw || '').toLowerCase());
  const segs = splitSegments_(norm);
  if (segs.length <= 1) {
    const p = parseTransaction_(segs.length ? segs[0] : norm);
    return p.ok ? { ok: true, items: [p] } : p;
  }

  const items = [];
  let inheritDays = 0;
  for (let i = 0; i < segs.length; i++) {
    const p = parseTransaction_(segs[i], inheritDays);
    if (!p.ok) {
      return {
        ok: false,
        message: 'Bagian ke-' + (i + 1) + ' ("' + segs[i] + '") bermasalah:\n' + p.message
      };
    }
    inheritDays = p.daysAgo;
    items.push(p);
  }
  return { ok: true, items: items };
}

function parseTransfer_(raw) {
  let text = String(raw || '').trim();
  let low = normalizeAmountWords_(text.toLowerCase());

  const tfWords = TRANSFER_WORDS.join('|');
  const tfRe = new RegExp('(?<![a-z0-9])(?:' + tfWords + ')(?![a-z0-9])', 'i');
  if (!tfRe.test(low)) return { ok: false };

  low = low.replace(tfRe, ' ').replace(/\s+/g, ' ').trim();
  const d = extractDate_(low);
  low = d.work;
  const daysAgo = d.daysAgo !== null ? d.daysAgo : 0;

  const amt = extractAmount_(low);
  if (!amt.ok) return { ok: false };
  low = low.substring(0, amt.start) + ' ' + low.substring(amt.end);
  low = low.replace(/\s+/g, ' ').trim();

  const allWallets = [];
  for (let i = 0; i < WALLET_ALIASES.length; i++) {
    const wRe = new RegExp('(?<![a-z0-9])(?:' + WALLET_ALIASES[i][1] + ')(?![a-z0-9])', 'i');
    const wm = wRe.exec(low);
    if (wm) {
      allWallets.push({ key: WALLET_ALIASES[i][0], start: wm.index, end: wm.index + wm[0].length });
    }
  }

  if (allWallets.length < 2) return { ok: false };
  allWallets.sort(function (a, b) { return a.start - b.start; });

  const uniqueWallets = [allWallets[0]];
  for (let j = 1; j < allWallets.length; j++) {
    if (allWallets[j].key !== uniqueWallets[uniqueWallets.length - 1].key) {
      uniqueWallets.push(allWallets[j]);
    }
  }
  if (uniqueWallets.length < 2) return { ok: false };

  const sourceFrom = uniqueWallets[0].key;
  const sourceTo = uniqueWallets[1].key;
  if (sourceFrom === sourceTo) return { ok: false };

  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return {
    ok: true,
    amount: amt.value,
    sourceFrom: sourceFrom,
    sourceTo: sourceTo,
    date: date,
    daysAgo: daysAgo
  };
}

function rupiah_(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + 'Rp ' + s;
}

module.exports = {
  WALLETS,
  parseMessage_,
  parseTransfer_,
  rupiah_
};

