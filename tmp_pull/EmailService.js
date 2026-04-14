// ============================================================
// EmailService.gs - Email Templates & Sending Logic
// ============================================================

/**
 * Send an email using an HTML template and an inline logo.
 */
function sendEmailWithTemplate(options) {
  try {
    var subject = options.subject;
    var to = options.to;
    var templateName = options.templateName;
    var templateData = options.templateData || {};
    var attachments = options.attachments || [];
    
    // Load and evaluate template
    var template = HtmlService.createTemplateFromFile(templateName);
    
    // Pass config and data to template
    template.data = templateData;
    template.config = CONFIG;
    
    var htmlBody = template.evaluate().getContent();
    
    // Attempt to load inline logo from Drive if needed, but for simplicity
    // and due to Drive permission issues, we will include a public URL 
    // or base64 embedded in the HTML if possible. 
    // For this boilerplate, the template will simply use an <img> tag pointing to a public URL.
    // If strict CID is required, you'd fetch blob here and pass as inlineImages.
    
    var sendOptions = {
      htmlBody: htmlBody,
      name: CONFIG.APP_NAME,
      noReply: true
    };
    
    if (attachments.length > 0) {
      sendOptions.attachments = attachments;
    }
    
    MailApp.sendEmail(to, subject, '', sendOptions);
    
    // Log success
    logEmail(getActiveUserEmail() || CONFIG.ADMIN_EMAIL, to, subject, templateName, 'sent');
    return true;
  } catch (e) {
    logError('sendEmailWithTemplate', e);
    // Log failure
    logEmail(getActiveUserEmail() || CONFIG.ADMIN_EMAIL, options.to, options.subject, options.templateName, 'failed');
    return false;
  }
}

/**
 * Log email to Sheets
 */
function logEmail(from, to, subject, type, status) {
  try {
    insertRow(CONFIG.SHEETS.EMAIL_LOG, {
      logId: generateUUID(),
      fromEmail: from,
      toEmail: to,
      subject: subject,
      type: type,
      status: status,
      createdAt: now()
    });
  } catch(e) {}
}

/**
 * Send Welcome Email
 */
function sendWelcomeEmail(email, name) {
  var data = {
    title: 'Chào mừng bạn đến với ' + CONFIG.APP_NAME,
    name: name,
    message: 'Cảm ơn bạn đã đăng ký tài khoản. Hệ thống quản lý công việc chuyên nghiệp nhất.',
    actionUrl: CONFIG.APP_URL,
    actionText: 'Đăng nhập ngay'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.WELCOME,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Send Verification Email
 */
function sendVerifyEmail(email, name, token) {
  var verifyUrl = CONFIG.APP_URL + '?page=verify&token=' + token;
  
  var data = {
    title: 'Xác thực tài khoản',
    name: name,
    message: 'Vui lòng click vào nút bên dưới để xác thực địa chỉ email của bạn. Đường link này chỉ có hiệu lực 1 lần.',
    actionUrl: verifyUrl,
    actionText: 'Xác nhận Email'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.VERIFY,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Send Login Notification
 */
function sendLoginNotification(email, name) {
  var data = {
    title: 'Cảnh báo đăng nhập',
    name: name,
    message: 'Tài khoản của bạn vừa được đăng nhập thành công vào lúc ' + formatDate(now()) + '. Nếu không phải bạn thực hiện, vui lòng đổi mật khẩu ngay lập tức.',
    actionUrl: CONFIG.APP_URL,
    actionText: 'Truy cập ứng dụng'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.LOGIN_NOTIFY,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Send Password Change Confirmation
 */
function sendPasswordChangeConfirm(email, name) {
  var data = {
    title: 'Thay đổi mật khẩu thành công',
    name: name,
    message: 'Mật khẩu đăng nhập ứng dụng của bạn đã được thay đổi thành công.',
    actionUrl: CONFIG.APP_URL,
    actionText: 'Đăng nhập lại'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.PASSWORD_CHANGE,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Send Task Assignment Notification
 */
function sendTaskNotification(email, name, taskData, assignerName) {
  var data = {
    title: 'Bạn được giao việc mới',
    name: name,
    message: 'Bạn vừa được <b>' + assignerName + '</b> giao một công việc mới: <b>' + taskData.title + '</b>. Hạn chót: ' + formatDate(taskData.dueDate),
    actionUrl: CONFIG.APP_URL + '?page=tasks&id=' + taskData.taskId,
    actionText: 'Xem chi tiết công việc'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.TASK_ASSIGNED,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Send Group Invitation
 */
function sendGroupInvite(email, name, groupName, inviterName) {
  var data = {
    title: 'Lời mời tham gia nhóm',
    name: name,
    message: '<b>' + inviterName + '</b> vừa mời bạn tham gia vào nhóm làm việc: <b>' + groupName + '</b>.',
    actionUrl: CONFIG.APP_URL + '?page=groups',
    actionText: 'Xem nhóm'
  };
  
  return sendEmailWithTemplate({
    to: email,
    subject: CONFIG.EMAIL_SUBJECTS.GROUP_INVITE,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Auto-forward feedback to Admin
 */
function sendFeedbackToAdmin(feedbackData) {
  var data = {
    title: 'Phản hồi mới từ người dùng',
    name: 'Admin',
    message: 'Người dùng <b>' + feedbackData.userName + '</b> (' + feedbackData.userEmail + ') vừa gửi một phản hồi:<br><br><i>"' + feedbackData.content + '"</i>',
    actionUrl: CONFIG.APP_URL + '?page=admin',
    actionText: 'Vào Admin Panel'
  };
  
  return sendEmailWithTemplate({
    to: CONFIG.ADMIN_EMAIL,
    subject: '[Admin] Phản hồi mới từ ' + feedbackData.userName,
    templateName: 'EmailTemplates',
    templateData: data
  });
}

/**
 * Custom bulk email from Admin/Leader via Sheets/UI
 */
function sendCustomEmail(toEmails, subject, messageHTML, attachments) {
  var data = {
    title: 'Thông báo',
    name: 'Bạn',
    message: messageHTML, // Preserved HTML formatting
    actionUrl: CONFIG.APP_URL,
    actionText: 'Truy cập ứng dụng'
  };
  
  var successCount = 0;
  
  Array.isArray(toEmails) ? toEmails : [toEmails].forEach(function(email) {
    var res = sendEmailWithTemplate({
      to: email,
      subject: subject,
      templateName: 'EmailTemplates',
      templateData: data,
      attachments: attachments || []
    });
    if (res) successCount++;
  });
  
  return successCount;
}
