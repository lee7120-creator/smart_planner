import os
import time
import json
import uuid
import datetime
import re
import subprocess
import telebot
from telebot import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_ID = os.getenv("ALLOWED_CHAT_ID")

# Conversation paths
CONV_DIR = "C:/Users/user/.gemini/antigravity-ide/brain/0e76dfce-b538-44cd-b55b-aa38b7a0ce01"
MESSAGES_DIR = os.path.join(CONV_DIR, ".system_generated", "messages")
TRANSCRIPT_PATH = os.path.join(CONV_DIR, ".system_generated", "logs", "transcript.jsonl")
QA_TEST_PATH = os.path.join(CONV_DIR, "scratch", "qa_test.py")
ARTIFACTS_DIR = os.path.join(CONV_DIR, "artifacts")

PYTHON_EXE = r"d:\Project_1\.python\tools\python.exe"

if not TOKEN:
    print("WARNING: TELEGRAM_BOT_TOKEN is not set in .env file.")
    exit(1)

bot = telebot.TeleBot(TOKEN)

# Ensure folders exist
os.makedirs(MESSAGES_DIR, exist_ok=True)

def is_authorized(message):
    if not ALLOWED_CHAT_ID:
        bot.reply_to(
            message,
            f"⚠️ 접근이 거부되었습니다.\n"
            f"현재 당신의 Chat ID는 다음과 같습니다:\n"
            f"👉 `{message.chat.id}`\n\n"
            f"이 번호를 .env 파일에 ALLOWED_CHAT_ID로 설정해 주세요."
        )
        return False
    if str(message.chat.id) != str(ALLOWED_CHAT_ID):
        bot.reply_to(message, "❌ 권한이 없습니다.")
        return False
    return True

def get_main_keyboard():
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    btn_screen = types.KeyboardButton("🖥️ 실시간 화면")
    btn_test = types.KeyboardButton("🧪 E2E 테스트")
    btn_status = types.KeyboardButton("📊 로컬 상태")
    btn_deploy = types.KeyboardButton("🚀 파이어베이스 배포")
    btn_sleep = types.KeyboardButton("💤 PC 절전")
    btn_shutdown = types.KeyboardButton("🔌 PC 종료")
    markup.add(btn_screen, btn_test, btn_status, btn_deploy, btn_sleep, btn_shutdown)
    return markup

def get_last_step_index():
    """Reads transcript.jsonl and returns the highest step_index currently recorded."""
    if not os.path.exists(TRANSCRIPT_PATH):
        return -1
    last_idx = -1
    try:
        with open(TRANSCRIPT_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    idx = data.get("step_index", -1)
                    if idx > last_idx:
                        last_idx = idx
                except Exception:
                    pass
    except Exception as e:
        print(f"Error reading transcript: {e}")
    return last_idx

def find_own_task_id():
    """Finds the active task ID of this running telegram_bot.py from transcript.jsonl."""
    if not os.path.exists(TRANSCRIPT_PATH):
        return "0e76dfce-b538-44cd-b55b-aa38b7a0ce01/task-telegram"
    last_task = None
    try:
        with open(TRANSCRIPT_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if "telegram_bot.py" in line and "task-" in line:
                    match = re.search(r'task-\d+', line)
                    if match:
                        last_task = f"0e76dfce-b538-44cd-b55b-aa38b7a0ce01/{match.group(0)}"
    except Exception as e:
        print(f"Error finding task ID: {e}")
    return last_task or "0e76dfce-b538-44cd-b55b-aa38b7a0ce01/task-telegram"

def capture_screen_local(message):
    status_msg = bot.reply_to(message, "📸 로컬 브라우저를 띄워 실시간 모바일 뷰를 캡처 중입니다...")
    screenshot_path = "temp_screen.png"
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 400, "height": 850})
            page = context.new_page()
            page.goto('http://localhost:8080')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000) # Wait for animation/transition
            page.screenshot(path=screenshot_path)
            browser.close()
            
        with open(screenshot_path, 'rb') as photo:
            bot.send_photo(message.chat.id, photo, caption="🖥️ 실시간 로컬 앱 프리뷰 (모바일 뷰)")
            
        if os.path.exists(screenshot_path):
            os.remove(screenshot_path)
        bot.delete_message(message.chat.id, status_msg.message_id)
    except Exception as e:
        bot.reply_to(message, f"❌ 화면 캡처 실패: {str(e)}")

def run_e2e_test(message):
    status_msg = bot.reply_to(message, "🧪 Playwright E2E 자동 테스트 스크립트를 실행하는 중입니다...")
    try:
        result = subprocess.run(
            [PYTHON_EXE, QA_TEST_PATH],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            cwd="d:\\Project_1"
        )
        
        test_log = result.stdout
        bot.reply_to(message, f"📋 **테스트 로그:**\n```\n{test_log[-1500:]}\n```")
        
        chk_err_img = os.path.join(ARTIFACTS_DIR, "qa_test_checkbox_error.png")
        del_err_img = os.path.join(ARTIFACTS_DIR, "qa_test_delete_error.png")
        
        if "SUCCESS" in test_log:
            bot.send_message(message.chat.id, "✅ **E2E 테스트 성공! 모든 시나리오가 올바르게 작동합니다.**")
        else:
            bot.send_message(message.chat.id, "❌ **E2E 테스트 실패! 오류 캡처 이미지를 확인합니다...**")
            if os.path.exists(chk_err_img):
                with open(chk_err_img, 'rb') as photo:
                    bot.send_photo(message.chat.id, photo, caption="⚠️ 체크박스 테스트 실패 시점 스크린샷")
            elif os.path.exists(del_err_img):
                with open(del_err_img, 'rb') as photo:
                    bot.send_photo(message.chat.id, photo, caption="⚠️ 삭제 테스트 실패 시점 스크린샷")
        bot.delete_message(message.chat.id, status_msg.message_id)
    except Exception as e:
        bot.reply_to(message, f"❌ 테스트 실행 중 에러 발생: {str(e)}")

def check_local_status(message):
    status_msg = bot.reply_to(message, "📊 로컬 서버 및 프로젝트 상태를 진해하는 중입니다...")
    try:
        git_res = subprocess.run(["git", "status", "-s"], capture_output=True, text=True, cwd="d:\\Project_1")
        netstat_res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        server_running = "127.0.0.1:8080" in netstat_res.stdout or "0.0.0.0:8080" in netstat_res.stdout or "[::]:8080" in netstat_res.stdout
        
        status_text = (
            f"📊 **로컬 개발 환경 상태 리포트**\n\n"
            f"💻 **로컬 서버 (port 8080)**: {'🟢 RUNNING' if server_running else '🔴 STOPPED'}\n"
            f"📂 **Git 변경 상태**:\n```\n{git_res.stdout or '깨끗함 (No changes)'}\n```"
        )
        bot.reply_to(message, status_text, parse_mode="Markdown")
        bot.delete_message(message.chat.id, status_msg.message_id)
    except Exception as e:
        bot.reply_to(message, f"❌ 상태 조회 실패: {str(e)}")

def deploy_firebase_hosting(message):
    status_msg = bot.reply_to(message, "🚀 Firebase Hosting 배포 명령을 실행 중입니다...")
    try:
        result = subprocess.run(
            ["npx", "firebase", "deploy", "--only", "hosting"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            cwd="d:\\Project_1",
            shell=True
        )
        output = result.stdout
        if result.returncode == 0:
            bot.reply_to(
                message,
                f"✅ **Firebase Hosting 배포 성공!**\n\n"
                f"🔗 라이브 URL: https://my-calendar-1a589.web.app\n"
                f"```\n{output[-1000:]}\n```"
            )
        else:
            bot.reply_to(message, f"❌ **배포 실패:**\n```\n{output[-1000:]}\n```")
        bot.delete_message(message.chat.id, status_msg.message_id)
    except Exception as e:
        bot.reply_to(message, f"❌ 배포 중 에러 발생: {str(e)}")

def trigger_pc_sleep(message):
    bot.reply_to(message, "💤 컴퓨터를 즉시 절전 모드로 진입시킵니다...")
    try:
        # Put Windows to sleep (using rundll32 powrprof.dll)
        subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"], shell=True)
    except Exception as e:
        bot.reply_to(message, f"❌ 절전 모드 진입 실패: {str(e)}")

def trigger_pc_shutdown(message):
    bot.reply_to(
        message,
        "🔌 **15초 후에 컴퓨터가 완전히 종료됩니다!**\n\n"
        "실수를 방지하기 위해 15초의 대기 시간이 주어집니다.\n"
        "취소하려면 텔레그램 채팅창에 `/abort` 를 보내주세요!"
    )
    try:
        subprocess.run(["shutdown", "/s", "/t", "15"], shell=True)
    except Exception as e:
        bot.reply_to(message, f"❌ 전원 종료 실패: {str(e)}")

@bot.message_handler(commands=['abort'])
def abort_shutdown(message):
    if not is_authorized(message):
        return
    try:
        subprocess.run(["shutdown", "/a"], shell=True)
        bot.reply_to(message, "✅ **컴퓨터 전원 종료 명령이 취소되었습니다.**")
    except Exception as e:
        bot.reply_to(message, f"❌ 취소 실패 (진행 중인 종료 명령이 없을 수 있습니다): {str(e)}")

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    if not is_authorized(message):
        return
        
    help_text = (
        "🤖 **안티그래비티 원격제어 프로(PRO) 봇**\n\n"
        "현재 IDE 세션에 떠 있는 **안티그래비티 에이전트**와 다이렉트로 연결되었습니다!\n"
        "아래 퀵 메뉴를 통해 원격 제어 및 테스트를 즉시 수행할 수 있습니다.\n\n"
        "💡 **사용 방법**:\n"
        "1️⃣ **일반 자연어 지시**: 주석 달아줘, app.js에 기능 추가해줘 등 지시를 채팅으로 보내시면 안티그래비티가 백그라운드에서 실시간 코딩을 진행합니다.\n"
        "2️⃣ **퀵 메뉴 버튼**:\n"
        "- `🖥️ 실시간 화면`: 로컬 앱 모바일 프리뷰 캡처 전송\n"
        "- `🧪 E2E 테스트`: Playwright 자동 테스트 실행 및 에러 확인\n"
        "- `📊 로컬 상태`: 서버 구동 및 파일 변경점 확인\n"
        "- `🚀 파이어베이스 배포`: Firebase Hosting 즉시 실시간 배포\n"
        "- `💤 PC 절전`: 컴퓨터 절전 모드 진입\n"
        "- `🔌 PC 종료`: 15초 카운트다운 후 컴퓨터 완전 종료 (취소는 `/abort`)"
    )
    bot.reply_to(message, help_text, reply_markup=get_main_keyboard(), parse_mode="Markdown")

@bot.message_handler(func=lambda message: True)
def handle_telegram_command(message):
    if not is_authorized(message):
        return
        
    user_query = message.text
    
    # Check for keyboard commands
    if user_query == "🖥️ 실시간 화면":
        capture_screen_local(message)
        return
    elif user_query == "🧪 E2E 테스트":
        run_e2e_test(message)
        return
    elif user_query == "📊 로컬 상태":
        check_local_status(message)
        return
    elif user_query == "🚀 파이어베이스 배포":
        deploy_firebase_hosting(message)
        return
    elif user_query == "💤 PC 절전":
        trigger_pc_sleep(message)
        return
    elif user_query == "🔌 PC 종료":
        trigger_pc_shutdown(message)
        return
        
    # Otherwise forward to Antigravity IDE agent queue
    start_step_idx = get_last_step_index()
    print(f"Current last step index: {start_step_idx}")
    
    active_task_id = find_own_task_id()
    print(f"Found own active task ID: {active_task_id}")
    
    msg_id = str(uuid.uuid4())
    msg_filename = f"{msg_id}.json"
    msg_filepath = os.path.join(MESSAGES_DIR, msg_filename)
    
    msg_data = {
        "id": msg_id,
        "recipient": "0e76dfce-b538-44cd-b55b-aa38b7a0ce01",
        "sender": active_task_id,
        "priority": "MESSAGE_PRIORITY_HIGH",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "renderDetails": {
            "messageTitle": "Telegram User Message"
        },
        "content": f"<USER_REQUEST>\n{user_query}\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe request was made remotely via Telegram.\n</ADDITIONAL_METADATA>"
    }
    
    status_msg = bot.reply_to(
        message, 
        "🧠 안티그래비티 에이전트를 깨웠습니다. 지시사항을 분석하고 코드를 제어하는 중입니다...\n"
        "*(수행하는 도구 수에 따라 5초~20초 소요됩니다)*"
    )
    
    try:
        with open(msg_filepath, 'w', encoding='utf-8') as f:
            json.dump(msg_data, f, ensure_ascii=False, indent=2)
        print(f"Message file created: {msg_filepath}")
        
        timeout = 300
        poll_interval = 1
        elapsed = 0
        response_sent = False
        
        while elapsed < timeout:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            if os.path.exists(TRANSCRIPT_PATH):
                try:
                    with open(TRANSCRIPT_PATH, 'r', encoding='utf-8') as f:
                        for line in f:
                            if not line.strip():
                                continue
                            try:
                                data = json.loads(line)
                                idx = data.get("step_index", -1)
                                if idx > start_step_idx:
                                    if (
                                        data.get("source") == "MODEL" 
                                        and data.get("type") == "PLANNER_RESPONSE" 
                                        and not data.get("tool_calls")
                                    ):
                                        content = data.get("content", "").strip()
                                        if content:
                                            bot.reply_to(message, f"💡 **안티그래비티 실행 완료:**\n\n{content}")
                                            response_sent = True
                                            break
                            except Exception:
                                pass
                except Exception as e:
                    print(f"Error checking transcript in loop: {e}")
                    
            if response_sent:
                break
                
        if not response_sent:
            bot.edit_message_text(
                chat_id=message.chat.id,
                message_id=status_msg.message_id,
                text="⚠️ 대기 시간이 초과되었습니다. 작업이 오래 걸리거나 백그라운드에서 진행 중일 수 있습니다. IDE를 확인해 주세요."
            )
            
    except Exception as e:
        bot.reply_to(message, f"❌ 에이전트 연동 중 실패: {str(e)}")

if __name__ == "__main__":
    print("Telegram Antigravity Bridge Bot has started polling...")
    bot.infinity_polling()
