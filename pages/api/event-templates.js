import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { hasPermission } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIds(value) {
  return parseList(value)
    .map((item) => Number(item))
    .filter(Boolean);
}

function mapTemplate(template) {
  return {
    ...template,
    suggestedTags: parseList(template.suggestedTags),
    suggestedProductIds: parseIds(template.suggestedProductIds),
  };
}

function templateData(body) {
  return {
    name: String(body.name || '').trim(),
    occasionType: String(body.occasionType || '').trim(),
    description: body.description ? String(body.description).trim() : null,
    theme: body.theme ? String(body.theme).trim() : null,
    guestCount: body.guestCount === '' || body.guestCount == null ? null : Number(body.guestCount),
    budget: body.budget === '' || body.budget == null ? null : Number(body.budget),
    suggestedTags: parseList(body.suggestedTags).join(','),
    suggestedProductIds: parseIds(body.suggestedProductIds).join(','),
    serviceBuffet: Boolean(body.serviceBuffet),
    serviceDeco: Boolean(body.serviceDeco),
    serviceOrganisation: Boolean(body.serviceOrganisation),
    serviceGateaux: Boolean(body.serviceGateaux),
    serviceMobilier: Boolean(body.serviceMobilier),
    serviceAnimation: Boolean(body.serviceAnimation),
    serviceLieu: Boolean(body.serviceLieu),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const templates = await prisma.eventTemplate.findMany({
        orderBy: { name: 'asc' },
      });
      return res.status(200).json({ templates: templates.map(mapTemplate) });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!hasPermission(session.user, 'products:manage')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'POST') {
      const data = templateData(req.body || {});
      if (!data.name || !data.occasionType) {
        return res.status(400).json({ message: 'name and occasionType required' });
      }

      const template = await prisma.eventTemplate.create({ data });
      await writeAudit({
        actorId: session.user.id,
        action: 'EVENT_TEMPLATE_CREATED',
        entity: 'EventTemplate',
        entityId: template.id,
        details: { name: template.name },
      });
      return res.status(201).json(mapTemplate(template));
    }

    if (req.method === 'PUT') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      const data = templateData(req.body || {});
      if (!data.name || !data.occasionType) {
        return res.status(400).json({ message: 'name and occasionType required' });
      }

      const template = await prisma.eventTemplate.update({ where: { id }, data });
      await writeAudit({
        actorId: session.user.id,
        action: 'EVENT_TEMPLATE_UPDATED',
        entity: 'EventTemplate',
        entityId: template.id,
        details: { name: template.name },
      });
      return res.status(200).json(mapTemplate(template));
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });

      await prisma.eventTemplate.delete({ where: { id } });
      await writeAudit({
        actorId: session.user.id,
        action: 'EVENT_TEMPLATE_DELETED',
        entity: 'EventTemplate',
        entityId: id,
      });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /event-templates error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
