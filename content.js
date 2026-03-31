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

            default:
                sendResponse({ success: false, error: "unknown_type" });
        }
        return true; // Keep channel open
    });

    // ====================== SELF VOICE DUB FUNCTIONS ======================
    async function startSelfVoiceDub() {
        try {
            console.log("🎤 Self Voice Dub: Requesting microphone...");

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

            resetSilenceTimer();

            console.log("✅ Self Voice Dub: Listening to microphone");

        } catch (err) {
            console.error("Microphone access error:", err);
            chrome.runtime.sendMessage({ 
                type: "SELF_DUB_ERROR", 
                error: "Microphone permission denied or unavailable." 
            });
        }
    }

    function resetSilenceTimer() {
        if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

        selfSilenceTimeout = setTimeout(() => {
            if (isSelfDubbingActive) {
                console.log("🛑 5 seconds silence detected → Processing audio");
                processSelfRecordedAudio();
            }
        }, 5000);
    }

    function stopSelfVoiceDub() {
        if (selfMediaRecorder) selfMediaRecorder.stop();
        if (selfMicStream) selfMicStream.getTracks().forEach(track => track.stop());
        if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

        isSelfDubbingActive = false;
        console.log("⏹️ Self Voice Dub stopped");
    }

    async function processSelfRecordedAudio() {
    if (selfRecordedChunks.length === 0) {
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
        return;
    }

    isSelfDubbingActive = false;
    chrome.runtime.sendMessage({ type: "SELF_DUB_PROCESSING" });

    try {
        const audioBlob = new Blob(selfRecordedChunks, { type: "audio/webm" });

        // Better conversion with error handling
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new AudioContext({ sampleRate: 16000 });

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer).catch(err => {
            console.error("decodeAudioData failed:", err);
            throw err;
        });

        const audioData = audioBuffer.getChannelData(0);

        console.log(`✅ Audio decoded | Duration: ${audioBuffer.duration.toFixed(2)}s | Samples: ${audioData.length}`);

        // Send to Offscreen
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
})();