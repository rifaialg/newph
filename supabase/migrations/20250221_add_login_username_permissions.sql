/*
  # Add login_username and permissions columns to outlets table

  ## Query Description:
  This migration ensures the 'login_username' and 'permissions' columns exist in the 'outlets' table.
  These columns are required for the Outlet Access Management feature.
  
  1. login_username: Stores the username for outlet login (synced with email).
  2. permissions: Stores the JSON object defining granular access rights.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Table: outlets
  - Columns: login_username (TEXT), permissions (JSONB)
*/

DO $$
BEGIN
    -- Add login_username if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'login_username') THEN
        ALTER TABLE outlets ADD COLUMN login_username TEXT;
    END IF;

    -- Add permissions if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'permissions') THEN
        ALTER TABLE outlets ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
