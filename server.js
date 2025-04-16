import express from "express";
import expressWs from "express-ws";
import { v4 as uuidv4 } from "uuid";

const app = express();
expressWs(app);

const websocketClients = new Map();

app.ws("/ws", (ws, req) => {
  // ws client connected
  const id = uuidv4();
  websocketClients.set(id, ws);
  console.log("WebSocket connected");

  ws.on("message", (msg) => {
    console.log("message:", msg);
    ws.send(`echo: ${msg}`);
  });

  ws.on("close", () => {
    console.log("WebSocket disconnected");
  });

  ws.send(id + "connected to /ws");
});

app.get("/", (_, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
