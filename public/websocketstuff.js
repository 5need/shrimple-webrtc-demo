import { pseudoConsoleDotLog } from "./script.js";

let isWebSocketConnected = false;
let reconnectInterval;

export function connectWebSocket() {
  const ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    pseudoConsoleDotLog(
      `✅ Communication with server established (through a websocket at <mark>/ws</mark>)`,
    );
    isWebSocketConnected = true;
    console.log("clearing reconnect interval");
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  };

  ws.onclose = () => {
    console.log("websocket closed");
    pseudoConsoleDotLog(
      `❌ Communication with server has been stopped (websocket closed)`,
    );
    isWebSocketConnected = false;
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("websocket error", error);
    pseudoConsoleDotLog(
      `❌ Communication with server has been stopped (websocket error)`,
    );
    isWebSocketConnected = false;
  };

  return ws;
}

function attemptReconnect() {
  if (reconnectInterval) {
    console.log("already have a reconnect interval", reconnectInterval);
    return;
  } else {
    console.log("starting reconnect interval");
    reconnectInterval = setInterval(() => {
      console.log("attempting reconnect");
      pseudoConsoleDotLog(
        `ℹ️ Attempting to reconnect to server again (websocket at <mark>/ws</mark>, every 3s)`,
      );
      connectWebSocket();
    }, 3000);
  }
}
