import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeaders, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from '../auth/common/guards/at.guard';
import { GetCurrentUserId } from '../auth/common/decorators/get-current-user-id.decorator';
import { DialogueService } from './dialogue.service';
import { DialogueTurnDto } from './dto/dialogue-turn.dto';
import { APP_HEADERS } from '../common/swagger/app-headers';

/**
 * Dialogue Controller - 人狗对话接口
 *
 * 认证方式: Bearer Token (Access Token)
 * 公共请求头: 参见 APP_HEADERS
 *
 * 模式说明:
 * - DOG_TO_HUMAN: 狗叫翻译模式 (输入狗叫描述，输出人类理解)
 * - HUMAN_TO_DOG: 人狗对话模式 (输入人类话语，输出狗的反应)
 */
@ApiTags('AI')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('ai/dialogue')
export class DialogueController {
  constructor(private readonly dialogueService: DialogueService) {}

  /**
   * 人狗对话 - 单轮交互
   *
   * @param userId - 从Token中提取的用户ID
   * @param dto - 对话参数
   * @returns mode: 对话模式
   * @returns inputText: 输入文本
   * @returns outputText: AI生成的输出文本
   * @returns dogEventType: 狗叫类型 (可选)
   * @returns confidence: 置信度 (可选)
   * @returns raw: 原始AI响应 (当无法解析JSON时)
   * @throws ServiceUnavailableException - AI服务未配置
   * @throws GatewayTimeoutException - AI请求超时 (15秒)
   * @throws BadGatewayException - AI服务异常
   */
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
