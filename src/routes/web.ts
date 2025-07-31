import { Hono } from "hono";
import { loadBalance, getContainer } from "@cloudflare/containers";
import { AppBindings } from "../types";
import { createMainAgent } from "../agents/agent";

const webRoutes = new Hono<{ Bindings: AppBindings }>();

// Home route with ChatGPT-style interface
webRoutes.get("/", (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AgentFlare</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background-color: #212121;
            color: #ececec;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            padding: 1rem 2rem;
            border-bottom: 1px solid #424242;
            background: #212121;
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #fff;
        }
        
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 768px;
            margin: 0 auto;
            width: 100%;
            padding: 0 1rem;
        }
        
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 2rem 0;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        
        .message {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            border-radius: 8px;
        }
        
        .message.user {
            background: #2f2f2f;
            margin-left: 3rem;
        }
        
        .message.assistant {
            background: #1a1a1a;
            margin-right: 3rem;
        }
        
        .message-content {
            flex: 1;
            line-height: 1.6;
        }
        
        .input-container {
            padding: 1rem 0 2rem 0;
            border-top: 1px solid #424242;
            background: #212121;
        }
        
        .api-key-container {
            padding: 1rem 0;
            border-bottom: 1px solid #424242;
            background: #212121;
        }
        
        .api-key-wrapper {
            max-width: 768px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        
        .api-key-field {
            width: 100%;
            background: #2f2f2f;
            border: 1px solid #424242;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: #ececec;
            font-size: 0.875rem;
        }
        
        .api-key-field:focus {
            outline: none;
            border-color: #10a37f;
        }
        
        .api-key-label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            color: #8e8ea0;
        }
        
        .input-wrapper {
            position: relative;
            display: flex;
            align-items: end;
            gap: 0.5rem;
        }
        
        .input-field {
            flex: 1;
            background: #2f2f2f;
            border: 1px solid #424242;
            border-radius: 12px;
            padding: 0.75rem 3rem 0.75rem 1rem;
            color: #ececec;
            font-size: 1rem;
            resize: none;
            min-height: 48px;
            max-height: 200px;
            line-height: 1.5;
        }
        
        .input-field:focus {
            outline: none;
            border-color: #10a37f;
        }
        
        .send-button {
            position: absolute;
            right: 8px;
            bottom: 8px;
            background: #10a37f;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        
        .send-button:hover {
            background: #0f9e6c;
        }
        
        .send-button:disabled {
            background: #424242;
            cursor: not-allowed;
        }
        
        .welcome {
            text-align: center;
            padding: 4rem 2rem;
            color: #8e8ea0;
        }
        
        .welcome h2 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #fff;
        }
        
        .welcome p {
            font-size: 1.125rem;
            line-height: 1.6;
        }
        
        .loading {
            display: none;
            padding: 1rem;
            background: #1a1a1a;
            margin-right: 3rem;
            border-radius: 8px;
        }
        
        .loading-dots {
            display: flex;
            gap: 4px;
        }
        
        .loading-dot {
            width: 8px;
            height: 8px;
            background: #8e8ea0;
            border-radius: 50%;
            animation: loading 1.4s infinite ease-in-out;
        }
        
        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes loading {
            0%, 80%, 100% { opacity: 0.3; }
            40% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>AgentFlare</h1>
    </div>
    
    <div class="api-key-container">
        <div class="api-key-wrapper">
            <label class="api-key-label" for="apiKey">Anthropic API Key (required for LLM functionality)</label>
            <input 
                type="password" 
                id="apiKey" 
                class="api-key-field" 
                placeholder="sk-ant-..."
            />
        </div>
    </div>
    
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="welcome">
                <h2>Welcome to AgentFlare</h2>
                <p>I can help you with web browsing, desktop automation, and search tasks. What would you like me to do?</p>
            </div>
        </div>
        
        <div class="loading" id="loading">
            <div class="loading-dots">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>
        
        <div class="input-container">
            <div class="input-wrapper">
                <textarea 
                    id="messageInput" 
                    class="input-field" 
                    placeholder="Message AgentFlare..."
                    rows="1"
                ></textarea>
                <button id="sendButton" class="send-button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <script>
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const messages = document.getElementById('messages');
        const loading = document.getElementById('loading');
        const apiKeyInput = document.getElementById('apiKey');
        
        function autoResize() {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        }
        
        messageInput.addEventListener('input', autoResize);
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendButton.addEventListener('click', sendMessage);
        
        function addMessage(content, isUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${isUser ? 'user' : 'assistant'}\`;
            messageDiv.innerHTML = \`<div class="message-content">\${content}</div>\`;
            
            // Remove welcome message if it exists
            const welcome = document.querySelector('.welcome');
            if (welcome) {
                welcome.remove();
            }
            
            messages.appendChild(messageDiv);
            messages.scrollTop = messages.scrollHeight;
        }
        
        async function sendMessage() {
            const message = messageInput.value.trim();
            const apiKey = apiKeyInput.value.trim();
            
            if (!message) return;
            if (!apiKey) {
                addMessage('Please enter your Anthropic API key first.');
                return;
            }
            
            addMessage(message, true);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            sendButton.disabled = true;
            loading.style.display = 'block';
            
            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message, apiKey })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    addMessage(data.message);
                } else {
                    addMessage(\`Error: \${data.error || 'Something went wrong'}\`);
                }
            } catch (error) {
                addMessage(\`Error: \${error.message}\`);
            } finally {
                loading.style.display = 'none';
                sendButton.disabled = false;
                messageInput.focus();
            }
        }
        
        // Focus on input when page loads
        messageInput.focus();
    </script>
</body>
</html>`;
  
  return c.html(html);
});

// Chat endpoint to handle messages from the frontend
webRoutes.post("/chat", async (c) => {
  try {
    const { message, apiKey } = await c.req.json();
    
    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Message is required' });
    }
    
    if (!apiKey || typeof apiKey !== 'string') {
      return c.json({ success: false, error: 'API key is required' });
    }
    
    const agent = await createMainAgent(c.env, 'https://agentflare.yev-81d.workers.dev', apiKey);
    const response = await agent.processNaturalLanguageRequest(message);
    
    return c.json({
      success: response.success,
      message: response.message,
      taskType: response.taskType,
      data: response.data,
      error: response.error,
      executionTime: response.executionTime
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route requests to a specific container using the container ID
webRoutes.get("/container/:id", async (c) => {
  const id = c.req.param("id");
  const containerId = c.env.BROWSER_CONTAINER.idFromName(`/container/${id}`);
  const container = c.env.BROWSER_CONTAINER.get(containerId);
  return await container.fetch(c.req.raw);
});

// Demonstrate error handling - this route forces a panic in the container
webRoutes.get("/error", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER, "error-test");
  return await container.fetch(c.req.raw);
});

// Load balance requests across multiple containers
webRoutes.get("/lb", async (c) => {
  const container = await loadBalance(c.env.BROWSER_CONTAINER, 3);
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
webRoutes.get("/singleton", async (c) => {
  const container = getContainer(c.env.BROWSER_CONTAINER);
  const modifiedRequest = new Request(c.req.raw, {
    headers: {
      ...Object.fromEntries(c.req.raw.headers.entries()),
      "host": "localhost"
    }
  });
  return await container.fetch(modifiedRequest);
});

export default webRoutes;
