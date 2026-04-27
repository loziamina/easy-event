import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { hasPermission } from '../../../lib/permissions';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!hasPermission(session.user, 'audit:read')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method not allowed');
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.status(200).json({ logs });
}
