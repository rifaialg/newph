/*
  # Add image_url to items table

  ## Query Description:
  Menambahkan kolom `image_url` ke tabel `items` untuk menyimpan link foto produk.
  Ini diperlukan untuk fitur upload gambar pada Incoming Stock dan Product Master.
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Table: public.items
  - Column: image_url (text, nullable)
*/

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS image_url text;

-- Optional: Add comment to column
COMMENT ON COLUMN public.items.image_url IS 'URL to the product image stored in Supabase Storage';
