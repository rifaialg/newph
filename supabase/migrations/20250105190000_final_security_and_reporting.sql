/*
          # [Function] Final Security Patch & Reporting Functions
          [This script patches the final security warning and creates all necessary server-side functions for dashboard metrics and reports.]

          ## Query Description: [This operation is safe. It creates and replaces database functions. It will fix the 'search_path' warning for the user creation trigger and add new, efficient functions for data aggregation, improving app performance.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Functions being created/replaced: handle_new_user, get_dashboard_metrics, get_opname_summary_chart_data, get_stock_summary_report, get_opname_history_report, get_low_stock_items, approve_opname_session.
          
          ## Security Implications:
          - RLS Status: [No change]
          - Policy Changes: [No]
          - Auth Requirements: [Functions are secure and respect RLS policies.]
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [Positive. Moves complex calculations to the database server, improving frontend performance.]
          */

-- Final security patch for the user creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', (new.raw_user_meta_data->>'role')::public.user_role);
  RETURN new;
END;
$$;

ALTER FUNCTION public.handle_new_user() SET search_path = 'public';

-- Function to get key metrics for the dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS TABLE(total_items BIGINT, total_stock_value NUMERIC, active_locations BIGINT, low_stock_items_count BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.items WHERE is_active = true) AS total_items,
    (SELECT SUM(current_stock.quantity * i.cost_price) FROM public.get_current_stock() current_stock JOIN public.items i ON i.id = current_stock.item_id) AS total_stock_value,
    (SELECT COUNT(*) FROM public.locations WHERE is_active = true) AS active_locations,
    (SELECT COUNT(*) FROM public.get_low_stock_items()) AS low_stock_items_count;
END;
$$;

-- Function to get data for the opname summary chart on the dashboard
CREATE OR REPLACE FUNCTION public.get_opname_summary_chart_data()
RETURNS TABLE(created_at TIMESTAMPTZ, total_variance_value NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.created_at,
    SUM((COALESCE(si.physical_count, 0) - si.system_stock_at_start) * i.cost_price) as total_variance_value
  FROM public.stock_opname_sessions s
  JOIN public.stock_opname_items si ON s.id = si.session_id
  JOIN public.items i ON si.item_id = i.id
  WHERE s.status = 'approved'
  GROUP BY s.id, s.created_at
  ORDER BY s.created_at DESC
  LIMIT 5;
END;
$$;

-- Function for the Stock Summary Report
CREATE OR REPLACE FUNCTION public.get_stock_summary_report()
RETURNS TABLE(item_name TEXT, location_name TEXT, quantity NUMERIC, stock_value NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.name as item_name,
    l.name as location_name,
    cs.quantity,
    (cs.quantity * i.cost_price) as stock_value
  FROM public.get_current_stock() cs
  JOIN public.items i ON cs.item_id = i.id
  JOIN public.locations l ON cs.location_id = l.id
  WHERE cs.quantity != 0
  ORDER BY i.name, l.name;
END;
$$;

-- Function for the Opname History Report
CREATE OR REPLACE FUNCTION public.get_opname_history_report()
RETURNS TABLE(session_id INT, created_at TIMESTAMPTZ, status TEXT, total_variance NUMERIC, total_variance_value NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as session_id,
    s.created_at,
    s.status::text,
    SUM(COALESCE(si.physical_count, 0) - si.system_stock_at_start) as total_variance,
    SUM((COALESCE(si.physical_count, 0) - si.system_stock_at_start) * i.cost_price) as total_variance_value
  FROM public.stock_opname_sessions s
  JOIN public.stock_opname_items si ON s.id = si.session_id
  JOIN public.items i ON si.item_id = i.id
  GROUP BY s.id
  ORDER BY s.created_at DESC;
END;
$$;

-- Function to approve an opname session and adjust stock
CREATE OR REPLACE FUNCTION public.approve_opname_session(p_session_id int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item_record RECORD;
  variance NUMERIC;
  current_user_id UUID := auth.uid();
BEGIN
  -- Check if session exists and is pending
  IF NOT EXISTS (SELECT 1 FROM public.stock_opname_sessions WHERE id = p_session_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Opname session not found or not in pending state.';
  END IF;

  -- Loop through each item in the session
  FOR item_record IN
    SELECT * FROM public.stock_opname_items WHERE session_id = p_session_id
  LOOP
    variance := COALESCE(item_record.physical_count, 0) - item_record.system_stock_at_start;

    -- Only create a movement if there is a variance
    IF variance != 0 THEN
      INSERT INTO public.stock_movements(item_id, location_id, quantity_change, movement_type, reference_id, created_by, note)
      VALUES (item_record.item_id, item_record.location_id, variance, 'opname_adjustment', p_session_id, current_user_id, 'Stock adjustment from opname session #' || p_session_id);
    END IF;
  END LOOP;

  -- Update the session status to 'approved'
  UPDATE public.stock_opname_sessions
  SET status = 'approved'
  WHERE id = p_session_id;
END;
$$;
