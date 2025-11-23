import { base44 } from "@/api/base44Client";

let currentUser = null;

// Cache user to avoid repeated auth calls
const getUser = async () => {
  if (!currentUser) {
    try {
      currentUser = await base44.auth.me();
    } catch (error) {
      return null;
    }
  }
  return currentUser;
};

export const logActivity = async (actionType, details = {}) => {
  try {
    const user = await getUser();
    if (!user) {
      console.log("No user logged in, skipping activity log");
      return;
    }
    
    const activityData = {
      user_id: user.id,
      user_email: user.email,
      action_type: actionType,
      page_name: details.page_name || window.location.pathname,
      resource_type: details.resource_type,
      resource_id: details.resource_id,
      metadata: details.metadata || {}
    };
    
    console.log("Logging activity:", activityData);
    
    await base44.entities.UserActivity.create(activityData);
    
    console.log("Activity logged successfully");
  } catch (error) {
    // Log error but don't disrupt user experience
    console.error("Activity logging failed:", error);
  }
};

// Reset user cache when needed (e.g., on logout)
export const resetUserCache = () => {
  currentUser = null;
};

export default logActivity;