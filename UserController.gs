// ============================================================
// UserController.gs - User Profile Management
// ============================================================

/**
 * Get current user profile
 */
function getUserProfile() {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  return successResponse(sessionRes.data);
}

/**
 * Update user profile
 */
function updateProfile(data) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Validate input
  if (!data.name || !data.phone) {
    return errorResponse('Tên và số điện thoại không được để trống.');
  }
  
  if (!isValidPhone(data.phone)) {
    return errorResponse('Số điện thoại không hợp lệ.');
  }
  
  var updates = {
    name: sanitize(data.name),
    phone: sanitize(data.phone),
    address: sanitize(data.address || ''),
    gender: sanitize(data.gender || 'other'),
    updatedAt: now()
  };
  
  if (data.dob) {
    updates.dob = parseDate(data.dob);
  }
  
  var success = updateRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId, updates);
  
  if (success) {
    // Return updated user
    var updatedUser = getRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId);
    delete updatedUser.appPassword;
    delete updatedUser.verifyToken;
    delete updatedUser.passwordResetToken;
    return successResponse(updatedUser, 'Cập nhật hồ sơ thành công.');
  }
  
  return errorResponse('Lỗi hệ thống khi cập nhật hồ sơ.');
}

/**
 * Change App Password
 */
function changePassword(oldPassword, newPassword) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'userId', sessionRes.data.userId);
  
  if (user.appPassword !== hashPassword(oldPassword)) {
    return errorResponse('Mật khẩu cũ không chính xác.');
  }
  
  if (!newPassword || newPassword.length < 6) {
    return errorResponse('Mật khẩu mới phải có ít nhất 6 ký tự.');
  }
  
  var success = updateRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId, {
    appPassword: hashPassword(newPassword),
    updatedAt: now()
  });
  
  if (success) {
    try {
      sendPasswordChangeConfirm(user.email, user.name);
    } catch(e) {
      logError('changePassword', e);
    }
    return successResponse(null, 'Đổi mật khẩu thành công.');
  }
  
  return errorResponse('Lỗi hệ thống khi đổi mật khẩu.');
}

/**
 * Upload Avatar to Drive and update User Profile
 */
function uploadAvatar(fileDataStr) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  try {
    var fileData = JSON.parse(fileDataStr); // { data: base64, mimeType: string, filename: string }
    
    // Decode base64
    var base64Data = fileData.data.split(',')[1] || fileData.data;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, "avatar_" + user.userId + "_" + fileData.filename);
    
    var folder = getAttachmentsFolder();
    var file = folder.createFile(blob);
    
    // Make file accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    var fileUrl = file.getDownloadUrl(); // Or getUrl()
    
    // Update Profile
    updateRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId, { 
      avatar: fileId,
      updatedAt: now()
    });
    
    return successResponse({ fileId: fileId, url: fileUrl }, 'Tải ảnh đại diện thành công.');
  } catch(e) {
    logError('uploadAvatar', e);
    return errorResponse('Không thể tải ảnh: ' + e.message);
  }
}

/**
 * Search users by email or name (For assigning tasks, adding to groups)
 */
function searchUsers(query) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  if (!query || query.length < 2) return successResponse([]);
  
  var q = query.toLowerCase();
  
  var users = getRowsWhere(CONFIG.SHEETS.USERS, function(r) {
    return r.status === 'active' && 
           (r.email.toLowerCase().indexOf(q) > -1 || r.name.toLowerCase().indexOf(q) > -1);
  });
  
  // Map to safe objects (no passwords)
  var safeUsers = users.map(function(u) {
    return {
      userId: u.userId,
      email: u.email,
      name: u.name,
      avatar: u.avatar
    };
  });
  
  return successResponse(safeUsers);
}

/**
 * Get ALL notifications for the current user (read + unread)
 */
function getAllNotifications() {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;

  var userId = sessionRes.data.userId;

  var notifications = getRowsWhere(CONFIG.SHEETS.NOTIFICATIONS, function(r) {
    return r.userId === userId;
  }).sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return successResponse(notifications);
}

/**
 * Mark ALL notifications as read for the current user
 */
function markAllNotificationsRead() {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;

  var userId = sessionRes.data.userId;

  var unread = getRowsWhere(CONFIG.SHEETS.NOTIFICATIONS, function(r) {
    return r.userId === userId && !r.isRead;
  });

  unread.forEach(function(n) {
    updateRowBy(CONFIG.SHEETS.NOTIFICATIONS, 'notifId', n.notifId, { isRead: true });
  });

  return successResponse({ updated: unread.length }, 'Đã đánh dấu ' + unread.length + ' thông báo là đã đọc.');
}

