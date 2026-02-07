import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Species } from './enums/pet.enum';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class PetsService {
  constructor(
    private prisma: PrismaService,
    private i18nService: I18nService,
  ) {}

  async create(userId: number, createPetDto: CreatePetDto) {
    // Explicitly cast to any to bypass strict Prisma generated type checks
    // The database schema supports these fields.
    const createData: any = {
      name: createPetDto.name,
      sex: createPetDto.sex,
      birthDate: new Date(createPetDto.birthDate),
      breedId: createPetDto.breedId,
      isSpayedNeutered: createPetDto.isSpayedNeutered,
      species: Species.DOG,
      ownerId: userId,
      updatedAt: new Date(),
    };

    return this.prisma.pet.create({
      data: createData,
    });
  }

  async findAll(userId: number) {
    return this.prisma.pet.findMany({
      where: { ownerId: userId },
      include: { PetMedia_Pet_avatarMediaIdToPetMedia: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, id: number, lang: string = 'en') {
    const pet = await this.prisma.pet.findFirst({
      where: { id, ownerId: userId },
      include: { PetMedia_Pet_avatarMediaIdToPetMedia: true, PetMedia_PetMedia_petIdToPet: true },
    });
    if (!pet) throw new NotFoundException(this.i18nService.t('Pet not found', lang));
    return pet;
  }

  async update(userId: number, id: number, updatePetDto: UpdatePetDto) {
    const pet = await this.findOne(userId, id);
    return this.prisma.pet.update({
      where: { id: pet.id },
      data: {
        name: updatePetDto.name,
        sex: updatePetDto.sex,
        birthDate: updatePetDto.birthDate ? new Date(updatePetDto.birthDate) : undefined,
        isSpayedNeutered: updatePetDto.isSpayedNeutered,
      } as any,
    });
  }

  async remove(userId: number, id: number, lang: string = 'en') {
    const pet = await this.findOne(userId, id, lang);
    await this.prisma.pet.delete({
      where: { id: pet.id },
    });
    return {
      message: this.i18nService.t('Pet deleted successfully', lang),
      deletedId: pet.id,
    };
  }

  async findByOwnerId(ownerId: number) {
    return await this.prisma.pet.findMany({
      where: { ownerId },
    });
  }
}
