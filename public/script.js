const addToConsole = (log) => {
  const consl = document.getElementById("console");
  consl.innerHTML += log + "\n";
};

let targetId = null;
const peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});
let localStream;

let ws;
let isConnected = false;
let reconnectInterval;
const connectWebSocket = () => {
  ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    addToConsole(
      `✅ Communication with server established (through a websocket at /ws)`,
    );
    isConnected = true;
    console.log("clearing reconnect interval");
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "welcome") {
      const myId = msg.id;
      document.querySelectorAll(".myId").forEach((el) => {
        el.innerHTML = `${myId}`;
      });
      addToConsole(`ℹ️ The server gave you an ID of <b>${myId}</b>`);
      return;
    }
    if (msg.type === "offer") {
      targetId = msg.from;
      await peer.setRemoteDescription(new RTCSessionDescription(msg.payload));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      addToConsole(
        `ℹ️ Received offer from ${targetId}\n   Now sending answer back`,
      );
      ws.send(
        JSON.stringify({
          type: "answer",
          target: targetId,
          payload: answer,
        }),
      );
    }
    if (msg.type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(msg.payload));
      addToConsole(`ℹ️ Received answer`);
    }
    if (msg.type === "candidate") {
      peer.addIceCandidate(new RTCIceCandidate(msg.payload));
      addToConsole(`ℹ️ Received ICE candidate`);
    }
  };

  ws.onclose = () => {
    console.log("websocket closed");
    addToConsole(
      `❌ Communication with server has been stopped (websocket closed)`,
    );
    isConnected = false;
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("websocket error", error);
    addToConsole(
      `❌ Communication with server has been stopped (websocket error)`,
    );
    isConnected = false;
  };
};

async function populateDeviceList() {
  try {
    await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoSelect = document.getElementById("videoSource");
    const audioSelect = document.getElementById("audioSource");

    videoSelect.innerHTML = "";
    audioSelect.innerHTML = "";

    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `${device.kind} ${videoSelect.length + 1}`;

      if (device.kind === "videoinput") {
        videoSelect.appendChild(option);
      } else if (device.kind === "audioinput") {
        audioSelect.appendChild(option);
      }
    });
  } catch (err) {
    addToConsole(`‼️ Video/Audio permissions were denied, enable them please`);
  }
}

async function prepareToCall() {
  addToConsole(`ℹ️ Adding selected video and audio to my peer connection`);

  // first remove all the previous video and audio sources
  peer.getSenders().forEach((sender) => {
    peer.removeTrack(sender);
  });

  const videoSource = document.getElementById("videoSource").value;
  const audioSource = document.getElementById("audioSource").value;
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: videoSource ? { exact: videoSource } : undefined },
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
  });

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  peer.onicecandidate = (event) => {
    addToConsole(`ℹ️ peer.onicecandidate`);
    if (event.candidate && targetId) {
      document.querySelectorAll(".theirId").forEach((el) => {
        el.innerHTML = `${targetId}`;
      });
      console.log(targetId);
      ws.send(
        JSON.stringify({
          type: "candidate",
          target: targetId,
          payload: event.candidate,
        }),
      );
    }
  };

  peer.ontrack = (event) => {
    addToConsole(`ℹ️ peer.ontrack`);
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
  };

  const localVideo = document.getElementById("localVideo");
  localVideo.srcObject = localStream;
}

async function startCall() {
  targetId = prompt("Enter ID of the other client to call:");
  if (!!targetId) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    addToConsole(
      `ℹ️ Sending offer to ${targetId} through the server (via websocket)`,
    );
    ws.send(
      JSON.stringify({ type: "offer", target: targetId, payload: offer }),
    );
  }
}

const attemptReconnect = () => {
  if (reconnectInterval) {
    console.log("already have a reconnect interval", reconnectInterval);
    return;
  } else {
    console.log("starting reconnect interval");
    reconnectInterval = setInterval(() => {
      console.log("attempting reconnect");
      addToConsole(
        `ℹ️ Attempting to reconnect to server again (websocket at /ws, every 3s)`,
      );
      connectWebSocket();
    }, 3000);
  }
};

connectWebSocket();

document.getElementById("startCall").addEventListener("click", () => {
  startCall();
});
document.getElementById("videoSource").addEventListener("input", () => {
  prepareToCall();
});
document.getElementById("audioSource").addEventListener("input", () => {
  prepareToCall();
});
document.getElementById("audioSource").addEventListener("input", () => {
  prepareToCall();
});
document.getElementById("enableVideoAudio").addEventListener("click", (e) => {
  populateDeviceList();
  prepareToCall();
  e.target.remove();
});
