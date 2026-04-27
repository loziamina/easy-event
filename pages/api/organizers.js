import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { isPlatformAdmin } from '../../lib/permissions';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseMediaList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreOrganizer(organizer, searchTerm, userAddress) {
  let score = 0;
  const city = normalize(organizer.city);
  const serviceArea = normalize(organizer.serviceArea);
  const name = normalize(organizer.name);
  const description = normalize(organizer.description);
  const address = normalize(userAddress);

  if (searchTerm) {
    if (city.includes(searchTerm)) score += 6;
    if (serviceArea.includes(searchTerm)) score += 5;
    if (name.includes(searchTerm)) score += 3;
    if (description.includes(searchTerm)) score += 1;
  }

  if (address) {
    if (city && address.includes(city)) score += 10;
    if (serviceArea && address.includes(serviceArea)) score += 6;
  }

  return score;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const search = normalize(req.query?.search);
  const userAddress = session?.user?.address || '';
  const canSeeAllStatuses = isPlatformAdmin(session?.user);

  const organizers = await prisma.organizer.findMany({
    where: {
      status: canSeeAllStatuses ? undefined : 'APPROVED',
    },
    include: {
      users: {
        where: { role: 'ORGANIZER_OWNER' },
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
      },
      reviews: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          reviewedStaff: { select: { id: true, name: true, avatarUrl: true } },
          event: { select: { id: true, name: true, date: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          products: true,
          events: true,
          users: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const filtered = organizers
    .map((organizer) => ({
      ...organizer,
      proximityScore: scoreOrganizer(organizer, search, userAddress),
    }))
    .filter((organizer) => {
      if (!search) return true;
      return organizer.proximityScore > 0;
    })
    .sort((a, b) => b.proximityScore - a.proximityScore || a.name.localeCompare(b.name, 'fr'));

  return res.status(200).json({
    organizers: filtered.map((organizer) => {
      const averageRating =
        organizer.reviews.length > 0
          ? organizer.reviews.reduce((sum, review) => sum + review.organizerRating, 0) / organizer.reviews.length
          : null;
      const staffReviews = organizer.reviews.filter((review) => review.staffRating);
      const staffAverageRating =
        staffReviews.length > 0
          ? staffReviews.reduce((sum, review) => sum + review.staffRating, 0) / staffReviews.length
          : null;

      return {
        id: organizer.id,
        name: organizer.name,
        slug: organizer.slug,
        status: organizer.status,
        city: organizer.city,
        address: organizer.address,
        serviceArea: organizer.serviceArea,
        description: organizer.description,
        coverImage: organizer.coverImage,
        portfolioImages: parseMediaList(organizer.portfolioImages),
        portfolioVideos: parseMediaList(organizer.portfolioVideos),
        owner: organizer.users[0] || null,
        counts: organizer._count,
        reviewSummary: {
          averageRating,
          staffAverageRating,
          totalReviews: organizer._count.reviews || 0,
        },
        reviews: organizer.reviews.slice(0, 8).map((review) => ({
          id: review.id,
          organizerRating: review.organizerRating,
          organizerComment: review.organizerComment,
          staffRating: review.staffRating,
          staffComment: review.staffComment,
          createdAt: review.createdAt,
          author: review.author
            ? {
                id: review.author.id,
                name: review.author.name,
                avatarUrl: review.author.avatarUrl,
              }
            : null,
          reviewedStaff: review.reviewedStaff
            ? {
                id: review.reviewedStaff.id,
                name: review.reviewedStaff.name,
                avatarUrl: review.reviewedStaff.avatarUrl,
              }
            : null,
          event: review.event
            ? {
                id: review.event.id,
                name: review.event.name,
                date: review.event.date,
              }
            : null,
        })),
        proximityScore: organizer.proximityScore,
      };
    }),
  });
}
