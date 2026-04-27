import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method not allowed');
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'email required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    await writeAudit({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
    });

    const resetUrl = `/auth/reset-password?token=${resetToken}`;
    return res.status(200).json({
      message: 'Reset link generated',
      resetUrl,
    });
  }

  return res.status(200).json({ message: 'If the account exists, a reset link was sent' });
}
