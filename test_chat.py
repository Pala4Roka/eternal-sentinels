```python
import os
import asyncio
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent / \"backend\"
load_dotenv(ROOT_DIR / '.env')

async def test_chat():
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
        
        if not EMERGENT_LLM_KEY:
            print(\"❌ EMERGENT_LLM_KEY не найден в .env файле!\")
            return
        
        print(f\"✅ Ключ найден: {EMERGENT_LLM_KEY[:20]}...\")
        
        # Тест чата
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=\"test-session\",
            system_message=\"You are a helpful assistant\"
        ).with_model(\"openai\", \"gpt-4o-mini\")
        
        user_msg = UserMessage(text=\"Hello\")
        response = await chat.send_message(user_msg)
        
        print(f\"✅ Ответ получен: {response[:100]}...\")
        print(\"
🎉 Чат работает корректно!\")
        
    except Exception as e:
        import traceback
        print(f\"❌ Ошибка: {str(e)}\")
        print(f\"
Полный traceback:
{traceback.format_exc()}\")

if __name__ == \"__main__\":
    asyncio.run(test_chat())
```
