-- Menambahkan kolom yang hilang pada tabel outlets untuk fitur Hak Akses
ALTER TABLE outlets 
ADD COLUMN IF NOT EXISTS login_username TEXT,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Memastikan RLS policy mengizinkan update pada kolom baru (jika ada policy spesifik)
-- (Opsional, tergantung setup RLS Anda, tapi biasanya authenticated user bisa update jika policy 'ALL' atau 'UPDATE' sudah ada)
