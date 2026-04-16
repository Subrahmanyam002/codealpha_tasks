// ===================================
// AUTHENTICATION ROUTES
// Express.js routes for user signup/login/logout
// ===================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  hashPassword,
  verifyPassword,
  generateJWT,
  createSecureUser,
  validateUserCredentials,
  logSecurityEvent,
  encryptData,
  decryptData
} = require('./auth');

const router = express.Router();

/**
 * ===================================
 * USER REGISTRATION
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, name'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength check
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if user exists (in production, query database)
    // const existingUser = await User.findOne({ email });
    // if (existingUser) {
    //   return res.status(409).json({ error: 'Email already registered' });
    // }

    // Create secure user with hashed password
    const newUser = await createSecureUser({
      email: email.toLowerCase(),
      password,
      name
    });

    if (!newUser) {
      return res.status(500).json({
        error: 'Failed to create user account'
      });
    }

    // Generate JWT token
    const token = generateJWT({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    });

    // Log signup event
    logSecurityEvent('user-signup', newUser.id, {
      email: newUser.email,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: '✅ Account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      },
      token,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * ===================================
 * USER LOGIN
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required'
      });
    }

    // In production, fetch from database:
    // const user = await User.findOne({ email: email.toLowerCase() });

    // Demo: Create mock user for testing
    const demoUsers = {
      'demo@example.com': {
        id: uuidv4(),
        email: 'demo@example.com',
        name: 'Demo User',
        password: await hashPassword('demo123456') // hashed "demo123456"
      },
      'alex@example.com': {
        id: uuidv4(),
        email: 'alex@example.com',
        name: 'Alex Rivera',
        password: await hashPassword('secure123456')
      }
    };

    const user = demoUsers[email.toLowerCase()];

    if (!user) {
      logSecurityEvent('failed-login', 'unknown', {
        email,
        reason: 'user-not-found',
        ipAddress: req.ip
      });
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password);

    if (!passwordMatch) {
      logSecurityEvent('failed-login', user.id, {
        email,
        reason: 'invalid-password',
        ipAddress: req.ip
      });
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateJWT({
      id: user.id,
      email: user.email,
      name: user.name
    });

    // Generate refresh token (longer expiration)
    const refreshToken = generateJWT({
      id: user.id,
      email: user.email,
      type: 'refresh'
    }, '7d');

    // Log login event
    logSecurityEvent('user-login', user.id, {
      email: user.email,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: '✅ Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tokens: {
        access: token,
        refresh: refreshToken
      },
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * ===================================
 * REFRESH TOKEN
 * POST /api/auth/refresh
 */
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token (implementation would verify in database too)
    const payload = require('./auth').verifyJWT(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = generateJWT({
      id: payload.id,
      email: payload.email,
      name: payload.name
    });

    res.json({
      success: true,
      token: newAccessToken,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * ===================================
 * VERIFY TOKEN
 * POST /api/auth/verify
 */
router.post('/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const payload = require('./auth').verifyJWT(token);

    if (!payload) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }

    res.json({
      valid: true,
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name
      }
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'Token verification failed'
    });
  }
});

/**
 * ===================================
 * CHANGE PASSWORD
 * POST /api/auth/change-password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current and new passwords required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters'
      });
    }

    // In production:
    // const user = await User.findById(userId);
    // const passwordMatch = await verifyPassword(currentPassword, user.password);
    // if (!passwordMatch) return error;
    // user.password = await hashPassword(newPassword);
    // await user.save();

    logSecurityEvent('password-changed', userId, {
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: '✅ Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

/**
 * ===================================
 * USER PROFILE
 * GET /api/auth/profile
 */
router.get('/profile', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = require('./auth').verifyJWT(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // In production, fetch full user data from database
    res.json({
      success: true,
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.email}`,
        role: 'user',
        createdAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * ===================================
 * LOGOUT
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = require('./auth').verifyJWT(token);

    if (payload) {
      logSecurityEvent('user-logout', payload.id, {
        ipAddress: req.ip
      });
    }

    res.json({
      success: true,
      message: '✅ Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * ===================================
 * GENERATE ROOM PASSWORD
 * POST /api/auth/room-password
 */
router.post('/room-password', async (req, res) => {
  try {
    const { roomId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    const payload = require('./auth').verifyJWT(token);

    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roomPassword = Math.random().toString(36).substring(2, 10);
    const hashedPassword = await require('./auth').hashPassword(roomPassword);

    logSecurityEvent('room-password-created', payload.id, {
      roomId,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      roomPassword,
      hashedPassword
    });
  } catch (error) {
    console.error('❌ Room password generation error:', error);
    res.status(500).json({ error: 'Failed to generate room password' });
  }
});

/**
 * ===================================
 * VERIFY ROOM PASSWORD
 * POST /api/auth/verify-room-password
 */
router.post('/verify-room-password', async (req, res) => {
  try {
    const { roomId, password } = req.body;

    // In production, fetch hashed password from database
    // const roomData = await Room.findOne({ id: roomId });
    // const matches = await verifyRoomPassword(password, roomData.passwordHash);

    // Demo: accept any 6-8 character alphanumeric
    const isValid = /^[a-zA-Z0-9]{6,8}$/.test(password);

    res.json({
      success: true,
      valid: isValid,
      message: isValid ? 'Room password verified' : 'Invalid password'
    });
  } catch (error) {
    res.status(500).json({ error: 'Password verification failed' });
  }
});

module.exports = router;
