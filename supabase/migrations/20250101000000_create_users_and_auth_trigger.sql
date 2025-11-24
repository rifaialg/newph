/*
# [Operation Name]
Create Users Table and Auth Trigger

## Query Description: [This script sets up the public 'users' table to store profile information and creates an automatic trigger. When a new user signs up via Supabase Auth, the trigger will instantly create a corresponding profile in the 'users' table. This keeps your authentication and user data perfectly synchronized without extra client-side code. No existing data will be affected as these are new objects.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Tables Affected: public.users (New)
- Triggers Affected: on_auth_user_created (New on auth.users)
- Functions Affected: public.handle_new_user (New)

## Security Implications:
- RLS Status: Enabled on public.users
- Policy Changes: Yes (New policies for users table)
- Auth Requirements: Users can only view their own profile. Service roles can bypass.

## Performance Impact:
- Indexes: Primary key index on users.id. Foreign key index to auth.users.
- Triggers: A single, lightweight trigger on auth.users insert.
- Estimated Impact: Negligible performance impact on user sign-up.
*/

-- 1. Create public.users table
CREATE TABLE public.users (
    id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Users can view their own profile."
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile."
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'role'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create a trigger to call the function on new user sign-up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Add a function to update the 'updated_at' column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Add trigger to users table for updates
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
