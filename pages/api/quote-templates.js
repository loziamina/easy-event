import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    if (req.method === 'GET') {
      const templates = await prisma.quoteTemplate.findMany({ orderBy: { name: 'asc' } });
      return res.status(200).json({ templates });
    }

    if (!canManageOperations(session.user)) return res.status(403).json({ message: 'Forbidden' });

    if (req.method === 'POST') {
      const { name, description, calculationMode, defaultDeposit, terms } = req.body || {};
      if (!name) return res.status(400).json({ message: 'name required' });

      const template = await prisma.quoteTemplate.create({
        data: {
          name: String(name),
          description: description ? String(description) : null,
          calculationMode: calculationMode || 'MIXED',
          defaultDeposit: defaultDeposit === '' || defaultDeposit == null ? null : Number(defaultDeposit),
          terms: terms ? String(terms) : null,
        },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'QUOTE_TEMPLATE_CREATED',
        entity: 'QuoteTemplate',
        entityId: template.id,
      });

      return res.status(201).json(template);
    }

    if (req.method === 'PUT') {
      const { id, name, description, calculationMode, defaultDeposit, terms } = req.body || {};
      if (!id || !name) return res.status(400).json({ message: 'id and name required' });

      const template = await prisma.quoteTemplate.update({
        where: { id: Number(id) },
        data: {
          name: String(name),
          description: description ? String(description) : null,
          calculationMode: calculationMode || 'MIXED',
          defaultDeposit: defaultDeposit === '' || defaultDeposit == null ? null : Number(defaultDeposit),
          terms: terms ? String(terms) : null,
        },
      });

      await writeAudit({
        actorId: session.user.id,
        action: 'QUOTE_TEMPLATE_UPDATED',
        entity: 'QuoteTemplate',
        entityId: template.id,
      });

      return res.status(200).json(template);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      await prisma.quoteTemplate.delete({ where: { id } });
      await writeAudit({ actorId: session.user.id, action: 'QUOTE_TEMPLATE_DELETED', entity: 'QuoteTemplate', entityId: id });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /quote-templates error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
