// ============================================================
// AdminController.gs - Core Admin Functionality
// ============================================================

/**
 * Check if the user has Admin rights
 */
function verifyAdmin() {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return false;
  return sessionRes.data.role === 'admin';
}

/**
 * Provide common admin stats
 */
function getAdminStats() {
  if (!verifyAdmin()) return errorResponse('Truy cập bị từ chối');
  
  var usersCount = countRowsWhere(CONFIG.SHEETS.USERS, function(u) { return true; });
  var tasksCount = countRowsWhere(CONFIG.SHEETS.TASKS, function(t) { return true; });
  var groupsCount = countRowsWhere(CONFIG.SHEETS.GROUPS, function(g) { return true; });
  var msgCount = countRowsWhere(CONFIG.SHEETS.MESSAGES, function(m) { return true; });
  
  return successResponse({
    users: usersCount,
    tasks: tasksCount,
    groups: groupsCount,
    messages: msgCount
  });
}

/**
 * Get all users for administration
 */
function getSystemUsers() {
  if (!verifyAdmin()) return errorResponse('Truy cập bị từ chối');
  
  var rows = getAllRows(CONFIG.SHEETS.USERS);
  
  // Safe map
  var users = rows.map(function(u) {
    return {
      userId: u.userId,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    };
  });
  
  // Sort reverse chronological
  users.sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  
  return successResponse(users);
}

/**
 * Update user role/status
 */
function adminUpdateUser(userId, updates) {
  if (!verifyAdmin()) return errorResponse('Truy cập bị từ chối');
  
  // Prevent changing self status randomly
  var me = getUserSession().data;
  if (me.userId === userId && updates.status === 'disabled') {
    return errorResponse('Không thể tự khóa tài khoản của chính mình.');
  }
  
  var allowedUpdates = {};
  if (updates.role) allowedUpdates.role = updates.role;
  if (updates.status) allowedUpdates.status = updates.status;
  
  var success = updateRowBy(CONFIG.SHEETS.USERS, 'userId', userId, allowedUpdates);
  
  if (success) return successResponse(null, 'Cập nhật tài khoản thành công');
  return errorResponse('Không thể cập nhật tài khoản');
}

/**
 * Submit feedback (from User -> Admin)
 */
function submitSystemFeedback(content) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  var user = sessionRes.data;
  
  var feedbackData = {
    feedbackId: generateUUID(),
    userId: user.userId,
    userEmail: user.email,
    userName: user.name,
    content: sanitize(content),
    createdAt: now(),
    emailSent: false
  };
  
  var success = insertRow(CONFIG.SHEETS.FEEDBACK, feedbackData);
  if (success) {
    try {
      // Background auto-trigger to forward email to admin config (lythanhthao100@gmail)
      sendFeedbackToAdmin(feedbackData);
      updateRowBy(CONFIG.SHEETS.FEEDBACK, 'feedbackId', feedbackData.feedbackId, { emailSent: true });
    } catch(e) {}
    
    return successResponse(null, 'Đã gửi phản hồi.');
  }
  return errorResponse('Lỗi hệ thống');
}

/**
 * Fetch all feedbacks for admin panel
 */
function getSystemFeedbacks() {
  if (!verifyAdmin()) return errorResponse('Truy cập bị từ chối');
  var fb = getAllRows(CONFIG.SHEETS.FEEDBACK);
  fb.sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return successResponse(fb);
}

/**
 * Custom bulk email from Admin/Leader via Sheets/UI
 * (Hook called from UI)
 */
function adminSendBulks(recipientsType, subject, messageHTML, attachmentsStr) {
  if (!verifyAdmin()) return errorResponse('Truy cập bị từ chối');
  
  var usersList = [];
  if (recipientsType === 'all') {
    usersList = getRowsWhere(CONFIG.SHEETS.USERS, function(u) { return u.status === 'active'; });
  } else if (recipientsType === 'admins') {
    usersList = getRowsWhere(CONFIG.SHEETS.USERS, function(u) { return u.role === 'admin' && u.status === 'active'; });
  } else {
    // Specific email provided
    usersList = [{ email: recipientsType }];
  }
  
  var emails = usersList.map(function(u) { return u.email; }).filter(Boolean);
  
  if (emails.length === 0) return errorResponse('Không có người nhận hợp lệ');
  
  var attachments = [];
  if (attachmentsStr && attachmentsStr !== '[]') {
    try {
      var arr = JSON.parse(attachmentsStr);
      // For MailApp, attachments must be blobs.
      // Easiest is to send as Drive links in the HTML instead of literal blobs to save quota and time.
      // Modifying messageHTML to append drive links.
      messageHTML += '<br><br><hr><p><b>Tài liệu đính kèm:</b></p><ul>';
      arr.forEach(function(att) {
         messageHTML += '<li><a href="'+att.url+'">'+att.name+'</a></li>';
      });
      messageHTML += '</ul>';
    } catch(e) {}
  }
  
  // Throttle loop or dispatch if over 50. Keep simple for now.
  var successCount = sendCustomEmail(emails, subject, messageHTML, []);
  
  return successResponse(null, 'Đã gửi email đến ' + successCount + ' người dùng.');
}
