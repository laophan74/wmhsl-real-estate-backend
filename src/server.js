import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import v1Router from "./routes/index.js";
import authRoutes from "./routes/auth.routes.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createServer() {
  const app = express();

  // security & basics
  app.use(helmet());
  const authDisabled = process.env.AUTH_DISABLED === 'true';
    console.log('CORS_ORIGIN env:', process.env.CORS_ORIGIN);
  if (authDisabled) {
    // Testing mode: allow all origins
    app.use(cors({ origin: '*' }));
  } else {
    const corsOriginEnv = process.env.CORS_ORIGIN; // comma-separated list supported
    const allowed = (corsOriginEnv || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    app.use(
      cors({
        origin: (origin, cb) => {
          // Allow non-browser or same-origin requests with no Origin header
          if (!origin) return cb(null, true);
          if (allowed.includes(origin)) return cb(null, true);
          return cb(new Error('Not allowed by CORS'), false);
        },
        // No need for credentials with JWT tokens
      })
    );
  }
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.set("trust proxy", 1);
  // --- Session / Cookie handling tweaks for iPhone cross-site reliability ---
  // CROSS_SITE_COOKIES=true => force SameSite=None + Secure (required by Safari / iOS when third-party or different subdomain)
  // SESSION_SAMESITE overrides if explicitly provided (values: 'lax' | 'strict' | 'none')
  const crossSiteEnabled = process.env.CROSS_SITE_COOKIES === 'true';
  let sameSite = (process.env.SESSION_SAMESITE || '').toLowerCase();
  if (!['lax','strict','none'].includes(sameSite)) {
    sameSite = crossSiteEnabled ? 'none' : 'lax';
  }
  // Secure must be true when SameSite=None on modern browsers (esp. iOS Safari)
  const secure = sameSite === 'none' ? true : (process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production');
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined; // e.g. .example.com if using subdomains
  if (sameSite === 'none' && !secure) {
    console.warn('[session] Forcing secure=true because SameSite=None is set.');
  }
  app.use(
    cookieSession({
      name: 'sid',
      secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
      httpOnly: true,
      sameSite,
      secure,
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  );
  if (crossSiteEnabled) {
    console.log('[session] CROSS_SITE_COOKIES enabled => SameSite=None; Secure=true');
  } else {
    console.log(`[session] SameSite=${sameSite}; Secure=${secure}`);
  }

  // Optional debug endpoint to help diagnose mobile login cookie issues (enable with DEBUG_SESSION=true)
  if (process.env.DEBUG_SESSION === 'true') {
    app.get('/_debug/session', (req, res) => {
      res.json({
        gotSessionCookie: Boolean(req.session),
        user: req.session?.user || null,
        headers: {
          origin: req.headers.origin,
          cookie: req.headers.cookie ? '[present]' : '[none]',
          'user-agent': req.headers['user-agent'],
        },
        config: { sameSite, secure, domain: cookieDomain },
      });
    });
  }

  // health
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // api v1
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1", v1Router);

  // 404 & error
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
