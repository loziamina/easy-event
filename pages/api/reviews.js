import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { writeAudit } from '../../lib/audit';
import { notifyOrganizerUsers } from '../../lib/notifications';
import { canAccessEventRecord, canManageOperations } from '../../lib/permissions';

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

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const eventId = Number(req.body?.eventId);
    const reviewId = Number(req.body?.reviewId || req.body?.id);
    if (!eventId && !reviewId) {
      return res.status(400).json({ message: 'eventId required' });
    }

    const reviewLookup = reviewId
      ? { id: reviewId }
      : { eventId };
    const existingReview = await prisma.review.findUnique({
      where: reviewLookup,
      include: {
        event: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const isStaff = canManageOperations(session.user);

    if (['PATCH', 'DELETE'].includes(req.method)) {
      if (!existingReview) return res.status(404).json({ message: 'Review not found' });

      const isAuthor = existingReview.authorId === Number(session.user.id);
      const canModerate = isStaff && canAccessEventRecord(session.user, existingReview.event);
      if (!isAuthor && !canModerate) return res.status(403).json({ message: 'Forbidden' });

      if (req.method === 'PATCH') {
        if (!canModerate) return res.status(403).json({ message: 'Only organizer staff can moderate comments' });
        const action = String(req.body?.action || '');
        const data = {};
        if (action === 'deleteOrganizerComment') data.organizerComment = null;
        else if (action === 'deleteStaffComment') data.staffComment = null;
        else if (action === 'deleteComments') {
          data.organizerComment = null;
          data.staffComment = null;
        } else {
          return res.status(400).json({ message: 'Invalid action' });
        }

        const review = await prisma.review.update({
          where: { id: existingReview.id },
          data,
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
            event: { select: { id: true, name: true, date: true } },
          },
        });

        await writeAudit({
          actorId: session.user.id,
          action: 'REVIEW_COMMENT_DELETED',
          entity: 'Review',
          entityId: review.id,
          details: { action },
        });

        return res.status(200).json({ review: mapReview(review) });
      }

      await prisma.review.delete({ where: { id: existingReview.id } });
      await writeAudit({
        actorId: session.user.id,
        action: canModerate ? 'REVIEW_MODERATED_DELETED' : 'REVIEW_DELETED',
        entity: 'Review',
        entityId: existingReview.id,
        details: { eventId: existingReview.eventId, organizerId: existingReview.organizerId },
      });

      return res.status(200).json({ ok: true });
    }

    if (session.user.role !== 'CLIENT') {
      return res.status(403).json({ message: 'Only clients can leave a review' });
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

    await notifyOrganizerUsers({
      organizerId: event.organizerId,
      type: event.review ? 'REVIEW_UPDATED' : 'REVIEW_CREATED',
      title: event.review ? 'Avis client modifie' : 'Nouvel avis client',
      body: `${event.name} - ${review.organizerRating}/5`,
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
