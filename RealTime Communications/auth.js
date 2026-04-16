// ===================================
// LUMINA MEET - AUTHENTICATION & ENCRYPTION
// Secure credentials and data handling
// ===================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ===================================
// ENCRYPTION UTILITIES
// ===================================

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production', 'salt', 32);

/**
 * Encrypt sensitive data (messages, files, etc.)
 * @param {string} data - Data to encrypt
 * @returns {object} - Encrypted data with iv
 */
function encryptData(data) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
      algorithm: ENCRYPTION_ALGORITHM
    };
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt sensitive data
 * @param {object} encryptedData - Encrypted data with iv
 * @returns {object} - Decrypted data
 */
function decryptData(encryptedData) {
  try {
    const { iv, data } = encryptedData;
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    return null;
  }
}

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('❌ Password hashing failed:', error);
    return null;
  }
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} - Match result
 */
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('❌ Password verification failed:', error);
    return false;
  }
}

/**
 * Generate JWT token
 * @param {object} payload - User data to encode
 * @param {number} expiresIn - Token expiration in seconds (default: 24 hours)
 * @returns {string} - JWT token
 */
function generateJWT(payload, expiresIn = '24h') {
  try {
    return jwt.sign(payload, process.env.JWT_SECRET || 'default-jwt-secret', {
      expiresIn
    });
  } catch (error) {
    console.error('❌ JWT generation failed:', error);
    return null;
  }
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded payload or null if invalid
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret');
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    return null;
  }
}

/**
 * Create a user object with secure password
 * @param {object} userData - User data
 * @returns {Promise<object>} - User with hashed password
 */
async function createSecureUser(userData) {
  try {
    const hashedPassword = await hashPassword(userData.password);
    
    return {
      id: crypto.randomUUID(),
      email: userData.email,
      name: userData.name,
      password: hashedPassword,
      createdAt: new Date(),
      lastLogin: null,
      settings: {
        twoFactorEnabled: false,
        publicProfile: false
      }
    };
  } catch (error) {
    console.error('❌ Failed to create secure user:', error);
    return null;
  }
}

/**
 * Validate user credentials
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @param {object} storedUser - User from database
 * @returns {Promise<boolean>} - Authentication result
 */
async function validateUserCredentials(email, password, storedUser) {
  try {
    if (!storedUser || storedUser.email !== email) {
      return false;
    }
    
    return await verifyPassword(password, storedUser.password);
  } catch (error) {
    console.error('❌ Credential validation failed:', error);
    return false;
  }
}

// ===================================
// AUTHENTICATION MIDDLEWARE
// ===================================

/**
 * Express middleware to verify JWT in headers
 */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const payload = verifyJWT(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = payload;
  next();
}

/**
 * Socket.io middleware for JWT verification
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('No authentication token provided'));
  }
  
  const payload = verifyJWT(token);
  
  if (!payload) {
    return next(new Error('Invalid or expired token'));
  }
  
  socket.userId = payload.id;
  socket.userEmail = payload.email;
  socket.userName = payload.name;
  
  next();
}

// ===================================
// DATA ENCRYPTION FOR MESSAGES
// ===================================

/**
 * Encrypt a chat message
 * @param {string} message - Plain text message
 * @param {string} senderName - Sender's name
 * @returns {object} - Encrypted message with metadata
 */
function encryptMessage(message, senderName) {
  const messageData = {
    content: message,
    sender: senderName,
    timestamp: new Date().toISOString(),
    encrypted: true
  };
  
  return encryptData(messageData);
}

/**
 * Decrypt a chat message
 * @param {object} encryptedMessage - Encrypted message object
 * @returns {object} - Decrypted message
 */
function decryptMessage(encryptedMessage) {
  return decryptData(encryptedMessage);
}

/**
 * Encrypt file metadata
 * @param {object} fileData - File information
 * @returns {object} - Encrypted file data
 */
function encryptFileMetadata(fileData) {
  const fileMetadata = {
    name: fileData.name,
    size: fileData.size,
    type: fileData.type,
    uploadedAt: new Date().toISOString(),
    uploadedBy: fileData.uploadedBy,
    checksum: crypto.createHash('sha256').update(fileData.name + fileData.size).digest('hex')
  };
  
  return encryptData(fileMetadata);
}

/**
 * Generate a secure room password hash
 * @param {string} password - Room password
 * @returns {Promise<string>} - Password hash
 */
async function hashRoomPassword(password) {
  return await hashPassword(password);
}

/**
 * Verify room password
 * @param {string} password - User-provided password
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} - Match result
 */
async function verifyRoomPassword(password, hash) {
  return await verifyPassword(password, hash);
}

// ===================================
// SESSION SECURITY
// ===================================

/**
 * Generate secure session token
 * @param {string} userId - User ID
 * @returns {string} - Session token
 */
function generateSessionToken(userId) {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token
 * @param {string} token - Token to validate
 * @param {string} sessionToken - Stored session token
 * @returns {boolean} - Validation result
 */
function validateCSRFToken(token, sessionToken) {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
}

// ===================================
// AUDIT LOGGING
// ===================================

/**
 * Log security events
 * @param {string} event - Event type
 * @param {string} userId - User ID
 * @param {object} details - Additional details
 */
function logSecurityEvent(event, userId, details = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    details,
    severity: ['login', 'logout', 'password-change'].includes(event) ? 'info' : 'warning'
  };
  
  console.log(`🔐 [${log.severity.toUpperCase()}] ${event} | User: ${userId}`, details);
  
  // In production, store in database or log service
  // db.logs.insertOne(log)
}

// ===================================
// EXPORTS
// ===================================

module.exports = {
  // Encryption
  encryptData,
  decryptData,
  encryptMessage,
  decryptMessage,
  encryptFileMetadata,
  
  // Password
  hashPassword,
  verifyPassword,
  hashRoomPassword,
  verifyRoomPassword,
  
  // JWT
  generateJWT,
  verifyJWT,
  
  // User
  createSecureUser,
  validateUserCredentials,
  
  // Middleware
  authMiddleware,
  socketAuthMiddleware,
  
  // Session
  generateSessionToken,
  validateCSRFToken,
  
  // Logging
  logSecurityEvent,
  
  // Constants
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY
};
