// Activity Logging System
const MAX_LOG_SIZE = 500;
const activityLog = [];

// Generate unique ID
function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Log activity
export function logActivity(type, action, details = {}, user = "system") {
  const logEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    action,
    user,
    details,
    ipAddress: details.ipAddress || null
  };

  activityLog.unshift(logEntry);

  // Remove old entries if exceeding max size
  if (activityLog.length > MAX_LOG_SIZE) {
    activityLog.pop();
  }

  console.log(`[ACTIVITY] ${type}:${action} by ${user}`, details);
}

// Get activity logs
export function getActivityLog() {
  return activityLog;
}

// Get max log size
export function getMaxLogSize() {
  return MAX_LOG_SIZE;
}
