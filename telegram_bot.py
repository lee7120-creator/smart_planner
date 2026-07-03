import os
import time
import json
import uuid
import datetime
import telebot
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALLOWED_CHAT_ID = os.getenv("ALLOWED_CHAT_ID")

# Conversation paths
CONV_DIR = "C:/Users/user/.gemini/antigravity-ide/brain/0e76dfce-b538-44cd-b55b-aa38b7a0ce01"
MESSAGES_DIR = os.path.join(CONV_DIR, ".system_generated", "messages")
TRANSCRIPT_PATH = os.path.join(CONV_DIR, ".system_generated", "logs", "transcript.jsonl")

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

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    if not is_authorized(message):
        return
        
    help_text = (
        "🤖 **안티그래비티 원격제어 브릿지 봇**\n\n"
        "현재 IDE 세션에 떠 있는 **안티그래비티 에이전트**와 다이렉트로 연결되었습니다!\n\n"
        "💡 **사용 방법**:\n"
        "아무 명령어 없이 일반 메시지로 코딩 지시를 보내시면, 현재 실행 중인 에이전트가 로컬 파일을 직접 분석하고 수정합니다.\n"
        "사용자님의 API 키나 요금을 전혀 쓰지 않으며 무제한으로 사용 가능합니다.\n\n"
        "예: `app.js의 캘린더 색상 관련 코드 읽어서 어떤 색상들이 있는지 알려주고, 기본 색상을 연한 하늘색으로 바꿔줘`"
    )
    bot.reply_to(message, help_text, parse_mode="Markdown")

@bot.message_handler(func=lambda message: True)
def handle_telegram_command(message):
    if not is_authorized(message):
        return
        
    user_query = message.text
    
    # 1. Get current last step index
    start_step_idx = get_last_step_index()
    print(f"Current last step index: {start_step_idx}")
    
    # 2. Generate message file to queue it
    msg_id = str(uuid.uuid4())
    msg_filename = f"{msg_id}.json"
    msg_filepath = os.path.join(MESSAGES_DIR, msg_filename)
    
    msg_data = {
        "id": msg_id,
        "recipient": "0e76dfce-b538-44cd-b55b-aa38b7a0ce01",
        "sender": "0e76dfce-b538-44cd-b55b-aa38b7a0ce01/task-telegram",
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
        "*(수행하는 도구 수에 따라 30초~2분 정도 소요될 수 있습니다)*"
    )
    
    try:
        # Write the file to trigger the agent wakeup
        with open(msg_filepath, 'w', encoding='utf-8') as f:
            json.dump(msg_data, f, ensure_ascii=False, indent=2)
        print(f"Message file created: {msg_filepath}")
        
        # 3. Poll transcript.jsonl for my response
        timeout = 300 # 5 minutes timeout
        poll_interval = 2
        elapsed = 0
        response_sent = False
        
        while elapsed < timeout:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            # Check for new line in transcript
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
                                    # We found a new step! Check if it is a MODEL text response
                                    if (
                                        data.get("source") == "MODEL" 
                                        and data.get("type") == "PLANNER_RESPONSE" 
                                        and not data.get("tool_calls")
                                    ):
                                        content = data.get("content", "").strip()
                                        if content:
                                            # Clean content if it contains system tags
                                            # (Optionally filter/clean here if needed)
                                            
                                            # Send response back to user
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
