import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export async function verifyCredentials(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { organizer: true },
  });

  if (!user) return null;
  if (!user.password) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return {
    id: String(user.id),
    email: user.email,
    name: user.name || '',
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    address: user.address || '',
    role: user.role,
    organizerId: user.organizerId ? String(user.organizerId) : null,
    organizerName: user.organizer?.name || '',
    organizerStatus: user.organizer?.status || '',
  };
}
