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

/**
 * Pets Controller - 宠物管理接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 */
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

  /**
   * 创建宠物
   *
   * @param userId - 从Token中提取的用户ID
   * @param createPetDto - 宠物信息
   * @returns 创建的宠物详情
   * @throws BadRequestException - 数据验证失败
   */
  @Post()
  @ApiOperation({ summary: 'Create Pet', description: 'Add a new pet to the user\'s profile.' })
  @ApiBody({ type: CreatePetDto })
  create(
    @GetCurrentUserId() userId: number,
    @Body() createPetDto: CreatePetDto,
  ) {
    return this.petsService.create(userId, createPetDto);
  }

  /**
   * 上传宠物头像
   *
   * @param userId - 从Token中提取的用户ID
   * @param id - 宠物ID (Path)
   * @param file - 图片文件 (Form-Data)
   * @returns 头像媒体信息
   * @throws BadRequestException - 文件缺失或格式不支持
   * @throws NotFoundException - 宠物不存在或无权限
   */
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

  /**
   * 获取用户所有宠物列表
   *
   * @param userId - 从Token中提取的用户ID
   * @returns 宠物列表 (包含头像媒体信息)
   */
  @Get()
  @ApiOperation({ summary: 'List Pets', description: 'Get all pets owned by the current user.' })
  findAll(@GetCurrentUserId() userId: number) {
    return this.petsService.findAll(userId);
  }

  /**
   * 获取单个宠物详情
   *
   * @param userId - 从Token中提取的用户ID
   * @param id - 宠物ID (Path)
   * @returns 宠物详情 (包含头像和媒体列表)
   * @throws NotFoundException - 宠物不存在或无权限
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get Pet', description: 'Get detailed information about a specific pet.' })
  @ApiParam({ name: 'id', description: 'Pet ID' })
  findOne(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.findOne(userId, id);
  }

  /**
   * 更新宠物信息
   *
   * @param userId - 从Token中提取的用户ID
   * @param id - 宠物ID (Path)
   * @param updatePetDto - 要更新的字段
   * @returns 更新后的宠物详情
   * @throws NotFoundException - 宠物不存在或无权限
   */
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

  /**
   * 删除宠物
   *
   * @param userId - 从Token中提取的用户ID
   * @param id - 宠物ID (Path)
   * @returns 删除结果
   * @throws NotFoundException - 宠物不存在或无权限
   * @note 删除后无法恢复
   */
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
