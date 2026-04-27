import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';
import { writeEventHistory } from '../../lib/events';
import {
  QUOTE_STATUS,
  buildQuoteLinesFromEvent,
  quoteNumber,
  summarizeQuoteLines,
} from '../../lib/quotes';

function includeQuoteDetails() {
  return {
    event: {
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    },
    items: true,
  };
}

function toMoney(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function notifyUser(userId, type, title, body) {
  if (!userId) return;
  await prisma.notification.create({
    data: {
      userId: Number(userId),
      type,
      title,
      body,
    },
  });
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    const uid = Number(session.user.id);
    const isStaff = canManageOperations(session.user);

    if (req.method === 'GET') {
      const where = isStaff
        ? {}
        : { event: { ownerId: uid } };

      const quotes = await prisma.quote.findMany({
        where,
        include: includeQuoteDetails(),
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ quotes });
    }

    if (req.method === 'POST') {
      if (!isStaff) return res.status(403).json({ message: 'Forbidden' });

      const {
        eventId,
        templateId,
        calculationMode,
        deliveryFee,
        installationFee,
        discount,
        depositAmount,
        depositRequired,
        terms,
        send,
      } = req.body || {};

      const parsedEventId = Number(eventId);
      if (!parsedEventId) return res.status(400).json({ message: 'eventId required' });

      const event = await prisma.event.findUnique({
        where: { id: parsedEventId },
        include: {
          owner: true,
          items: { include: { product: true } },
        },
      });
      if (!event) return res.status(404).json({ message: 'Event not found' });

      const template = templateId
        ? await prisma.quoteTemplate.findUnique({ where: { id: Number(templateId) } })
        : null;

      const mode = calculationMode || template?.calculationMode || 'MIXED';
      const lines = buildQuoteLinesFromEvent(event, mode);
      const summary = summarizeQuoteLines(lines, { deliveryFee, installationFee, discount });
      const status = send ? QUOTE_STATUS.SENT : QUOTE_STATUS.DRAFT;

      const quote = await prisma.quote.create({
        data: {
          eventId: event.id,
          templateId: template?.id || null,
          number: quoteNumber(event.id),
          status,
          calculationMode: mode,
          subtotal: summary.subtotal,
          deliveryFee: summary.deliveryFee,
          installationFee: summary.installationFee,
          discount: summary.discount,
          total: summary.total,
          depositAmount: depositAmount === '' || depositAmount == null
            ? template?.defaultDeposit ?? null
            : Number(depositAmount),
          depositRequired: Boolean(depositRequired),
          terms: terms || template?.terms || null,
          sentAt: send ? new Date() : null,
          createdBy: uid,
          items: {
            create: lines.map((line) => ({
              label: line.label,
              description: line.description,
              strategy: line.strategy,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              guestCount: line.guestCount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: includeQuoteDetails(),
      });

      await writeEventHistory({
        eventId: event.id,
        actorId: uid,
        action: send ? 'QUOTE_SENT' : 'QUOTE_CREATED',
        details: { quoteId: quote.id, number: quote.number },
      });

      await writeAudit({
        actorId: uid,
        action: send ? 'QUOTE_SENT' : 'QUOTE_CREATED',
        entity: 'Quote',
        entityId: quote.id,
        details: { eventId: event.id, total: quote.total },
      });

      return res.status(201).json(quote);
    }

    if (req.method === 'PATCH') {
      const { id, action, clientComment, organizerComment, quotePatch } = req.body || {};
      const quoteId = Number(id);
      if (!quoteId || !action) return res.status(400).json({ message: 'id and action required' });

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { event: true },
      });
      if (!quote) return res.status(404).json({ message: 'Quote not found' });
      if (!isStaff && quote.event.ownerId !== uid) return res.status(403).json({ message: 'Forbidden' });

      if (action === 'comment' && !isStaff) {
        const trimmedComment = String(clientComment || '').trim();
        if (!trimmedComment) return res.status(400).json({ message: 'Comment required' });

        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: { clientComment: trimmedComment },
          include: includeQuoteDetails(),
        });

        await writeAudit({
          actorId: uid,
          action: 'QUOTE_COMMENT_UPDATED',
          entity: 'Quote',
          entityId: quote.id,
        });

        return res.status(200).json(updated);
      }

      if (action === 'deleteComment' && !isStaff) {
        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: { clientComment: null },
          include: includeQuoteDetails(),
        });

        await writeAudit({
          actorId: uid,
          action: 'QUOTE_COMMENT_DELETED',
          entity: 'Quote',
          entityId: quote.id,
        });

        return res.status(200).json(updated);
      }

      if (action === 'staffComment' && isStaff) {
        const trimmedComment = String(organizerComment || clientComment || '').trim();
        if (!trimmedComment) return res.status(400).json({ message: 'Comment required' });

        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: { organizerComment: trimmedComment },
          include: includeQuoteDetails(),
        });

        await writeAudit({
          actorId: uid,
          action: 'QUOTE_STAFF_COMMENT_UPDATED',
          entity: 'Quote',
          entityId: quote.id,
        });

        await notifyUser(
          quote.event.ownerId,
          'QUOTE_COMMENT_REPLY',
          'Reponse a ton commentaire',
          `Une reponse a ete ajoutee sur le devis ${quote.number}.`
        );

        return res.status(200).json(updated);
      }

      if (action === 'deleteStaffComment' && isStaff) {
        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: { organizerComment: null },
          include: includeQuoteDetails(),
        });

        await writeAudit({
          actorId: uid,
          action: 'QUOTE_STAFF_COMMENT_DELETED',
          entity: 'Quote',
          entityId: quote.id,
        });

        return res.status(200).json(updated);
      }

      if (action === 'updateQuote' && isStaff) {
        const patch = quotePatch || {};
        const deliveryFee = Math.max(0, toMoney(patch.deliveryFee, quote.deliveryFee));
        const installationFee = Math.max(0, toMoney(patch.installationFee, quote.installationFee));
        const discount = Math.max(0, toMoney(patch.discount, quote.discount));
        const total = Math.max(0, Number(quote.subtotal || 0) + deliveryFee + installationFee - discount);

        const updated = await prisma.quote.update({
          where: { id: quote.id },
          data: {
            deliveryFee,
            installationFee,
            discount,
            total,
            depositAmount: patch.depositAmount === '' || patch.depositAmount == null
              ? null
              : Math.max(0, toMoney(patch.depositAmount, quote.depositAmount || 0)),
            depositRequired: Boolean(patch.depositRequired),
            terms: patch.terms != null && String(patch.terms).trim()
              ? String(patch.terms).trim()
              : null,
          },
          include: includeQuoteDetails(),
        });

        await writeEventHistory({
          eventId: quote.eventId,
          actorId: uid,
          action: 'QUOTE_UPDATED',
          details: { quoteId: quote.id, number: quote.number, total },
        });

        await writeAudit({
          actorId: uid,
          action: 'QUOTE_UPDATED',
          entity: 'Quote',
          entityId: quote.id,
          details: { total },
        });

        await notifyUser(
          quote.event.ownerId,
          'QUOTE_UPDATED',
          'Devis modifie',
          `Le devis ${quote.number} a ete modifie. Nouveau total: ${Number(total || 0).toLocaleString('fr-FR')} EUR.`
        );

        return res.status(200).json(updated);
      }

      let nextStatus = quote.status;
      if (action === 'send' && isStaff) nextStatus = QUOTE_STATUS.SENT;
      else if (action === 'accept' && !isStaff) nextStatus = QUOTE_STATUS.ACCEPTED;
      else if (action === 'refuse' && !isStaff) nextStatus = QUOTE_STATUS.REFUSED;
      else return res.status(400).json({ message: 'Invalid quote action' });

      if (['accept', 'refuse'].includes(action) && quote.status !== QUOTE_STATUS.SENT) {
        return res.status(400).json({ message: 'Only sent quotes can be accepted or refused' });
      }

      const updated = await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: nextStatus,
          sentAt: action === 'send' ? new Date() : quote.sentAt,
          decidedAt: ['accept', 'refuse'].includes(action) ? new Date() : quote.decidedAt,
          clientComment: clientComment != null ? String(clientComment) : quote.clientComment,
        },
        include: includeQuoteDetails(),
      });

      await writeEventHistory({
        eventId: quote.eventId,
        actorId: uid,
        action: `QUOTE_${nextStatus}`,
        details: { quoteId: quote.id, number: quote.number },
      });

      await writeAudit({
        actorId: uid,
        action: `QUOTE_${nextStatus}`,
        entity: 'Quote',
        entityId: quote.id,
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (!isStaff) return res.status(403).json({ message: 'Forbidden' });
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quote.delete({ where: { id } });
      await writeAudit({ actorId: uid, action: 'QUOTE_DELETED', entity: 'Quote', entityId: id });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /quotes error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
