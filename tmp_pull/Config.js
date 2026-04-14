// ============================================================
// Config.gs - Global configuration constants
// ============================================================

var CONFIG = {
  // App info
  APP_NAME: 'Daily Task Manager',
  APP_VERSION: '1.0.0',
  APP_URL: '', // Will be set after first deploy
  LOGO_URL: 'data:image/png;base64,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', // Replace with actual logo URL after upload
  
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
  return SpreadsheetApp.openById('1lzgV05CkSvsPtKRoJZciAujXTqP_6ZNDAfbwIXWAtVA');
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

