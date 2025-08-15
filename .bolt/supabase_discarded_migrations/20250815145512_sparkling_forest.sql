/*
  # Add total games played to profiles

  1. Schema Changes
    - Add `total_games_played` column to `profiles` table with default value 0
    - Add `total_score` column to `profiles` table with default value 0 for calculating average score later

  2. Functions
    - Create function to update game statistics when a match ends
    - Create trigger to automatically call this function

  3. View Updates
    - Update the leaderboard view to include total games played and average score
*/

-- Add new columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'total_games_played'
  ) THEN
    ALTER TABLE profiles ADD COLUMN total_games_played integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'total_score'
  ) THEN
    ALTER TABLE profiles ADD COLUMN total_score integer DEFAULT 0;
  END IF;
END $$;

-- Create function to update player statistics after a match
CREATE OR REPLACE FUNCTION update_player_match_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total games played for all participants
  UPDATE profiles 
  SET total_games_played = total_games_played + 1,
      updated_at = now()
  WHERE id IN (
    SELECT user_id 
    FROM match_participants 
    WHERE match_id = NEW.id
  );

  -- Update total score for all participants
  UPDATE profiles 
  SET total_score = total_score + COALESCE(mp.score, 0),
      updated_at = now()
  FROM match_participants mp
  WHERE profiles.id = mp.user_id 
    AND mp.match_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update stats when a match ends
DROP TRIGGER IF EXISTS t_update_match_stats ON matches;
CREATE TRIGGER t_update_match_stats
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION update_player_match_stats();

-- Update the leaderboard view to include new statistics
DROP VIEW IF EXISTS v_leaderboard;
CREATE VIEW v_leaderboard AS
SELECT 
  p.display_name,
  p.current_streak,
  p.best_streak,
  p.total_games_played,
  p.total_score,
  CASE 
    WHEN p.total_games_played > 0 
    THEN ROUND(p.total_score::decimal / p.total_games_played, 1)
    ELSE 0 
  END as average_score,
  COALESCE(w.total_wins, 0) as total_wins,
  p.created_at
FROM profiles p
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_wins
  FROM match_wins
  GROUP BY user_id
) w ON p.id = w.user_id
ORDER BY total_wins DESC, p.best_streak DESC, p.current_streak DESC;