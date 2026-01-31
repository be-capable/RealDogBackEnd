import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createWriteStream, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class PetMediaService {
  constructor(private prisma: PrismaService) {}

  private saveLocalFile(dir: string, file: Express.Multer.File) {
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}-${file.originalname}`;
    const uploadPath = join(dir, filename);
    const writeStream = createWriteStream(uploadPath);
    writeStream.write(file.buffer);
    writeStream.end();
    return filename;
  }

  private async assertPetOwnership(userId: number, petId: number) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId: userId },
      select: { id: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
  }

  async uploadAvatar(petId: number, file: Express.Multer.File) {
    const dir = join(process.cwd(), 'uploads/pet-avatars');
    const filename = this.saveLocalFile(dir, file);
    const relativePath = `/uploads/pet-avatars/${filename}`;

    // Create PetMedia record
    const media = await this.prisma.petMedia.create({
      data: {
        petId,
        type: 'AVATAR',
        objectKey: relativePath,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    // Link to Pet Avatar
    await this.prisma.pet.update({
      where: { id: petId },
      data: { avatarMediaId: media.id },
    });

    return media;
  }

  async uploadToGallery(
    userId: number,
    petId: number,
    file: Express.Multer.File,
    type: 'PHOTO' | 'VIDEO',
  ) {
    await this.assertPetOwnership(userId, petId);
    const dir = join(process.cwd(), 'uploads/pet-media');
    const filename = this.saveLocalFile(dir, file);
    const relativePath = `/uploads/pet-media/${filename}`;

    return this.prisma.petMedia.create({
      data: {
        petId,
        type,
        objectKey: relativePath,
        contentType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async listByPet(userId: number, petId: number) {
    await this.assertPetOwnership(userId, petId);
    return this.prisma.petMedia.findMany({
      where: { petId },
      orderBy: [{ id: 'desc' }],
    });
  }

  async deleteMedia(userId: number, mediaId: number) {
    const media = await this.prisma.petMedia.findFirst({
      where: {
        id: mediaId,
        pet: { ownerId: userId },
      },
    });
    if (!media) throw new NotFoundException('Media not found');

    await this.prisma.petMedia.delete({ where: { id: media.id } });

    if (media.objectKey?.startsWith('/uploads/')) {
      const relative = media.objectKey.replace(/^\/uploads\//, '');
      const absolute = join(process.cwd(), 'uploads', relative);
      try {
        await unlink(absolute);
      } catch (_) {}
    }
    return { message: 'Deleted' };
  }
}
