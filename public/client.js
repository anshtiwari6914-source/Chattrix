// public/client.js
const socket = io();
const startBtn = document.getElementById("startBtn");
const skipBtn = document.getElementById("skipBtn");
const leaveBtn = document.getElementById("leaveBtn");
const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const chatWindow = document.getElementById("chatWindow");
const chatMsg = document.getElementById("chatMsg");
const sendBtn = document.getElementById("sendBtn");
const toggleCamBtn = document.getElementById("toggleCamBtn");
const toggleMicBtn = document.getElementById("toggleMicBtn");
const onlineCount = document.getElementById("onlineCount");


let localStream;
let pc; // RTCPeerConnection
let currentPartner = null;
let roomId = null;
// Prevent multiple tabs
if (localStorage.getItem("app-opened") === "true") {
  alert("This app is already open in another tab.");
  // Try to close new tab (may not work in all browsers)
  window.close();
  // Fallback: redirect to a safe page
  window.location.href = "about:blank";
}

// Mark this tab as opened
localStorage.setItem("app-opened", "true");

// When tab closes or reloads, remove the flag
window.addEventListener("beforeunload", () => {
  localStorage.removeItem("app-opened");
});

// Basic STUN servers. For production add a TURN server.
const pcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };


async function startLocal() {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (e) {
      alert("Could not access camera/mic: " + e.message);
      throw e;
    }
  }
}


function appendChat(msg, self = false) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.margin = "8px 0";
  wrap.style.alignItems = self ? "flex-end" : "flex-start";

  const title = document.createElement("div");
  title.textContent = self ? "You" : "Stranger";
  title.style.fontSize = "12px";
  title.style.marginBottom = "2px";
  title.style.color = self ? "#0284c7" : "#92400e";
  title.style.fontWeight = "600";

  const bubble = document.createElement("div");
  bubble.textContent = msg;
  bubble.style.padding = "10px 14px";
  bubble.style.borderRadius = "12px";
  bubble.style.maxWidth = "65%";
  bubble.style.background = self ? "#d1f0ff" : "#ffe8cc";
  bubble.style.color = "#111";
  bubble.style.fontSize = "15px";
  bubble.style.lineHeight = "1.3";
  bubble.style.boxShadow = "0 2px 5px rgba(0,0,0,0.08)";

  wrap.appendChild(title);
  wrap.appendChild(bubble);

  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}


sendBtn.addEventListener("click", () => {
  const text = chatMsg.value.trim();
  if (!text || !currentPartner) return;

  appendChat(text, true);
  socket.emit("chat-message", text);
  chatMsg.value = "";
});


chatMsg.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});


socket.on("online-count", (count) => {
  onlineCount.textContent = "People Online: " + count;
});

socket.on("chat-message", ({ msg }) => {
  appendChat(msg, false); // partner message
});


function setStatus(s) {
  statusEl.textContent = s;
}

function createPeerConnection() {
  pc = new RTCPeerConnection(pcConfig);

  // add local tracks
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.ontrack = (ev) => {
    // attach first stream
    remoteVideo.srcObject = ev.streams[0];
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      socket.emit("signal", { type: "ice", candidate: ev.candidate });
    }
  };
}

// Socket handlers
socket.on("connect", () => {
  setStatus("Connected to server. Click Start to join queue.");
});

socket.on("waiting", () => {
  setStatus("Waiting for a partner...");
  skipBtn.disabled = false;
  leaveBtn.disabled = false;
});

socket.on("paired", async ({ room, partner }) => {
  chatWindow.innerHTML = "";
  roomId = room;
  currentPartner = partner;
  setStatus("Paired! Establishing connection...");
  skipBtn.disabled = false;
  leaveBtn.disabled = false;

  // Prepare local media & peer connection
  await startLocal();
  createPeerConnection();

  // Create offer (we can decide that the socket with lexicographically smaller id makes offer to avoid collisions)
  const shouldOffer = socket.id < partner;
  if (shouldOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { type: "offer", sdp: offer });
  }
});

socket.on("partner-left", () => {
  // Partner left unexpectedly; keep local and go back to waiting state
  setStatus("Partner disconnected. Waiting for a new partner...");
  currentPartner = null;
  roomId = null;
  remoteVideo.srcObject = null;
});

// signaling messages from server forwarded from partner
socket.on("signal", async ({ from, data }) => {
  if (!pc && data.type !== "offer") {
    // if we don't have a PC and we receive an offer, create one
    await startLocal();
    createPeerConnection();
  }

  if (data.type === "offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("signal", { type: "answer", sdp: answer });
  } else if (data.type === "answer") {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } else if (data.type === "ice") {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.warn("Failed to add ICE candidate", e);
    }
  }
});

// Buttons
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  await startLocal();
  socket.emit("join-queue");
  setStatus("Joining queue...");
  skipBtn.disabled = false;
  leaveBtn.disabled = false;
});

skipBtn.addEventListener("click", () => {
  chatWindow.innerHTML = "";

  // skip current partner (or if waiting, re-queue)
  socket.emit("skip");
  // clean up local peer connection and remote video
  if (pc) {
    pc.close();
    pc = null;
    remoteVideo.srcObject = null;
  }
  currentPartner = null;
  roomId = null;
  setStatus("Skipped — looking for a new partner...");
});

leaveBtn.addEventListener("click", () => {
  // simply disconnect socket to leave
  socket.disconnect();
  setStatus("Left. Refresh to reconnect.");
  startBtn.disabled = false;
  skipBtn.disabled = true;
  leaveBtn.disabled = true;
  togglecam()
  
});

let camHidden = false;

toggleCamBtn.addEventListener("click", () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];

  if (!videoTrack) return;

  // Toggle enabled state
  camHidden = !camHidden;
  videoTrack.enabled = !camHidden;

  // Update button text
  toggleCamBtn.textContent = camHidden ? "Show Cam" : "Hide Cam";

  // Optional: visually hide your preview
  localVideo.style.opacity = camHidden ? "0.15" : "1.0";
});

let micMuted = false;

toggleMicBtn.addEventListener("click", () => {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  micMuted = !micMuted;
  audioTrack.enabled = !micMuted;

  toggleMicBtn.textContent = micMuted ? "Unmute" : "Mute";
});

