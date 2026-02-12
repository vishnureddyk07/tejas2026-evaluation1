// Activity Logging System
// This system stores logs in the database for persistence
let dbActivityLogs = null;

// Generate unique ID
function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Set database reference
export function initActivityLogger(db) {
  dbActivityLogs = db;
}

// Log activity
export async function logActivity(type, action, details = {}, user = "system") {
  const logEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    action,
    user,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    ip_address: details?.ipAddress || "Unknown"
  };

  // Store in database
  if (dbActivityLogs) {
    try {
      await dbActivityLogs.activityLogs.insert(logEntry);
    } catch (error) {
      console.error("[ACTIVITY LOG] Failed to store in database:", error);
    }
  }

  console.log(`[ACTIVITY] ${type}:${action} by ${user}`, details);
}

// Get activity logs from database
export async function getActivityLogsFromDb(filters = {}) {
  if (!dbActivityLogs) {
    return [];
  }
  
  try {
    return await dbActivityLogs.activityLogs.getAll(200);
  } catch (error) {
    console.error("[ACTIVITY LOG] Failed to fetch from database:", error);
    return [];
  }
}
