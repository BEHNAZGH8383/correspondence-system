from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from .config import ALLOWED_EXTENSIONS, APP_NAME, MAX_ATTACHMENT_SIZE, UPLOAD_DIR
from .database import get_db, init_database, wait_for_database
from .dependencies import get_logged_user
from .models import Attachment, Letter, User
from .schemas import LetterResponse, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from .security import make_access_token, make_password_hash, check_password


@asynccontextmanager
async def lifespan(_: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    wait_for_database()
    init_database()
    yield


app = FastAPI(
    title=APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def format_letter_response(letter: Letter) -> LetterResponse:
    return LetterResponse(
        id=letter.id,
        subject=letter.subject,
        body=letter.body,
        sender=UserResponse.model_validate(letter.sender),
        receiver=UserResponse.model_validate(letter.receiver),
        is_read=letter.is_read,
        created_at=letter.created_at,
        has_attachment=letter.attachment is not None,
        attachment_name=letter.attachment.original_name if letter.attachment else None,
    )


def validate_letter_text(subject: str, body: str) -> tuple[str, str]:
    subject = subject.strip()
    body = body.strip()

    if len(subject) < 3 or len(subject) > 200:
        raise HTTPException(status_code=400, detail="موضوع باید بین ۳ تا ۲۰۰ نویسه باشد.")
    if len(body) < 1 or len(body) > 5000:
        raise HTTPException(status_code=400, detail="متن نامه باید بین ۱ تا ۵۰۰۰ نویسه باشد.")

    return subject, body


async def save_attachment(file: UploadFile) -> Attachment:
    original_name = Path((file.filename or "attachment").replace("\\", "/")).name
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="نوع فایل پیوست مجاز نیست.")

    content = await file.read(MAX_ATTACHMENT_SIZE + 1)
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=400, detail="حجم فایل نباید بیشتر از ۵ مگابایت باشد.")

    saved_name = f"{uuid4().hex}{extension}"
    (UPLOAD_DIR / saved_name).write_bytes(content)

    return Attachment(
        original_name=original_name,
        saved_name=saved_name,
        content_type=file.content_type,
        size_bytes=len(content),
    )


def build_letter_query():
    return select(Letter).options(
        joinedload(Letter.sender),
        joinedload(Letter.receiver),
        joinedload(Letter.attachment),
    )


@app.get("/api/health")
def check_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="دیتابیس در دسترس نیست.")
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    full_name = data.full_name.strip()

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="نام کاربری باید حداقل ۳ نویسه باشد.")
    if not username.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="نام کاربری فقط می‌تواند شامل حروف، عدد و _ باشد.")
    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="نام و نام خانوادگی معتبر وارد کنید.")

    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")

    user = User(
        username=username,
        full_name=full_name,
        password_hash=make_password_hash(data.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")

    return TokenResponse(
        access_token=make_access_token(user.id, user.username),
        user=UserResponse.model_validate(user),
    )


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))

    if user is None or not check_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور نادرست است.",
        )

    return TokenResponse(
        access_token=make_access_token(user.id, user.username),
        user=UserResponse.model_validate(user),
    )


@app.get("/api/auth/me", response_model=UserResponse)
def my_profile(logged_user: User = Depends(get_logged_user)):
    return logged_user


@app.get("/api/users", response_model=list[UserResponse])
def list_users(
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    query = select(User).where(User.id != logged_user.id).order_by(User.full_name)
    return list(db.scalars(query))


@app.post("/api/letters", response_model=LetterResponse, status_code=status.HTTP_201_CREATED)
async def create_letter(
    receiver_id: int = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    attachment: UploadFile | None = File(None),
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    subject, body = validate_letter_text(subject, body)
    receiver = db.get(User, receiver_id)

    if receiver is None:
        raise HTTPException(status_code=404, detail="گیرنده پیدا نشد.")
    if receiver.id == logged_user.id:
        raise HTTPException(status_code=400, detail="ارسال نامه برای خودتان مجاز نیست.")

    saved_attachment = None
    if attachment and attachment.filename:
        saved_attachment = await save_attachment(attachment)

    letter = Letter(
        subject=subject,
        body=body,
        sender_id=logged_user.id,
        receiver_id=receiver.id,
        attachment=saved_attachment,
    )
    db.add(letter)

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        if saved_attachment:
            (UPLOAD_DIR / saved_attachment.saved_name).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="نامه ذخیره نشد.")

    saved_letter = db.scalar(build_letter_query().where(Letter.id == letter.id))
    return format_letter_response(saved_letter)


@app.get("/api/letters/inbox", response_model=list[LetterResponse])
def inbox_letters(
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    query = (
        build_letter_query()
        .where(Letter.receiver_id == logged_user.id)
        .order_by(Letter.created_at.desc())
    )
    return [format_letter_response(letter) for letter in db.scalars(query).unique()]


@app.get("/api/letters/sent", response_model=list[LetterResponse])
def sent_letters(
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    query = (
        build_letter_query()
        .where(Letter.sender_id == logged_user.id)
        .order_by(Letter.created_at.desc())
    )
    return [format_letter_response(letter) for letter in db.scalars(query).unique()]


@app.get("/api/letters/{letter_id}", response_model=LetterResponse)
def read_letter(
    letter_id: int,
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    query = build_letter_query().where(
        Letter.id == letter_id,
        or_(Letter.sender_id == logged_user.id, Letter.receiver_id == logged_user.id),
    )
    letter = db.scalar(query)

    if letter is None:
        raise HTTPException(status_code=404, detail="نامه پیدا نشد.")

    if letter.receiver_id == logged_user.id and not letter.is_read:
        letter.is_read = True
        db.commit()

    return format_letter_response(letter)


@app.get("/api/letters/{letter_id}/attachment")
def get_attachment(
    letter_id: int,
    logged_user: User = Depends(get_logged_user),
    db: Session = Depends(get_db),
):
    query = build_letter_query().where(
        Letter.id == letter_id,
        or_(Letter.sender_id == logged_user.id, Letter.receiver_id == logged_user.id),
    )
    letter = db.scalar(query)

    if letter is None or letter.attachment is None:
        raise HTTPException(status_code=404, detail="پیوست پیدا نشد.")

    file_path = UPLOAD_DIR / letter.attachment.saved_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیوست وجود ندارد.")

    return FileResponse(
        path=file_path,
        filename=letter.attachment.original_name,
        media_type=letter.attachment.content_type or "application/octet-stream",
    )
