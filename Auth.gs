// ============================================================
// Auth.gs - Authentication & Session Management
// ============================================================

/**
 * Login user
 */
function login(password) {
  var email = getActiveUserEmail();
  if (!email) return errorResponse('Không thể lấy được email Google Account. Vui lòng đăng nhập Google.');
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (!user) return errorResponse('Tài khoản chưa được đăng ký. Vui lòng chuyển sang tab Đăng ký.');
  
  if (user.status !== 'active') return errorResponse('Tài khoản đã bị vô hiệu hóa.');
  if (user.appPassword !== hashPassword(password)) return errorResponse('Mật khẩu không chính xác.');
  
  // Create session
  var sessionId = generateUUID();
  insertRow(CONFIG.SHEETS.SESSIONS, {
    sessionId: sessionId,
    userId: user.userId,
    email: email,
    loginAt: now(),
    lastActive: now(),
    isActive: true
  });
  
  updateRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId, { lastLogin: now() });
  
  // Send login notification loosely asynchronously in actual implementation
  // EmailService.gs required
  try {
     sendLoginNotification(email, user.name);
  } catch(e) {
     logError('login', 'Failed to send login notification: ' + e);
  }
  
  // Sanitize user object
  delete user.appPassword;
  delete user.verifyToken;
  delete user.passwordResetToken;
  
  return successResponse(user, 'Đăng nhập thành công');
}

/**
 * Register new user
 */
function registerUser(profileData) {
  var email = getActiveUserEmail();
  if (!email) return errorResponse('Không thể lấy được email Google. Vui lòng đăng nhập Google Account.');
  
  var existingUser = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (existingUser) return errorResponse('Email này đã được đăng ký. Vui lòng đăng nhập.');
  
  if (!profileData.name || !profileData.phone || !profileData.password) {
    return errorResponse('Vui lòng điền đầy đủ thông tin bắt buộc.');
  }
  
  if (!isValidPhone(profileData.phone)) {
    return errorResponse('Số điện thoại không hợp lệ.');
  }

  var token = generateToken();
  var userId = generateUUID();
  
  var newUser = {
    userId: userId,
    email: email,
    name: sanitize(profileData.name),
    phone: sanitize(profileData.phone),
    address: sanitize(profileData.address || ''),
    dob: profileData.dob ? parseDate(profileData.dob) : '',
    gender: sanitize(profileData.gender || 'other'),
    role: CONFIG.ROLES.USER, // Default role
    appPassword: hashPassword(profileData.password),
    avatar: '',
    isVerified: false,
    verifyToken: token,
    createdAt: now(),
    updatedAt: now(),
    status: 'active'
  };
  
  var inserted = insertRow(CONFIG.SHEETS.USERS, newUser);
  
  if (!inserted) return errorResponse('Lỗi hệ thống khi tạo tài khoản. Vui lòng thử lại.');
  
  try {
     sendVerifyEmail(email, newUser.name, token);
     sendWelcomeEmail(email, newUser.name);
  } catch(e) {
     logError('registerUser', 'Failed to send welcome/verify email: ' + e);
  }
  
  return successResponse(null, 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
}

/**
 * Check if the active Google user has a valid active session
 */
function getUserSession() {
  var email = getActiveUserEmail();
  if (!email) return errorResponse('No Google account', 'NO_ACCOUNT');
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (!user) return errorResponse('User not found', 'NOT_REGISTERED');
  if (user.status !== 'active') return errorResponse('Account inactive', 'INACTIVE');
  
  // Find active session
  var session = getRowsWhere(CONFIG.SHEETS.SESSIONS, function(r) {
    return r.email === email && r.isActive === true;
  }).sort(function(a, b) {
    return new Date(b.loginAt) - new Date(a.loginAt); // Latest first
  })[0];
  
  if (!session) return errorResponse('No active session', 'NO_SESSION');
  
  // Check session expiry
  var lastActive = new Date(session.lastActive);
  var diffHours = (new Date() - lastActive) / (1000 * 60 * 60);
  
  if (diffHours > CONFIG.SESSION_EXPIRY_HOURS) {
    updateRowBy(CONFIG.SHEETS.SESSIONS, 'sessionId', session.sessionId, { isActive: false });
    return errorResponse('Session expired', 'EXPIRED');
  }
  
  // Update last active
  updateRowBy(CONFIG.SHEETS.SESSIONS, 'sessionId', session.sessionId, { lastActive: now() });
  
  // Sanitize user
  delete user.appPassword;
  delete user.verifyToken;
  delete user.passwordResetToken;
  
  return successResponse(user, 'Session valid');
}

/**
 * Logout
 */
function logout() {
  var email = getActiveUserEmail();
  if (!email) return successResponse();
  
  // Deactivate all sessions for this user
  var sessions = getRowsWhere(CONFIG.SHEETS.SESSIONS, function(r) {
    return r.email === email && r.isActive === true;
  });
  
  sessions.forEach(function(session) {
    updateRowBy(CONFIG.SHEETS.SESSIONS, 'sessionId', session.sessionId, { isActive: false });
  });
  
  return successResponse(null, 'Đăng xuất thành công');
}

/**
 * Verify email with token
 */
function verifyEmail(token) {
  if (!token) return errorResponse('Token không hợp lệ.');
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'verifyToken', token);
  if (!user) return errorResponse('Token đã hết hạn hoặc không tồn tại.');
  
  if (user.isVerified) return successResponse(null, 'Tài khoản đã được xác thực trước đó.');
  
  updateRowBy(CONFIG.SHEETS.USERS, 'userId', user.userId, { 
    isVerified: true,
    verifyToken: ''
  });
  
  return successResponse(null, 'Xác thực tài khoản thành công!');
}

/**
 * Check User Auth Status for UI init
 */
function checkAuthStatus() {
  var email = getActiveUserEmail();
  if (!email) {
    return { status: 'NO_GOOGLE_ACCOUNT', email: null };
  }
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (!user) {
    return { status: 'NOT_REGISTERED', email: email };
  }
  
  var sessionRes = getUserSession();
  if (!sessionRes.success) {
    return { status: 'NEEDS_LOGIN', email: email };
  }
  
  return { status: 'AUTHENTICATED', email: email, user: sessionRes.data };
}
