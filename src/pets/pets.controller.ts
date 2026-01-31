import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetsService } from './pets.service';
import { PetMediaService } from '../pet-media/pet-media.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { AtGuard } from '../auth/common/guards/at.guard';

@UseGuards(AtGuard)
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly petMediaService: PetMediaService,
  ) {}

  @Post()
  create(
    @GetCurrentUserId() userId: number,
    @Body() createPetDto: CreatePetDto,
  ) {
    return this.petsService.create(userId, createPetDto);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Verify ownership
    await this.petsService.findOne(userId, id);
    return this.petMediaService.uploadAvatar(id, file);
  }

  @Get()
  findAll(@GetCurrentUserId() userId: number) {
    return this.petsService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePetDto: UpdatePetDto,
  ) {
    return this.petsService.update(userId, id, updatePetDto);
  }

  @Delete(':id')
  remove(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.remove(userId, id);
  }
}
