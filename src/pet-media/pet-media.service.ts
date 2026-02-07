import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class PetMediaService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private i18nService: I18nService,
  ) {}

  private async assertPetOwnership(userId: number, petId: number, lang: string = 'en') {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId: userId },
      select: { id: true },
    });
    if (!pet) throw new NotFoundException(this.i18nService.t('Pet not found', lang));
  }

  async uploadAvatar(petId: number, file: Express.Multer.File, lang: string = 'en') {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException(this.i18nService.t('Storage not configured', lang));
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
    lang: string = 'en',
  ) {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException(this.i18nService.t('Storage not configured', lang));
    }

    await this.assertPetOwnership(userId, petId, lang);
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

  async listByPet(userId: number, petId: number, page = 1, limit = 20, lang: string = 'en') {
    await this.assertPetOwnership(userId, petId, lang);

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

  async deleteMedia(userId: number, mediaId: number, lang: string = 'en') {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException(this.i18nService.t('Storage not configured', lang));
    }

    const media = await this.prisma.petMedia.findFirst({
      where: {
        id: mediaId,
        Pet_PetMedia_petIdToPet: { ownerId: userId },
      },
    });
    if (!media) throw new NotFoundException(this.i18nService.t('Media not found', lang));

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

    return { message: this.i18nService.t('Deleted', lang) };
  }

  async deleteAllByPet(userId: number, petId: number, lang: string = 'en') {
    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException(this.i18nService.t('Storage not configured', lang));
    }

    await this.assertPetOwnership(userId, petId, lang);

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

    return { message: this.i18nService.t('All media deleted', lang) };
  }
}
