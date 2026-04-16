# 🏗️ Architecture - Lumina Meet

Complete technical architecture and data flow documentation.

---

## 📊 System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         INTERNET / LAN                          │
└────────────────┬─────────────────────────────────┬──────────────┘
                 │                                 │
        ┌────────▼────────┐            ┌──────────▼─────────┐
        │  WEB BROWSER    │            │  WEB BROWSER       │
        │  (Client 1)     │            │  (Client 2)        │
        ├─────────────────┤            ├────────────────────┤
        │ index.html      │            │ index.html         │
        │ frontend.js     │            │ frontend.js        │
        │ Socket.io Client│            │ Socket.io Client   │
        └────────┬────────┘            └──────────┬─────────┘
                 │               WebSocket       │
                 │            Connection         │
                 └──────────────┬────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   PORT 3000            │
                    │   ┌──────────────────┐ │
                    │   │   backend.js     │ │
                    │   │ ┌──────────────┐ │ │
                    │   │ │ Express.js   │ │ │
                    │   │ │ • HTTP routes│ │ │
                    │   │ │ • Static file│ │ │
                    │   │ └──────────────┘ │ │
                    │   │ ┌──────────────┐ │ │
                    │   │ │ Socket.io    │ │ │
                    │   │ │ • Rooms      │ │ │
                    │   │ │ • Events     │ │ │
                    │   │ │ • Broadcasts │ │ │
                    │   │ └──────────────┘ │ │
                    │   └──────────────────┘ │
                    │                        │
                    └────────────────────────┘
```

---

## 🔄 Connection Flow

### 1. Initial Connection

```
User opens http://localhost:3000
  │
  ├─ Browser downloads index.html
  │
  ├─ Loads Tailwind CSS from CDN
  │
  ├─ Loads Socket.io client library
  │
  └─ Loads frontend.js
     │
     └─ Creates Socket.io connection to backend
        │
        └─ Backend accepts connection
           │
           └─ Socket ID assigned: "socket-12345"
```

### 2. Microphone & Camera Permission Request

```
User clicks "Join Secure Meeting"
  │
  ├─ Calls requestMediaPermissions()
  │
  ├─ navigator.mediaDevices.getUserMedia() invoked
  │
  ├─ Browser shows permission prompt:
  │  ┌─────────────────────────────────────┐
  │  │ Website.com wants to access:        │
  │  │ [✓] Microphone                      │
  │  │ [✓] Camera                          │
  │  │                    [Allow] [Block]  │
  │  └─────────────────────────────────────┘
  │
  └─ If allowed → localStream = MediaStream object
     └─ Contains: audio track + video track
        ├─ Can be enabled/disabled
        ├─ Can be displayed in <video> element
        └─ Can be sent to other participants via WebRTC
```

### 3. Meeting Room Join

```
User submits form with name & room ID
  │
  ├─ frontend.js::joinMeeting() executes
  │
  ├─ Hides auth modal, shows main app
  │
  ├─ Emits Socket.io event:
  │  {
  │    event: 'join-meeting',
  │    data: {
  │      roomId: 'LUM-84291',
  │      userName: 'Alex Rivera',
  │      userId: 'socket-12345'
  │    }
  │  }
  │
  └─ Backend receives & processes:
     │
     ├─ Adds user to room
     ├─ Updates participant list
     ├─ Broadcasts to all others:
     │  {
     │    event: 'user-joined',
     │    data: {
     │      participant: { name: 'Alex', ... },
     │      totalParticipants: 3
     │    }
     │  }
     │
     └─ All clients update their UI
        └─ "Alex Rivera joined • Total: 3"
```

### 4. Real-time Communication

```
CHAT MESSAGE
─────────────
User types & sends message
  │
  ├─ Calls sendChatMessage()
  │
  ├─ Emits: 'send-message'
  │  {
  │    roomId: 'LUM-84291',
  │    message: 'Hello everyone!',
  │    userName: 'Alex Rivera',
  │    timestamp: '10:30 AM'
  │  }
  │
  ├─ Backend receives & broadcasts to room
  │
  └─ All clients emit: 'receive-message'
     └─ Display in chat history


WHITEBOARD DRAWING
──────────────────
User draws on canvas
  │
  ├─ Canvas mousedown → startDrawing()
  ├─ Canvas mousemove → draw() + emit 'draw' event
  ├─ Canvas mouseup → stopDrawing()
  │
  ├─ Each draw event:
  │  {
  │    roomId: 'LUM-84291',
  │    fromX: 100, fromY: 50,
  │    toX: 120, toY: 60,
  │    color: '#00d4ff',
  │    brushSize: 6
  │  }
  │
  ├─ Backend broadcasts to others
  │
  └─ Other clients receive 'remote-draw'
     └─ Draw same line on their canvas


MICROPHONE TOGGLE
─────────────────
User clicks 🎤 button
  │
  ├─ toggleMic() executes
  │
  ├─ Update: isMicOn = !isMicOn
  │
  ├─ Disable audio track:
  │  localStream.getAudioTracks()[0].enabled = false
  │
  ├─ Emits: 'toggle-mic'
  │  {
  │    roomId: 'LUM-84291',
  │    userId: 'socket-12345',
  │    muted: true
  │  }
  │
  ├─ Backend updates participant status
  │
  └─ Broadcasts: 'participant-updated'
     └─ Others see 🔇 icon next to user
```

---

## 📡 Socket.io Events Map

### Client → Server Events

| Event | Data | Purpose |
|-------|------|---------|
| `join-meeting` | {roomId, userName, userId} | Join a room |
| `toggle-mic` | {roomId, userId, muted} | Mute/unmute audio |
| `toggle-video` | {roomId, userId, videoOn} | Enable/disable camera |
| `send-message` | {roomId, userName, message, timestamp} | Send chat message |
| `draw` | {roomId, fromX, fromY, toX, toY, color, brushSize} | Send drawing line |
| `clear-whiteboard` | {roomId} | Clear whiteboard |
| `share-file` | {roomId, fileName, fileSize, fileType} | Share a file |
| `start-screen-share` | {roomId, userId} | Start screen sharing |
| `stop-screen-share` | {roomId, userId} | Stop screen sharing |
| `leave-meeting` | {roomId, userId} | Leave the meeting |

### Server → Client Events

| Event | Data | Purpose |
|-------|------|---------|
| `user-joined` | {participant, totalParticipants} | New user joined |
| `user-left` | {userId, totalParticipants} | User left room |
| `participant-updated` | {userId, muted, videoOn} | User status changed |
| `receive-message` | {userName, message, timestamp} | Receive chat message |
| `remote-draw` | {fromX, fromY, toX, toY, color, brushSize} | Receive drawing |
| `whiteboard-cleared` | {} | Whiteboard was cleared |
| `file-shared` | {fileName, fileSize, fileType, sharedBy, timestamp} | File was shared |
| `screen-share-started` | {userId} | User started sharing screen |
| `screen-share-stopped` | {userId} | User stopped sharing screen |

---

## 💾 Data Structures

### Room Object
```javascript
{
  id: 'LUM-84291',
  participants: [
    {
      id: 'socket-12345',
      socketId: 'socket-12345',
      name: 'Alex Rivera',
      muted: false,
      videoOn: true,
      screenSharing: false
    },
    // ... more participants
  ],
  createdAt: 2024-04-03T10:30:00Z
}
```

### Participant Object
```javascript
{
  id: 'user-uuid',
  socketId: 'socket-12345',
  name: 'Alex Rivera',
  avatar: 'AR',
  muted: false,
  videoOn: true,
  screenSharing: false
}
```

### MediaStream Object
```javascript
{
  active: true,
  id: 'stream-id-123',
  getTracks: [
    // Audio Track
    {
      kind: 'audio',
      enabled: true,
      id: 'audio-track-1'
    },
    // Video Track
    {
      kind: 'video',
      enabled: true,
      id: 'video-track-1'
    }
  ]
}
```

---

## 🔐 Security Architecture

### Permission Layers

```
┌─────────────────────────────────┐
│   Browser Security              │
│ ├─ Same-Origin Policy (CORS)   │
│ ├─ WebRTC Permission Prompt    │
│ ├─ HTTPS Required (Production) │
│ └─ Service Worker Support      │
└─────────────────────────────────┘
                ↓
┌─────────────────────────────────┐
│   Application Security          │
│ ├─ Socket.io Middleware         │
│ ├─ JWT Authentication (Ready)   │
│ ├─ Input Validation             │
│ └─ Error Handling               │
└─────────────────────────────────┘
                ↓
┌─────────────────────────────────┐
│   Network Security              │
│ ├─ WebRTC Encryption (Built-in)│
│ ├─ WebSocket over HTTPS (WSS)   │
│ ├─ CORS Headers                 │
│ └─ CSRF Protection (Ready)      │
└─────────────────────────────────┘
```

### Permission Request Flow

```
┌──────────────────────────────────────┐
│ Browser Permission Manager           │
└──────────────────────────────────────┘
           ↓
    navigator.mediaDevices
    .getUserMedia({
      video: { width: 1280, height: 720 },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
           ↓
┌──────────────────────────────────────┐
│ User sees Permission Dialog:         │
│ □ Microphone                         │
│ □ Camera                             │
│           [Allow] [Block]            │
└──────────────────────────────────────┘
           ↓
    User clicks [Allow]
           ↓
    Promise resolves with MediaStream
           ↓
┌──────────────────────────────────────┐
│ App gets access to:                 │
│ ✓ Microphone audio                   │
│ ✓ Camera video                       │
│ ✓ Can control on/off                 │
│ ✓ Can send to other users via WebRTC│
└──────────────────────────────────────┘
```

---

## 📁 File Organization

```
Real-Time Communication/
│
├── index.html           ← Frontend UI (Tailwind + HTML)
├── frontend.js          ← Client-side logic (1000+ lines)
├── backend.js           ← Node.js server (500+ lines)
│
├── package.json         ← NPM dependencies
├── .env                 ← Environment configuration
│
├── README.md            ← Full documentation
├── SETUP_GUIDE.md       ← Step-by-step setup
├── ARCHITECTURE.md      ← This file
│
├── start.bat            ← Windows launcher
├── start.sh             ← Unix/Mac launcher
│
└── .gitignore           ← Git ignore rules
```

---

## 🔌 API Endpoints

### HTTP Routes (Express.js)

```javascript
// Serve frontend
GET  /
Response: index.html file

// Health check
GET  /api/health
Response: { status: 'Server running ✅', timestamp: '...' }

// Create new room
POST /api/create-room
Response: { roomId: 'LUM-12345', joinUrl: 'http://...' }

// Get all active rooms
GET  /api/rooms
Response: [
  { roomId: 'LUM-12345', participantCount: 3, createdAt: '...' },
  { roomId: 'LUM-67890', participantCount: 1, createdAt: '...' }
]
```

---

## 🚀 Deployment Architecture

### Local Development
```
Your Computer
├─ Node.js + npm
├─ localhost:3000
└─ http://localhost:3000 (browser)
```

### Production - Cloud Deployment
```
Cloud Provider (Heroku/Railway/Render)
├─ Node.js Runtime
├─ Environment Variables (.env)
├─ HTTPS Certificate (SSL/TLS)
├─ Database Connection (MongoDB/Firebase)
├─ Domain (example.com)
└─ https://example.com (browser)
```

---

## 📊 State Management

### Frontend State
```javascript
// User state
currentUser = {
  name: 'Alex Rivera',
  avatar: 'AR',
  id: 'socket-12345'
}

// Meeting state
currentRoomId = 'LUM-84291'
isMicOn = true
isVideoOn = true
isScreenSharing = false

// Communication state
socket = Socket.io connection
localStream = MediaStream object
peerConnections = Map of RTCPeerConnection

// UI state
currentTab = 0
chatHistory = []
participants = []
sharedFiles = []
```

### Backend State
```javascript
// Rooms storage
const rooms = new Map()
// {
//   'LUM-84291': {
//     id: 'LUM-84291',
//     participants: [...],
//     createdAt: Date
//   }
// }
```

---

## 🔄 Message Flow Example: Sending a Chat Message

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT 1: Alex Rivera                                            │
│ 1. Enters "Hello everyone!" in chat input                        │
│ 2. Presses Enter                                                 │
│ 3. sendChatMessage() called                                      │
│ 4. Emits Socket event:                                           │
│    socket.emit('send-message', {                                 │
│      roomId: 'LUM-84291',                                        │
│      message: 'Hello everyone!',                                 │
│      userName: 'Alex Rivera',                                    │
│      timestamp: '10:30 AM'                                       │
│    })                                                            │
└──────────────────────────────────────────────────────────────────┘
                            │
                         WebSocket
                            │
┌──────────────────────────────────────────────────────────────────┐
│ SERVER: backend.js                                               │
│ 1. Receives 'send-message' event                                 │
│ 2. Extracts roomId from data                                     │
│ 3. Validates message content                                     │
│ 4. Broadcasts to all in room except sender:                      │
│    io.to(roomId).emit('receive-message', data)                   │
└──────────────────────────────────────────────────────────────────┘
                            │
                         WebSocket
                            │
        ┌───────────────────┼──────────────────┐
        │                   │                  │
┌───────────▼────────┐ ┌────▼──────────┐ ┌───▼─────────────┐
│ CLIENT 2: Sarah    │ │ CLIENT 3:     │ │ CLIENT 4: Priya │
│ Receives:          │ │ Marcus        │ │ Receives:       │
│ 'receive-message'  │ │ Receives:     │ │ 'receive-message'
│ Add to chatHistory │ │ 'receive-msg' │ │ Add to history  │
│ Render chat        │ │ Add to history│ │ Render chat     │
│ Show toast:        │ │ Render chat   │ │ Show toast:     │
│ "Alex: Hello..."   │ │ Show toast    │ │ "Alex: Hello..."│
└────────────────────┘ └───────────────┘ └─────────────────┘
```

---

## 🎯 Key Technology Patterns

### 1. Event-Driven Architecture
- Everything is an event
- Socket.io emits → Server broadcasts → Clients receive

### 2. Room-Based Communication
- Users belong to rooms (meetings)
- Server groups by roomId
- Broadcasting only to room members

### 3. Peer-to-Peer Media (Ready for WebRTC)
- Direct connection between clients
- Server only needs to signal (offer/answer/ICE)
- Media doesn't flow through server

### 4. Reactive UI Updates
- Any server event triggers UI update
- Participants, chat, whiteboard, status all update reactively

---

## 🔮 Future Enhancement Points

### 1. Add Database
```javascript
// Store meetings
db.meetings.insertOne({ roomId, createdAt, startedBy })

// Store messages
db.messages.insertOne({ roomId, message, sender, timestamp })

// Store users
db.users.insertOne({ userId, name, email, preferences })
```

### 2. Add Authentication
```javascript
// JWT tokens
const token = jwt.sign({ userId }, SECRET)
socket.on('connect', (token) => {
  verify(token) // Authenticate connection
})
```

### 3. Add Persistence
```javascript
// Redis for session storage
redis.set(`room:${roomId}`, JSON.stringify(room))
redis.expire(`room:${roomId}`, 3600) // 1 hour TTL
```

### 4. Add Scalability
```javascript
// Redis Adapter for multiple server instances
const io = require('socket.io')(server, {
  adapter: require('socket.io-redis')({ host, port })
})
```

---

## 📈 Performance Considerations

### Bandwidth Usage
- **Audio**: 50-100 Kbps per user
- **Video**: 500 Kbps - 2.5 Mbps per user
- **Chat Messages**: Minimal
- **Whiteboard**: Small draw events

### Scaling Limits
- **Per Server**: ~3,000 concurrent users
- **Per Room**: No hard limit, but UX degrades with 50+ participants
- **Network**: Limited by server bandwidth

### Optimization Tips
1. Use H.264 video codec
2. Implement bitrate adaptation
3. Add message debouncing
4. Compress whiteboard data
5. Use Redis for horizontal scaling

---

**End of Architecture Documentation**

For issues or questions, check README.md and SETUP_GUIDE.md!
