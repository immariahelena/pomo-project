-- Create project_members table to manage project collaborators
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('collaborator', 'viewer')),
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Policies for project_members
CREATE POLICY "Project owners and managers can view members"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_members.project_id 
    AND (projects.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Project owners and managers can add members"
ON public.project_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_members.project_id 
    AND (projects.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  )
);

CREATE POLICY "Project owners and managers can remove members"
ON public.project_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_members.project_id 
    AND (projects.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  )
);

-- Update projects RLS to include collaborators
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

CREATE POLICY "Users can view own projects or as member"
ON public.projects
FOR SELECT
USING (
  auth.uid() = created_by 
  OR EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_members.project_id = projects.id 
    AND project_members.user_id = auth.uid()
  )
);

-- Update tasks policies to include project members
DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;

CREATE POLICY "Users can view tasks"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND (
      projects.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
      )
    )
  )
);

-- Update files policies to include project members
DROP POLICY IF EXISTS "Users can view project files" ON public.files;

CREATE POLICY "Users can view project files"
ON public.files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = files.project_id 
    AND (
      projects.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
      )
    )
  )
);

-- Update messages policies to include project members
DROP POLICY IF EXISTS "Users can view project messages" ON public.messages;

CREATE POLICY "Users can view project messages"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = messages.project_id 
    AND (
      projects.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
      )
    )
  )
);

-- Update activity_logs policies
DROP POLICY IF EXISTS "Users can view project activity logs" ON public.activity_logs;

CREATE POLICY "Users can view project activity logs"
ON public.activity_logs
FOR SELECT
USING (
  project_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = activity_logs.project_id 
    AND (
      projects.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
      )
    )
  )
);

-- Update project_stages policies
DROP POLICY IF EXISTS "Users can view project stages" ON public.project_stages;

CREATE POLICY "Users can view project stages"
ON public.project_stages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_stages.project_id 
    AND (
      projects.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
      OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
      )
    )
  )
);