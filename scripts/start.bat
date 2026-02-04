@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: RealDog Backend Startup Script for Windows
:: 自动设置和验证环境变量，然后启动后端服务

:: 设置路径
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "ENV_FILE=%PROJECT_ROOT%\.env"

echo ╔════════════════════════════════════════════════════════╗
echo ║        🐕 RealDog Backend Startup Script               ║
echo ║         自动环境变量配置与验证                          ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:: 显示所有必需的Key列表
:show_required_keys
echo.
echo ════════════════════════════════════════════════════════════
echo              🔑 RealDog 必需的环境变量清单
echo ════════════════════════════════════════════════════════════
echo.
echo 【基础配置】
echo   1. DATABASE_URL          - SQLite数据库路径 (默认: file:./dev.db)
echo   2. JWT_SECRET            - JWT签名密钥 (需要强随机字符串)
echo   3. JWT_RT_SECRET         - JWT刷新令牌密钥 (需要强随机字符串)
echo   4. API_SIGN_SECRET       - API请求签名密钥 (用于移动端验证)
echo.
echo 【AI大模型 - 字节跳动 Ark】
echo   5. ARK_API_KEY           - Ark LLM API密钥
echo   6. ARK_MODEL_ID          - 模型ID (如: doubao-seed-1-8-251228)
echo      🔗 获取地址: https://console.volcengine.com/ark/
echo.
echo 【语音识别 - 火山引擎 ASR】
echo   7. VOLC_ASR_APP_ID       - ASR应用ID
echo   8. VOLC_ASR_ACCESS_TOKEN - ASR访问令牌
echo   9. VOLC_ASR_CLUSTER      - ASR集群 (如: volcengine_input_common)
echo      🔗 获取地址: https://console.volcengine.com/speech/
echo.
echo 【语音合成 - 火山引擎 TTS】
echo  10. VOLC_TTS_APP_ID       - TTS应用ID
echo  11. VOLC_TTS_ACCESS_TOKEN - TTS访问令牌
echo  12. VOLC_TTS_CLUSTER      - TTS集群
echo      🔗 获取地址: https://console.volcengine.com/speech/
echo.
echo ════════════════════════════════════════════════════════════
echo.
goto :eof

:: 显示.env文件示例
:show_env_example
echo 📝 .env 文件示例:
echo.
echo # ============================================================
echo # RealDog 后端环境变量配置
echo # ============================================================
echo.
echo # 数据库配置
echo DATABASE_URL="file:./dev.db"
echo.
echo # JWT密钥（生成命令: openssl rand -base64 64）
echo JWT_SECRET="your-jwt-secret-here-minimum-32-characters-long"
echo JWT_RT_SECRET="your-refresh-token-secret-here-minimum-32-characters"
echo.
echo # API签名密钥（用于移动端请求验证）
echo API_SIGN_SECRET="your-api-sign-secret-here"
echo.
echo # AI调试配置
echo AI_DEBUG_LOG="true"
echo AI_STUB_MODE="false"
echo.
echo # ============================================================
echo # 火山引擎 ASR 语音识别
echo # 控制台: https://console.volcengine.com/speech/service/8
echo # ============================================================
echo VOLC_ASR_WS_URL="wss://openspeech.bytedance.com/api/v2/asr"
echo VOLC_ASR_APP_ID="your-asr-app-id"
echo VOLC_ASR_ACCESS_TOKEN="your-asr-access-token"
echo VOLC_ASR_CLUSTER="volcengine_input_common"
echo VOLC_ASR_UID="real-dog"
echo VOLC_ASR_WORKFLOW="audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate"
echo.
echo # ============================================================
echo # 字节跳动 Ark LLM 大模型
echo # 控制台: https://console.volcengine.com/ark/
echo # ============================================================
echo ARK_API_BASE="https://ark.cn-beijing.volces.com/api/v3"
echo ARK_API_KEY="your-ark-api-key"
echo ARK_MODEL_ID="doubao-seed-1-8-251228"
echo.
echo # ============================================================
echo # 火山引擎 TTS 语音合成
echo # 控制台: https://console.volcengine.com/speech/service/9
echo # ============================================================
echo VOLC_TTS_HTTP_URL="https://openspeech.bytedance.com/api/v1/tts"
echo VOLC_TTS_APP_ID="your-tts-app-id"
echo VOLC_TTS_ACCESS_TOKEN="your-tts-access-token"
echo VOLC_TTS_CLUSTER="your-tts-cluster"
echo VOLC_TTS_VOICE_TYPE_ZH="your-zh-voice-type"
echo VOLC_TTS_VOICE_TYPE_EN="your-en-voice-type"
echo VOLC_TTS_ENCODING="mp3"
echo.
echo # 音频输出模式 (volc_tts ^| synthetic)
echo DOG_AUDIO_OUTPUT_MODE="volc_tts"
echo.
goto :eof

:: 从.env文件加载环境变量
:load_env
for /f "usebackq tokens=1,2* delims==" %%a in ("%ENV_FILE%") do (
    set "var_name=%%a"
    :: 去除首尾空格
    for /f "tokens=*" %%x in ("%%a") do set "var_name=%%x"
    
    :: 跳过注释行
    echo !var_name! | findstr /r /c:"^#" >nul && goto :continue_loop
    
    :: 跳过空行
    if "!var_name!"=="" goto :continue_loop
    
    set "var_value=%%b"
    :: 去除值的引号
    set "var_value=!var_value:"=!"
    
    set "!var_name!=!var_value!"
    
    :continue_loop
)
goto :eof

:: 检查变量是否设置
:check_var
set "var_name=%~1"
set "var_desc=%~2"
set "var_guide=%~3"
set "check_type=%~4"

if "!%var_name%!"=="" goto :var_not_set
if "!%var_name%!"=="replace_me" goto :var_placeholder

:: 变量已设置
if "%check_type%"=="AI" (
    echo    ✅ %var_name% - %var_desc% [已设置]
    set /a AI_CONFIGURED_COUNT+=1
) else (
    set "value=!%var_name%!"
    set "display_value="
    call :mask_value "!value!" display_value
    echo    ✅ %var_name% - %var_desc% [已设置]
    echo       值: !display_value!
)
set /a VAR_SET_COUNT+=1
goto :eof

:var_not_set
echo    ❌ %var_name% - %var_desc% [未设置]
if "%check_type%"=="AI" (
    set "AI_MISSING[!AI_MISSING_COUNT!]=%var_name%^|%var_desc%^|%var_guide%"
    set /a AI_MISSING_COUNT+=1
) else (
    set "MISSING_VARS[!MISSING_COUNT!]=%var_name%^|%var_desc%^|%var_guide%"
    set /a MISSING_COUNT+=1
)
goto :eof

:var_placeholder
echo    ❌ %var_name% - %var_desc% [为占位符replace_me]
if "%check_type%"=="AI" (
    set "AI_MISSING[!AI_MISSING_COUNT!]=%var_name%^|%var_desc%^|%var_guide%"
    set /a AI_MISSING_COUNT+=1
) else (
    set "MISSING_VARS[!MISSING_COUNT!]=%var_name%^|%var_desc%^|%var_guide%"
    set /a MISSING_COUNT+=1
)
goto :eof

:: 掩码显示值
:mask_value
set "input=%~1"
set "len=0"
set "temp=!input!"

:count_loop
if not "!temp!"=="" (
    set "temp=!temp:~1!"
    set /a len+=1
    goto :count_loop
)

if !len! gtr 16 (
    set "masked=!input:~0,8!****!input:~-8!"
) else if !len! gtr 8 (
    set "masked=!input:~0,4!****!input:~-4!"
) else (
    set "masked=****"
)

set "%~2=!masked!"
goto :eof

:: 生成JWT密钥
:generate_jwt
echo.
echo 🔑 正在生成JWT密钥...
echo    (Windows下无法直接生成，请使用以下命令手动生成并复制到.env文件)
echo.
echo ════════════════════════════════════════════════════════════
echo 请打开PowerShell或Git Bash运行以下命令:
echo.
echo # 生成JWT_SECRET (64字节base64)
echo openssl rand -base64 64
echo.
echo # 生成JWT_RT_SECRET (64字节base64)
echo openssl rand -base64 64
echo.
echo # 生成API_SIGN_SECRET (32字节base64)
echo openssl rand -base64 32
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 💡 或者使用在线工具生成随机字符串:
echo    https://www.random.org/strings/
echo.
echo 生成后请手动编辑 %ENV_FILE% 文件，添加:
echo    JWT_SECRET=你的密钥
echo    JWT_RT_SECRET=你的密钥
echo    API_SIGN_SECRET=你的密钥
echo.
pause
goto :eof

:: 显示交互式菜单
:show_menu
echo.
echo ════════════════════════════════════════════════════════════
echo                  ⚠️  环境变量配置不完整
echo ════════════════════════════════════════════════════════════
echo.

if !MISSING_COUNT! gtr 0 (
    echo 【缺失的基础变量】
    echo.
    for /l %%i in (0,1,!MISSING_COUNT!-1) do (
        for /f "tokens=1,2,3 delims=|" %%a in ("!MISSING_VARS[%%i]!") do (
            echo    • %%a
echo       说明: %%b
echo       设置: %%c
echo.
        )
    )
)

if !AI_MISSING_COUNT! gtr 0 (
    echo 【缺失的AI服务密钥】
    echo.
    for /l %%i in (0,1,!AI_MISSING_COUNT!-1) do (
        for /f "tokens=1,2,3 delims=|" %%a in ("!AI_MISSING[%%i]!") do (
            echo    • %%a
echo       说明: %%b
echo       获取: %%c
echo.
        )
    )
    echo 💡 提示: 如果不配置AI密钥，可以使用模拟模式进行开发测试
echo       设置 AI_STUB_MODE=true 即可绕过真实AI调用
echo.
)

echo ════════════════════════════════════════════════════════════
echo.
echo 请选择操作:
echo.
echo    [1] 生成JWT密钥（提示用户手动复制）
echo    [2] 显示完整的.env模板
echo    [3] 继续启动（使用模拟模式/开发模式）
echo    [4] 退出
echo.

:: 如果没有AI_STUB_MODE且AI密钥缺失，建议使用模拟模式
if !AI_MISSING_COUNT! gtr 0 (
    if not "!AI_STUB_MODE!"=="true" (
        echo 💡 建议: 您缺少AI密钥，建议设置 AI_STUB_MODE=true 使用模拟模式
echo.
    )
)

set /p "choice=请选择 (1/2/3/4): "
echo.

if "%choice%"=="1" (
    call :generate_jwt
    exit /b 0
) else if "%choice%"=="2" (
    call :show_env_example
    echo 请复制上面的模板，编辑 %ENV_FILE% 文件
echo.
    pause
    exit /b 0
) else if "%choice%"=="3" (
    if !MISSING_COUNT! gtr 0 (
        echo ❌ 基础变量缺失，无法继续启动
echo    请先配置基础变量或使用选项1生成JWT密钥
echo.
        pause
        exit /b 1
    )
    echo 🔄 继续启动...
echo.
) else if "%choice%"=="4" (
    echo 启动已取消
echo 请编辑 %ENV_FILE% 文件后重试
echo.
    pause
    exit /b 1
) else (
    echo ❌ 无效选择
echo.
    pause
    exit /b 1
)
goto :eof

:: 显示配置摘要
:show_config_summary
echo.
echo ════════════════════════════════════════════════════════════
echo                    ✅ 配置验证通过
echo ════════════════════════════════════════════════════════════
echo.
echo 📊 基础配置:
echo    数据库: !DATABASE_URL!
echo    AI模拟模式: !AI_STUB_MODE!
echo    调试日志: !AI_DEBUG_LOG!
if defined API_SIGN_SECRET (
    echo    API签名: 已启用
) else (
    echo    API签名: 未设置
)
echo.
echo 🤖 AI服务状态:
set /a AI_TOTAL=8
if !AI_CONFIGURED_COUNT! equ !AI_TOTAL! (
    echo    ✅ 所有AI服务已配置
    if defined ARK_API_KEY (
        echo       • Ark LLM: 已配置
    ) else (
        echo       • Ark LLM: 未配置
    )
    if defined VOLC_ASR_ACCESS_TOKEN (
        if not "!VOLC_ASR_ACCESS_TOKEN!"=="replace_me" (
            echo       • 火山ASR: 已配置
        ) else (
            echo       • 火山ASR: 未配置
        )
    ) else (
        echo       • 火山ASR: 未配置
    )
    if defined VOLC_TTS_ACCESS_TOKEN (
        if not "!VOLC_TTS_ACCESS_TOKEN!"=="replace_me" (
            echo       • 火山TTS: 已配置
        ) else (
            echo       • 火山TTS: 未配置
        )
    ) else (
        echo       • 火山TTS: 未配置
    )
) else (
    if "!AI_STUB_MODE!"=="true" (
        echo    ⚠️  使用模拟模式运行 (!AI_CONFIGURED_COUNT!/!AI_TOTAL!)
        echo       模拟模式将绕过真实AI调用，仅用于开发测试
    ) else (
        echo    ⚠️  部分AI服务未配置 (!AI_CONFIGURED_COUNT!/!AI_TOTAL!)
    )
)
echo.
echo ════════════════════════════════════════════════════════════
echo.
goto :eof

:: 主程序开始

:: 检查 .env 文件是否存在
if not exist "%ENV_FILE%" (
    echo ❌ 错误: .env 文件不存在
    echo 📍 期望位置: %ENV_FILE%
    echo.
    call :show_required_keys
    call :show_env_example
    echo 💡 提示: 复制上面的示例，创建 .env 文件并填入您的实际密钥
    echo.
    pause
    exit /b 1
)

echo 📋 正在加载环境变量...
echo    文件: %ENV_FILE%
echo.

:: 加载环境变量
call :load_env

:: 验证必需的环境变量
echo 🔍 验证必要的环境变量...
echo.

:: 初始化计数器
set "MISSING_COUNT=0"
set "AI_MISSING_COUNT=0"
set "AI_CONFIGURED_COUNT=0"
set "VAR_SET_COUNT=0"

:: 验证基础必需变量
call :check_var "DATABASE_URL" "数据库连接" "file:./dev.db"
call :check_var "JWT_SECRET" "JWT签名密钥" "openssl rand -base64 64"
call :check_var "JWT_RT_SECRET" "JWT刷新令牌密钥" "openssl rand -base64 64"
call :check_var "API_SIGN_SECRET" "API请求签名密钥" "任意强密码"

echo.

:: 验证AI/ML服务密钥
echo 🤖 验证AI/ML服务密钥...
echo.

call :check_var "ARK_API_KEY" "Ark LLM API密钥" "https://console.volcengine.com/ark/" "AI"
call :check_var "ARK_MODEL_ID" "Ark LLM模型ID" "doubao-seed-1-8-251228" "AI"
call :check_var "VOLC_ASR_APP_ID" "火山ASR应用ID" "https://console.volcengine.com/speech/" "AI"
call :check_var "VOLC_ASR_ACCESS_TOKEN" "火山ASR访问令牌" "https://console.volcengine.com/speech/" "AI"
call :check_var "VOLC_ASR_CLUSTER" "火山ASR集群" "volcengine_input_common" "AI"
call :check_var "VOLC_TTS_APP_ID" "火山TTS应用ID" "https://console.volcengine.com/speech/" "AI"
call :check_var "VOLC_TTS_ACCESS_TOKEN" "火山TTS访问令牌" "https://console.volcengine.com/speech/" "AI"
call :check_var "VOLC_TTS_CLUSTER" "火山TTS集群" "见控制台" "AI"

echo.

:: 检查可选变量
echo 📎 可选环境变量检查:
if defined AI_DEBUG_LOG (
    echo    ✓ AI_DEBUG_LOG = !AI_DEBUG_LOG! (true^|false)
) else (
    echo    ○ AI_DEBUG_LOG 未设置（将使用默认值） (true^|false)
)

if defined AI_STUB_MODE (
    echo    ✓ AI_STUB_MODE = !AI_STUB_MODE! (true^|false)
) else (
    echo    ○ AI_STUB_MODE 未设置（将使用默认值） (true^|false)
)

if defined DOG_AUDIO_OUTPUT_MODE (
    echo    ✓ DOG_AUDIO_OUTPUT_MODE = !DOG_AUDIO_OUTPUT_MODE! (volc_tts^|synthetic)
) else (
    echo    ○ DOG_AUDIO_OUTPUT_MODE 未设置（将使用默认值） (volc_tts^|synthetic)
)

echo.

:: 如果有缺失的变量，显示菜单
if !MISSING_COUNT! gtr 0 (
    call :show_menu
) else if !AI_MISSING_COUNT! gtr 0 (
    call :show_menu
)

:: 显示配置摘要
call :show_config_summary

:: 进入项目目录
cd /d "%PROJECT_ROOT%"

:: 检查 node_modules
if not exist "node_modules" (
    echo 📦 未检测到 node_modules，正在安装依赖...
    call npm install
    echo.
)

:: 检查 Prisma Client
if not exist "node_modules\.prisma\client" (
    echo 🔄 生成 Prisma Client...
    call npx prisma generate
    echo.
)

:: 解析参数
set "MODE=dev"
set "MIGRATE=false"

:parse_args
if "%~1"=="" goto :start_server
if "%~1"=="--migrate" set "MIGRATE=true"
if "%~1"=="-m" set "MIGRATE=true"
if "%~1"=="dev" set "MODE=dev"
if "%~1"=="--dev" set "MODE=dev"
if "%~1"=="-d" set "MODE=dev"
if "%~1"=="prod" set "MODE=prod"
if "%~1"=="--prod" set "MODE=prod"
if "%~1"=="-p" set "MODE=prod"
if "%~1"=="debug" set "MODE=debug"
if "%~1"=="--debug" set "MODE=debug"
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help
shift
goto :parse_args

:show_help
echo 用法: %~nx0 [选项]
echo.
echo 选项:
echo   dev, --dev, -d       开发模式（默认，支持热重载）
echo   prod, --prod, -p     生产模式
echo   debug, --debug       调试模式
echo   --migrate, -m        启动前运行数据库迁移
echo   --help, -h           显示帮助信息
echo.
echo 示例:
echo   %~nx0                   开发模式
echo   %~nx0 dev               开发模式
echo   %~nx0 prod              生产模式
echo   %~nx0 --migrate         运行迁移后开发模式启动
echo   %~nx0 prod --migrate    运行迁移后生产模式启动
echo.
pause
exit /b 0

:start_server
:: 运行数据库迁移
if "%MIGRATE%"=="true" (
    echo 🗄️ 正在运行数据库迁移...
    call npx prisma migrate deploy
    echo.
)

:: 启动服务
echo 🚀 启动 RealDog 后端服务...
echo    模式: %MODE%
echo    时间: %date% %time%
echo.
echo ════════════════════════════════════════════════════════════
echo.

if "%MODE%"=="dev" (
    call npm run start:dev
) else if "%MODE%"=="prod" (
    echo 📦 正在构建生产版本...
    call npm run build
    echo ✅ 构建完成，启动服务...
    echo.
    call npm run start:prod
) else if "%MODE%"=="debug" (
    call npm run start:debug
)

pause
exit /b 0
