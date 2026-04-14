// ============================================================
// Code.gs - Entry point and Web App routers
// ============================================================

/**
 * Handle GET requests - Serve the web app HTML
 */
function doGet(e) {
  // Ensure basic configuration
  var scriptUrl = ScriptApp.getService().getUrl();
  setWebAppUrl(scriptUrl);
  
  // Initialize sheets if they don't exist
  try {
    initializeSheets();
  } catch (err) {
    console.error("Error initializing sheets: " + err);
  }
  
  // Setup routing based on query params (e.g., ?page=login)
  var page = e.parameter.page || 'index';
  var template;
  
  // Check auth state from explicit SID passed in URL
  var sid = e.parameter.sid || '';
  var sessionResult = getUserSession(sid);
  
  if (!sessionResult.success) {
    // Force login if not authenticated
    // Unless trying to verify email
    if (page === 'verify') {
      return HtmlService.createTemplateFromFile('VerifyView')
        .evaluate()
        .setTitle(CONFIG.APP_NAME + ' - Xác nhận Email')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
    template = HtmlService.createTemplateFromFile('Login');
    template.data = {
      userEmail: '' // Decoupled from Google Account
    };
    return template.evaluate()
      .setTitle(CONFIG.APP_NAME + ' - Đăng nhập')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  // User is authenticated, serve the main app (SPA)
  template = HtmlService.createTemplateFromFile('index');
  template.user = sessionResult.data;
  
  return template.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper to include HTML files within templates
 * Usage in HTML: <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get active Google account email
 */
function getActiveUserEmail() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    // For testing/development where active user might be empty
    email = Session.getEffectiveUser().getEmail();
  }
  return email;
}

/**
 * Initialize test data (Optional, for admin)
 */
function initializeAdminData() {
  var email = getActiveUserEmail();
  var user = getRowBy(CONFIG.SHEETS.USERS, 'email', email);
  if (!user) {
    insertRow(CONFIG.SHEETS.USERS, {
      userId: generateUUID(),
      email: email,
      name: 'System Admin',
      phone: '',
      address: '',
      role: CONFIG.ROLES.ADMIN,
      isVerified: true,
      createdAt: now(),
      updatedAt: now(),
      status: 'active'
    });
  } else if (user.role !== CONFIG.ROLES.ADMIN) {
    updateRowBy(CONFIG.SHEETS.USERS, 'email', email, { role: CONFIG.ROLES.ADMIN });
  }
  return "Admin initialized for " + email;
}
