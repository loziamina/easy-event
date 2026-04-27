import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');

  if (!token || !password) {
    return res.status(400).json({ message: 'token and password required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must contain at least 6 characters' });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'User',
    entityId: user.id,
  });

  return res.status(200).json({ message: 'Password updated' });
}
