// ============================================================
// ChatController.gs - Group Messaging System
// ============================================================

/**
 * Get messages for a specific group
 */
function getMessages(sid, groupId, limit) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  limit = limit || CONFIG.CHAT_PAGE_SIZE;
  
  // Verify membership
  var hasAccess = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === user.userId;
  });
  
  if (!hasAccess && user.role !== 'admin') {
    return errorResponse('Bạn không có quyền xem tin nhắn nhóm này');
  }
  
  var messages = getRowsWhere(CONFIG.SHEETS.MESSAGES, function(m) {
    return m.groupId === groupId && m.isDeleted !== true;
  });
  
  // Sort by time ASC
  messages.sort(function(a, b) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  
  // Take last N messages
  if (messages.length > limit) {
    messages = messages.slice(messages.length - limit);
  }
  
  // Parse attachments
  messages.forEach(function(m) {
    try {
      m.attachments = JSON.parse(m.attachments || '[]');
    } catch(e) {
      m.attachments = [];
    }
  });
  
  // Enrich with sender details
  var allUsers = getAllRows(CONFIG.SHEETS.USERS);
  var userMap = {};
  allUsers.forEach(function(u) { userMap[u.userId] = { name: u.name, avatar: u.avatar }; });
  
  messages.forEach(function(m) {
    var s = userMap[m.senderId] || { name: 'Unknown', avatar: '' };
    m.senderName = s.name;
    m.senderAvatar = s.avatar;
    m.isMine = m.senderId === user.userId;
  });
  
  return successResponse(messages);
}

/**
 * Send a new message to a group
 */
function sendMessage(sid, groupId, content, attachmentsStr) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Verify membership
  var hasAccess = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === user.userId;
  });
  
  if (!hasAccess && user.role !== 'admin') {
    return errorResponse('Bạn không có quyền nhắn tin trong nhóm này');
  }
  
  var messageId = generateUUID();
  
  var newMessage = {
    messageId: messageId,
    groupId: groupId,
    senderId: user.userId,
    senderName: user.name,
    content: sanitize(content),
    attachments: attachmentsStr || '[]',
    createdAt: now(),
    isDeleted: false
  };
  
  var success = insertRow(CONFIG.SHEETS.MESSAGES, newMessage);
  
  if (success) {
    return successResponse(newMessage);
  }
  
  return errorResponse('Không thể gửi tin nhắn');
}

/**
 * Upload chat attachment
 */
function uploadChatAttachment(sid, fileDataStr) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  try {
    var fileData = JSON.parse(fileDataStr);
    var base64Data = fileData.data.split(',')[1] || fileData.data;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileData.mimeType, "chat_" + now().getTime() + "_" + fileData.filename);
    
    var folder = getAttachmentsFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Determine type rough estimate
    var mt = fileData.mimeType.toLowerCase();
    var type = 'file';
    if (mt.indexOf('image/') === 0) type = 'image';
    if (mt.indexOf('video/') === 0) type = 'video';
    
    var resultObj = {
      id: file.getId(),
      url: file.getDownloadUrl(),
      name: fileData.filename,
      type: type,
      mimeType: fileData.mimeType
    };
    
    return successResponse(resultObj);
  } catch(e) {
    logError('uploadChatAttachment', e);
    return errorResponse('Không thể tải file: ' + e.message);
  }
}
