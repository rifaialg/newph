-- Drop all potentially problematic functions first to ensure a clean slate
DROP FUNCTION IF EXISTS public.get_dashboard_metrics();
DROP FUNCTION IF EXISTS public.get_stock_summary_report();
DROP FUNCTION IF EXISTS public.get_opname_history_report();
DROP FUNCTION IF EXISTS public.get_low_stock_items();
DROP FUNCTION IF EXISTS public.get_opname_summary_chart_data();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate handle_new_user with security patch
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    (NEW.raw_user_meta_data->>'role')::user_role
  );
  RETURN NEW;
END;
$$;

-- Recreate all reporting and dashboard functions with correct definitions

-- get_dashboard_metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS TABLE(total_items bigint, total_stock_value numeric, active_locations bigint, low_stock_items_count bigint)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.items WHERE is_active = true) AS total_items,
    (SELECT SUM(COALESCE(t.total_quantity, 0) * i.cost_price)
     FROM public.items i
     LEFT JOIN (
       SELECT item_id, SUM(quantity_change) AS total_quantity
       FROM public.stock_movements
       GROUP BY item_id
     ) t ON i.id = t.item_id
    ) AS total_stock_value,
    (SELECT COUNT(*) FROM public.locations WHERE is_active = true) AS active_locations,
    (SELECT COUNT(*) FROM public.get_low_stock_items()) AS low_stock_items_count;
END;
$$;

-- get_stock_summary_report
CREATE OR REPLACE FUNCTION public.get_stock_summary_report()
RETURNS TABLE(item_name text, location_name text, quantity numeric, stock_value numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.name AS item_name,
    l.name AS location_name,
    SUM(sm.quantity_change) AS quantity,
    SUM(sm.quantity_change) * i.cost_price AS stock_value
  FROM public.stock_movements sm
  JOIN public.items i ON sm.item_id = i.id
  JOIN public.locations l ON sm.location_id = l.id
  GROUP BY i.id, l.id, i.name, l.name, i.cost_price
  HAVING SUM(sm.quantity_change) != 0
  ORDER BY i.name, l.name;
END;
$$;

-- get_opname_history_report
CREATE OR REPLACE FUNCTION public.get_opname_history_report()
RETURNS TABLE(session_id bigint, created_at timestamptz, status text, total_variance numeric, total_variance_value numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.created_at,
    s.status,
    COALESCE(SUM(oi.physical_count - oi.system_stock_at_start), 0) AS total_variance,
    COALESCE(SUM((oi.physical_count - oi.system_stock_at_start) * i.cost_price), 0) AS total_variance_value
  FROM public.stock_opname_sessions s
  LEFT JOIN public.stock_opname_items oi ON s.id = oi.session_id
  LEFT JOIN public.items i ON oi.item_id = i.id
  GROUP BY s.id
  ORDER BY s.created_at DESC;
END;
$$;

-- get_low_stock_items
CREATE OR REPLACE FUNCTION public.get_low_stock_items()
RETURNS TABLE(item_id bigint, item_name text, item_sku text, current_quantity numeric, min_stock_level numeric, unit text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH current_stock AS (
    SELECT
      sm.item_id,
      SUM(sm.quantity_change) AS quantity
    FROM public.stock_movements sm
    GROUP BY sm.item_id
  )
  SELECT
    i.id AS item_id,
    i.name AS item_name,
    i.sku AS item_sku,
    cs.quantity AS current_quantity,
    i.min_stock AS min_stock_level,
    i.unit
  FROM public.items i
  JOIN current_stock cs ON i.id = cs.item_id
  WHERE i.is_active = true AND cs.quantity < i.min_stock;
END;
$$;

-- get_opname_summary_chart_data
CREATE OR REPLACE FUNCTION public.get_opname_summary_chart_data()
RETURNS TABLE(created_at timestamptz, total_variance_value numeric)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.created_at,
    COALESCE(SUM((oi.physical_count - oi.system_stock_at_start) * i.cost_price), 0) AS total_variance_value
  FROM public.stock_opname_sessions s
  LEFT JOIN public.stock_opname_items oi ON s.id = oi.session_id
  LEFT JOIN public.items i ON oi.item_id = i.id
  WHERE s.status = 'approved'
  GROUP BY s.id
  ORDER BY s.created_at DESC
  LIMIT 5;
END;
$$;
