/*
  # Enable Cascade Delete for Items
  
  1. Changes
    - Drop existing foreign key constraints on `stock_opname_items`, `stock_movements`, `recipe_ingredients`, and `recipes`
    - Re-add constraints with `ON DELETE CASCADE`
    
  2. Purpose
    - Allows "Force Delete" of items to automatically and atomically clean up ALL related records in the database.
    - Prevents Foreign Key Violation (Error 23503) when frontend permissions (RLS) restrict visibility of child rows.
*/

-- 1. stock_opname_items
ALTER TABLE stock_opname_items DROP CONSTRAINT IF EXISTS stock_opname_items_item_id_fkey;
ALTER TABLE stock_opname_items 
  ADD CONSTRAINT stock_opname_items_item_id_fkey 
  FOREIGN KEY (item_id) 
  REFERENCES items(id) 
  ON DELETE CASCADE;

-- 2. stock_movements
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_item_id_fkey;
ALTER TABLE stock_movements 
  ADD CONSTRAINT stock_movements_item_id_fkey 
  FOREIGN KEY (item_id) 
  REFERENCES items(id) 
  ON DELETE CASCADE;

-- 3. recipe_ingredients (Check if table exists first to prevent errors)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipe_ingredients') THEN
    ALTER TABLE recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_item_id_fkey;
    ALTER TABLE recipe_ingredients 
      ADD CONSTRAINT recipe_ingredients_item_id_fkey 
      FOREIGN KEY (item_id) 
      REFERENCES items(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4. recipes (target_item_id) (Check if table exists first)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes') THEN
    ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_target_item_id_fkey;
    ALTER TABLE recipes 
      ADD CONSTRAINT recipes_target_item_id_fkey 
      FOREIGN KEY (target_item_id) 
      REFERENCES items(id) 
      ON DELETE CASCADE;
  END IF;
END $$;
