-- Add role column to project_invitations
ALTER TABLE public.project_invitations 
ADD COLUMN role text NOT NULL DEFAULT 'collaborator';

-- Update accept_project_invitation function to use the invitation role
CREATE OR REPLACE FUNCTION public.accept_project_invitation(_token uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Add user as project member with the role from invitation
  INSERT INTO public.project_members (project_id, user_id, role, added_by)
  VALUES (_invitation.project_id, _user_id, _invitation.role, _invitation.created_by);

  -- Update invitation status
  UPDATE public.project_invitations 
  SET status = 'accepted', accepted_by = _user_id, accepted_at = now()
  WHERE id = _invitation.id;

  -- Create notification for the user
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    _user_id, 
    'Você entrou em um projeto', 
    'Você aceitou o convite e agora é ' || _invitation.role || ' do projeto.',
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

-- Update get_invitation_by_token to include role
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'expires_at', _invitation.expires_at,
    'role', _invitation.role
  );
END;
$$;