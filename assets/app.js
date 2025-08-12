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
  if (isUser) {
    messageDiv.style.display = 'flex';
    messageDiv.style.justifyContent = 'flex-end';
  }
  messageDiv.innerHTML = `<div class="nes-balloon ${isUser ? 'from-right' : 'from-left'}">${content.replaceAll('\n', '<br/>')}</div>`;
  
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
  messageInput.disabled = true;
  messageInput.classList.add('is-warning');
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
      addMessage(`Error: ${data.error || 'Something went wrong'}`);
    }
  } catch (error) {
    addMessage(`Error: ${error.message}`);
  } finally {
    loading.style.display = 'none';
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.classList.remove('is-warning');
    messageInput.focus();
  }
}

addEventListener("DOMContentLoaded", (event) => {
  // Focus on input when page loads
  messageInput.focus();
});
