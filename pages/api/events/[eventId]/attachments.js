import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { canAccessEventRecord } from '../../../../lib/permissions';
import { writeAudit } from '../../../../lib/audit';
import { writeEventHistory } from '../../../../lib/events';

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = Number(req.query.eventId);
    const uid = Number(session.user.id);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!canAccessEventRecord(session.user, event)) return res.status(403).json({ message: 'Forbidden' });

    if (req.method === 'GET') {
      const attachments = await prisma.eventAttachment.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ attachments });
    }

    if (req.method === 'POST') {
      const { name, url, type } = req.body || {};
      if (!name || !url) return res.status(400).json({ message: 'name and url required' });

      const attachment = await prisma.eventAttachment.create({
        data: {
          eventId,
          name: String(name),
          url: String(url),
          type: type ? String(type) : null,
        },
      });

      await writeEventHistory({
        eventId,
        actorId: uid,
        action: 'ATTACHMENT_ADDED',
        details: { name: attachment.name },
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_ATTACHMENT_ADDED',
        entity: 'Event',
        entityId: eventId,
        details: { attachmentId: attachment.id },
      });

      return res.status(201).json(attachment);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const attachment = await prisma.eventAttachment.findFirst({ where: { id, eventId } });
      if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

      await prisma.eventAttachment.delete({ where: { id } });

      await writeEventHistory({
        eventId,
        actorId: uid,
        action: 'ATTACHMENT_DELETED',
        details: { name: attachment.name },
      });

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /events/[eventId]/attachments error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
