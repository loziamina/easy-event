import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { writeAudit } from '../../../lib/audit';
import { ROLES } from '../../../lib/permissions';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function createUniqueOrganizerSlug(name) {
  const base = slugify(name) || 'organizer';
  let slug = base;
  let attempt = 1;

  while (await prisma.organizer.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return slug;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const {
    email,
    password,
    name,
    phone,
    address,
    accountType = 'CLIENT',
    organizerName,
    organizerCity,
    organizerAddress,
    organizerServiceArea,
    organizerDescription,
  } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  // block registering as admin via UI
  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedEmail === (process.env.ADMIN_EMAIL || 'admin@easyevent.com').toLowerCase()) {
    return res.status(403).json({ message: 'This email is reserved.' });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ message: 'Email already used' });

  const hashed = await bcrypt.hash(password, 10);
  const isOrganizerSignup = String(accountType).toUpperCase() === 'ORGANIZER';

  if (isOrganizerSignup && !organizerName) {
    return res.status(400).json({ message: "Le nom de l'organisateur est requis" });
  }

  const user = await prisma.$transaction(async (tx) => {
    let organizer = null;

    if (isOrganizerSignup) {
      organizer = await tx.organizer.create({
        data: {
          name: String(organizerName).trim(),
          slug: await createUniqueOrganizerSlug(organizerName),
          city: organizerCity ? String(organizerCity).trim() : null,
          address: organizerAddress ? String(organizerAddress).trim() : null,
          serviceArea: organizerServiceArea ? String(organizerServiceArea).trim() : null,
          description: organizerDescription ? String(organizerDescription).trim() : null,
          status: 'PENDING',
        },
      });
    }

    return tx.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        phone: phone || null,
        address: address || null,
        password: hashed,
        role: isOrganizerSignup ? ROLES.ORGANIZER_OWNER : ROLES.CLIENT,
        organizerId: organizer?.id || null,
      },
      include: { organizer: true },
    });
  });

  await writeAudit({
    actorId: user.id,
    action: 'USER_REGISTERED',
    entity: 'User',
    entityId: user.id,
    details: {
      email: user.email,
      role: user.role,
      organizerId: user.organizerId || null,
      organizerStatus: user.organizer?.status || null,
    },
  });

  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    role: user.role,
    organizer: user.organizer
      ? {
          id: user.organizer.id,
          name: user.organizer.name,
          status: user.organizer.status,
        }
      : null,
  });
}
