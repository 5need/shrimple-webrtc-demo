import { createWebSocket } from "./websocketstuff.js";

const selectVideoSourceInput = document.getElementById("videoSource");
const selectAudioSourceInput = document.getElementById("audioSource");

// Just some stuff to make the pseudo-console work
const pseudoConsole = document.getElementById("console");
export function pseudoConsoleDotLog(log) {
  const isScrolledToBottom =
    pseudoConsole.scrollHeight - pseudoConsole.scrollTop <=
    pseudoConsole.clientHeight + 3;
  pseudoConsole.innerHTML += log + "\n";
  if (isScrolledToBottom) {
    pseudoConsole.scrollTop = pseudoConsole.scrollHeight;
  }
}

let otherCallerId = null;
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
    if (event.candidate && otherCallerId) {
      document.querySelectorAll(".otherCallerId").forEach((el) => {
        el.innerHTML = `${otherCallerId}`;
      });
      ws.send(
        JSON.stringify({
          type: "candidate",
          target: otherCallerId,
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

  await startCall(otherCallerId);
}

async function startCall(newOtherCallerId) {
  if (!!newOtherCallerId) {
    otherCallerId = newOtherCallerId;
    const offer = await myRTCPeerConnection.createOffer();
    await myRTCPeerConnection.setLocalDescription(offer);
    pseudoConsoleDotLog(
      `ℹ️ Sending offer to ${newOtherCallerId.slice(0, 8) + "…"} through the server (via websocket)`,
    );
    ws.send(
      JSON.stringify({
        type: "offer",
        target: newOtherCallerId,
        payload: offer,
      }),
    );
  }
}

const ws = createWebSocket();

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  // received a welcome message, the server is giving you myCallerId
  if (msg.type === "welcome") {
    const myCallerId = msg.id;
    document.querySelectorAll(".myCallerId").forEach((el) => {
      el.innerHTML = `${myCallerId}`;
    });
    pseudoConsoleDotLog(`ℹ️ The server gave you an ID of <b>${myCallerId}</b>`);
    return;
  }

  // received an offer from the other caller through the server
  if (msg.type === "offer") {
    otherCallerId = msg.from;
    pseudoConsoleDotLog(
      `ℹ️ Received offer from ${otherCallerId.slice(0, 8) + "…"} Now I'll send an answer back`,
    );
    await myRTCPeerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.payload),
    );
    const answer = await myRTCPeerConnection.createAnswer();
    await myRTCPeerConnection.setLocalDescription(answer);
    ws.send(
      JSON.stringify({
        type: "answer",
        target: otherCallerId,
        payload: answer,
      }),
    );
  }

  // received an answer from the other caller through the server
  if (msg.type === "answer") {
    await myRTCPeerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.payload),
    );
    pseudoConsoleDotLog(`ℹ️ Received answer`);
  }

  // received an ICE candidate from the other caller through the server
  if (msg.type === "candidate") {
    myRTCPeerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
  }
};

document.getElementById("startCall").addEventListener("submit", (e) => {
  const i = e.target.querySelector("input");
  console.log(i.value);
  startCall(i.value);
  e.preventDefault();
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

document.querySelectorAll(".myCallerId").forEach((el) => {
  el.addEventListener("click", copyElementTextToClipboard);
});
document.querySelectorAll(".otherCallerId").forEach((el) => {
  el.addEventListener("click", copyElementTextToClipboard);
});
