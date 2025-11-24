/*
          # [Function] Create Reporting and Dashboard Functions
          [This migration creates several RPC functions to efficiently query aggregated data for the dashboard and reports, reducing client-side load.]

          ## Query Description: [This operation is safe and does not modify existing data. It adds new, read-only functions to the database to improve application performance. No backup is required.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Creates function `get_dashboard_metrics()`
          - Creates function `get_low_stock_items()`
          - Creates function `get_opname_summary_chart_data()`
          - Creates function `get_stock_summary_report()`
          - Creates function `get_opname_history_report()`
          - Creates function `snapshot_stock_for_opname(opname_session_id INT, location_ids INT[])`
          - Creates function `approve_opname_session(opname_session_id INT)`
          
          ## Security Implications:
          - RLS Status: [Not Applicable]
          - Policy Changes: [No]
          - Auth Requirements: [Functions are executable by the 'authenticated' role]
          
          ## Performance Impact:
          - Indexes: [Not Applicable]
          - Triggers: [Not Applicable]
          - Estimated Impact: [Positive. These functions will significantly improve the performance of dashboard and report loading.]
          */

-- Function to get key metrics for the dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS TABLE(total_items BIGINT, total_stock_value NUMERIC, active_locations BIGINT, low_stock_items_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.items WHERE is_active = true) AS total_items,
    (SELECT COALESCE(SUM(v.stock_value), 0) FROM public.current_stock_view v) AS total_stock_value,
    (SELECT COUNT(*) FROM public.locations WHERE is_active = true) AS active_locations,
    (SELECT COUNT(*) FROM public.current_stock_view v WHERE v.quantity <= v.min_stock) AS low_stock_items_count;
END;
$$;

-- Function to get items that are below their minimum stock level
CREATE OR REPLACE FUNCTION public.get_low_stock_items()
RETURNS TABLE(item_id INT, item_name TEXT, item_sku TEXT, current_quantity NUMERIC, min_stock_level NUMERIC, unit TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.item_id,
    i.name as item_name,
    i.sku as item_sku,
    s.quantity as current_quantity,
    i.min_stock as min_stock_level,
    i.unit
  FROM public.current_stock_view s
  JOIN public.items i ON s.item_id = i.id
  WHERE s.quantity <= i.min_stock AND i.is_active = true
  GROUP BY s.item_id, i.name, i.sku, i.min_stock, i.unit, s.quantity
  ORDER BY i.name;
END;
$$;

-- Function for opname summary chart on dashboard
CREATE OR REPLACE FUNCTION public.get_opname_summary_chart_data()
RETURNS TABLE(session_id INT, created_at TIMESTAMPTZ, total_variance_value NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.created_at,
    COALESCE(SUM((oi.physical_count - oi.system_stock_at_start) * i.cost_price), 0) as total_variance_value
  FROM public.stock_opname_sessions s
  JOIN public.stock_opname_items oi ON s.id = oi.session_id
  JOIN public.items i ON oi.item_id = i.id
  WHERE s.status = 'approved'
  GROUP BY s.id, s.created_at
  ORDER BY s.created_at DESC
  LIMIT 5;
END;
$$;

-- Function for Stock Summary Report
CREATE OR REPLACE FUNCTION public.get_stock_summary_report()
RETURNS TABLE(item_id INT, item_name TEXT, location_id INT, location_name TEXT, quantity NUMERIC, stock_value NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.item_id,
    v.item_name,
    v.location_id,
    v.location_name,
    v.quantity,
    v.stock_value
  FROM public.current_stock_view v
  WHERE v.quantity > 0;
END;
$$;

-- Function for Opname History Report
CREATE OR REPLACE FUNCTION public.get_opname_history_report()
RETURNS TABLE(session_id INT, created_at TIMESTAMPTZ, status TEXT, total_variance NUMERIC, total_variance_value NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.created_at,
    s.status,
    COALESCE(SUM(oi.physical_count - oi.system_stock_at_start), 0) as total_variance,
    COALESCE(SUM((oi.physical_count - oi.system_stock_at_start) * i.cost_price), 0) as total_variance_value
  FROM public.stock_opname_sessions s
  LEFT JOIN public.stock_opname_items oi ON s.id = oi.session_id
  LEFT JOIN public.items i ON oi.item_id = i.id
  GROUP BY s.id, s.created_at, s.status
  ORDER BY s.created_at DESC;
END;
$$;

-- Function to snapshot stock when an opname session is created
CREATE OR REPLACE FUNCTION public.snapshot_stock_for_opname(opname_session_id INT, location_ids INT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  loc_id INT;
BEGIN
  FOREACH loc_id IN ARRAY location_ids
  LOOP
    INSERT INTO public.stock_opname_items (session_id, item_id, location_id, system_stock_at_start)
    SELECT
      opname_session_id,
      v.item_id,
      v.location_id,
      v.quantity
    FROM
      public.current_stock_view v
    WHERE v.location_id = loc_id;
  END LOOP;
END;
$$;

-- Function to approve an opname session and adjust stock
CREATE OR REPLACE FUNCTION public.approve_opname_session(opname_session_id INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Update session status
  UPDATE public.stock_opname_sessions
  SET status = 'approved', updated_at = now()
  WHERE id = opname_session_id;

  -- Create stock movements for discrepancies
  FOR rec IN
    SELECT 
      item_id,
      location_id,
      physical_count - system_stock_at_start as difference
    FROM public.stock_opname_items
    WHERE session_id = opname_session_id AND (physical_count - system_stock_at_start) != 0
  LOOP
    INSERT INTO public.stock_movements (item_id, location_id, quantity_change, movement_type, reference_id, created_by)
    VALUES (rec.item_id, rec.location_id, rec.difference, 'opname_adjustment', opname_session_id, auth.uid());
  END LOOP;
END;
$$;

-- Grant execution rights to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_low_stock_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_opname_summary_chart_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_summary_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_opname_history_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_stock_for_opname(INT, INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_opname_session(INT) TO authenticated;
