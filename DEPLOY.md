# Panduan Deployment Supabase Edge Functions

> **PENTING:** Perintah-perintah di bawah ini harus dijalankan di **Terminal Komputer Lokal** Anda (Command Prompt, PowerShell, atau Terminal VS Code), BUKAN di editor web ini.

Karena lingkungan WebContainer tidak mendukung Supabase CLI, Anda perlu men-deploy fungsi backend secara manual dari komputer Anda.

## 1. Prasyarat
Pastikan Anda sudah menginstal Supabase CLI di komputer Anda.
Jika belum:
- **Mac/Linux:** `brew install supabase/tap/supabase`
- **Windows:** `scoop install supabase` atau download dari [halaman rilis](https://github.com/supabase/cli/releases).

## 2. Login ke Supabase
Buka terminal di folder project ini, lalu login:
```bash
npx supabase login
```

## 3. Link Project
Hubungkan folder ini dengan project Supabase Anda:
```bash
npx supabase link --project-ref mpjfagjfhwalxtaatywq
```
*(Anda akan diminta memasukkan password database Supabase Anda)*

## 4. Atur Environment Variables (Secrets)
Simpan API Key Duitku dan Xendit agar aman di server (jangan hardcode di file):

```bash
# Untuk Duitku
npx supabase secrets set DUITKU_MERCHANT_CODE=DS26232
npx supabase secrets set DUITKU_API_KEY=7b3e1120dbfd61b7d9ad27176c3be06c

# Untuk Xendit (Jika dipakai)
npx supabase secrets set XENDIT_SECRET_KEY=xnd_production_ceRBqR7gRHwKnprPmt5H6q4mMz02juXg9eUw7BvktXJqp4zJdsPA2HFouFyzox
```

## 5. Deploy Functions
Upload kode fungsi ke server Supabase:

**Deploy Callback Duitku:**
```bash
npx supabase functions deploy duitku-callback --no-verify-jwt
```

**Deploy Create Invoice Duitku:**
```bash
npx supabase functions deploy create-duitku-invoice --no-verify-jwt
```

## 6. Konfigurasi di Dashboard Duitku
Setelah deploy berhasil, Anda akan mendapatkan URL. Masukkan URL tersebut di Dashboard Duitku:

- **Callback URL:** `https://mpjfagjfhwalxtaatywq.supabase.co/functions/v1/duitku-callback`
- **Return URL:** `https://artirasa.co.id/payment/finish` (atau URL aplikasi Anda)

---
*Catatan: `--no-verify-jwt` digunakan agar endpoint bisa diakses publik oleh server Duitku tanpa perlu login.*
