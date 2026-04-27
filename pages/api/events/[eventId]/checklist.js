import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { canManageOperations } from '../../../../lib/permissions';
import { writeAudit } from '../../../../lib/audit';
import { writeEventHistory } from '../../../../lib/events';
import { toDate } from '../../../../lib/planning';

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!canManageOperations(session.user)) return res.status(403).json({ message: 'Forbidden' });

    const eventId = Number(req.query.eventId);
    const actorId = Number(session.user.id);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (req.method === 'GET') {
      const checklist = await prisma.eventChecklistItem.findMany({
        where: { eventId },
        orderBy: [{ isDone: 'asc' }, { createdAt: 'asc' }],
      });
      return res.status(200).json({ checklist });
    }

    if (req.method === 'POST') {
      const { title, category, dueAt, assignedToId } = req.body || {};
      if (!title) return res.status(400).json({ message: 'title required' });

      const item = await prisma.eventChecklistItem.create({
        data: {
          eventId,
          title: String(title),
          category: category ? String(category) : null,
          dueAt: dueAt ? toDate(dueAt) : null,
          assignedToId: assignedToId ? Number(assignedToId) : null,
        },
      });

      await writeEventHistory({
        eventId,
        actorId,
        action: 'CHECKLIST_ITEM_CREATED',
        details: { title: item.title },
      });
      await writeAudit({ actorId, action: 'CHECKLIST_ITEM_CREATED', entity: 'Event', entityId: eventId });
      return res.status(201).json(item);
    }

    if (req.method === 'PATCH') {
      const { id, title, category, dueAt, isDone, assignedToId } = req.body || {};
      const itemId = Number(id);
      if (!itemId) return res.status(400).json({ message: 'id required' });

      const item = await prisma.eventChecklistItem.update({
        where: { id: itemId },
        data: {
          title: title != null ? String(title) : undefined,
          category: category != null ? String(category) || null : undefined,
          dueAt: dueAt !== undefined ? (dueAt ? toDate(dueAt) : null) : undefined,
          isDone: isDone !== undefined ? Boolean(isDone) : undefined,
          assignedToId: assignedToId !== undefined ? (assignedToId !== '' && assignedToId != null ? Number(assignedToId) : null) : undefined,
        },
      });

      await writeEventHistory({
        eventId,
        actorId,
        action: item.isDone ? 'CHECKLIST_ITEM_DONE' : 'CHECKLIST_ITEM_UPDATED',
        details: { title: item.title },
      });
      return res.status(200).json(item);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      await prisma.eventChecklistItem.delete({ where: { id } });
      await writeEventHistory({ eventId, actorId, action: 'CHECKLIST_ITEM_DELETED' });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /events/[eventId]/checklist error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
