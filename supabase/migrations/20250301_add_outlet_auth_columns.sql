/*
  # Add Auth Columns to Outlets Table
  
  Adds support for outlet-specific login and granular permissions.

  ## Query Description:
  This operation adds 'login_username' and 'permissions' columns to the 'outlets' table.
  It is a safe structural change that does not affect existing data.

  ## Metadata:
  - Schema-Category: Structural
  - Impact-Level: Low
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - login_username: TEXT (Nullable, used for custom login ID)
  - permissions: JSONB (Stores RBAC settings, default empty object)
*/

DO $$ 
BEGIN 
  -- Add login_username column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'login_username') THEN
    ALTER TABLE outlets ADD COLUMN login_username TEXT;
  END IF;

  -- Add permissions column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'permissions') THEN
    ALTER TABLE outlets ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;
  END IF;

END $$;
