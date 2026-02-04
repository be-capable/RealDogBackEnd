# RealDog API 测试文档

## 概述

本文档描述了 RealDog 项目后端 API 的测试方法和测试脚本。

## 测试脚本

### 1. Shell 测试脚本 (`test_all_endpoints.sh`)

基于 bash 的轻量级测试脚本，适用于快速验证 API 端点。

**使用方法:**
```bash
cd RealDogBackEnd
./test_all_endpoints.sh
```

**特点:**
- 无需安装额外依赖
- 实时显示测试进度
- 支持颜色输出
- 自动生成测试摘要

### 2. Node.js 测试脚本 (`test_api_endpoints.js`)

完整的 Node.js 测试套件，提供详细的测试报告。

**使用方法:**
```bash
cd RealDogBackEnd
node test_api_endpoints.js
```

**特点:**
- 详细的测试报告
- 自动保存结果到 JSON 文件
- 支持测试数据持久化
- 错误追踪和日志记录

## API 端点列表

### 公共端点 (无需认证)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 健康检查 |
| GET | `/dicts/dog-breeds` | 获取犬种列表 |

### 认证端点

| 方法 | 端点 | 描述 | 请求体 |
|------|------|------|--------|
| POST | `/auth/register` | 用户注册 | `{email, password, name}` |
| POST | `/auth/login` | 用户登录 | `{email, password}` |
| POST | `/auth/logout` | 退出登录 | - |
| POST | `/auth/refresh` | 刷新 Token | `{refreshToken}` |
| GET | `/auth/verify` | 验证 Token | - |

### 用户端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/users` | 获取当前用户 | ✅ |
| GET | `/users/:id` | 获取用户详情 | ✅ |
| PATCH | `/users/:id` | 更新用户 | ✅ |

### 宠物端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/pets` | 创建宠物 | ✅ |
| GET | `/pets` | 获取宠物列表 | ✅ |
| GET | `/pets/:id` | 获取宠物详情 | ✅ |
| PATCH | `/pets/:id` | 更新宠物 | ✅ |
| DELETE | `/pets/:id` | 删除宠物 | ✅ |
| POST | `/pets/:id/avatar` | 上传宠物头像 | ✅ |

### 宠物媒体端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/pets/:petId/media` | 获取宠物媒体列表 | ✅ |
| POST | `/pets/:petId/media` | 上传宠物媒体 | ✅ |
| DELETE | `/media/:mediaId` | 删除媒体 | ✅ |

### 宠物事件端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/pets/:petId/events` | 创建宠物事件 | ✅ |
| GET | `/pets/:petId/events` | 获取宠物事件列表 | ✅ |
| GET | `/events/:eventId` | 获取事件详情 | ✅ |

### AI 功能端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/ai/dog/interpret` | 解读狗叫 | ✅ |
| POST | `/ai/dog/synthesize` | 合成狗叫语音 | ✅ |
| POST | `/ai/dog/synthesize-task` | 异步合成任务 | ✅ |
| GET | `/ai/dog/task/:id` | 获取合成任务状态 | ✅ |
| POST | `/ai/dialogue/turn` | AI 对话 | ✅ |

### 首页端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/home` | 获取首页数据 | ✅ |

## 测试流程

### 1. 环境准备

```bash
# 启动后端服务
cd RealDogBackEnd
npm run start:dev

# 在另一个终端运行测试
cd RealDogBackEnd
./test_all_endpoints.sh
# 或
node test_api_endpoints.js
```

### 2. 测试顺序

测试脚本按照以下顺序执行:

1. **公共端点测试** - 验证服务器可用性
2. **认证流程测试** - 注册 → 登录 → 验证 → 刷新
3. **用户端点测试** - CRUD 操作
4. **宠物端点测试** - 创建、读取、更新
5. **媒体端点测试** - 宠物相册
6. **事件端点测试** - 宠物事件记录
7. **AI 功能测试** - 解读和合成
8. **安全测试** - 验证未认证访问被拒绝

### 3. 测试数据

测试过程中会创建以下数据:
- 1 个测试用户
- 1 个测试宠物
- 1 个测试事件

测试结束后会自动清理(登出)。

## 预期结果

### 成功指标

- 所有端点响应状态码 200 或 201
- 认证保护正常工作 (未认证请求返回 401)
- 数据创建和读取功能正常

### 注意事项

- AI 相关端点可能因缺少 API Key 而失败
- 媒体上传需要 multipart/form-data 格式
- 测试邮箱每次运行都会不同

## 常见问题

### Q: 测试失败，服务器未响应

A: 请确保后端服务已启动:
```bash
cd RealDogBackEnd
npm run start:dev
```

### Q: 认证测试失败

A: 检查 `.env` 文件中的 JWT_SECRET 配置

### Q: AI 端点返回 500

A: 这是正常的，因为 AI 功能需要有效的 API Key 才能正常工作

## 报告生成

Node.js 测试脚本会自动生成 `test_results.json` 文件，包含:
- 测试时间戳
- 测试总数统计
- 每个测试的详细结果
- 响应状态码和大小

```bash
# 查看测试报告
cat test_results.json
```
