// ============================================================
// SheetDB.gs - Database abstraction layer using Google Sheets
// ============================================================

/**
 * Initialize all required sheets with headers
 */
function initializeSheets() {
  var ss = getSpreadsheet();
  var schemas = {
    [CONFIG.SHEETS.USERS]: [
      'userId','email','name','phone','address','dob','gender',
      'role','appPassword','avatar','isVerified','verifyToken',
      'passwordResetToken','passwordResetExpiry','createdAt','updatedAt','status','lastLogin'
    ],
    [CONFIG.SHEETS.TASKS]: [
      'taskId','title','description','status','priority',
      'createdBy','assignedTo','groupId','dueDate',
      'completedAt','createdAt','updatedAt','attachments'
    ],
    [CONFIG.SHEETS.GROUPS]: [
      'groupId','name','description','leaderId','createdBy','createdAt','updatedAt','status'
    ],
    [CONFIG.SHEETS.GROUP_MEMBERS]: [
      'groupId','userId','role','joinedAt'
    ],
    [CONFIG.SHEETS.MESSAGES]: [
      'messageId','groupId','senderId','senderName','content','attachments','createdAt','isDeleted'
    ],
    [CONFIG.SHEETS.FEEDBACK]: [
      'feedbackId','userId','userEmail','userName','content','rating','createdAt','emailSent'
    ],
    [CONFIG.SHEETS.EMAIL_LOG]: [
      'logId','fromEmail','toEmail','subject','type','status','createdAt'
    ],
    [CONFIG.SHEETS.SESSIONS]: [
      'sessionId','userId','email','loginAt','lastActive','isActive'
    ],
    [CONFIG.SHEETS.NOTIFICATIONS]: [
      'notifId','userId','type','title','message','isRead','createdAt','relatedId'
    ]
  };

  Object.keys(schemas).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = schemas[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Style header row
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1a73e8');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  
  return true;
}

/**
 * Get sheet by name, auto-init if missing
 */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  return sheet;
}

/**
 * Read all rows from a sheet as array of objects
 */
function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Get row by field value
 */
function getRowBy(sheetName, field, value) {
  var rows = getAllRows(sheetName);
  return rows.find(function(r) { return r[field] == value; }) || null;
}

/**
 * Get multiple rows matching filter
 */
function getRowsWhere(sheetName, filterFn) {
  return getAllRows(sheetName).filter(filterFn);
}

/**
 * Insert a new row
 */
function insertRow(sheetName, data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
    sheet.appendRow(row);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update a row where field === value
 */
function updateRowBy(sheetName, field, value, updates) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;
    var headers = data[0];
    var fieldIdx = headers.indexOf(field);
    if (fieldIdx === -1) return false;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][fieldIdx] == value) {
        Object.keys(updates).forEach(function(key) {
          var colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
            sheet.getRange(i + 1, colIdx + 1).setValue(updates[key]);
          }
        });
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a row where field === value
 */
function deleteRowBy(sheetName, field, value) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getSheet(sheetName);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;
    var headers = data[0];
    var fieldIdx = headers.indexOf(field);
    if (fieldIdx === -1) return false;
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][fieldIdx] == value) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Count rows matching filter
 */
function countRowsWhere(sheetName, filterFn) {
  return getAllRows(sheetName).filter(filterFn).length;
}

/**
 * Insert notification
 */
function addNotification(userId, type, title, message, relatedId) {
  insertRow(CONFIG.SHEETS.NOTIFICATIONS, {
    notifId:   generateUUID(),
    userId:    userId,
    type:      type,
    title:     title,
    message:   message,
    isRead:    false,
    createdAt: now(),
    relatedId: relatedId || ''
  });
}

/**
 * Get unread notifications for user
 */
function getUnreadNotifications(userId) {
  return getRowsWhere(CONFIG.SHEETS.NOTIFICATIONS, function(r) {
    return r.userId === userId && !r.isRead;
  }).sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
}

/**
 * Mark notification as read
 */
function markNotificationRead(notifId) {
  return updateRowBy(CONFIG.SHEETS.NOTIFICATIONS, 'notifId', notifId, { isRead: true });
}
