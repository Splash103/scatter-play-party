-- Phase 1: Critical Database Policy Fixes and Secure Leaderboard RPC

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_wins ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive public SELECT policies if they exist
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS match_wins_select_all ON public.match_wins;

-- Keep existing self-access policies as-is (insert/update/select own)
-- No changes required here; we only remove the public policies above

-- Create a SECURITY DEFINER function to expose a public-safe leaderboard
-- This bypasses RLS on underlying tables but returns only non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count int DEFAULT 50)
RETURNS TABLE (
  display_name text,
  total_wins int,
  current_streak int,
  best_streak int,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.display_name,
    COALESCE(wc.total_wins, 0)::int AS total_wins,
    p.current_streak,
    p.best_streak,
    p.created_at
  FROM public.profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS total_wins
    FROM public.match_wins
    GROUP BY user_id
  ) wc ON wc.user_id = p.id
  ORDER BY COALESCE(wc.total_wins, 0) DESC, p.best_streak DESC, p.created_at ASC
  LIMIT limit_count
$$;

-- Lock down and grant execution
REVOKE ALL ON FUNCTION public.get_leaderboard(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;