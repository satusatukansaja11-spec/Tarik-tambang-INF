# Tarik Tambang — Informatika Challenge

Game edukasi Microsoft Word untuk kompetisi kelas. React/Vite, Express, Socket.IO, SQLite, serta karakter voxel SVG orisinal dan efek suara Web Audio. **Tidak membutuhkan layanan berbayar atau API key.**

## Jalankan

Prasyarat: **Node.js 24+** (menggunakan `node:sqlite` bawaan), npm, dan browser modern.

```sh
npm ci
npm run dev
```

Server aplikasi dan Vite berjalan bersama di port **3000**. Buka alamat server di browser. Guru memilih **Mulai permainan**, lalu membuat kata sandi guru (minimal 10 karakter) saat akses pertama. Siswa tidak memerlukan akun. Siapkan akun guru sebelum membagikan server kepada kelas.

```sh
npm run build
npm start
```

Perintah di atas melayani build produksi dari server yang sama; tidak ada server frontend terpisah. `GET /api/health` memeriksa layanan dan koneksi database.

Untuk mengganti port atau lokasi data:

```sh
PORT=8080 DATA_DIR=/path/persistent-data npm start
```

Variabel didokumentasikan di `.env.example`. Berkas `.env` **tidak dimuat otomatis**; ekspor variabel melalui shell/hosting, atau gunakan `node --env-file=.env server/index.js`. `TEACHER_PASSWORD` opsional hanya menetapkan kata sandi awal bila akun belum dibuat. Nilai ini tidak pernah dikirim ke siswa. Kata sandi disimpan sebagai hash scrypt dengan salt, sesi guru memakai cookie HttpOnly yang berlaku 12 jam. Sesi guru perlu login ulang setelah server restart.

## Bermain di kelas

1. Pilih **Mode Solo** (1 vs 1) atau **Mode Kelompok** (2–7 pemain per tim, jumlah kedua tim dapat berbeda).
2. Atur judul, identitas tim A–Z, nama, warna, ikon, pemain, 24 pilihan karakter, jumlah soal (10–30), durasi (10–120 detik), dan tingkat kesulitan.
3. **Simpan pengaturan** untuk membuat kode room. Room dapat dibuka kembali dari daftar room tersimpan di dashboard.
4. Siswa membuka alamat aplikasi di perangkat masing-masing, menekan **Gabung dengan kode room**, lalu mengisi nama dan slot yang diarahkan guru. Tautan undangan langsung membuka formulir bergabung.
5. Guru melihat daftar siswa lalu menekan **START GAME**. Guru juga dapat menjawab kedua sisi dari layar kelas untuk penggunaan satu layar.
6. Server menentukan giliran otomatis: ronde modulo jumlah anggota. Setiap anggota memperoleh kesempatan; pembagian untuk 3 pemain adalah 4/3/3 dari 10 soal.
7. Guru dapat pause, lanjutkan, akhiri, atau reset. Reset pertandingan aktif menyimpan hasil terlebih dahulu. Hasil selesai otomatis disimpan, dapat ditinjau di Riwayat dan diekspor JSON.

### Aturan skor dan tarikan

- Benar **+10**, salah atau timeout **−10**. Skor mentah = `(benar − salah) × 10`; papan skor menampilkan `max(0, skor mentah)`. Skor tidak dijepit setiap langkah, sehingga riwayat tetap sesuai rumus.
- Dua tim mendapat soal **berbeda**, dengan kesulitan sama pada setiap ronde. Pilihan jawaban diacak. Tidak ada soal berulang di kedua deck dalam satu pertandingan.
- Satu jawaban per tim per ronde. Di perangkat siswa hanya pemain yang sedang mendapat giliran dapat menjawab. Guru memiliki kontrol jawaban kelas.
- Ronde bersifat **simultan**. Tarikan baru dihitung setelah kedua tim menjawab atau durasi habis. Benar lawan salah menggeser dua langkah; hasil sama saling meniadakan.
- Posisi `+6` berarti Tim kiri menang; `−6` berarti Tim kanan menang. Formasi tim kalah secara visual melewati garis tengah. Kemenangan batas langsung mengakhiri pertandingan.
- Jika soal habis, pemenang ditentukan berdasarkan **poin**, bukan jumlah benar. Poin sama menghasilkan seri. Guru dapat menambahkan 5 soal unik baru bila bank mencukupi; hasil seri awal tetap tercatat.
- Bank awal berisi **130 soal dalam 11 bab**, termasuk studi kasus. Filter kesulitan dan jumlah soal memerlukan cukup pasangan unik. Jika kurang, server menjelaskan kebutuhan; tambah soal, kurangi jumlah, atau pilih campuran. Soal yang sedang dipakai tersalin ke room sehingga edit bank tidak mengubah pertandingan aktif.

### LAN dan internet

Untuk satu jaringan Wi-Fi/LAN, siswa membuka `http://IP-KOMPUTER-SERVER:3000`. Gunakan alamat IP yang benar dari komputer host dan izinkan port di firewall. `localhost` pada perangkat siswa menunjuk perangkat siswa sendiri.

Untuk akses internet gunakan hosting yang mendukung **Node.js, proses jangka panjang, WebSocket, disk persisten**, dan reverse proxy HTTPS. Set `COOKIE_SECURE=true` pada HTTPS. Aplikasi melayani frontend, API, dan Socket.IO dari origin yang sama. Gunakan satu proses server; SQLite dan room aktif belum mendukung beberapa replika server sekaligus. Jangan gunakan hosting static-only untuk backend ini.

Tidak ada publikasi website otomatis; push GitHub menyimpan kode, sedangkan menjalankan server publik memerlukan hosting.

## Suara, karakter, dan aksesibilitas

Efek countdown, start, benar, salah, tarikan, kemenangan, kekalahan, serta musik latar dihasilkan secara lokal oleh Web Audio. Efek dan musik memiliki sakelar terpisah. Browser memerlukan interaksi pengguna sebelum audio aktif. Preferensi efek disimpan lokal; musik dimulai ulang secara manual. Tidak ada berkas suara atau karakter Minecraft resmi.

Arena SVG/CSS menyediakan karakter berkulit dan berpakaian beragam, hijab, rambut, topi, kacamata, gerak masuk arena/bersiap/menarik, selebrasi, dan jatuh. Seluruh formasi bergerak berdasarkan hasil server. `prefers-reduced-motion` mematikan animasi. Kontrol memakai HTML semantik, label eksplisit, fokus keyboard, dialog dengan penahanan fokus, serta navigasi mobile.

## Data dan keamanan

- SQLite berada di `DATA_DIR/game.sqlite` (default `data/`), memakai WAL. Data, kredensial, sesi, dan hasil siswa **tidak masuk Git**.
- Setelah restart, room aktif dipulihkan dalam keadaan **pause**. Siswa dapat tersambung ulang memakai token slot yang disimpan di `sessionStorage` tabnya. Token tidak dibagikan dalam state room.
- Server memvalidasi konfigurasi, giliran, ronde, ID soal, pilihan, batas waktu, dan duplikasi. Kunci dan deck mendatang tidak dikirim dalam state sebelum jawaban. Kunci yang telah dijawab tersedia untuk umpan balik; seluruh riwayat baru terbuka saat selesai.
- Bank soal, riwayat lintas room, dan kontrol permainan memerlukan sesi guru. Nama pemain dibatasi panjangnya dan ditampilkan sebagai teks React.
- Sistem ini untuk satu kelas/sekolah, dengan satu akun guru. Kode room adalah akses undangan, bukan autentikasi identitas sekolah. Jangan membagikannya di ruang publik. Belum ada SSO, pemulihan kata sandi melalui email, atau pengelolaan banyak akun guru.
- Cadangkan direktori data saat server berhenti agar file database/WAL konsisten. Simpan kata sandi guru dengan aman. Jika perlu reset akses, operator dapat menghapus baris `teacher` dari tabel `settings` pada database cadangan/lokal saat server berhenti, lalu menetapkan akses baru; jangan menghapus database soal/hasil.

## Pengujian

```sh
npm test                 # unit + HTTP/Socket.IO integration, database sementara
npm run build           # build produksi
npm run test:browser    # Chromium: guru + dua perangkat siswa + CRUD + responsif
npm run check           # unit/integration + build
```

Browser test menggunakan Chromium yang tersedia pada `/usr/bin/chromium`. Untuk instalasi lain, tetapkan `CHROMIUM_PATH` ke executable Chromium/Chrome. Contoh:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

Tes browser membangun skenario pada port 3100 dengan database sementara yang baru di setiap run; jalankan build terlebih dahulu. Screenshot dan laporan disimpan di `test-results/` (diabaikan Git). CI Linux memasang Chromium Playwright dan menjalankan ketiga pemeriksaan.

Cakupan: keunikan dan keseimbangan soal, seluruh bab, validasi, skor negatif, pemenang batas/poin/seri, giliran tidak seimbang, jawaban ganda, sesi/izin guru, CRUD soal, room, sinkronisasi dua klien, timer, pause/resume, timeout, reconnect, soal tambahan, persistensi setelah restart, alur browser lengkap, serta overflow pada 1440/768/390 piksel. Tes audio memeriksa interaksi browser; kualitas suara tetap bergantung pada perangkat dan volume sistem.

## Struktur

```text
src/                 React, dashboard, arena SVG, audio, CSS responsif
server/index.js      HTTP, autentikasi guru, Socket.IO, timer
server/game.js       Aturan pertandingan dan sanitasi state
server/questions.js  Bank soal orisinal 11 bab
server/db.js         Penyimpanan SQLite
tests/              Unit, integration, dan browser tests
docs/               Arsitektur dan status tahapan
```

Lihat [arsitektur dan tahapan](docs/IMPLEMENTATION.md) untuk keputusan teknis, batasan, dan bukti verifikasi.
