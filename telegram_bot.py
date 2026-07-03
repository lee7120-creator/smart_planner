import os
import subprocess
import telebot
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_ID = os.getenv("ALLOWED_CHAT_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not TOKEN:
    print("WARNING: TELEGRAM_BOT_TOKEN is not set in .env file.")
    exit(1)

# Configure Gemini if API key is provided
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

bot = telebot.TeleBot(TOKEN)

# ----------------- AI Agent Tools -----------------

def read_file(filepath: str) -> str:
    """Reads the content of a file in the project. The filepath must be relative to the project root."""
    safe_path = os.path.abspath(os.path.join(os.getcwd(), filepath))
    if not safe_path.startswith(os.getcwd()):
        return "Error: Access denied (path outside project directory)"
    try:
        with open(safe_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def write_file(filepath: str, content: str) -> str:
    """Writes or overwrites the content of a file in the project. The filepath must be relative to the project root."""
    safe_path = os.path.abspath(os.path.join(os.getcwd(), filepath))
    if not safe_path.startswith(os.getcwd()):
        return "Error: Access denied (path outside project directory)"
    try:
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return "Success: File written successfully"
    except Exception as e:
        return f"Error writing file: {str(e)}"

def run_terminal_command(command: str) -> str:
    """Runs a shell command in the project directory and returns stdout/stderr. Do not run interactive commands or blockers."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        return f"Return Code: {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    except Exception as e:
        return f"Error running command: {str(e)}"

def list_project_files() -> str:
    """Lists all files and directories in the project root recursively, ignoring hidden folders and large folders like .python, .git, public, node_modules."""
    files_list = []
    ignore_dirs = {'.git', '.python', 'node_modules', 'public', '.firebase', '__pycache__'}
    for root, dirs, files in os.walk(os.getcwd()):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), os.getcwd())
            files_list.append(rel_path)
    return "\n".join(files_list)

# ----------------- Authorization Decorator -----------------

def is_authorized(message):
    if not ALLOWED_CHAT_ID:
        bot.reply_to(
            message,
            f"⚠️ 접근이 거부되었습니다.\n"
            f"이 봇을 사용하려면 .env 파일에 ALLOWED_CHAT_ID 설정을 추가해야 합니다.\n"
            f"현재 당신의 Chat ID는 다음과 같습니다:\n"
            f"👉 `{message.chat.id}`\n\n"
            f"이 번호를 복사하여 .env 파일에 ALLOWED_CHAT_ID={message.chat.id} 로 입력해 주세요."
        )
        return False
    
    if str(message.chat.id) != str(ALLOWED_CHAT_ID):
        bot.reply_to(message, "❌ 권한이 없습니다. 등록된 관리자 계정만 제어할 수 있습니다.")
        return False
    return True

# ----------------- Message Handlers -----------------

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    if not is_authorized(message):
        return
        
    help_text = (
        "🤖 **스마트 플래너 원격제어 AI 에이전트 봇**\n\n"
        "사용 가능한 명령어 목록:\n"
        "🚀 /deploy - 최신 코드 Firebase Hosting에 배포\n"
        "🧪 /test - QA 자동화 테스트 실행\n"
        "📊 /status - 프로젝트 현재 상태 및 Git 상태 조회\n"
        "💻 /cmd [명령어] - 터미널 명령어 직접 실행\n\n"
        "💡 **AI 에이전트 코딩 제어 (대화형)**:\n"
        "명령어 없이 자연어로 말하면 AI 에이전트가 동작하여 코드를 직접 고치고 터미널 작업을 수행합니다!\n"
        "예: `app.js의 캘린더 관련 파일에서 버그 수정하고 배포해줘`"
    )
    bot.reply_to(message, help_text, parse_mode="Markdown")

@bot.message_handler(commands=['deploy'])
def run_deploy(message):
    if not is_authorized(message):
        return
    
    bot.reply_to(message, "🚀 Firebase Hosting 배포를 시작합니다...")
    try:
        # Before deploy, update public folder
        subprocess.run('mkdir public; cp index.html app.js styles.css manifest.webmanifest sw.js icon* public/', shell=True, capture_output=True, text=True)
        # Deploy
        result = subprocess.run("npx firebase-tools deploy --non-interactive", shell=True, capture_output=True, text=True)
        output = result.stdout + "\n" + result.stderr
        if len(output) > 3500:
            output = output[-3500:]
            
        if result.returncode == 0:
            bot.reply_to(message, f"✅ **배포 성공!**\n\n```\n{output}\n```", parse_mode="Markdown")
        else:
            bot.reply_to(message, f"❌ **배포 실패 (에러 코드: {result.returncode})**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 에러 발생: `{str(e)}`")

@bot.message_handler(commands=['test'])
def run_test(message):
    if not is_authorized(message):
        return
    
    bot.reply_to(message, "🧪 QA 자동화 테스트를 실행합니다...")
    try:
        project_dir = os.path.dirname(os.path.abspath(__file__))
        python_exe = os.path.join(project_dir, ".python", "tools", "python.exe")
        qa_script = "C:/Users/user/.gemini/antigravity-ide/brain/0e76dfce-b538-44cd-b55b-aa38b7a0ce01/scratch/qa_test.py"
        
        result = subprocess.run(f'"{python_exe}" "{qa_script}"', shell=True, capture_output=True, text=True)
        output = result.stdout + "\n" + result.stderr
        if len(output) > 3500:
            output = output[-3500:]
            
        if result.returncode == 0:
            bot.reply_to(message, f"✅ **테스트 완료 (ALL PASS)**\n\n```\n{output}\n```", parse_mode="Markdown")
        else:
            bot.reply_to(message, f"❌ **테스트 실패**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 에러 발생: `{str(e)}`")

@bot.message_handler(commands=['status'])
def check_status(message):
    if not is_authorized(message):
        return
    try:
        result = subprocess.run("git status", shell=True, capture_output=True, text=True)
        output = result.stdout + "\n" + result.stderr
        bot.reply_to(message, f"📊 **프로젝트 상태 (Git)**\n\n```\n{output[:3500]}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 에러 발생: `{str(e)}`")

@bot.message_handler(commands=['cmd'])
def run_command(message):
    if not is_authorized(message):
        return
    cmd_text = message.text.replace('/cmd', '', 1).strip()
    if not cmd_text:
        bot.reply_to(message, "ℹ️ 명령어를 입력해 주세요. 예: `/cmd git diff`")
        return
        
    bot.reply_to(message, f"💻 명령어 실행 중: `{cmd_text}`")
    try:
        result = subprocess.run(cmd_text, shell=True, capture_output=True, text=True, cwd=os.getcwd())
        output = result.stdout + "\n" + result.stderr
        if len(output) > 3500:
            output = output[-3500:]
        bot.reply_to(message, f"📤 **실행 결과**\n\n```\n{output}\n```", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"💥 에러 발생: `{str(e)}`")

# ----------------- AI Agent Message Handler -----------------

@bot.message_handler(func=lambda message: True)
def handle_ai_agent(message):
    if not is_authorized(message):
        return
        
    if not GEMINI_API_KEY:
        bot.reply_to(
            message,
            "⚠️ AI 에이전트 코딩 제어 기능을 사용하려면 `.env` 파일에 `GEMINI_API_KEY`를 설정해야 합니다.\n\n"
            "무료 발급 방법:\n"
            "1. https://aistudio.google.com/ 접속 및 로그인\n"
            "2. **Get API Key** 클릭하여 새 키 발급\n"
            "3. `.env` 파일에 `GEMINI_API_KEY=발급받은키` 추가 후 봇 재시작!"
        )
        return

    user_query = message.text
    bot.reply_to(message, "🧠 AI 에이전트가 코드를 분석하고 작업을 진행하고 있습니다. 완료되면 수정 내역을 보고해 드릴게요... (10~30초 소요)")
    
    try:
        # Initialize Gemini Model with tools
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            tools=[read_file, write_file, run_terminal_command, list_project_files],
            system_instruction=(
                "당신은 사용자의 컴퓨터 로컬 환경에서 코드를 개발하는 자율 AI 코딩 에이전트입니다. "
                "사용자의 한글 지시사항에 따라 적절한 도구(파일 리스팅, 읽기, 쓰기, 터미널 명령어 실행)를 사용해서 코드를 고치거나 작업을 진행하십시오. "
                "코드를 수정할 때 원래 기능이 망가지지 않도록 주의해야 합니다. "
                "모든 작업이 완료되면 사용자에게 어떤 파일을 어떻게 수정했는지 요약하여 한국어로 친절히 보고하십시오."
            )
        )
        
        # Start chat with automatic tool call loop
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(user_query)
        
        # Reply back with the AI agent's analysis and final response
        bot.reply_to(message, f"💡 **AI 에이전트 처리 결과:**\n\n{response.text}")
        
    except Exception as e:
        bot.reply_to(message, f"💥 AI 에이전트 실행 중 에러가 발생했습니다:\n`{str(e)}`", parse_mode="Markdown")

if __name__ == "__main__":
    print("Telegram AI Agent Bot has started polling...")
    bot.infinity_polling()
