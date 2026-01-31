import type { ApiHeaderOptions } from '@nestjs/swagger';

export const APP_HEADERS: ApiHeaderOptions[] = [
  {
    name: 'X-App-Version',
    required: false,
    description: '客户端版本号（Header）',
  },
  {
    name: 'X-App-Build',
    required: false,
    description: '客户端构建号（Header）',
  },
  {
    name: 'X-App-Device-Id',
    required: false,
    description: '设备唯一标识（Header）',
  },
  {
    name: 'X-App-Platform',
    required: false,
    description: '平台标识（Header），如 ios/android/web',
  },
  {
    name: 'X-App-Timestamp',
    required: false,
    description: '请求时间戳（Header），毫秒',
  },
  {
    name: 'X-App-Nonce',
    required: false,
    description: '随机数/重放保护（Header）',
  },
  {
    name: 'X-App-Sign',
    required: false,
    description: '请求签名（Header）',
  },
];
