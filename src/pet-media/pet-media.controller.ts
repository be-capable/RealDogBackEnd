import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
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

/**
 * Pet Media Controller - 宠物媒体管理接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 *
 * 功能说明:
 * - 上传宠物相册照片/视频
 * - 获取宠物媒体列表
 * - 删除媒体文件
 */
@ApiTags('Pet Media')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller()
export class PetMediaController {
  constructor(private readonly petMediaService: PetMediaService) {}

  /**
   * 上传宠物相册媒体
   *
   * @param userId - 从Token中提取的用户ID
   * @param petId - 宠物ID (Path)
   * @param file - 媒体文件 (Form-Data, 支持图片/视频)
   * @param body - 媒体类型
   * @returns 创建的媒体记录
   * @throws BadRequestException - 文件缺失或类型不支持
   * @throws NotFoundException - 宠物不存在或无权限
   */
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

  /**
   * 获取宠物相册列表
   *
   * @param userId - 从Token中提取的用户ID
   * @param petId - 宠物ID (Path)
   * @param page - 页码 (Query, 可选，默认1)
   * @param limit - 每页数量 (Query, 可选，默认20)
   * @returns 媒体记录列表 (按时间倒序)
   * @throws NotFoundException - 宠物不存在或无权限
   */
  @Get('pets/:petId/media')
  @ApiOperation({ summary: 'List Media', description: 'Retrieve all gallery items for a pet.' })
  @ApiParam({ name: 'petId', description: 'Pet ID' })
  listByPet(
    @GetCurrentUserId() userId: number,
    @Param('petId', ParseIntPipe) petId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.petMediaService.listByPet(
      userId,
      petId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  /**
   * 删除宠物媒体
   *
   * @param userId - 从Token中提取的用户ID
   * @param mediaId - 媒体ID (Path)
   * @returns 删除结果
   * @throws NotFoundException - 媒体不存在或无权限
   * @note 删除后无法恢复
   */
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
