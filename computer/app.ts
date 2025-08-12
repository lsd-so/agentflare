const express = require('express')
const VncClient = require('vnc-rfb-client');
import { Jimp } from 'jimp';

const app = express();
const port = 3000;

let client = undefined;
let lastScreenshot = '';
let counter = 0;

const instantiateConnection = () => {
  if (client === undefined || counter === 0) {
    client = new VncClient();
    client.changeFps(1);
    client.connect({ host: '127.0.0.1', port: 5900, password: 'alpinelinux' });

    client.on('frameUpdated', async (data) => {
      counter += 1;
      const image = new Jimp({ width: client.clientWidth, height: client.clientHeight, data: client.getFb() })
      const fileName = `${Date.now()}`;
      console.log(`Saving frame to file. ${fileName}.jpg`);
      lastScreenshot = await image.getBase64("image/jpeg");
      counter += 1;
    });
  }
}

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

app.listen(port, '0.0.0.0', () => {
  instantiateConnection();
  console.log(`Example app listening on port ${port}`)
})
