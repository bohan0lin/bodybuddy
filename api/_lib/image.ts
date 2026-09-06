import sharp from 'sharp'
import { ApiError } from './http.js'

export async function validateImage(base64: string, mime: string) {
  try {
    const bytes = Buffer.from(base64, 'base64')
    if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== base64) throw new Error('encoding')
    const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata()
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime]
    if (!expected || metadata.format !== expected || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) !== 1) throw new Error('metadata')
  } catch {
    throw new ApiError(400, 'INVALID_IMAGE', 'Use a JPEG, PNG or WebP image up to 2 MB and 4096 pixels per side.')
  }
}
