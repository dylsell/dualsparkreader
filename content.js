// FriendlyScroll - content.js
// This script watches AI chat areas and creates a scrollable feed with parallax effect

// Global variables to track state
let isProcessing = false;
let lastProcessedText = '';
let observerThrottleTimer = null;
let revealedLines = 0;
let hasScrolled = false; // Variable to track if user has scrolled
let feedVisible = false; // Track if the feed is currently visible
let isReading = false; // Track if voice is currently reading
let audioElement = null; // Audio element for playing speech
let currentChunkIndex = 0; // Track which text chunk is being read
let isDarkMode = false; // Track if dark mode is enabled
// IMPORTANT: Replace 'YOUR_API_KEY_HERE' with your actual UNREAL Speech API key before distributing the extension
// You can get an API key by signing up at https://unrealspeech.com
let apiKey = 'Ahwh0HJzyBAeHZVK3bAx27rETuTJipe80jffPSbCtmdJPvlP8sXmxp'; // Add your UNREAL Speech API key here
let selectedVoiceId = 'Scarlett'; // Default voice ID (Scarlett)
let autoScrollInterval = null; // Interval for auto-scrolling
let currentPlaybackRate = 1.2; // Store the current playback rate
let currentPlatform = 'unknown'; // 'claude' or 'chatgpt'
let currentFontSizeLevel = 3; // Default font size level (1-5, with 3 being medium)
const MAX_FONT_SIZE_LEVEL = 10; // Increased from 5 to 10 to allow for 2x larger sizes
const MIN_FONT_SIZE_LEVEL = 1;

// Platform-specific selectors
const platformSelectors = {
  claude: {
    messageSelector: '.prose, .font-claude-message, [data-message-author-role="assistant"] > div', // Claude's message elements (multiple potential classes)
    contentElements: 'p, ul, ol, li, pre, code, blockquote, table, h1, h2, h3, h4, h5, h6, div.whitespace-pre, div.prose', 
    mainContentSelector: '.prose, .prose-content, [data-testid="conversation-turn-assistant-text"] > div, [data-message-author-role="assistant"] > div, [data-message-id] .prose', // Main content areas in Claude
    rootMessageSelector: '.w-full.flex, [data-testid="conversation-turn-assistant"], [data-message-id]', // The root message container in Claude
    fullContentSelector: '[data-testid="conversation-turn-assistant"], [data-message-author-role="assistant"], [data-message-id][data-message-author-role="assistant"]' // Full assistant message content
  },
  chatgpt: {
    messageSelector: '[data-message-author-role="assistant"]', // ChatGPT's message container
    contentElements: '.markdown > *', // Direct children of markdown class
    markdownSelector: '.markdown' // The main markdown container
  }
};

// Wait a moment after the page loads before initializing
setTimeout(() => {
  console.log('FriendlyScroll extension is initializing...');
  
  // Detect which platform we're on
  detectPlatform();
  
  // Set up the dark mode observer
  setupDarkModeObserver();
  
  // Step 1: Create our custom scrolling feed container (but don't show it yet)
  createScrollFeed();
  
  // Step 2: Add a toggle button to the page
  addToggleButton();
  
  // Step 3: Set up a watcher to detect when AI is responding
  watchForAIResponses();
  
  // Step 4: Load saved voice preference if available
  loadVoicePreference();
  
  // Step 5: Load saved font size preference if available
  loadFontSizePreference();
}, 2000); // Wait 2 seconds to make sure the page is fully loaded

// Function to detect which platform we're running on
function detectPlatform() {
  try {
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    // Check for Claude platforms (could be claude.ai or app.claude.ai or other subdomains)
    if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) {
      currentPlatform = 'claude';
      console.log('Detected platform: Claude');
    } else if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
      currentPlatform = 'chatgpt';
      console.log('Detected platform: ChatGPT');
    } else {
      console.log('Unknown platform, defaulting to Claude selectors');
      currentPlatform = 'claude'; // Default to Claude selectors
    }
    
    // Additional verification by looking for platform-specific elements
    setTimeout(() => {
      if (currentPlatform === 'claude') {
        const claudeElements = document.querySelectorAll('[data-testid="conversation-turn-assistant"]');
        if (claudeElements.length === 0) {
          console.log('No Claude-specific elements found, might be an incorrect platform detection');
        } else {
          console.log(`Confirmed Claude platform with ${claudeElements.length} assistant elements`);
        }
      } else if (currentPlatform === 'chatgpt') {
        const chatgptElements = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (chatgptElements.length === 0) {
          console.log('No ChatGPT-specific elements found, might be an incorrect platform detection');
        } else {
          console.log(`Confirmed ChatGPT platform with ${chatgptElements.length} assistant elements`);
        }
      }
    }, 1000); // Wait a short time for the page to fully load
  } catch (error) {
    console.error('Error detecting platform:', error);
    currentPlatform = 'claude'; // Default to Claude as fallback
  }
}

// Function to load the voice preference from storage
function loadVoicePreference() {
  try {
    chrome.storage.sync.get(['voiceId', 'fontSizeLevel'], function(result) {
      if (result.voiceId) {
        selectedVoiceId = result.voiceId;
        console.log('Loaded voice preference:', selectedVoiceId);
      }
      
      if (result.fontSizeLevel) {
        // Make sure the loaded font size is within our new range
        currentFontSizeLevel = Math.min(MAX_FONT_SIZE_LEVEL, 
                                      Math.max(MIN_FONT_SIZE_LEVEL, result.fontSizeLevel));
        console.log('Loaded font size preference:', currentFontSizeLevel);
      }
      
      // Apply the font size to the text container if it exists
      applyFontSize();
    });
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

// Function to add a toggle button to the page
function addToggleButton() {
  // Check if the button already exists
  if (document.getElementById('friendly-scroll-toggle')) {
    return;
  }
  
  // Check if dark mode is enabled
  detectDarkMode();
  
  // Create a new button element
  const toggleButton = document.createElement('button');
  toggleButton.id = 'friendly-scroll-toggle';
  
  // Use the appropriate icon based on dark mode
  const iconImg = document.createElement('img');
  if (isDarkMode) {
    iconImg.src = chrome.runtime.getURL('icons/icon-white.png');
  } else {
    iconImg.src = chrome.runtime.getURL('icons/icon128.png');
  }
  iconImg.alt = 'FriendlyScroll';
  iconImg.style.width = '80px'; 
  iconImg.style.height = '80px';
  toggleButton.appendChild(iconImg);
  
  // Add title attribute for accessibility (tooltip will no longer be shown)
  toggleButton.title = 'Open Dualspark Reader';
  
  // Add click event listener
  toggleButton.addEventListener('click', toggleFeed);
  
  // Add the button to the page
  document.body.appendChild(toggleButton);
  
  console.log('Toggle button added to page with appropriate icon for theme');
}

// Function to toggle the voice reader
function toggleVoiceReader() {
  // If we're already reading, toggle pause/resume
  if (isReading) {
    if (audioElement) {
      togglePause();
      
      // Update the main voice button to match the current state
      const voiceButton = document.getElementById('friendly-scroll-voice');
      if (voiceButton) {
        if (audioElement.paused) {
          voiceButton.textContent = 'Continue Reading';
          voiceButton.title = 'Resume Reading';
          // Add paused class for styling
          voiceButton.classList.add('paused');
          voiceButton.classList.remove('active');
        } else {
          voiceButton.textContent = 'Pause Reading';
          voiceButton.title = 'Pause Reading';
          // Keep active styling when playing
          voiceButton.classList.add('active');
          voiceButton.classList.remove('paused');
        }
      }
    }
    return;
  }
  
  // Start reading directly (no need to check for API key since it's hardcoded)
  startReading();
}

// Function to start reading
function startReading() {
  // Set reading state to true
  isReading = true;
  
  // Update voice button to show active state
  const voiceButton = document.getElementById('friendly-scroll-voice');
  if (voiceButton) {
    voiceButton.classList.add('active');
    voiceButton.textContent = 'Pause Reading';
    voiceButton.title = 'Pause Reading';
  }
  
  // Hide the scroll indicator since we're using voice mode
  const scrollIndicator = document.getElementById('scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.style.opacity = '0';
    scrollIndicator.style.display = 'none';
  }
  
  // Make all text elements visible for reading
  const textContainer = document.getElementById('friendly-scroll-text');
  const elements = textContainer.querySelectorAll('.text-paragraph, .text-heading, .text-code');
  elements.forEach(element => {
    element.classList.add('visible');
    element.classList.remove('almost-visible', 'partial-visible', 'barely-visible');
  });
  
  // Add voice controls if they don't exist yet
  addVoiceControls();
  
  // Reset the current chunk index
  currentChunkIndex = 0;
  
  // Start reading from the beginning
  readNextChunk();
  
  // Start auto-scrolling
  startAutoScroll();
}

// Function to add voice controls to the feed
function addVoiceControls() {
  // Check if controls already exist
  if (document.getElementById('voice-controls')) {
    return;
  }
  
  // Create controls container
  const controls = document.createElement('div');
  controls.id = 'voice-controls';
  
  // Add controls HTML - removed the pause/play button
  controls.innerHTML = `
    <div class="voice-control-buttons">
      <div class="voice-speed-control">
        <label>Speed:</label>
        <button id="voice-speed-down" title="Slower">-</button>
        <span id="voice-speed-value">1.2x</span>
        <button id="voice-speed-up" title="Faster">+</button>
      </div>
      <div class="voice-selection-control">
        <label>Voice:</label>
        <select id="voice-select-control">
          <option value="Scarlett">Scarlett</option>
          <option value="Liv">Liv</option>
          <option value="Amy">Amy</option>
          <option value="Dan">Dan</option>
          <option value="Will">Will</option>
        </select>
      </div>
    </div>
    <div class="voice-progress">
      <div id="voice-progress-bar"></div>
    </div>
  `;
  
  // Add to the feed
  const feedHeader = document.getElementById('friendly-scroll-header');
  feedHeader.parentNode.insertBefore(controls, feedHeader.nextSibling);
  
  // Add event listeners - removed the pause button event listener
  document.getElementById('voice-speed-down').addEventListener('click', decreaseSpeed);
  document.getElementById('voice-speed-up').addEventListener('click', increaseSpeed);
  
  // Set the current voice in the dropdown
  const voiceSelect = document.getElementById('voice-select-control');
  if (voiceSelect) {
    voiceSelect.value = selectedVoiceId;
    
    // Add focus event to pause when dropdown is clicked
    voiceSelect.addEventListener('focus', function() {
      if (audioElement && !audioElement.paused) {
        togglePause(); // Pause the audio when selecting a voice
      }
    });
    
    voiceSelect.addEventListener('change', function() {
      selectedVoiceId = this.value;
      
      // Save to storage
      chrome.storage.sync.set({
        voiceId: selectedVoiceId
      }, function() {
        console.log('Voice ID saved to storage');
      });
      
      // If we were paused by the focus event, restart reading with the new voice
      if (isReading && audioElement && audioElement.paused) {
        // Store current chunk index
        const currentPosition = currentChunkIndex;
        
        // Stop current reading
        if (audioElement) {
          audioElement.pause();
          audioElement = null;
        }
        
        // Update UI to show we're still reading
        const voiceButton = document.getElementById('friendly-scroll-voice');
        if (voiceButton) {
          voiceButton.textContent = 'Pause Reading';
          voiceButton.title = 'Pause Reading';
        }
        
        // Continue from current position with new voice
        readNextChunk();
        startAutoScroll();
      }
    });
  }
}

// Function to toggle pause/resume
function togglePause() {
  if (!audioElement) return;
  
  // Removed reference to the pause button since it's no longer in the UI
  const voiceButton = document.getElementById('friendly-scroll-voice');
  
  if (audioElement.paused) {
    audioElement.play();
    if (voiceButton) {
      voiceButton.textContent = 'Pause Reading';
      voiceButton.title = 'Pause Reading';
      voiceButton.classList.add('active');
      voiceButton.classList.remove('paused');
    }
    startAutoScroll();
  } else {
    audioElement.pause();
    if (voiceButton) {
      voiceButton.textContent = 'Continue Reading';
      voiceButton.title = 'Resume Reading';
      voiceButton.classList.add('paused');
      voiceButton.classList.remove('active');
    }
    stopAutoScroll();
  }
}

// Function to decrease playback speed
function decreaseSpeed() {
  if (!audioElement) return;
  
  const currentSpeed = audioElement.playbackRate;
  if (currentSpeed > 0.5) {
    currentPlaybackRate = Math.max(0.5, currentSpeed - 0.1);
    audioElement.playbackRate = currentPlaybackRate;
    updateSpeedDisplay();
  }
}

// Function to increase playback speed
function increaseSpeed() {
  if (!audioElement) return;
  
  const currentSpeed = audioElement.playbackRate;
  if (currentSpeed < 2.0) {
    currentPlaybackRate = Math.min(2.0, currentSpeed + 0.1);
    audioElement.playbackRate = currentPlaybackRate;
    updateSpeedDisplay();
  }
}

// Function to update the speed display
function updateSpeedDisplay() {
  if (!audioElement) return;
  
  const speedValue = document.getElementById('voice-speed-value');
  if (speedValue) {
    speedValue.textContent = audioElement.playbackRate.toFixed(1) + 'x';
  }
}

// Function to start auto-scrolling
function startAutoScroll() {
  // Clear any existing interval
  stopAutoScroll();
  
  // Start a new interval
  autoScrollInterval = setInterval(() => {
    const feedContent = document.getElementById('friendly-scroll-content');
    if (feedContent && isReading && !audioElement?.paused) {
      // Get the current element being read (with the "reading" class)
      const currentReadingElement = document.querySelector('.text-paragraph.reading, .text-heading.reading, .text-code.reading');
      
      if (currentReadingElement) {
        // Get the element's position relative to the scroll container
        const containerRect = feedContent.getBoundingClientRect();
        const elementRect = currentReadingElement.getBoundingClientRect();
        
        // Calculate where we want the element to be positioned - aim for 1/3 from the top of the viewport
        // This provides better context by showing more content below what's being read
        const idealPosition = containerRect.height * 0.33;
        const currentPosition = elementRect.top - containerRect.top;
        const adjustment = currentPosition - idealPosition;
        
        // Add this adjustment to the current scroll position for a smooth transition
        const newScrollTop = feedContent.scrollTop + adjustment;
        
        // Smoothly scroll to the new position
        feedContent.scrollTo({
          top: newScrollTop,
          behavior: 'smooth'
        });
      }
      
      // Hide the scroll indicator while auto-scrolling
      const scrollIndicator = document.getElementById('scroll-indicator');
      if (scrollIndicator) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.display = 'none';
      }
    }
  }, 300); // Update more frequently for smoother scrolling
}

// Function to stop auto-scrolling
function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

// Function to stop reading
function stopReading() {
  isReading = false;
  
  // Stop any playing audio
  if (audioElement) {
    audioElement.pause();
    audioElement = null;
  }
  
  // Update the voice button
  const voiceButton = document.getElementById('friendly-scroll-voice');
  if (voiceButton) {
    voiceButton.classList.remove('active');
    voiceButton.classList.remove('paused');
    voiceButton.textContent = 'Read text aloud';
    voiceButton.title = 'Read text aloud';
  }
  
  // Remove voice controls
  const controls = document.getElementById('voice-controls');
  if (controls) {
    controls.parentNode.removeChild(controls);
  }
  
  // Reset the highlighting on all elements
  const elements = document.querySelectorAll('.text-paragraph.reading, .text-heading.reading, .text-code.reading');
  elements.forEach(element => {
    element.classList.remove('reading');
  });
  
  // Restore scroll indicator if needed
  const scrollIndicator = document.getElementById('scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.style.display = 'block';
  }
  
  // Stop auto-scrolling
  stopAutoScroll();
  
  // Run the scroll handler once to update visibility based on current scroll position
  handleScroll();
}

// Function to read the next chunk of text
function readNextChunk() {
  if (!isReading) return;
  
  const textContainer = document.getElementById('friendly-scroll-text');
  const elements = textContainer.querySelectorAll('.text-paragraph, .text-heading, .text-code');
  
  // Check if we've reached the end
  if (currentChunkIndex >= elements.length) {
    stopReading();
    return;
  }
  
  // Get the current element to read
  const currentElement = elements[currentChunkIndex];
  const textToRead = currentElement.textContent.trim();
  
  // Skip empty elements
  if (!textToRead) {
    currentChunkIndex++;
    readNextChunk();
    return;
  }
  
  // Make sure all text elements are visible while reading
  elements.forEach(element => {
    if (!element.classList.contains('visible')) {
      element.classList.add('visible');
    }
  });
  
  // Highlight the current element being read
  elements.forEach(el => el.classList.remove('reading'));
  currentElement.classList.add('reading');
  
  // Hide the scroll indicator when in voice mode
  const scrollIndicator = document.getElementById('scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.style.opacity = '0';
    scrollIndicator.style.display = 'none';
  }
  
  // Instead of using scrollIntoView which jumps around,
  // we'll let the autoScroll function handle scrolling smoothly
  // This ensures consistent scrolling experience during voice reading
  
  // Update progress bar
  updateProgressBar(currentChunkIndex / elements.length);
  
  // Convert text to speech using UNREAL Speech API
  convertTextToSpeech(textToRead)
    .then(audioUrl => {
      // Create audio element if it doesn't exist
      if (!audioElement) {
        audioElement = new Audio();
        
        // Set up event listener for when audio finishes
        audioElement.addEventListener('ended', () => {
          currentChunkIndex++;
          readNextChunk();
        });
      }
      
      // Set the audio source and play
      audioElement.src = audioUrl;
      audioElement.playbackRate = currentPlaybackRate;
      updateSpeedDisplay();
      audioElement.play();
    })
    .catch(error => {
      console.error('Error converting text to speech:', error);
      stopReading();
      
      // Show error message
      alert('Error: ' + error.message);
    });
}

// Function to update the progress bar
function updateProgressBar(progress) {
  const progressBar = document.getElementById('voice-progress-bar');
  if (progressBar) {
    progressBar.style.width = (progress * 100) + '%';
  }
}

// Function to convert text to speech using UNREAL Speech API
async function convertTextToSpeech(text) {
  if (!apiKey) {
    throw new Error('No API key provided');
  }
  
  // Limit text length to avoid API limits
  // UNREAL Speech /stream endpoint has a limit of 1000 characters
  const limitedText = text.substring(0, 1000);
  
  try {
    const response = await fetch('https://api.v7.unrealspeech.com/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Text: limitedText,
        VoiceId: selectedVoiceId,
        Bitrate: '192k',
        Speed: '0',
        Pitch: '1',
        Codec: 'libmp3lame'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || `API error: ${response.status}`);
    }
    
    // Convert the response to a blob
    const audioBlob = await response.blob();
    
    // Create a URL for the blob
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('UNREAL Speech API error:', error);
    throw error;
  }
}

// This function toggles the visibility of our feed
function toggleFeed() {
  const feedContainer = document.getElementById('friendly-scroll-feed');
  const toggleButton = document.getElementById('friendly-scroll-toggle');
  
  if (!feedContainer || !toggleButton) {
    console.error('Feed container or toggle button not found');
    return;
  }
  
  // If we're toggling the feed off, first stop any ongoing reading
  if (feedVisible) {
    if (isReading) {
      stopReading();
    }
    
    // Hide with a smooth fade out animation
    feedContainer.style.opacity = '0';
    feedContainer.style.transform = 'translate(-50%, -48%) scale(0.96)';
    
    // After animation completes, fully hide the container
    setTimeout(() => {
      feedContainer.style.display = 'none';
      toggleButton.style.display = 'flex'; // Show the toggle button
      feedVisible = false;
      
      // Reset the transform so it's ready for next time
      feedContainer.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 400);
  } else {
    // Check if we have content to show
    const textContainer = document.getElementById('friendly-scroll-text');
    const hasContent = textContainer && textContainer.children.length > 0;
    
    // Apply the current font size
    applyFontSize();
    
    if (!hasContent) {
      // Detect current platform and attempt to extract content
      const platform = currentPlatform;
      
      if (platform === 'claude' || platform === 'chatgpt') {
        // Find the most recent AI response
        checkExistingResponses();
      } else {
        // Show a message if we can't find any content
        showNoContentMessage(platform);
        return;
      }
    }
    
    // Set initial state for animation
    feedContainer.style.opacity = '0';
    feedContainer.style.transform = 'translate(-50%, -52%) scale(0.96)';
    feedContainer.style.display = 'flex';
    
    // Trigger animation after a tiny delay to ensure the display change takes effect
    setTimeout(() => {
      feedContainer.style.opacity = '1';
      feedContainer.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
    
    toggleButton.style.display = 'none'; // Hide the toggle button
    feedVisible = true;
    
    // Reset scroll position to top
    const feedContent = document.getElementById('friendly-scroll-content');
    if (feedContent) {
      feedContent.scrollTop = 0;
    }
    
    // Set focus to the feed for keyboard navigation
    feedContainer.focus();
    
    // Reset the scroll indicator visibility
    const scrollIndicator = document.getElementById('scroll-indicator');
    if (scrollIndicator) {
      hasScrolled = false;
      scrollIndicator.style.opacity = '1';
    }
  }
}

// Helper function to show a message when no content is found
function showNoContentMessage(platform = '') {
  const textContainer = document.getElementById('friendly-scroll-text');
  if (textContainer) {
    textContainer.innerHTML = '';
    
    const errorElement = document.createElement('div');
    errorElement.className = 'text-heading visible';
    errorElement.textContent = 'No AI response found';
    textContainer.appendChild(errorElement);
    
    const helpElement = document.createElement('div');
    helpElement.className = 'text-paragraph visible';
    helpElement.textContent = `Please ensure you are on a page with ${platform ? 'a ' + platform : 'an AI'} response. If you continue to see this message, try refreshing the page.`;
    textContainer.appendChild(helpElement);
    
    const debugElement = document.createElement('div');
    debugElement.className = 'text-paragraph visible';
    debugElement.textContent = `Debug info: Platform detected as '${currentPlatform}'. If this seems incorrect, please report this issue.`;
    textContainer.appendChild(debugElement);
  }
}

// This function creates the scrollable feed container and adds it to the page
function createScrollFeed() {
  // Check if the feed already exists
  if (document.getElementById('friendly-scroll-feed')) {
    return;
  }
  
  // Check if dark mode is enabled
  detectDarkMode();
  
  // Create a new div element for our feed
  const feedContainer = document.createElement('div');
  feedContainer.id = 'friendly-scroll-feed';
  
  // Apply dark mode class if needed
  if (isDarkMode) {
    feedContainer.classList.add('dark-mode');
  }
  
  // Add a header to our feed
  const feedHeader = document.createElement('div');
  feedHeader.id = 'friendly-scroll-header';
  
  // Create a container for the header content
  const headerContent = document.createElement('div');
  headerContent.id = 'friendly-scroll-header-content';
  headerContent.textContent = 'Dualspark Reader';
  
  // Create font size controls container
  const fontSizeControls = document.createElement('div');
  fontSizeControls.id = 'font-size-controls';
  
  // Create smaller font size button
  const decreaseFontButton = document.createElement('button');
  decreaseFontButton.id = 'decrease-font-size';
  decreaseFontButton.className = 'font-size-button';
  decreaseFontButton.textContent = 'a';
  decreaseFontButton.title = 'Decrease font size';
  decreaseFontButton.addEventListener('click', decreaseFontSize);
  
  // Disable the decrease button if we're at the minimum font size
  if (currentFontSizeLevel === MIN_FONT_SIZE_LEVEL) {
    decreaseFontButton.classList.add('disabled');
  }
  
  // Create font size indicator
  const fontSizeIndicator = document.createElement('div');
  fontSizeIndicator.id = 'font-size-indicator';
  
  // Create larger font size button
  const increaseFontButton = document.createElement('button');
  increaseFontButton.id = 'increase-font-size';
  increaseFontButton.className = 'font-size-button';
  increaseFontButton.textContent = 'A';
  increaseFontButton.title = 'Increase font size';
  increaseFontButton.addEventListener('click', increaseFontSize);
  
  // Disable the increase button if we're at the maximum font size
  if (currentFontSizeLevel === MAX_FONT_SIZE_LEVEL) {
    increaseFontButton.classList.add('disabled');
  }
  
  // Add buttons to font size controls
  fontSizeControls.appendChild(decreaseFontButton);
  fontSizeControls.appendChild(fontSizeIndicator);
  fontSizeControls.appendChild(increaseFontButton);
  
  // Create a container for the header buttons
  const headerButtons = document.createElement('div');
  headerButtons.id = 'friendly-scroll-header-buttons';
  
  // Add a voice button with updated icon - simpler representation
  const voiceButton = document.createElement('button');
  voiceButton.id = 'friendly-scroll-voice';
  voiceButton.textContent = 'Read Aloud'; // Single text instance
  voiceButton.title = 'Read text aloud';
  voiceButton.addEventListener('click', toggleVoiceReader);
  
  // Add a close button with updated icon - simpler representation
  const closeButton = document.createElement('button');
  closeButton.id = 'friendly-scroll-close';
  closeButton.textContent = '×';
  closeButton.title = 'Close reader';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent the click from being captured by the header
    toggleFeed(); // Use the toggle function instead of directly hiding
  });
  
  // Add the buttons to the header buttons container
  headerButtons.appendChild(voiceButton);
  headerButtons.appendChild(closeButton);
  
  // Add the content and buttons to the header
  feedHeader.appendChild(headerContent);
  feedHeader.appendChild(fontSizeControls);
  feedHeader.appendChild(headerButtons);
  
  // Create the area where text will appear
  const feedContent = document.createElement('div');
  feedContent.id = 'friendly-scroll-content';
  
  // Create a container for the actual text
  const textContainer = document.createElement('div');
  textContainer.id = 'friendly-scroll-text';
  
  // Apply the current font size class to the text container
  textContainer.classList.add(`font-size-${currentFontSizeLevel}`);
  
  // Add a scroll indicator with a more elegant design
  const scrollIndicator = document.createElement('div');
  scrollIndicator.id = 'scroll-indicator';
  scrollIndicator.innerHTML = '<span>Scroll to continue</span> ↓';
  
  // Add the elements to our container
  feedContent.appendChild(textContainer);
  feedContent.appendChild(scrollIndicator);
  
  feedContainer.appendChild(feedHeader);
  feedContainer.appendChild(feedContent);
  
  // Add the container to the page but initially hidden
  feedContainer.style.display = 'none';
  document.body.appendChild(feedContainer);
  
  // Make the feed draggable
  makeDraggable(feedContainer, feedHeader);
  
  // Add scroll event listener to handle the parallax effect
  feedContent.addEventListener('scroll', handleScroll);
  
  // Update the font size indicator
  updateFontSizeIndicator();
  
  console.log('Scroll feed container created (initially hidden)');
}

// Function to handle scroll events in our feed
function handleScroll() {
  // Don't process scroll events if we're reading (auto-scrolling will handle this)
  // But do keep the current reading paragraph visible if the user scrolls manually
  const elements = document.querySelectorAll('.text-paragraph, .text-heading, .text-code');
  const scrollContainer = document.getElementById('friendly-scroll-content');
  
  // Get dimensions
  const containerHeight = scrollContainer.clientHeight;
  const scrollPosition = scrollContainer.scrollTop;
  const totalHeight = scrollContainer.scrollHeight;
  
  // Calculate scroll progress (0 to 1)
  const scrollProgress = Math.min(scrollPosition / (totalHeight - containerHeight), 1);
  
  // Update scroll indicator opacity based on scroll progress
  const scrollIndicator = document.getElementById('scroll-indicator');
  if (scrollIndicator) {
    // If we're in voice mode, always hide it
    if (isReading) {
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.display = 'none';
    } 
    // Hide scroll indicator when approaching the bottom
    else if (scrollProgress > 0.9) {
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.display = 'none';
    } 
    // Show scroll indicator at the top of content if we have more content to scroll
    else if (totalHeight > containerHeight) {
      // Gradually fade out as user scrolls
      scrollIndicator.style.opacity = Math.max(0.9 - scrollProgress, 0).toString();
      scrollIndicator.style.display = 'block';
    }
    // Hide it if there's not enough content to scroll
    else {
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.display = 'none';
    }
  }
  
  // If we're in reading mode, make sure all text is visible
  if (isReading) {
    elements.forEach(element => {
      if (!element.classList.contains('visible')) {
        element.classList.add('visible');
      }
    });
    return; // Skip the rest of the visibility calculations during reading
  }
  
  // For each text element, check visibility and update classes
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    
    // Calculate visibility ratios
    const visibleHeight = Math.min(containerHeight, rect.bottom) - Math.max(0, rect.top);
    const elementHeight = element.offsetHeight;
    const visibilityRatio = visibleHeight / elementHeight;
    
    // Using lower thresholds to make text stay grey longer
    // Only fully reveal when element is completely in view and near the top portion
    const elementTopPosition = rect.top;
    const viewportRelativePosition = elementTopPosition / containerHeight;
    
    // Update classes based on visibility and position
    if (visibilityRatio > 0.95 && viewportRelativePosition < 0.3) {
      // Fully visible AND in the top 30% of the viewport
      element.classList.add('visible');
      element.classList.remove('almost-visible', 'partial-visible', 'barely-visible');
    } else if (visibilityRatio > 0.9 && viewportRelativePosition < 0.5) {
      // Almost visible - 90% visible AND in the top half of viewport
      element.classList.add('almost-visible');
      element.classList.remove('visible', 'partial-visible', 'barely-visible');
    } else if (visibilityRatio > 0.7) {
      // Partially visible - at least 70% visible
      element.classList.add('partial-visible');
      element.classList.remove('visible', 'almost-visible', 'barely-visible');
    } else if (visibilityRatio > 0.3) {
      // Barely visible - at least 30% visible
      element.classList.add('barely-visible');
      element.classList.remove('visible', 'almost-visible', 'partial-visible');
    } else {
      // Not visible enough
      element.classList.remove('visible', 'almost-visible', 'partial-visible', 'barely-visible');
    }
  });
}

// Function to make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    // If we're dragging from the right edge, switch to left positioning
    if (element.offsetLeft < window.innerWidth / 2) {
      element.style.right = 'auto';
    }
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// This function watches for AI responses and processes them
function watchForAIResponses() {
  console.log('Setting up watcher for AI responses');
  
  // First, check if there are already responses on the page
  checkExistingResponses();
  
  // Then set up the observer to watch for new responses
  setupResponseObserver();
}

// This function checks for existing AI responses on the page
function checkExistingResponses() {
  try {
    console.log(`Looking for messages with platform: ${currentPlatform}`);
    
    // PLATFORM-SPECIFIC CONTENT EXTRACTION
    if (currentPlatform === 'claude') {
      // For Claude, try multiple approaches to get content
      
      // First try: Get the full assistant message content
      const fullContentElements = document.querySelectorAll(platformSelectors.claude.fullContentSelector);
      console.log(`Found ${fullContentElements ? fullContentElements.length : 0} full content elements with selector: ${platformSelectors.claude.fullContentSelector}`);
      
      if (fullContentElements && fullContentElements.length > 0) {
        // Use the last full content element (most recent response)
        const latestContent = fullContentElements[fullContentElements.length - 1];
        console.log("Found full content element:", latestContent);
        
        // Create a deep clone of the content to process
        const contentClone = latestContent.cloneNode(true);
        
        // Process this content
        processClaudeFullContent(contentClone);
        return;
      }
      
      // Second try: Get the main prose content
      const proseElements = document.querySelectorAll(platformSelectors.claude.mainContentSelector);
      console.log(`Found ${proseElements ? proseElements.length : 0} prose elements with selector: ${platformSelectors.claude.mainContentSelector}`);
      
      if (proseElements && proseElements.length > 0) {
        // Use the last prose element (most likely the current response)
        const latestContent = proseElements[proseElements.length - 1];
        
        // Create a wrapper to process
        const wrapper = document.createElement('div');
        wrapper.className = 'font-claude-message';
        wrapper.appendChild(latestContent.cloneNode(true));
        
        // Process this content
        processAIResponse(wrapper);
      } else {
        // Fall back to standard message selector
        const messages = document.querySelectorAll(platformSelectors.claude.messageSelector);
        console.log(`Found ${messages ? messages.length : 0} messages with selector: ${platformSelectors.claude.messageSelector}`);
        
        if (messages && messages.length > 0) {
          // Process the last message
          processAIResponse(messages[messages.length - 1]);
        } else {
          // Last attempt: look for any content
          console.log('No standard Claude elements found, looking for any content');
          showNoContentMessage('Claude');
        }
      }
    } else if (currentPlatform === 'chatgpt') {
      // For ChatGPT, look for messages with assistant role
      const messages = document.querySelectorAll(platformSelectors.chatgpt.messageSelector);
      console.log(`Found ${messages ? messages.length : 0} messages with selector: ${platformSelectors.chatgpt.messageSelector}`);
      
      if (messages && messages.length > 0) {
        // Process the last message
        processAIResponse(messages[messages.length - 1]);
      } else {
        // Try to find any markdown content
        const markdowns = document.querySelectorAll(platformSelectors.chatgpt.markdownSelector);
        console.log(`Found ${markdowns ? markdowns.length : 0} markdown elements with selector: ${platformSelectors.chatgpt.markdownSelector}`);
        
        if (markdowns && markdowns.length > 0) {
          // Create a synthetic element
          const syntheticElement = document.createElement('div');
          syntheticElement.setAttribute('data-message-author-role', 'assistant');
          syntheticElement.appendChild(markdowns[markdowns.length - 1].cloneNode(true));
          
          // Process this synthetic element
          processAIResponse(syntheticElement);
        } else {
          // No content found
          console.log('No ChatGPT elements found');
          showNoContentMessage('ChatGPT');
        }
      }
    } else {
      // Unknown platform
      console.log('Unknown platform');
      showNoContentMessage();
    }
  } catch (error) {
    console.error('Error checking existing responses:', error);
    const textContainer = document.getElementById('friendly-scroll-text');
    if (textContainer) {
      textContainer.innerHTML = '';
      const errorElement = document.createElement('div');
      errorElement.className = 'text-heading visible';
      errorElement.textContent = 'Error processing content';
      textContainer.appendChild(errorElement);
      
      const detailElement = document.createElement('div');
      detailElement.className = 'text-paragraph visible';
      detailElement.textContent = `We encountered an error while processing the AI response. Please try refreshing the page.`;
      textContainer.appendChild(detailElement);
    }
  }
}

// Set up an observer to watch for new AI responses
function setupResponseObserver() {
  console.log(`Setting up observer for ${currentPlatform} responses`);
  
  try {
    // Create a new MutationObserver
    const observer = new MutationObserver((mutations) => {
      // Use throttling to prevent too many updates
      if (observerThrottleTimer) {
        return;
      }
      
      observerThrottleTimer = setTimeout(() => {
        try {
          // Don't process mutations if the feed is hidden
          const feed = document.getElementById('friendly-scroll-feed');
          if (feed && feed.style.display === 'none') {
            observerThrottleTimer = null;
            return;
          }
          
          // Don't process if we're already processing
          if (isProcessing) {
            observerThrottleTimer = null;
            return;
          }
          
          // Platform-specific processing
          if (currentPlatform === 'claude') {
            // First, try to find full content elements
            const fullContentElements = document.querySelectorAll(platformSelectors.claude.fullContentSelector);
            
            if (fullContentElements && fullContentElements.length > 0) {
              // Use the last full content element (most recent)
              const latestContent = fullContentElements[fullContentElements.length - 1];
              
              // Process the full content
              processClaudeFullContent(latestContent);
            } else {
              // Fall back to prose content if full content not found
              const proseElements = document.querySelectorAll(platformSelectors.claude.mainContentSelector);
              
              if (proseElements && proseElements.length > 0) {
                // Use the last prose element
                const latestContent = proseElements[proseElements.length - 1];
                
                // Create a wrapper to process
                const wrapper = document.createElement('div');
                wrapper.className = 'font-claude-message';
                wrapper.appendChild(latestContent.cloneNode(true));
                
                // Process this content
                processAIResponse(wrapper);
              } else {
                // Fallback to message selector
                const messages = document.querySelectorAll(platformSelectors.claude.messageSelector);
                
                if (messages && messages.length > 0) {
                  // Process the most recent message
                  processAIResponse(messages[messages.length - 1]);
                }
              }
            }
          } else if (currentPlatform === 'chatgpt') {
            // For ChatGPT, find messages with assistant role
            const messages = document.querySelectorAll(platformSelectors.chatgpt.messageSelector);
            
            if (messages && messages.length > 0) {
              // Process the most recent message
              processAIResponse(messages[messages.length - 1]);
            }
          }
          
          observerThrottleTimer = null;
        } catch (error) {
          console.error('Error in observer processing:', error);
          observerThrottleTimer = null;
        }
      }, 500); // Throttle to once every 500ms
    });
    
    // Configure the observer - use a more efficient configuration
    const config = {
      childList: true,
      subtree: true
    };
    
    // Start observing the document body
    observer.observe(document.body, config);
    
    console.log(`Observer set up for ${currentPlatform} responses`);
  } catch (error) {
    console.error('Error setting up response observer:', error);
  }
}

// This function processes AI responses and extracts the text
function processAIResponse(responseElement) {
  // Set processing flag to prevent multiple simultaneous processing
  if (isProcessing) {
    return;
  }
  
  isProcessing = true;
  console.log(`Processing ${currentPlatform} response:`, responseElement);
  
  try {
    // Handle different platforms differently
    if (currentPlatform === 'chatgpt') {
      // For ChatGPT, find the markdown container directly
      const markdownContainer = responseElement.querySelector(platformSelectors.chatgpt.markdownSelector);
      
      if (markdownContainer) {
        console.log('Found markdown container in ChatGPT response:', markdownContainer);
        
        // Get the full text to check if it's changed
        const fullText = markdownContainer.textContent.trim();
        console.log('Extracted text length:', fullText.length);
        console.log('Text preview:', fullText.substring(0, 100));
        
        // Only update if the text has changed
        if (fullText !== lastProcessedText) {
          console.log('Text has changed, updating feed');
          lastProcessedText = fullText;
          
          // Extract text chunks from the markdown container
          const textChunks = [];
          
          // Process direct children of the markdown container
          const children = markdownContainer.children;
          console.log('Number of markdown children:', children.length);
          
          Array.from(children).forEach((child, index) => {
            const tagName = child.tagName.toLowerCase();
            console.log(`Child ${index} tag: ${tagName}`);
            
            // Process headings
            if (tagName.match(/^h[1-6]$/)) {
              textChunks.push({
                text: child.textContent.trim(),
                type: 'heading'
              });
            }
            // Process paragraphs
            else if (tagName === 'p') {
              textChunks.push({
                text: child.textContent.trim(),
                type: 'paragraph'
              });
            }
            // Process lists
            else if (tagName === 'ul' || tagName === 'ol') {
              const items = child.querySelectorAll('li');
              items.forEach((item, index) => {
                const prefix = tagName === 'ol' ? `${index + 1}. ` : '• ';
                textChunks.push({
                  text: prefix + item.textContent.trim(),
                  type: 'paragraph'
                });
              });
              // Add spacing after list
              textChunks.push({
                text: '',
                type: 'paragraph'
              });
            }
            // Process code blocks
            else if (tagName === 'pre') {
              textChunks.push({
                text: child.textContent.trim(),
                type: 'code'
              });
            }
            // Handle any other element type
            else {
              const text = child.textContent.trim();
              if (text) {
                textChunks.push({
                  text: text,
                  type: 'paragraph'
                });
              }
            }
          });
          
          // If we didn't get any chunks but have text, create a simple paragraph
          if (textChunks.length === 0 && fullText) {
            console.log('No structured content found, falling back to raw text extraction');
            // Updated code with improved handling for paragraph detection
            const textBlocks = fullText
              .split(/(?:\n\n+|\r\n\r\n+)/)  // Split on double newlines first
              .map(block => block.trim())
              .filter(block => block.length > 0);
            
            textBlocks.forEach(block => {
              // Check if block looks like code (indented lines, special characters)
              const isCodeBlock = block.split('\n').length > 1 && 
                                 (block.includes('    ') || 
                                  block.includes('\t') ||
                                  block.includes('{') ||
                                  block.includes('}') ||
                                  block.includes('function') ||
                                  block.includes('class') ||
                                  block.includes('<') && block.includes('>'));
              
              // Check if block looks like a heading (short, no punctuation at end)
              const isHeading = block.length < 100 && 
                               !block.match(/[.,:;]\s*$/) && 
                               !block.includes('\n');
              
              if (isCodeBlock) {
                textChunks.push({
                  text: block,
                  type: 'code'
                });
              } else if (isHeading) {
                textChunks.push({
                  text: block,
                  type: 'heading'
                });
              } else {
                // Normal paragraph - if very long, break it into smaller paragraphs
                if (block.length > 1000) {
                  // Split on sentences to avoid cutting in the middle of a sentence
                  const sentences = block.match(/[^.!?]+(?:[.!?]+(?=\s|$)|\.\.\.|…)/g) || [block];
                  
                  let currentParagraph = '';
                  sentences.forEach(sentence => {
                    if (currentParagraph.length + sentence.length < 1000) {
                      currentParagraph += sentence;
                    } else {
                      if (currentParagraph) {
                        textChunks.push({
                          text: currentParagraph.trim(),
                          type: 'paragraph'
                        });
                      }
                      currentParagraph = sentence;
                    }
                  });
                  
                  // Add the last paragraph if there's content
                  if (currentParagraph) {
                    textChunks.push({
                      text: currentParagraph.trim(),
                      type: 'paragraph'
                    });
                  }
                } else {
                  textChunks.push({
                    text: block,
                    type: 'paragraph'
                  });
                }
              }
            });
          }
          
          console.log('Created text chunks:', textChunks.length);
          
          // Update our feed with these chunks
          updateFeed(textChunks);
        }
      } else {
        console.log('No markdown container found in ChatGPT response, falling back to direct text extraction');
        // Try to extract text directly from the response element
        const fullText = responseElement.textContent.trim();
        if (fullText && fullText !== lastProcessedText) {
          console.log('Extracted full text length:', fullText.length);
          console.log('Text preview:', fullText.substring(0, 100));
          
          lastProcessedText = fullText;
          
          // Updated code with improved handling for paragraph detection
          const textBlocks = fullText
            .split(/(?:\n\n+|\r\n\r\n+)/)  // Split on double newlines first
            .map(block => block.trim())
            .filter(block => block.length > 0);
          
          const textChunks = textBlocks.map(block => ({
            text: block,
            type: 'paragraph'
          }));
          
          console.log('Created text chunks from full text:', textChunks.length);
          
          // Update our feed with these chunks
          updateFeed(textChunks);
        }
      }
    } else if (currentPlatform === 'claude') {
      // CLAUDE-SPECIFIC PROCESSING
      console.log('Processing Claude message');
      
      // Try multiple approaches to extract Claude content
      
      // Approach 1: Find the main prose content first (most reliable)
      let mainContent = null;
      const proseElements = document.querySelectorAll(platformSelectors.claude.mainContentSelector);
      
      if (proseElements.length > 0) {
        // Use the last prose element (most likely the current response)
        mainContent = proseElements[proseElements.length - 1];
        console.log('Found main prose content:', mainContent);
      } else {
        // Fallback: Use the response element directly
        mainContent = responseElement;
        console.log('Using response element directly as main content');
      }
      
      // If we found content to process
      if (mainContent) {
        // Get the full text to check if it's changed
        const fullText = mainContent.textContent.trim();
        
        if (fullText && fullText !== lastProcessedText) {
          console.log('Extracted Claude text length:', fullText.length);
          console.log('Text preview:', fullText.substring(0, 100));
          
          lastProcessedText = fullText;
          
          // Extract text chunks with proper structure
          const textChunks = [];
          
          // Process headings first (h1-h6)
          const headings = mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
          console.log('Found headings:', headings.length);
          
          headings.forEach(heading => {
            const text = heading.textContent.trim();
            if (text) {
              textChunks.push({
                text: text,
                type: 'heading'
              });
            }
          });
          
          // Process paragraphs
          const paragraphs = mainContent.querySelectorAll('p');
          console.log('Found paragraphs:', paragraphs.length);
          
          paragraphs.forEach(paragraph => {
            const text = paragraph.textContent.trim();
            if (text) {
              textChunks.push({
                text: text,
                type: 'paragraph'
              });
            }
          });
          
          // Process lists (both ordered and unordered)
          const lists = mainContent.querySelectorAll('ul, ol');
          console.log('Found lists:', lists.length);
          
          lists.forEach(list => {
            // Get all list items
            const items = list.querySelectorAll('li');
            items.forEach((item, index) => {
              let prefix = list.tagName === 'OL' ? `${index + 1}. ` : '• ';
              const text = prefix + item.textContent.trim();
              if (text) {
                textChunks.push({
                  text: text,
                  type: 'paragraph' // We'll treat list items as paragraphs for styling
                });
              }
            });
            
            // Add an empty paragraph after each list for spacing
            textChunks.push({
              text: '',
              type: 'paragraph'
            });
          });
          
          // Process code blocks
          const codeBlocks = mainContent.querySelectorAll('pre, code');
          console.log('Found code blocks:', codeBlocks.length);
          
          codeBlocks.forEach(block => {
            const text = block.textContent.trim();
            if (text) {
              textChunks.push({
                text: text,
                type: 'code'
              });
            }
          });
          
          // If we didn't get any chunks but have text, create a simple paragraph structure
          if (textChunks.length === 0 && fullText) {
            console.log('No structured content found, falling back to raw text extraction');
            
            // Updated code with improved handling for paragraph detection
            const textBlocks = fullText
              .split(/(?:\n\n+|\r\n\r\n+)/)  // Split on double newlines first
              .map(block => block.trim())
              .filter(block => block.length > 0);
            
            textBlocks.forEach(block => {
              // Check if block looks like code (indented lines, special characters)
              const isCodeBlock = block.split('\n').length > 1 && 
                                 (block.includes('    ') || 
                                  block.includes('\t') ||
                                  block.includes('{') ||
                                  block.includes('}') ||
                                  block.includes('function') ||
                                  block.includes('class') ||
                                  block.includes('<') && block.includes('>'));
              
              // Check if block looks like a heading (short, no punctuation at end)
              const isHeading = block.length < 100 && 
                               !block.match(/[.,:;]\s*$/) && 
                               !block.includes('\n');
              
              if (isCodeBlock) {
                textChunks.push({
                  text: block,
                  type: 'code'
                });
              } else if (isHeading) {
                textChunks.push({
                  text: block,
                  type: 'heading'
                });
              } else {
                // Normal paragraph - if very long, break it into smaller paragraphs
                if (block.length > 1000) {
                  // Split on sentences to avoid cutting in the middle of a sentence
                  const sentences = block.match(/[^.!?]+(?:[.!?]+(?=\s|$)|\.\.\.|…)/g) || [block];
                  
                  let currentParagraph = '';
                  sentences.forEach(sentence => {
                    if (currentParagraph.length + sentence.length < 1000) {
                      currentParagraph += sentence;
                    } else {
                      if (currentParagraph) {
                        textChunks.push({
                          text: currentParagraph.trim(),
                          type: 'paragraph'
                        });
                      }
                      currentParagraph = sentence;
                    }
                  });
                  
                  // Add the last paragraph if there's content
                  if (currentParagraph) {
                    textChunks.push({
                      text: currentParagraph.trim(),
                      type: 'paragraph'
                    });
                  }
                } else {
                  textChunks.push({
                    text: block,
                    type: 'paragraph'
                  });
                }
              }
            });
          }
          
          console.log('Created Claude text chunks:', textChunks.length);
          
          // Update our feed with these chunks
          updateFeed(textChunks);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing ${currentPlatform} response:`, error);
  } finally {
    // Always reset the processing flag
    isProcessing = false;
  }
}

// This function updates our feed with the text chunks
function updateFeed(chunks) {
  console.log('Updating feed with', chunks.length, 'chunks');
  
  // Get our text container
  const textContainer = document.getElementById('friendly-scroll-text');
  if (!textContainer) {
    console.error('Text container element not found');
    return;
  }
  
  // Clear existing content
  textContainer.innerHTML = '';
  revealedLines = 0;
  hasScrolled = false; // Reset the scroll tracking
  
  // Add each chunk to the feed - increased max chunks from 100 to 500
  const maxChunks = Math.min(chunks.length, 500);
  for (let i = 0; i < maxChunks; i++) {
    addTextChunk(chunks[i], i);
  }
  
  // Reset scroll position to top
  const feedContent = document.getElementById('friendly-scroll-content');
  if (feedContent) {
    feedContent.scrollTop = 0;
  }
  
  // Make the first 5 elements visible immediately (increased from 3)
  const elements = textContainer.querySelectorAll('.text-paragraph, .text-heading, .text-code');
  for (let i = 0; i < Math.min(5, elements.length); i++) {
    elements[i].classList.add('visible');
  }
  
  // Show loading indicator if we have more chunks than we're showing
  if (chunks.length > maxChunks) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'text-paragraph visible';
    loadingIndicator.textContent = `(Content truncated, showing ${maxChunks} of ${chunks.length} paragraphs)`;
    textContainer.appendChild(loadingIndicator);
  }
  
  // Apply the current font size
  applyFontSize();
}

// This function adds a text chunk to our feed
function addTextChunk(chunk, index) {
  // Create a new element for this chunk
  const chunkElement = document.createElement('div');
  
  // Apply different styling based on chunk type
  if (chunk.type === 'heading') {
    chunkElement.className = 'text-heading';
  } else if (chunk.type === 'code') {
    chunkElement.className = 'text-code';
  } else {
    chunkElement.className = 'text-paragraph';
  }
  
  chunkElement.textContent = chunk.text;
  
  // Add the chunk to our text container
  const textContainer = document.getElementById('friendly-scroll-text');
  textContainer.appendChild(chunkElement);
}

// Function to process Claude's full content specifically
function processClaudeFullContent(contentWrapper) {
  // Set processing flag to prevent multiple simultaneous processing
  if (isProcessing) {
    return;
  }
  
  isProcessing = true;
  console.log('Processing Claude full content:', contentWrapper);
  
  try {
    // Get the full text
    const fullText = contentWrapper.textContent.trim();
    
    if (fullText && fullText !== lastProcessedText) {
      console.log('Extracted Claude full text length:', fullText.length);
      console.log('Text preview:', fullText.substring(0, 100), '...');
      
      lastProcessedText = fullText;
      
      // Extract all text content with better structure handling
      const textChunks = [];
      
      // Look for all content elements recursively
      const allContentElements = getAllContentElements(contentWrapper);
      console.log(`Found ${allContentElements.length} total content elements in Claude response`);
      
      // Process each element
      allContentElements.forEach(element => {
        const text = element.textContent.trim();
        if (!text) return; // Skip empty elements
        
        const tagName = element.tagName.toLowerCase();
        
        // Determine the type of content
        if (tagName.match(/^h[1-6]$/)) {
          // Heading
          textChunks.push({
            text: text,
            type: 'heading'
          });
        } else if (tagName === 'pre' || tagName === 'code' || element.classList.contains('whitespace-pre')) {
          // Code blocks - including Claude's whitespace-pre class
          textChunks.push({
            text: text,
            type: 'code'
          });
        } else if (tagName === 'li') {
          // List items with appropriate prefix
          const listType = element.parentElement?.tagName === 'OL' ? 'ol' : 'ul';
          let index = 0;
          
          // Get the item's index if it's an ordered list
          if (listType === 'ol') {
            // Find the index of this li among its siblings
            const siblings = Array.from(element.parentElement.children);
            index = siblings.indexOf(element);
          }
          
          const prefix = listType === 'ol' ? `${index + 1}. ` : '• ';
          
          textChunks.push({
            text: prefix + text,
            type: 'paragraph'
          });
        } else if (tagName === 'p' || tagName === 'div' || tagName === 'span') {
          // Regular paragraph content
          textChunks.push({
            text: text,
            type: 'paragraph'
          });
        } else {
          // Other elements
          textChunks.push({
            text: text,
            type: 'paragraph'
          });
        }
      });
      
      // If we didn't get any chunks, fall back to simple text extraction
      if (textChunks.length === 0) {
        console.log('No structured elements found, falling back to simple text extraction');
        
        // Updated code with improved handling for paragraph detection
        const textBlocks = fullText
          .split(/(?:\n\n+|\r\n\r\n+)/)  // Split on double newlines first
          .map(block => block.trim())
          .filter(block => block.length > 0);
        
        textBlocks.forEach(block => {
          // Check if block looks like code (indented lines, special characters)
          const isCodeBlock = block.split('\n').length > 1 && 
                             (block.includes('    ') || 
                              block.includes('\t') ||
                              block.includes('{') ||
                              block.includes('}') ||
                              block.includes('function') ||
                              block.includes('class') ||
                              block.includes('<') && block.includes('>'));
          
          // Check if block looks like a heading (short, no punctuation at end)
          const isHeading = block.length < 100 && 
                           !block.match(/[.,:;]\s*$/) && 
                           !block.includes('\n');
          
          if (isCodeBlock) {
            textChunks.push({
              text: block,
              type: 'code'
            });
          } else if (isHeading) {
            textChunks.push({
              text: block,
              type: 'heading'
            });
          } else {
            // Normal paragraph - if very long, break it into smaller paragraphs
            if (block.length > 1000) {
              // Split on sentences to avoid cutting in the middle of a sentence
              const sentences = block.match(/[^.!?]+(?:[.!?]+(?=\s|$)|\.\.\.|…)/g) || [block];
              
              let currentParagraph = '';
              sentences.forEach(sentence => {
                if (currentParagraph.length + sentence.length < 1000) {
                  currentParagraph += sentence;
                } else {
                  if (currentParagraph) {
                    textChunks.push({
                      text: currentParagraph.trim(),
                      type: 'paragraph'
                    });
                  }
                  currentParagraph = sentence;
                }
              });
              
              // Add the last paragraph if there's content
              if (currentParagraph) {
                textChunks.push({
                  text: currentParagraph.trim(),
                  type: 'paragraph'
                });
              }
            } else {
              textChunks.push({
                text: block,
                type: 'paragraph'
              });
            }
          }
        });
      }
      
      console.log('Created Claude text chunks:', textChunks.length);
      
      // Update our feed with these chunks
      updateFeed(textChunks);
    }
  } catch (error) {
    console.error('Error processing Claude full content:', error);
  } finally {
    // Always reset the processing flag
    isProcessing = false;
  }
}

// Helper function to get all content elements recursively
function getAllContentElements(rootElement) {
  const elements = [];
  // Include more content tags to be thorough
  const contentTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'blockquote', 'div', 'span', 'table', 'tr', 'td', 'th'];
  
  // Function to recursively process nodes
  function processNode(node) {
    // Skip script and style elements
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
      return;
    }
    
    // Check if this node is a content element
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Process all content elements we care about
      if (contentTags.includes(tagName)) {
        // Check if it has direct text (not just containing other elements)
        let hasDirectText = false;
        for (let i = 0; i < node.childNodes.length; i++) {
          if (node.childNodes[i].nodeType === Node.TEXT_NODE && node.childNodes[i].textContent.trim().length > 0) {
            hasDirectText = true;
            break;
          }
        }
        
        // Include the element if it has direct text content or is a container element like list or div with content
        const hasTextContent = node.textContent.trim().length > 0;
        
        // Always capture leaf nodes with content, and selected parent nodes that structure content
        if (hasTextContent && (hasDirectText || 
                               tagName === 'p' || 
                               tagName === 'li' ||
                               tagName === 'pre' ||
                               tagName === 'code' ||
                               tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || 
                               tagName === 'h4' || tagName === 'h5' || tagName === 'h6')) {
          elements.push(node);
        }
      }
      
      // Always process children to find more content
      for (let i = 0; i < node.childNodes.length; i++) {
        processNode(node.childNodes[i]);
      }
    }
  }
  
  // Start processing from the root
  processNode(rootElement);
  
  // If we found no content elements but have text content, create a synthetic paragraph
  if (elements.length === 0 && rootElement.textContent.trim().length > 0) {
    const syntheticParagraph = document.createElement('p');
    syntheticParagraph.textContent = rootElement.textContent.trim();
    elements.push(syntheticParagraph);
  }
  
  return elements;
}

// Function to identify and format poetry content
function identifyAndFormatPoetry(textContent) {
  // Look for patterns that suggest content is poetry - short lines, stanza breaks, etc.
  const lines = textContent.split('\n');
  const shortLineCount = lines.filter(line => line.trim().length > 0 && line.trim().length < 60).length;
  const totalLines = lines.filter(line => line.trim().length > 0).length;
  
  // If more than 60% of non-empty lines are short, likely poetry
  const isLikelyPoetry = totalLines > 4 && (shortLineCount / totalLines) > 0.6;
  
  if (isLikelyPoetry) {
    console.log('Poetry content detected, applying special formatting');
    let formattedHtml = '';
    let inStanza = false;
    
    lines.forEach((line, i) => {
      if (line.trim() === '') {
        if (inStanza) {
          // End of stanza
          formattedHtml += '<div class="text-paragraph poetry-stanza-break"></div>';
          inStanza = false;
        }
      } else {
        inStanza = true;
        formattedHtml += `<div class="text-paragraph poetry-line">${line}</div>`;
      }
    });
    
    return formattedHtml;
  }
  
  return null; // Not identified as poetry
}

// Modified function to process content
function processContentForFeed(content) {
  // First, try to identify if content is poetry
  const poetryContent = identifyAndFormatPoetry(content);
  if (poetryContent) {
    return poetryContent;
  }
  
  // If not poetry, process as regular content
  let processedContent = '';
  // ... existing content processing code ...
  
  // Split the content by paragraphs
  const paragraphs = content.split(/\n\s*\n/);
  
  paragraphs.forEach(paragraph => {
    paragraph = paragraph.trim();
    if (paragraph.length === 0) return;
    
    // Check if this is a heading (starts with # or ##)
    if (paragraph.startsWith('# ') || paragraph.startsWith('## ')) {
      const headingLevel = paragraph.startsWith('# ') ? 1 : 2;
      const headingText = paragraph.substring(headingLevel + 1).trim();
      processedContent += `<div class="text-heading">${headingText}</div>`;
    } 
    // Check if this is a code block (indented with 4 spaces or tab)
    else if (/^( {4}|\t)/.test(paragraph) || paragraph.includes('```')) {
      // Clean up code block formatting
      let code = paragraph;
      if (paragraph.includes('```')) {
        code = paragraph.replace(/```[a-z]*\n?/g, '').replace(/```\n?/g, '');
      }
      code = code.replace(/^( {4}|\t)/gm, '');
      processedContent += `<div class="text-code">${code}</div>`;
    } 
    // Regular paragraph
    else {
      processedContent += `<div class="text-paragraph">${paragraph}</div>`;
    }
  });
  
  return processedContent;
}

// Function to increase font size
function increaseFontSize() {
  if (currentFontSizeLevel < MAX_FONT_SIZE_LEVEL) {
    currentFontSizeLevel++;
    applyFontSize();
    saveFontSizePreference();
    
    // Enable the decrease button if it was disabled
    const decreaseButton = document.getElementById('decrease-font-size');
    if (decreaseButton) {
      decreaseButton.classList.remove('disabled');
    }
    
    // Disable the increase button if we've reached the maximum
    if (currentFontSizeLevel === MAX_FONT_SIZE_LEVEL) {
      const increaseButton = document.getElementById('increase-font-size');
      if (increaseButton) {
        increaseButton.classList.add('disabled');
      }
    }
  }
}

// Function to decrease font size
function decreaseFontSize() {
  if (currentFontSizeLevel > MIN_FONT_SIZE_LEVEL) {
    currentFontSizeLevel--;
    applyFontSize();
    saveFontSizePreference();
    
    // Enable the increase button if it was disabled
    const increaseButton = document.getElementById('increase-font-size');
    if (increaseButton) {
      increaseButton.classList.remove('disabled');
    }
    
    // Disable the decrease button if we've reached the minimum
    if (currentFontSizeLevel === MIN_FONT_SIZE_LEVEL) {
      const decreaseButton = document.getElementById('decrease-font-size');
      if (decreaseButton) {
        decreaseButton.classList.add('disabled');
      }
    }
  }
}

// Function to apply the current font size to the text container
function applyFontSize() {
  const textContainer = document.getElementById('friendly-scroll-text');
  if (textContainer) {
    // Remove all font size classes
    for (let i = MIN_FONT_SIZE_LEVEL; i <= MAX_FONT_SIZE_LEVEL; i++) {
      textContainer.classList.remove(`font-size-${i}`);
    }
    
    // Add the current font size class
    textContainer.classList.add(`font-size-${currentFontSizeLevel}`);
    
    // Update the indicator
    updateFontSizeIndicator();
    
    // Update button states
    updateFontSizeButtonStates();
  }
}

// Function to update the font size indicator
function updateFontSizeIndicator() {
  const indicator = document.getElementById('font-size-indicator');
  if (indicator) {
    const percentage = ((currentFontSizeLevel - MIN_FONT_SIZE_LEVEL) / 
                        (MAX_FONT_SIZE_LEVEL - MIN_FONT_SIZE_LEVEL)) * 100;
    // We can't directly access pseudo-elements with JS, so we'll use a CSS variable instead
    indicator.style.setProperty('--indicator-width', `${percentage}%`);
    
    // Update the indicator color to show progression
    if (currentFontSizeLevel > 5) {
      // For larger font sizes, gradually change color to indicate "large" setting
      const intensity = Math.min(100, (currentFontSizeLevel - 5) * 20); // 0-100 scale
      const intensityRatio = intensity/100;
      indicator.style.setProperty('--indicator-color', `rgba(201, 100, 66, ${intensityRatio})`);
    } else {
      // Reset to default color for normal sizes
      indicator.style.setProperty('--indicator-color', '#555');
    }
  }
}

// Function to update the font size button states
function updateFontSizeButtonStates() {
  const decreaseButton = document.getElementById('decrease-font-size');
  const increaseButton = document.getElementById('increase-font-size');
  
  if (decreaseButton) {
    if (currentFontSizeLevel === MIN_FONT_SIZE_LEVEL) {
      decreaseButton.classList.add('disabled');
    } else {
      decreaseButton.classList.remove('disabled');
    }
  }
  
  if (increaseButton) {
    if (currentFontSizeLevel === MAX_FONT_SIZE_LEVEL) {
      increaseButton.classList.add('disabled');
    } else {
      increaseButton.classList.remove('disabled');
    }
  }
}

// Function to save the font size preference
function saveFontSizePreference() {
  try {
    // Check if chrome.storage is available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ fontSizeLevel: currentFontSizeLevel }, function() {
        console.log('Font size preference saved:', currentFontSizeLevel);
      });
    } else {
      // Use localStorage as fallback when Chrome API is not available
      localStorage.setItem('friendlyScrollFontSize', currentFontSizeLevel);
      console.log('Font size preference saved to localStorage:', currentFontSizeLevel);
    }
  } catch (error) {
    console.error('Error saving font size preference:', error);
  }
}

// Function to detect if dark mode is enabled
function detectDarkMode() {
  // Check if we're on Claude
  if (currentPlatform === 'claude') {
    // Look for dark mode indicators on Claude
    const isDark = document.documentElement.classList.contains('dark') || 
                   document.body.classList.contains('dark') ||
                   document.querySelector('html[data-theme="dark"]') !== null ||
                   document.querySelector('.dark-theme') !== null ||
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // If dark mode status changed, update the UI
    if (isDark !== isDarkMode) {
      isDarkMode = isDark;
      console.log('Dark mode detected:', isDarkMode);
      updateDarkModeUI();
    }
    
    return isDark;
  }
  
  // For ChatGPT or other platforms, use a simpler check
  const isDark = document.documentElement.classList.contains('dark') || 
                 document.body.classList.contains('dark') ||
                 document.querySelector('.dark') !== null ||
                 window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // If dark mode status changed, update the UI
  if (isDark !== isDarkMode) {
    isDarkMode = isDark;
    console.log('Dark mode detected:', isDarkMode);
    updateDarkModeUI();
  }
  
  return isDark;
}

// Function to update UI based on dark mode
function updateDarkModeUI() {
  // Update toggle button icon
  updateToggleButtonIcon();
  
  // Update reader background if it exists
  updateReaderBackground();
}

// Function to update the toggle button icon based on dark mode
function updateToggleButtonIcon() {
  const toggleButton = document.getElementById('friendly-scroll-toggle');
  if (!toggleButton) return;
  
  const iconImg = toggleButton.querySelector('img');
  if (!iconImg) return;
  
  // Use white icon for dark mode, black icon for light mode
  if (isDarkMode) {
    iconImg.src = chrome.runtime.getURL('icons/icon-white.png');
  } else {
    iconImg.src = chrome.runtime.getURL('icons/icon128.png');
  }
}

// Function to update the reader background based on dark mode
function updateReaderBackground() {
  const feedContainer = document.getElementById('friendly-scroll-feed');
  if (!feedContainer) return;
  
  if (isDarkMode) {
    feedContainer.classList.add('dark-mode');
  } else {
    feedContainer.classList.remove('dark-mode');
  }
}

// Set up observer to detect dark mode changes
function setupDarkModeObserver() {
  // First check for initial state
  detectDarkMode();
  
  // Set up a mutation observer to watch for class changes on the body and html elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
        detectDarkMode();
        break;
      }
    }
  });
  
  // Observe both html and body elements for class changes
  observer.observe(document.documentElement, { attributes: true });
  observer.observe(document.body, { attributes: true });
  
  // Also set up a media query listener for system preference changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => detectDarkMode());
  
  console.log('Dark mode observer set up');
}

// Function to load the saved font size preference
function loadFontSizePreference() {
  try {
    // Try to load from Chrome storage first
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get('fontSizeLevel', function(data) {
        if (data.fontSizeLevel) {
          currentFontSizeLevel = data.fontSizeLevel;
          console.log('Font size preference loaded from Chrome storage:', currentFontSizeLevel);
          applyFontSize();
        }
      });
    } else {
      // Fall back to localStorage
      const savedSize = localStorage.getItem('friendlyScrollFontSize');
      if (savedSize) {
        currentFontSizeLevel = parseInt(savedSize, 10);
        console.log('Font size preference loaded from localStorage:', currentFontSizeLevel);
        applyFontSize();
      }
    }
  } catch (error) {
    console.error('Error loading font size preference:', error);
  }
} 