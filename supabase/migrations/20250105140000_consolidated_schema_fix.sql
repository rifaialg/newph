/*
# [Consolidated Schema Fix and Initialization]
This script provides a complete, corrected, and safe version of the entire database schema up to Phase 5. It is designed to be run on a fresh or problematic database to bring it to a known good state. It fixes previous migration errors, including incorrect policy syntax and function definitions.

## Query Description: [This is a foundational script. If run on a database with existing data in these tables, the 'DROP' statements will erase that data. It is intended to fix a broken schema. **BACKUP YOUR DATA** if you have anything important.]

## Metadata:
- Schema-Category: ["Structural", "Dangerous"]
- Impact-Level: ["High"]
- Requires-Backup: [true]
- Reversible: [false]

## Structure Details:
- Drops and recreates all inventory and opname related tables, functions, and policies.
- Tables: users, item_categories, locations, suppliers, items, stock_movements, stock_opname_sessions, stock_opname_items.
- Functions: handle_new_user, get_item_stock, get_item_stock_at_location.
- Triggers: on_auth_user_created.
- RLS Policies: Correctly defined for all tables.

## Security Implications:
- RLS Status: Enabled on all tables.
- Policy Changes: [Yes] - Fixes incorrect syntax from previous migrations.
- Auth Requirements: [Authenticated Users] - Policies are set for authenticated users.

## Performance Impact:
- Indexes: [Added] - Primary keys and foreign keys have indexes by default.
- Triggers: [Added] - One trigger on the auth.users table.
- Estimated Impact: [Low] - Standard schema setup.
*/

-- Step 1: Drop existing objects to ensure a clean slate (in reverse order of dependency)
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.stock_opname_sessions;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.stock_movements;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.stock_movements;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.items;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.locations;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.item_categories;
DROP POLICY IF EXISTS "Allow individual read access" ON public.users;
DROP POLICY IF EXISTS "Allow individual update access" ON public.users;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_item_stock(p_item_id bigint);
DROP FUNCTION IF EXISTS public.get_item_stock_at_location(p_item_id bigint, p_location_id bigint);

DROP TABLE IF EXISTS public.stock_opname_items;
DROP TABLE IF EXISTS public.stock_opname_sessions;
DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.items;
DROP TABLE IF EXISTS public.suppliers;
DROP TABLE IF EXISTS public.locations;
DROP TABLE IF EXISTS public.item_categories;
DROP TABLE IF EXISTS public.users;

-- Step 2: Create `users` table
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    email text UNIQUE,
    role text DEFAULT 'staff',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);
COMMENT ON TABLE public.users IS 'Stores public user profile information.';

-- Step 3: Create `handle_new_user` function and trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'role'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 4: Create Inventory Tables
CREATE TABLE public.item_categories (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.locations (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('bar', 'kitchen', 'warehouse')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.suppliers (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    notes text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.items (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    sku text UNIQUE,
    category_id bigint REFERENCES public.item_categories(id),
    unit text NOT NULL,
    purchase_unit text,
    conversion_to_base numeric,
    cost_price numeric NOT NULL DEFAULT 0,
    min_stock numeric NOT NULL DEFAULT 0,
    default_location_id bigint REFERENCES public.locations(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);

CREATE TABLE public.stock_movements (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    item_id bigint NOT NULL REFERENCES public.items(id),
    location_id bigint NOT NULL REFERENCES public.locations(id),
    quantity_change numeric NOT NULL,
    movement_type text NOT NULL,
    reference_id text,
    note text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now()
);

-- Step 5: Create Stock Calculation Functions
CREATE OR REPLACE FUNCTION public.get_item_stock(p_item_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)
  FROM public.stock_movements
  WHERE item_id = p_item_id;
$$;

CREATE OR REPLACE FUNCTION public.get_item_stock_at_location(p_item_id bigint, p_location_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)
  FROM public.stock_movements
  WHERE item_id = p_item_id AND location_id = p_location_id;
$$;

-- Step 6: Create Stock Opname Tables
CREATE TABLE public.stock_opname_sessions (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_date date NOT NULL DEFAULT CURRENT_DATE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'approved')),
    notes text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    approved_at timestamptz,
    approved_by uuid REFERENCES public.users(id)
);

CREATE TABLE public.stock_opname_items (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_id bigint NOT NULL REFERENCES public.stock_opname_sessions(id) ON DELETE CASCADE,
    item_id bigint NOT NULL REFERENCES public.items(id),
    location_id bigint NOT NULL REFERENCES public.locations(id),
    system_stock_at_start numeric NOT NULL,
    physical_count numeric,
    notes text,
    UNIQUE(session_id, item_id, location_id)
);

-- Step 7: Enable RLS and Create Correct Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read access" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow individual update access" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow all access for authenticated users" ON public.item_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.stock_opname_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access for authenticated users" ON public.stock_opname_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
