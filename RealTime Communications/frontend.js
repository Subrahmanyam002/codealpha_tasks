// ===================================
// LUMINA MEET - FRONTEND LOGIC
// Client-Side Real-Time Communication
// ===================================

// Global variables
let socket;
let currentUser = { name: "Alex Rivera", avatar: "AR", id: null };
let currentRoomId = null;
let localStream = null;
let screenStream = null; // screen sharing stream for toggling back/forth
let peerConnections = new Map();

let participants = [
  { id: 1, name: "Alex Rivera", avatar: "AR", you: true, muted: false, videoOn: true },
  { id: 2, name: "Sarah Chen", avatar: "SC", you: false, muted: true, videoOn: true },
  { id: 3, name: "Marcus Rivera", avatar: "MR", you: false, muted: false, videoOn: false },
  { id: 4, name: "Priya Sharma", avatar: "PS", you: false, muted: false, videoOn: true }
];

let isMicOn = true;
let isVideoOn = true;
let isScreenSharing = false;
let meetingTimer = null;
let meetingElapsedSeconds = 0;
let currentTab = 0;
let currentTool = 'pen';
let brushSize = 6;
let currentColor = '#00d4ff';

// Canvas variables
let canvas, ctx, isDrawing = false, lastX = 0, lastY = 0;

// Fake files
let sharedFiles = [
  { name: "Q3_Product_Roadmap.pdf", size: "2.4 MB", time: "2m ago" },
  { name: "Design_System_v2.fig", size: "18 MB", time: "11m ago" },
  { name: "Sprint_Demo.mp4", size: "87 MB", time: "34m ago" }
];

// Fake chat history
let chatHistory = [
  { name: "Sarah Chen", message: "Can we go over the new pricing page?", time: "just now" },
  { name: "Marcus Rivera", message: "👍 Looks good!", time: "1m" }
];

// ===================================
// SOCKET.IO CONNECTION
// ===================================

function connectToBackend() {
  console.log('🔌 Connecting to backend...');
  socket = io();

  socket.on('connect', () => {
    console.log('✅ Connected to server:', socket.id);
    currentUser.id = socket.id;
    refreshMediaPermissionState();
  });

  socket.on('user-joined', (data) => {
    console.log('👤 User joined:', data.participant.name);
    showToast(`${data.participant.name} joined • Total: ${data.totalParticipants}`);
    renderParticipants();

    // Auto-start meeting timer when first participant joins
    if (!meetingTimer) {
      startMeetingTimer();
      console.log('⏱️ Meeting timer auto-started via user-joined event');
    }
  });

  socket.on('user-left', (data) => {
    console.log('👋 User left:', data.userId);
    showToast(`User left • Total participants: ${data.totalParticipants}`);
    renderParticipants();

    // Stop timer when room becomes empty
    if (data.totalParticipants === 0) {
      stopMeetingTimer();
      console.log('⏱️ Meeting timer stopped because room is empty');
    }
  });

  socket.on('participant-updated', (data) => {
    console.log('Updated participant:', data.userId);
    renderParticipants();
  });

  socket.on('receive-message', (data) => {
    chatHistory.push(data);
    renderChat();
    showToast(`💬 ${data.userName}: ${data.message.substring(0, 30)}...`);
  });

  socket.on('remote-draw', (data) => {
    if (canvas && ctx) {
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.brushSize;
      ctx.beginPath();
      ctx.moveTo(data.fromX, data.fromY);
      ctx.lineTo(data.toX, data.toY);
      ctx.stroke();
    }
  });

  socket.on('whiteboard-cleared', () => {
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  socket.on('screen-share-started', (data) => {
    showToast(`🖥️ Screen sharing started`);
  });

  socket.on('screen-share-stopped', (data) => {
    showToast(`Screen sharing stopped`);
  });

  socket.on('file-shared', (data) => {
    showToast(`📄 ${data.fileName} was shared`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    showToast('Connection lost. Try refreshing the page.');
    stopMeetingTimer();
  });
}

// ===================================
// MEETING TIMER & SESSION STATE
// ===================================

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateMeetingTimerDisplay() {
  const timerEl = document.getElementById('meeting-timer');
  const statusEl = document.getElementById('meeting-status');
  if (timerEl) {
    timerEl.textContent = `Duration: ${formatDuration(meetingElapsedSeconds)}`;
  }
  if (statusEl) {
    const count = participants.length;
    statusEl.textContent = `${count} participant${count === 1 ? '' : 's'} • ${formatDuration(meetingElapsedSeconds)}`;
  }
}

function startMeetingTimer() {
  stopMeetingTimer();
  meetingElapsedSeconds = 0;
  updateMeetingTimerDisplay();

  meetingTimer = setInterval(() => {
    meetingElapsedSeconds += 1;
    updateMeetingTimerDisplay();
  }, 1000);
}

function stopMeetingTimer() {
  if (meetingTimer) {
    clearInterval(meetingTimer);
    meetingTimer = null;
  }
}

// ===================================
// PERMISSIONS & MEDIA SETUP
// ===================================

async function checkCameraPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    return result.state;
  } catch (error) {
    console.log('Permission API not supported, falling back to getUserMedia');
    return 'unknown';
  }
}

async function checkMicrophonePermission() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state;
  } catch (error) {
    console.log('Permission API not supported, falling back to getUserMedia');
    return 'unknown';
  }
}

async function refreshMediaPermissionState() {
  const cameraState = await checkCameraPermission();
  const micState = await checkMicrophonePermission();

  if (cameraState !== 'granted') {
    isVideoOn = false;
    showToast('❌ Camera permission missing or revoked • Camera Off');
  }

  if (micState !== 'granted') {
    isMicOn = false;
    showToast('❌ Microphone permission missing or revoked • Mic Off');
  }

  updateControlButtons();
  renderParticipants();
}

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    console.log('🛠️ Media devices changed, rechecking permissions');
    refreshMediaPermissionState();
  });
}

async function requestCustomMediaPermissions() {
  console.log('🔍 Checking current permission status...');
  
  const cameraState = await checkCameraPermission();
  const micState = await checkMicrophonePermission();
  
  console.log(`📹 Camera permission: ${cameraState}`);
  console.log(`🎤 Microphone permission: ${micState}`);
  
  // Update UI based on permission state
  updatePermissionUI(cameraState, micState);
  
  // If already granted, get the stream
  if (cameraState === 'granted' && micState === 'granted') {
    console.log('✅ Permissions already granted, getting media stream...');
    return await getMediaStream();
  }
  
  // If denied, show custom request UI but allow proceeding
  if (cameraState === 'denied' || micState === 'denied') {
    console.log('❌ Some permissions denied, showing custom request UI but allowing to proceed...');
    showCustomPermissionRequest(true); // true = allow proceeding
    return null;
  }
  
  // If prompt needed, show custom UI first
  console.log('❓ Permissions need to be requested, showing custom UI...');
  showCustomPermissionRequest(false); // false = require permissions first
  return null;
}

function updatePermissionUI(cameraState, micState) {
  const placeholderEl = document.getElementById('camera-placeholder');
  if (!placeholderEl) return;
  
  if (cameraState === 'granted' && micState === 'granted') {
    placeholderEl.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">✅</div>
        <div class="text-sm">Permissions granted</div>
      </div>
    `;
  } else if (cameraState === 'denied' || micState === 'denied') {
    placeholderEl.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">❌</div>
        <div class="text-sm">Access denied</div>
        <div class="text-xs text-zinc-400 mt-1 mb-3">Please allow camera and microphone</div>
        <div class="flex flex-col gap-2">
          <button onclick="requestCustomPermissions()" class="px-4 py-2 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600">
            Try Again
          </button>
        </div>
      </div>
    `;
  } else {
    placeholderEl.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">📹</div>
        <div class="text-sm">Click to enable camera</div>
        <button onclick="requestCustomPermissions()" class="mt-2 px-4 py-2 bg-cyan-500 text-white text-xs rounded-lg hover:bg-cyan-600">
          Enable Camera
        </button>
      </div>
    `;
  }
}

function showCustomPermissionRequest(allowProceed = false) {
  const placeholderEl = document.getElementById('camera-placeholder');
  if (placeholderEl) {
    placeholderEl.style.display = 'flex';
    let buttonsHtml = `
      <button onclick="requestBrowserPermissions()" class="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-500 hover:to-blue-600 transition-all">
        Allow Access
      </button>
    `;
    
    placeholderEl.innerHTML = `
      <div class="text-center">
        <div class="text-2xl mb-2">📹</div>
        <div class="text-sm mb-2">Camera & Microphone Access</div>
        <div class="text-xs text-zinc-400 mb-4">Required for video meetings</div>
        <div class="flex flex-col gap-2">
          ${buttonsHtml}
        </div>
      </div>
    `;
  }
}

function updateControlButtons() {
  const micBtn = document.getElementById('mic-btn');
  const videoBtn = document.getElementById('video-btn');
  
  if (micBtn) {
    micBtn.textContent = isMicOn ? '🎤' : '🔇';
    micBtn.classList.toggle('opacity-50', !localStream || !localStream.getAudioTracks().length);
  }
  
  if (videoBtn) {
    videoBtn.textContent = isVideoOn ? '📹' : '📴';
    videoBtn.classList.toggle('opacity-50', !localStream || !localStream.getVideoTracks().length);
  }
}

async function requestBrowserPermissions() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    localStream = stream;
    const videoEl = document.getElementById('local-video');
    const previewEl = document.getElementById('camera-preview');
    const placeholderEl = document.getElementById('camera-placeholder');
    
    if (videoEl) {
      videoEl.srcObject = stream;
    }
    
    if (previewEl) {
      previewEl.srcObject = stream;
      previewEl.style.display = 'block';
    }
    
    if (placeholderEl) {
      placeholderEl.style.display = 'none';
    }

    isVideoOn = true;
    isMicOn = true;
    updateControlButtons();

    console.log('✅ Custom permissions granted! Microphone and camera active.');
    showToast('✅ Camera & microphone enabled');
    
    return stream;
  } catch (error) {
    console.error('❌ Custom permission request failed:', error.name);
    isVideoOn = false;
    isMicOn = false;
    updateControlButtons();
    
    const placeholderEl = document.getElementById('camera-placeholder');
    if (placeholderEl) {
      if (error.name === 'NotAllowedError') {
        placeholderEl.innerHTML = `
          <div class="text-center">
            <div class="text-2xl mb-2">❌</div>
            <div class="text-sm">Access denied</div>
            <div class="text-xs text-zinc-400 mt-1">Please allow camera access in your browser settings</div>
            <button onclick="requestCustomPermissions()" class="mt-3 px-4 py-2 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">
              Try Again
            </button>
          </div>
        `;
        showToast('❌ Camera access denied • Check browser settings');
      } else if (error.name === 'NotFoundError') {
        placeholderEl.innerHTML = `
          <div class="text-center">
            <div class="text-2xl mb-2">📷</div>
            <div class="text-sm">No camera found</div>
            <div class="text-xs text-zinc-400 mt-1">Please connect a camera and try again</div>
          </div>
        `;
        showToast('❌ No camera or microphone found');
      } else {
        placeholderEl.innerHTML = `
          <div class="text-center">
            <div class="text-2xl mb-2">⚠️</div>
            <div class="text-sm">Error accessing camera</div>
            <div class="text-xs text-zinc-400 mt-1">${error.message}</div>
          </div>
        `;
        showToast('❌ Error accessing media devices');
      }
    }
  }
}

async function getMediaStream() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
  });

  localStream = stream;
  const videoEl = document.getElementById('local-video');
  const previewEl = document.getElementById('camera-preview');
  const placeholderEl = document.getElementById('camera-placeholder');
  
  if (videoEl) {
    videoEl.srcObject = stream;
  }
  
  if (previewEl) {
    previewEl.srcObject = stream;
    previewEl.style.display = 'block';
  }
  
  if (placeholderEl) {
    placeholderEl.style.display = 'none';
  }

  return stream;
}

// Legacy function for backward compatibility
async function requestMediaPermissions() {
  return await requestCustomMediaPermissions();
}

// ===================================
// PARTICIPANT MANAGEMENT
// ===================================

function renderParticipants() {
  const container = document.getElementById('participants-list');
  if (!container) return;

  container.innerHTML = participants.map(p => `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-2xl">
      <div class="w-9 h-9 bg-gradient-to-br from-purple-400 to-pink-400 text-white text-sm font-bold rounded-2xl flex items-center justify-center">${p.avatar}</div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span class="font-medium">${p.name}</span>
          ${p.you ? `<span class="text-xs bg-cyan-400 text-black px-2 rounded-2xl">you</span>` : ''}
          ${p.name.toLowerCase() === 'subrahmanyam' ? `<span class="text-xs bg-green-400 text-black px-2 rounded-2xl">host</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-3 text-xl">
        ${p.muted ? '🔇' : '🎤'}
        ${p.videoOn ? '📹' : '🚫'}
      </div>
    </div>
  `).join('');
}

// ===================================
// VIDEO GRID
// ===================================

function renderVideoGrid() {
  const grid = document.getElementById('video-grid');
  if (!grid) return;

  grid.innerHTML = `
    <!-- Local video (real WebRTC) -->
    <div class="video-container">
      <video id="local-video" autoplay playsinline muted class="w-full h-full object-cover"></video>
      <div class="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-3 py-1 rounded-2xl flex items-center gap-2">
        <span>You • ${currentUser.name}</span>
        ${isVideoOn ? '' : '<span class="text-red-400">📴</span>'}
      </div>
    </div>
    
    <!-- Fake participant 1 -->
    <div class="video-container relative">
      <div class="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl mb-3">SC</div>
          <p class="font-medium">Sarah Chen</p>
          <div class="text-xs text-emerald-400 flex items-center justify-center gap-1 mt-1">
            <span class="live-dot w-2 h-2 bg-emerald-400 rounded-full"></span> LIVE
          </div>
        </div>
      </div>
      <div class="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-3 py-1 rounded-2xl">Screen shared</div>
    </div>
    
    <!-- Fake participant 2 -->
    <div class="video-container relative bg-zinc-950 flex items-center justify-center">
      <div class="text-center">
        <div class="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-red-400 rounded-3xl flex items-center justify-center text-5xl mb-4">MR</div>
        <p class="font-medium">Marcus Rivera</p>
        <p class="text-xs text-zinc-400">Camera off</p>
      </div>
    </div>
    
    <!-- Fake participant 3 -->
    <div class="video-container relative">
      <div class="absolute inset-0 bg-gradient-to-br from-pink-400/20 to-cyan-400/20 flex items-center justify-center">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl mb-3">PS</div>
          <p class="font-medium">Priya Sharma</p>
          <div class="text-xs text-emerald-400 flex items-center justify-center gap-1 mt-1">
            <span class="live-dot w-2 h-2 bg-emerald-400 rounded-full"></span> LIVE
          </div>
        </div>
      </div>
    </div>
  `;

  // Update control buttons state
  updateControlButtons();
}

// ===================================
// CONTROLS
// ===================================

function toggleMic() {
  // If no audio stream and trying to turn on, request permissions
  if (!isMicOn && (!localStream || !localStream.getAudioTracks().length)) {
    console.log('🎤 No microphone access, requesting permissions...');
    requestBrowserPermissions().then(() => {
      if (localStream && localStream.getAudioTracks().length > 0) {
        isMicOn = true;
        updateControlButtons();
        // Enable the track
        localStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        // Emit to backend
        if (socket) {
          socket.emit('toggle-mic', {
            roomId: currentRoomId,
            userId: currentUser.id,
            muted: false
          });
        }
        showToast('🎤 Microphone turned ON');
      }
    }).catch(() => {
      showToast('❌ Microphone access denied');
    });
    return;
  }
  
  isMicOn = !isMicOn;
  const btn = document.getElementById('mic-btn');
  btn.textContent = isMicOn ? '🎤' : '🔇';
  
  // Stop/resume audio tracks
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = isMicOn;
    });
  }

  // Emit to backend
  if (socket) {
    socket.emit('toggle-mic', {
      roomId: currentRoomId,
      userId: currentUser.id,
      muted: !isMicOn
    });
  }

  showToast(isMicOn ? '🎤 Microphone turned ON' : '🔇 Microphone muted');
  updateControlButtons();
}

function toggleVideo() {
  // If no video stream and trying to turn on, request permissions
  if (!isVideoOn && (!localStream || !localStream.getVideoTracks().length)) {
    console.log('📹 No video access, requesting permissions...');
    requestBrowserPermissions().then(() => {
      if (localStream && localStream.getVideoTracks().length > 0) {
        isVideoOn = true;
        updateControlButtons();
        // Enable the track
        localStream.getVideoTracks().forEach(track => {
          track.enabled = true;
        });
        // Emit to backend
        if (socket) {
          socket.emit('toggle-video', {
            roomId: currentRoomId,
            userId: currentUser.id,
            videoOn: true
          });
        }
        showToast('📹 Camera turned ON');
        renderVideoGrid();
      }
    }).catch(() => {
      showToast('❌ Camera access denied');
    });
    return;
  }
  
  isVideoOn = !isVideoOn;
  const btn = document.getElementById('video-btn');
  btn.textContent = isVideoOn ? '📹' : '📴';
  
  // Stop/resume video tracks
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = isVideoOn;
    });
  }

  // Emit to backend
  if (socket) {
    socket.emit('toggle-video', {
      roomId: currentRoomId,
      userId: currentUser.id,
      videoOn: isVideoOn
    });
  }

  showToast(isVideoOn ? '📹 Camera turned ON' : '📴 Camera turned OFF');
  renderVideoGrid();
  updateControlButtons();
}

function startScreenShare() {
  isScreenSharing = !isScreenSharing;
  const screenBtn = document.querySelector('[onclick="startScreenShare()"]');

  if (isScreenSharing) {
    screenBtn && (screenBtn.textContent = '🛑');

    navigator.mediaDevices.getDisplayMedia({ video: true })
      .then(stream => {
        screenStream = stream;

        // Show local screen preview while sharing
        const videoEl = document.getElementById('local-video');
        if (videoEl) {
          videoEl.srcObject = screenStream;
        }

        // Keep the camera video preview for quick restore
        if (localStream && localStream.getVideoTracks().length === 0) {
          requestBrowserPermissions();
        }

        // track end will restore camera
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.onended = () => {
            isScreenSharing = false;
            screenBtn && (screenBtn.textContent = '🖥️');
            restoreCameraStream();
            socket.emit('stop-screen-share', { roomId: currentRoomId, userId: currentUser.id });
            showToast('Screen sharing stopped');
          };
        }

        socket.emit('start-screen-share', { roomId: currentRoomId, userId: currentUser.id });
        showToast('✅ Screen sharing started');
      })
      .catch(err => {
        isScreenSharing = false;
        screenBtn && (screenBtn.textContent = '🖥️');
        showToast('❌ Screen share cancelled');
      });
  } else {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }

    screenBtn && (screenBtn.textContent = '🖥️');
    restoreCameraStream();
    socket.emit('stop-screen-share', { roomId: currentRoomId, userId: currentUser.id });
    showToast('Screen sharing stopped');
  }
}

function restoreCameraStream() {
  if (!localStream || !localStream.getVideoTracks().length) {
    requestBrowserPermissions().then(() => {
      const videoEl = document.getElementById('local-video');
      if (videoEl && localStream) {
        videoEl.srcObject = localStream;
      }
      renderVideoGrid();
    }).catch(() => {
      const videoEl = document.getElementById('local-video');
      if (videoEl) {
        videoEl.srcObject = null;
      }
      showToast('⚠️ Camera could not be restored after screen share');
    });
  } else {
    const videoEl = document.getElementById('local-video');
    if (videoEl) {
      videoEl.srcObject = localStream;
    }
    renderVideoGrid();
  }
}

// ===================================
// WHITEBOARD
// ===================================

function initWhiteboard() {
  canvas = document.getElementById('whiteboard');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth - 48;
    canvas.height = canvas.parentElement.clientHeight - 120;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 300);

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
  if (!isDrawing || !ctx) return;
  
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = brushSize;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  
  // Emit drawing to other users
  if (socket) {
    socket.emit('draw', {
      roomId: currentRoomId,
      fromX: lastX,
      fromY: lastY,
      toX: e.offsetX,
      toY: e.offsetY,
      color: currentColor,
      brushSize: brushSize
    });
  }

  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  isDrawing = true;
  lastX = touch.clientX - rect.left;
  lastY = touch.clientY - rect.top;
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!isDrawing || !ctx) return;
  
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  ctx.strokeStyle = currentColor;
  ctx.lineWidth = brushSize;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  if (socket) {
    socket.emit('draw', {
      roomId: currentRoomId,
      fromX: lastX,
      fromY: lastY,
      toX: x,
      toY: y,
      color: currentColor,
      brushSize: brushSize
    });
  }

  lastX = x;
  lastY = y;
}

function setTool(tool) {
  currentTool = tool;
  document.getElementById('tool-pen').classList.toggle('text-cyan-500', tool === 'pen');
  document.getElementById('tool-eraser').classList.toggle('text-cyan-500', tool === 'eraser');

  if (tool === 'eraser') {
    currentColor = '#f8f9fa';
  } else {
    currentColor = document.getElementById('color-picker').value;
  }
}

function changeBrushSize(size) {
  brushSize = size;
}

function clearWhiteboard() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear-whiteboard', { roomId: currentRoomId });
    showToast('Whiteboard cleared • synced to everyone');
  }
}

function downloadWhiteboard() {
  const link = document.createElement('a');
  link.download = 'whiteboard-luminameet.png';
  link.href = canvas.toDataURL();
  link.click();
  showToast('Whiteboard downloaded');
}

// ===================================
// FILES
// ===================================

function triggerFileUpload() {
  document.getElementById('file-input').click();
}

function handleFiles(e) {
  const files = e.target.files;
  for (let file of files) {
    sharedFiles.unshift({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
      time: 'just now'
    });

    // Emit to backend
    socket.emit('share-file', {
      roomId: currentRoomId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
  }
  renderFiles();
  showToast(`${files.length} file(s) uploaded & shared instantly`);
}

function renderFiles() {
  const container = document.getElementById('files-list');
  if (!container) return;

  container.innerHTML = sharedFiles.map(f => `
    <div class="flex justify-between items-center bg-zinc-800 hover:bg-zinc-700 px-6 py-4 rounded-3xl">
      <div class="flex items-center gap-4">
        <div class="text-4xl">📄</div>
        <div>
          <p class="font-medium">${f.name}</p>
          <p class="text-xs text-zinc-400">${f.size} • ${f.time}</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button onclick="fakeDownload('${f.name}')" class="text-cyan-400 text-sm font-medium">Download</button>
        <button class="text-emerald-400 text-xs px-4 py-1 bg-emerald-400/10 rounded-3xl">Shared</button>
      </div>
    </div>
  `).join('');
}

function fakeDownload(name) {
  showToast(`Downloading ${name}... (demo)`);
}

// ===================================
// CHAT
// ===================================

function renderChat() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.innerHTML = chatHistory.map(msg => `
    <div class="flex gap-3">
      <div class="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl text-xs flex items-center justify-center">${msg.name.substring(0, 2)}</div>
      <div class="flex-1">
        <div class="flex justify-between">
          <span class="font-semibold">${msg.name}</span>
          <span class="text-zinc-400 text-xs">${msg.time}</span>
        </div>
        <p class="text-zinc-300">${msg.message}</p>
      </div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const msgData = {
    roomId: currentRoomId,
    userName: currentUser.name,
    message: message,
    timestamp: new Date().toLocaleTimeString()
  };

  socket.emit('send-message', msgData);

  chatHistory.push({
    name: currentUser.name,
    message: message,
    time: 'just now'
  });

  renderChat();
  input.value = '';
}

function toggleChat() {
  const panel = document.getElementById('right-panel');
  panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}

// ===================================
// TABS
// ===================================

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#view-0, #view-1, #view-2').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + tab).classList.remove('hidden');

  document.querySelectorAll('button[id^="tab-"]').forEach(el => el.classList.remove('active-tab'));
  document.getElementById('tab-' + tab).classList.add('active-tab');

  if (tab === 1 && !canvas) initWhiteboard();
}

// ===================================
// AUTHENTICATION
// ===================================

function fakeAuth(provider) {
  showToast(`Signed in with ${provider} • Secure JWT token issued`);
  setTimeout(() => joinMeeting(), 600);
}

function joinMeeting() {
  // Enforce host identity
  currentUser.name = 'subrahmanyam';
  currentUser.avatar = 'SU';
  currentRoomId = document.getElementById('room-id').value;

  document.getElementById('user-name-display').textContent = currentUser.name;
  document.getElementById('user-avatar').textContent = currentUser.avatar;
  document.getElementById('room-name').textContent = currentRoomId + ' • Real-time Collaboration';
  const hostIndicator = document.getElementById('host-name');
  if (hostIndicator) hostIndicator.textContent = 'Host: subrahmanyam';

  // Hide auth modal
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  // Connect to backend
  connectToBackend();

  // Emit join event after connected
  setTimeout(() => {
    socket.emit('join-meeting', {
      roomId: currentRoomId,
      userName: currentUser.name,
      userId: currentUser.id
    });
  }, 500);

  // Initialize everything
  renderParticipants();
  renderVideoGrid();
  renderFiles();
  renderChat();
  updateControlButtons();
  startMeetingTimer();

  showToast('🎉 Welcome to the encrypted meeting! Backend connected ✅');
  console.log('%c🚀 Frontend connected to backend | WebRTC + Socket.io + Express ready', 'background:#00d4ff;color:#000;padding:2px 6px;border-radius:4px;font-weight:700');
}

function leaveMeeting() {
  if (confirm('Leave the meeting?')) {
    stopMeetingTimer();
    socket.emit('leave-meeting', {
      roomId: currentRoomId,
      userId: currentUser.id
    });
    location.reload();
  }
}

function inviteUser() {
  const name = prompt('Invite teammate by email or name:');
  if (name) {
    participants.push({
      id: Date.now(),
      name: name,
      avatar: name.substring(0, 2).toUpperCase(),
      you: false,
      muted: false,
      videoOn: true
    });
    renderParticipants();
    showToast(`${name} invited • join link copied to clipboard`);
  }
}

function toggleMenu() {
  showToast('🔐 Secure settings • Backend: Node.js + Socket.io');
}

function generateRoomID() {
  const id = 'LUM-' + Math.floor(10000 + Math.random() * 90000);
  document.getElementById('room-id').value = id;
  showToast('New room generated • Shareable link ready');
}

function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').innerHTML = text;
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.metaKey && e.key === "k") {
    e.preventDefault();
    toggleChat();
  }
});

console.log('%c✅ Frontend loaded! Ready to connect to backend.', 'color:#00d4ff; font-size:13px');

// Request media permissions on page load
requestMediaPermissions();
