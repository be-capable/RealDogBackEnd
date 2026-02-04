import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const logger = new Logger('UsersService');

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  async findOne(id: number) {
    if (!id || Number.isNaN(id)) {
      return null;
    }
    
    const user = await this.prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const updateData: any = {};
    if (updateUserDto.name !== undefined) {
      updateData.name = updateUserDto.name;
    }
    if (updateUserDto.email !== undefined) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: updateUserDto.email, id: { not: id } },
      });
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
      updateData.email = updateUserDto.email;
    }
    
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * 删除用户账户及其所有相关数据
   * 符合 GDPR/CCPA 数据删除要求
   */
  async remove(id: number) {
    // 1. 获取用户的所有宠物ID
    const pets = await this.prisma.pet.findMany({
      where: { ownerId: id },
      select: { id: true },
    });
    const petIds = pets.map((pet) => pet.id);

    // 2. 删除所有宠物的媒体文件记录
    if (petIds.length > 0) {
      await this.prisma.petMedia.deleteMany({
        where: {
          OR: [
            { petId: { in: petIds } },
            { Pet_Pet_avatarMediaIdToPetMedia: { ownerId: id } },
          ],
        },
      });
    }

    // 3. 删除所有宠物相关的事件
    if (petIds.length > 0) {
      await this.prisma.dogEvent.deleteMany({
        where: { petId: { in: petIds } },
      });
    }

    // 4. 删除所有任务记录
    await this.prisma.dogTask.deleteMany({
      where: { userId: id },
    });

    // 5. 删除所有宠物
    await this.prisma.pet.deleteMany({
      where: { ownerId: id },
    });

    // 6. 最后删除用户账户
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'User account and all associated data have been permanently deleted',
      deletedAt: new Date().toISOString(),
    };
  }

  /**
   * 导出用户所有数据（GDPR数据可携带权）
   */
  async exportUserData(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        Pet: {
          include: {
            PetMedia_PetMedia_petIdToPet: true,
            DogEvent: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 获取用户的任务记录
    const tasks = await this.prisma.dogTask.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    // 构造导出数据结构
    const exportData = {
      exportInfo: {
        exportDate: new Date().toISOString(),
        appName: 'RealDog',
        version: '1.0',
        format: 'JSON',
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        // 注意：不包含敏感信息如密码哈希、refresh token等
      },
      pets: user.Pet.map((pet) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        sex: pet.sex,
        birthDate: pet.birthDate.toISOString(),
        breedId: pet.breedId,
        isSpayedNeutered: pet.isSpayedNeutered,
        createdAt: pet.createdAt.toISOString(),
        updatedAt: pet.updatedAt.toISOString(),
        avatarMediaId: pet.avatarMediaId,
        media: pet.PetMedia_PetMedia_petIdToPet.map((m) => ({
          id: m.id,
          type: m.type,
          objectKey: m.objectKey,
          contentType: m.contentType,
          sizeBytes: m.sizeBytes,
          width: m.width,
          height: m.height,
          durationMs: m.durationMs,
          createdAt: m.createdAt.toISOString(),
        })),
        events: pet.DogEvent.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          stateType: e.stateType,
          contextType: e.contextType,
          confidence: e.confidence,
          meaningText: e.meaningText,
          inputTranscript: e.inputTranscript,
          audioUrl: e.audioUrl,
          outputAudioUrl: e.outputAudioUrl,
          mode: e.mode,
          createdAt: e.createdAt.toISOString(),
        })),
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        petId: t.petId,
        type: t.type,
        status: t.status,
        result: t.result,
        error: t.error,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };

    return exportData;
  }
}
