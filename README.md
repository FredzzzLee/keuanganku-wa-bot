# Bot Keuanganku WA - README

Bot WhatsApp Self-Bot untuk pencatatan keuangan + obrolan keluarga.

## Fitur Utama

### 1. Bot Keuangan (Grup: "Duit Gua Tuh")
- Catat pengeluaran/pemasukan dengan bahasa alami
- Cek saldo, rekap bulanan, transfer antar dompet
- Batalkan transaksi terakhir

### 2. Obrolan Keluarga (Grup: "Turu Lee")
- Chat grup 3 orang: **Mas Fando**, **Enat**, **Eisss**
- Semua pesan di grup otomatis muncul di laptop Enat
- Tidak perlu awalan/prefix apapun untuk mengobrol
- **Voice Note** dua arah (WA ↔ Laptop)

### 3. Web Chat Enat (http://localhost:3000/pesan)
- Tampilan chat grup cantik ala WhatsApp
- Warna bubble berbeda untuk setiap anggota
- Tombol Voice Note 🎤 untuk merekam langsung dari laptop
- Notifikasi desktop + suara

### 4. Notifikasi HP via Telegram
- Pesan masuk langsung mengirim notif ke Telegram Mas Fando
- Balas langsung dari Telegram tanpa perlu buka WhatsApp

## Perintah Bot

| Perintah | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `.setchat` | Hubungkan grup sebagai Turu Lee Chat | Ketik di grup |
| `.setfoto` | Pasang foto profil grup Turu Lee di WA | Ketik di grup |
| `.setgroup` | Hubungkan grup sebagai Keuanganku | Ketik di grup |
| `.enat <pesan>` | Kirim pesan ke laptop Enat | `.enat Mas lagi di jalan` |
| `.token <token>` | Pasang token bot Telegram | `.token 123456:ABC...` |
| `saldo` | Cek saldo semua dompet | `saldo` |
| `rekap` | Rekap pengeluaran bulan ini | `rekap` |
| `undo` / `batal` | Batalkan transaksi terakhir | `undo` |
| `default <dompet>` | Ganti dompet default | `default bca` |

## Setup

```bash
cd bot-wa
npm install
node index.js
```

Scan QR code via terminal atau buka `http://localhost:3000/qr`.
