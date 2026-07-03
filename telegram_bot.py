import os
import subprocess
import telebot
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_ID = os.getenv("ALLOWED_CHAT_ID")

if not TOKEN:
    print("WARNING: TELEGRAM_BOT_TOKEN is not set in .env file.")
    print("Please create a .env file and set TELEGRAM_BOT_TOKEN.")
    exit(1)

bot = telebot.TeleBot(TOKEN)

def is_authorized(message):
    if not ALLOWED_CHAT_ID:
        # If ALLOWED_CHAT_ID is not configured, inform the user of their chat ID
        bot.reply_to(
            message,
            f"⚠️ 접근이 거부되었습니다.\n"
            f"이 봇을 사용하려면 .env 파일에 ALLOWED_CHAT_ID 설정을 추가해야 합니다.\n"
            f"현재 당신의 Chat ID는 다음과 같습니다:\n"
            f"👉 `{message.chat.id}`\n\n"
            f"이 번호를 복사하여 .env 파일에 ALLOWED_CHAT_ID={message.chat.id} 로 입력해 주세요."
        )
        print(f"Unauthorized access attempt. Chat ID: {message.chat.id}")
        return False
    
    if str(message.chat.id) != str(ALLOWED_CHAT_ID):
        bot.reply_to(message, "❌ 권한이 없습니다. 등록된 관리자 계정만 제어할 수 있습니다.")
        return False
    return True

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    if not is_authorized(message):
        return
        
    help_text = (
        "🤖 **스마트 플래너 원격제어 봇**에 오신 것을 환영합니다!\n\n"
        "사용 가능한 명령어 목록:\n"
        "🚀 /deploy - 최신 코드 Firebase Hosting에 배포\n"
        "🧪 /test - QA 자동화 테스트 실행\n"
        "📊 /status - 프로젝트 현재 상태 및 Git 상태 조회\n"
        "💻 /cmd [명령어] - PC에서 직접 터미널 명령어 실행 (예: `/cmd git status`)"
    )
    bot.reply_to(message, help_text, parse_mode="Markdown")

@bot.message_handler(commands=['deploy'])
def run_deploy(message):
    if not is_authorized(message):
        return
    
    bot.reply_to(message, "🚀 Firebase Hosting 배포를 시작합니다. 잠시만 기다려 주세요...")
    
    try:
        # Run deploy command
        result = subprocess.run(
            "npx firebase-tools deploy --non-interactive",
            shell=True,
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        output = result.stdout + "\n" + result.stderr
        # Truncate output if it's too long for Telegram (limit: 4096 chars)
        if len(output) > 3500:
            output = output[-3500:] + "\n...(일부 로그 생략)"
            
        if result.returncode == 0:
            bot.reply_to(message, f"✅ **배포 성공!**\n\n```\n{output}\n```", parse_mode="Markdown")
        else:
            bot.reply_to(message, f"❌ **배포 실패 (에러 코드: {result.returncode})**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 실행 도중 에러가 발생했습니다:\n`{str(e)}`", parse_mode="Markdown")

@bot.message_handler(commands=['test'])
def run_test(message):
    if not is_authorized(message):
        return
    
    bot.reply_to(message, "🧪 QA 자동화 테스트(Playwright)를 실행합니다...")
    
    try:
        # Find python executable and qa_test.py
        project_dir = os.path.dirname(os.path.abspath(__file__))
        python_exe = os.path.join(project_dir, ".python", "tools", "python.exe")
        qa_script = os.path.join(project_dir, "C:/Users/user/.gemini/antigravity-ide/brain/0e76dfce-b538-44cd-b55b-aa38b7a0ce01/scratch/qa_test.py")
        
        # Fallback to local qa_test.py if the workspace metadata one is not accessible
        if not os.path.exists(qa_script):
            # Check scratch directory in the artifact
            qa_script = "C:/Users/user/.gemini/antigravity-ide/brain/0e76dfce-b538-44cd-b55b-aa38b7a0ce01/scratch/qa_test.py"
            
        result = subprocess.run(
            f'"{python_exe}" "{qa_script}"',
            shell=True,
            capture_output=True,
            text=True
        )
        
        output = result.stdout + "\n" + result.stderr
        if len(output) > 3500:
            output = output[-3500:]
            
        if result.returncode == 0:
            bot.reply_to(message, f"✅ **테스트 완료 (ALL PASS)**\n\n```\n{output}\n```", parse_mode="Markdown")
        else:
            bot.reply_to(message, f"❌ **테스트 실패**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 실행 에러:\n`{str(e)}`", parse_mode="Markdown")

@bot.message_handler(commands=['status'])
def check_status(message):
    if not is_authorized(message):
        return
    
    try:
        # Run git status
        result = subprocess.run("git status", shell=True, capture_output=True, text=True)
        output = result.stdout + "\n" + result.stderr
        bot.reply_to(message, f"📊 **프로젝트 상태 (Git)**\n\n```\n{output[:3500]}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 상태 조회 실패:\n`{str(e)}`", parse_mode="Markdown")

@bot.message_handler(commands=['cmd'])
def run_command(message):
    if not is_authorized(message):
        return
    
    # Extract command
    cmd_text = message.text.replace('/cmd', '', 1).strip()
    if not cmd_text:
        bot.reply_to(message, "ℹ️ 실행할 명령어를 같이 입력해 주세요.\n예: `/cmd git diff`", parse_mode="Markdown")
        return
        
    bot.reply_to(message, f"💻 명령어 실행 중: `{cmd_text}`")
    
    try:
        result = subprocess.run(
            cmd_text,
            shell=True,
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        output = result.stdout + "\n" + result.stderr
        if len(output) > 3500:
            output = output[-3500:]
            
        bot.reply_to(message, f"📤 **실행 결과 (Return Code: {result.returncode})**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 실행 중 에러:\n`{str(e)}`", parse_mode="Markdown")

if __name__ == "__main__":
    print("Telegram Bot has started polling...")
    bot.infinity_polling()
