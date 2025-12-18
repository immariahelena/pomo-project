-- Add approval columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Approve existing users (so they don't lose access)
UPDATE public.profiles SET approved = true WHERE approved IS NULL OR approved = false;

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE id = _user_id),
    false
  )
$$;