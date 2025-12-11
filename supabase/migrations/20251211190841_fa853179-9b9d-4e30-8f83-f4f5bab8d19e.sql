-- Create a security definer function to check project membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

-- Drop the problematic SELECT policy that causes recursion
DROP POLICY IF EXISTS "Users can view own projects or as member" ON public.projects;

-- Create new SELECT policy using the security definer function
CREATE POLICY "Users can view own projects or as member"
ON public.projects
FOR SELECT
USING (
  auth.uid() = created_by 
  OR is_project_member(id, auth.uid())
);

-- Also update project_members policies to use direct checks instead of subqueries to projects
DROP POLICY IF EXISTS "Project owners and managers can add members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and managers can remove members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and managers can view members" ON public.project_members;

-- Create a function to check if user is project owner
CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id AND created_by = _user_id
  )
$$;

-- Recreate project_members policies using the security definer functions
CREATE POLICY "Project owners and managers can add members"
ON public.project_members
FOR INSERT
WITH CHECK (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Project owners and managers can remove members"
ON public.project_members
FOR DELETE
USING (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Project owners and managers can view members"
ON public.project_members
FOR SELECT
USING (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
);