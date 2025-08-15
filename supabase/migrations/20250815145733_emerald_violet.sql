/*
  # Profile Editing System with Coins

  1. New Tables
    - `cosmetics` - Available cosmetic items for purchase
    - `inventory` - Player-owned cosmetic items
    - `coin_transactions` - Track all coin movements
  
  2. Updates to Profiles
    - Add coins balance
    - Add equipped cosmetic fields
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for secure access
  
  4. Functions
    - Coin transaction trigger to update balances
*/

-- Add coins and cosmetic fields to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'coins'
  ) THEN
    ALTER TABLE profiles ADD COLUMN coins integer DEFAULT 100;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'equipped_skin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN equipped_skin text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'equipped_wave'
  ) THEN
    ALTER TABLE profiles ADD COLUMN equipped_wave text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'equipped_tag'
  ) THEN
    ALTER TABLE profiles ADD COLUMN equipped_tag text;
  END IF;
END $$;

-- Create cosmetic_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cosmetic_type') THEN
    CREATE TYPE cosmetic_type AS ENUM ('water_skin', 'wave_effect', 'name_tag');
  END IF;
END $$;

-- Create cosmetics table
CREATE TABLE IF NOT EXISTS cosmetics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type cosmetic_type NOT NULL,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cosmetics are publicly viewable"
  ON cosmetics
  FOR SELECT
  TO public
  USING (true);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cosmetic_id uuid NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  acquired_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cosmetic_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON inventory
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own inventory"
  ON inventory
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own inventory"
  ON inventory
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Create coin_transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coin transactions"
  ON coin_transactions
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coin transactions"
  ON coin_transactions
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

-- Create function to apply coin transactions
CREATE OR REPLACE FUNCTION apply_coin_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET coins = coins + NEW.amount,
      updated_at = now()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for coin transactions
DROP TRIGGER IF EXISTS t_apply_coin ON coin_transactions;
CREATE TRIGGER t_apply_coin
  AFTER INSERT ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION apply_coin_transaction();

-- Insert some starter cosmetics
INSERT INTO cosmetics (type, key, name, price) VALUES
  ('water_skin', 'ocean_blue', 'Ocean Blue', 50),
  ('water_skin', 'sunset_orange', 'Sunset Orange', 75),
  ('water_skin', 'forest_green', 'Forest Green', 60),
  ('water_skin', 'royal_purple', 'Royal Purple', 100),
  ('wave_effect', 'gentle_ripple', 'Gentle Ripple', 80),
  ('wave_effect', 'lightning_bolt', 'Lightning Bolt', 120),
  ('wave_effect', 'rainbow_wave', 'Rainbow Wave', 150),
  ('name_tag', 'champion', 'Champion', 200),
  ('name_tag', 'wordsmith', 'Wordsmith', 150),
  ('name_tag', 'creative_genius', 'Creative Genius', 250)
ON CONFLICT (key) DO NOTHING;