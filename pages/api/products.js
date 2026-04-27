import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { hasPermission, isPlatformAdmin } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

function parseJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function serializeList(value) {
  return JSON.stringify(parseJsonList(value));
}

function mapProduct(product) {
  return {
    ...product,
    gallery: parseJsonList(product.gallery),
    variants: parseJsonList(product.variants),
    recommendedFor: parseJsonList(product.recommendedFor),
  };
}

function productData(body) {
  return {
    name: String(body.name || '').trim(),
    description: body.description ? String(body.description).trim() : null,
    price: String(body.price || '').trim(),
    image: body.image ? String(body.image).trim() : null,
    gallery: serializeList(body.gallery),
    type: body.type === 'PACK' ? 'PACK' : 'PRODUCT',
    variants: serializeList(body.variants),
    stock: body.stock === '' || body.stock == null ? null : Number(body.stock),
    isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : true,
    recommendedFor: serializeList(body.recommendedFor),
    categoryId: body.categoryId ? Number(body.categoryId) : null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { categoryId, type, occasionType, available, organizerId } = req.query;

      const products = await prisma.product.findMany({
        where: {
          categoryId: categoryId ? Number(categoryId) : undefined,
          type: type ? String(type) : undefined,
          isAvailable: available === 'true' ? true : undefined,
          organizerId: organizerId ? Number(organizerId) : undefined,
        },
        include: { category: true, organizer: true },
        orderBy: { createdAt: 'desc' },
      });

      const mapped = products.map(mapProduct);
      const recommended = occasionType
        ? mapped.filter((product) => product.recommendedFor.includes(String(occasionType)))
        : [];

      return res.status(200).json({ products: mapped, recommended });
    }

    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!hasPermission(session.user, 'products:manage')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const actorOrganizerId = session.user.organizerId ? Number(session.user.organizerId) : null;
    const isAdmin = isPlatformAdmin(session.user);

    if (req.method === 'POST') {
      const data = productData(req.body || {});
      if (!data.name || !data.price) {
        return res.status(400).json({ message: 'name and price required' });
      }
      if (!isAdmin && !actorOrganizerId) {
        return res.status(400).json({ message: 'Organizer account required' });
      }

      const product = await prisma.product.create({
        data: {
          ...data,
          organizerId: isAdmin ? (req.body?.organizerId ? Number(req.body.organizerId) : null) : actorOrganizerId,
        },
        include: { category: true, organizer: true },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: product.id,
        details: { name: product.name, type: product.type },
      });

      return res.status(201).json(mapProduct(product));
    }

    if (req.method === 'PUT') {
      const id = Number(req.body?.id);
      if (!id) {
        return res.status(400).json({ message: 'id required' });
      }

      const data = productData(req.body || {});
      if (!data.name || !data.price) {
        return res.status(400).json({ message: 'name and price required' });
      }

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (!isAdmin && existing.organizerId !== actorOrganizerId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          ...data,
          organizerId: isAdmin
            ? (req.body?.organizerId !== undefined ? Number(req.body.organizerId) || null : existing.organizerId)
            : actorOrganizerId,
        },
        include: { category: true, organizer: true },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'PRODUCT_UPDATED',
        entity: 'Product',
        entityId: product.id,
        details: { name: product.name, type: product.type },
      });

      return res.status(200).json(mapProduct(product));
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) {
        return res.status(400).json({ message: 'id required' });
      }

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (!isAdmin && product.organizerId !== actorOrganizerId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const linkedItems = await prisma.eventItem.count({ where: { productId: id } });
      if (linkedItems > 0) {
        await prisma.product.update({
          where: { id },
          data: { isAvailable: false },
        });
      } else {
        await prisma.product.delete({ where: { id } });
      }

      await writeAudit({
        actorId: session.user.id,
        action: linkedItems > 0 ? 'PRODUCT_ARCHIVED' : 'PRODUCT_DELETED',
        entity: 'Product',
        entityId: id,
        details: { name: product.name },
      });

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /products error:', error);
    return res.status(500).json({
      message: 'Server error',
      error: String(error?.message || error),
    });
  }
}
