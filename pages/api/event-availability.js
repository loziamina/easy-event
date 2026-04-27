import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { countActiveEventsForDay, dailyEventCapacity, dayRange } from '../../lib/events';

function parseDate(value, fallback) {
  const date = value ? new Date(`${value}T00:00:00`) : fallback;
  return isNaN(date.getTime()) ? fallback : date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end('Method not allowed');
    }

    const organizerId = Number(req.query.organizerId);
    if (!organizerId) return res.status(400).json({ message: 'organizerId required' });

    const start = parseDate(req.query.start, new Date());
    start.setHours(0, 0, 0, 0);
    const daysCount = Math.min(60, Math.max(7, Number(req.query.days || 30)));
    const capacity = dailyEventCapacity();

    const organizerEventIds = (
      await prisma.event.findMany({
        where: { organizerId },
        select: { id: true },
      })
    ).map((event) => event.id);

    const days = [];

    for (let index = 0; index < daysCount; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const { start: dayStart, end: dayEnd } = dayRange(date);

      const [activeCount, blockingBlock] = await Promise.all([
        countActiveEventsForDay(date, null, organizerId),
        prisma.planningBlock.findFirst({
          where: {
            startAt: { lt: dayEnd },
            endAt: { gt: dayStart },
            OR: [
              { eventId: null },
              ...(organizerEventIds.length > 0 ? [{ eventId: { in: organizerEventIds } }] : []),
            ],
          },
        }),
      ]);

      const unavailable = activeCount >= capacity || Boolean(blockingBlock);

      days.push({
        date: isoDate(date),
        available: !unavailable,
        reservedCount: activeCount,
        capacity,
        reason: blockingBlock ? 'Creneau bloque' : unavailable ? 'Creneau reserve' : null,
      });
    }

    return res.status(200).json({ days, capacity });
  } catch (error) {
    console.error('API /event-availability error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
