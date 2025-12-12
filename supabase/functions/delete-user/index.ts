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

    // Create client with user's token to verify they're an admin
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

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user ID to delete from request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete user's data in the correct order (due to foreign keys)
    // 1. Delete from activity_logs
    await supabaseAdmin.from('activity_logs').delete().eq('user_id', userId)
    
    // 2. Delete from ticket_responses
    await supabaseAdmin.from('ticket_responses').delete().eq('user_id', userId)
    
    // 3. Delete from support_tickets
    await supabaseAdmin.from('support_tickets').delete().eq('user_id', userId)
    
    // 4. Delete from notifications
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
    
    // 5. Delete from messages
    await supabaseAdmin.from('messages').delete().eq('user_id', userId)
    
    // 6. Delete from files
    await supabaseAdmin.from('files').delete().eq('uploaded_by', userId)
    
    // 7. Update tasks to remove assignment (instead of deleting)
    await supabaseAdmin.from('tasks').update({ assigned_to: null }).eq('assigned_to', userId)
    await supabaseAdmin.from('tasks').update({ created_by: null }).eq('created_by', userId)
    
    // 8. Delete from project_members (both as member and as added_by)
    await supabaseAdmin.from('project_members').delete().eq('user_id', userId)
    await supabaseAdmin.from('project_members').update({ added_by: null }).eq('added_by', userId)
    
    // 9. Update projects created by this user (transfer to null or delete)
    // For now, just nullify the reference - projects stay but with no creator
    // Note: This might need adjustment based on business logic
    const { data: userProjects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('created_by', userId)
    
    if (userProjects && userProjects.length > 0) {
      // Delete project stages and tasks for these projects first
      for (const project of userProjects) {
        await supabaseAdmin.from('tasks').delete().eq('project_id', project.id)
        await supabaseAdmin.from('project_stages').delete().eq('project_id', project.id)
        await supabaseAdmin.from('messages').delete().eq('project_id', project.id)
        await supabaseAdmin.from('files').delete().eq('project_id', project.id)
        await supabaseAdmin.from('activity_logs').delete().eq('project_id', project.id)
        await supabaseAdmin.from('project_members').delete().eq('project_id', project.id)
      }
      // Now delete the projects
      await supabaseAdmin.from('projects').delete().eq('created_by', userId)
    }
    
    // 10. Delete from user_roles
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    
    // 11. Delete from profiles
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    
    // 12. Finally delete the auth user using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
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
