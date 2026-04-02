// // content.js - YouDub Content Script (Fixed)

// (() => {
//     // Prevent multiple executions if injected again
//     if (window.__YOUDUB_CONTENT_SCRIPT_LOADED) {
//         console.log("YouDub Content Script already running");
//         return;
//     }
//     window.__YOUDUB_CONTENT_SCRIPT_LOADED = true;

//     let currentVideo = null;

//     function getVideoElement() {
//         const videos = document.querySelectorAll('video');
//         if (videos.length === 0) return null;

//         // Return the largest (main) video player
//         return Array.from(videos).reduce((best, current) => {
//             const bestArea = best.clientWidth * best.clientHeight;
//             const currentArea = current.clientWidth * current.clientHeight;
//             return currentArea > bestArea ? current : best;
//         });
//     }


//     chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//         const video = getYouTubeVideoElement() || currentVideo;

//         switch (msg.type) {
//             case "MUTE_VIDEO":
//                 if (video) {
//                     video.muted = true;
//                     video.volume = 0;
//                     currentVideo = video;
//                     console.log("✅ YouDub: Video muted");
//                     sendResponse({ success: true, status: "muted" });
//                 } else {
//                     console.warn("⚠️ YouDub: No video element found");
//                     sendResponse({ success: false, status: "no_video_found" });
//                 }
//                 break;

//             case "UNMUTE_VIDEO":
//                 if (video) {
//                     video.muted = false;
//                     video.volume = 1.0;
//                     console.log("✅ YouDub: Video unmuted");
//                     sendResponse({ success: true, status: "unmuted" });
//                 } else {
//                     sendResponse({ success: false, status: "no_video" });
//                 }
//                 break;

//             default:
//                 sendResponse({ success: false, error: "unknown_type" });
//         }

//         return true; // Keep message channel open
//     });

//     // MutationObserver for dynamic YouTube video loading
//     const observer = new MutationObserver(() => {
//         if (!currentVideo) {
//             const video = getVideoElement();
//             if (video) {
//                 currentVideo = video;
//                 console.log("🎥 YouDub: Video element detected");
//             }
//         }
//     });

//     observer.observe(document.body, { childList: true, subtree: true });

//     console.log("🎥 YouDub Content Script Loaded Successfully");

//     // Cleanup
//     window.addEventListener('beforeunload', () => observer.disconnect());
// })();


// content.js - YouDub Content Script (Optimized for YouTube) - WORKING VERSION
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

(() => {
    if (window.__YOUDUB_CONTENT_SCRIPT_LOADED) {
        console.log("YouDub Content Script already running");
        return;
    }
    window.__YOUDUB_CONTENT_SCRIPT_LOADED = true;

    let currentVideo = null;
    let originalVolume = 1.0;

    // ====================== VIDEO ELEMENT DETECTION ======================
    async function getYouTubeVideoElement(timeout = 15000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const video = document.querySelector('video.html5-main-video') ||
                          document.querySelector('#movie_player video');

            if (video && video.readyState >= 1) {
                return video;
            }

            await new Promise(r => setTimeout(r, 300));
        }

        console.warn("YouDub: Video element not found after timeout");
        return null;
    }

    // ====================== SELF VOICE DUB ======================
    let selfMicStream = null;
    let selfMediaRecorder = null;
    let selfRecordedChunks = [];
    let selfSilenceTimeout = null;
    let isSelfDubbingActive = false;
    let lastAudioTime = Date.now();
    let consecutiveSilentChunks = 0;
    const SILENCE_THRESHOLD = 0.008;        // Adjust this value if needed
    const REQUIRED_SILENT_CHUNKS = 12;      // ~6 seconds of real silence (at 500ms chunks)

    
    // ====================== SINGLE MESSAGE LISTENER ======================
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!currentVideo && (msg.type === "CAPTURE_SYNC_TIME" || msg.type === "GET_CURRENT_VIDEO_TIME" || msg.type === "PAUSE_VIDEO_FOR_DUB" || msg.type === "RESUME_VIDEO_AFTER_DUB")) {
        if (msg.type === "CAPTURE_SYNC_TIME" || msg.type === "GET_CURRENT_VIDEO_TIME") {
            sendResponse({ success: false, error: "Video not detected yet" });
        }
        return false; 
        }
        switch (msg.type) {

            // Mute / Unmute (your existing logic)
            case "MUTE_VIDEO":
                console.log("🔇 Mute request received - SKIPPED for debugging");
                sendResponse({ success: true, status: "mute_skipped_for_debug" });
                break;

            case "UNMUTE_VIDEO":
                console.log("🔊 Unmute request received - SKIPPED for debugging");
                sendResponse({ success: true, status: "unmute_skipped_for_debug" });
                break;

            // Self Voice Dub
            case "START_SELF_DUB_INTERNAL":
                startSelfVoiceDub();
                sendResponse({ success: true });
                break;

            case "STOP_SELF_DUB_INTERNAL":
                stopSelfVoiceDub();
                sendResponse({ success: true });
                break;
            case "START_OVERLAY_WAVEFORM":
                const canvas = createYouTubeOverlay();
                if (canvas) {
                    overlayVisualizer = new YouDubOverlayWaveform(canvas);
                }
                sendResponse({ success: true });
                break;

            case "UPDATE_OVERLAY_WAVEFORM":
                if (overlayVisualizer) {
                    overlayVisualizer.update(msg.level);
                }
                break;

            case "STOP_OVERLAY_WAVEFORM":
                const overlay = document.getElementById('youdub-overlay');
                if (overlay) overlay.remove();
                overlayVisualizer = null;
                break;
                
            case "CAPTURE_SYNC_TIME":
                console.log("🕒 YouDub Sync: Capturing start time at:", currentVideo.currentTime);
                // Send to background/offscreen
                // chrome.runtime.sendMessage({
                //     type: "SET_VIDEO_SYNC",
                //     startTime: currentVideo.currentTime
                // });
                sendResponse({ success: true, time: currentVideo.currentTime });
                break;

            case "GET_CURRENT_VIDEO_TIME":
                sendResponse({ videoTime: currentVideo.currentTime });
                break;

            case "PAUSE_VIDEO_FOR_DUB":
                if (!currentVideo.paused) {
                    console.log("⏸️ AI lagging, pausing video...");
                    currentVideo.pause();
                }
                sendResponse({ success: true });
                break;

            case "RESUME_VIDEO_AFTER_DUB":
                if (currentVideo.paused) {
                    console.log("▶️ Dubbing caught up, resuming...");
                    currentVideo.play();
                }
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: "unknown_type" });
        }
        return true; // Keep channel open
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

        selfMediaRecorder.start(500);

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
    // ====================== VIDEO ELEMENT OBSERVER ======================
    const observer = new MutationObserver(async () => {
        if (!currentVideo) {
            const video = document.querySelector('video.html5-main-video') ||
                          document.querySelector('#movie_player video');
            if (video && video.readyState >= 1) {
                currentVideo = video;
                console.log("🎥 YouDub: Video element auto-detected");
            }
        }
    });
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     // Safety check: if the video isn't found yet, we can't do anything
//     if (!currentVideo) {
//         if (msg.type === "CAPTURE_SYNC_TIME" || msg.type === "GET_CURRENT_VIDEO_TIME") {
//             sendResponse({ success: false, error: "Video not detected yet" });
//         }
//         return false; 
//     }

//     switch (msg.type) {
//         case "CAPTURE_SYNC_TIME":
//             console.log("🕒 YouDub Sync: Capturing start time at:", currentVideo.currentTime);
//             // Send to background/offscreen
//             chrome.runtime.sendMessage({
//                 type: "SET_VIDEO_SYNC",
//                 startTime: currentVideo.currentTime
//             });
//             sendResponse({ success: true, time: currentVideo.currentTime });
//             break;

//         case "GET_CURRENT_VIDEO_TIME":
//             sendResponse({ videoTime: currentVideo.currentTime });
//             break;

//         case "PAUSE_VIDEO_FOR_DUB":
//             if (!currentVideo.paused) {
//                 console.log("⏸️ AI lagging, pausing video...");
//                 currentVideo.pause();
//             }
//             sendResponse({ success: true });
//             break;

//         case "RESUME_VIDEO_AFTER_DUB":
//             if (currentVideo.paused) {
//                 console.log("▶️ Dubbing caught up, resuming...");
//                 currentVideo.play();
//             }
//             sendResponse({ success: true });
//             break;
//     }

//     return true; // Keep channel open for async responses
// });

// Helper for Requirement #3 (Smooth Forward/Backward)
function setupSeekListener(video) {
    video.addEventListener('seeked', () => {
        console.log("⏩ YouDub: Seek detected, resetting sync to:", video.currentTime);
        chrome.runtime.sendMessage({
            type: "SET_VIDEO_SYNC",
            startTime: video.currentTime
        });
    });
}

    setTimeout(() => {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }, 1000);

    console.log("🎥 YouDub Content Script Loaded Successfully");

    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });

    // ====================== YOUTUBE OVERLAY WAVEFORM ======================
let overlayVisualizer = null;

const createYouTubeOverlay = () => {
    if (document.getElementById('youdub-overlay')) return;

    const container = document.createElement('div');
    container.id = 'youdub-overlay';

    const canvas = document.createElement('canvas');
    canvas.id = 'youdub-overlay-canvas';

    const logoWrapper = document.createElement('div');
    logoWrapper.id = 'youdub-overlay-logo';

    const logoImg = document.createElement('img');
    logoImg.src = chrome.runtime.getURL('images/image4.png');   // Change path if needed

    logoWrapper.appendChild(logoImg);
    container.appendChild(canvas);
    container.appendChild(logoWrapper);
    document.body.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #youdub-overlay {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100vw;
            height: 100px;
            background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
            z-index: 2147483647;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        #youdub-overlay-canvas {
            position: absolute;
            width: 100%;
            height: 100%;
        }
        #youdub-overlay-logo {
            position: relative;
            z-index: 10;
            width: 56px;
            height: 56px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 50%;
            padding: 6px;
            border: 2px solid rgba(255,255,255,0.15);
            box-shadow: 0 0 25px rgba(0,0,0,0.6);
        }
        #youdub-overlay-logo img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }
    `;
    document.head.appendChild(style);

    return canvas;
};

class YouDubOverlayWaveform {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.history = [];
        this.maxBars = 140;           // Number of bars (adjust for density)
        this.barWidth = 3.5;
        this.barGap = 2.5;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = 100 * dpr;
        this.ctx.scale(dpr, dpr);

        this.maxBars = Math.floor(window.innerWidth / (this.barWidth + this.barGap));
    }

    update(level) {
        this.history.push(Math.max(0, Math.min(1, level)));
        if (this.history.length > this.maxBars) {
            this.history.shift();
        }
    }

    getBarColor(amplitude) {
        if (amplitude > 0.60) return '#e007076e';      // Large → Red
        if (amplitude > 0.35) return '#cccccc6e';      // Medium → Orange
        if (amplitude > 0.20) return '#ffffff6e';      // Small-Medium → Green
        return '#ffffff';                            // Very small → Light Green
    }

    animate() {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const centerY = h / 2;

        this.ctx.clearRect(0, 0, w, h);

        const barCount = Math.min(this.history.length, this.maxBars);

        for (let i = 0; i < barCount; i++) {
            const x = i * (this.barWidth + this.barGap);
            const amplitude = this.history[i] || 0;

            const barHeight = amplitude * (h * 0.82);   // Max height

            const y = centerY - (barHeight / 2);

            // Get color based on height
            this.ctx.fillStyle = this.getBarColor(amplitude);
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = this.getBarColor(amplitude);

            this.ctx.fillRect(x, y, this.barWidth, barHeight);
        }

        requestAnimationFrame(() => this.animate());
    }
}
// class YouDubOverlayWaveform {
//     constructor(canvas) {
//         this.canvas = canvas;
//         this.ctx = canvas.getContext('2d');
//         this.history = [];
//         this.maxBars = 120;           // Number of vertical bars visible
//         this.barWidth = 4;
//         this.barGap = 3;

//         this.resize();
//         window.addEventListener('resize', () => this.resize());
//         this.animate();
//     }

//     resize() {
//         const dpr = window.devicePixelRatio || 1;
//         this.canvas.width = window.innerWidth * dpr;
//         this.canvas.height = 100 * dpr;
//         this.ctx.scale(dpr, dpr);

//         // Calculate how many bars fit
//         this.maxBars = Math.floor(window.innerWidth / (this.barWidth + this.barGap));
//     }

//     update(level) {
//         // Add new amplitude value
//         this.history.push(Math.max(0, Math.min(1, level)));

//         // Keep only the last N bars for smooth movement
//         if (this.history.length > this.maxBars) {
//             this.history.shift();
//         }
//     }

//     animate() {
//         const w = this.canvas.width / (window.devicePixelRatio || 1);
//         const h = this.canvas.height / (window.devicePixelRatio || 1);
//         const centerY = h / 2;

//         this.ctx.clearRect(0, 0, w, h);

//         const barCount = Math.min(this.history.length, this.maxBars);

//         for (let i = 0; i < barCount; i++) {
//             const x = i * (this.barWidth + this.barGap);
//             const amplitude = this.history[i] || 0;

//             // Bar height based on amplitude (centered vertically)
//             const barHeight = amplitude * (h * 0.85);   // 85% of height max

//             const y = centerY - (barHeight / 2);

//             // Draw vertical bar
//             this.ctx.fillStyle = '#22ff88';
//             this.ctx.shadowBlur = 8;
//             this.ctx.shadowColor = '#22ff88';
//             this.ctx.fillRect(x, y, this.barWidth, barHeight);
//         }

//         requestAnimationFrame(() => this.animate());
//     }
// }

})();