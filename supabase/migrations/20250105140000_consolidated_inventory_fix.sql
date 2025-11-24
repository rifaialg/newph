/*
          # [Consolidated Inventory & Opname Schema Fix]
          This script corrects previous migration errors by recreating all necessary functions, ensuring tables exist, and setting up proper RLS policies for the inventory and opname modules. It is designed to be run on a database that may be in an inconsistent state from prior migrations.

          ## Query Description: [This is a corrective and structural migration. It will replace existing database functions with corrected, secure versions and ensure all required tables and policies are in place. It is designed to be safe to run, as it uses `CREATE OR REPLACE` and `IF NOT EXISTS` where appropriate, preserving existing data in your tables.]
          
          ## Metadata:
          - Schema-Category: ["Structural", "Safe"]
          - Impact-Level: ["Low"]
          - Requires-Backup: false
          - Reversible: false
          
          ## Structure Details:
          - Recreates functions: `get_item_stock`, `get_item_stock_at_location`, `get_total_stock_value`
          - Verifies existence of tables: `item_categories`, `locations`, `suppliers`, `items`, `stock_movements`, `stock_opname_sessions`, `stock_opname_items`
          - Re-applies RLS policies for all the above tables.
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [Yes]
          - Auth Requirements: [Authenticated User]
          - This script explicitly sets the `search_path` on all functions, resolving the "Function Search Path Mutable" security advisory.
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [Negligible. This is a schema and function definition update.]
          */

-- =================================================================
-- 1. Functions
-- Recreate all functions with proper security and search path.
-- =================================================================

CREATE OR REPLACE FUNCTION public.get_item_stock(p_item_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)
  FROM stock_movements
  WHERE item_id = p_item_id;
$$;

CREATE OR REPLACE FUNCTION public.get_item_stock_at_location(p_item_id bigint, p_location_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)
  FROM stock_movements
  WHERE item_id = p_item_id AND location_id = p_location_id;
$$;

CREATE OR REPLACE FUNCTION public.get_total_stock_value()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    total_value numeric := 0;
BEGIN
    SELECT COALESCE(SUM(current_stock * i.cost_price), 0)
    INTO total_value
    FROM items i
    JOIN (
        SELECT 
            item_id, 
            SUM(quantity_change) as current_stock
        FROM stock_movements
        GROUP BY item_id
    ) sm ON i.id = sm.item_id;
    
    RETURN total_value;
END;
$$;

-- =================================================================
-- 2. Tables
-- Ensure all tables exist.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.item_categories (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text
);

CREATE TABLE IF NOT EXISTS public.locations (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    type text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    notes text
);

CREATE TABLE IF NOT EXISTS public.items (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    sku text UNIQUE,
    category_id bigint NOT NULL REFERENCES public.item_categories(id),
    unit text NOT NULL,
    purchase_unit text,
    conversion_to_base numeric,
    cost_price numeric NOT NULL DEFAULT 0,
    min_stock numeric NOT NULL DEFAULT 0,
    default_location_id bigint REFERENCES public.locations(id),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    item_id bigint NOT NULL REFERENCES public.items(id),
    location_id bigint NOT NULL REFERENCES public.locations(id),
    quantity_change numeric NOT NULL,
    movement_type text NOT NULL,
    reference_id text,
    note text,
    created_by uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.stock_opname_sessions (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    session_date date NOT NULL DEFAULT CURRENT_DATE,
    status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, approved
    notes text,
    created_by uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.stock_opname_items (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_id bigint NOT NULL REFERENCES public.stock_opname_sessions(id) ON DELETE CASCADE,
    item_id bigint NOT NULL REFERENCES public.items(id),
    location_id bigint NOT NULL REFERENCES public.locations(id),
    system_stock_at_start numeric NOT NULL,
    physical_count numeric,
    counted_at timestamp with time zone,
    counted_by uuid REFERENCES public.users(id)
);

-- =================================================================
-- 3. RLS Policies
-- Drop and recreate policies to ensure consistency.
-- =================================================================

-- item_categories
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.item_categories;
CREATE POLICY "Allow authenticated read access" ON public.item_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manager/owner write access" ON public.item_categories;
CREATE POLICY "Allow manager/owner write access" ON public.item_categories FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.locations;
CREATE POLICY "Allow authenticated read access" ON public.locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manager/owner write access" ON public.locations;
CREATE POLICY "Allow manager/owner write access" ON public.locations FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.suppliers;
CREATE POLICY "Allow authenticated read access" ON public.suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manager/owner write access" ON public.suppliers;
CREATE POLICY "Allow manager/owner write access" ON public.suppliers FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.items;
CREATE POLICY "Allow authenticated read access" ON public.items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow manager/owner write access" ON public.items;
CREATE POLICY "Allow manager/owner write access" ON public.items FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.stock_movements;
CREATE POLICY "Allow authenticated read access" ON public.stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write access" ON public.stock_movements;
CREATE POLICY "Allow authenticated write access" ON public.stock_movements FOR INSERT, UPDATE, DELETE TO authenticated USING (true) WITH CHECK (true);

-- stock_opname_sessions
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.stock_opname_sessions;
CREATE POLICY "Allow authenticated read access" ON public.stock_opname_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write access" ON public.stock_opname_sessions;
CREATE POLICY "Allow authenticated write access" ON public.stock_opname_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- stock_opname_items
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.stock_opname_items;
CREATE POLICY "Allow authenticated read access" ON public.stock_opname_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated write access" ON public.stock_opname_items;
CREATE POLICY "Allow authenticated write access" ON public.stock_opname_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
