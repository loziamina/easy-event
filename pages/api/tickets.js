import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { isPlatformAdmin, isOrganizerUser } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

function mapTicket(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    organizer: ticket.organizer
      ? {
          id: ticket.organizer.id,
          name: ticket.organizer.name,
          status: ticket.organizer.status,
        }
      : null,
    requester: ticket.requester
      ? {
          id: ticket.requester.id,
          name: ticket.requester.name,
          email: ticket.requester.email,
          role: ticket.requester.role,
        }
      : null,
    assignedAdmin: ticket.assignedAdmin
      ? {
          id: ticket.assignedAdmin.id,
          name: ticket.assignedAdmin.name,
          email: ticket.assignedAdmin.email,
        }
      : null,
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

  const uid = Number(session.user.id);
  const role = session.user.role;
  const platformAdmin = isPlatformAdmin(session.user);
  const organizerUser = isOrganizerUser(session.user);
  const organizerId = session.user.organizerId ? Number(session.user.organizerId) : null;

  try {
    if (req.method === 'GET') {
      const status = req.query.status ? String(req.query.status) : '';

      const where = platformAdmin
        ? (status ? { status } : {})
        : organizerUser
          ? {
              organizerId: organizerId || -1,
              ...(status ? { status } : {}),
            }
          : null;

      if (!where) return res.status(403).json({ message: 'Forbidden' });

      const tickets = await prisma.ticket.findMany({
        where,
        include: {
          organizer: true,
          requester: true,
          assignedAdmin: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const grouped = tickets.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      }, {});

      return res.status(200).json({
        tickets: tickets.map(mapTicket),
        summary: {
          total: tickets.length,
          open: grouped.OPEN || 0,
          inProgress: grouped.IN_PROGRESS || 0,
          resolved: grouped.RESOLVED || 0,
          refused: grouped.REFUSED || 0,
        },
      });
    }

    if (req.method === 'POST') {
      if (!organizerUser || !organizerId) {
        return res.status(403).json({ message: 'Only organizer accounts can create tickets' });
      }

      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      if (!title || !description) {
        return res.status(400).json({ message: 'Title and description required' });
      }

      const ticket = await prisma.ticket.create({
        data: {
          organizerId,
          requesterId: uid,
          title,
          description,
          status: 'OPEN',
        },
        include: {
          organizer: true,
          requester: true,
          assignedAdmin: true,
        },
      });

      await prisma.notification.create({
        data: {
          role: 'PLATFORM_ADMIN',
          type: 'TICKET',
          title: 'Nouveau ticket organisateur',
          body: `${ticket.organizer.name} - ${ticket.title}`.slice(0, 180),
          linkType: 'ticket',
          linkId: ticket.id,
        },
      });

      await writeAudit({
        actorId: uid,
        action: 'TICKET_CREATED',
        entity: 'Ticket',
        entityId: ticket.id,
        details: { organizerId, title: ticket.title },
      });

      return res.status(201).json({ ticket: mapTicket(ticket) });
    }

    if (req.method === 'PATCH') {
      if (!platformAdmin) {
        return res.status(403).json({ message: 'Only platform admin can update tickets' });
      }

      const ticketId = Number(req.body?.id);
      const status = String(req.body?.status || '');
      if (!ticketId || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REFUSED'].includes(status)) {
        return res.status(400).json({ message: 'Valid id and status required' });
      }

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          assignedAdminId: uid,
          resolvedAt: ['RESOLVED', 'REFUSED'].includes(status) ? new Date() : null,
        },
        include: {
          organizer: true,
          requester: true,
          assignedAdmin: true,
        },
      });

      await prisma.notification.create({
        data: {
          userId: ticket.requesterId,
          type: 'TICKET',
          title: `Ticket ${status.toLowerCase()}`,
          body: `${ticket.title}`.slice(0, 180),
          linkType: 'ticket',
          linkId: ticket.id,
        },
      });

      await writeAudit({
        actorId: uid,
        action: 'TICKET_STATUS_UPDATED',
        entity: 'Ticket',
        entityId: ticket.id,
        details: { status },
      });

      return res.status(200).json({ ticket: mapTicket(ticket) });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /tickets error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
