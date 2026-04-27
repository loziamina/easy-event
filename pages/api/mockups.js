import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canAccessEventRecord, canManageOperations, eventScopeForUser } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';
import { writeEventHistory } from '../../lib/events';
import { notifyOrganizerUsers, notifyUser } from '../../lib/notifications';

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function mapMockup(mockup) {
  return {
    ...mockup,
    moodboard: parseList(mockup.moodboard),
  };
}

async function canAccessEvent(eventId, session) {
  const event = await prisma.event.findUnique({
    where: { id: Number(eventId) },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  if (!event) return { ok: false, status: 404, message: 'Event not found' };
  if (!canAccessEventRecord(session.user, event)) {
    return { ok: false, status: 403, message: 'Forbidden' };
  }
  return { ok: true, event };
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    const isStaff = canManageOperations(session.user);
    const uid = Number(session.user.id);

    if (req.method === 'GET') {
      const scope = eventScopeForUser(session.user);
      const where = isStaff
        ? scope ? { event: scope } : {}
        : { event: { ownerId: uid } };

      const mockups = await prisma.mockup.findMany({
        where,
        include: {
          event: { include: { owner: { select: { id: true, name: true, email: true } } } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ eventId: 'desc' }, { version: 'desc' }],
      });

      return res.status(200).json({ mockups: mockups.map(mapMockup) });
    }

    if (req.method === 'POST') {
      if (!isStaff) return res.status(403).json({ message: 'Forbidden' });
      const { eventId, title, url, fileType, description, moodboard } = req.body || {};
      if (!eventId || !title || !url) return res.status(400).json({ message: 'eventId, title and url required' });

      const access = await canAccessEvent(eventId, session);
      if (!access.ok) return res.status(access.status).json({ message: access.message });

      const last = await prisma.mockup.findFirst({
        where: { eventId: Number(eventId) },
        orderBy: { version: 'desc' },
      });
      const version = (last?.version || 0) + 1;

      const mockup = await prisma.mockup.create({
        data: {
          eventId: Number(eventId),
          title: String(title),
          url: String(url),
          fileType: fileType || 'image',
          version,
          description: description ? String(description) : null,
          moodboard: parseList(moodboard).join(','),
          createdBy: uid,
        },
        include: {
          event: { include: { owner: { select: { id: true, name: true, email: true } } } },
          comments: true,
        },
      });

      await writeEventHistory({
        eventId,
        actorId: uid,
        action: 'MOCKUP_UPLOADED',
        details: { mockupId: mockup.id, version },
      });
      await writeAudit({ actorId: uid, action: 'MOCKUP_UPLOADED', entity: 'Mockup', entityId: mockup.id });
      await notifyUser({
        userId: mockup.event.ownerId,
        type: 'MOCKUP_UPLOADED',
        title: 'Nouvelle maquette disponible',
        body: `${mockup.title} - version ${mockup.version}`,
      });

      return res.status(201).json(mapMockup(mockup));
    }

    if (req.method === 'PATCH') {
      const { id, action, text } = req.body || {};
      const mockupId = Number(id);
      if (!mockupId || !action) return res.status(400).json({ message: 'id and action required' });

      const mockup = await prisma.mockup.findUnique({
        where: { id: mockupId },
        include: { event: true },
      });
      if (!mockup) return res.status(404).json({ message: 'Mockup not found' });
      if (!canAccessEventRecord(session.user, mockup.event)) return res.status(403).json({ message: 'Forbidden' });

      if (action === 'comment') {
        if (!text) return res.status(400).json({ message: 'text required' });
        const comment = await prisma.mockupComment.create({
          data: {
            mockupId,
            authorId: uid,
            authorRole: session.user.role,
            text: String(text),
          },
        });
        await writeEventHistory({
          eventId: mockup.eventId,
          actorId: uid,
          action: 'MOCKUP_COMMENTED',
          details: { mockupId },
        });
        if (isStaff) {
          await notifyUser({
            userId: mockup.event.ownerId,
            type: 'MOCKUP_COMMENT',
            title: 'Nouveau commentaire sur une maquette',
            body: String(text),
          });
        } else {
          await notifyOrganizerUsers({
            organizerId: mockup.event.organizerId,
            excludeUserId: uid,
            type: 'MOCKUP_COMMENT',
            title: 'Commentaire client sur une maquette',
            body: String(text),
          });
        }
        return res.status(201).json(comment);
      }

      if (!['approve', 'changes'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action' });
      }
      if (isStaff) return res.status(403).json({ message: 'Only client can validate mockup' });

      const status = action === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
      const updated = await prisma.mockup.update({
        where: { id: mockupId },
        data: { status, decidedAt: new Date() },
        include: {
          event: { include: { owner: { select: { id: true, name: true, email: true } } } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
      });

      await writeEventHistory({
        eventId: mockup.eventId,
        actorId: uid,
        action: status === 'APPROVED' ? 'MOCKUP_APPROVED' : 'MOCKUP_CHANGES_REQUESTED',
        details: { mockupId },
      });
      await writeAudit({ actorId: uid, action: status, entity: 'Mockup', entityId: mockupId });
      await notifyOrganizerUsers({
        organizerId: mockup.event.organizerId,
        excludeUserId: uid,
        type: 'MOCKUP_STATUS',
        title: status === 'APPROVED' ? 'Maquette validee' : 'Modifications demandees',
        body: `${updated.title} - ${updated.event?.owner?.name || updated.event?.owner?.email || 'Client'}`,
      });

      return res.status(200).json(mapMockup(updated));
    }

    if (req.method === 'DELETE') {
      if (!isStaff) return res.status(403).json({ message: 'Forbidden' });
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      const mockup = await prisma.mockup.findUnique({ where: { id }, include: { event: true } });
      if (!mockup) return res.status(404).json({ message: 'Mockup not found' });
      if (!canAccessEventRecord(session.user, mockup.event)) return res.status(403).json({ message: 'Forbidden' });
      await prisma.mockupComment.deleteMany({ where: { mockupId: mockup.id } });
      await prisma.mockup.delete({ where: { id: mockup.id } });
      await writeAudit({ actorId: uid, action: 'MOCKUP_DELETED', entity: 'Mockup', entityId: id });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /mockups error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
