import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Grant premium override to current user
    await base44.asServiceRole.entities.User.update(user.id, {
      premium_override: true,
      subscription_tier: 'premium'
    });

    return Response.json({ 
      success: true,
      message: `Premium access granted to ${user.email}`,
      user_id: user.id
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});