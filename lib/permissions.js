export const ROLES = {
  CLIENT: 'CLIENT',
  ORGANIZER_STAFF: 'ORGANIZER_STAFF',
  ORGANIZER_OWNER: 'ORGANIZER_OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
};

const permissionsByRole = {
  [ROLES.CLIENT]: ['profile:read', 'profile:update', 'events:own', 'organizers:read'],
  [ROLES.ORGANIZER_STAFF]: ['events:manage', 'products:manage', 'messages:manage', 'audit:read'],
  [ROLES.ORGANIZER_OWNER]: [
    'events:manage',
    'products:manage',
    'messages:manage',
    'staff:manage',
    'audit:read',
    'profile:read',
    'profile:update',
    'organizer:manage',
  ],
  [ROLES.PLATFORM_ADMIN]: [
    'messages:manage',
    'staff:manage',
    'audit:read',
    'profile:read',
    'profile:update',
    'organizer:manage',
    'platform:manage',
  ],
};

export function hasRole(user, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return Boolean(user?.role && allowed.includes(user.role));
}

export function hasPermission(user, permission) {
  return permissionsByRole[user?.role]?.includes(permission) || false;
}

export function requirePermission(session, permission, res) {
  if (!session?.user?.id) {
    res.status(401).json({ message: 'Unauthorized' });
    return false;
  }

  if (!hasPermission(session.user, permission)) {
    res.status(403).json({ message: 'Forbidden' });
    return false;
  }

  return true;
}

export function canManageOperations(user) {
  return hasRole(user, [ROLES.PLATFORM_ADMIN, ROLES.ORGANIZER_OWNER, ROLES.ORGANIZER_STAFF]);
}

export function canManageOrganizerWorkspace(user) {
  return hasRole(user, [ROLES.ORGANIZER_OWNER, ROLES.ORGANIZER_STAFF]);
}

export function canManageStaff(user) {
  return hasRole(user, [ROLES.PLATFORM_ADMIN, ROLES.ORGANIZER_OWNER]);
}

export function isPlatformAdmin(user) {
  return hasRole(user, ROLES.PLATFORM_ADMIN);
}

export function isOrganizerOwner(user) {
  return hasRole(user, ROLES.ORGANIZER_OWNER);
}

export function isOrganizerStaff(user) {
  return hasRole(user, ROLES.ORGANIZER_STAFF);
}

export function isOrganizerUser(user) {
  return hasRole(user, [ROLES.ORGANIZER_OWNER, ROLES.ORGANIZER_STAFF]);
}

export function canManageAllOrganizerEvents(user) {
  return isPlatformAdmin(user) || isOrganizerOwner(user);
}

export function eventScopeForUser(user) {
  const uid = Number(user?.id);
  const organizerId = user?.organizerId ? Number(user.organizerId) : null;

  if (isPlatformAdmin(user)) return undefined;
  if (isOrganizerOwner(user)) return { organizerId };
  if (isOrganizerStaff(user)) return { organizerId, assignedStaffId: uid };
  return { ownerId: uid };
}

export function canAccessEventRecord(user, event) {
  if (!user?.id || !event) return false;
  const uid = Number(user.id);
  const organizerId = user.organizerId ? Number(user.organizerId) : null;

  if (isPlatformAdmin(user)) return true;
  if (isOrganizerOwner(user)) return Number(event.organizerId) === organizerId;
  if (isOrganizerStaff(user)) {
    return Number(event.organizerId) === organizerId && Number(event.assignedStaffId) === uid;
  }
  return Number(event.ownerId) === uid;
}
