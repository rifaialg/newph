/*
# [SECURITY] Set explicit search_path for inventory functions
This migration updates the security definer functions created in the previous step to explicitly set the search_path. This is a security best practice to prevent potential hijacking attacks by malicious users who might have permissions to create objects in the public schema. By setting a fixed search_path, we ensure that the function always resolves objects (like tables and other functions) from the expected schemas in the correct order.

## Query Description: [This operation enhances the security of existing database functions by setting a fixed search_path. It prevents potential schema hijacking vulnerabilities and ensures predictable behavior. No data is affected, and the change is reversible by altering the function again.]

## Metadata:
- Schema-Category: ["Safe", "Security"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Functions affected:
  - `public.get_item_stock(int4)`
  - `public.get_item_stock_at_time(int4, timestamptz)`

## Security Implications:
- RLS Status: [Not Applicable]
- Policy Changes: [No]
- Auth Requirements: [None]
- This change MITIGATES a security warning by hardening the function against search_path attacks.

## Performance Impact:
- Indexes: [Not Applicable]
- Triggers: [Not Applicable]
- Estimated Impact: [None. This is a definition change with no runtime performance impact.]
*/

ALTER FUNCTION public.get_item_stock(item_id_param integer) SET search_path = public;
ALTER FUNCTION public.get_item_stock_at_time(item_id_param integer, time_param timestamp with time zone) SET search_path = public;
