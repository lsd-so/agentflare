const express = require('express')
const VncClient = require('vnc-rfb-client');
import { Jimp } from 'jimp';
const { generateText, tool, stepCountIs } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { z } = require('zod');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

let client = undefined;
let lastScreenshot = '';
let counter = 0;

const instantiateConnection = () => {
  if (client === undefined || counter === 0) {
    client = new VncClient();
    client.changeFps(5);
    client.connect({ host: '127.0.0.1', port: 5900, password: 'alpinelinux' });

    client.on('frameUpdated', async (data) => {
      counter += 1;
      const image = new Jimp({ width: client.clientWidth, height: client.clientHeight, data: client.getFb() })
      lastScreenshot = await image.getBase64("image/png");
    });
  }
}

// Computer automation tools for LLM
const getComputerTools = () => {
  return {
    screenshot: tool({
      description: 'Take a screenshot of the desktop to see what is currently displayed',
      parameters: z.object({}),
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`🖥️ Executing screenshot tool`);
        instantiateConnection();

        while (!lastScreenshot) {
          // If there is no screenshot yet, wait a jiffy so a screenshot is available
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        return { success: true, screenshot: lastScreenshot };
      }
    }),
    click: tool({
      description: 'Click at specific coordinates on the desktop',
      parameters: z.object({
        x: z.number().describe('X coordinate to click'),
        y: z.number().describe('Y coordinate to click')
      }),
      inputSchema: z.object({
        x: z.number().describe('X coordinate to click'),
        y: z.number().describe('Y coordinate to click')
      }),
      execute: async ({ x, y }) => {
        console.log(`🖱️ Executing click tool: (${x}, ${y})`);
        instantiateConnection();

        if (!client.sendPointerEvent) {
          return { success: false, error: 'VNC client not ready' };
        }

        try {
          // Send mouse click at coordinates
          client.sendPointerEvent(x, y, 1); // Press down
          await new Promise(resolve => setTimeout(resolve, 50)); // Brief delay
          client.sendPointerEvent(x, y, 0); // Release

          return { success: true, message: `Clicked at coordinates (${x}, ${y})` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }),
    type: tool({
      description: 'Type text (keyboard input)',
      parameters: z.object({
        text: z.string().describe('Text to type')
      }),
      inputSchema: z.object({
        text: z.string().describe('Text to type')
      }),
      execute: async ({ text }) => {
        console.log(`⌨️ Executing type tool: "${text}"`);
        instantiateConnection();

        if (!client.sendKeyEvent) {
          return { success: false, error: 'VNC client not ready' };
        }

        try {
          // Type each character
          for (const char of text) {
            const keycode = char.charCodeAt(0);
            client.sendKeyEvent(keycode, true);
            await new Promise(resolve => setTimeout(resolve, 10));
            client.sendKeyEvent(keycode, false);
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          return { success: true, message: `Typed: "${text}"` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }),
    key: tool({
      description: 'Press a specific key or key combination',
      parameters: z.object({
        key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Ctrl+C", "Alt+F4")')
      }),
      inputSchema: z.object({
        key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Ctrl+C", "Alt+F4")')
      }),
      execute: async ({ key }) => {
        console.log(`🔑 Executing key tool: "${key}"`);
        instantiateConnection();

        if (!client.sendKeyEvent) {
          return { success: false, error: 'VNC client not ready' };
        }

        // Key mapping for special keys
        const keyMap = {
          'Control': 0xffe3,
          'Alt': 0xffe9,
          'Shift': 0xffe1,
          'Enter': 0xff0d,
          'Return': 0xff0d,
          'Escape': 0xff1b,
          'Tab': 0xff09,
          'Backspace': 0xff08,
          'Delete': 0xffff,
          'Space': 0x0020,
          'Up': 0xff52,
          'Down': 0xff54,
          'Left': 0xff51,
          'Right': 0xff53,
          'Home': 0xff50,
          'End': 0xff57,
          'Page_Up': 0xff55,
          'Page_Down': 0xff56,
        };

        try {
          // Split text by spaces to handle multiple keys or key combinations
          const keys = key.split(' ');
          const keysyms = [];

          // First pass: collect all valid keysyms
          for (const k of keys) {
            let keysym;

            if (keyMap[k]) {
              // Special key
              keysym = keyMap[k];
            } else if (k.length === 1) {
              // Single character - use ASCII code
              keysym = k.charCodeAt(0);
            } else {
              // Skip invalid keys
              continue;
            }

            keysyms.push(keysym);
          }

          // Second pass: press down all keys
          for (const keysym of keysyms) {
            client.sendKeyEvent(keysym, true);
          }

          // Third pass: release all keys
          for (const keysym of keysyms) {
            client.sendKeyEvent(keysym, false);
          }

          return { success: true, message: `Pressed key combination: "${key}"` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }),
    scroll: tool({
      description: 'Scroll in a specified direction',
      parameters: z.object({
        direction: z.enum(['up', 'down', 'left', 'right']).describe('Direction to scroll'),
        amount: z.number().optional().describe('Amount to scroll (default: 3)')
      }),
      inputSchema: z.object({
        direction: z.enum(['up', 'down', 'left', 'right']).describe('Direction to scroll'),
        amount: z.number().optional().describe('Amount to scroll (default: 3)')
      }),
      execute: async ({ direction, amount = 3 }) => {
        console.log(`📜 Executing scroll tool: ${direction} ${amount}x`);
        instantiateConnection();

        if (!client.sendKeyEvent) {
          return { success: false, error: 'VNC client not ready' };
        }

        try {
          // Map scroll directions to key codes
          let keyCode;
          switch (direction) {
            case 'up': keyCode = 0xff52; break; // Up arrow
            case 'down': keyCode = 0xff54; break; // Down arrow
            case 'left': keyCode = 0xff51; break; // Left arrow
            case 'right': keyCode = 0xff53; break; // Right arrow
            default: return { success: false, error: `Invalid scroll direction: ${direction}` };
          }

          // Perform scroll action multiple times
          for (let i = 0; i < amount; i++) {
            client.sendKeyEvent(keyCode, true);
            await new Promise(resolve => setTimeout(resolve, 50));
            client.sendKeyEvent(keyCode, false);
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          return { success: true, message: `Scrolled ${direction} ${amount} times` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }),
    move: tool({
      description: 'Move mouse to specific coordinates without clicking',
      parameters: z.object({
        x: z.number().describe('X coordinate to move to'),
        y: z.number().describe('Y coordinate to move to')
      }),
      inputSchema: z.object({
        x: z.number().describe('X coordinate to move to'),
        y: z.number().describe('Y coordinate to move to')
      }),
      execute: async ({ x, y }) => {
        console.log(`🖱️ Executing move tool: (${x}, ${y})`);
        instantiateConnection();

        if (!client.sendPointerEvent) {
          return { success: false, error: 'VNC client not ready' };
        }

        try {
          // Send mouse move without clicking
          client.sendPointerEvent(x, y, 0);

          return { success: true, message: `Moved mouse to coordinates (${x}, ${y})` };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    })
  };
};

app.get("/screenshot", async (req, res) => {
  instantiateConnection();

  while (!lastScreenshot) {
    // If there is no screenshot yet, wait a jiffy so a screenshot is available for sure
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  res.send(`Screenshot:${lastScreenshot}`);
})

app.get("/enter", (req, res) => {
  instantiateConnection();

  const text = req.query.text;
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  if (!client.sendKeyEvent) {
    return res.status(500).send('VNC client not ready');
  }

  // Key mapping for special keys
  const keyMap = {
    'Control': 0xffe3,
    'Alt': 0xffe9,
    'Shift': 0xffe1,
    'Enter': 0xff0d,
    'Return': 0xff0d,
    'Escape': 0xff1b,
    'Tab': 0xff09,
    'Backspace': 0xff08,
    'Delete': 0xffff,
    'Space': 0x0020,
    'Up': 0xff52,
    'Down': 0xff54,
    'Left': 0xff51,
    'Right': 0xff53,
    'Home': 0xff50,
    'End': 0xff57,
    'Page_Up': 0xff55,
    'Page_Down': 0xff56,
  };

  // Split text by spaces to handle multiple keys or key combinations
  const keys = text.split(' ');
  const keysyms = [];

  // First pass: collect all valid keysyms
  for (const key of keys) {
    let keysym;

    if (keyMap[key]) {
      // Special key
      keysym = keyMap[key];
    } else if (key.length === 1) {
      // Single character - use ASCII code
      keysym = key.charCodeAt(0);
    } else {
      // Skip invalid keys
      continue;
    }

    keysyms.push(keysym);
  }


  try {
    // Second pass: press down all keys
    for (const keysym of keysyms) {
      client.sendKeyEvent(keysym, true);
    }
  } catch (error) {
    console.error('Error sending key events:', error);
    res.status(500).send(`Error sending the key events: ${error}`);
  }

  try {
    // Third pass: release all keys
    for (const keysym of keysyms) {
      client.sendKeyEvent(keysym, false);
    }

    res.send(`Key combination sent: ${text}`);
  } catch (error) {
    console.error('Error sending key events:', error);
    res.status(500).send(`Error lifting key events: ${error}`);
  }
});

app.get('/agent', async (req, res) => {
  try {
    const { prompt, apiKey } = req.query;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }

    // Ensure VNC connection is ready
    instantiateConnection();

    // Getting computer tools
    const tools = getComputerTools();

    // Create Anthropic client
    const anthropic = createAnthropic({
      apiKey: apiKey
    });

    // Generate response using LLM
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `You are a computer control agent that can interact with desktop environments via VNC. You can:

- screenshot: Take screenshots to see the desktop
- click: Click at specific coordinates
- type: Type text via keyboard
- key: Press specific keys or key combinations
- scroll: Scroll in any direction
- move: Move mouse cursor

Always take a screenshot first to see the current desktop state, then proceed with actions. Be precise with coordinates and explain what you're doing. When clicking, aim for the center of buttons or UI elements.`,
      prompt,
      tools,
      stopWhen: stepCountIs(5),
      toolChoice: 'auto',
      headers: {
        'anthropic-beta': 'context-1m-2025-08-07',
      },
      prepareStep: async ({ messages }) => {
        // Find all messages containing screenshots
        const screenshotIndices = [];

        for (let i = 0; i < messages.length; i++) {
          const message = messages[i];

          // Check for screenshots in assistant messages
          if (message.role === 'assistant' && message.content) {
            const content = Array.isArray(message.content) ? message.content : [message.content];
            const hasScreenshot = content.some(part =>
              typeof part === 'object' && part.type === 'image'
            );
            if (hasScreenshot) {
              screenshotIndices.push(i);
            }
          }
        }

        // If we have multiple screenshots, keep only the latest one
        if (screenshotIndices.length > 1) {
          const latestScreenshotIndex = screenshotIndices[screenshotIndices.length - 1];
          const filteredMessages = messages.filter((message, index) => {
            // Keep all non-screenshot messages and only the latest screenshot
            return !screenshotIndices.includes(index) || index === latestScreenshotIndex;
          });

          console.log(`🖥️ COMPUTER AGENT: Filtered ${screenshotIndices.length - 1} old screenshots, keeping latest`);

          return {
            messages: filteredMessages
          };
        }

        // No changes needed
        return { messages };
      }
    });

    return res.json({
      success: true,
      message: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults
    });
  } catch (error) {
    console.error('Computer agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  instantiateConnection();
  console.log(`Example app listening on port ${port}`)
})
