import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { canAccessEventRecord, canManageOperations } from '../../../../lib/permissions';
import { writeAudit } from '../../../../lib/audit';
import { summarizeCart } from '../../../../lib/pricing';

const RESERVATION_MINUTES = 30;

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);

    console.log('EVENT ITEMS API SESSION:', session);

    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const isStaff = canManageOperations(session.user);
    const uid = Number(session.user.id);
    const eventId = Number(req.query.eventId);

    if (!eventId) {
      return res.status(400).json({ message: 'Invalid eventId' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!canAccessEventRecord(session.user, event)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'GET') {
      const items = await prisma.eventItem.findMany({
        where: { eventId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ items, summary: summarizeCart(items) });
    }

    if (req.method === 'POST') {
      if (isStaff) {
        return res.status(403).json({ message: 'Staff cannot add items to client event' });
      }

      const { productId, quantity, note, variant } = req.body || {};

      if (!productId) {
        return res.status(400).json({ message: 'productId required' });
      }

      const parsedProductId = Number(productId);
      const parsedQuantity = quantity ? Number(quantity) : 1;

      const product = await prisma.product.findUnique({
        where: { id: parsedProductId },
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (!product.isAvailable) {
        return res.status(400).json({ message: 'Product is not available' });
      }

      if (product.stock != null) {
        const reservedQuantity = await prisma.eventItem.aggregate({
          where: {
            productId: parsedProductId,
            reservedUntil: { gt: new Date() },
            eventId: { not: eventId },
          },
          _sum: { quantity: true },
        });

        const alreadyReserved = reservedQuantity._sum.quantity || 0;
        if (alreadyReserved + parsedQuantity > product.stock) {
          return res.status(409).json({ message: 'Stock temporarily reserved by another cart' });
        }
      }

      const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

      const existing = await prisma.eventItem.findUnique({
        where: {
          eventId_productId: {
            eventId,
            productId: parsedProductId,
          },
        },
      });

      if (existing) {
        const updated = await prisma.eventItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + parsedQuantity,
            note: note != null ? String(note) : existing.note,
            variant: variant != null ? String(variant) : existing.variant,
            reservedUntil,
          },
          include: { product: true },
        });

        await writeAudit({
          actorId: uid,
          action: 'EVENT_ITEM_UPDATED',
          entity: 'EventItem',
          entityId: updated.id,
          details: { eventId },
        });

        return res.status(200).json(updated);
      }

      const created = await prisma.eventItem.create({
        data: {
          eventId,
          productId: parsedProductId,
          quantity: parsedQuantity,
          note: note ? String(note) : null,
          variant: variant ? String(variant) : null,
          reservedUntil,
        },
        include: { product: true },
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_ITEM_CREATED',
        entity: 'EventItem',
        entityId: created.id,
        details: { eventId },
      });

      return res.status(201).json(created);
    }

    if (req.method === 'PUT') {
      if (isStaff) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { itemId, quantity, note, variant } = req.body || {};
      if (!itemId) {
        return res.status(400).json({ message: 'itemId required' });
      }

      const existing = await prisma.eventItem.findFirst({
        where: { id: Number(itemId), eventId },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Item not found' });
      }

      const nextQuantity = quantity != null ? Number(quantity) : existing.quantity;
      if (nextQuantity < 1) {
        return res.status(400).json({ message: 'quantity must be greater than 0' });
      }

      const product = await prisma.product.findUnique({ where: { id: existing.productId } });
      if (product?.stock != null) {
        const reservedQuantity = await prisma.eventItem.aggregate({
          where: {
            productId: existing.productId,
            reservedUntil: { gt: new Date() },
            eventId: { not: eventId },
          },
          _sum: { quantity: true },
        });

        const alreadyReserved = reservedQuantity._sum.quantity || 0;
        if (alreadyReserved + nextQuantity > product.stock) {
          return res.status(409).json({ message: 'Stock temporarily reserved by another cart' });
        }
      }

      const updated = await prisma.eventItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQuantity,
          note: note != null ? String(note) : existing.note,
          variant: variant != null ? String(variant) : existing.variant,
          reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
        },
        include: { product: true },
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_ITEM_UPDATED',
        entity: 'EventItem',
        entityId: updated.id,
        details: { eventId },
      });

      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      if (isStaff) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { itemId } = req.body || {};
      if (!itemId) {
        return res.status(400).json({ message: 'itemId required' });
      }

      const existing = await prisma.eventItem.findFirst({
        where: { id: Number(itemId), eventId },
      });

      if (!existing) {
        return res.status(404).json({ message: 'Item not found' });
      }

      await prisma.eventItem.delete({
        where: { id: existing.id },
      });

      await writeAudit({
        actorId: uid,
        action: 'EVENT_ITEM_DELETED',
        entity: 'EventItem',
        entityId: existing.id,
        details: { eventId },
      });

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API /events/[eventId]/items error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: String(error?.message || error),
    });
  }
}
