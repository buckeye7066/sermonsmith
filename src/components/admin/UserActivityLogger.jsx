import { base44 } from "@/api/base44Client";

export const logActivity = async (actionType, details = {}) => {
  try {
    const user = await base44.auth.me();
    
    await base44.entities.UserActivity.create({
      user_id: user.id,
      user_email: user.email,
      action_type: actionType,
      page_name: details.page_name || window.location.pathname,
      resource_type: details.resource_type,
      resource_id: details.resource_id,
      metadata: details.metadata || {}
    });
  } catch (error) {
    // Silent fail - don't disrupt user experience
    console.log("Activity logging failed:", error);
  }
};

export default logActivity;