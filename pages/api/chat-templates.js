import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { canManageOperations } from '../../lib/permissions';
import { writeAudit } from '../../lib/audit';

const defaultTemplates = [
  {
    title: 'Demande reçue',
    body: 'Bonjour, nous avons bien reçu votre demande. Nous revenons vers vous rapidement avec les prochaines étapes.',
  },
  {
    title: 'Devis envoyé',
    body: 'Bonjour, votre devis est disponible dans votre espace. Vous pouvez le consulter puis l’accepter ou le refuser.',
  },
  {
    title: 'Maquette disponible',
    body: 'Bonjour, une nouvelle maquette est disponible. Merci de la valider ou de nous indiquer les modifications souhaitées.',
  },
];

async function ensureDefaultTemplates() {
  const count = await prisma.quickMessageTemplate.count();
  if (count > 0) return;
  await prisma.quickMessageTemplate.createMany({ data: defaultTemplates });
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!canManageOperations(session.user)) return res.status(403).json({ message: 'Forbidden' });

    if (req.method === 'GET') {
      await ensureDefaultTemplates();
      const templates = await prisma.quickMessageTemplate.findMany({ orderBy: { title: 'asc' } });
      return res.status(200).json({ templates });
    }

    if (req.method === 'POST') {
      const { title, body } = req.body || {};
      if (!title || !body) return res.status(400).json({ message: 'title and body required' });
      const template = await prisma.quickMessageTemplate.create({
        data: { title: String(title), body: String(body), role: session.user.role },
      });
      await writeAudit({ actorId: session.user.id, action: 'CHAT_TEMPLATE_CREATED', entity: 'QuickMessageTemplate', entityId: template.id });
      return res.status(201).json(template);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ message: 'id required' });
      await prisma.quickMessageTemplate.delete({ where: { id } });
      await writeAudit({ actorId: session.user.id, action: 'CHAT_TEMPLATE_DELETED', entity: 'QuickMessageTemplate', entityId: id });
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end('Method not allowed');
  } catch (error) {
    console.error('API /chat-templates error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
