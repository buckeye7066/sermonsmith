import { api } from '@/api/apiClient';

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
    const user = await api.auth.me();
    if (!user) {
      console.log("No user logged in, skipping activity logs");
      isProcessing = false;
      return;
    }
    
    // Create all activities
    for (const activity of batch) {
      try {
        await api.entities.UserActivity.create({
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
    metadata: {
      ...details.metadata || {},
      // Capture granular details
      url: window.location.href,
      pathname: window.location.pathname,
      search_params: window.location.search,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      // Action outcome
      outcome: details.outcome || 'success',
      error_message: details.error_message || null,
      // Data context
      data_modified: details.data_modified || null,
      data_viewed: details.data_viewed || null,
      previous_value: details.previous_value || null,
      new_value: details.new_value || null
    }
  };
  
  activityQueue.push(activityData);
  
  // Process immediately if queue is large
  if (activityQueue.length >= 5) {
    processQueue();
  }
};

export default logActivity;