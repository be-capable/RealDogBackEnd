#!/bin/bash

# RealDog 全面API接口测试脚本
# 测试所有后端接口的可用性和响应

set -e

BASE_URL="http://localhost:3000/api"

echo "════════════════════════════════════════════════════════════"
echo "        🐕 RealDog 全面API接口测试"
echo "════════════════════════════════════════════════════════════"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 统计数据
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试邮箱
TIMESTAMP=$(date +%s)
TEST_EMAIL="apitest_$TIMESTAMP@realdog.com"
TEST_PASSWORD="TestPassword123!"

# 存储变量
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""
PET_ID=""
EVENT_ID=""

# 测试函数
run_test() {
    local test_name=$1
    local result=$2
    local expected=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}✅ $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ $test_name${NC}"
        echo -e "   期望: $expected, 实际: $result"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 检查后端是否运行
echo "检查后端服务..."
if ! curl -s "$BASE_URL" > /dev/null; then
    echo -e "${RED}❌ 后端服务未启动${NC}"
    echo "请先运行: cd RealDogBackEnd && npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✅ 后端服务运行正常${NC}"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  1. Auth 认证模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 1.1 注册
echo "测试 1.1: 用户注册"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"API Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "accessToken" && echo "$REGISTER_RESPONSE" | grep -q "refreshToken"; then
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    run_test "用户注册 - 返回双Token" "true" "true"
else
    run_test "用户注册" "false" "true"
    echo "响应: $REGISTER_RESPONSE"
fi
echo ""

# 1.2 登录
echo "测试 1.2: 用户登录"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    run_test "用户登录" "true" "true"
else
    run_test "用户登录" "false" "true"
    echo "响应: $LOGIN_RESPONSE"
fi
echo ""

# 1.3 获取当前用户信息
echo "测试 1.3: 获取当前用户信息"
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/users/account" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$USER_RESPONSE" | grep -q "email"; then
    run_test "获取当前用户信息" "true" "true"
else
    run_test "获取当前用户信息" "false" "true"
    echo "响应: $USER_RESPONSE"
fi
echo ""

# 1.4 Token刷新
echo "测试 1.4: Token刷新"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Authorization: Bearer $REFRESH_TOKEN")

if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
    ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    run_test "Token刷新" "true" "true"
else
    run_test "Token刷新" "false" "true"
    echo "响应: $REFRESH_RESPONSE"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  2. Pets 宠物模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 2.1 创建宠物
echo "测试 2.1: 创建宠物"
PET_RESPONSE=$(curl -s -X POST "$BASE_URL/pets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Dog",
    "sex": "MALE",
    "birthDate": "2020-01-01T00:00:00.000Z",
    "breedId": "golden_retriever",
    "isSpayedNeutered": true
  }')

if echo "$PET_RESPONSE" | grep -q '"id"'; then
    PET_ID=$(echo "$PET_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
    run_test "创建宠物" "true" "true"
else
    run_test "创建宠物" "false" "true"
    echo "响应: $PET_RESPONSE"
fi
echo ""

# 2.2 获取宠物列表
echo "测试 2.2: 获取宠物列表"
PETS_LIST=$(curl -s -X GET "$BASE_URL/pets" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$PETS_LIST" | grep -q "\["; then
    run_test "获取宠物列表" "true" "true"
else
    run_test "获取宠物列表" "false" "true"
    echo "响应: $PETS_LIST"
fi
echo ""

# 2.3 获取单个宠物
echo "测试 2.3: 获取单个宠物"
if [ -n "$PET_ID" ]; then
    SINGLE_PET=$(curl -s -X GET "$BASE_URL/pets/$PET_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$SINGLE_PET" | grep -q "name"; then
        run_test "获取单个宠物" "true" "true"
    else
        run_test "获取单个宠物" "false" "true"
        echo "响应: $SINGLE_PET"
    fi
else
    echo -e "${YELLOW}⚠️ 跳过：无宠物ID${NC}"
fi
echo ""

# 2.4 更新宠物
echo "测试 2.4: 更新宠物"
if [ -n "$PET_ID" ]; then
    UPDATE_PET=$(curl -s -X PATCH "$BASE_URL/pets/$PET_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "Updated Dog Name"}')
    
    if echo "$UPDATE_PET" | grep -q "Updated Dog Name"; then
        run_test "更新宠物" "true" "true"
    else
        run_test "更新宠物" "false" "true"
        echo "响应: $UPDATE_PET"
    fi
else
    echo -e "${YELLOW}⚠️ 跳过：无宠物ID${NC}"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  3. Dog-AI AI翻译模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 3.1 人声合成（简单测试）
echo "测试 3.1: 人声合成狗叫"
SYNTHESIZE_RESPONSE=$(curl -s -X POST "$BASE_URL/ai/dog/synthesize" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello dog",
    "locale": "en-US",
    "emotion": "friendly"
  }')

if echo "$SYNTHESIZE_RESPONSE" | grep -q "audioUrl\|audioData"; then
    run_test "人声合成狗叫" "true" "true"
else
    run_test "人声合成狗叫" "false" "true"
    echo "响应: $SYNTHESIZE_RESPONSE"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  4. Home 首页模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 4.1 获取首页数据
echo "测试 4.1: 获取首页数据"
HOME_RESPONSE=$(curl -s -X GET "$BASE_URL/home" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$HOME_RESPONSE" | grep -q "currentPet\|aiInsight"; then
    run_test "获取首页数据" "true" "true"
else
    run_test "获取首页数据" "false" "true"
    echo "响应: $HOME_RESPONSE"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  5. Dicts 字典模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 5.1 获取犬种列表
echo "测试 5.1: 获取犬种列表"
BREEDS_RESPONSE=$(curl -s -X GET "$BASE_URL/dicts/dog-breeds?limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$BREEDS_RESPONSE" | grep -q "items"; then
    run_test "获取犬种列表" "true" "true"
else
    run_test "获取犬种列表" "false" "true"
    echo "响应: $BREEDS_RESPONSE"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  6. Users 用户模块${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 6.1 导出用户数据
echo "测试 6.1: 导出用户数据"
EXPORT_RESPONSE=$(curl -s -X GET "$BASE_URL/users/account/export" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$EXPORT_RESPONSE" | grep -q "exportInfo\|user"; then
    run_test "导出用户数据" "true" "true"
else
    run_test "导出用户数据" "false" "true"
    echo "响应: $EXPORT_RESPONSE"
fi
echo ""

# 6.2 登出
echo "测试 6.2: 用户登出"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$LOGOUT_RESPONSE" | grep -q "message"; then
    run_test "用户登出" "true" "true"
else
    run_test "用户登出" "false" "true"
    echo "响应: $LOGOUT_RESPONSE"
fi
echo ""

# 6.3 删除账户（最后测试）
echo "测试 6.3: 删除账户"
# 重新登录获取新token
LOGIN_AGAIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
NEW_TOKEN=$(echo "$LOGIN_AGAIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$NEW_TOKEN" ]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/users/account" \
      -H "Authorization: Bearer $NEW_TOKEN")
    
    if echo "$DELETE_RESPONSE" | grep -q "success"; then
        run_test "删除账户" "true" "true"
    else
        run_test "删除账户" "false" "true"
        echo "响应: $DELETE_RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️ 跳过：无法重新登录${NC}"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                  7. 其他功能${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# 7.1 忘记密码
echo "测试 7.1: 忘记密码（返回成功消息）"
FORGOT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.com\"}")

if echo "$FORGOT_RESPONSE" | grep -q "message"; then
    run_test "忘记密码" "true" "true"
else
    run_test "忘记密码" "false" "true"
    echo "响应: $FORGOT_RESPONSE"
fi
echo ""

# 7.2 测试未认证访问受保护接口
echo "测试 7.2: 未认证访问（应返回401）"
UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/pets" -o /dev/null)

if [ "$UNAUTH_RESPONSE" = "401" ]; then
    run_test "未认证访问被拒绝" "401" "401"
else
    run_test "未认证访问被拒绝" "$UNAUTH_RESPONSE" "401"
fi
echo ""

# 测试报告
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    测试结果汇总${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
