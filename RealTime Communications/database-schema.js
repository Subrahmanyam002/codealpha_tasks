// ===================================
// DATABASE SCHEMA - LUMINA MEET
// MongoDB/Firebase collections structure
// ===================================

/**
 * USERS COLLECTION
 * Stores user accounts and authentication data
 */
const UserSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  email: "string (unique, lowercase)",
  name: "string",
  password: "string (bcrypt hashed)",
  avatar: "string (URL or initials)",
  phone: "string (optional)",
  bio: "string (optional)",
  
  // Security
  role: "enum: ['user', 'admin', 'moderator']",
  verified: "boolean",
  verifiedAt: "ISO 8601 timestamp (optional)",
  
  // Settings
  settings: {
    twoFactorEnabled: "boolean",
    publicProfile: "boolean",
    notificationsEnabled: "boolean",
    emailNotifications: "boolean"
  },
  
  // Timestamps
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp",
  lastLogin: "ISO 8601 timestamp (optional)",
  lastActivity: "ISO 8601 timestamp (optional)",
  
  // Status
  status: "enum: ['active', 'inactive', 'banned']",
  deactivatedAt: "ISO 8601 timestamp (optional)"
};

/**
 * MEETINGS COLLECTION
 * Stores meeting/room data
 */
const MeetingSchema = {
  _id: "ObjectId",
  id: "string (UUID - roomId)",
  name: "string",
  description: "string (optional)",
  
  // Host info
  hostId: "string (foreign key → Users.id)",
  hostName: "string",
  
  // Security
  password: "string (bcrypt hashed, optional)",
  isPublic: "boolean",
  maxParticipants: "number",
  
  // Settings
  recordingEnabled: "boolean",
  allowScreenShare: "boolean",
  allowFileShare: "boolean",
  allowWhiteboard: "boolean",
  
  // Status
  status: "enum: ['scheduled', 'active', 'ended', 'cancelled']",
  startedAt: "ISO 8601 timestamp (optional)",
  endedAt: "ISO 8601 timestamp (optional)",
  scheduledFor: "ISO 8601 timestamp (optional)",
  
  // Access control
  participants: [
    {
      userId: "string",
      userName: "string",
      joinedAt: "ISO 8601 timestamp",
      leftAt: "ISO 8601 timestamp (optional)",
      role: "enum: ['host', 'participant', 'viewer']"
    }
  ],
  
  // Metadata
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp",
  duration: "number (seconds, optional)"
};

/**
 * MESSAGES COLLECTION
 * Stores encrypted chat messages
 */
const MessageSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  
  // Relationships
  roomId: "string (foreign key → Meetings.id)",
  userId: "string (foreign key → Users.id)",
  userName: "string",
  
  // Content (encrypted)
  encryptedContent: {
    iv: "string (hex)",
    data: "string (hex)",
    algorithm: "string"
  },
  
  // Message metadata
  type: "enum: ['text', 'system', 'notification']",
  hasAttachment: "boolean",
  attachmentUrl: "string (optional)",
  
  // Timestamps
  createdAt: "ISO 8601 timestamp",
  editedAt: "ISO 8601 timestamp (optional)",
  
  // Reactions
  reactions: {
    "emoji": ["userId1", "userId2"]
  }
};

/**
 * FILES COLLECTION
 * Stores file sharing metadata
 */
const FileSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  
  // File info
  name: "string",
  size: "number (bytes)",
  mimeType: "string",
  extension: "string",
  
  // Upload info
  roomId: "string (foreign key → Meetings.id)",
  uploadedBy: "string (foreign key → Users.id)",
  uploadedAt: "ISO 8601 timestamp",
  
  // Storage
  storageUrl: "string (S3/cloud URL)",
  checksum: "string (SHA-256 hash)",
  
  // Encryption metadata
  encryptedMetadata: {
    iv: "string (hex)",
    data: "string (hex)",
    algorithm: "string"
  },
  
  // Access
  accessLevel: "enum: ['public', 'private', 'shared']",
  expiresAt: "ISO 8601 timestamp (optional)",
  downloadCount: "number",
  
  // Status
  status: "enum: ['uploading', 'active', 'archived', 'deleted']"
};

/**
 * SESSIONS COLLECTION
 * Stores user sessions for security
 */
const SessionSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  
  // User info
  userId: "string (foreign key → Users.id)",
  email: "string",
  
  // Token info
  token: "string (JWT)",
  refreshToken: "string (JWT)",
  sessionToken: "string (random hash)",
  
  // Device info
  deviceInfo: {
    userAgent: "string",
    ipAddress: "string",
    deviceType: "enum: ['desktop', 'mobile', 'tablet']",
    browser: "string",
    os: "string"
  },
  
  // Timing
  createdAt: "ISO 8601 timestamp",
  expiresAt: "ISO 8601 timestamp",
  lastActivity: "ISO 8601 timestamp",
  
  // Status
  active: "boolean",
  revokedAt: "ISO 8601 timestamp (optional)"
};

/**
 * AUDIT_LOGS COLLECTION
 * Tracks all security-relevant events
 */
const AuditLogSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  
  // Event info
  event: "string",
  severity: "enum: ['info', 'warning', 'error', 'critical']",
  
  // User info
  userId: "string (optional)",
  email: "string (optional)",
  
  // Context
  roomId: "string (optional)",
  resource: "string",
  action: "string",
  
  // Details
  details: "object",
  result: "enum: ['success', 'failure', 'partial']",
  
  // Request info
  ipAddress: "string",
  userAgent: "string",
  
  // Timestamp
  timestamp: "ISO 8601 timestamp",
  
  // Retention (auto-delete after 90 days)
  expiresAt: "ISO 8601 timestamp"
};

/**
 * WHITEBOARD_SNAPSHOTS COLLECTION
 * Stores whiteboard drawing history
 */
const WhiteboardSnapshotSchema = {
  _id: "ObjectId",
  id: "string (UUID)",
  
  // Reference
  roomId: "string (foreign key → Meetings.id)",
  createdBy: "string (foreign key → Users.id)",
  
  // Content
  canvasData: "string (base64 PNG or draw commands)",
  drawingCommands: [
    {
      type: "enum: ['line', 'circle', 'rect', 'text', 'erase']",
      x: "number",
      y: "number",
      x2: "number",
      y2: "number",
      color: "string",
      size: "number",
      content: "string (optional)"
    }
  ],
  
  // Encryption
  encryptedData: {
    iv: "string",
    data: "string",
    algorithm: "string"
  },
  
  // Metadata
  title: "string",
  description: "string",
  version: "number",
  
  // Timestamps
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp"
};

/**
 * ROOM_PASSWORDS COLLECTION
 * Stores hashed room passwords
 */
const RoomPasswordSchema = {
  _id: "ObjectId",
  
  // Reference
  roomId: "string (foreign key → Meetings.id)",
  
  // Security
  passwordHash: "string (bcrypt hashed)",
  attempts: "number",
  lastFailedAt: "ISO 8601 timestamp (optional)",
  lockedUntil: "ISO 8601 timestamp (optional)",
  
  // Metadata
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp",
  changedBy: "string (userId)"
};

/**
 * BLOCKED_USERS COLLECTION
 * Manages user blocking/moderation
 */
const BlockedUserSchema = {
  _id: "ObjectId",
  
  // Users
  blockedUserId: "string (foreign key → Users.id)",
  blockedByUserId: "string (foreign key → Users.id)",
  
  // Room context (optional)
  roomId: "string (optional)",
  
  // Reason
  reason: "string",
  
  // Timestamps
  createdAt: "ISO 8601 timestamp",
  expiresAt: "ISO 8601 timestamp (optional)"
};

// ===================================
// DATABASE INDEXES (for performance)
// ===================================

/**
 * MongoDB Indexes to create:
 * 
 * Users:
 * - db.users.createIndex({ email: 1 }, { unique: true })
 * - db.users.createIndex({ createdAt: -1 })
 * - db.users.createIndex({ status: 1 })
 * 
 * Meetings:
 * - db.meetings.createIndex({ id: 1 }, { unique: true })
 * - db.meetings.createIndex({ hostId: 1 })
 * - db.meetings.createIndex({ status: 1, startedAt: -1 })
 * - db.meetings.createIndex({ "participants.userId": 1 })
 * 
 * Messages:
 * - db.messages.createIndex({ roomId: 1, createdAt: -1 })
 * - db.messages.createIndex({ userId: 1 })
 * 
 * Files:
 * - db.files.createIndex({ roomId: 1, uploadedAt: -1 })
 * - db.files.createIndex({ uploadedBy: 1 })
 * 
 * Sessions:
 * - db.sessions.createIndex({ userId: 1 })
 * - db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 * 
 * AuditLogs:
 * - db.audit_logs.createIndex({ timestamp: -1 })
 * - db.audit_logs.createIndex({ userId: 1 })
 * - db.audit_logs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 */

// ===================================
// EXAMPLE QUERIES
// ===================================

/**
 * Find user by email
 * db.users.findOne({ email: "user@example.com" })
 * 
 * Find all active meetings
 * db.meetings.find({ status: "active" })
 * 
 * Get all messages in a room
 * db.messages.find({ roomId: "room-123" }).sort({ createdAt: -1 })
 * 
 * Get user's sessions
 * db.sessions.find({ userId: "user-123", active: true })
 * 
 * Get recent audit logs
 * db.audit_logs.find({ userId: "user-123" }).sort({ timestamp: -1 }).limit(50)
 * 
 * Find meeting participants
 * db.meetings.findOne({ id: "room-123" }, { "participants": 1 })
 * 
 * Get files shared in a meeting
 * db.files.find({ roomId: "room-123" }).sort({ uploadedAt: -1 })
 */

// ===================================
// EXPORTS
// ===================================

module.exports = {
  // Schemas
  UserSchema,
  MeetingSchema,
  MessageSchema,
  FileSchema,
  SessionSchema,
  AuditLogSchema,
  WhiteboardSnapshotSchema,
  RoomPasswordSchema,
  BlockedUserSchema,
  
  // Documentation
  documentation: {
    description: 'Database schemas for Lumina Meet',
    version: '1.0.0',
    dbType: 'MongoDB (compatible with Firebase/other NoSQL)',
    notes: 'All passwords are bcrypt hashed, messages are AES-256 encrypted'
  }
};
