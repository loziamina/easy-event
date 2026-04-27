import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { canManageOperations } from '../../../../lib/permissions';
import { writeAudit } from '../../../../lib/audit';
import { summarizeCart } from '../../../../lib/pricing';

const RESERVATION_MINUTES = 30;

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const uid = Number(session.user.id);
    const isStaff = canManageOperations(session.user);
    const eventId = Number(req.query.eventId);

    if (!eventId) {
      return res.status(400).json({ message: 'Invalid eventId' });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!isStaff && event.ownerId !== uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'GET') {
      const orders = await prisma.order.findMany({
        where: { eventId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ orders });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end('Method not allowed');
    }

    if (isStaff) {
      return res.status(403).json({ message: 'Staff cannot submit client cart' });
    }

    const {
      deliveryAddress,
      deliverySlot,
      clientNotes,
      deliveryFee,
      installationFee,
    } = req.body || {};

    if (!deliveryAddress || !deliverySlot) {
      return res.status(400).json({ message: 'deliveryAddress and deliverySlot required' });
    }

    const items = await prisma.eventItem.findMany({
      where: { eventId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    for (const item of items) {
      if (!item.product?.isAvailable) {
        return res.status(400).json({ message: `${item.product?.name || 'Product'} is not available` });
      }

      if (item.product?.stock != null) {
        const reservedQuantity = await prisma.eventItem.aggregate({
          where: {
            productId: item.productId,
            reservedUntil: { gt: new Date() },
            eventId: { not: eventId },
          },
          _sum: { quantity: true },
        });

        const alreadyReserved = reservedQuantity._sum.quantity || 0;
        if (alreadyReserved + item.quantity > item.product.stock) {
          return res.status(409).json({ message: `${item.product.name} is temporarily reserved` });
        }
      }
    }

    const summary = summarizeCart(items, { deliveryFee, installationFee });
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          eventId,
          clientId: uid,
          status: 'PENDING',
          deliveryAddress: String(deliveryAddress),
          deliverySlot: String(deliverySlot),
          clientNotes: clientNotes ? String(clientNotes) : null,
          deliveryFee: summary.deliveryFee,
          installationFee: summary.installationFee,
          subtotalFixed: summary.subtotalFixed,
          totalFixed: summary.totalFixed,
          hasQuoteItems: summary.hasQuoteItems,
          reservedUntil,
          items: {
            create: summary.lines.map((line) => ({
              productId: line.productId,
              name: line.name,
              priceLabel: line.priceLabel,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              note: line.note || null,
              variant: line.variant || null,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      await tx.eventItem.updateMany({
        where: { eventId },
        data: { reservedUntil },
      });

      return created;
    });

    await writeAudit({
      actorId: uid,
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order.id,
      details: { eventId, totalFixed: order.totalFixed, hasQuoteItems: order.hasQuoteItems },
    });

    return res.status(201).json({ order });
  } catch (error) {
    console.error('API /events/[eventId]/order error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
