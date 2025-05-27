// 1. Define Sample Subtitle Data
const sampleSubtitles = [
    { startTime: 1, text: "This is the first line." },
    { startTime: 4, text: "And now for something completely different." },
    { startTime: 7, text: "A man with three buttocks." },
    { startTime: 10, text: "It's a silly video, I know." },
    { startTime: 13, text: "Hope you enjoyed it!"}
];

// 2. YouTube Player Setup
var player;
var subtitleInterval; // To store the interval ID

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: 'M7lc1UVf-VE', // A short CC-licensed video, replace if needed
        playerVars: {
            'playsinline': 1
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

// 3. Subtitle Display Logic
const subtitlesDisplay = document.getElementById('subtitles-display');

function displaySubtitles(currentTime) {
    if (!subtitlesDisplay) {
        console.error("Subtitles display element not found!");
        return;
    }
    subtitlesDisplay.innerHTML = ''; // Clear current subtitles

    for (let i = 0; i < sampleSubtitles.length; i++) {
        const subtitle = sampleSubtitles[i];
        const p = document.createElement('p');
        p.textContent = subtitle.text;
        p.setAttribute('data-start-time', subtitle.startTime); // For potential future use

        // Determine if this subtitle should be highlighted
        const nextSubtitle = sampleSubtitles[i + 1];
        if (currentTime >= subtitle.startTime && (!nextSubtitle || currentTime < nextSubtitle.startTime)) {
            p.classList.add('highlight');
        }

        subtitlesDisplay.appendChild(p);
    }
}

// 4. Link Subtitles to Video Playback
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        subtitleInterval = setInterval(() => {
            const currentTime = player.getCurrentTime();
            displaySubtitles(currentTime);
        }, 500); // Update every 500ms
    } else {
        // Clear interval if video is paused, ended, or in another state
        clearInterval(subtitleInterval);
    }
}

// 5. Initial Subtitle Display
// Ensure DOM is loaded before trying to access subtitles-display
document.addEventListener('DOMContentLoaded', (event) => {
    // Re-assign subtitlesDisplay in case the script ran before the DOM element was ready
    // Although in modern browsers with script at the end of body, this might be redundant
    // but it's a good safety measure.
    const localSubtitlesDisplay = document.getElementById('subtitles-display');
    if (localSubtitlesDisplay) {
         displaySubtitles(0); // Display all subtitles initially, nothing highlighted
    } else {
        console.error("Subtitles display element not found on DOMContentLoaded!");
    }

    // Microphone Recording Logic & STT
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const audioPlayback = document.getElementById('audioPlayback');
    const sttOutput = document.getElementById('stt-output');
    const scoreDisplay = document.getElementById('score-display'); // 1. Get score-display DOM element

    let mediaRecorder;
    let audioChunks = [];
    let recognition;
    let audioStream; // Shared audio stream
    let recognitionActive = false; // Flag to track SpeechRecognition state

    // Levenshtein Distance Function
    function calculateLevenshteinDistance(str1, str2) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();

        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));

        for (let i = 0; i <= m; i++) {
            dp[i][0] = i;
        }
        for (let j = 0; j <= n; j++) {
            dp[0][j] = j;
        }

        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= m; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // Deletion
                    dp[i][j - 1] + 1,      // Insertion
                    dp[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        return dp[m][n];
    }

    // Calculate Score Function
    function calculateScore(originalText, userText) {
        if (!originalText || !userText) return 0; // Handle empty inputs
        const distance = calculateLevenshteinDistance(originalText, userText);
        const maxLength = Math.max(originalText.length, userText.length);
        if (maxLength === 0) return 100; // Both strings are empty

        const score = Math.max(0, (1 - (distance / maxLength))) * 100;
        return Math.round(score);
    }


    // SpeechRecognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            recognitionActive = true;
            if (sttOutput) sttOutput.innerHTML = "<p>Listening...</p>";
            startRecordBtn.disabled = true;
            stopRecordBtn.disabled = false;
            console.log("Speech recognition started.");
        };

        recognition.onresult = (event) => {
            const userTranscript = event.results[0][0].transcript;
            if (sttOutput) {
                sttOutput.innerHTML = `<p>${userTranscript}</p>`;
            }

            // 4. Integrate Scoring
            const highlightedSubtitleElement = document.querySelector('#subtitles-display .highlight');
            if (highlightedSubtitleElement) {
                const originalSubtitleText = highlightedSubtitleElement.textContent;
                const score = calculateScore(originalSubtitleText, userTranscript);
                if (scoreDisplay) {
                    scoreDisplay.textContent = `Score: ${score}/100`;
                }
            } else {
                if (scoreDisplay) {
                    scoreDisplay.textContent = 'Score: (No target sentence selected)';
                }
                console.log("No highlighted subtitle found to compare against.");
            }
        };

        recognition.onerror = (event) => {
            recognitionActive = false;
            let errorMessage = "Speech recognition error: " + event.error;
            if (event.error === 'no-speech') {
                errorMessage = "No speech was detected. Please try again.";
            } else if (event.error === 'audio-capture') {
                errorMessage = "Audio capture error. Ensure your microphone is working.";
            } else if (event.error === 'not-allowed') {
                errorMessage = "Microphone access denied. Please allow microphone access.";
            }
            if (sttOutput) {
                sttOutput.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
            }
            console.error(errorMessage, event);
            checkStopConditions();
        };

        recognition.onend = () => {
            recognitionActive = false;
            console.log("Speech recognition ended.");
            checkStopConditions();
        };

    } else {
        console.warn("Speech recognition not supported in this browser.");
        if (sttOutput) {
            sttOutput.innerHTML = "<p>Speech recognition not supported. Audio recording may still work.</p>";
        }
    }

    async function startRecording() {
        if (startRecordBtn.disabled) return; // Already recording or starting

        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = []; // Reset audio chunks

            // MediaRecorder setup (for audio playback)
            if (typeof MediaRecorder !== 'undefined') {
                mediaRecorder = new MediaRecorder(audioStream);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log("MediaRecorder stopped.");
                    if (audioChunks.length > 0) {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        audioPlayback.src = audioUrl;
                    }
                    checkStopConditions();
                };
                mediaRecorder.start();
                console.log("MediaRecorder started.");
            } else {
                 console.warn("MediaRecorder not supported. Audio playback will not be available.");
            }

            // SpeechRecognition start
            if (recognition) {
                recognition.start(); // onstart will handle its button states
            } else {
                // If no speech recognition, manage buttons here for MediaRecorder
                startRecordBtn.disabled = true;
                stopRecordBtn.disabled = false;
            }

        } catch (error) {
            console.error("Microphone access denied or error:", error);
            alert("Microphone access denied or error: " + error.message);
            startRecordBtn.disabled = false;
            stopRecordBtn.disabled = true;
            if (sttOutput) {
                sttOutput.innerHTML = `<p style="color: red;">Could not start recording: ${error.message}</p>`;
            }
            audioStream = null; // Clear stream if it failed
        }
    }

    function stopRecording() {
        if (stopRecordBtn.disabled) return; // Already stopped or stopping

        let sttStopped = false;
        let mrStopped = false;

        if (recognitionActive) {
            recognition.stop(); // onend will call checkStopConditions
            sttStopped = true;
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); // onstop will call checkStopConditions
            mrStopped = true;
        }
        
        // If neither was active when stop was called (e.g. called multiple times, or before full start)
        // or if one was active but the other isn't supported/used and didn't trigger a stop sequence.
        if (!sttStopped && !mrStopped) {
            console.log("Neither STT nor MediaRecorder was actively stopped by stopRecording(). Forcing button reset and stream check.");
            startRecordBtn.disabled = false;
            stopRecordBtn.disabled = true;
            checkStopConditions(); // Ensure stream is released if applicable
        }
    }

    function checkStopConditions() {
        const mediaRecorderInactive = !mediaRecorder || mediaRecorder.state === "inactive";
        const recognitionInactive = !recognitionActive;

        if (mediaRecorderInactive && recognitionInactive) {
            console.log("Both MediaRecorder and SpeechRecognition are inactive.");
            startRecordBtn.disabled = false;
            stopRecordBtn.disabled = true;
            if (sttOutput && sttOutput.innerHTML.includes("Listening...")) {
                 sttOutput.innerHTML = "<p>Recording stopped. Error occurred.</p>";
            }
            if (scoreDisplay) {
                scoreDisplay.textContent = 'Score: -'; // Reset score on error
            }

            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
                console.log("Microphone stream stopped and released.");
            }
        }
    }

    if (startRecordBtn && stopRecordBtn) {
        startRecordBtn.addEventListener('click', startRecording);
        stopRecordBtn.addEventListener('click', stopRecording);
    } else {
        console.error("Recording buttons not found!");
    }
});
