const elements = {
  status: document.querySelector("#system-status"),
  runtime: document.querySelector("#runtime"),
  preset: document.querySelector("#preset"),
  network: document.querySelector("#network"),
  components: document.querySelector("#components"),
  timeline: document.querySelector("#timeline"),
  welcome: document.querySelector("#welcome"),
  form: document.querySelector("#chat-form"),
  message: document.querySelector("#message"),
  send: document.querySelector("#send"),
  stop: document.querySelector("#stop"),
  error: document.querySelector("#error")
};

let sessionId;
let controller;

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`API retornou HTTP ${response.status}`);
  return response.json();
}

async function initialize() {
  try {
    const [health, config, session] = await Promise.all([
      request("/api/health"),
      request("/api/config"),
      request("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "jarbas-development",
          title: "Foundation session"
        })
      })
    ]);
    sessionId = session.id;
    elements.runtime.textContent = config.providerId;
    elements.preset.textContent = config.preset;
    elements.network.textContent = config.offline ? "Offline" : "Externa";
    renderHealth(health);
    elements.send.disabled = !elements.message.value.trim();
  } catch (error) {
    showError(error);
  }
}

function renderHealth(health) {
  elements.status.className = `status ${health.status}`;
  elements.status.querySelector("span").textContent = health.status;
  elements.components.replaceChildren(
    ...health.components.map((component) => {
      const row = document.createElement("div");
      row.className = "component";
      const name = document.createElement("span");
      name.textContent = component.name;
      const state = document.createElement("b");
      state.dataset.state = component.status;
      state.textContent = component.status;
      row.append(name, state);
      return row;
    })
  );
}

function renderMessages(messages) {
  elements.welcome?.remove();
  elements.timeline.replaceChildren(
    ...messages.map((message) => messageElement(message.role, message.content))
  );
  elements.timeline.scrollTop = elements.timeline.scrollHeight;
}

function messageElement(role, content, streaming = false) {
  const article = document.createElement("article");
  article.className = role;
  const label = document.createElement("small");
  label.textContent =
    role === "user" ? "VOCÊ" : streaming ? "JARBAS · STREAMING" : "JARBAS";
  const body = document.createElement("p");
  body.textContent = content;
  article.append(label, body);
  return article;
}

async function sendMessage(content) {
  const turnController = new AbortController();
  controller = turnController;
  setBusy(true);
  elements.error.hidden = true;
  elements.welcome?.remove();
  const streamed = messageElement("assistant", "", true);
  elements.timeline.append(messageElement("user", content), streamed);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, content }),
      signal: turnController.signal
    });
    if (!response.ok || !response.body)
      throw new Error(`Chat retornou HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (line) {
          const event = JSON.parse(line);
          if (event.type === "token")
            streamed.querySelector("p").textContent += event.text;
          if (event.type === "error") throw new Error(event.message);
        }
        boundary = buffer.indexOf("\n");
      }
      elements.timeline.scrollTop = elements.timeline.scrollHeight;
    }
  } catch (error) {
    if (!turnController.signal.aborted) showError(error);
  } finally {
    try {
      const [messages, health] = await Promise.all([
        request(`/api/sessions/${sessionId}/messages`),
        request("/api/health")
      ]);
      renderMessages(messages);
      renderHealth(health);
    } catch (error) {
      if (!turnController.signal.aborted) showError(error);
    }
    setBusy(false);
  }
}

function setBusy(busy) {
  elements.send.hidden = busy;
  elements.stop.hidden = !busy;
  elements.send.disabled = busy || !sessionId || !elements.message.value.trim();
  elements.message.disabled = busy;
}

function showError(error) {
  elements.error.textContent =
    error instanceof Error ? error.message : "Falha inesperada";
  elements.error.hidden = false;
}

elements.message.addEventListener("input", () => {
  elements.send.disabled = !sessionId || !elements.message.value.trim();
});
elements.message.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = elements.message.value.trim();
  if (!sessionId || !content) return;
  elements.message.value = "";
  void sendMessage(content);
});
elements.stop.addEventListener("click", () => controller?.abort());

void initialize();
