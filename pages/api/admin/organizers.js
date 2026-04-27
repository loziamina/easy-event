import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { isPlatformAdmin } from '../../../lib/permissions';
import { writeAudit } from '../../../lib/audit';

function mapOrganizer(organizer) {
  return {
    id: organizer.id,
    name: organizer.name,
    slug: organizer.slug,
    status: organizer.status,
    city: organizer.city,
    address: organizer.address,
    serviceArea: organizer.serviceArea,
    description: organizer.description,
    createdAt: organizer.createdAt,
    updatedAt: organizer.updatedAt,
    owner: organizer.users?.[0]
      ? {
          id: organizer.users[0].id,
          name: organizer.users[0].name,
          email: organizer.users[0].email,
          phone: organizer.users[0].phone,
        }
      : null,
    counts: organizer._count || { users: 0, products: 0, events: 0 },
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!isPlatformAdmin(session.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const actorId = Number(session.user.id);

  try {
    if (req.method === 'GET') {
      const status = req.query?.status ? String(req.query.status) : '';

      const organizers = await prisma.organizer.findMany({
        where: status ? { status } : undefined,
        include: {
          users: {
            where: { role: 'ORGANIZER_OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          _count: {
            select: {
              users: true,
              products: true,
              events: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });

      const counts = await prisma.organizer.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      return res.status(200).json({
        organizers: organizers.map(mapOrganizer),
        summary: {
          total: organizers.length,
          pending: counts.find((item) => item.status === 'PENDING')?._count.status || 0,
          approved: counts.find((item) => item.status === 'APPROVED')?._count.status || 0,
          suspended: counts.find((item) => item.status === 'SUSPENDED')?._count.status || 0,
        },
      });
    }

    if (req.method === 'PATCH') {
      const organizerId = Number(req.body?.id);
      const status = String(req.body?.status || '');

      if (!organizerId || !['PENDING', 'APPROVED', 'SUSPENDED'].includes(status)) {
        return res.status(400).json({ message: 'Valid id and status required' });
      }

      const organizer = await prisma.organizer.update({
        where: { id: organizerId },
        data: { status },
        include: {
          users: {
            where: { role: 'ORGANIZER_OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          _count: {
            select: {
              users: true,
              products: true,
              events: true,
            },
          },
        },
      });

      await writeAudit({
        actorId,
        action: 'ORGANIZER_STATUS_UPDATED',
        entity: 'Organizer',
        entityId: organizer.id,
        details: { status },
      });

      return res.status(200).json({ organizer: mapOrganizer(organizer) });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /admin/organizers error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
