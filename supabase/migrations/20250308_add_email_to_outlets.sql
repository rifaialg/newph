/*
  # Add Email Column to Outlets Table
  
  ## Query Description:
  This migration adds the 'email' column to the 'outlets' table. This column is required for the new Outlet Management features, serving as both contact information and the default login username.
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - Table: outlets
  - Column Added: email (text)
*/

ALTER TABLE outlets ADD COLUMN IF NOT EXISTS email text;
