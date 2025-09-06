-- Security fixes: Remove duplicate RLS policies, tighten function security, and restrict leaderboard access

-- 1. Clean up duplicate RLS policies on profiles table
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Keep only the more descriptive policy names
-- (The "Users can..." policies are already in place)

-- 2. Clean up duplicate RLS policies on match_wins table  
DROP POLICY IF EXISTS "match_wins_insert_self" ON public.match_wins;

-- 3. Tighten the get_leaderboard function security
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
 RETURNS TABLE(display_name text, total_wins integer, current_streak integer, best_streak integer, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 4. Add RLS to the leaderboard view to require authentication
ALTER VIEW public.v_leaderboard SET (security_invoker = true);

-- Remove public grants and require authentication
REVOKE SELECT ON public.v_leaderboard FROM anon;
GRANT SELECT ON public.v_leaderboard TO authenticated;

-- Add RLS policy to view (requires authenticated users)
-- Note: Views can have RLS policies when security_invoker is set
CREATE POLICY "Authenticated users can view leaderboard" 
ON public.v_leaderboard 
FOR SELECT 
TO authenticated
USING (true);