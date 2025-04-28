import { createWebSocket } from "./websocketstuff.js";

const selectVideoSourceInput = document.getElementById("videoSource");
const selectAudioSourceInput = document.getElementById("audioSource");
const otherCallerIdForm = document.getElementById("startCall");
const enableVideoAndAudioButton = document.getElementById(
  "enableVideoAndAudioButton",
);

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
  pseudoConsoleDotLog(`▶️ Running <mark>populateMediaDeviceList()</mark>`);
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
    return true;
  } catch (err) {
    pseudoConsoleDotLog(
      `‼️ Video/Audio permissions were denied, enable them please`,
    );
    return false;
  }
}

async function addVideoAndAudioToMyRTCPeerConnection() {
  pseudoConsoleDotLog(
    `▶️ Running <mark>addVideoAndAudioToMyRTCPeerConnection()</mark>`,
  );
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
    pseudoConsoleDotLog(
      `📹 Adding <em>${track.label || track.kind}</em> to <mark>myRTCPeerConnection</mark>`,
    );
    myRTCPeerConnection.addTrack(track, localStream);
  });

  const localVideo = document.getElementById("localVideo");
  localVideo.srcObject = localStream;
}

async function prepareMyRTCPeerConnection() {
  pseudoConsoleDotLog(`▶️ Running <mark>prepareMyRTCPeerConnection()</mark>`);
  await addVideoAndAudioToMyRTCPeerConnection();

  myRTCPeerConnection.onicecandidate = (event) => {
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
        `📞 ICE connection established on <mark>myRTCPeerConnection</mark>`,
      );
    }
  };

  myRTCPeerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
  };

  enableVideoAndAudioButton.remove();
}

async function sendCallOfferToOtherCaller() {
  pseudoConsoleDotLog(
    `ℹ️ Sending offer to ${otherCallerId.slice(0, 8) + "…"} through the server (via websocket)`,
  );
  const offer = await myRTCPeerConnection.createOffer();
  await myRTCPeerConnection.setLocalDescription(offer);
  ws.send(
    JSON.stringify({
      type: "offer",
      target: otherCallerId,
      payload: offer,
    }),
  );
}

const ws = createWebSocket();

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  // received a welcome message, the server is giving you myCallerId
  if (msg.type === "welcome") {
    const myCallerId = msg.id;
    pseudoConsoleDotLog(`ℹ️ The server gave you an ID of <b>${myCallerId}</b>`);
    document.querySelectorAll(".myCallerId").forEach((el) => {
      el.innerHTML = `${myCallerId}`;
    });
    return;
  }

  // received an offer from the other caller through the server
  if (msg.type === "offer") {
    otherCallerId = msg.from;
    pseudoConsoleDotLog(
      `ℹ️ Received offer from ${otherCallerId.slice(0, 8) + "…"} Now I'll send an answer back to them through the server`,
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
    pseudoConsoleDotLog(`ℹ️ Received answer`);
    await myRTCPeerConnection.setRemoteDescription(
      new RTCSessionDescription(msg.payload),
    );
  }

  // received an ICE candidate from the other caller through the server
  if (msg.type === "candidate") {
    myRTCPeerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
  }
};

otherCallerIdForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await prepareMyRTCPeerConnection();

  const otherCallerIdInputValue = e.target.querySelector("input").value;
  if (!!otherCallerIdInputValue) {
    otherCallerId = otherCallerIdInputValue;
    await sendCallOfferToOtherCaller();
  }
});

selectVideoSourceInput.addEventListener("input", async () => {
  await prepareMyRTCPeerConnection();
  if (!!otherCallerId) {
    await sendCallOfferToOtherCaller();
  }
});

selectAudioSourceInput.addEventListener("input", async () => {
  await prepareMyRTCPeerConnection();
  if (!!otherCallerId) {
    await sendCallOfferToOtherCaller();
  }
});

enableVideoAndAudioButton.addEventListener("click", async () => {
  await populateMediaDeviceList();
  await prepareMyRTCPeerConnection();
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

(await populateMediaDeviceList()) && (await prepareMyRTCPeerConnection());
