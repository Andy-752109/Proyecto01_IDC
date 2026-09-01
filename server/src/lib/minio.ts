import { Client as MinioClient } from 'minio';
import { env } from '../config/env';

export const minioClient = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export const IMAGES_BUCKET = env.MINIO_BUCKET;

export async function ensureBucketExists(): Promise<void> {
  const exists = await minioClient.bucketExists(IMAGES_BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(IMAGES_BUCKET);
  }
}
