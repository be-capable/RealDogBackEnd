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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeaders, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetsService } from './pets.service';
import { PetMediaService } from '../pet-media/pet-media.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { AtGuard } from '../auth/common/guards/at.guard';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Pets')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly petMediaService: PetMediaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create Pet', description: 'Add a new pet to the user\'s profile.' })
  @ApiBody({ type: CreatePetDto })
  create(
    @GetCurrentUserId() userId: number,
    @Body() createPetDto: CreatePetDto,
  ) {
    return this.petsService.create(userId, createPetDto);
  }

  @Post(':id/avatar')
  @ApiOperation({ summary: 'Upload Avatar', description: 'Upload a profile picture for the pet.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file (jpg/png)' },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Pet ID' })
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
  @ApiOperation({ summary: 'List Pets', description: 'Get all pets owned by the current user.' })
  findAll(@GetCurrentUserId() userId: number) {
    return this.petsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Pet', description: 'Get detailed information about a specific pet.' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  findOne(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Pet', description: 'Update pet details.' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  @ApiBody({ type: UpdatePetDto })
  update(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePetDto: UpdatePetDto,
  ) {
    return this.petsService.update(userId, id, updatePetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Pet', description: 'Remove a pet from the system.' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  remove(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.remove(userId, id);
  }
}
