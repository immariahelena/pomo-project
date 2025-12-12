-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table (users can belong to multiple teams)
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Managers can view their own teams"
ON public.teams FOR SELECT
USING (manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers and admins can create teams"
ON public.teams FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update their own teams"
ON public.teams FOR UPDATE
USING (manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can delete their own teams"
ON public.teams FOR DELETE
USING (manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for team_members
CREATE POLICY "Team managers can view team members"
ON public.team_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND (teams.manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Team managers can add team members"
ON public.team_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND (teams.manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Team managers can remove team members"
ON public.team_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND (teams.manager_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Function to get users from manager's teams
CREATE OR REPLACE FUNCTION public.get_team_users_for_manager(_manager_id uuid)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT tm.user_id
  FROM public.team_members tm
  INNER JOIN public.teams t ON t.id = tm.team_id
  WHERE t.manager_id = _manager_id
$$;

-- Trigger for updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();