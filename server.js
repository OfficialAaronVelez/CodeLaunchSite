require('dotenv').config();

const express = require('express');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { insertContact, insertChat, insertQuote } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Railway / reverse proxies send X-Forwarded-* — required for express-rate-limit + accurate req.ip
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rate limit all /api routes: 20 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later.' },
});
app.use('/api', limiter);

// ── Mailer ───────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendMail(subject, html) {
  await resend.emails.send({
    from: process.env.MAIL_FROM || 'CodeLaunch Site <onboarding@resend.dev>',
    to: process.env.NOTIFY_EMAIL,
    subject,
    html,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emailWrap(title, rows) {
  const rowsHtml = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#888;font-size:12px;
                   text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;
                   border-bottom:1px solid #2a2a2a;">${label}</td>
        <td style="padding:10px 16px;color:#e8e8e8;font-size:15px;
                   border-bottom:1px solid #2a2a2a;">${value || '—'}</td>
      </tr>`)
    .join('');

  return `
    <div style="background:#080808;padding:40px 0;font-family:'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #2a2a2a;">
        <div style="background:#F97316;padding:20px 28px;">
          <span style="font-family:monospace;font-size:20px;font-weight:700;color:#000;">
            &lt;code<span style="color:#000;">Launch</span>&gt;
          </span>
        </div>
        <div style="padding:28px 28px 8px;">
          <h2 style="margin:0 0 4px;font-size:22px;color:#fafafa;letter-spacing:-0.02em;">${title}</h2>
          <p style="margin:0;font-size:13px;color:#555;">${new Date().toLocaleString()}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">${rowsHtml}</table>
        <div style="padding:20px 28px;font-size:12px;color:#555;">
          Reply directly to this email to respond to the sender.
        </div>
      </div>
    </div>`;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 2000);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Contact form
app.post('/api/contact', async (req, res) => {
  const name        = sanitize(req.body.name);
  const email       = sanitize(req.body.email);
  const projectType = sanitize(req.body.projectType);
  const message     = sanitize(req.body.message);

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    insertContact.run(name, email, projectType, message);

    await sendMail(
      `New contact from ${name}`,
      emailWrap('New Contact Form Submission', [
        ['Name',         name],
        ['Email',        `<a href="mailto:${email}" style="color:#F97316;">${email}</a>`],
        ['Project Type', projectType],
        ['Message',      message.replace(/\n/g, '<br>')],
      ])
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to send — please email us directly.' });
  }
});

// Chat bubble
app.post('/api/chat', async (req, res) => {
  const name    = sanitize(req.body.name);
  const email   = sanitize(req.body.email);
  const message = sanitize(req.body.message);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    insertChat.run(name, email, message);

    await sendMail(
      `Chat message from ${name}`,
      emailWrap('New Chat Bubble Message', [
        ['Name',    name],
        ['Email',   `<a href="mailto:${email}" style="color:#F97316;">${email}</a>`],
        ['Message', message],
      ])
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to send — please email us directly.' });
  }
});

// Quote wizard
app.post('/api/quote', async (req, res) => {
  const email       = sanitize(req.body.email);
  const type        = sanitize(req.body.type);
  const start       = sanitize(req.body.start);
  const priority    = sanitize(req.body.priority);
  const budget      = sanitize(req.body.budget);
  const estimate    = sanitize(req.body.estimate);
  const estTimeline = sanitize(req.body.estTimeline);

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    insertQuote.run(email, type, start, priority, budget, estimate, estTimeline);

    await sendMail(
      `Quote request from ${email}`,
      emailWrap('New Quote Request', [
        ['Email',          `<a href="mailto:${email}" style="color:#F97316;">${email}</a>`],
        ['Project Type',   type],
        ['Starting Point', start],
        ['Priority',       priority],
        ['Budget',         budget],
        ['Estimate',       estimate],
        ['Est. Timeline',  estTimeline],
      ])
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Quote error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to send — please email us directly.' });
  }
});

// Catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CodeLaunch server listening on 0.0.0.0:${PORT}`);
  if (!mailConfigured) {
    console.error('[mail] Missing ZOHO_USER, ZOHO_APP_PASSWORD, or NOTIFY_EMAIL — emails will fail until set.');
  } else {
    transporter.verify((err) => {
      if (err) console.error('[mail] SMTP verify failed:', err.message);
      else console.log(`[mail] SMTP OK (${process.env.SMTP_HOST || 'smtp.zoho.com'}:${smtpPort}).`);
    });
  }
});
