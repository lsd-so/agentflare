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

        body {
                display: flex;
                flex-direction: column;
                height: 100vh;
                padding: 12px;
        }

        #banner {
            display: flex;
            justify-content: center;
        }

        #api-key-container {
                display: flex;
                align-items: center;
        }

        #api-key-container > label {
                text-wrap: nowrap;
                margin-right: 8px;
        }

        #messages-container {
                display: flex;
                flex: 1;
                flex-direction: column;
                padding-top: 8px;
                padding-bottom: 8px;
        }

        #messages {
                flex: 1;
                overflow-y: scroll;
        }

        #initial {
                max-width: 640px;
                margin-right: auto;
                margin-left: auto;
                padding-top: 10vh;
        }

        #chat-input-container {
                display: flex;
        }

        #chat-input-container > textarea {
                margin-right: 6px;
        }

        #chat-input-container > button {
                margin-left: 6px;
        }
    </style>
</head>
<body>
    <div id="banner">
        <h1>AgentFlare</h1>
    </div>
    
    <div>
        <div id="api-key-container">
            <label for="api-key">Anthropic API key:</label>
            <input 
                type="password" 
                id="api-key"
                class="nes-input"
                placeholder="sk-ant-..."
            />
        </div>
    </div>
    
    <div id="messages-container">
        <div id="messages">
            <div id="initial">
                <i class="nes-charmander"></i>
                <p>I can help you with web browsing, desktop automation, and search tasks. What would you like me to do?</p>
            </div>
        </div>
        
        <div id="loading">
            <i class="nes-octocat animate"></i>
        </div>
        
        <div>
            <div id="chat-input-container">
                <textarea 
                    id="messageInput" 
                    placeholder="The cloud is your oyster..."
                    class="nes-textarea"
                    rows="1"
                ></textarea>
                <button id="sendButton" class="nes-btn is-primary">
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
        const apiKeyInput = document.getElementById('api-key');
        
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
            // messageDiv.className = \`nes-balloon \${isUser ? 'from-right' : 'from-left'}\`;
            messageDiv.innerHTML = \`<div class="nes-balloon \${isUser ? 'from-right' : 'from-left'}">\${content.replace('\\n', '<br/>')}</div>\`;
            
            // Remove initial message if it exists
            const initial = document.querySelector('#initial');
            if (initial) {
                initial.remove();
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
