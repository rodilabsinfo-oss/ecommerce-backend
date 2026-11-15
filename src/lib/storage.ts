/**
 * Where uploaded photos are kept. Development: ./uploads served by this API.
 * Production: any S3-compatible bucket (AWS S3, Cloudflare R2, …) behind a CDN.
 */
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

export interface Storage {
  /** Saves the file and returns its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Removes a file this storage created (by its URL). Unknown URLs are ignored. */
  removeByUrl(url: string): Promise<void>;
}

class LocalStorage implements Storage {
  private root = path.resolve('uploads');
  private base = `${env.PUBLIC_URL.replace(/\/$/, '')}/uploads/`;

  async put(key: string, body: Buffer) {
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return this.base + key;
  }

  async removeByUrl(url: string) {
    if (!url.startsWith(this.base)) return;
    const file = path.join(this.root, url.slice(this.base.length));
    if (!file.startsWith(this.root)) return; // never leave the uploads folder
    await unlink(file).catch(() => undefined);
  }
}

class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private base: string;

  constructor() {
    if (!env.S3_BUCKET || !env.S3_PUBLIC_URL || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error('STORAGE_DRIVER=s3 needs S3_BUCKET, S3_PUBLIC_URL, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
    }
    this.bucket = env.S3_BUCKET;
    this.base = `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/`;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable', // keys are unique, so cache forever
      }),
    );
    return this.base + key;
  }

  async removeByUrl(url: string) {
    if (!url.startsWith(this.base)) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: url.slice(this.base.length) })).catch(() => undefined);
  }
}

export const storage: Storage = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
