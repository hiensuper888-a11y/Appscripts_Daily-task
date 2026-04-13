// ============================================================
// ReportController.gs - Statistics and Exporting Logic
// ============================================================

/**
 * Get report data (Personal or Group)
 */
function getReportData(type, id, timeRange) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  var tasks = [];
  
  // 1. Fetch relevant tasks
  if (type === 'personal') {
    tasks = getRowsWhere(CONFIG.SHEETS.TASKS, function(t) {
      return t.assignedTo === user.userId;
    });
  } else if (type === 'group' && id) {
    // Check if user has access to group
    var hasAccess = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
      return m.groupId === id && m.userId === user.userId;
    });
    if (!hasAccess && user.role !== 'admin') return errorResponse('Không có quyền truy cập nhóm này');
    
    tasks = getRowsWhere(CONFIG.SHEETS.TASKS, function(t) {
      return t.groupId === id;
    });
  } else {
    return errorResponse('Tham số không hợp lệ');
  }
  
  // 2. Filter by timeRange (created or due in that range)
  // timeRange format assumed: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } or predefined strings like 'this_month'
  var startDate = null;
  var endDate = null;
  var nowObj = now();
  
  if (typeof timeRange === 'string') {
    if (timeRange === 'this_week') {
      startDate = new Date(nowObj);
      startDate.setDate(nowObj.getDate() - nowObj.getDay());
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (timeRange === 'this_month') {
      startDate = startOfMonth(nowObj);
      endDate = endOfMonth(nowObj);
    } else if (timeRange === 'this_year') {
      startDate = new Date(nowObj.getFullYear(), 0, 1);
      endDate = new Date(nowObj.getFullYear(), 11, 31, 23, 59, 59);
    }
  } else if (timeRange && timeRange.start && timeRange.end) {
    startDate = startOfDay(timeRange.start);
    endDate = endOfDay(timeRange.end);
  }
  
  if (startDate && endDate) {
    tasks = tasks.filter(function(t) {
      var d = t.createdAt ? new Date(t.createdAt) : null;
      return d && d >= startDate && d <= endDate;
    });
  }
  
  // Also check overdue
  tasks.forEach(function(t) {
    if ((t.status === 'pending' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < nowObj) {
      t.status = 'overdue';
    }
  });
  
  // 3. Process aggregates 
  // Stats
  var stats = {
    pending: tasks.filter(function(t) { return t.status === 'pending'; }).length,
    in_progress: tasks.filter(function(t) { return t.status === 'in_progress'; }).length,
    completed: tasks.filter(function(t) { return t.status === 'completed'; }).length,
    overdue: tasks.filter(function(t) { return t.status === 'overdue'; }).length,
    total: tasks.length
  };
  
  // Time-series (Bar chart data) - Group by Date created
  var timeSeries = {};
  tasks.forEach(function(t) {
    var d = t.createdAt ? formatDateOnly(t.createdAt) : 'Unknown';
    if (!timeSeries[d]) timeSeries[d] = 0;
    timeSeries[d]++;
  });
  
  // 4. Enrich tasks with names for tabular display
  var allUsers = getAllRows(CONFIG.SHEETS.USERS);
  var userMap = {};
  allUsers.forEach(function(u) { userMap[u.userId] = u.name; });
  
  tasks.forEach(function(t) {
    t.assignedToName = userMap[t.assignedTo] || 'Unknown';
    t.createdByName = userMap[t.createdBy] || 'Unknown';
  });
  
  return successResponse({
    stats: stats,
    timeSeries: timeSeries,
    tasks: tasks
  });
}

/**
 * Export report to Google Sheets (+ auto convert to Excel if requested)
 */
function exportReport(reportDataStr, format) {
  var sessionRes = getUserSession();
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  try {
    var reportData = JSON.parse(reportDataStr);
    var timestampStr = Utilities.formatDate(now(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmm');
    var fileName = "ThongKe_CongViec_" + timestampStr;
    
    // Create new Google Sheet in the specific folder
    var folder = getAttachmentsFolder();
    var newFile = SpreadsheetApp.create(fileName);
    
    // Move to folder (requires DriveApp)
    var driveFile = DriveApp.getFileById(newFile.getId());
    driveFile.moveTo(folder);
    
    var ss = newFile;
    var sheet = ss.getActiveSheet();
    sheet.setName("Báo cáo Nhiệm vụ");
    
    // 1. Write Header Data & Stats
    sheet.getRange(1, 1).setValue("BÁO CÁO THỐNG KÊ CÔNG VIỆC").setFontWeight("bold").setFontSize(14);
    sheet.getRange(2, 1).setValue("Ngày xuất: " + formatDate(now()));
    sheet.getRange(3, 1).setValue("Người xuất: " + user.name + " (" + user.email + ")");
    
    sheet.getRange(5, 1).setValue("TỔNG QUAN").setFontWeight("bold");
    sheet.getRange(6, 1, 1, 5).setValues([["Tổng", "Hoàn thành", "Đang làm", "Chờ xử lý", "Quá hạn"]]).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.getRange(7, 1, 1, 5).setValues([
      [reportData.stats.total, reportData.stats.completed, reportData.stats.in_progress, reportData.stats.pending, reportData.stats.overdue]
    ]);
    
    // Create Pie Chart in Sheet
    var chartBuilder = sheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(sheet.getRange(6, 2, 2, 4)) // Headers
        // Note: Google Sheets API expects data structure a bit differently for charts depending on orientation
        // A better approach is to put labels in a column, values in next column
        .setOption('title', 'Tỷ lệ hoàn thành nhiệm vụ')
        .setPosition(5, 7, 0, 0)
        .setOption('width', 400).setOption('height', 300);
        
    // Let's restructure stats for better chart embedding:
    sheet.getRange(10, 1).setValue("Trạng thái").setFontWeight("bold");
    sheet.getRange(10, 2).setValue("Số lượng").setFontWeight("bold");
    sheet.getRange(11, 1, 4, 2).setValues([
      ["Hoàn thành", reportData.stats.completed],
      ["Đang làm", reportData.stats.in_progress],
      ["Chờ xử lý", reportData.stats.pending],
      ["Quá hạn", reportData.stats.overdue]
    ]);
    
    var pieChart = sheet.newChart().setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange("A10:B14"))
      .setPosition(1, 7, 0, 0)
      .setOption('title', 'Trạng thái Công việc')
      .build();
    sheet.insertChart(pieChart);
    
    // 2. Write Details Table
    var startRow = 17;
    sheet.getRange(startRow, 1).setValue("CHI TIẾT NHIỆM VỤ").setFontWeight("bold");
    
    var headers = ["Tiêu đề", "Trạng thái", "Độ ưu tiên", "Người giao", "Được giao", "Ngày tạo", "Hạn chót"];
    var headerRange = sheet.getRange(startRow + 1, 1, 1, headers.length);
    headerRange.setValues([headers]).setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
    
    if (reportData.tasks && reportData.tasks.length > 0) {
      var rows = reportData.tasks.map(function(t) {
        return [
          t.title,
          t.status,
          t.priorityLabel || t.priority,
          t.createdByName,
          t.assignedToName,
          formatDateOnly(t.createdAt),
          formatDateOnly(t.dueDate)
        ];
      });
      sheet.getRange(startRow + 2, 1, rows.length, headers.length).setValues(rows);
      
      // Auto resize inner columns
      for (var col = 1; col <= headers.length; col++) {
        sheet.autoResizeColumn(col);
      }
    }
    
    if (format === 'excel') {
      // Need to use urlfetch to get export link
      var url = "https://docs.google.com/spreadsheets/d/" + newFile.getId() + "/export?format=xlsx";
      var token = ScriptApp.getOAuthToken();
      var response = UrlFetchApp.fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      // Save Excel blob to folder
      var excelBlob = response.getBlob().setName(fileName + ".xlsx");
      var excelFile = folder.createFile(excelBlob);
      
      // For immediate user download in SPA, we return the Google Drive download url or a custom download script URL.
      // Easiest is returning the drive download link
      // Optionally delete the temporary Google Sheet
      newFile.setTrashed(true);
      
      return successResponse({
        url: excelFile.getDownloadUrl(),
        isExcel: true,
        fileName: fileName + ".xlsx"
      });
    }
    
    // Google Sheet Format
    return successResponse({
      url: newFile.getUrl(),
      isExcel: false,
      fileName: fileName
    });
    
  } catch(e) {
    logError('exportReport', e.toString());
    return errorResponse('Không thể xuất báo cáo: ' + e.message);
  }
}
