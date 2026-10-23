// Variables para pruebas. DATABASE_URL y SCORING_URL pueden venir del entorno (CI).
process.env.APP_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://tendia:tendia@127.0.0.1:55432/tendia_test';
process.env.SCORING_URL ??= 'http://127.0.0.1:8000';
process.env.JWT_SECRET = 'jwt-secreto-de-pruebas-con-mas-de-32-caracteres';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.OTP_DEV_MODE = 'true';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TWILIO_ACCOUNT_SID;
