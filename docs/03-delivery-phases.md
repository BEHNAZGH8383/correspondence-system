# مراحل تحویل پروژه

## وضعیت پیاده‌سازی

بخش‌های اصلی پروژه پیاده‌سازی شده‌اند:

- [x] سه Container مستقل برای `frontend`، `backend` و `database`
- [x] Dockerfile جداگانه برای هر سه بخش
- [x] PostgreSQL با Volume پایدار
- [x] FastAPI + SQLAlchemy
- [x] ورود کاربران و JWT
- [x] هش رمز عبور
- [x] کارتابل دریافتی و ارسالی
- [x] ارسال نامه با موضوع، متن و پیوست اختیاری
- [x] کنترل دسترسی نامه و پیوست
- [x] ذخیره پیوست در Volume
- [x] تست API برای ورود و ارسال/دریافت نامه
- [x] مستندات Swagger/OpenAPI

## اجرای نهایی

در ریشه پروژه:

```bash
Copy-Item .env.example .env
docker compose up --build -d
```

صفحه برنامه:

```text
http://localhost:8080
```

مستندات API:

```text
http://localhost:8080/api/docs
```

بررسی وضعیت Containerها:

```bash
docker compose ps
```

مشاهده لاگ بک‌اند:

```bash
docker compose logs -f backend
```

خاموش‌کردن:

```bash
docker compose down
```

حذف Containerها و Volumeهای داده:

```bash
docker compose down -v
```

## تست دستی نهایی

این موارد را در مرورگر بررسی کنید:

1. ورود با رمز درست.
2. ورود با رمز اشتباه.
3. مشاهده کارتابل دریافتی.
4. مشاهده کارتابل ارسالی.
5. ارسال نامه بدون پیوست.
6. ارسال نامه همراه پیوست.
7. ورود با حساب گیرنده و مشاهده نامه.
8. بازشدن نامه و تغییر وضعیت آن به خوانده‌شده.
9. دانلود پیوست توسط گیرنده.
10. مشاهده نامه در بخش ارسالی فرستنده.
11. خاموش و روشن کردن Containerها و بررسی باقی‌ماندن داده‌ها.
12. بررسی صفحه `/api/docs`.

## تست خودکار

برای اجرای تست‌ها بدون Docker:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -q
```

در Linux/macOS:

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
```

## Git

فایل `.env` عمداً در Git قرار نمی‌گیرد. فقط `.env.example` را Commit کنید.

```bash
git init
git add .
git commit -m "feat: complete letter management system"
```

## فایل‌های مناسب برای ارائه

- تصویر صفحه ورود
- تصویر کارتابل دریافتی
- تصویر کارتابل ارسالی
- تصویر فرم ارسال نامه
- تصویر Swagger
- تصویر Class Diagram
- تصویر Board
- README تکمیل‌شده با نام و شماره دانشجویی
