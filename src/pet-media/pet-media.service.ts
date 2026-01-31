import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PetMediaService {
  constructor(private prisma: PrismaService) {}

  async uploadAvatar(petId: number, file: Express.Multer.File) {
    const filename = `${uuidv4()}-${file.originalname}`;
    const uploadPath = join(process.cwd(), 'uploads/pet-avatars', filename);
    const relativePath = `/uploads/pet-avatars/${filename}`;

    // Save file locally
    const writeStream = createWriteStream(uploadPath);
    writeStream.write(file.buffer);
    writeStream.end();

    // Create PetMedia record
    const media = await this.prisma.petMedia.create({
      data: {
        petId,
        type: 'IMAGE',
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
}
