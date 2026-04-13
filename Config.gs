// ============================================================
// Config.gs - Global configuration constants
// ============================================================

var CONFIG = {
  // App info
  APP_NAME: 'Daily Task Manager',
  APP_VERSION: '1.0.0',
  APP_URL: '', // Will be set after first deploy
  LOGO_URL: 'https://i.imgur.com/placeholder.png', // Replace with actual logo URL after upload
  
  // Timezone
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  
  // Security
  SALT: 'DTM@2026#SecureKey!',
  TOKEN_EXPIRY_HOURS: 24,
  SESSION_EXPIRY_HOURS: 8,
  
  // Admin
  ADMIN_EMAIL: 'lythanhthao100@gmail.com',
  FEEDBACK_EMAIL: 'lythanhthao100@gmail.com',
  
  // Database Sheet names
  SHEETS: {
    USERS:         'Users',
    TASKS:         'Tasks',
    GROUPS:        'Groups',
    GROUP_MEMBERS: 'GroupMembers',
    MESSAGES:      'Messages',
    FEEDBACK:      'Feedback',
    EMAIL_LOG:     'EmailLog',
    SESSIONS:      'Sessions',
    NOTIFICATIONS: 'Notifications'
  },
  
  // Task statuses
  TASK_STATUS: {
    PENDING:     'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED:   'completed',
    OVERDUE:     'overdue',
    CANCELLED:   'cancelled'
  },
  
  // Task priorities
  TASK_PRIORITY: {
    LOW:    'low',
    MEDIUM: 'medium',
    HIGH:   'high',
    URGENT: 'urgent'
  },
  
  // User roles
  ROLES: {
    ADMIN:  'admin',
    LEADER: 'leader',
    USER:   'user'
  },
  
  // Group member roles
  GROUP_ROLES: {
    LEADER: 'leader',
    MEMBER: 'member'
  },
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  CHAT_PAGE_SIZE: 30,
  
  // Drive folder name for attachments
  DRIVE_FOLDER: 'DTM_Attachments',
  
  // Email subjects
  EMAIL_SUBJECTS: {
    WELCOME:           '[Daily Task Manager] Chào mừng bạn đã đăng ký!',
    VERIFY:            '[Daily Task Manager] Xác nhận địa chỉ email',
    LOGIN_NOTIFY:      '[Daily Task Manager] Thông báo đăng nhập mới',
    PASSWORD_CHANGE:   '[Daily Task Manager] Xác nhận thay đổi mật khẩu',
    TASK_ASSIGNED:     '[Daily Task Manager] Bạn được giao công việc mới',
    GROUP_INVITE:      '[Daily Task Manager] Lời mời tham gia nhóm',
    FEEDBACK_CONFIRM:  '[Daily Task Manager] Cảm ơn phản hồi của bạn'
  }
};

/**
 * Get the active spreadsheet
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Get web app URL (cached in script properties)
 */
function getWebAppUrl() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('WEB_APP_URL') || '';
}

/**
 * Set web app URL
 */
function setWebAppUrl(url) {
  PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
  CONFIG.APP_URL = url;
}

/**
 * Get or create Drive folder for attachments
 */
function getAttachmentsFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('ATTACHMENTS_FOLDER_ID');
  
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch(e) {}
  }
  
  var folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(CONFIG.DRIVE_FOLDER);
  }
  
  props.setProperty('ATTACHMENTS_FOLDER_ID', folder.getId());
  return folder;
}
