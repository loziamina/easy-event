import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';

function parseMediaList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyMediaList(value) {
  const items = String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userId = Number(session.user.id);

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        address: true,
        role: true,
        createdAt: true,
        organizer: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            serviceArea: true,
            description: true,
            coverImage: true,
            portfolioImages: true,
            portfolioVideos: true,
            status: true,
          },
        },
      },
    });

    return res.status(200).json({
      user: user
        ? {
            ...user,
            organizer: user.organizer
              ? {
                  ...user.organizer,
                  portfolioImages: parseMediaList(user.organizer.portfolioImages),
                  portfolioVideos: parseMediaList(user.organizer.portfolioVideos),
                }
              : null,
          }
        : null,
    });
  }

  if (req.method === 'PUT') {
    const {
      name,
      phone,
      address,
      avatarUrl,
      organizerName,
      organizerCity,
      organizerAddress,
      organizerServiceArea,
      organizerDescription,
      organizerCoverImage,
      organizerPortfolioImages,
      organizerPortfolioVideos,
    } = req.body || {};

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name != null ? String(name).trim() || null : undefined,
        avatarUrl: avatarUrl != null ? String(avatarUrl).trim() || null : undefined,
        phone: phone != null ? String(phone).trim() || null : undefined,
        address: address != null ? String(address).trim() || null : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        address: true,
        role: true,
      },
    });

    if (session.user.organizerId && ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(session.user.role)) {
      await prisma.organizer.update({
        where: { id: Number(session.user.organizerId) },
        data: {
          name: organizerName != null ? String(organizerName).trim() || undefined : undefined,
          city: organizerCity != null ? String(organizerCity).trim() || null : undefined,
          address: organizerAddress != null ? String(organizerAddress).trim() || null : undefined,
          serviceArea: organizerServiceArea != null ? String(organizerServiceArea).trim() || null : undefined,
          description: organizerDescription != null ? String(organizerDescription).trim() || null : undefined,
          coverImage: organizerCoverImage != null ? String(organizerCoverImage).trim() || null : undefined,
          portfolioImages: organizerPortfolioImages != null ? stringifyMediaList(organizerPortfolioImages) : undefined,
          portfolioVideos: organizerPortfolioVideos != null ? stringifyMediaList(organizerPortfolioVideos) : undefined,
        },
      });
    }

    await writeAudit({
      actorId: userId,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: userId,
    });

    return res.status(200).json({ user });
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).end('Method not allowed');
}
