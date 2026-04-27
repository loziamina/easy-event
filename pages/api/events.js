import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations, isPlatformAdmin } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';
import {
  EVENT_STATUS,
  canTransition,
  countActiveEventsForDay,
  dailyEventCapacity,
  getStatusMeta,
  dayRange,
  writeEventHistory,
} from '../../lib/events';

function toDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function eventPayload(body, existing = {}) {
  return {
    name: body.name != null ? String(body.name) : existing.name,
    date: body.date ? toDate(body.date) : existing.date,
    occasionType: body.occasionType != null ? String(body.occasionType) || null : existing.occasionType,
    theme: body.theme != null ? String(body.theme) || null : existing.theme,
    location: body.location != null ? String(body.location) || null : existing.location,
    guestCount: body.guestCount !== undefined && body.guestCount !== null && body.guestCount !== ''
      ? Number(body.guestCount)
      : existing.guestCount ?? null,
    budget: body.budget !== undefined && body.budget !== null && body.budget !== ''
      ? Number(body.budget)
      : existing.budget ?? null,
    notes: body.notes != null ? String(body.notes) || null : existing.notes,
    serviceBuffet: body.serviceBuffet !== undefined ? Boolean(body.serviceBuffet) : Boolean(existing.serviceBuffet),
    serviceDeco: body.serviceDeco !== undefined ? Boolean(body.serviceDeco) : Boolean(existing.serviceDeco),
    serviceOrganisation: body.serviceOrganisation !== undefined ? Boolean(body.serviceOrganisation) : Boolean(existing.serviceOrganisation),
    serviceGateaux: body.serviceGateaux !== undefined ? Boolean(body.serviceGateaux) : Boolean(existing.serviceGateaux),
    serviceMobilier: body.serviceMobilier !== undefined ? Boolean(body.serviceMobilier) : Boolean(existing.serviceMobilier),
    serviceAnimation: body.serviceAnimation !== undefined ? Boolean(body.serviceAnimation) : Boolean(existing.serviceAnimation),
    serviceLieu: body.serviceLieu !== undefined ? Boolean(body.serviceLieu) : Boolean(existing.serviceLieu),
  };
}

async function ensureCapacity(date, excludeEventId, organizerId) {
  const count = await countActiveEventsForDay(date, excludeEventId, organizerId);
  const capacity = dailyEventCapacity();
  const { start, end } = dayRange(date);
  const organizerEventIds = organizerId
    ? (
        await prisma.event.findMany({
          where: {
            organizerId: Number(organizerId),
            id: excludeEventId ? { not: Number(excludeEventId) } : undefined,
          },
          select: { id: true },
        })
      ).map((event) => event.id)
    : [];

  const blockingBlock = await prisma.planningBlock.findFirst({
    where: {
      startAt: { lt: end },
      endAt: { gt: start },
      OR: organizerId
        ? [
            { eventId: null },
            ...(organizerEventIds.length > 0 ? [{ eventId: { in: organizerEventIds } }] : []),
          ]
        : undefined,
    },
  });

  return {
    ok: count < capacity && !blockingBlock,
    count,
    capacity,
    blockingBlock,
  };
}

async function syncPlanningBlockForEvent(event, actorId) {
  if ([EVENT_STATUS.ACCEPTED, EVENT_STATUS.PLANNED].includes(event.status)) {
    const { start, end } = dayRange(event.date);
    const existingBlock = await prisma.planningBlock.findFirst({
      where: { eventId: event.id },
    });

    if (existingBlock) {
      await prisma.planningBlock.update({
        where: { id: existingBlock.id },
        data: {
          title: `Réservé - ${event.name}`,
          startAt: start,
          endAt: end,
          reason: 'Créneau bloqué automatiquement après acceptation',
          createdBy: actorId,
        },
      });
    } else {
      await prisma.planningBlock.create({
        data: {
          title: `Réservé - ${event.name}`,
          startAt: start,
          endAt: end,
          reason: 'Créneau bloqué automatiquement après acceptation',
          eventId: event.id,
          createdBy: actorId,
        },
      });
    }

    return;
  }

  await prisma.planningBlock.deleteMany({
    where: { eventId: event.id },
  });
}

function includeEventDetails() {
  return {
    owner: true,
    organizer: true,
    assignedStaff: {
      select: { id: true, name: true, avatarUrl: true, role: true },
    },
    review: {
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    },
    attachments: { orderBy: { createdAt: 'desc' } },
    history: { orderBy: { createdAt: 'desc' }, take: 10 },
    items: { include: { product: true } },
    orders: { include: { items: true }, orderBy: { createdAt: 'desc' } },
  };
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const isStaff = canManageOperations(session.user);
    const isAdmin = isPlatformAdmin(session.user);
    const uid = Number(session.user.id);
    const actorOrganizerId = session.user.organizerId ? Number(session.user.organizerId) : null;

    if (req.method === 'GET') {
      const events = await prisma.event.findMany({
        where: isStaff
          ? isAdmin
            ? undefined
            : { organizerId: actorOrganizerId }
          : { ownerId: uid },
        include: includeEventDetails(),
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ events, dailyCapacity: dailyEventCapacity() });
    }

    if (req.method === 'POST') {
      if (isStaff) {
        return res.status(403).json({ message: 'Forbidden: staff cannot create client events' });
      }

      const body = req.body || {};
      if (!body.name || !body.date || !body.organizerId) {
        return res.status(400).json({ message: 'name, date and organizerId required' });
      }

      const payload = eventPayload(body);
      if (!payload.date) {
        return res.status(400).json({ message: 'Invalid date' });
      }

      const organizer = await prisma.organizer.findFirst({
        where: { id: Number(body.organizerId), status: 'APPROVED' },
      });
      if (!organizer) {
        return res.status(404).json({ message: 'Organizer not found or not approved' });
      }

      const nextStatus = body.submit ? EVENT_STATUS.PENDING_APPROVAL : EVENT_STATUS.DRAFT;
      if (nextStatus === EVENT_STATUS.PENDING_APPROVAL) {
        const capacity = await ensureCapacity(payload.date, null, organizer.id);
        if (!capacity.ok) {
          return res.status(409).json({
            message: capacity.blockingBlock
              ? 'Date already blocked in planning'
              : `Daily capacity reached (${capacity.count}/${capacity.capacity})`,
          });
        }
      }

      const meta = getStatusMeta(nextStatus);
      const created = await prisma.event.create({
        data: {
          ...payload,
          isSubmitted: Boolean(body.submit),
          ownerId: uid,
          organizerId: organizer.id,
          status: nextStatus,
          statusText: meta.text,
          statusColor: meta.color,
        },
        include: includeEventDetails(),
      });

      await writeEventHistory({
        eventId: created.id,
        actorId: uid,
        action: body.submit ? 'EVENT_SUBMITTED' : 'EVENT_DRAFT_CREATED',
        toStatus: nextStatus,
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_CREATED',
        entity: 'Event',
        entityId: created.id,
        details: { status: nextStatus },
      });

      return res.status(201).json(created);
    }

    if (req.method === 'PUT') {
      if (isStaff) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const body = req.body || {};
      const id = Number(body.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const existing = await prisma.event.findFirst({ where: { id, ownerId: uid } });
      if (!existing) return res.status(404).json({ message: 'Event not found' });

      if (![EVENT_STATUS.DRAFT, EVENT_STATUS.PENDING_APPROVAL].includes(existing.status)) {
        return res.status(403).json({ message: 'Event can no longer be modified' });
      }

      const payload = eventPayload(body, existing);
      if (!payload.date) return res.status(400).json({ message: 'Invalid date' });

      const organizerId = body.organizerId ? Number(body.organizerId) : existing.organizerId;
      if (!organizerId) {
        return res.status(400).json({ message: 'organizerId required' });
      }

      const organizer = await prisma.organizer.findFirst({
        where: { id: organizerId, status: 'APPROVED' },
      });
      if (!organizer) {
        return res.status(404).json({ message: 'Organizer not found or not approved' });
      }

      const nextStatus = body.submit ? EVENT_STATUS.PENDING_APPROVAL : existing.status;
      if (nextStatus === EVENT_STATUS.PENDING_APPROVAL) {
        const capacity = await ensureCapacity(payload.date, existing.id, organizer.id);
        if (!capacity.ok) {
          return res.status(409).json({
            message: capacity.blockingBlock
              ? 'Date already blocked in planning'
              : `Daily capacity reached (${capacity.count}/${capacity.capacity})`,
          });
        }
      }

      const meta = getStatusMeta(nextStatus);
      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          ...payload,
          organizerId: organizer.id,
          isSubmitted: body.submit ? true : existing.isSubmitted,
          status: nextStatus,
          statusText: meta.text,
          statusColor: meta.color,
        },
        include: includeEventDetails(),
      });

      await writeEventHistory({
        eventId: updated.id,
        actorId: uid,
        action: body.submit && existing.status !== EVENT_STATUS.PENDING_APPROVAL ? 'EVENT_SUBMITTED' : 'EVENT_UPDATED',
        fromStatus: existing.status,
        toStatus: updated.status,
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_UPDATED',
        entity: 'Event',
        entityId: updated.id,
        details: { status: updated.status },
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (isStaff) return res.status(403).json({ message: 'Forbidden' });

      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const existing = await prisma.event.findFirst({ where: { id, ownerId: uid } });
      if (!existing) return res.status(404).json({ message: 'Event not found' });
      if (![EVENT_STATUS.DRAFT, EVENT_STATUS.PENDING_APPROVAL, EVENT_STATUS.REFUSED].includes(existing.status)) {
        return res.status(403).json({ message: 'Event can no longer be deleted' });
      }

      await prisma.orderItem.deleteMany({ where: { order: { eventId: existing.id } } });
      await prisma.order.deleteMany({ where: { eventId: existing.id } });
      await prisma.eventItem.deleteMany({ where: { eventId: existing.id } });
      await prisma.eventAttachment.deleteMany({ where: { eventId: existing.id } });
      await prisma.eventHistory.deleteMany({ where: { eventId: existing.id } });
      await prisma.event.delete({ where: { id: existing.id } });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_DELETED',
        entity: 'Event',
        entityId: existing.id,
      });

      return res.status(204).end();
    }

    if (req.method === 'PATCH') {
      if (!isStaff) return res.status(403).json({ message: 'Forbidden: only staff' });

      const { id, status } = req.body || {};
      if (!id || !status) return res.status(400).json({ message: 'id and status required' });
      if (!Object.values(EVENT_STATUS).includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const existing = await prisma.event.findUnique({ where: { id: Number(id) } });
      if (!existing) return res.status(404).json({ message: 'Event not found' });
      if (!isAdmin && existing.organizerId !== actorOrganizerId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      if (!canTransition(existing.status, status)) {
        return res.status(400).json({ message: `Invalid transition from ${existing.status} to ${status}` });
      }

      if ([EVENT_STATUS.PENDING_APPROVAL, EVENT_STATUS.ACCEPTED, EVENT_STATUS.PLANNED].includes(status)) {
        const capacity = await ensureCapacity(existing.date, existing.id, existing.organizerId);
        if (!capacity.ok) {
          return res.status(409).json({
            message: capacity.blockingBlock
              ? 'Date already blocked in planning'
              : `Daily capacity reached (${capacity.count}/${capacity.capacity})`,
          });
        }
      }

      const meta = getStatusMeta(status);
      const updated = await prisma.event.update({
        where: { id: Number(id) },
        data: {
          status,
          statusText: meta.text,
          statusColor: meta.color,
          isSubmitted: status !== EVENT_STATUS.DRAFT,
        },
        include: includeEventDetails(),
      });

      await syncPlanningBlockForEvent(updated, uid);

      await writeEventHistory({
        eventId: updated.id,
        actorId: uid,
        action: 'STATUS_CHANGED',
        fromStatus: existing.status,
        toStatus: status,
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_STATUS_UPDATED',
        entity: 'Event',
        entityId: updated.id,
        details: { status },
      });

      return res.status(200).json(updated);
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API /events error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: String(error?.message || error),
    });
  }
}
