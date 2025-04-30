import express from "express";
import expressWs from "express-ws";

const app = express();
expressWs(app);

const websocketClients = new Map();

app.ws("/ws", (ws, req) => {
  const id = Math.floor(100000 + Math.random() * 900000).toString(); // random 6-digit int
  websocketClients.set(id, ws);
  console.log(`WebSocket connected: ${id}`);

  // Tell the client their ID
  ws.send(JSON.stringify({ type: "welcome", id }));

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      console.error("Invalid JSON:", msg);
      return;
    }

    const { type, target, payload } = data;

    if (!target || !websocketClients.has(target)) {
      console.error("Invalid target:", target);
      return;
    }

    const targetWs = websocketClients.get(target);

    // Forward the message to the target
    targetWs.send(
      JSON.stringify({
        type,
        from: id,
        payload,
      }),
    );
  });

  ws.on("close", () => {
    websocketClients.delete(id);
    console.log(`WebSocket disconnected: ${id}`);
  });
});

app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
