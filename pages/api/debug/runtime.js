import { prisma } from '../../../lib/prisma';

export default async function handler(req, res) {
  if (process.env.NODE_ENV === 'production' && req.query.key !== process.env.NEXTAUTH_SECRET) {
    return res.status(404).json({ message: 'Not found' });
  }

  const checks = {
    node: process.version,
    nextauthUrl: process.env.NEXTAUTH_URL || null,
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    prisma: 'not_checked',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.prisma = 'ok';
  } catch (error) {
    checks.prisma = String(error?.message || error).slice(0, 500);
  }

  return res.status(200).json(checks);
}
