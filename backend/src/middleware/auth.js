/**
 * Auth Middleware — JWT with refresh token rotation
 * Demonstrates: security best practices, token blacklisting via Redis,
 * HttpOnly cookie strategy, sliding expiry
 */

const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { AppError } = require('./errorHandler');

const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// ── Token generation ──────────────────────────────────────────────────────
exports.generateTokens = (userId, teamId) => {
  const payload = { sub: userId, teamId };
  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET,  { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
};

// ── Set refresh token in HttpOnly cookie ──────────────────────────────────
exports.setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,         // not accessible from JS (XSS protection)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth/refresh',
  });
};

// ── Protect route middleware ──────────────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError('No token provided', 401);

    const token = header.split(' ')[1];

    // Check token blacklist (logged out / rotated tokens)
    const blacklisted = await redisClient.get(`bl:${token}`);
    if (blacklisted) throw new AppError('Token revoked', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, teamId: decoded.teamId };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new AppError('Token expired', 401));
    if (err.name === 'JsonWebTokenError')  return next(new AppError('Invalid token', 401));
    next(err);
  }
};

// ── POST /api/auth/refresh ────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new AppError('No refresh token', 401);

    const blacklisted = await redisClient.get(`bl:${refreshToken}`);
    if (blacklisted) throw new AppError('Refresh token revoked', 401);

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

    // Token rotation: blacklist old refresh token, issue new pair
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    await redisClient.setEx(`bl:${refreshToken}`, Math.max(ttl, 1), '1');

    const { accessToken, refreshToken: newRefresh } = exports.generateTokens(decoded.sub, decoded.teamId);
    exports.setRefreshCookie(res, newRefresh);

    res.json({ accessToken });
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new AppError('Refresh token expired, please log in again', 401));
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
      if (ttl > 0) await redisClient.setEx(`bl:${token}`, ttl, '1');
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// Lazy-loaded Redis client (shared from utils)
let redisClient;
setTimeout(() => { redisClient = require('../utils/redisClient'); }, 0);
