// ============================================================
// TaskController.gs - Task Management CRUD and Logic
// ============================================================

/**
 * Get tasks for user (Personal + Group tasks assigned to them)
 */
function getMyTasks(sid, filters) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  var filterStatus = filters && filters.status ? filters.status : 'all';
  
  var tasks = getRowsWhere(CONFIG.SHEETS.TASKS, function(r) {
    var isMine = r.assignedTo === user.userId || r.createdBy === user.userId;
    var matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    
    // Auto mark overdue on retrieval if needed (Better done in a trigger, but safe here too)
    if (r.status === CONFIG.TASK_STATUS.PENDING || r.status === CONFIG.TASK_STATUS.IN_PROGRESS) {
      if (r.dueDate && new Date(r.dueDate) < new Date()) {
        r.status = CONFIG.TASK_STATUS.OVERDUE;
        // Background async update (ignoring return)
        try { updateRowBy(CONFIG.SHEETS.TASKS, 'taskId', r.taskId, {status: CONFIG.TASK_STATUS.OVERDUE}); } catch(e){}
      }
    }
    
    return isMine && matchesStatus;
  });
  
  // Sort by due date ASC
  tasks.sort(function(a, b) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
  
  // Enrich with usernames
  var allUsers = getAllRows(CONFIG.SHEETS.USERS);
  var userMap = {};
  allUsers.forEach(function(u) { userMap[u.userId] = u.name; });
  
  tasks.forEach(function(t) {
    t.assignedToName = userMap[t.assignedTo] || 'Unknown';
    t.createdByName = userMap[t.createdBy] || 'Unknown';
    
    // Determine priority color
    t.priorityLabel = t.priority === 'urgent' ? 'Khẩn cấp' :
                      t.priority === 'high' ? 'Cao' :
                      t.priority === 'medium' ? 'Trung bình' : 'Thấp';
  });
  
  return successResponse(tasks);
}

/**
 * Get summary stats for Dashboard
 */
function getDashboardStats(sid) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  var myTasks = getRowsWhere(CONFIG.SHEETS.TASKS, function(r) {
    return r.assignedTo === user.userId;
  });
  
  // Also count overdue dynamically
  myTasks.forEach(function(t) {
    if ((t.status === 'pending' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < new Date()) {
      t.status = 'overdue';
    }
  });
  
  var stats = {
    total: myTasks.length,
    pending: myTasks.filter(function(t) { return t.status === 'pending'; }).length,
    in_progress: myTasks.filter(function(t) { return t.status === 'in_progress'; }).length,
    completed: myTasks.filter(function(t) { return t.status === 'completed'; }).length,
    overdue: myTasks.filter(function(t) { return t.status === 'overdue'; }).length,
    
    // Next 3 upcoming tasks
    upcoming: myTasks.filter(function(t) { 
      return t.status !== 'completed' && t.dueDate;
    }).sort(function(a,b) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }).slice(0, 5)
  };
  
  return successResponse(stats);
}

/**
 * Create new Task
 */
function createTask(sid, data) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  var taskId = generateUUID();
  var isGroupTask = data.groupId && data.groupId !== '';
  var assignedTo = data.assignedTo || user.userId;
  
  var newTask = {
    taskId: taskId,
    title: sanitize(data.title),
    description: sanitize(data.description || ''),
    status: CONFIG.TASK_STATUS.PENDING,
    priority: data.priority || CONFIG.TASK_PRIORITY.MEDIUM,
    createdBy: user.userId,
    assignedTo: assignedTo,
    groupId: isGroupTask ? data.groupId : '',
    dueDate: data.dueDate ? new Date(data.dueDate) : '',
    completedAt: '',
    createdAt: now(),
    updatedAt: now(),
    attachments: '[]' // Array of Drive File IDs
  };
  
  var success = insertRow(CONFIG.SHEETS.TASKS, newTask);
  
  if (success) {
    // If assigned to someone else, send email and notification
    if (assignedTo !== user.userId) {
      var assignee = getRowBy(CONFIG.SHEETS.USERS, 'userId', assignedTo);
      if (assignee) {
        addNotification(assignedTo, 'task_assigned', 'Nhiệm vụ mới', user.name + ' đã giao cho bạn nhiệm vụ: ' + newTask.title, taskId);
        try {
          sendTaskNotification(assignee.email, assignee.name, newTask, user.name);
        } catch(e) { logError('createTask', 'Task email failed: ' + e); }
      }
    }
    
    return successResponse(newTask, 'Tạo công việc thành công');
  }
  
  return errorResponse('Không thể tạo công việc');
}

/**
 * Update Task Status (Drag and drop)
 */
function updateTaskStatus(sid, taskId, newStatus) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  var task = getRowBy(CONFIG.SHEETS.TASKS, 'taskId', taskId);
  
  if (!task) return errorResponse('Không tìm thấy task');
  
  // Simple auth check
  if (task.assignedTo !== user.userId && task.createdBy !== user.userId) {
    // Check if user is group leader
    var isLeader = false;
    if (task.groupId) {
      var member = getRowsWhere(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
        return m.groupId === task.groupId && m.userId === user.userId;
      })[0];
      if (member && member.role === 'leader') isLeader = true;
    }
    if (!isLeader && user.role !== 'admin') return errorResponse('Bạn không có quyền cập nhật task này');
  }
  
  var updates = {
    status: newStatus,
    updatedAt: now()
  };
  
  if (newStatus === CONFIG.TASK_STATUS.COMPLETED) {
    updates.completedAt = now();
  } else {
    updates.completedAt = '';
  }
  
  var success = updateRowBy(CONFIG.SHEETS.TASKS, 'taskId', taskId, updates);
  
  if (success) {
    // Notify creator if assignee completes it
    if (newStatus === CONFIG.TASK_STATUS.COMPLETED && task.createdBy !== user.userId) {
      addNotification(task.createdBy, 'task_completed', 'Hoàn thành', user.name + ' đã hoàn thành nhiệm vụ: ' + task.title, taskId);
    }
    return successResponse(null, 'Cập nhật trạng thái thành công');
  }
  
  return errorResponse('Lỗi hệ thống');
}

/**
 * Delete task
 */
function deleteTask(sid, taskId) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  var task = getRowBy(CONFIG.SHEETS.TASKS, 'taskId', taskId);
  
  if (!task) return errorResponse('Không tìm thấy task');
  if (task.createdBy !== user.userId && user.role !== 'admin') {
    return errorResponse('Chỉ người tạo mới có quyền xóa task này');
  }
  
  var success = deleteRowBy(CONFIG.SHEETS.TASKS, 'taskId', taskId);
  if (success) return successResponse(null, 'Đã xóa công việc');
  return errorResponse('Không thể xóa công việc');
}
