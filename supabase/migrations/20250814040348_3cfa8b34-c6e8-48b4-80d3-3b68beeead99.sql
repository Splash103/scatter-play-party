-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;