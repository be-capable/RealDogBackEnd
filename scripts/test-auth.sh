#!/bin/bash

# RealDog 认证流程测试脚本
# 测试登录、注册、Token刷新等流程

BASE_URL="http://localhost:3000/api"

echo "════════════════════════════════════════════════════════════"
echo "        🐕 RealDog 认证流程测试"
echo "════════════════════════════════════════════════════════════"
echo ""

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 测试邮箱（每次运行自动生成唯一邮箱）
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_$TIMESTAMP@realdog.test"
TEST_PASSWORD="TestPassword123!"

echo -e "${YELLOW}1. 测试用户注册${NC}"
echo "   邮箱: $TEST_EMAIL"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}")

echo "注册响应: $REGISTER_RESPONSE"
echo ""

# 检查是否注册成功
if echo "$REGISTER_RESPONSE" | grep -q "accessToken"; then
  ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
  
  echo -e "${GREEN}✅ 注册成功!${NC}"
  echo "   Access Token: ${ACCESS_TOKEN:0:20}..."
  echo "   Refresh Token: ${REFRESH_TOKEN:0:20}..."
  echo ""
  
  echo -e "${YELLOW}2. 测试登录（使用刚注册的账户）${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
  
  echo "登录响应: $LOGIN_RESPONSE"
  echo ""
  
  if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✅ 登录成功!${NC}"
    echo ""
    
    echo -e "${YELLOW}3. 测试访问受保护接口（获取用户信息）${NC}"
    USER_RESPONSE=$(curl -s -X GET "$BASE_URL/users/account" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    echo "用户信息: $USER_RESPONSE"
    echo ""
    
    echo -e "${GREEN}✅ 访问受保护接口成功!${NC}"
    echo ""
    
    echo -e "${YELLOW}4. 测试Token刷新${NC}"
    REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $REFRESH_TOKEN")
    
    echo "刷新响应: $REFRESH_RESPONSE"
    echo ""
    
    if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
      echo -e "${GREEN}✅ Token刷新成功!${NC}"
    else
      echo -e "${RED}❌ Token刷新失败${NC}"
    fi
    echo ""
    
    echo -e "${YELLOW}5. 测试登出${NC}"
    LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/logout" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    echo "登出响应: $LOGOUT_RESPONSE"
    echo ""
    echo -e "${GREEN}✅ 登出成功!${NC}"
    echo ""
    
    echo -e "${YELLOW}6. 测试删除账户${NC}"
    # 先登录获取新token
    LOGIN_AGAIN=$(curl -s -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
    NEW_ACCESS_TOKEN=$(echo "$LOGIN_AGAIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/users/account" \
      -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
    echo "删除账户响应: $DELETE_RESPONSE"
    echo ""
    echo -e "${GREEN}✅ 账户已删除!${NC}"
    echo ""
    
  else
    echo -e "${RED}❌ 登录失败${NC}"
    echo "请检查邮箱和密码是否正确"
  fi
  
else
  echo -e "${RED}❌ 注册失败${NC}"
  echo "可能原因:"
  echo "   - 邮箱格式错误"
  echo "   - 密码强度不足（至少6位）"
  echo "   - 邮箱已被注册"
  echo ""
  echo "响应详情: $REGISTER_RESPONSE"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "                    测试完成"
echo "════════════════════════════════════════════════════════════"
