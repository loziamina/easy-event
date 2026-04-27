import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { hasPermission } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const categories = await prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ categories });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!hasPermission(session.user, 'products:manage')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'POST') {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'name required' });

      const category = await prisma.category.create({
        data: { name, slug: slugify(name) },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'CATEGORY_CREATED',
        entity: 'Category',
        entityId: category.id,
        details: { name },
      });

      return res.status(201).json(category);
    }

    if (req.method === 'PUT') {
      const id = Number(req.body?.id);
      const name = String(req.body?.name || '').trim();
      if (!id || !name) return res.status(400).json({ message: 'id and name required' });

      const category = await prisma.category.update({
        where: { id },
        data: { name, slug: slugify(name) },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'CATEGORY_UPDATED',
        entity: 'Category',
        entityId: category.id,
        details: { name },
      });

      return res.status(200).json(category);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const productCount = await prisma.product.count({ where: { categoryId: id } });
      if (productCount > 0) {
        return res.status(400).json({ message: 'Category contains products' });
      }

      await prisma.category.delete({ where: { id } });

      await writeAudit({
        actorId: session.user.id,
        action: 'CATEGORY_DELETED',
        entity: 'Category',
        entityId: id,
      });

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /categories error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
