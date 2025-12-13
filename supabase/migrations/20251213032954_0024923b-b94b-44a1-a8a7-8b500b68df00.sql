-- Create table for project invitations
CREATE TABLE public.project_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by UUID,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for project_invitations
-- Project owners and managers can create invitations
CREATE POLICY "Project owners and managers can create invitations"
ON public.project_invitations
FOR INSERT
WITH CHECK (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
);

-- Project owners and managers can view invitations
CREATE POLICY "Project owners and managers can view invitations"
ON public.project_invitations
FOR SELECT
USING (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR created_by = auth.uid()
);

-- Project owners and managers can update invitations (to revoke)
CREATE POLICY "Project owners and managers can update invitations"
ON public.project_invitations
FOR UPDATE
USING (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR created_by = auth.uid()
);

-- Project owners and managers can delete invitations
CREATE POLICY "Project owners and managers can delete invitations"
ON public.project_invitations
FOR DELETE
USING (
  is_project_owner(project_id, auth.uid()) 
  OR has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR created_by = auth.uid()
);

-- Function to validate and accept invitation (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.accept_project_invitation(_token UUID, _user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _result JSON;
BEGIN
  -- Get the invitation
  SELECT * INTO _invitation
  FROM public.project_invitations
  WHERE token = _token
  FOR UPDATE;

  -- Check if invitation exists
  IF _invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  -- Check if invitation is pending
  IF _invitation.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite já foi utilizado ou expirou');
  END IF;

  -- Check if invitation is expired
  IF _invitation.expires_at < now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = _invitation.id;
    RETURN json_build_object('success', false, 'error', 'Este convite expirou');
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = _invitation.project_id AND user_id = _user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Você já é membro deste projeto');
  END IF;

  -- Check if user is the project owner
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _invitation.project_id AND created_by = _user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Você é o dono deste projeto');
  END IF;

  -- Add user as project member
  INSERT INTO public.project_members (project_id, user_id, role, added_by)
  VALUES (_invitation.project_id, _user_id, 'collaborator', _invitation.created_by);

  -- Update invitation status
  UPDATE public.project_invitations 
  SET status = 'accepted', accepted_by = _user_id, accepted_at = now()
  WHERE id = _invitation.id;

  -- Create notification for the user
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    _user_id, 
    'Você entrou em um projeto', 
    'Você aceitou o convite e agora é colaborador do projeto.',
    'info',
    '/projects/' || _invitation.project_id
  );

  RETURN json_build_object(
    'success', true, 
    'project_id', _invitation.project_id,
    'message', 'Convite aceito com sucesso!'
  );
END;
$$;

-- Function to get invitation details by token (public access for validation)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _project RECORD;
  _creator RECORD;
BEGIN
  -- Get the invitation
  SELECT * INTO _invitation
  FROM public.project_invitations
  WHERE token = _token;

  -- Check if invitation exists
  IF _invitation IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Convite não encontrado');
  END IF;

  -- Check if invitation is pending
  IF _invitation.status != 'pending' THEN
    RETURN json_build_object('valid', false, 'error', 'Este convite já foi utilizado ou expirou');
  END IF;

  -- Check if invitation is expired
  IF _invitation.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Este convite expirou');
  END IF;

  -- Get project details
  SELECT id, name INTO _project
  FROM public.projects
  WHERE id = _invitation.project_id;

  -- Get creator details
  SELECT full_name INTO _creator
  FROM public.profiles
  WHERE id = _invitation.created_by;

  RETURN json_build_object(
    'valid', true,
    'project_id', _project.id,
    'project_name', _project.name,
    'created_by_name', _creator.full_name,
    'expires_at', _invitation.expires_at
  );
END;
$$;