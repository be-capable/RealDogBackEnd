import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiHeaders, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DogAiService } from './dog-ai.service';
import { DogInterpretDto } from './dto/dog-interpret.dto';
import { DogSynthesizeDto } from './dto/dog-synthesize.dto';
import { APP_HEADERS } from '../common/swagger/app-headers';


@ApiTags('AI')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('ai/dog')
export class DogAiController {
  constructor(private readonly dogAiService: DogAiService) {}

  @Post('interpret')
  @ApiOperation({
    summary: 'Interpret Dog Audio',
    description: 'Upload dog audio (wav/mp3) to get a translation (meaning) and emotion analysis using AI.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['petId', 'audio'],
      properties: {
        petId: { type: 'integer', minimum: 1, description: 'Pet ID' },
        locale: { type: 'string', maxLength: 32, nullable: true, description: 'Locale (e.g. en-US)' },
        context: { type: 'string', maxLength: 200, nullable: true, description: 'Optional context description' },
        audio: { type: 'string', format: 'binary', description: 'Dog audio file (wav/mp3)' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Dog audio interpretation result',
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'integer', description: 'Created event ID' },
        inputAudioUrl: { type: 'string', description: 'URL of the uploaded audio' },
        outputAudioUrl: { oneOf: [{ type: 'string' }, { type: 'null' }], description: 'URL of generated meaning audio (optional)' },
        meaningText: { type: 'string', description: 'Translated meaning text' },
        labels: {
          type: 'object',
          properties: {
            dogEventType: { type: 'string' },
            stateType: { type: 'string', nullable: true },
            contextType: { type: 'string', nullable: true },
          },
        },
        confidence: { oneOf: [{ type: 'number' }, { type: 'null' }], description: 'Confidence score (0-1)' },
        modelVersion: { type: 'object', description: 'Model versions used' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mt = (file?.mimetype ?? '').toLowerCase();
        const ok = mt.startsWith('audio/') || mt === 'application/octet-stream' || mt === 'binary/octet-stream' || mt === '';
        cb(ok ? null : new BadRequestException('audio must be an audio file'), ok);
      },
    }),
  )
  interpret(
    @GetCurrentUserId() userId: number,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: DogInterpretDto,
  ) {
    if (!audio) throw new BadRequestException('audio is required');
    return this.dogAiService.interpretDogAudio({
      userId,
      petId: body.petId,
      locale: body.locale,
      context: body.context,
      audio,
    });
  }

  @Post('synthesize')
  @ApiOperation({
    summary: 'Synthesize Dog Audio (Sync)',
    description: 'Upload human audio to generate a corresponding dog vocalization synchronously. Warning: May timeout for long generation (use /synthesize-task instead).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['petId', 'audio'],
      properties: {
        petId: { type: 'integer', minimum: 1, description: 'Pet ID' },
        locale: { type: 'string', maxLength: 32, nullable: true, description: 'Locale (e.g. en-US)' },
        style: { type: 'string', maxLength: 32, nullable: true, description: 'Optional style (e.g. angry, happy)' },
        audio: { type: 'string', format: 'binary', description: 'Human voice audio file (wav/mp3)' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Synthesized dog audio result (Synchronous)',
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'integer', description: 'Created event ID' },
        inputAudioUrl: { type: 'string', description: 'URL of uploaded human audio' },
        outputAudioUrl: { type: 'string', description: 'URL of generated dog audio' },
        labels: {
          type: 'object',
          properties: {
            dogEventType: { type: 'string' },
          },
        },
        modelVersion: { type: 'object', description: 'Model versions used' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mt = (file?.mimetype ?? '').toLowerCase();
        const ok = mt.startsWith('audio/') || mt === 'application/octet-stream' || mt === 'binary/octet-stream' || mt === '';
        cb(ok ? null : new BadRequestException('audio must be an audio file'), ok);
      },
    }),
  )
  synthesize(
    @GetCurrentUserId() userId: number,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: DogSynthesizeDto,
  ) {
    if (!audio) throw new BadRequestException('audio is required');
    return this.dogAiService.synthesizeDogAudio({
      userId,
      petId: body.petId,
      locale: body.locale,
      style: body.style,
      audio,
    });
  }

  /**
   * Async Task Version for Synthesize (Polling)
   */
  @Post('synthesize-task')
  @ApiOperation({
    summary: 'Synthesize Dog Audio (Async)',
    description: 'Submit a task to synthesize dog audio. Returns a task ID immediately for polling status via GET /task/:id.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Submit a task to synthesize dog audio from human voice',
    schema: {
      type: 'object',
      required: ['petId', 'audio'],
      properties: {
        petId: { type: 'integer', minimum: 1, description: 'Pet ID' },
        locale: { type: 'string', maxLength: 32, nullable: true, description: 'Locale (e.g. en-US)' },
        style: { type: 'string', maxLength: 32, nullable: true, description: 'Optional style' },
        audio: { type: 'string', format: 'binary', description: 'Human voice audio file' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Task created successfully',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'UUID of the created task' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mt = (file?.mimetype ?? '').toLowerCase();
        const ok = mt.startsWith('audio/') || mt === 'application/octet-stream' || mt === 'binary/octet-stream' || mt === '';
        cb(ok ? null : new BadRequestException('audio must be an audio file'), ok);
      },
    }),
  )
  synthesizeTask(
    @GetCurrentUserId() userId: number,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: DogSynthesizeDto,
  ) {
    if (!audio) throw new BadRequestException('audio is required');
    return this.dogAiService.createSynthesizeTask({
      userId,
      petId: body.petId,
      locale: body.locale,
      style: body.style,
      audio,
    });
  }

  @Get('task/:id')
  @ApiOperation({
    summary: 'Get Task Status',
    description: 'Check the status and result of an async synthesis task. Returns the result object when status is COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'Task ID（Path）' })
  @ApiOkResponse({
    description: 'Get status of a synthesis task',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
        status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
        result: {
          type: 'object',
          nullable: true,
          description: 'Result object (same structure as synchronous response) if completed',
        },
        error: { type: 'string', nullable: true, description: 'Error message if failed' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  getTask(
    @GetCurrentUserId() userId: number,
    @Param('id') taskId: string,
  ) {
    return this.dogAiService.getTaskStatus(userId, taskId);
  }
}
