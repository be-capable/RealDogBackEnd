# RealDog Backend API

RealDog是一个智能宠物生活记录应用，通过AI技术帮助宠物主人更好地理解和照顾他们的宠物。

## 功能特性

- **用户认证**：安全的注册、登录、登出功能
- **宠物管理**：添加、编辑、删除宠物信息
- **宠物事件记录**：记录宠物的行为和情绪
- **AI交互**：语音识别、情绪分析、智能对话
- **社交功能**：分享宠物动态、关注好友、点赞评论
- **数据导出**：支持用户数据导出

## 技术栈

- **框架**: NestJS
- **数据库**: SQLite (开发环境) / PostgreSQL (生产环境)
- **ORM**: Prisma
- **认证**: JWT
- **AI服务**: OpenAI-compatible API
- **文件存储**: 本地存储/S3
- **邮件服务**: SMTP

## API 文档

### 认证接口

#### `POST /api/auth/register`
注册新用户
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

#### `POST /api/auth/login`
用户登录
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### `POST /api/auth/logout`
用户登出

#### `POST /api/auth/forgot-password`
忘记密码
```json
{
  "email": "user@example.com"
}
```

#### `POST /api/auth/verify-otp`
验证OTP
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### `POST /api/auth/reset-password`
重置密码
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

### 用户接口

#### `GET /api/users/account`
获取当前用户信息

#### `GET /api/users/:id`
获取指定用户信息

#### `PATCH /api/users/:id`
更新用户信息
```json
{
  "name": "Updated Name"
}
```

#### `DELETE /api/users/account`
删除账户

#### `GET /api/users/account/export`
导出用户数据

### 宠物接口

#### `POST /api/pets`
创建宠物
```json
{
  "name": "Buddy",
  "species": "DOG",
  "sex": "MALE",
  "breedId": "golden-retriever",
  "birthDate": "2020-01-01T00:00:00.000Z",
  "isSpayedNeutered": false
}
```

#### `GET /api/pets`
获取用户的所有宠物

#### `GET /api/pets/:id`
获取宠物详情

#### `PATCH /api/pets/:id`
更新宠物信息
```json
{
  "name": "Updated Name"
}
```

#### `DELETE /api/pets/:id`
删除宠物

#### `POST /api/pets/:id/avatar`
上传宠物头像

### 宠物事件接口

#### `POST /api/pets/:petId/events`
创建宠物事件
```json
{
  "eventType": "BARK",
  "meaningText": "Excited to go for a walk",
  "inputTranscript": "Let's go outside!"
}
```

#### `GET /api/pets/:petId/events`
获取宠物事件列表

#### `GET /api/events/:eventId`
获取事件详情

### 宠物媒体接口

#### `POST /api/pets/:petId/media`
上传宠物媒体文件

#### `GET /api/pets/:petId/media`
获取宠物媒体列表

#### `DELETE /api/media/:mediaId`
删除媒体文件

### AI接口

#### `POST /api/ai/dog/interpret`
AI宠物情绪解读
```json
{
  "audioUrl": "https://example.com/audio.mp3",
  "petId": 1,
  "context": "morning",
  "style": "default"
}
```

#### `POST /api/ai/dog/synthesize`
AI语音合成
```json
{
  "text": "Hello, I'm happy to see you!",
  "petId": 1,
  "style": "happy"
}
```

#### `POST /api/ai/dog/synthesize-task`
创建AI语音合成任务
```json
{
  "text": "Hello, I'm happy to see you!",
  "petId": 1,
  "style": "happy"
}
```

#### `GET /api/ai/dog/task/:id`
获取AI任务状态

#### `POST /api/ai/dialogue/turn`
AI对话
```json
{
  "petId": 1,
  "inputText": "How are you?",
  "mode": "HUMAN_TO_DOG"
}
```

### 社交接口

#### `GET /api/social/feed`
获取社交动态流

#### `POST /api/social/posts`
创建动态
```json
{
  "content": "My dog is having a great day!",
  "petId": 1,
  "visibility": "PUBLIC"
}
```

#### `GET /api/social/posts/:id`
获取动态详情

#### `PUT /api/social/posts/:id`
更新动态

#### `DELETE /api/social/posts/:id`
删除动态

#### `POST /api/social/likes`
点赞
```json
{
  "targetId": 1,
  "targetType": "SocialPost"
}
```

#### `DELETE /api/social/likes/:id`
取消点赞

#### `POST /api/social/comments`
评论
```json
{
  "postId": 1,
  "content": "Cute dog!"
}
```

#### `GET /api/social/comments`
获取评论列表

#### `DELETE /api/social/comments/:id`
删除评论

#### `POST /api/social/follow/:userId`
关注用户

#### `DELETE /api/social/follow/:userId`
取消关注

#### `GET /api/social/followers`
获取粉丝列表

#### `GET /api/social/following`
获取关注列表

#### `GET /api/social/follow-status/:userId`
获取关注状态

#### `GET /api/social/suggestions`
获取推荐关注

#### `GET /api/social/notifications`
获取通知列表

#### `PUT /api/social/notifications/:id/read`
标记通知为已读

#### `PUT /api/social/notifications/read-all`
标记所有通知为已读

#### `GET /api/social/unread-count`
获取未读通知数量

### 其他接口

#### `GET /api/dicts/dog-breeds`
获取狗品种列表

#### `GET /api/home`
获取首页数据

## 环境变量

创建 `.env` 文件并设置以下变量：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-jwt-secret-here"

# S3存储 (可选)
S3_ENDPOINT=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_BUCKET_NAME=""
S3_REGION=""

# 邮件
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="noreply@realdog.com"

# AI服务
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
OPENAI_BASE_URL=""

# 应用设置
APP_NAME="RealDog"
APP_VERSION="1.0.0"
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3000"
```

## 启动项目

```bash
# 安装依赖
npm install

# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run start:dev
```

## 测试

```bash
# 运行单元测试
npm run test

# 运行集成测试
npm run test:e2e

# 运行API认证流程测试
node test_auth_flow_fixed.js
```

## 部署

1. 将数据库切换为PostgreSQL
2. 配置生产环境的环境变量
3. 构建项目：`npm run build`
4. 启动服务：`npm run start:prod`

## 认证流程说明

RealDog使用JWT进行身份认证：

1. 用户通过注册/登录获取JWT令牌
2. 所有受保护的API端点都需要在请求头中包含`Authorization: Bearer <token>`
3. 令牌有效期为7天
4. 登出时，前端清除本地存储的令牌，后端不维护令牌黑名单（依赖自然过期）

## 数据保留策略

根据隐私政策要求，系统会自动清理过期数据：
- 录音文件相关数据：24小时后删除
- 日志/审计数据：90天后删除
- 任务记录：30天后删除
- 用户导出数据：7天后删除

系统每天午夜执行一次数据清理任务。