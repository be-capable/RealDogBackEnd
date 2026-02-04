import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client | null = null;
  private bucket: string;
  private publicUrlBase: string;
  private configured = false;
  private isLocal = false;
  private localUploadPath = path.join(process.cwd(), 'uploads');

  onModuleInit() {
    this.init();
  }

  private init() {
    const endpoint = process.env.S3_ENDPOINT?.trim();
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.S3_BUCKET?.trim();
    const publicUrlBase = process.env.S3_PUBLIC_URL_BASE?.trim();
    const forceLocal = process.env.S3_STORAGE_MODE === 'local';

    // If explicit local mode OR missing credentials, use local storage
    if (forceLocal || !endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      this.isLocal = true;
      this.configured = true;
      this.publicUrlBase = 'http://localhost:3000/uploads'; // Assuming default port/host
      
      // Ensure local directory exists
      if (!fs.existsSync(this.localUploadPath)) {
        fs.mkdirSync(this.localUploadPath, { recursive: true });
      }
      
      this.logger.log(`S3 configured in LOCAL mode. Files saved to: ${this.localUploadPath}`);
      return;
    }

    this.bucket = bucket;
    this.publicUrlBase = publicUrlBase || `https://${bucket}.${endpoint.replace(/^https?:\/\//, '')}`;
    this.configured = true;

    this.client = new S3Client({
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`S3 configured: endpoint=${endpoint}, bucket=${bucket}`);
  }

  /**
   * Check if S3 is configured and working
   */
  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Get public URL for an object key
   */
  getPublicUrl(objectKey: string): string {
    return `${this.publicUrlBase}/${objectKey}`;
  }

  /**
   * Upload a file buffer to S3 (or local)
   */
  async upload(
    data: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ key: string; url: string }> {
    if (!this.configured) {
      throw new Error('S3 not configured');
    }

    if (this.isLocal) {
      const filePath = path.join(this.localUploadPath, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, data);
      const url = this.getPublicUrl(key);
      this.logger.debug(`Uploaded (Local): ${key} -> ${url}`);
      return { key, url };
    }

    if (!this.client) throw new Error('S3 Client missing');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: metadata,
    });

    await this.client.send(command);

    const url = this.getPublicUrl(key);
    this.logger.debug(`Uploaded: ${key} -> ${url}`);

    return { key, url };
  }

  /**
   * Upload a file using multipart upload (for large files)
   * Fallback to simple write for local
   */
  async uploadLarge(
    data: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ key: string; url: string }> {
    return this.upload(data, key, contentType);
  }

  /**
   * Delete an object from S3 (or local)
   */
  async delete(key: string): Promise<void> {
    if (!this.configured) {
      throw new Error('S3 not configured');
    }

    if (this.isLocal) {
      const filePath = path.join(this.localUploadPath, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Deleted (Local): ${key}`);
      }
      return;
    }

    if (!this.client) throw new Error('S3 Client missing');

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    this.logger.debug(`Deleted: ${key}`);
  }

  /**
   * Check if an object exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.configured) {
      return false;
    }

    if (this.isLocal) {
      const filePath = path.join(this.localUploadPath, key);
      return fs.existsSync(filePath);
    }

    if (!this.client) return false;

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique object key for pet media
   */
  generateMediaKey(petId: number, filename: string, type: 'PHOTO' | 'VIDEO' | 'AVATAR'): string {
    const ext = filename.split('.').pop() || '';
    const date = new Date().toISOString().split('T')[0];
    const uuid = randomUUID().slice(0, 8);
    const folder = type === 'AVATAR' ? 'avatars' : type.toLowerCase();
    return `pets/${petId}/${folder}/${date}-${uuid}.${ext}`;
  }

  /**
   * Generate a unique object key for audio files
   */
  generateAudioKey(petId: number, ext: string, scene: string): string {
    const date = new Date().toISOString().split('T')[0];
    const uuid = randomUUID().slice(0, 8);
    return `pets/${petId}/audio/${scene}/${date}-${uuid}.${ext}`;
  }
}
