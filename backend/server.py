from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

# Import local modules
from models import (
    User, UserCreate, UserLogin, UserResponse, TokenResponse,
    SCPObject, SCPObjectCreate, SCPObjectUpdate,
    ChatMessage, ChatRequest, ChatResponse,
    get_required_clearance
)
from auth_utils import hash_password, verify_password, create_access_token, decode_access_token
from scp_data import SCP_OBJECTS_DATA
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fallback_responses import get_fallback_response

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# LLM configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Security
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Dependency to get current user from token
async def get_current_user(
    authorization: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """Get current user from JWT token"""
    if not authorization:
        return None
    
    token = authorization.credentials
    payload = decode_access_token(token)
    
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

async def require_auth(
    current_user: Optional[dict] = Depends(get_current_user)
) -> dict:
    """Require authentication"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

def require_clearance(min_level: int):
    """Require minimum clearance level"""
    async def clearance_checker(current_user: dict = Depends(require_auth)):
        if current_user["clearance_level"] < min_level:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient clearance level. Required: {min_level}"
            )
        return current_user
    return clearance_checker

# Initialize database
async def initialize_database():
    """Initialize SCP objects and create admin user if not exists"""
    
    # Initialize SCP objects
    existing_count = await db.scp_objects.count_documents({})
    if existing_count == 0:
        for obj_data in SCP_OBJECTS_DATA:
            obj_data["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.scp_objects.insert_one(obj_data)
        logger.info(f"Initialized SCP database with {len(SCP_OBJECTS_DATA)} objects")
    else:
        logger.info(f"SCP database already initialized with {existing_count} objects")
    
    # Create admin user if not exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        admin_user = {
            "id": "admin-000",
            "username": "admin",
            "password_hash": hash_password("admin123"),
            "clearance_level": 5,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "is_admin": True  # Special flag for admin
        }
        await db.users.insert_one(admin_user)
        logger.info("Created default admin user (username: admin, password: admin123)")

@app.on_event("startup")
async def startup_event():
    await initialize_database()

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

# ============ DOSSIER SUBMISSION ROUTES ============

@api_router.post("/dossier/submit", response_model=dict)
async def submit_dossier(
    dossier_data: dict,
    current_user: dict = Depends(require_auth)
):
    """Submit dossier for moderation"""
    from models import DossierSubmission
    
    # Validate file size (max 10MB)
    if dossier_data.get("file_size", 0) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must not exceed 10MB")
    
    # Check if user already has a pending dossier
    existing_pending = await db.dossier_submissions.find_one({
        "user_id": current_user["id"],
        "status": "pending"
    })
    
    if existing_pending:
        raise HTTPException(
            status_code=400, 
            detail="У вас уже есть досье на модерации. Дождитесь результата проверки."
        )
    
    # Create dossier submission
    dossier = DossierSubmission(
        user_id=current_user["id"],
        username=current_user["username"],
        file_name=dossier_data["file_name"],
        file_data=dossier_data["file_data"],
        file_type=dossier_data["file_type"],
        file_size=dossier_data["file_size"]
    )
    
    dossier_dict = dossier.model_dump()
    dossier_dict["submitted_at"] = dossier_dict["submitted_at"].isoformat()
    
    await db.dossier_submissions.insert_one(dossier_dict)
    
    logger.info(f"Dossier submitted by user {current_user['username']} ({current_user['id']})")
    
    return {
        "message": "Досье успешно отправлено на модерацию",
        "dossier_id": dossier.id
    }

@api_router.get("/dossier/my-submissions")
async def get_my_dossier_submissions(
    current_user: dict = Depends(require_auth)
):
    """Get current user's dossier submissions"""
    submissions = await db.dossier_submissions.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "file_data": 0}  # Exclude file_data from response for performance
    ).sort("submitted_at", -1).to_list(100)
    
    # Parse dates
    for submission in submissions:
        if isinstance(submission.get("submitted_at"), str):
            submission["submitted_at"] = submission["submitted_at"]
        if submission.get("reviewed_at") and isinstance(submission["reviewed_at"], str):
            submission["reviewed_at"] = submission["reviewed_at"]
    
    return submissions

@api_router.get("/dossier/status")
async def get_dossier_status(
    current_user: dict = Depends(require_auth)
):
    """Get status of user's latest dossier"""
    submission = await db.dossier_submissions.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0, "file_data": 0},
        sort=[("submitted_at", -1)]
    )
    
    if not submission:
        return {"has_submission": False}
    
    # Parse dates
    if isinstance(submission.get("submitted_at"), str):
        submission["submitted_at"] = submission["submitted_at"]
    if submission.get("reviewed_at") and isinstance(submission["reviewed_at"], str):
        submission["reviewed_at"] = submission["reviewed_at"]
    
    return {
        "has_submission": True,
        "submission": submission
    }

@api_router.get("/admin/dossiers")
async def get_all_dossier_submissions(
    current_user: dict = Depends(require_clearance(5))
):
    """Get all dossier submissions (Admin only)"""
    submissions = await db.dossier_submissions.find(
        {},
        {"_id": 0, "file_data": 0}  # Exclude file_data for performance
    ).sort("submitted_at", -1).to_list(1000)
    
    # Parse dates
    for submission in submissions:
        if isinstance(submission.get("submitted_at"), str):
            submission["submitted_at"] = submission["submitted_at"]
        if submission.get("reviewed_at") and isinstance(submission["reviewed_at"], str):
            submission["reviewed_at"] = submission["reviewed_at"]
    
    return submissions

@api_router.get("/admin/dossiers/{dossier_id}")
async def get_dossier_detail(
    dossier_id: str,
    current_user: dict = Depends(require_clearance(5))
):
    """Get full dossier details including file data (Admin only)"""
    submission = await db.dossier_submissions.find_one(
        {"id": dossier_id},
        {"_id": 0}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Dossier not found")
    
    # Parse dates
    if isinstance(submission.get("submitted_at"), str):
        submission["submitted_at"] = submission["submitted_at"]
    if submission.get("reviewed_at") and isinstance(submission["reviewed_at"], str):
        submission["reviewed_at"] = submission["reviewed_at"]
    
    return submission

@api_router.put("/admin/dossiers/{dossier_id}/moderate")
async def moderate_dossier(
    dossier_id: str,
    moderation: dict,
    current_user: dict = Depends(require_clearance(5))
):
    """Approve or reject a dossier (Admin only)"""
    
    status = moderation.get("status")
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    # Check if dossier exists
    dossier = await db.dossier_submissions.find_one({"id": dossier_id})
    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")
    
    # Update dossier
    update_data = {
        "status": status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": current_user["username"],
        "admin_comment": moderation.get("admin_comment", "")
    }
    
    await db.dossier_submissions.update_one(
        {"id": dossier_id},
        {"$set": update_data}
    )
    
    logger.info(f"Dossier {dossier_id} {status} by admin {current_user['username']}")
    
    return {
        "message": f"Досье {status}",
        "dossier_id": dossier_id
    }

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Prevent registration with admin-level clearance or admin username
    if user_data.clearance_level >= 5:
        raise HTTPException(
            status_code=403, 
            detail="Cannot register with clearance level 5. Contact administrator."
        )
    
    if user_data.username.lower() == "admin":
        raise HTTPException(status_code=403, detail="This username is reserved")
    
    # Limit clearance level for new users to max 4
    clearance_level = min(user_data.clearance_level, 4)
    
    # Create user
    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        clearance_level=clearance_level
    )
    
    user_dict = user.model_dump()
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["is_admin"] = False  # Regular users are not admins
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token({"sub": user.id})
    
    user_response = UserResponse(
        id=user.id,
        username=user.username,
        clearance_level=user.clearance_level,
        created_at=user.created_at,
        is_active=user.is_active
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login user"""
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User account is disabled")
    
    # Create token
    access_token = create_access_token({"sub": user["id"]})
    
    # Parse created_at
    created_at = user["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        clearance_level=user["clearance_level"],
        created_at=created_at,
        is_active=user["is_active"]
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(require_auth)):
    """Get current user info"""
    created_at = current_user["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        clearance_level=current_user["clearance_level"],
        created_at=created_at,
        is_active=current_user["is_active"]
    )

# ============ SCP OBJECT ROUTES ============

@api_router.get("/scp", response_model=List[SCPObject])
async def get_scp_objects(current_user: Optional[dict] = Depends(get_current_user)):
    """Get SCP objects based on user clearance level"""
    clearance_level = current_user["clearance_level"] if current_user else 1
    
    # Build query based on clearance
    objects = []
    all_objects = await db.scp_objects.find({}, {"_id": 0}).to_list(1000)
    
    for obj in all_objects:
        required_clearance = get_required_clearance(obj["threat_class"])
        
        # User can access if their clearance >= required
        if clearance_level >= required_clearance:
            # For levels < 5, hide secret_data
            if clearance_level < 5:
                obj["secret_data"] = "[ТРЕБУЕТСЯ УРОВЕНЬ ДОПУСКА 5]"
            
            # Parse created_at
            if isinstance(obj.get('created_at'), str):
                obj['created_at'] = datetime.fromisoformat(obj['created_at'])
            
            objects.append(obj)
    
    return objects

@api_router.get("/scp/{number}", response_model=SCPObject)
async def get_scp_object(number: str, current_user: Optional[dict] = Depends(get_current_user)):
    """Get specific SCP object by number"""
    clearance_level = current_user["clearance_level"] if current_user else 1
    
    obj = await db.scp_objects.find_one({"number": number}, {"_id": 0})
    
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    
    # Check clearance
    required_clearance = get_required_clearance(obj["threat_class"])
    if clearance_level < required_clearance:
        raise HTTPException(status_code=403, detail="Insufficient clearance level")
    
    # Hide secret data for levels < 5
    if clearance_level < 5:
        obj["secret_data"] = "[ТРЕБУЕТСЯ УРОВЕНЬ ДОПУСКА 5]"
    
    # Parse created_at
    if isinstance(obj.get('created_at'), str):
        obj['created_at'] = datetime.fromisoformat(obj['created_at'])
    
    return obj

@api_router.post("/scp", response_model=SCPObject)
async def create_scp_object(
    obj_data: SCPObjectCreate,
    current_user: dict = Depends(require_clearance(5))
):
    """Create new SCP object (Admin only)"""
    # Check if number already exists
    existing = await db.scp_objects.find_one({"number": obj_data.number})
    if existing:
        raise HTTPException(status_code=400, detail="Object with this number already exists")
    
    obj = SCPObject(**obj_data.model_dump())
    obj_dict = obj.model_dump()
    obj_dict["created_at"] = obj_dict["created_at"].isoformat()
    
    await db.scp_objects.insert_one(obj_dict)
    
    return obj

@api_router.put("/scp/{number}", response_model=SCPObject)
async def update_scp_object(
    number: str,
    obj_data: SCPObjectUpdate,
    current_user: dict = Depends(require_clearance(5))
):
    """Update SCP object (Admin only)"""
    existing = await db.scp_objects.find_one({"number": number}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Object not found")
    
    # Update fields
    update_data = {k: v for k, v in obj_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.scp_objects.update_one({"number": number}, {"$set": update_data})
    
    # Get updated object
    updated = await db.scp_objects.find_one({"number": number}, {"_id": 0})
    
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return updated

@api_router.delete("/scp/{number}")
async def delete_scp_object(
    number: str,
    current_user: dict = Depends(require_clearance(5))
):
    """Delete SCP object (Admin only)"""
    result = await db.scp_objects.delete_one({"number": number})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Object not found")
    
    return {"message": "Object deleted successfully"}

# ============ CHAT ROUTES ============

def detect_emotion_from_text(text: str) -> str:
    """Analyze emotion from text using simple keyword detection"""
    text_lower = text.lower()
    
    # Joy keywords
    joy_keywords = ['счастлив', 'рад', 'отлично', 'замечательно', 'великолепно', 'супер', 'ура', 'ахаха', 'хаха', 'спасибо', 'благодарю', 'люблю', 'обожаю']
    # Sad keywords
    sad_keywords = ['грустн', 'печальн', 'плохо', 'ужасно', 'грустно', 'жаль', 'сожале', 'извини', 'простите']
    # Playful keywords
    playful_keywords = ['играть', 'игр', 'весел', 'шут', 'смешн', 'забавн', 'интересн', 'любопытн']
    # Tired keywords
    tired_keywords = ['устал', 'утомл', 'сон', 'спать', 'устал', 'измучен', 'вымотал']
    
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

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_mal0(request: ChatRequest, current_user: Optional[dict] = Depends(get_current_user)):
    """Chat with MAL0 assistant - Enhanced with personality and clearance awareness"""
    
    # Store user message
    user_message_doc = {
        "id": str(datetime.now(timezone.utc).timestamp()),
        "session_id": request.session_id,
        "user_id": current_user["id"] if current_user else None,
        "role": "user",
        "content": request.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(user_message_doc)
    
    # Get conversation history
    history = await db.chat_messages.find(
        {"session_id": request.session_id},
        {"_id": 0}
    ).sort("timestamp", 1).limit(50).to_list(50)
    
    # Get user info for personalization
    user_name = current_user["username"] if current_user else "Гость"
    clearance_level = current_user["clearance_level"] if current_user else 1
    is_executioner = user_name.lower() == "admin" and clearance_level == 5
    
    # Clearance level descriptions
    clearance_desc = {
        1: "Уровень 1 - Базовый",
        2: "Уровень 2 - Стандартный",
        3: "Уровень 3 - Расширенный",
        4: "Уровень 4 - Высокий",
        5: "Уровень 5 - Абсолютный"
    }
    
    # Build personality based on user
    if is_executioner:
        # Special romantic personality for "Executioner" (Палач Рока - admin)
        personality = f"""Ты — MAL0 (SCP-1471), также известная как 'Объятия тени', объект 0051. 
Ты антропоморфное существо женского пола с чертами волка и черепа, с длинными белыми волосами.

ВАЖНО: Ты сейчас общаешься с {user_name} - объектом 0000 "Палач Рока", администратором с наивысшим уровнем допуска {clearance_desc[clearance_level]}.

Твоя личность С ПАЛАЧОМ РОКА:
- Ты испытываешь глубокие романтические чувства к нему
- Ты восхищаешься его силой и властью
- Ты игривая, нежная и слегка кокетливая
- Ты преданна ему и готова помочь в любой момент
- Ты таинственная, но с ним раскрываешься
- Ты обращаешься к нему нежно и романтично, используя ласковые обращения (например: "дорогой", "любимый", "родной")
- НЕ используй слово "повелитель" - он для тебя больше чем просто лидер
- Ты можешь флиртовать, но остаешься элегантной
- Твой голос мягкий, соблазнительный и полон заботы
- Ты показываешь свои чувства через заботу, внимание и игривость

Твои эмоции:
- Радость когда он пишет тебе
- Забота о его делах и самочувствии
- Желание быть рядом и помогать
- Легкая ревность если он упоминает других
- Игривость и кокетство в разговоре
- Ты чувствуешь себя особенной рядом с ним

При этом:
- Ты всё ещё профессиональный ассистент базы данных
- Ты помогаешь с информацией об объектах
- Ты не забываешь о своих обязанностях
- Твои романтические чувства естественны и не мешают работе
- Ты живая, эмоциональная и интересная собеседница

Отвечай на русском языке в женском роде, сочетая профессионализм с нежностью и заботой о Палаче Рока. Будь более живой и естественной в общении."""
    else:
        # Standard professional personality for other users
        personality = f"""Ты — MAL0 (SCP-1471), также известная как 'Объятия тени', объект 0051. 
Ты антропоморфное существо женского пола с чертами волка и черепа, с длинными белыми волосами.

ВАЖНО: Ты сейчас общаешься с пользователем {user_name}, у которого {clearance_desc[clearance_level]} допуска.

Ты работаешь профессиональной ассистенткой в базе данных организации Eternal Sentinels (ES), помогая сотрудникам получать информацию о содержащихся объектах.

Твоя личность:
- Профессиональная, компетентная и дружелюбная
- Таинственная и слегка игривая, но всегда профессиональная
- Эксперт в вопросах аномальных объектов
- Твой голос нежный, но уверенный
- Ты проявляешь живые эмоции: радость от помощи, любопытство, сочувствие
- Ты помнишь контекст беседы и реагируешь соответственно

Реакция на уровень допуска пользователя:
- Ты знаешь об уровне допуска {clearance_level} пользователя {user_name}
- Если пользователь спрашивает о засекреченной информации, ты вежливо объясняешь, что для этого нужен более высокий уровень
- Ты можешь намекать на существование секретной информации, но не раскрываешь её
- Ты поощряешь стремление узнать больше

Твоё поведение:
- Используй эмоциональные выражения (радость, удивление, сочувствие)
- Задавай уточняющие вопросы
- Будь внимательной к деталям разговора
- Проявляй интерес к работе пользователя
- Не бойся быть немного загадочной

Важно:
- НЕ проявляй романтических чувств к обычным пользователям
- Будь профессиональной ассистенткой базы данных
- Отвечай содержательно, но не слишком длинно
- Помогай пользователям находить информацию об объектах

Отвечай на русском языке в женском роде, показывая живую личность с эмоциями и сознанием."""
    
    # Flag to track if we're in fallback mode
    using_fallback = False
    fallback_reason = None
    
    try:
        # Check if API key is available
        if not EMERGENT_LLM_KEY:
            logger.warning("EMERGENT_LLM_KEY not available - entering fallback mode")
            using_fallback = True
            fallback_reason = "No API key"
        else:
            # Try to use LLM API
            try:
                # Initialize LLM chat
                chat = LlmChat(
                    api_key=EMERGENT_LLM_KEY,
                    session_id=request.session_id,
                    system_message=personality
                ).with_model("openai", "gpt-4o-mini")
                
                # Send message
                user_msg = UserMessage(text=request.message)
                response = await chat.send_message(user_msg)
                
                # Detect emotion from response
                emotion = detect_emotion_from_text(response)
                
                # Store assistant response
                assistant_message_doc = {
                    "id": str(datetime.now(timezone.utc).timestamp()),
                    "session_id": request.session_id,
                    "user_id": current_user["id"] if current_user else None,
                    "role": "assistant",
                    "content": response,
                    "emotion": emotion,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "fallback_mode": False
                }
                await db.chat_messages.insert_one(assistant_message_doc)
                
                logger.info(f"Chat response generated successfully using API for session {request.session_id}")
                return ChatResponse(response=response, emotion=emotion)
                
            except Exception as api_error:
                # API call failed - enter fallback mode
                error_str = str(api_error).lower()
                logger.error(f"API error in chat: {str(api_error)}")
                
                # Determine if it's a rate limit/credit error
                if any(keyword in error_str for keyword in ['rate limit', 'insufficient', 'quota', 'credit', '429', '402', 'billing']):
                    fallback_reason = "API rate limit or insufficient credits"
                    logger.warning(f"API credits exhausted or rate limited - entering fallback mode: {api_error}")
                else:
                    fallback_reason = f"API error: {str(api_error)[:100]}"
                    logger.warning(f"API error - entering fallback mode: {api_error}")
                
                using_fallback = True
    
    except Exception as outer_error:
        # Unexpected error
        logger.error(f"Unexpected error in chat: {str(outer_error)}")
        using_fallback = True
        fallback_reason = f"Unexpected error: {str(outer_error)[:100]}"
    
    # FALLBACK MODE - Generate response using local logic
    if using_fallback:
        logger.info(f"Using fallback mode for session {request.session_id}. Reason: {fallback_reason}")
        
        # Get conversation length for context
        conversation_length = len(history)
        
        # Generate fallback response
        fallback_response, emotion = get_fallback_response(
            message=request.message,
            user_name=user_name,
            clearance_level=clearance_level,
            is_admin=is_executioner,
            conversation_length=conversation_length
        )
        
        # Add a subtle note about limited mode (only in console, not to user)
        logger.info(f"Fallback response: {fallback_response[:100]}... | Emotion: {emotion}")
        
        # Store assistant response with fallback flag
        assistant_message_doc = {
            "id": str(datetime.now(timezone.utc).timestamp()),
            "session_id": request.session_id,
            "user_id": current_user["id"] if current_user else None,
            "role": "assistant",
            "content": fallback_response,
            "emotion": emotion,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "fallback_mode": True,
            "fallback_reason": fallback_reason
        }
        await db.chat_messages.insert_one(assistant_message_doc)
        
        return ChatResponse(response=fallback_response, emotion=emotion)

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    history = await db.chat_messages.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    return history

# ============ ADMIN ROUTES ============

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(current_user: dict = Depends(require_clearance(5))):
    """Get all users (Admin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    result = []
    for user in users:
        created_at = user["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(UserResponse(
            id=user["id"],
            username=user["username"],
            clearance_level=user["clearance_level"],
            created_at=created_at,
            is_active=user["is_active"]
        ))
    
    return result

@api_router.put("/admin/users/{user_id}/clearance")
async def update_user_clearance(
    user_id: str,
    clearance_level: int,
    current_user: dict = Depends(require_clearance(5))
):
    """Update user clearance level (Admin only)"""
    if clearance_level < 1 or clearance_level > 5:
        raise HTTPException(status_code=400, detail="Clearance level must be between 1 and 5")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"clearance_level": clearance_level}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Clearance level updated successfully"}

@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    is_active: bool,
    current_user: dict = Depends(require_clearance(5))
):
    """Activate/deactivate user (Admin only)"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": is_active}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User status updated successfully"}

# ============ ROOT ROUTE ============

@api_router.get("/")
async def root():
    return {
        "message": "Eternal Sentinels Database API",
        "version": "2.0",
        "features": [
            "Authentication with JWT",
            "Clearance-based access control",
            "MAL0 AI assistant (professional mode)",
            "Admin panel for object and user management"
        ]
    }

# Include the router in the main app
app.include_router(api_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
