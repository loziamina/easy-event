import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { canManageStaff, isPlatformAdmin } from '../../../lib/permissions';
import { writeAudit } from '../../../lib/audit';

const STAFF_ROLES = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'];

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!canManageStaff(session.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const actorId = Number(session.user.id);
  const actorOrganizerId = session.user.organizerId ? Number(session.user.organizerId) : null;
  const platformAdmin = isPlatformAdmin(session.user);

  try {
    if (req.method === 'GET') {
      const users = await prisma.user.findMany({
        where: {
          role: {
            in: platformAdmin ? STAFF_ROLES : ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'],
          },
          organizerId: platformAdmin ? undefined : actorOrganizerId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ users: users.map(safeUser) });
    }

    if (req.method === 'POST') {
      const {
        email,
        password,
        name,
        role = platformAdmin ? 'ORGANIZER_OWNER' : 'ORGANIZER_STAFF',
        phone,
        address,
      } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'email and password required' });
      }

      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      if (!platformAdmin && role !== 'ORGANIZER_STAFF') {
        return res.status(403).json({ message: 'Only platform admin can create this role' });
      }
      if (!platformAdmin && !actorOrganizerId) {
        return res.status(400).json({ message: 'Organizer account required' });
      }

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ message: 'Email already used' });
      }

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name ? String(name).trim() : null,
          phone: phone ? String(phone).trim() : null,
          address: address ? String(address).trim() : null,
          password: await bcrypt.hash(String(password), 10),
          role,
          organizerId: platformAdmin ? (req.body?.organizerId ? Number(req.body.organizerId) : null) : actorOrganizerId,
        },
      });

      await writeAudit({
        actorId,
        action: 'STAFF_CREATED',
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, role: user.role },
      });

      return res.status(201).json({ user: safeUser(user) });
    }

    if (req.method === 'PATCH') {
      const { id, role, name, phone, address } = req.body || {};
      const userId = Number(id);

      if (!userId) {
        return res.status(400).json({ message: 'id required' });
      }

      if (role && !STAFF_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      if (userId === actorId && role && role !== session.user.role) {
        return res.status(400).json({ message: 'You cannot change your own role' });
      }

      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!platformAdmin && existing.organizerId !== actorOrganizerId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (!platformAdmin && role && role !== 'ORGANIZER_STAFF') {
        return res.status(403).json({ message: 'Only platform admin can set this role' });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          role: role || undefined,
          name: name != null ? String(name).trim() || null : undefined,
          phone: phone != null ? String(phone).trim() || null : undefined,
          address: address != null ? String(address).trim() || null : undefined,
        },
      });

      await writeAudit({
        actorId,
        action: 'STAFF_UPDATED',
        entity: 'User',
        entityId: user.id,
        details: { role: user.role },
      });

      return res.status(200).json({ user: safeUser(user) });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const userId = Number(id);

      if (!userId) {
        return res.status(400).json({ message: 'id required' });
      }

      if (userId === actorId) {
        return res.status(400).json({ message: 'Admin cannot delete own account' });
      }

      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          role: { in: STAFF_ROLES },
          organizerId: platformAdmin ? undefined : actorOrganizerId,
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'Staff not found' });
      }

      await prisma.user.delete({ where: { id: user.id } });

      await writeAudit({
        actorId,
        action: 'STAFF_DELETED',
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, role: user.role },
      });

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /admin/staff error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
