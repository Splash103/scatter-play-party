-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_wins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create RLS policies for match_wins table
CREATE POLICY "Users can view their own match wins" 
ON public.match_wins 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match wins" 
ON public.match_wins 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Fix the security definer view issue by recreating the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_leaderboard;
CREATE VIEW public.v_leaderboard AS
SELECT 
  p.display_name,
  COUNT(mw.id) as total_wins,
  p.current_streak,
  p.best_streak,
  p.created_at
FROM public.profiles p
LEFT JOIN public.match_wins mw ON p.id = mw.user_id
GROUP BY p.id, p.display_name, p.current_streak, p.best_streak, p.created_at
ORDER BY total_wins DESC, p.best_streak DESC, p.created_at ASC;