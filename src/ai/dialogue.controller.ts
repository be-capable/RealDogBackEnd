import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeaders, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DialogueService } from './dialogue.service';
import { DialogueTurnDto } from './dto/dialogue-turn.dto';
import { APP_HEADERS } from '../common/swagger/app-headers';

@ApiTags('AI')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('ai/dialogue')
export class DialogueController {
  constructor(private readonly dialogueService: DialogueService) {}

  @Post('turn')
  @ApiOperation({ summary: 'Chat Dialogue', description: 'Interact with the AI dog persona (chat turn).' })
  @ApiBody({ type: DialogueTurnDto })
  async turn(@GetCurrentUserId() userId: number, @Body() body: DialogueTurnDto) {
    const result = await this.dialogueService.turn({
      userId,
      mode: body.mode,
      inputText: body.inputText,
      petId: body.petId,
      locale: body.locale,
    });
    return { userId, ...result };
  }
}
