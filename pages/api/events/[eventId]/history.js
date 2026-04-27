import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { canManageOperations } from '../../../../lib/permissions';

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end('Method not allowed');
    }

    const eventId = Number(req.query.eventId);
    const uid = Number(session.user.id);
    const isStaff = canManageOperations(session.user);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isStaff && event.ownerId !== uid) return res.status(403).json({ message: 'Forbidden' });

    const history = await prisma.eventHistory.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ history });
  } catch (error) {
    console.error('API /events/[eventId]/history error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
