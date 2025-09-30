export default function requireAuth(req, res, next) {
  // Temporary bypass for local/testing or staged environments
  if (process.env.AUTH_DISABLED === 'true') return next();

  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  next();
}
