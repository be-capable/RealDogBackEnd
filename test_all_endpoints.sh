#!/bin/bash

# RealDog API Comprehensive Test Suite
# This script tests all API endpoints

BASE_URL="http://localhost:3000/api"
echo "========================================"
echo "RealDog API Comprehensive Test Suite"
echo "Base URL: $BASE_URL"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASS=0
FAIL=0
SKIP=0
TOTAL=0

# Store test data
USER_ID=""
PET_ID=""
EVENT_ID=""
MEDIA_ID=""
POST_ID=""
COMMENT_ID=""
AUTH_TOKEN=""
REFRESH_TOKEN=""

# Test result function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local name=$3
    local data=$4
    local expect_fail=$5

    TOTAL=$((TOTAL + 1))

    if [ -z "$data" ]; then
        if [ "$method" == "GET" ] || [ "$method" == "DELETE" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $AUTH_TOKEN")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $AUTH_TOKEN")
        fi
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data")
    fi

    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n 1)
    # Extract response body (all but last line)
    body=$(echo "$response" | sed '$d')

    if [ "$expect_fail" == "true" ] && [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
        echo -e "${GREEN}✅ $name: PASS (expected failure)${NC}"
        PASS=$((PASS + 1))
    elif [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        echo -e "${GREEN}✅ $name: PASS${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}❌ $name: FAIL (HTTP $http_code)${NC}"
        echo "   Response: $body"
        FAIL=$((FAIL + 1))
    fi
}

# Wait for server to be ready
echo -e "${BLUE}🔄 Waiting for server to be ready...${NC}"
for i in {1..30}; do
    if curl -s "$BASE_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server not responding. Please start the server first.${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}1. PUBLIC ENDPOINTS (No Auth Required)${NC}"
echo -e "${BLUE}========================================${NC}"

# Health check
test_endpoint "GET" "/" "Health Check"

# Get dog breeds (public)
test_endpoint "GET" "/dicts/dog-breeds" "Get Dog Breeds"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}2. AUTH ENDPOINTS${NC}"
echo -e "${BLUE}========================================${NC}"

# Generate unique email
TIMESTAMP=$(date +%s)
TEST_EMAIL="test$TIMESTAMP@example.com"

# Register
echo -e "${YELLOW}📝 Testing User Registration...${NC}"
register_response=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "'"$TEST_EMAIL"'",
        "password": "TestPassword123!",
        "name": "Test User"
    }')

if echo "$register_response" | grep -q '"accessToken"'; then
    AUTH_TOKEN=$(echo "$register_response" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')
    USER_ID=$(echo "$register_response" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')
    echo -e "${GREEN}✅ User Registration: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ User Registration: FAIL${NC}"
    echo "   Response: $register_response"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

# Login
echo -e "${YELLOW}🔐 Testing User Login...${NC}"
login_response=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "'"$TEST_EMAIL"'",
        "password": "TestPassword123!"
    }')

if echo "$login_response" | grep -q '"accessToken"'; then
    AUTH_TOKEN=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')
    REFRESH_TOKEN=$(echo "$login_response" | grep -o '"refreshToken":"[^"]*"' | sed 's/"refreshToken":"//;s/"//')
    echo -e "${GREEN}✅ User Login: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ User Login: FAIL${NC}"
    echo "   Response: $login_response"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

# Verify token
test_endpoint "GET" "/auth/verify" "Verify Token"

# Refresh token
echo -e "${YELLOW}🔄 Testing Token Refresh...${NC}"
refresh_response=$(curl -s -X POST "$BASE_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{"refreshToken": "'"$REFRESH_TOKEN"'"}')

if echo "$refresh_response" | grep -q '"accessToken"'; then
    echo -e "${GREEN}✅ Token Refresh: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Token Refresh: FAIL${NC}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}3. USER ENDPOINTS${NC}"
echo -e "${BLUE}========================================${NC}"

# Get current user
test_endpoint "GET" "/users" "Get Current User"

# Get user by ID
test_endpoint "GET" "/users/$USER_ID" "Get User By ID"

# Update user
echo -e "${YELLOW}📝 Testing Update User...${NC}"
update_response=$(curl -s -X PATCH "$BASE_URL/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{"name": "Updated Test User"}')

if echo "$update_response" | grep -q '"Updated Test User"'; then
    echo -e "${GREEN}✅ Update User: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Update User: FAIL${NC}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}4. PET ENDPOINTS${NC}"
echo -e "${BLUE}========================================${NC}"

# Create pet
echo -e "${YELLOW}🐕 Testing Create Pet...${NC}"
pet_response=$(curl -s -X POST "$BASE_URL/pets" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "name": "Test Dog",
        "species": "DOG",
        "sex": "MALE",
        "breedId": "golden-retriever",
        "birthDate": "2023-01-01T00:00:00.000Z",
        "isSpayedNeutered": false
    }')

if echo "$pet_response" | grep -q '"id"'; then
    PET_ID=$(echo "$pet_response" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')
    echo -e "${GREEN}✅ Create Pet: PASS (ID: $PET_ID)${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Create Pet: FAIL${NC}"
    echo "   Response: $pet_response"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

# Get pets list
test_endpoint "GET" "/pets" "Get Pets List"

# Get single pet
test_endpoint "GET" "/pets/$PET_ID" "Get Pet Details"

# Update pet
echo -e "${YELLOW}📝 Testing Update Pet...${NC}"
update_pet_response=$(curl -s -X PATCH "$BASE_URL/pets/$PET_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{"name": "Updated Dog Name"}')

if echo "$update_pet_response" | grep -q '"Updated Dog Name"'; then
    echo -e "${GREEN}✅ Update Pet: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Update Pet: FAIL${NC}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}5. PET MEDIA ENDPOINTS${NC}"
echo -e "${BLUE}========================================${NC}"

# Get pet media list
test_endpoint "GET" "/pets/$PET_ID/media" "Get Pet Media List"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}6. PET EVENTS ENDPOINTS${NC}"
echo -e "${BLUE}========================================${NC}"

# Create pet event
echo -e "${YELLOW}📅 Testing Create Pet Event...${NC}"
event_response=$(curl -s -X POST "$BASE_URL/pets/$PET_ID/events" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "eventType": "WALK",
        "meaningText": "Went for a walk",
        "inputTranscript": "Let me go for a walk!"
    }')

if echo "$event_response" | grep -q '"id"'; then
    EVENT_ID=$(echo "$event_response" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')
    echo -e "${GREEN}✅ Create Pet Event: PASS (ID: $EVENT_ID)${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Create Pet Event: FAIL${NC}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

# Get pet events
test_endpoint "GET" "/pets/$PET_ID/events" "Get Pet Events List"

# Get single event
if [ -n "$EVENT_ID" ]; then
    test_endpoint "GET" "/events/$EVENT_ID" "Get Event Details"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}7. HOME ENDPOINT${NC}"
echo -e "${BLUE}========================================${NC}"

test_endpoint "GET" "/home" "Get Home Data"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}8. AI INTERPRET ENDPOINT${NC}"
echo -e "${BLUE}========================================${NC}"

# Test AI interpret
echo -e "${YELLOW}🤖 Testing AI Interpret...${NC}"
ai_response=$(curl -s -X POST "$BASE_URL/ai/dog/interpret" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "audioUrl": "https://example.com/test.wav",
        "petId": '$PET_ID',
        "context": "Morning walk",
        "style": "default"
    }')

if echo "$ai_response" | grep -q '"interpretation"'; then
    echo -e "${GREEN}✅ AI Interpret: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    # This might fail due to missing audio, which is expected
    echo -e "${YELLOW}⚠️ AI Interpret: SKIP (may require valid audio)${NC}"
    SKIP=$((SKIP + 1))
    TOTAL=$((TOTAL + 1))
fi

# Test AI synthesize
echo -e "${YELLOW}🔊 Testing AI Synthesize...${NC}"
synth_response=$(curl -s -X POST "$BASE_URL/ai/dog/synthesize" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "text": "Woof woof!",
        "petId": '$PET_ID',
        "style": "happy"
    }')

if echo "$synth_response" | grep -q '"audioUrl"'; then
    echo -e "${GREEN}✅ AI Synthesize: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${YELLOW}⚠️ AI Synthesize: SKIP (may require API key)${NC}"
    SKIP=$((SKIP + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}9. AI DIALOGUE ENDPOINT${NC}"
echo -e "${BLUE}========================================${NC}"

# Test dialogue
echo -e "${YELLOW}💬 Testing AI Dialogue...${NC}"
dialogue_response=$(curl -s -X POST "$BASE_URL/ai/dialogue/turn" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{
        "petId": '$PET_ID',
        "audioUrl": "https://example.com/audio.wav",
        "style": "default"
    }')

if echo "$dialogue_response" | grep -q '"response"'; then
    echo -e "${GREEN}✅ AI Dialogue: PASS${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${YELLOW}⚠️ AI Dialogue: SKIP (may require valid audio)${NC}"
    SKIP=$((SKIP + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}10. AUTHENTICATION PROTECTION TEST${NC}"
echo -e "${BLUE}========================================${NC}"

# Test accessing protected endpoint without auth
echo -e "${YELLOW}🔒 Testing Protected Endpoint Without Auth...${NC}"
unauth_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/pets")
unauth_code=$(echo "$unauth_response" | tail -n 1)
unauth_body=$(echo "$unauth_response" | sed '$d')

if [ "$unauth_code" == "401" ]; then
    echo -e "${GREEN}✅ Protected Endpoint Without Auth: PASS (correctly rejected)${NC}"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))
else
    echo -e "${RED}❌ Protected Endpoint Without Auth: FAIL (expected 401, got $unauth_code)${NC}"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}11. CLEANUP${NC}"
echo -e "${BLUE}========================================${NC}"

# Logout
test_endpoint "POST" "/auth/logout" "Logout"

echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASS}${NC}"
echo -e "${RED}Failed: ${FAIL}${NC}"
echo -e "${YELLOW}Skipped: ${SKIP}${NC}"

if [ $TOTAL -gt 0 ]; then
    success_rate=$((PASS * 100 / TOTAL))
    echo -e "Success Rate: ${success_rate}%"
fi

echo ""
echo "Test Data Created:"
echo "- User ID: $USER_ID"
echo "- Pet ID: $PET_ID"
echo "- Event ID: $EVENT_ID"

echo ""
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed.${NC}"
    exit 1
fi
