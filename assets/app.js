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
  messageDiv.style.display = 'flex';
  messageDiv.style.alignItems = 'flex-end';
  if (isUser) {
    messageDiv.style.justifyContent = 'flex-end';
  }
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('nes-balloon');
  contentDiv.classList.add(isUser ? 'from-right' : 'from-left');
  if (isUser) {
    contentDiv.style.marginRight = '32px'
  } else {
    contentDiv.style.marginLeft = '32px'
  }
  const contentLines = content.split('\n');
  contentLines.forEach((line, idx) => {
    contentDiv.appendChild(document.createTextNode(line));
    if (idx !== contentLines.length - 1) {
      contentDiv.appendChild(document.createElement('br'));
    }
  });

  const authorContainer = document.createElement('div');
  authorContainer.style.width = '96px';
  authorContainer.style.height = '96px';
  const authorEl = document.createElement('i');
  authorEl.classList.add('nes-bcrikko');
  authorContainer.appendChild(authorEl);

  if (!isUser) {
    messageDiv.appendChild(authorContainer);
    messageDiv.appendChild(contentDiv);
  } else {
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(authorContainer);
  }
  
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
    apiKeyInput.classList.add('is-error');
    return;
  }
  
  apiKeyInput.classList.remove('is-error');
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
