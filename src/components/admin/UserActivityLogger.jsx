import { base44 } from "@/api/base44Client";

// Queue to batch activity logs
let activityQueue = [];
let isProcessing = false;

// Process queue every 2 seconds or when it reaches 5 items
const processQueue = async () => {
  if (isProcessing || activityQueue.length === 0) return;
  
  isProcessing = true;
  const batch = [...activityQueue];
  activityQueue = [];
  
  try {
    // Get user once for the entire batch
    const user = await base44.auth.me();
    if (!user) {
      console.log("No user logged in, skipping activity logs");
      isProcessing = false;
      return;
    }
    
    // Create all activities
    for (const activity of batch) {
      try {
        await base44.entities.UserActivity.create({
          user_id: user.id,
          user_email: user.email,
          ...activity
        });
      } catch (error) {
        console.error("Failed to log activity:", activity, error);
      }
    }
  } catch (error) {
    console.error("Batch activity logging failed:", error);
  } finally {
    isProcessing = false;
  }
};

// Auto-process queue every 2 seconds
setInterval(processQueue, 2000);

export const logActivity = (actionType, details = {}) => {
  const activityData = {
    action_type: actionType,
    page_name: details.page_name || window.location.pathname.split('/').pop() || 'Home',
    resource_type: details.resource_type || null,
    resource_id: details.resource_id || null,
    metadata: details.metadata || {}
  };
  
  activityQueue.push(activityData);
  
  // Process immediately if queue is large
  if (activityQueue.length >= 5) {
    processQueue();
  }
};

export default logActivity;