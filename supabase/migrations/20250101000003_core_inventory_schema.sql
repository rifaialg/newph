/*
# [Schema] Core Inventory Tables
This script sets up the foundational tables for inventory management, including categories, locations, suppliers, items, and the stock movement ledger.

## Query Description: [This script creates new tables for core inventory features. It is safe to run on a new database but be cautious if you have existing tables with the same names. No data will be deleted.]

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true (by dropping the tables)

## Structure Details:
- Creates table: `item_categories`
- Creates table: `locations`
- Creates table: `suppliers`
- Creates table: `items`
- Creates table: `stock_movements`
- Creates type: `movement_type_enum`

## Security Implications:
- RLS Status: Enabled on all new tables.
- Policy Changes: Yes, new policies are created to allow access for authenticated users.
  - `select` access for all authenticated users.
  - `insert`, `update`, `delete` access for 'manager' and 'owner' roles.

## Performance Impact:
- Indexes: Primary keys and foreign keys are indexed automatically.
- Triggers: None.
- Estimated Impact: Low. These are foundational tables and queries will be efficient.
*/

-- 1. Create ENUM type for stock movement types
CREATE TYPE public.movement_type_enum AS ENUM (
    'initial_stock',
    'purchase',
    'transfer_in',
    'transfer_out',
    'wastage',
    'manual_adjustment',
    'opname_adjustment'
);

-- 2. Create item_categories table
CREATE TABLE public.item_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read categories" ON public.item_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manager/owner to manage categories" ON public.item_categories FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- 3. Create locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT, -- e.g., 'bar', 'kitchen', 'warehouse'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manager/owner to manage locations" ON public.locations FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));


-- 4. Create suppliers table
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manager/owner to manage suppliers" ON public.suppliers FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));


-- 5. Create items table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category_id UUID REFERENCES public.item_categories(id),
    unit TEXT NOT NULL, -- e.g., 'gr', 'ml', 'pcs'
    purchase_unit TEXT, -- e.g., 'kg', 'liter', 'box'
    conversion_to_base NUMERIC DEFAULT 1, -- e.g., 1 kg = 1000 gr, so conversion is 1000
    cost_price NUMERIC(10, 2) DEFAULT 0.00,
    min_stock NUMERIC DEFAULT 0,
    default_location_id UUID REFERENCES public.locations(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manager/owner to manage items" ON public.items FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));


-- 6. Create stock_movements table
CREATE TABLE public.stock_movements (
    id BIGSERIAL PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id),
    location_id UUID NOT NULL REFERENCES public.locations(id),
    quantity_change NUMERIC NOT NULL, -- can be positive (in) or negative (out)
    movement_type public.movement_type_enum NOT NULL,
    reference_id TEXT, -- e.g., opname_session_id, purchase_order_id
    note TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow manager/owner to manage stock movements" ON public.stock_movements FOR ALL TO authenticated USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner')) WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'owner'));

-- Function to calculate current stock for an item at a location
CREATE OR REPLACE FUNCTION get_current_stock(p_item_id UUID, p_location_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    current_stock NUMERIC;
BEGIN
    SELECT COALESCE(SUM(quantity_change), 0)
    INTO current_stock
    FROM public.stock_movements
    WHERE item_id = p_item_id AND location_id = p_location_id;

    RETURN current_stock;
END;
$$ LANGUAGE plpgsql;

-- Set search path for security
ALTER FUNCTION public.get_current_stock(UUID, UUID) SET search_path = public;
