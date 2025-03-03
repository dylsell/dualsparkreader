# FriendlyScroll Chrome Extension <img src="icons/icon48.png" alt="FriendlyScroll Icon" width="24"/>

This Chrome extension turns AI chat responses from Claude and ChatGPT into a scrollable feed that you can read at your own pace. It also includes a voice reader feature that can read the responses aloud.

## Features

- **Scrollable Feed**: Read AI responses at your own pace with a book-like interface
- **Voice Reader**: Listen to AI responses with high-quality text-to-speech
- **Auto-Scrolling**: Text automatically scrolls as it's being read
- **Voice Controls**: Pause, resume, and adjust reading speed
- **Multiple Voices**: Choose from several different voice options
- **Built-in API Key**: No need for users to sign up for UNREAL Speech or provide their own API key
- **Multi-Platform Support**: Works with both Claude and ChatGPT

## Files in this Extension

1. **manifest.json** - Configuration file for the Chrome extension
2. **content.js** - JavaScript code that watches AI chat interfaces and creates the scrolling feed
3. **styles.css** - CSS styling for the scrolling feed
4. **icons/** - Directory containing various sized icons for the extension
   - icon16.png - 16x16 favicon and small icon
   - icon24.png - 24x24 icon for extension toolbar
   - icon32.png - 32x32 icon for extension toolbar
   - icon48.png - 48x48 general icon
   - icon64.png - 64x64 web accessible resource
   - icon128.png - 128x128 larger extension icon
   - icon-white.png - White version for potential dark mode use

## Icons

The extension now includes a complete set of icons in the `icons/` directory:
- icon16.png (16x16 pixels) - Used for favicon and small icon
- icon24.png (24x24 pixels) - Used for extension toolbar 
- icon32.png (32x32 pixels) - Used for extension toolbar
- icon48.png (48x48 pixels) - Used for general extension icon 
- icon64.png (64x64 pixels) - Used as a web accessible resource
- icon128.png (128x128 pixels) - Used for Chrome Web Store and larger displays
- icon-white.png (1000x1000 pixels) - White version for potential dark mode use or marketing

These icons are properly referenced in the manifest.json file and ready to use.

## How to Load the Extension in Chrome

Follow these steps to load your extension in Chrome:

1. **Open Chrome's Extension Management page**
   - Type `chrome://extensions` in your address bar and press Enter
   - Or click the puzzle piece icon in the top right corner, then select "Manage Extensions"

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner of the page

3. **Load Your Extension**
   - Click the "Load unpacked" button that appears
   - Navigate to the folder containing your extension files
   - Select the folder and click "Open"

4. **Test Your Extension**
   - Your extension should now appear in the list of installed extensions
   - Visit [Claude](https://claude.ai/chat) or [ChatGPT](https://chat.openai.com) to test it
   - You should see the FriendlyScroll feed appear when the AI starts responding

## Using the Voice Reader

To use the voice reader feature:

1. **Open the Reader**
   - Click the book icon (📖) to open the reader

2. **Start Voice Reading**
   - Click the speaker icon (🔊) in the reader header
   - The extension will start reading the AI response aloud

3. **Voice Controls**
   - Use the controls that appear to:
     - Pause/resume reading
     - Adjust reading speed
     - Change the voice using the dropdown selector (options include Scarlett, Liv, Amy, Dan, and Will)

## Troubleshooting

If your extension doesn't work as expected:

1. Check the console for errors:
   - Right-click on the page
   - Select "Inspect" or "Inspect Element"
   - Go to the "Console" tab to see any error messages

2. Make sure all files are in the same folder

3. Try reloading the extension:
   - Go to `chrome://extensions`
   - Find FriendlyScroll and click the refresh icon

4. If you make changes to the code, you'll need to reload the extension for the changes to take effect 

5. If the voice reader isn't working:
   - Check your internet connection
   - Make sure the API key in the code is valid (you need to add your UNREAL Speech API key to content.js)

6. If the extension doesn't work with ChatGPT:
   - ChatGPT's interface may have been updated since this extension was created
   - You might need to update the selectors in the `platformSelectors` object in content.js 