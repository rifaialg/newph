-- Menambahkan kolom untuk manajemen akses outlet
ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS login_username TEXT, -- Username khusus outlet
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb, -- Menyimpan konfigurasi menu (RBAC)
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Keterangan:
-- permissions JSONB akan menyimpan struktur seperti:
-- {
--   "dashboard": true,
--   "inventory_items": true,
--   "incoming_stock": false,
--   ...
-- }
