-- Fix the security definer view issue for leaderboard
DROP VIEW IF EXISTS public.v_leaderboard;

-- Create a new leaderboard view without SECURITY DEFINER
CREATE VIEW public.v_leaderboard AS
SELECT 
  p.display_name,
  p.current_streak,
  p.best_streak,
  COALESCE(win_counts.total_wins, 0) as total_wins,
  p.created_at
FROM public.profiles p
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_wins
  FROM public.match_wins
  GROUP BY user_id
) win_counts ON p.id = win_counts.user_id
ORDER BY COALESCE(win_counts.total_wins, 0) DESC;

-- Enable RLS on the view 
ALTER VIEW public.v_leaderboard SET (security_invoker = true);

-- Grant public access to the leaderboard view
GRANT SELECT ON public.v_leaderboard TO anon;
GRANT SELECT ON public.v_leaderboard TO authenticated;