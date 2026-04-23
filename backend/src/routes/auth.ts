import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq, or } from "drizzle-orm";
import { signToken } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "telecom-secret-change-in-production";

function wrap(fn: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any, next: any) => {
    try { await fn(req, res); }
    catch (err: any) {
      console.error(`[auth] ${req.method} ${req.path}:`, err?.message);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Server error" });
    }
  };
}

// POST /auth/login  — universal login for all roles
router.post("/auth/login", wrap(async (req, res) => {
  const parsed = z.object({
    login: z.string().min(1),   // name or email
    password: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Введите имя/email и пароль" }); return; }

  const { login, password } = parsed.data;

  // Find by email or by exact name match
  const users = await db.select().from(usersTable).where(
    or(eq(usersTable.email, login), eq(usersTable.name, login))
  );

  if (users.length === 0) { res.status(401).json({ error: "Пользователь не найден" }); return; }

  // If multiple matches prefer email match
  const user = users.find(u => u.email === login) ?? users[0];

  if (!user.passwordHash) {
    res.status(401).json({ error: "Пароль не установлен. Обратитесь к администратору." });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Неверный пароль" }); return; }

  const token = signToken({ id: user.id, role: user.role as any, name: user.name });
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
}));

// GET /auth/users?role= — list users for display on login page (names only, no sensitive data)
router.get("/auth/users", wrap(async (req, res) => {
  const role = req.query.role as string | undefined;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    role: usersTable.role,
    hasPassword: usersTable.passwordHash,
  }).from(usersTable).orderBy(usersTable.name);

  const filtered = role
    ? users.filter(u => u.role === role)
    : users.filter(u => u.role !== "admin");

  res.json(filtered.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    hasPassword: !!u.hasPassword,
  })));
}));

// POST /auth/forgot-password  { login: email_or_name }
router.post("/auth/forgot-password", wrap(async (req, res) => {
  const parsed = z.object({ login: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Введите email или имя" }); return; }

  const users = await db.select().from(usersTable).where(
    or(eq(usersTable.email, parsed.data.login), eq(usersTable.name, parsed.data.login))
  );

  // Always return success to avoid user enumeration
  if (users.length === 0 || !users[0].email) {
    res.json({ message: "Если аккаунт существует, письмо отправлено." });
    return;
  }

  const user = users[0];
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600_000); // 1 hour

  await db.update(usersTable)
    .set({ resetToken: token, resetTokenExpires: expires })
    .where(eq(usersTable.id, user.id));

  // Send email via SendGrid
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@beesells.com";
  const APP_URL = process.env.APP_URL || "https://arifugli.github.io/beesells";

  if (SENDGRID_API_KEY) {
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const emailBody = {
      personalizations: [{ to: [{ email: user.email }] }],
      from: { email: FROM_EMAIL },
      subject: "TelecomSales — сброс пароля",
      content: [{
        type: "text/html",
        value: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2>Сброс пароля</h2>
            <p>Привет, ${user.name}!</p>
            <p>Для сброса пароля нажмите на кнопку ниже. Ссылка действительна 1 час.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px">Сбросить пароль</a>
            <p style="color:#666;font-size:12px;margin-top:24px">Если вы не запрашивали сброс пароля — проигнорируйте это письмо.</p>
          </div>
        `
      }]
    };

    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });
  }

  res.json({ message: "Если аккаунт существует, письмо отправлено." });
}));

// POST /auth/reset-password  { token, password }
router.post("/auth/reset-password", wrap(async (req, res) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(6, "Минимум 6 символов"),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const users = await db.select().from(usersTable).where(eq(usersTable.resetToken, parsed.data.token));
  if (users.length === 0) { res.status(400).json({ error: "Недействительная ссылка" }); return; }

  const user = users[0];
  if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    res.status(400).json({ error: "Ссылка устарела. Запросите новую." });
    return;
  }

  const hash = await bcrypt.hash(parsed.data.password, 10);
  await db.update(usersTable).set({
    passwordHash: hash,
    resetToken: null,
    resetTokenExpires: null,
  }).where(eq(usersTable.id, user.id));

  res.json({ message: "Пароль успешно изменён" });
}));

export default router;
