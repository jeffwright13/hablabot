# HablaBot - AI-Powered Spanish Conversation Tutor

HablaBot is a Progressive Web App (PWA) that provides interactive Spanish conversation practice through AI-powered voice conversations. Built entirely client-side using vanilla JavaScript, it works on all devices without requiring app store downloads.

## Features

- **AI Conversation Partner**: Practice Spanish with María, your AI tutor powered by OpenAI GPT-4
- **Voice Interaction**: Real-time speech recognition and synthesis for natural conversations
- **Spaced Repetition**: Smart vocabulary learning using the SM-2 algorithm
- **Progressive Web App**: Install on any device, works offline
- **Privacy-First**: All data stays on your device, no cloud storage
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Multiple Scenarios**: Practice in restaurants, travel, shopping, and more
- **Adaptive Difficulty**: Adjusts to your Spanish proficiency level

## Quick Start

### Prerequisites

1. **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
2. **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/api-keys)
3. **Microphone Access**: Required for voice conversations
4. **HTTPS Connection**: Required for speech recognition (use local server or deploy)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/hablabot.git
   cd hablabot
   ```

2. **Serve the files** (required for HTTPS and service worker):
   
   **Option A: Using Python**:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```
   
   **Option B: Using Node.js**:
   ```bash
   npx serve .
   ```
   
   **Option C: Using Live Server (VS Code)**:
   - Install the Live Server extension
   - Right-click `index.html` and select "Open with Live Server"

3. **Open in browser**:
   - Navigate to `http://localhost:8000` (or the URL provided by your server)
   - Accept microphone permissions when prompted

4. **Configure OpenAI API Key**:
   - Go to Settings tab
   - Enter your OpenAI API key
   - Click "Test" to verify it works

5. **Start learning**:
   - Go to Conversation tab
   - Choose a scenario and difficulty level
   - Click "Start Conversation"
   - Hold the microphone button and speak in Spanish!

## Installation as PWA

### On Mobile (iOS/Android):
1. Open HablaBot in your mobile browser
2. Look for "Add to Home Screen" option in browser menu
3. Follow the prompts to install

### On Desktop:
1. Open HablaBot in Chrome/Edge
2. Look for the install icon in the address bar
3. Click to install as a desktop app

## How to Use

### Starting a Conversation
1. **Choose Scenario**: Select from restaurant, travel, shopping, family, work, health, or emergency
2. **Set Difficulty**: Beginner, intermediate, or advanced
3. **Session Length**: 5-30 minutes
4. **Start**: Click "Start Conversation"

### During Conversation
- **Hold to Speak**: Press and hold the microphone button while speaking
- **Listen**: María will respond in Spanish with natural pronunciation
- **Practice**: Use target vocabulary words naturally in conversation
- **Progress**: Watch your word usage and time remaining

### Managing Vocabulary
1. **Add Words**: Go to Vocabulary tab → "Add New Word"
2. **Import CSV**: Bulk import vocabulary from spreadsheet
3. **Review**: Practice words due for review based on spaced repetition
4. **Track Progress**: See mastery levels and statistics

### Viewing Progress
- **Statistics**: Total words, mastery levels, conversation time
- **Charts**: Daily progress and vocabulary mastery trends
- **History**: Review past conversation sessions

## Configuration

### Settings Options

**API Configuration**:
- OpenAI API Key (required for conversations)

**Voice Settings**:
- Spanish voice selection
- Speech rate (0.5x - 2.0x)
- Volume level

**Learning Preferences**:
- Correction frequency
- New words per session
- Session length

### Browser Permissions

HablaBot requires these permissions:
- **Microphone**: For speech recognition
- **Storage**: For saving vocabulary and progress
- **Notifications**: For study reminders (optional)

## Data Management

### Export Data
- Go to Settings → "Export All Data"
- Downloads JSON file with all your data
- Use for backup or transferring to another device

### Import Data
- Go to Settings → "Import Data"
- Upload previously exported JSON file
- Restores vocabulary, settings, and progress

### Privacy
- All data stored locally in your browser
- No data sent to external servers except OpenAI API calls
- API key encrypted in local storage
- Conversation history optional and local only

## Technical Details

### Architecture
- **Frontend**: Pure HTML5/CSS3/JavaScript ES6+
- **Speech**: Web Speech API with fallback options
- **AI**: OpenAI GPT-4 API for conversations
- **Storage**: IndexedDB for local data persistence
- **PWA**: Service Worker for offline functionality

### Browser Support
- Chrome 60+ (recommended)
- Firefox 55+
- Safari 14+
- Edge 79+

### File Structure
```
hablabot/
├── index.html              # Main app entry point
├── manifest.json           # PWA manifest
├── sw.js                  # Service worker
├── css/
│   ├── main.css           # Main styles
│   ├── mobile.css         # Mobile-responsive styles
│   └── animations.css     # UI animations
├── js/
│   ├── app.js             # Main application controller
│   ├── speech/            # Speech recognition & synthesis
│   ├── ai/                # AI conversation engine
│   ├── vocabulary/        # Vocabulary & spaced repetition
│   ├── storage/           # IndexedDB management
│   ├── ui/                # UI components & state
│   └── utils/             # Utilities & helpers
└── assets/                # Icons, sounds, images
```

## Troubleshooting

### Common Issues

**Microphone not working**:
- Ensure HTTPS connection (required for speech recognition)
- Check browser permissions
- Try refreshing the page
- Test microphone in browser settings

**API key errors**:
- Verify key is correct and active
- Check OpenAI account has credits
- Ensure key has GPT-4 access

**Speech recognition issues**:
- Speak clearly and at normal pace
- Reduce background noise
- Try different Spanish accent settings
- Check browser speech recognition support

**App not loading**:
- Clear browser cache and cookies
- Disable browser extensions
- Try incognito/private mode
- Check browser console for errors

### Getting Help

1. Check browser console for error messages
2. Verify all requirements are met
3. Try in different browser
4. Check GitHub issues for known problems

## Contributing

We welcome contributions! Please see our contributing guidelines for:
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for GPT-4 API
- Web Speech API contributors
- SM-2 spaced repetition algorithm
- Spanish language learning community

## Roadmap

- [ ] Additional language support
- [ ] Voice cloning for personalized tutors
- [ ] Grammar correction and feedback
- [ ] Conversation analytics and insights
- [ ] Social features and challenges
- [ ] Integration with popular language learning platforms
