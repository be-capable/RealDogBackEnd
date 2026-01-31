import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Species } from './enums/pet.enum';

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createPetDto: CreatePetDto) {
    return this.prisma.pet.create({
      data: {
        name: createPetDto.name,
        sex: createPetDto.sex,
        birthDate: new Date(createPetDto.birthDate),
        breedId: createPetDto.breedId,
        isSpayedNeutered: createPetDto.isSpayedNeutered,
        species: Species.DOG,
        owner: {
          connect: { id: userId },
        },
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.pet.findMany({
      where: { ownerId: userId },
      include: { avatarMedia: true },
    });
  }

  async findOne(userId: number, id: number) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, ownerId: userId },
      include: { avatarMedia: true, media: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    return pet;
  }

  async update(userId: number, id: number, updatePetDto: UpdatePetDto) {
    const pet = await this.findOne(userId, id); // Ensure ownership
    return this.prisma.pet.update({
      where: { id: pet.id },
      data: updatePetDto,
    });
  }

  async remove(userId: number, id: number) {
    const pet = await this.findOne(userId, id); // Ensure ownership
    return this.prisma.pet.delete({
      where: { id: pet.id },
    });
  }
}
