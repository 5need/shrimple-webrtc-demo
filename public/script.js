import { connectWebSocket } from "./websocketstuff.js";

const selectVideoSourceInput = document.getElementById("videoSource");
const selectAudioSourceInput = document.getElementById("audioSource");

export function pseudoConsoleDotLog(log) {
  const pseudoConsole = document.getElementById("console");
  pseudoConsole.innerHTML += log + "\n";
}

let peerId = null;
const myRTCPeerConnection = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

async function populateMediaDeviceList() {
  try {
    await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const devices = await navigator.mediaDevices.enumerateDevices();

    selectVideoSourceInput.innerHTML = "";
    selectAudioSourceInput.innerHTML = "";

    devices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text =
        device.label || `${device.kind} ${selectVideoSourceInput.length + 1}`;

      if (device.kind === "videoinput") {
        selectVideoSourceInput.appendChild(option);
      } else if (device.kind === "audioinput") {
        selectAudioSourceInput.appendChild(option);
      }
    });
  } catch (err) {
    pseudoConsoleDotLog(
      `‼️ Video/Audio permissions were denied, enable them please`,
    );
  }
}

async function prepareToCall() {
  // first remove all the previous video and audio sources from myRTCPeerConnection
  myRTCPeerConnection.getSenders().forEach((sender) => {
    myRTCPeerConnection.removeTrack(sender);
  });

  const videoSource = selectVideoSourceInput.value;
  const audioSource = selectAudioSourceInput.value;

  // set localStream to our selected video and audio source (or default ones)
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: videoSource ? { exact: videoSource } : undefined },
    audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
  });

  localStream.getTracks().forEach((track) => {
    myRTCPeerConnection.addTrack(track, localStream);
    pseudoConsoleDotLog(
      `📹 Adding <em>${track.label || track.kind}</em> to <mark>myRTCPeerConnection</mark>`,
    );
  });

  myRTCPeerConnection.onicecandidate = (event) => {
    // pseudoConsoleDotLog(`ℹ️ myRTCPeerConnection.onicecandidate`);
    if (event.candidate && peerId) {
      document.querySelectorAll(".peerId").forEach((el) => {
        el.innerHTML = `${peerId}`;
      });
      ws.send(
        JSON.stringify({
          type: "candidate",
          target: peerId,
          payload: event.candidate,
        }),
      );
    }
  };

  myRTCPeerConnection.oniceconnectionstatechange = () => {
    if (myRTCPeerConnection.iceConnectionState === "connected") {
      pseudoConsoleDotLog(
        `ℹ️ ICE connection established on <mark>myRTCPeerConnection</mark>`,
      );
    }
  };

  myRTCPeerConnection.ontrack = (event) => {
    // pseudoConsoleDotLog(`ℹ️ myRTCPeerConnection.ontrack`);
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
  };

  const localVideo = document.getElementById("localVideo");
  localVideo.srcObject = localStream;

  await startCall(peerId);
}

async function startCall(newPeerId) {
  if (!!newPeerId) {
    const offer = await myRTCPeerConnection.createOffer();
    await myRTCPeerConnection.setLocalDescription(offer);
    pseudoConsoleDotLog(
      `ℹ️ Sending offer to ${peerId} through the server (via websocket)`,
    );
    ws.send(JSON.stringify({ type: "offer", target: peerId, payload: offer }));
  }
}

const ws = connectWebSocket();

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "welcome") {
    const myId = msg.id;
    document.querySelectorAll(".myId").forEach((el) => {
      el.innerHTML = `${myId}`;
    });
    pseudoConsoleDotLog(`ℹ️ The server gave you an ID of <b>${myId}</b>`);
    return;
  }
  if (msg.type === "offer") {
    peerId = msg.from;
    await myRTCPeerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.payload),
    );
    const answer = await myRTCPeerConnection.createAnswer();
    await myRTCPeerConnection.setLocalDescription(answer);
    pseudoConsoleDotLog(
      `ℹ️ Received offer from ${peerId.slice(0, 8) + "…"} Now I'm sending an answer back`,
    );
    ws.send(
      JSON.stringify({
        type: "answer",
        target: peerId,
        payload: answer,
      }),
    );
  }
  if (msg.type === "answer") {
    await myRTCPeerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.payload),
    );
    pseudoConsoleDotLog(`ℹ️ Received answer`);
  }
  if (msg.type === "candidate") {
    myRTCPeerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
    // pseudoConsoleDotLog(`ℹ️ Received ICE candidate`);
  }
};

document.getElementById("startCall").addEventListener("click", () => {
  peerId = prompt("Enter ID of the other client to call:");
  startCall(peerId);
});
selectVideoSourceInput.addEventListener("input", () => {
  prepareToCall();
});
selectAudioSourceInput.addEventListener("input", () => {
  prepareToCall();
});
document
  .getElementById("enableVideoAndAudioButton")
  .addEventListener("click", (e) => {
    populateMediaDeviceList();
    prepareToCall();
    e.target.remove();
  });

function copyElementTextToClipboard(e) {
  const range = document.createRange();
  range.selectNodeContents(e.target);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  navigator.clipboard.writeText(sel.toString());
  setTimeout(() => {
    sel.removeAllRanges(); // Deselect after 200ms
  }, 150);
}

document.querySelectorAll(".myId").forEach((el) => {
  el.addEventListener("click", copyElementTextToClipboard);
});
document.querySelectorAll(".peerId").forEach((el) => {
  el.addEventListener("click", copyElementTextToClipboard);
});
