import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class PetMediaService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  private async assertPetOwnership(userId: number, petId: number) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId: userId },
      select: { id: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
  }

  async uploadAvatar(petId: number, file: Express.Multer.File) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    const key = this.s3Service.generateMediaKey(petId, file.originalname, 'AVATAR');
    const { url } = await this.s3Service.upload(file.buffer, key, file.mimetype);

    const media = await this.prisma.petMedia.create({
      data: {
        petId,
        type: 'AVATAR',
        objectKey: key,
        contentType: file.mimetype,
        sizeBytes: file.size,
        createdAt: new Date(),
      },
    });

    await this.prisma.pet.update({
      where: { id: petId },
      data: { avatarMediaId: media.id },
    });

    return { ...media, url };
  }

  async uploadToGallery(
    userId: number,
    petId: number,
    file: Express.Multer.File,
    type: 'PHOTO' | 'VIDEO',
  ) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    await this.assertPetOwnership(userId, petId);
    const key = this.s3Service.generateMediaKey(petId, file.originalname, type);
    const { url } = await this.s3Service.upload(file.buffer, key, file.mimetype);

    return this.prisma.petMedia.create({
      data: {
        petId,
        type,
        objectKey: key,
        contentType: file.mimetype,
        sizeBytes: file.size,
        createdAt: new Date(),
      },
    });
  }

  async listByPet(userId: number, petId: number, page = 1, limit = 20) {
    await this.assertPetOwnership(userId, petId);

    const [data, total] = await Promise.all([
      this.prisma.petMedia.findMany({
        where: { petId, type: { in: ['PHOTO', 'VIDEO'] } },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.petMedia.count({ where: { petId, type: { in: ['PHOTO', 'VIDEO'] } } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async deleteMedia(userId: number, mediaId: number) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    const media = await this.prisma.petMedia.findFirst({
      where: {
        id: mediaId,
        Pet_PetMedia_petIdToPet: { ownerId: userId },
      },
    });
    if (!media) throw new NotFoundException('Media not found');

    if (media.type === 'AVATAR') {
      await this.prisma.pet.updateMany({
        where: { avatarMediaId: media.id },
        data: { avatarMediaId: null },
      });
    }

    await this.prisma.petMedia.delete({ where: { id: media.id } });

    try {
      await this.s3Service.delete(media.objectKey);
    } catch (_) {}

    return { message: 'Deleted' };
  }

  async deleteAllByPet(userId: number, petId: number) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    await this.assertPetOwnership(userId, petId);

    const media = await this.prisma.petMedia.findMany({
      where: { petId },
    });

    for (const m of media) {
      try {
        await this.s3Service.delete(m.objectKey);
      } catch (_) {}
    }

    await this.prisma.petMedia.deleteMany({
      where: { petId },
    });

    return { message: 'All media deleted' };
  }
}
