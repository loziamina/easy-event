import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageAllOrganizerEvents, canManageOperations, isOrganizerStaff, isPlatformAdmin } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';
import { writeEventHistory } from '../../lib/events';
import { detectPlanningConflicts, toDate } from '../../lib/planning';

function rangeFromQuery(query) {
  const now = new Date();
  const start = query.start ? toDate(query.start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = query.end ? toDate(query.end) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!canManageOperations(session.user)) return res.status(403).json({ message: 'Forbidden' });

    const actorId = Number(session.user.id);
    const platformAdmin = isPlatformAdmin(session.user);
    const staffAssignedOnly = isOrganizerStaff(session.user);
    const canAssignEvents = canManageAllOrganizerEvents(session.user);
    const organizerId = session.user.organizerId ? Number(session.user.organizerId) : null;

    if (req.method === 'GET') {
      const { start, end } = rangeFromQuery(req.query);
      const eventVisibilityWhere = platformAdmin
        ? {}
        : {
            organizerId,
            ...(staffAssignedOnly ? { assignedStaffId: actorId } : {}),
          };
      const organizerEventIds = platformAdmin
        ? []
        : (
            await prisma.event.findMany({
              where: eventVisibilityWhere,
              select: { id: true },
            })
          ).map((event) => event.id);

      const [events, blocks, staff] = await Promise.all([
        prisma.event.findMany({
          where: {
            ...eventVisibilityWhere,
            date: { gte: start, lt: end },
            status: { in: ['ACCEPTED', 'PLANNED', 'DONE'] },
          },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            assignedStaff: { select: { id: true, name: true, email: true, role: true } },
            checklist: { orderBy: { createdAt: 'asc' } },
            items: { include: { product: true } },
          },
          orderBy: { date: 'asc' },
        }),
        prisma.planningBlock.findMany({
          where: {
            startAt: { lt: end },
            endAt: { gt: start },
            OR: platformAdmin
              ? undefined
              : staffAssignedOnly
                ? [
                    { createdBy: actorId, eventId: null },
                    { eventId: { in: organizerEventIds.length > 0 ? organizerEventIds : [-1] } },
                  ]
                : [
                    { eventId: null },
                    ...(organizerEventIds.length > 0 ? [{ eventId: { in: organizerEventIds } }] : []),
                  ],
          },
          orderBy: { startAt: 'asc' },
        }),
        prisma.user.findMany({
          where: {
            role: { in: ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'] },
            organizerId: platformAdmin ? undefined : organizerId,
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      return res.status(200).json({
        events,
        blocks,
        staff,
        conflicts: detectPlanningConflicts(events, blocks),
      });
    }

    if (req.method === 'POST') {
      const { title, startAt, endAt, reason } = req.body || {};
      const parsedStart = toDate(startAt);
      const parsedEnd = toDate(endAt);
      if (!title || !parsedStart || !parsedEnd || parsedStart >= parsedEnd) {
        return res.status(400).json({ message: 'title, valid startAt and endAt required' });
      }

      const block = await prisma.planningBlock.create({
        data: {
          title: String(title),
          startAt: parsedStart,
          endAt: parsedEnd,
          reason: reason ? String(reason) : null,
          createdBy: actorId,
          eventId: null,
        },
      });

      await writeAudit({
        actorId,
        action: 'PLANNING_BLOCK_CREATED',
        entity: 'PlanningBlock',
        entityId: block.id,
        details: { title: block.title },
      });

      return res.status(201).json(block);
    }

    if (req.method === 'PATCH') {
      if (!canAssignEvents) return res.status(403).json({ message: 'Only organizer owner can assign events' });

      const { eventId, assignedStaffId } = req.body || {};
      const parsedEventId = Number(eventId);
      const parsedStaffId = assignedStaffId ? Number(assignedStaffId) : null;
      if (!parsedEventId) return res.status(400).json({ message: 'eventId required' });

      if (parsedStaffId) {
        const staff = await prisma.user.findFirst({
          where: {
            id: parsedStaffId,
            role: { in: ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'] },
            organizerId: platformAdmin ? undefined : organizerId,
          },
        });
        if (!staff) return res.status(404).json({ message: 'Staff not found' });
      }

      const existingEvent = await prisma.event.findUnique({ where: { id: parsedEventId } });
      if (!existingEvent) return res.status(404).json({ message: 'Event not found' });
      if (!platformAdmin && existingEvent.organizerId !== organizerId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const event = await prisma.event.update({
        where: { id: parsedEventId },
        data: { assignedStaffId: parsedStaffId },
        include: { assignedStaff: true },
      });

      await writeEventHistory({
        eventId: event.id,
        actorId,
        action: 'EVENT_ASSIGNED',
        details: { assignedStaffId: parsedStaffId },
      });

      await writeAudit({
        actorId,
        action: 'EVENT_ASSIGNED',
        entity: 'Event',
        entityId: event.id,
        details: { assignedStaffId: parsedStaffId },
      });

      return res.status(200).json(event);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      const block = await prisma.planningBlock.findUnique({ where: { id } });
      if (!block) return res.status(404).json({ message: 'Block not found' });
      if (block.eventId) {
        return res.status(400).json({ message: 'Automatic event block cannot be deleted manually' });
      }

      await prisma.planningBlock.delete({ where: { id } });
      await writeAudit({ actorId, action: 'PLANNING_BLOCK_DELETED', entity: 'PlanningBlock', entityId: id });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /planning error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
