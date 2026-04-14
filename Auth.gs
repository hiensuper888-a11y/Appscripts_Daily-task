// ============================================================
// Auth.gs - Authentication & Session Management
// ============================================================

/**
 * Login user
 */
function login(email, password) {
  if (!email) return errorResponse('Vui lòng nhập Email đăng nhập.');
  
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
  
  user.sessionId = sessionId;
  
  // Safe stringify and parse to strip Date objects
  user = safeParse(safeStringify(user));
  
  return successResponse(user, 'Đăng nhập thành công');
}

/**
 * Login directly via active Google account
 */
function loginWithGoogle() {
  var email = getActiveUserEmail();
  if (!email) return errorResponse('Không thể tải email Google. Hãy cấp quyền truy cập.');
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (!user) return errorResponse('Tài khoản chưa được đăng ký. Xin qua tab Đăng ký mới.');
  if (user.status !== 'active') return errorResponse('Tài khoản đã bị vô hiệu hóa.');
  
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
  
  try {
     sendLoginNotification(email, user.name);
  } catch(e) {
     logError('loginWithGoogle', 'Failed to send login notification: ' + e);
  }
  
  delete user.appPassword;
  delete user.verifyToken;
  delete user.passwordResetToken;
  
  user.sessionId = sessionId;
  
  // Safe stringify and parse to strip Date objects
  user = safeParse(safeStringify(user));
  
  return successResponse(user, 'Đăng nhập Google thành công');
}

/**
 * Register new user
 */
function registerUser(profileData) {
  var email = sanitize(profileData.email);
  if (!email) return errorResponse('Vui lòng cung cấp email hợp lệ.');
  
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
function getUserSession(sid) {
  if (!sid) return errorResponse('No session ID', 'NO_SESSION');
  
  // Find active session
  var session = getRowBy(CONFIG.SHEETS.SESSIONS, 'sessionId', sid);
  if (!session || !session.isActive) return errorResponse('Session invalid or expired', 'NO_SESSION');
  
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', session.email);
  if (!user) return errorResponse('User not found', 'NOT_REGISTERED');
  if (user.status !== 'active') return errorResponse('Account inactive', 'INACTIVE');
  
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
  
  user = safeParse(safeStringify(user));
  
  return successResponse(user, 'Session valid');
}

/**
 * Logout
 */
function logout(sid) {
  if (!sid) return successResponse();
  
  updateRowBy(CONFIG.SHEETS.SESSIONS, 'sessionId', sid, { isActive: false });
  
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
function checkAuthStatus(sid) {
  if (!sid) return { status: 'NEEDS_LOGIN', email: null };
  
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) {
    return { status: 'NEEDS_LOGIN', email: null };
  }
  
  return { status: 'AUTHENTICATED', email: sessionRes.data.email, user: sessionRes.data };
}
