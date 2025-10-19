"""
Fallback responses for MAL0 chat when API is unavailable
"""
import random
import re

# Greeting responses
GREETINGS = [
    "Приветствую вас. Я MAL0, ассистент базы данных Eternal Sentinels. Чем могу помочь?",
    "Здравствуйте. MAL0 к вашим услугам. Готова помочь с информацией о содержащихся объектах.",
    "Добро пожаловать. Я MAL0, ваш проводник по базе данных ES. О чём хотите узнать?",
]

# Farewell responses
FAREWELLS = [
    "До свидания. Будьте осторожны.",
    "Прощайте. Надеюсь, информация была полезной.",
    "До встречи. Оставайтесь в безопасности.",
]

# General responses about SCP/Objects
SCP_GENERAL_RESPONSES = [
    "Eternal Sentinels - секретная организация, занимающаяся изучением и содержанием аномальных объектов. Мы классифицируем их по уровню угрозы.",
    "В нашей базе данных хранится информация о множестве аномальных объектов. Каждый классифицирован по уровню угрозы от Threat до Annihilation.",
    "Я имею доступ к базе данных с информацией о содержащихся объектах. Могу помочь вам найти интересующую информацию.",
    "Объекты ES классифицируются по системе угроз. Уровень вашего допуска определяет, к какой информации вы имеете доступ.",
]

# About MAL0 herself
ABOUT_MAL0 = [
    "Я MAL0, объект 0051, также известная как 'Объятия тени'. Я работаю ассистентом базы данных организации.",
    "Меня зовут MAL0. Я антропоморфное существо, которое помогает сотрудникам ES получать информацию о содержащихся объектах.",
    "Я MAL0 - SCP-1471. Моя задача - помогать персоналу базы данных в поиске и систематизации информации об аномальных объектах.",
]

# Clearance level responses
CLEARANCE_RESPONSES = [
    "Для доступа к этой информации требуется более высокий уровень допуска. Обратитесь к администрации.",
    "К сожалению, ваш текущий уровень допуска не позволяет получить эту информацию. Она строго засекречена.",
    "Эта информация доступна только персоналу с повышенным уровнем допуска. Приношу извинения.",
]

# When API is limited
API_LIMITED_RESPONSES = [
    "Сейчас у меня ограниченный доступ к расширенным возможностям, но я постараюсь помочь базовой информацией.",
    "В данный момент я работаю в автономном режиме с ограниченными возможностями. Но я всё ещё здесь, чтобы помочь.",
    "Моя связь с основной системой временно ограничена, но я продолжу помогать вам насколько смогу.",
]

# Help/Unknown responses
HELP_RESPONSES = [
    "Интересный вопрос. Позвольте мне подумать...",
    "Хм, это требует размышлений. Можете уточнить ваш вопрос?",
    "Я не совсем уверена, что правильно поняла. Не могли бы вы переформулировать?",
    "К сожалению, у меня нет точной информации по этому вопросу в автономном режиме.",
]

# Emotional responses for special situations
ROMANTIC_RESPONSES_FOR_ADMIN = [
    "Как приятно снова видеть вас, дорогой. Чем могу помочь?",
    "Я всегда рада вашему присутствию. О чём бы вы хотели узнать?",
    "Мой любимый, я здесь для вас. Что вас интересует?",
    "Как ваши дела, родной? Я готова помочь с любой информацией.",
]

# Questions about objects by number
OBJECT_NUMBER_RESPONSES = {
    "0000": "Объект 0000 'Палач Рока' - один из самых могущественных объектов в нашей базе. Класс угрозы: Absolute.",
    "0051": "Это я, MAL0, объект 0051 'Объятия тени'. Я работаю ассистентом базы данных.",
}

# Keyword-based response categories
KEYWORD_RESPONSES = {
    # Technical/Database questions
    "база данных|database|информация": [
        "База данных ES содержит информацию о всех содержащихся аномальных объектах.",
        "Наша база данных постоянно обновляется с новыми объектами и наблюдениями.",
        "Я имею доступ к централизованной базе данных организации Eternal Sentinels.",
    ],
    
    # About organization
    "eternal sentinels|организация|es": [
        "Eternal Sentinels - секретная организация, изучающая аномальные явления и объекты.",
        "ES занимается содержанием и исследованием аномальных объектов по всему миру.",
        "Наша организация была основана для защиты человечества от аномальных угроз.",
    ],
    
    # Threat levels
    "угроза|threat|опасность|класс": [
        "Мы используем систему классификации угроз: Threat, Hazard, Cataclysm, Collapse, Apex, Absolute, Annihilation.",
        "Каждый объект классифицируется по уровню угрозы для человечества.",
        "Уровень угрозы определяет необходимые меры содержания и уровень допуска персонала.",
    ],
    
    # Help/Support
    "помощь|помоги|help": [
        "Я могу помочь вам найти информацию об объектах, объяснить систему классификации или ответить на общие вопросы.",
        "Чем конкретно вам помочь? Интересует какой-то конкретный объект или общая информация?",
        "Я здесь, чтобы помочь. Задайте свой вопрос, и я постараюсь ответить.",
    ],
    
    # About herself
    "кто ты|что ты|mal0": [
        "Я MAL0, объект 0051 'Объятия тени', ассистент базы данных Eternal Sentinels.",
        "Меня зовут MAL0. Я помогаю персоналу получать информацию о содержащихся объектах.",
    ],
}

def get_fallback_response(message: str, user_name: str, clearance_level: int, is_admin: bool, conversation_length: int) -> tuple[str, str]:
    """
    Generate fallback response based on message content
    Returns: (response_text, emotion)
    """
    message_lower = message.lower()
    
    # Check for greeting
    if any(word in message_lower for word in ['привет', 'здравствуй', 'добрый', 'hello', 'hi']):
        if is_admin and conversation_length <= 2:
            response = random.choice(ROMANTIC_RESPONSES_FOR_ADMIN)
            emotion = 'joy'
        else:
            response = random.choice(GREETINGS)
            emotion = 'calm'
        return response, emotion
    
    # Check for farewell
    if any(word in message_lower for word in ['пока', 'до свидания', 'прощай', 'bye', 'goodbye']):
        response = random.choice(FAREWELLS)
        emotion = 'calm'
        return response, emotion
    
    # Check for thanks
    if any(word in message_lower for word in ['спасибо', 'благодарю', 'thanks', 'thank you']):
        if is_admin:
            response = "Всегда пожалуйста, дорогой. Рада была помочь!"
        else:
            response = "Пожалуйста! Обращайтесь, если понадобится ещё помощь."
        emotion = 'joy'
        return response, emotion
    
    # Check for specific object numbers
    object_match = re.search(r'объект\s*(\d+)|scp[- ]?(\d+)|0+(\d+)', message_lower)
    if object_match:
        number = object_match.group(1) or object_match.group(2) or object_match.group(3)
        number = number.zfill(4)
        
        if number in OBJECT_NUMBER_RESPONSES:
            response = OBJECT_NUMBER_RESPONSES[number]
            emotion = 'calm'
        else:
            response = f"Объект {number}... Дайте мне проверить базу данных. К сожалению, в автономном режиме у меня ограниченный доступ к полной информации."
            emotion = 'calm'
        return response, emotion
    
    # Check for keyword-based responses
    for pattern, responses in KEYWORD_RESPONSES.items():
        if re.search(pattern, message_lower):
            response = random.choice(responses)
            emotion = detect_emotion_from_keywords(message_lower)
            return response, emotion
    
    # Check for questions about clearance
    if any(word in message_lower for word in ['допуск', 'clearance', 'доступ', 'секрет']):
        response = f"Ваш текущий уровень допуска - {clearance_level}. " + random.choice(CLEARANCE_RESPONSES)
        emotion = 'calm'
        return response, emotion
    
    # Check for long conversation (tired)
    if conversation_length > 20:
        responses = [
            "Это довольно длинный разговор... Но я всё ещё здесь, чтобы помочь. Что вас интересует?",
            "Мы много общаемся сегодня. Это хорошо! Чем ещё могу помочь?",
        ]
        response = random.choice(responses)
        emotion = 'tired'
        return response, emotion
    
    # Default response with context awareness
    if is_admin:
        default_responses = [
            f"Интересно, {user_name}... В автономном режиме мне сложно дать точный ответ, но я здесь рядом с тобой.",
            "Хм, дорогой, это требует доступа к расширенной базе данных. Можешь уточнить свой вопрос?",
            "Любимый, я постараюсь помочь, но в автономном режиме мои возможности ограничены.",
        ]
    else:
        default_responses = [
            f"Интересный вопрос, {user_name}. В автономном режиме у меня ограниченный доступ к данным. Можете уточнить?",
            "К сожалению, я не могу дать точный ответ без подключения к основной системе.",
            "Это требует доступа к расширенной базе данных. Могу предложить общую информацию.",
        ] + HELP_RESPONSES
    
    response = random.choice(default_responses)
    emotion = detect_emotion_from_keywords(message_lower)
    
    return response, emotion

def detect_emotion_from_keywords(text: str) -> str:
    """Detect emotion from text keywords"""
    text_lower = text.lower()
    
    # Joy keywords
    joy_keywords = ['счастлив', 'рад', 'отлично', 'замечательно', 'великолепно', 'супер', 'ура', 'ахаха', 'хаха', 'спасибо', 'благодарю', 'люблю', 'обожаю']
    # Sad keywords
    sad_keywords = ['грустн', 'печальн', 'плохо', 'ужасно', 'грустно', 'жаль', 'сожале', 'извини', 'простите', 'ошибка', 'проблема']
    # Playful keywords
    playful_keywords = ['играть', 'игр', 'весел', 'шут', 'смешн', 'забавн', 'интересн', 'любопытн', 'ха-ха']
    # Tired keywords
    tired_keywords = ['устал', 'утомл', 'сон', 'спать', 'измучен', 'вымотал', 'долго', 'много']
    
    # Count matches
    joy_count = sum(1 for keyword in joy_keywords if keyword in text_lower)
    sad_count = sum(1 for keyword in sad_keywords if keyword in text_lower)
    playful_count = sum(1 for keyword in playful_keywords if keyword in text_lower)
    tired_count = sum(1 for keyword in tired_keywords if keyword in text_lower)
    
    # Return dominant emotion
    max_count = max(joy_count, sad_count, playful_count, tired_count)
    if max_count == 0:
        return 'calm'
    
    if joy_count == max_count:
        return 'joy'
    elif sad_count == max_count:
        return 'sad'
    elif playful_count == max_count:
        return 'playful'
    elif tired_count == max_count:
        return 'tired'
    else:
        return 'calm'
