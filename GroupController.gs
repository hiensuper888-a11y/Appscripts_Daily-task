// ============================================================
// GroupController.gs - Group and Member Management
// ============================================================

/**
 * Get all groups that the user is a part of
 */
function getMyGroups(sid) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Find member records
  var myMemberships = getRowsWhere(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.userId === user.userId;
  });
  
  var groupIds = myMemberships.map(function(m) { return m.groupId; });
  
  // Get group details
  var groups = getRowsWhere(CONFIG.SHEETS.GROUPS, function(g) {
    return groupIds.indexOf(g.groupId) > -1 && g.status !== 'deleted';
  });
  
  // Enrich with member count and role
  var allMembers = getAllRows(CONFIG.SHEETS.GROUP_MEMBERS);
  
  groups.forEach(function(g) {
    g.memberCount = allMembers.filter(function(m) { return m.groupId === g.groupId; }).length;
    var myRole = myMemberships.find(function(m) { return m.groupId === g.groupId; });
    g.myRole = myRole ? myRole.role : 'member';
  });
  
  return successResponse(groups);
}

/**
 * Get group detailed info including members and stats
 */
function getGroupDetails(sid, groupId) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Check access
  var membership = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === user.userId;
  });
  
  if (!membership && user.role !== 'admin') {
    return errorResponse('Bạn không có quyền truy cập nhóm này');
  }
  
  var group = getRowBy(CONFIG.SHEETS.GROUPS, 'groupId', groupId);
  if (!group) return errorResponse('Không tìm thấy nhóm');
  
  // Get members with profiles
  var members = getRowsWhere(CONFIG.SHEETS.GROUP_MEMBERS, function(m) { return m.groupId === groupId; });
  var allUsers = getAllRows(CONFIG.SHEETS.USERS);
  
  var enrichedMembers = members.map(function(m) {
    var u = allUsers.find(function(userRec) { return userRec.userId === m.userId; }) || {};
    return {
      userId: m.userId,
      role: m.role,
      name: u.name,
      email: u.email,
      avatar: u.avatar
    };
  });
  
  // Get group tasks stats
  var tasks = getRowsWhere(CONFIG.SHEETS.TASKS, function(t) { return t.groupId === groupId; });
  var stats = {
    total: tasks.length,
    completed: tasks.filter(function(t) { return t.status === 'completed'; }).length,
    pending: tasks.filter(function(t) { return t.status === 'pending'; }).length,
    in_progress: tasks.filter(function(t) { return t.status === 'in_progress'; }).length,
    overdue: tasks.filter(function(t) { 
      return (t.status === 'pending' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < new Date(); 
    }).length
  };
  
  return successResponse({
    group: group,
    members: enrichedMembers,
    myRole: membership ? membership.role : 'admin',
    stats: stats
  });
}

/**
 * Create a new group
 */
function createGroup(sid, data) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  var groupId = generateUUID();
  
  var newGroup = {
    groupId: groupId,
    name: sanitize(data.name),
    description: sanitize(data.description || ''),
    leaderId: user.userId,
    createdBy: user.userId,
    createdAt: now(),
    updatedAt: now(),
    status: 'active'
  };
  
  var success = insertRow(CONFIG.SHEETS.GROUPS, newGroup);
  
  if (success) {
    // Add creator as leader
    insertRow(CONFIG.SHEETS.GROUP_MEMBERS, {
      groupId: groupId,
      userId: user.userId,
      role: 'leader',
      joinedAt: now()
    });
    return successResponse(newGroup, 'Tạo nhóm mới thành công');
  }
  
  return errorResponse('Không thể tạo nhóm');
}

/**
 * Add member to group
 */
function addGroupMember(sid, groupId, emailToAdd) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Verify leader status
  var membership = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === user.userId && m.role === 'leader';
  });
  
  if (!membership && user.role !== 'admin') {
    return errorResponse('Chỉ nhóm trưởng mới có quyền thêm thành viên');
  }
  
  var group = getRowBy(CONFIG.SHEETS.GROUPS, 'groupId', groupId);
  var targetUser = getRowBy(CONFIG.SHEETS.USERS, 'email', emailToAdd);
  
  if (!targetUser) return errorResponse('Không tìm thấy người dùng với email này');
  if (targetUser.status !== 'active') return errorResponse('Tài khoản người dùng đã bị khóa');
  
  var isAlreadyMember = getRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === targetUser.userId;
  });
  
  if (isAlreadyMember) return errorResponse('Người dùng này đã ở trong nhóm');
  
  var success = insertRow(CONFIG.SHEETS.GROUP_MEMBERS, {
    groupId: groupId,
    userId: targetUser.userId,
    role: 'member',
    joinedAt: now()
  });
  
  if (success) {
    addNotification(targetUser.userId, 'group_invite', 'Tham gia nhóm mới', user.name + ' đã thêm bạn vào nhóm ' + group.name, groupId);
    try {
      sendGroupInvite(targetUser.email, targetUser.name, group.name, user.name);
    } catch(e) {}
    
    return successResponse(null, 'Đã thêm thành viên');
  }
  
  return errorResponse('Lỗi hệ thống');
}

/**
 * Remove member
 */
function removeGroupMember(sid, groupId, userIdToRemove) {
  var sessionRes = getUserSession(sid);
  if (!sessionRes.success) return sessionRes;
  
  var user = sessionRes.data;
  
  // Verify leader status or self-leave
  var isLeader = !!getRowsWhere(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === user.userId && m.role === 'leader';
  }).length;
  
  if (!isLeader && user.userId !== userIdToRemove && user.role !== 'admin') {
    return errorResponse('Bạn không có quyền thao tác');
  }
  
  var group = getRowBy(CONFIG.SHEETS.GROUPS, 'groupId', groupId);
  
  // Prevent removing last leader
  if (userIdToRemove === group.leaderId) {
    var otherLeaders = getRowsWhere(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
      return m.groupId === groupId && m.role === 'leader' && m.userId !== userIdToRemove;
    });
    if (otherLeaders.length === 0) {
      return errorResponse('Không thể xóa nhóm trưởng duy nhất. Vui lòng chuyển quyền hoặc xóa nhóm.');
    }
  }
  
  var success = deleteRowBy(CONFIG.SHEETS.GROUP_MEMBERS, function(m) {
    return m.groupId === groupId && m.userId === userIdToRemove;
  });
  
  if (success) return successResponse(null, 'Đã xóa thành viên khỏi nhóm');
  return errorResponse('Không thể xóa thành viên');
}
