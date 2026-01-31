import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeaders, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { PetMediaService } from './pet-media.service';
import { UploadPetMediaDto } from './dto/upload-pet-media.dto';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('Pet Media')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller()
export class PetMediaController {
  constructor(private readonly petMediaService: PetMediaService) {}

  @Post('pets/:petId/media')
  @ApiOperation({ summary: 'Upload Media', description: 'Upload a photo or video to the pet\'s gallery.' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Media file' },
        type: { type: 'string', enum: ['PHOTO', 'VIDEO'], description: 'Type of media' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadToGallery(
    @GetCurrentUserId() userId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPetMediaDto,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.petMediaService.uploadToGallery(userId, petId, file, body.type);
  }

  @Get('pets/:petId/media')
  @ApiOperation({ summary: 'List Media', description: 'Retrieve all gallery items for a pet.' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  listByPet(
    @GetCurrentUserId() userId: number,
    @Param('petId', ParseIntPipe) petId: number,
  ) {
    return this.petMediaService.listByPet(userId, petId);
  }

  @Delete('media/:mediaId')
  @ApiOperation({ summary: 'Delete Media', description: 'Remove a media item from the gallery.' })
  @ApiParam({ name: 'mediaId', description: 'Media ID' })
  deleteMedia(
    @GetCurrentUserId() userId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
  ) {
    return this.petMediaService.deleteMedia(userId, mediaId);
  }
}
