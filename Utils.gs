// ============================================================
// Utils.gs - Utility functions
// ============================================================

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Simple hash function for passwords (SHA-256 via Utilities)
 */
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + CONFIG.SALT,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

/**
 * Format date to Vietnamese locale string
 */
function formatDate(date) {
  if (!date) return '';
  var d = new Date(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm');
}

/**
 * Format date only
 */
function formatDateOnly(date) {
  if (!date) return '';
  var d = new Date(date);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Parse date string dd/MM/yyyy
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
}

/**
 * Get current timestamp
 */
function now() {
  return new Date();
}

/**
 * Sanitize string input
 */
function sanitize(str) {
  if (!str) return '';
  return String(str).trim().replace(/[<>]/g, '');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Validate Vietnamese phone number
 */
function isValidPhone(phone) {
  var re = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
  return re.test(String(phone).replace(/\s/g, ''));
}

/**
 * Generate a random token for email verification
 */
function generateToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Success response wrapper
 */
function successResponse(data, message) {
  return {
    success: true,
    data: data || null,
    message: message || 'Thành công'
  };
}

/**
 * Error response wrapper
 */
function errorResponse(message, code) {
  return {
    success: false,
    data: null,
    message: message || 'Có lỗi xảy ra',
    code: code || 'ERROR'
  };
}

/**
 * Log error to console
 */
function logError(fnName, error) {
  console.error('[ERROR] ' + fnName + ': ' + error.toString());
}

/**
 * Check if value is empty
 */
function isEmpty(val) {
  return val === null || val === undefined || val === '' || val === false;
}

/**
 * Get start of day
 */
function startOfDay(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
function endOfDay(date) {
  var d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start of month
 */
function startOfMonth(date) {
  var d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Get end of month
 */
function endOfMonth(date) {
  var d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * JSON stringify safe
 */
function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch(e) {
    return '{}';
  }
}

/**
 * JSON parse safe
 */
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch(e) {
    return null;
  }
}

/**
 * Paginate array
 */
function paginate(arr, page, pageSize) {
  page = page || 1;
  pageSize = pageSize || 20;
  var start = (page - 1) * pageSize;
  return {
    data: arr.slice(start, start + pageSize),
    total: arr.length,
    page: page,
    pageSize: pageSize,
    totalPages: Math.ceil(arr.length / pageSize)
  };
}
