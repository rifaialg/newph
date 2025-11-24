/*
# [SECURITY] Fix Handle New User Search Path
This migration explicitly sets the search_path for the handle_new_user function to resolve the final security warning.

## Query Description: [This operation modifies a security-critical function to enhance database security. It ensures the function operates within a controlled schema environment, reducing the risk of search path hijacking attacks. No data is affected.]

## Metadata:
- Schema-Category: ["Safe"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- Function: public.handle_new_user

## Security Implications:
- RLS Status: [N/A]
- Policy Changes: [No]
- Auth Requirements: [N/A]

## Performance Impact:
- Indexes: [N/A]
- Triggers: [N/A]
- Estimated Impact: [None]
*/

-- Set a secure search path for the handle_new_user function
ALTER FUNCTION public.handle_new_user() SET search_path = public;
