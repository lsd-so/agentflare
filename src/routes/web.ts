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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css?family=Press+Start+2P" rel="stylesheet">
    <link href="https://unpkg.com/nes.css/css/nes.css" rel="stylesheet" />

    <style>
        html, body, pre, code, kbd, samp {
            font-family: "Press Start 2P", system-ui;
        }

        #banner {
            display: flex;
            justify-content: center;
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
    <div id="banner">
        <h1>AgentFlare</h1>
    </div>
    
    <div>
        <div>
            <label for="apiKey">Anthropic API Key (required for LLM functionality)</label>
            <input 
                type="password" 
                id="apiKey" 
                placeholder="sk-ant-..."
            />
        </div>
    </div>
    
    <div>
        <div id="messages">
            <div>
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
        
        <div>
            <div>
                <textarea 
                    id="messageInput" 
                    placeholder="Message AgentFlare..."
                    rows="1"
                ></textarea>
                <button id="sendButton">
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

    const agent = await createMainAgent(c.env, apiKey);
    const response = await agent.processNaturalLanguageRequest(message);

    return c.json({
      success: response.success,
      message: response.message,
      taskType: response.taskType,
      data: response.data,
      error: response.error,
      executionTime: response.executionTime,
      response,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
