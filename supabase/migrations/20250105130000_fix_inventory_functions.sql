/*
# [Function Correction]
# This script corrects and consolidates the inventory management database functions.
# It replaces any previous, potentially faulty versions of these functions.
# This ensures stability and fixes the "function does not exist" error from the previous migration attempt.

## Query Description: 
This operation uses `CREATE OR REPLACE` to safely update three key database functions: `get_item_stock`, `get_location_stock`, and `record_stock_movement`. It ensures they exist, have the correct definitions, and sets a secure `search_path` to resolve security warnings. This operation is safe and will not affect any existing data in your tables.

## Metadata:
- Schema-Category: ["Structural", "Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (by applying the previous function definitions)

## Structure Details:
- Functions being replaced:
  - public.get_item_stock(integer)
  - public.get_location_stock(integer, integer)
  - public.record_stock_movement(integer, integer, numeric, text, text, text, uuid)

## Security Implications:
- RLS Status: Unchanged
- Policy Changes: No
- Auth Requirements: None for the migration itself.
- Fixes Security Advisory: Addresses the "Function Search Path Mutable" warning.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. Function definitions are updated, which has no impact on query performance for existing data.
*/

-- Function to get total stock for an item across all locations
CREATE OR REPLACE FUNCTION public.get_item_stock(item_id_param integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN COALESCE((
    SELECT sum(quantity_change)
    FROM public.stock_movements
    WHERE item_id = item_id_param
  ), 0);
END;
$$ SET search_path = 'public';

-- Function to get stock for an item at a specific location
CREATE OR REPLACE FUNCTION public.get_location_stock(item_id_param integer, location_id_param integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN COALESCE((
    SELECT sum(quantity_change)
    FROM public.stock_movements
    WHERE item_id = item_id_param AND location_id = location_id_param
  ), 0);
END;
$$ SET search_path = 'public';

-- Procedure to record a new stock movement
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_item_id integer,
  p_location_id integer,
  p_quantity_change numeric,
  p_movement_type text,
  p_note text,
  p_reference_id text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.stock_movements (item_id, location_id, quantity_change, movement_type, note, reference_id, created_by)
  VALUES (p_item_id, p_location_id, p_quantity_change, p_movement_type, p_note, p_reference_id, p_user_id);
END;
$$ SET search_path = 'public';
