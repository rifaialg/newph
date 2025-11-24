/*
  # Add Selling Price Column
  
  ## Query Description:
  This migration adds a 'selling_price' column to the 'items' table to support retail pricing.
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Table: public.items
  - Column: selling_price (NUMERIC, Default: 0)
*/

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0;

-- Optional: Update existing items to have selling_price = cost_price * 1.3 (30% margin) as a starting point
-- UPDATE public.items SET selling_price = cost_price * 1.3 WHERE selling_price = 0;
