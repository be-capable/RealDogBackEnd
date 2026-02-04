#!/bin/bash

# RealDog Backend Startup Script
# 自动设置和验证环境变量，然后启动后端服务

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

# 显示所有必需的Key列表
show_required_keys() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}              🔑 RealDog 必需的环境变量清单${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}【基础配置】${NC}"
    echo "  1. DATABASE_URL          - SQLite数据库路径 (默认: file:./dev.db)"
    echo "  2. JWT_SECRET            - JWT签名密钥 (需要强随机字符串)"
    echo "  3. JWT_RT_SECRET         - JWT刷新令牌密钥 (需要强随机字符串)"
    echo "  4. API_SIGN_SECRET       - API请求签名密钥 (用于移动端验证)"
    echo ""
    echo -e "${YELLOW}【AI大模型 - 字节跳动 Ark】${NC}"
    echo "  5. ARK_API_KEY           - Ark LLM API密钥"
    echo "  6. ARK_MODEL_ID          - 模型ID (如: doubao-seed-1-8-251228)"
    echo "     🔗 获取地址: https://console.volcengine.com/ark/"
    echo ""
    echo -e "${YELLOW}【语音识别 - 火山引擎 ASR】${NC}"
    echo "  7. VOLC_ASR_APP_ID       - ASR应用ID"
    echo "  8. VOLC_ASR_ACCESS_TOKEN - ASR访问令牌"
    echo "  9. VOLC_ASR_CLUSTER      - ASR集群 (如: volcengine_input_common)"
    echo "     🔗 获取地址: https://console.volcengine.com/speech/"
    echo ""
    echo -e "${YELLOW}【语音合成 - 火山引擎 TTS】${NC}"
    echo " 10. VOLC_TTS_APP_ID       - TTS应用ID"
    echo " 11. VOLC_TTS_ACCESS_TOKEN - TTS访问令牌"
    echo " 12. VOLC_TTS_CLUSTER      - TTS集群"
    echo "     🔗 获取地址: https://console.volcengine.com/speech/"
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# 显示.env文件示例
show_env_example() {
    echo -e "${CYAN}📝 .env 文件示例:${NC}"
    echo ""
    cat << 'EOF'
# ============================================================
# RealDog 后端环境变量配置
# ============================================================

# 数据库配置
DATABASE_URL="file:./dev.db"

# JWT密钥（生成命令: openssl rand -base64 64）
JWT_SECRET="your-jwt-secret-here-minimum-32-characters-long"
JWT_RT_SECRET="your-refresh-token-secret-here-minimum-32-characters"

# API签名密钥（用于移动端请求验证）
API_SIGN_SECRET="your-api-sign-secret-here"

# AI调试配置
AI_DEBUG_LOG="true"
AI_STUB_MODE="false"

# ============================================================
# 火山引擎 ASR 语音识别
# 控制台: https://console.volcengine.com/speech/service/8
# ============================================================
VOLC_ASR_WS_URL="wss://openspeech.bytedance.com/api/v2/asr"
VOLC_ASR_APP_ID="your-asr-app-id"
VOLC_ASR_ACCESS_TOKEN="your-asr-access-token"
VOLC_ASR_CLUSTER="volcengine_input_common"
VOLC_ASR_UID="real-dog"
VOLC_ASR_WORKFLOW="audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate"

# ============================================================
# 字节跳动 Ark LLM 大模型
# 控制台: https://console.volcengine.com/ark/
# ============================================================
ARK_API_BASE="https://ark.cn-beijing.volces.com/api/v3"
ARK_API_KEY="your-ark-api-key"
ARK_MODEL_ID="doubao-seed-1-8-251228"

# ============================================================
# 火山引擎 TTS 语音合成
# 控制台: https://console.volcengine.com/speech/service/9
# ============================================================
VOLC_TTS_HTTP_URL="https://openspeech.bytedance.com/api/v1/tts"
VOLC_TTS_APP_ID="your-tts-app-id"
VOLC_TTS_ACCESS_TOKEN="your-tts-access-token"
VOLC_TTS_CLUSTER="your-tts-cluster"
VOLC_TTS_VOICE_TYPE_ZH="your-zh-voice-type"
VOLC_TTS_VOICE_TYPE_EN="your-en-voice-type"
VOLC_TTS_ENCODING="mp3"

# 音频输出模式 (volc_tts | synthetic)
DOG_AUDIO_OUTPUT_MODE="volc_tts"
EOF
    echo ""
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║        🐕 RealDog Backend Startup Script               ║"
echo "║         自动环境变量配置与验证                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 检查 .env 文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 错误: .env 文件不存在${NC}"
    echo -e "${YELLOW}📍 期望位置: $ENV_FILE${NC}"
    echo ""
    show_required_keys
    show_env_example
    echo -e "${YELLOW}💡 提示: 复制上面的示例，创建 .env 文件并填入您的实际密钥${NC}"
    exit 1
fi

echo -e "${BLUE}📋 正在加载环境变量...${NC}"
echo "   文件: $ENV_FILE"
echo ""

# 导出所有环境变量（去除注释和空行）
while IFS= read -r line || [[ -n "$line" ]]; do
    # 跳过注释和空行
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    
    # 导出变量
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # 去除引号
        var_value="${var_value%\"}"
        var_value="${var_value#\"}"
        
        export "$var_name=$var_value"
    fi
done < "$ENV_FILE"

# 验证必需的环境变量
echo -e "${BLUE}🔍 验证必要的环境变量...${NC}"
echo ""

# 定义必需变量
REQUIRED_VARS=(
    "DATABASE_URL:数据库连接:file:./dev.db"
    "JWT_SECRET:JWT签名密钥:openssl rand -base64 64"
    "JWT_RT_SECRET:JWT刷新令牌密钥:openssl rand -base64 64"
    "API_SIGN_SECRET:API请求签名密钥:任意强密码"
)

# AI/ML 服务密钥
AI_VARS=(
    "ARK_API_KEY:Ark LLM API密钥:https://console.volcengine.com/ark/"
    "ARK_MODEL_ID:Ark LLM模型ID:doubao-seed-1-8-251228"
    "VOLC_ASR_APP_ID:火山ASR应用ID:https://console.volcengine.com/speech/"
    "VOLC_ASR_ACCESS_TOKEN:火山ASR访问令牌:https://console.volcengine.com/speech/"
    "VOLC_ASR_CLUSTER:火山ASR集群:volcengine_input_common"
    "VOLC_TTS_APP_ID:火山TTS应用ID:https://console.volcengine.com/speech/"
    "VOLC_TTS_ACCESS_TOKEN:火山TTS访问令牌:https://console.volcengine.com/speech/"
    "VOLC_TTS_CLUSTER:火山TTS集群:见控制台"
)

MISSING_VARS=()
SET_VARS=()

# 验证基础必需变量
for var_info in "${REQUIRED_VARS[@]}"; do
    IFS=':' read -r var_name var_desc var_guide <<< "$var_info"
    
    if [ -z "${!var_name}" ] || [ "${!var_name}" = "replace_me" ]; then
        MISSING_VARS+=("$var_name|$var_desc|$var_guide")
        echo -e "   ${RED}❌ $var_name${NC} - $var_desc ${RED}[未设置]${NC}"
    else
        SET_VARS+=("$var_name")
        value="${!var_name}"
        if [ ${#value} -gt 16 ]; then
            display_value="${value:0:8}****${value: -8}"
        elif [ ${#value} -gt 8 ]; then
            display_value="${value:0:4}****${value: -4}"
        else
            display_value="****"
        fi
        echo -e "   ${GREEN}✅ $var_name${NC} - $var_desc ${GREEN}[已设置]${NC}"
        echo -e "      值: $display_value"
    fi
done

echo ""

# 验证AI/ML服务密钥
echo -e "${BLUE}🤖 验证AI/ML服务密钥...${NC}"
echo ""

AI_MISSING=()
AI_CONFIGURED=()

for var_info in "${AI_VARS[@]}"; do
    IFS=':' read -r var_name var_desc var_guide <<< "$var_info"
    
    if [ -z "${!var_name}" ] || [ "${!var_name}" = "replace_me" ]; then
        AI_MISSING+=("$var_name|$var_desc|$var_guide")
        echo -e "   ${YELLOW}⚠️  $var_name${NC} - $var_desc ${YELLOW}[未设置]${NC}"
        echo -e "      💡 获取方式: $var_guide"
    else
        AI_CONFIGURED+=("$var_name")
        value="${!var_name}"
        if [ ${#value} -gt 12 ]; then
            display_value="${value:0:6}****${value: -6}"
        else
            display_value="****"
        fi
        echo -e "   ${GREEN}✅ $var_name${NC} - $var_desc ${GREEN}[已设置]${NC}"
        echo -e "      值: $display_value"
    fi
done

echo ""

# 检查可选变量
OPTIONAL_VARS=(
    "AI_DEBUG_LOG:AI调试日志:true|false"
    "AI_STUB_MODE:AI模拟模式:true|false"
    "DOG_AUDIO_OUTPUT_MODE:音频输出模式:volc_tts|synthetic"
)

echo -e "${BLUE}📎 可选环境变量检查:${NC}"
for var_info in "${OPTIONAL_VARS[@]}"; do
    IFS=':' read -r var_name var_desc var_guide <<< "$var_info"
    if [ -n "${!var_name}" ]; then
        echo -e "   ${GREEN}✓${NC} $var_name = ${!var_name} ${CYAN}($var_guide)${NC}"
    else
        echo -e "   ${YELLOW}○${NC} $var_name 未设置（将使用默认值） ${CYAN}($var_guide)${NC}"
    fi
done

echo ""

# 如果有缺失的变量，显示详细信息
if [ ${#MISSING_VARS[@]} -ne 0 ] || [ ${#AI_MISSING[@]} -ne 0 ]; then
    echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}                 ⚠️  环境变量配置不完整${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        echo -e "${RED}【缺失的基础变量】${NC}"
        echo ""
        for missing in "${MISSING_VARS[@]}"; do
            IFS='|' read -r var_name var_desc var_guide <<< "$missing"
            echo -e "   ${RED}• $var_name${NC}"
            echo -e "     说明: $var_desc"
            echo -e "     设置: ${CYAN}$var_guide${NC}"
            echo ""
        done
    fi
    
    if [ ${#AI_MISSING[@]} -ne 0 ]; then
        echo -e "${YELLOW}【缺失的AI服务密钥】${NC}"
        echo ""
        for missing in "${AI_MISSING[@]}"; do
            IFS='|' read -r var_name var_desc var_guide <<< "$missing"
            echo -e "   ${YELLOW}• $var_name${NC}"
            echo -e "     说明: $var_desc"
            echo -e "     获取: ${CYAN}$var_guide${NC}"
            echo ""
        done
        echo -e "${YELLOW}提示: 如果不配置AI密钥，可以使用模拟模式进行开发测试${NC}"
        echo -e "      设置 AI_STUB_MODE=true 即可绕过真实AI调用"
        echo ""
    fi
    
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}请选择操作:${NC}"
    echo ""
    echo "   [1] 生成JWT密钥（自动更新.env文件）"
    echo "   [2] 显示完整的.env模板"
    echo "   [3] 继续启动（使用模拟模式/开发模式）"
    echo "   [4] 退出，手动编辑.env文件"
    echo ""
    
    # 如果没有AI_STUB_MODE且AI密钥缺失，建议使用模拟模式
    if [ ${#AI_MISSING[@]} -ne 0 ] && [ "${AI_STUB_MODE}" != "true" ]; then
        echo -e "${YELLOW}💡 建议: 您缺少AI密钥，建议设置 AI_STUB_MODE=true 使用模拟模式${NC}"
        echo ""
    fi
    
    read -p "请选择 (1/2/3/4): " choice
    echo ""
    
    case $choice in
        1)
            # 生成JWT密钥
            echo -e "${BLUE}🔑 正在生成JWT密钥...${NC}"
            JWT_SECRET=$(openssl rand -base64 64)
            JWT_RT_SECRET=$(openssl rand -base64 64)
            API_SIGN=$(openssl rand -base64 32)
            
            # 更新.env文件
            if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
                sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE" 2>/dev/null || sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" "$ENV_FILE"
            else
                echo "JWT_SECRET=\"$JWT_SECRET\"" >> "$ENV_FILE"
            fi
            
            if grep -q "^JWT_RT_SECRET=" "$ENV_FILE"; then
                sed -i '' "s|^JWT_RT_SECRET=.*|JWT_RT_SECRET=\"$JWT_RT_SECRET\"|" "$ENV_FILE" 2>/dev/null || sed -i "s|^JWT_RT_SECRET=.*|JWT_RT_SECRET=\"$JWT_RT_SECRET\"|" "$ENV_FILE"
            else
                echo "JWT_RT_SECRET=\"$JWT_RT_SECRET\"" >> "$ENV_FILE"
            fi
            
            if grep -q "^API_SIGN_SECRET=" "$ENV_FILE"; then
                sed -i '' "s|^API_SIGN_SECRET=.*|API_SIGN_SECRET=\"$API_SIGN\"|" "$ENV_FILE" 2>/dev/null || sed -i "s|^API_SIGN_SECRET=.*|API_SIGN_SECRET=\"$API_SIGN\"|" "$ENV_FILE"
            else
                echo "API_SIGN_SECRET=\"$API_SIGN\"" >> "$ENV_FILE"
            fi
            
            echo -e "${GREEN}✅ JWT密钥已生成并写入.env文件${NC}"
            echo ""
            echo -e "${YELLOW}请重新运行此脚本以加载新的密钥${NC}"
            exit 0
            ;;
        2)
            show_env_example
            echo -e "${YELLOW}请复制上面的模板，编辑 $ENV_FILE 文件${NC}"
            exit 0
            ;;
        3)
            if [ ${#MISSING_VARS[@]} -ne 0 ]; then
                echo -e "${RED}❌ 基础变量缺失，无法继续启动${NC}"
                echo -e "${YELLOW}请先配置基础变量或使用选项1生成JWT密钥${NC}"
                exit 1
            fi
            echo -e "${YELLOW}🔄 继续启动...${NC}"
            ;;
        4)
            echo "启动已取消"
            echo -e "${YELLOW}请编辑 $ENV_FILE 文件后重试${NC}"
            exit 1
            ;;
        *)
            echo -e "${RED}❌ 无效选择${NC}"
            exit 1
            ;;
    esac
    echo ""
fi

# 显示配置摘要
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    ✅ 配置验证通过${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 基础配置:${NC}"
echo "   数据库: ${DATABASE_URL:-未设置}"
echo "   AI模拟模式: ${AI_STUB_MODE:-false}"
echo "   调试日志: ${AI_DEBUG_LOG:-false}"
echo "   API签名: $([ -n "$API_SIGN_SECRET" ] && echo "已启用" || echo "未设置")"
echo ""
echo -e "${BLUE}🤖 AI服务状态:${NC}"
if [ ${#AI_CONFIGURED[@]} -eq ${#AI_VARS[@]} ]; then
    echo -e "   ${GREEN}✅ 所有AI服务已配置${NC}"
    echo "      • Ark LLM: $([ -n "$ARK_API_KEY" ] && echo "已配置" || echo "未配置")"
    echo "      • 火山ASR: $([ -n "$VOLC_ASR_ACCESS_TOKEN" ] && [ "$VOLC_ASR_ACCESS_TOKEN" != "replace_me" ] && echo "已配置" || echo "未配置")"
    echo "      • 火山TTS: $([ -n "$VOLC_TTS_ACCESS_TOKEN" ] && [ "$VOLC_TTS_ACCESS_TOKEN" != "replace_me" ] && echo "已配置" || echo "未配置")"
else
    configured_count=$(( ${#AI_CONFIGURED[@]} ))
    total_count=$(( ${#AI_VARS[@]} ))
    if [ "$AI_STUB_MODE" = "true" ]; then
        echo -e "   ${YELLOW}⚠️  使用模拟模式运行 ($configured_count/$total_count)${NC}"
        echo "      模拟模式将绕过真实AI调用，仅用于开发测试"
    else
        echo -e "   ${RED}❌ 部分AI服务未配置 ($configured_count/$total_count)${NC}"
    fi
fi
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

# 进入项目目录
cd "$PROJECT_ROOT"

# 检查 node_modules
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}📦 未检测到 node_modules，正在安装依赖...${NC}"
    npm install
    echo ""
fi

# 检查并生成 Prisma Client
if [ ! -d "$PROJECT_ROOT/node_modules/.prisma/client" ]; then
    echo -e "${YELLOW}🔄 生成 Prisma Client...${NC}"
    npx prisma generate
    echo ""
fi

# 参数解析
MIGRATE=false
MODE="dev"

while [[ $# -gt 0 ]]; do
    case $1 in
        --migrate|-m)
            MIGRATE=true
            shift
            ;;
        dev|--dev|-d)
            MODE="dev"
            shift
            ;;
        prod|--prod|-p)
            MODE="prod"
            shift
            ;;
        debug|--debug)
            MODE="debug"
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  dev, --dev, -d       开发模式（默认，支持热重载）"
            echo "  prod, --prod, -p     生产模式"
            echo "  debug, --debug       调试模式"
            echo "  --migrate, -m        启动前运行数据库迁移"
            echo "  --help, -h           显示帮助信息"
            echo ""
            echo "示例:"
            echo "  $0                   # 开发模式"
            echo "  $0 dev               # 开发模式"
            echo "  $0 prod              # 生产模式"
            echo "  $0 --migrate         # 运行迁移后开发模式启动"
            echo "  $0 prod --migrate    # 运行迁移后生产模式启动"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 未知选项: $1${NC}"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
done

# 可选：运行数据库迁移
if [ "$MIGRATE" = true ]; then
    echo -e "${YELLOW}🗄️  正在运行数据库迁移...${NC}"
    npx prisma migrate deploy
    echo ""
fi

# 启动服务
echo -e "${GREEN}🚀 启动 RealDog 后端服务...${NC}"
echo "   模式: $MODE"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

case "$MODE" in
    "dev")
        npm run start:dev
        ;;
    "prod")
        echo -e "${YELLOW}📦 正在构建生产版本...${NC}"
        npm run build
        echo -e "${GREEN}✅ 构建完成，启动服务...${NC}"
        echo ""
        npm run start:prod
        ;;
    "debug")
        npm run start:debug
        ;;
esac
