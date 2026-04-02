// (() => {
//     if (window.__YOUDUB_CONTENT_SCRIPT_LOADED) {
//         console.log("YouDub Content Script already running");
//         return;
//     }
//     window.__YOUDUB_CONTENT_SCRIPT_LOADED = true;

//     let currentVideo = null;
//     let originalVolume = 1.0;

//     // Reliable + async video detector
//     async function getYouTubeVideoElement(timeout = 15000) {
//         const startTime = Date.now();

//         while (Date.now() - startTime < timeout) {
//             const video = document.querySelector('video.html5-main-video') ||
//                           document.querySelector('#movie_player video');

//             if (video && video.readyState >= 1) {   // metadata loaded
//                 return video;
//             }

//             await new Promise(r => setTimeout(r, 300));
//         }

//         console.warn("YouDub: Video element not found after timeout");
//         return null;
//     }

//     // Message listener
//     chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//         switch (msg.type) {
//             case "MUTE_VIDEO":
//                 // handleMute(sendResponse);
//                 console.log("🔇 Mute request received - SKIPPED for debugging");
//                 sendResponse({ success: true, status: "mute_skipped_for_debug" });
//                 break;

//             case "UNMUTE_VIDEO":
//                 // handleUnmute(sendResponse);
//                 console.log("🔊 Unmute request received - SKIPPED for debugging");
//                 sendResponse({ success: true, status: "unmute_skipped_for_debug" });
//                 break;

//             case "START_SELF_DUB_INTERNAL":
//                 startSelfVoiceDub();
//                 sendResponse({ success: true });
//                 break;

//             case "STOP_SELF_DUB_INTERNAL":
//                 stopSelfVoiceDub();
//                 sendResponse({ success: true });
//                 break;

//             default:
//                 sendResponse({ success: false, error: "unknown_type" });
//         }
//         return true; // Keep channel open for async response
//     });

//     async function handleMute(sendResponse) {
//         let video = currentVideo;

//         if (!video) {
//             video = await getYouTubeVideoElement(8000);
//         }

//         if (video) {
//             originalVolume = video.volume;     // Save original volume
//             video.muted = true;
//             video.volume = 0;
//             currentVideo = video;

//             console.log("✅ YouDub: Video muted");
//             sendResponse({ success: true, status: "muted" });
//         } else {
//             console.warn("⚠️ YouDub: No video element found for muting");
//             sendResponse({ success: false, status: "no_video_found" });
//         }
//     }

//     async function handleUnmute(sendResponse) {
//         let video = currentVideo;

//         if (!video) {
//             video = await getYouTubeVideoElement(5000);
//         }

//         if (video) {
//             video.muted = false;
//             video.volume = originalVolume;     // Restore original volume
//             console.log("✅ YouDub: Video unmuted");
//             sendResponse({ success: true, status: "unmuted" });
//         } else {
//             sendResponse({ success: false, status: "no_video" });
//         }
//     }

//     // Lighter MutationObserver (only when needed)
//     const observer = new MutationObserver(async () => {
//         if (!currentVideo) {
//             const video = document.querySelector('video.html5-main-video') ||
//                           document.querySelector('#movie_player video');
//             if (video && video.readyState >= 1) {
//                 currentVideo = video;
//                 console.log("🎥 YouDub: Video element auto-detected");
//             }
//         }
//     });
//     // ====================== SELF VOICE DUB (Microphone in Content Script) ======================
// let selfMicStream = null;
// let selfMediaRecorder = null;
// let selfRecordedChunks = [];
// let selfSilenceTimeout = null;
// let isSelfDubbingActive = false;


// async function startSelfVoiceDub() {
//     try {
//         console.log("🎤 Self Voice Dub: Requesting microphone...");

//         selfMicStream = await navigator.mediaDevices.getUserMedia({
//             audio: {
//                 echoCancellation: true,
//                 noiseSuppression: true,
//                 sampleRate: 16000
//             }
//         });

//         isSelfDubbingActive = true;
//         selfRecordedChunks = [];

//         selfMediaRecorder = new MediaRecorder(selfMicStream, {
//             mimeType: "audio/webm;codecs=opus"
//         });

//         selfMediaRecorder.ondataavailable = (e) => {
//             if (e.data.size > 0) selfRecordedChunks.push(e.data);
//         };

//         selfMediaRecorder.start(500);

//         resetSilenceTimer();

//         console.log("✅ Self Voice Dub: Listening to microphone");

//     } catch (err) {
//         console.error("Microphone access error:", err);
//         chrome.runtime.sendMessage({ 
//             type: "SELF_DUB_ERROR", 
//             error: "Microphone permission denied or unavailable." 
//         });
//     }
// }

// function resetSilenceTimer() {
//     if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

//     selfSilenceTimeout = setTimeout(() => {
//         if (isSelfDubbingActive) {
//             console.log("🛑 5 seconds silence detected → Processing audio");
//             processSelfRecordedAudio();
//         }
//     }, 5000);
// }

// function stopSelfVoiceDub() {
//     if (selfMediaRecorder) selfMediaRecorder.stop();
//     if (selfMicStream) selfMicStream.getTracks().forEach(track => track.stop());
//     if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

//     isSelfDubbingActive = false;
//     console.log("⏹️ Self Voice Dub stopped");
// }

// async function processSelfRecordedAudio() {
//     if (selfRecordedChunks.length === 0) {
//         chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
//         return;
//     }

//     isSelfDubbingActive = false;
//     chrome.runtime.sendMessage({ type: "SELF_DUB_PROCESSING" });

//     try {
//         const audioBlob = new Blob(selfRecordedChunks, { type: "audio/webm" });
//         const arrayBuffer = await audioBlob.arrayBuffer();

//         const audioContext = new AudioContext();
//         const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
//         const audioData = audioBuffer.getChannelData(0);

//         // Send audio data to Offscreen for Whisper processing
//         chrome.runtime.sendMessage({
//             type: "PROCESS_SELF_AUDIO",
//             audioData: Array.from(audioData)   // Convert to array for messaging
//         });

//     } catch (err) {
//         console.error("Self dub processing error:", err);
//         chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
//     }
// }

//     // Start observing only after a small delay
//     setTimeout(() => {
//         observer.observe(document.body, { 
//             childList: true, 
//             subtree: true 
//         });
//     }, 1000);

//     console.log("🎥 YouDub Content Script Loaded Successfully");

//     // Cleanup
//     window.addEventListener('beforeunload', () => {
//         observer.disconnect();
//     });
// })();


// ====================== SELF VOICE DUB (Manual Control) ======================
let selfMicStream = null;
let selfMediaRecorder = null;
let selfRecordedChunks = [];
let isSelfDubbingActive = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_SELF_DUB_INTERNAL") {
        startSelfVoiceDub();
        sendResponse({ success: true });
    }
    if (msg.type === "STOP_SELF_DUB_INTERNAL") {
        stopSelfVoiceDub();
        sendResponse({ success: true });
    }
});

async function startSelfVoiceDub() {
    try {
        console.log("🎤 Self Voice Dub: Starting microphone...");

        selfMicStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 16000
            }
        });

        isSelfDubbingActive = true;
        selfRecordedChunks = [];

        selfMediaRecorder = new MediaRecorder(selfMicStream, {
            mimeType: "audio/webm;codecs=opus"
        });

        selfMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) selfRecordedChunks.push(e.data);
        };

        selfMediaRecorder.start(400);

        console.log("✅ Self Voice Dub: Listening... (Click button again to stop & dub)");

    } catch (err) {
        console.error("Microphone access error:", err);
        chrome.runtime.sendMessage({ 
            type: "SELF_DUB_ERROR", 
            error: "Microphone permission denied or unavailable." 
        });
    }
}

function stopSelfVoiceDub() {
    if (selfMediaRecorder) {
        selfMediaRecorder.stop();
    }
    if (selfMicStream) {
        selfMicStream.getTracks().forEach(track => track.stop());
    }

    isSelfDubbingActive = false;
    console.log("⏹️ Self Voice Dub: Stopped. Processing audio...");

    // Process the recorded audio
    setTimeout(() => {
        processSelfRecordedAudio();
    }, 300); // Small delay to ensure last chunk is saved
}

async function processSelfRecordedAudio() {
    if (selfRecordedChunks.length === 0) {
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
        return;
    }

    chrome.runtime.sendMessage({ type: "SELF_DUB_PROCESSING" });

    try {
        const audioBlob = new Blob(selfRecordedChunks, { type: "audio/webm" });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer).catch(err => {
            console.error("decodeAudioData failed:", err);
            throw err;
        });
        const audioData = audioBuffer.getChannelData(0);

        console.log(`✅ Audio decoded | Duration: ${audioBuffer.duration.toFixed(2)}s | Samples: ${audioData.length}`);

        chrome.runtime.sendMessage({
            type: "PROCESS_SELF_AUDIO",
            audioData: Array.from(audioData)
        });

    } catch (err) {
        console.error("Self dub processing error:", err);
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
    }
}















// Inside offscreen.js message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SET_VIDEO_SYNC") {
        // Forward the sync time to the AudioWorklet thread
        if (workletNode) {
            workletNode.port.postMessage({
                type: "SET_SYNC_INTERNAL",
                startTime: msg.startTime
            });
        }
    }
    // ... existing START_STREAM logic ...
});

// Update the Worklet onmessage handler inside initializeAudioPipeline
workletNode.port.onmessage = async (event) => {
    const msg = event.data;
    if (msg?.type === "audio_chunk") {
        // Pass the timestamps into the AI processing function
        processChunk(msg.data, currentLanguage, msg.ytStart, msg.ytEnd);
    }
};

async function processChunk(audioData, language, ytStart, ytEnd) {
    try {
        const result = await transcriber(audioData, {
            language: language,
            task: "translate"
        });

        const text = result.text.trim();
        if (text.length > 5) {
            console.log(`[${ytStart.toFixed(2)}s - ${ytEnd.toFixed(2)}s] Translation: ${text}`);
            
            // Send back to content script or handle synchronized playback here
            handleSynchronizedPlayback(text, ytStart);
        }
    } catch (e) { console.error(e); }
}

//doubt here how it ensures we synchronize at exaclty at that time stamp.
function handleSynchronizedPlayback(text, targetStartTime) {
    // Basic logic: If we are late, speed up the voice
    const utterance = new SpeechSynthesisUtterance(text);
    
    // We can eventually ask Content.js for the CURRENT time to calculate lag
    // For now, this prepares the utterance for Requirement #1
    speechSynthesis.speak(utterance);
}



async function syncSpeakText(text, ytStart, ytEnd) {
    // 1. Ask the BACKGROUND to get the time (since offscreen can't use chrome.tabs)
    const response = await chrome.runtime.sendMessage({ type: "PROXY_GET_TIME" });
    const currentVideoTime = response?.videoTime || 0;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";

    // 2. CALCULATE LAG
    const lag = currentVideoTime - ytStart;

    if (lag > 0.5) {
        utterance.rate = Math.min(1.0 + (lag * 0.2), 2.0);
        console.log(`[Sync] Lag: ${lag.toFixed(2)}s. Rate: ${utterance.rate.toFixed(2)}`);
    } else {
        utterance.rate = 1.05;
    }

    // 3. PAUSE LOGIC (Forwarded through Background)
    if (lag > 5.0) {
        chrome.runtime.sendMessage({ type: "PROXY_PAUSE" });
    }

    // 4. QUEUE MANAGEMENT
    utterance.onend = () => {
        ttsQueue.shift();
        if (ttsQueue.length > 0) {
            speechSynthesis.speak(ttsQueue[0]);
        } else {
            // Tell background to resume video
            chrome.runtime.sendMessage({ type: "PROXY_RESUME" });
        }
    };

    ttsQueue.push(utterance);
    if (!speechSynthesis.speaking) {
        speechSynthesis.speak(utterance);
    }
}