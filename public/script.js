import { connectWebSocket } from "./websocketstuff.js";

export function addToPseudoConsoleUI(log) {
  const pseudoConsole = document.getElementById("console");
  pseudoConsole.innerHTML += log + "\n";
}

let peerId = null;
const peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});
let localStream;

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
    addToPseudoConsoleUI(
      `‼️ Video/Audio permissions were denied, enable them please`,
    );
  }
}

async function prepareToCall() {
  addToPseudoConsoleUI(
    `ℹ️ Adding selected video and audio to my peer connection`,
  );

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
    addToPseudoConsoleUI(`ℹ️ peer.onicecandidate`);
    if (event.candidate && peerId) {
      document.querySelectorAll(".theirId").forEach((el) => {
        el.innerHTML = `${peerId}`;
      });
      console.log(peerId);
      ws.send(
        JSON.stringify({
          type: "candidate",
          target: peerId,
          payload: event.candidate,
        }),
      );
    }
  };

  peer.ontrack = (event) => {
    addToPseudoConsoleUI(`ℹ️ peer.ontrack`);
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
  };

  const localVideo = document.getElementById("localVideo");
  localVideo.srcObject = localStream;
}

async function startCall() {
  peerId = prompt("Enter ID of the other client to call:");
  if (!!peerId) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    addToPseudoConsoleUI(
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
    addToPseudoConsoleUI(`ℹ️ The server gave you an ID of <b>${myId}</b>`);
    return;
  }
  if (msg.type === "offer") {
    peerId = msg.from;
    await peer.setRemoteDescription(new RTCSessionDescription(msg.payload));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    addToPseudoConsoleUI(
      `ℹ️ Received offer from ${peerId}\n   Now sending answer back`,
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
    await peer.setRemoteDescription(new RTCSessionDescription(msg.payload));
    addToPseudoConsoleUI(`ℹ️ Received answer`);
  }
  if (msg.type === "candidate") {
    peer.addIceCandidate(new RTCIceCandidate(msg.payload));
    addToPseudoConsoleUI(`ℹ️ Received ICE candidate`);
  }
};

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
