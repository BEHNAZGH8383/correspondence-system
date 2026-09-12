# چک‌لیست نهایی تحویل

## امکانات اصلی
- [x] صفحه ورود
- [x] احراز هویت با JWT
- [x] کاربر و نام کاربری
- [x] کارتابل نامه‌های دریافتی
- [x] کارتابل نامه‌های ارسالی
- [x] ارسال نامه به کاربر دیگر
- [x] موضوع نامه
- [x] متن نامه
- [x] پیوست اختیاری
- [x] دانلود پیوست
- [x] وضعیت خوانده‌شدن نامه
- [x] کنترل دسترسی فرستنده/گیرنده

## Docker
- [x] Container مستقل برای database
- [x] Container مستقل برای backend
- [x] Container مستقل برای frontend
- [x] Dockerfile مجزا برای هر سه بخش
- [x] PostgreSQL Volume
- [x] Attachment Volume
- [x] شبکه داخلی Docker
- [x] Healthcheck دیتابیس و backend و frontend

## مستندات و تست
- [x] README
- [x] Swagger/OpenAPI
- [x] Class Diagram
- [x] Architecture Diagram
- [x] برنامه چهار هفته‌ای
- [x] محتوای آماده برد مدیریت کار
- [x] تست ورود
- [x] تست ارسال و دریافت نامه همراه پیوست

## مواردی که باید قبل از ارائه روی سیستم خودتان انجام شود
1. فایل `.env` را از `.env.example` بسازید.
2. `SECRET_KEY` را در `.env` تغییر دهید.
3. `docker compose up --build -d` را اجرا کنید.
4. با `docker compose ps` سالم بودن سه Container را بررسی کنید.
5. سناریوی تست دستی موجود در `docs/03-مراحل-تحویل.md` را اجرا کنید.
6. در صورت الزام استاد، برد تسکولو را مطابق `docs/05-برد-تسکولو.md` بسازید و Screenshot بگیرید.
