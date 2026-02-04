import type { ApiHeaderOptions } from '@nestjs/swagger';

/**
 * 公共请求头定义
 *
 * 用于客户端请求时携带的公共信息，所有接口均可使用这些请求头。
 * 这些头信息主要用于:
 * - 版本控制和兼容性检查
 * - 设备识别和统计分析
 * - 请求安全验证 (签名、重放保护)
 */
export const APP_HEADERS: ApiHeaderOptions[] = [
  {
    name: 'X-App-Version',
    required: false,
    description: '客户端版本号（Header），如 1.2.3',
  },
  {
    name: 'X-App-Build',
    required: false,
    description: '客户端构建号（Header），用于区分不同构建版本',
  },
  {
    name: 'X-App-Device-Id',
    required: false,
    description: '设备唯一标识（Header），用于设备识别和推送',
  },
  {
    name: 'X-App-Platform',
    required: false,
    description: '平台标识（Header），如 ios / android / web',
  },
  {
    name: 'X-App-Timestamp',
    required: false,
    description: '请求时间戳（Header），毫秒级Unix时间戳，用于防重放',
  },
  {
    name: 'X-App-Nonce',
    required: false,
    description: '随机数/防重放保护（Header），每次请求唯一',
  },
  {
    name: 'X-App-Sign',
    required: false,
    description: '请求签名（Header），用于请求完整性校验',
  },
];
