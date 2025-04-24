import { addToPseudoConsoleUI } from "./script.js";

let isWebSocketConnected = false;
let reconnectInterval;

export function connectWebSocket() {
  const ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    addToPseudoConsoleUI(
      `✅ Communication with server established (through a websocket at /ws)`,
    );
    isWebSocketConnected = true;
    console.log("clearing reconnect interval");
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  };

  ws.onclose = () => {
    console.log("websocket closed");
    addToPseudoConsoleUI(
      `❌ Communication with server has been stopped (websocket closed)`,
    );
    isWebSocketConnected = false;
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("websocket error", error);
    addToPseudoConsoleUI(
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
      addToPseudoConsoleUI(
        `ℹ️ Attempting to reconnect to server again (websocket at /ws, every 3s)`,
      );
      connectWebSocket();
    }, 3000);
  }
}
