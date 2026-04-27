import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { writeAudit } from '../../lib/audit';

function clampRating(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return null;
  return number;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text ? text : null;
}

function mapReview(review) {
  return {
    id: review.id,
    eventId: review.eventId,
    organizerId: review.organizerId,
    organizerRating: review.organizerRating,
    organizerComment: review.organizerComment,
    staffRating: review.staffRating,
    staffComment: review.staffComment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    author: review.author
      ? {
          id: review.author.id,
          name: review.author.name,
          avatarUrl: review.author.avatarUrl,
        }
      : null,
    reviewedStaff: review.reviewedStaff
      ? {
          id: review.reviewedStaff.id,
          name: review.reviewedStaff.name,
          avatarUrl: review.reviewedStaff.avatarUrl,
        }
      : null,
    event: review.event
      ? {
          id: review.event.id,
          name: review.event.name,
          date: review.event.date,
        }
      : null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const organizerId = Number(req.query?.organizerId);
      if (!organizerId) {
        return res.status(400).json({ message: 'organizerId required' });
      }

      const reviews = await prisma.review.findMany({
        where: { organizerId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
          event: { select: { id: true, name: true, date: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ reviews: reviews.map(mapReview) });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (session.user.role !== 'CLIENT') {
      return res.status(403).json({ message: 'Only clients can leave a review' });
    }

    if (!['POST', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const eventId = Number(req.body?.eventId);
    if (!eventId) {
      return res.status(400).json({ message: 'eventId required' });
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        ownerId: Number(session.user.id),
      },
      include: {
        organizer: true,
        assignedStaff: {
          select: { id: true, name: true, role: true },
        },
        review: true,
      },
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.status !== 'DONE') {
      return res.status(403).json({ message: "Tu peux laisser un avis seulement quand l'evenement est termine." });
    }

    if (!event.organizerId) {
      return res.status(400).json({ message: 'No organizer linked to this event' });
    }

    const organizerRating = clampRating(req.body?.organizerRating);
    if (!organizerRating) {
      return res.status(400).json({ message: 'organizerRating must be between 1 and 5' });
    }

    const hasAssignedStaff = Boolean(event.assignedStaffId);
    const staffRating = hasAssignedStaff ? clampRating(req.body?.staffRating) : null;
    const staffComment = hasAssignedStaff ? cleanText(req.body?.staffComment) : null;

    const data = {
      organizerId: event.organizerId,
      authorId: Number(session.user.id),
      reviewedStaffId: hasAssignedStaff ? event.assignedStaffId : null,
      organizerRating,
      organizerComment: cleanText(req.body?.organizerComment),
      staffRating,
      staffComment,
    };

    const review = event.review
      ? await prisma.review.update({
          where: { id: event.review.id },
          data,
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
            event: { select: { id: true, name: true, date: true } },
          },
        })
      : await prisma.review.create({
          data: {
            eventId: event.id,
            ...data,
          },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
            event: { select: { id: true, name: true, date: true } },
          },
        });

    await writeAudit({
      actorId: session.user.id,
      action: event.review ? 'REVIEW_UPDATED' : 'REVIEW_CREATED',
      entity: 'Review',
      entityId: review.id,
      details: {
        eventId: event.id,
        organizerId: event.organizerId,
        reviewedStaffId: event.assignedStaffId || null,
      },
    });

    return res.status(event.review ? 200 : 201).json({ review: mapReview(review) });
  } catch (error) {
    console.error('API /reviews error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: String(error?.message || error),
    });
  }
}
