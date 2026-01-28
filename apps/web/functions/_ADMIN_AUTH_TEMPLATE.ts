/**
 * TEMPLATE FOR ADMIN-ONLY BACKEND FUNCTIONS
 * 
 * All diagnostic, import, and test functions should follow this pattern
 * to ensure proper authentication and authorization.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Step 1: Authenticate user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Step 2: Check authentication
    if (!user) {
      return Response.json({ 
        error: 'Unauthorized - Please log in' 
      }, { status: 401 });
    }

    // Step 3: Check admin authorization
    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden - Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }

    // Step 4: Proceed with function logic
    console.log(`Admin function called by: ${user.email}`);
    
    // YOUR FUNCTION LOGIC HERE
    
    return Response.json({
      success: true,
      message: "Function completed successfully"
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});