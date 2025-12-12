import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create client with user's token to verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the project ID to delete from request body
    const { projectId } = await req.json()

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Project ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has permission to delete the project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is owner, admin, or manager
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isOwner = project.created_by === user.id
    const isAdmin = roleData?.role === 'admin'
    const isManager = roleData?.role === 'manager'

    if (!isOwner && !isAdmin && !isManager) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to delete this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Deleting project ${projectId} by user ${user.id}`)

    // Delete related data in correct order (due to foreign keys)
    // 1. Delete activity logs
    const { error: activityError } = await supabaseAdmin
      .from('activity_logs')
      .delete()
      .eq('project_id', projectId)
    if (activityError) console.log('Error deleting activity_logs:', activityError)

    // 2. Delete files
    const { error: filesError } = await supabaseAdmin
      .from('files')
      .delete()
      .eq('project_id', projectId)
    if (filesError) console.log('Error deleting files:', filesError)

    // 3. Delete messages
    const { error: messagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('project_id', projectId)
    if (messagesError) console.log('Error deleting messages:', messagesError)

    // 4. Delete tasks
    const { error: tasksError } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('project_id', projectId)
    if (tasksError) console.log('Error deleting tasks:', tasksError)

    // 5. Delete project stages
    const { error: stagesError } = await supabaseAdmin
      .from('project_stages')
      .delete()
      .eq('project_id', projectId)
    if (stagesError) console.log('Error deleting project_stages:', stagesError)

    // 6. Delete project members
    const { error: membersError } = await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
    if (membersError) console.log('Error deleting project_members:', membersError)

    // 7. Finally delete the project
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (deleteError) {
      console.error('Error deleting project:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Project ${projectId} deleted successfully`)

    return new Response(
      JSON.stringify({ success: true, message: 'Project deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
