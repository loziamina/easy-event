import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

function safeFolder(category) {
  if (category === 'avatar') return 'avatars';
  if (category === 'cover') return 'covers';
  if (category === 'portfolio-image') return 'portfolio-images';
  if (category === 'portfolio-video') return 'portfolio-videos';
  return 'misc';
}

async function uploadToSupabase({ folder, finalName, buffer, mime }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const objectPath = `${folder}/${finalName}`;
  const { error } = await supabase.storage
    .from('uploads')
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from('uploads').getPublicUrl(objectPath);
  return data.publicUrl;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { dataUrl, category = 'misc', filename = '' } = req.body || {};
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ message: 'Invalid file data' });
    }

    const ext = MIME_TO_EXT[parsed.mime];
    if (!ext) {
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    const buffer = Buffer.from(parsed.base64, 'base64');
    const maxBytes = category === 'portfolio-video' ? 25 * 1024 * 1024 : 6 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(400).json({ message: 'File too large' });
    }

    const safeName = String(filename || 'media')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'media';
    const folder = safeFolder(category);
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${ext}`;

    const publicUrl = await uploadToSupabase({
      folder,
      finalName,
      buffer,
      mime: parsed.mime,
    });

    if (publicUrl) {
      return res.status(201).json({
        url: publicUrl,
        mime: parsed.mime,
        size: buffer.length,
      });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    await fs.mkdir(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, finalName);
    await fs.writeFile(fullPath, buffer);

    return res.status(201).json({
      url: `/uploads/${folder}/${finalName}`,
      mime: parsed.mime,
      size: buffer.length,
    });
  } catch (error) {
    console.error('API /uploads error:', error);
    return res.status(500).json({ message: 'Server error', error: String(error?.message || error) });
  }
}
