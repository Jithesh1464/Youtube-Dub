// //UPDATED ONE 28JUNE 2024 
// // ================================================
// // offscreen.js - Final Updated Version for YouDub
// // ================================================

import { pipeline, env } from './transformers.min.js';

let audioContext = null;
let source = null;
let workletNode = null;
let transcriber = null;
let currentStream = null;
let isProcessing = false;
let canStartAI = false;
let ttsQueue = [];
let mediaRecorder = null;
let recordedChunks = [];

// ====================== MODEL INITIALIZATION (Fully Offline) ======================
async function initializeModel() {
    if (transcriber) return;

    try {
        const baseUrl = chrome.runtime.getURL('');

        // Force fully offline mode
        //This tells Transformers.js: "You are allowed to load models from local files (inside the extension)".
        env.allowLocalModels = true;
        
        //It blocks Transformers.js from downloading any model files from the internet (Hugging Face).
        env.allowRemoteModels = false;

        // ONNX Runtime Web needs two WebAssembly files to run:
        //   1.  ort-wasm-simd-threaded.wasm → Main WebAssembly binary (SIMD + multi-threading support)
        //   2. ort-wasm-simd-threaded.jsep.wasm → JSEP (JavaScript Execution Provider) version for better performance
        env.backends.onnx.wasm.wasmPaths = {
            'ort-wasm-simd-threaded.wasm': baseUrl + 'ort-wasm-simd-threaded.wasm',
            'ort-wasm-simd-threaded.jsep.wasm': baseUrl + 'ort-wasm-simd-threaded.jsep.wasm'
        };

        //This .mjs file contains JavaScript glue code that helps ONNX Runtime communicate with the WebAssembly files.
        env.backends.onnx.wasm.jsepPath = baseUrl + 'ort-wasm-simd-threaded.jsep.mjs';

        console.log("🚀 Loading Whisper tiny model from LOCAL files... (This may take 15-50 seconds)");

        transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
            device: "webgpu",
            dtype: "fp32",
            progress_callback: (data) => {
                console.log("Model loading progress:", data);
                if (data.status === "progress") {
                    const percent = Math.round(data.progress || 0);
                    document.getElementById("status").textContent = `Loading AI model... ${percent}%`;
                }
            }
        });

        console.log("✅ Whisper model loaded successfully from local files (WebGPU)");
        document.getElementById("status").textContent = "AI Engine Ready (WebGPU)";

    } catch (err) {
        console.warn("WebGPU failed, falling back to WASM:", err.message);

        try {
            transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
                device: "wasm",
                allowLocalModels: true,
                allowRemoteModels: false
            });

            console.log("✅ Whisper model loaded with WASM fallback");
            document.getElementById("status").textContent = "AI Engine Ready (WASM)";
        } catch (fallbackErr) {
            console.error("❌ Model loading completely failed:", fallbackErr);
            document.getElementById("status").textContent = "AI Engine Failed - Check Console";
        }
    }
}

// Load model immediately when offscreen starts
initializeModel();

// ====================== MESSAGE LISTENER ======================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_STREAM") {
        (async () => {
            try {
                await startDubbingStream(msg.streamId, msg.language || "hi");
                sendResponse({ success: true });
            } catch (error) {
                console.error("START_STREAM failed:", error);
                sendResponse({ success: false, error: error.message || "Unknown error" });
            }
        })();
        return true;
    }

    if (msg.type === "STOP_DUBBING") {
        stopDubbing();
        sendResponse({ success: true });
    }
});

async function startDubbingStream(streamId, language) {
    if (!streamId) throw new Error("Missing streamId");

    // Clean any previous session
    stopDubbing(true);

    try {
        console.log("🎙️ Capturing tab audio stream...");

        currentStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: "tab",
                    chromeMediaSourceId: streamId
                }
            },
            video: false
            // video: {
            // mandatory: {
            //     chromeMediaSource: "tab",
            //     chromeMediaSourceId: streamId
            // }
            // }
        });

        const audioTracks = currentStream.getAudioTracks();

        console.log(`✅ Stream captured successfully`);
        console.log(`   → Number of audio tracks: ${audioTracks.length}`);

        if (audioTracks.length === 0) {
            throw new Error("No audio tracks found in captured stream. Tab may be muted or silent.");
        }

        // === AGGRESSIVE AUDIO TRACK ENABLE === 
        audioTracks.forEach((track, index) => {
            const wasEnabled = track.enabled;
            const wasMuted = track.muted;
            
            track.enabled = true;        // Force enable
            
            console.log(`   → Track ${index + 1}: ` +
                        `enabled: ${wasEnabled} → ${track.enabled}, ` +
                        `muted: ${wasMuted} → ${track.muted}, ` +
                        `readyState: ${track.readyState}`);
        });

        // Small delay to allow the audio track to initialize properly
        console.log("⏳ Waiting for audio track to warm up...");
        await new Promise(resolve => setTimeout(resolve, 800));

        // Optional: Start debug recording (only if you want to verify raw audio)
        // startRecording(currentStream);   // Uncomment only when needed

        await initializeAudioPipeline(currentStream, language);

        console.log("🎯 startDubbingStream completed successfully");

    } catch (err) {
        console.error("❌ Failed to start dubbing stream:", err);
        throw err;
    }
}

async function initializeAudioPipeline(stream, language) {
    audioContext = new AudioContext({ sampleRate: 16000 });

    await audioContext.audioWorklet.addModule("audio-processor.js");

    workletNode = new AudioWorkletNode(audioContext, "audio-processor");
    source = audioContext.createMediaStreamSource(stream);

    // Connect ONLY to worklet
    source.connect(workletNode);

    // === CRITICAL FIXES FOR AUDIO CAPTURE ===
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = true;
        console.log(`Audio track enabled: ${track.enabled}, muted: ${track.muted}`);
    });

    // Give the stream a moment to "warm up"
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`✅ Audio pipeline initialized | Tracks: ${audioTracks.length}`);

    // Ensure model is loaded
    await initializeModel();

    canStartAI = true;

    // Message handler (keep the detailed debug version)
    workletNode.port.onmessage = async (event) => {
        const msg = event.data;

        if (msg?.type === "volume_update") {
            chrome.runtime.sendMessage({ type: "AUDIO_LEVEL", level: msg.level }).catch(() => {});
            return;
        }

        if (msg?.type === "audio_chunk" && msg.data instanceof Float32Array) {
            console.log(`📦 Received chunk #${msg.sequence} | Size: ${msg.data.length} samples | RMS: ${calculateRMS(msg.data).toFixed(4)}`);

            if (!canStartAI || isProcessing) return;

            const rms = calculateRMS(msg.data);
            console.log(`🎤 Volume level (RMS): ${rms.toFixed(4)}`);

            if (rms < 0.01) {                    // Slightly increased threshold
                console.log("🔇 Chunk too silent, skipping");
                return;
            }

            isProcessing = true;
            console.log(`🚀 Starting transcription for chunk #${msg.sequence}`);

            try {
                await processChunk(msg.data, language);
                console.log(`✅ Finished processing chunk #${msg.sequence}`);
            } catch (e) {
                console.error(`❌ Chunk ${msg.sequence} failed:`, e);
            } finally {
                isProcessing = false;
            }
        }
    };
}

function calculateRMS(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
}

async function processChunk(audioData, language) {
    if (!transcriber) {
        console.warn("Transcriber not ready yet");
        return;
    }

    try {
        const result = await transcriber(audioData, {
            language: language,
            task: "translate",
            chunk_length_s: 25,
        });

        const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();

        if (cleanedText.length > 8) {
            console.log("🗣️ Translated:", cleanedText);
            speakText(cleanedText);
        }
    } catch (e) {
        console.error("Transcription error:", e);
    }
}

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.05;

    utterance.onend = () => {
        ttsQueue.shift();
        if (ttsQueue.length > 0) {
            speechSynthesis.speak(ttsQueue[0]);
        }
    };

    ttsQueue.push(utterance);
    if (!speechSynthesis.speaking) {
        speechSynthesis.speak(utterance);
    }
}

function stopDubbing(silent = false) {
    canStartAI = false;
    isProcessing = false;

    if (workletNode) {
        workletNode.port.postMessage({ type: "cleanup" });
        workletNode.disconnect();
        workletNode = null;
    }
    if (source) {
        source.disconnect();
        source = null;
    }
    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }

    // Critical: Stop all media tracks
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    ttsQueue = [];
    speechSynthesis.cancel();

    if (!silent) {
        console.log("🛑 Dubbing stopped and all resources cleaned up");
    }
}

console.log("🎥 Offscreen document ready - Starting AI model load...");

// newly added recording function for debugging - will be removed in final version
function startRecording(stream) {
  try {
    if (!stream) {
      throw new Error("Stream is not available for recording");
    }

    if (mediaRecorder?.state === "recording") {
    console.warn("⚠️ Recording already in progress");
    return;
    }

    recordedChunks = [];

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm"
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (err) => {
      console.error("❌ MediaRecorder error:", err);
    };

    mediaRecorder.onstop = () => {
      try {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });

        console.log("🎧 Recording complete. Size:", blob.size);

        downloadAudio(blob);

      } catch (err) {
        console.error("❌ Error processing recording:", err);
      }
    };

    mediaRecorder.start();

    console.log("🎙️ Recording started");

    // ⏱️ Debug: stop after 10s
    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, 10000);

  } catch (err) {
    console.error("❌ Recording setup failed:", err);
  }
}

function downloadAudio(blob) {
  try {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "debug-audio.webm";
    a.click();

    URL.revokeObjectURL(url);

    console.log("📥 Audio downloaded");

  } catch (err) {
    console.error("❌ Download failed:", err);
  }
}

// Newly added functions for video recording from record video button in popup.js. This is for recording the video stream with original audio.
let videoMediaRecorder = null;
let videoRecordedChunks = [];
let isVideoRecording = false;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_VIDEO_RECORDING_INTERNAL") {
        startVideoRecording(msg.streamId);
    }
    if (msg.type === "STOP_VIDEO_RECORDING") {
        stopVideoRecording();
    }
});

async function startVideoRecording(streamId) {
    try {
        console.log("🎥 [Recording] Starting with streamId...");
        if (!streamId) {
        console.log("Stream is not available for recording");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId }},
            video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId }}
        });

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") 
            ? "video/webm;codecs=vp9,opus" 
            : "video/webm;codecs=vp8,opus";

        videoMediaRecorder = new MediaRecorder(stream, { mimeType });
        videoRecordedChunks = [];

        videoMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoRecordedChunks.push(e.data);
        };

        videoMediaRecorder.onstop = () => {
            if (videoRecordedChunks.length > 0) {
                const blob = new Blob(videoRecordedChunks, { type: mimeType });
                downloadVideo(blob);
            }
            stream.getTracks().forEach(track => track.stop());
        };

        videoMediaRecorder.start(1000);
        isVideoRecording = true;

        console.log("✅ Video recording started successfully");

    } catch (err) {
        console.error("❌ Failed to start video recording:", err);
    }
}

function stopVideoRecording() {
    if (videoMediaRecorder) {
        videoMediaRecorder.stop();
        isVideoRecording = false;
    }
}

function downloadVideo(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `YouDub_Recording_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
}

// ====================== SELF VOICE DUB ======================
// let selfMicStream = null;
// let selfMediaRecorder = null;
// let selfRecordedChunks = [];
// let selfSilenceTimeout = null;
// let isSelfDubbingActive = false;

chrome.runtime.onMessage.addListener((msg) => {
    
    if (msg.type === "PROCESS_SELF_AUDIO") {
        processSelfAudio(msg.audioData);
    }

    // ... your existing listeners for START_STREAM, STOP_DUBBING, etc.
});

// async function startSelfVoiceDub() {
//     try {
//         console.log("🎤 Self Voice Dub: Requesting microphone access...");

//         // Force a new permission request with better options
//         selfMicStream = await navigator.mediaDevices.getUserMedia({
//             audio: {
//                 echoCancellation: true,
//                 noiseSuppression: true,
//                 autoGainControl: true,
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

//         console.log("✅ Microphone access granted. Now listening...");

//     } catch (err) {
//         console.error("Microphone access error:", err.name, err.message);

//         let userMessage = "Microphone access failed.";

//         if (err.name === "NotAllowedError") {
//             userMessage = "Microphone permission was blocked.\n\nPlease go to chrome://settings/content/microphone and allow access for this extension.";
//         } else if (err.name === "NotFoundError") {
//             userMessage = "No microphone found. Please connect a microphone.";
//         }

//         chrome.runtime.sendMessage({ 
//             type: "SELF_DUB_ERROR", 
//             error: userMessage 
//         });

//         resetSelfDubButtonUI();
//     }
// }

// // Add this missing function
// function resetSelfDubButtonUI() {
//     chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
//     isSelfDubbingActive = false;
// }

// function resetSilenceTimer() {
//     if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

//     selfSilenceTimeout = setTimeout(() => {
//         if (isSelfDubbingActive) {
//             console.log("🛑 5 seconds silence detected → Processing...");
//             processSelfRecordedAudio();
//         }
//     }, 5000);
// }

// function stopSelfVoiceDub() {
//     if (selfMediaRecorder) selfMediaRecorder.stop();
//     if (selfMicStream) selfMicStream.getTracks().forEach(track => track.stop());
//     if (selfSilenceTimeout) clearTimeout(selfSilenceTimeout);

//     isSelfDubbingActive = false;
//     console.log("⏹️ Self Voice Dub stopped manually");
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

//         const result = await transcriber(audioData, {
//             language: "en",           // Change as needed
//             task: "translate",
//         });

//         const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();

//         if (cleanedText.length > 5) {
//             console.log("🗣️ Self Dub Output:", cleanedText);
//             speakText(cleanedText);        // Your existing speakText function
//         }

//     } catch (err) {
//         console.error("Self dub processing error:", err);
//     } finally {
//         chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
//     }
// }

async function processSelfAudio(audioDataArray) {
    if (!transcriber) {
        console.warn("Transcriber not ready");
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
        return;
    }

    try {
        console.log("🧠 Processing self-recorded audio with Whisper...");

        const audioData = new Float32Array(audioDataArray);

        // Add some pre-processing to help Whisper
        const result = await transcriber(audioData, {
            language: "en",
            task: "translate",
            chunk_length_s: 30,
            // These options often help with short/self-recorded audio
            temperature: 0.0,
            compression_ratio_threshold: 2.4
        });

        const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();

        if (cleanedText.length > 5) {
            console.log("🗣️ Self Dub Output:", cleanedText);
            speakText(cleanedText);
        } else {
            console.log("⚠️ Self Dub: Text too short or empty");
        }

    } catch (err) {
        console.error("Self audio processing failed:", err);
    } finally {
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
    }
}
// ================================================
// offscreen.js - Updated with Shared Stream Logic
// ================================================

// ================================================
// offscreen.js - Shared Stream + Fixed Recording
// ================================================

// import { pipeline, env } from './transformers.min.js';

// let audioContext = null;
// let source = null;
// let workletNode = null;
// let transcriber = null;

// let mainStream = null;           // Main captured stream
// let dubbingStream = null;        // Clone for dubbing
// let recordingStream = null;      // Clone for recording

// let isProcessing = false;
// let canStartAI = false;
// let ttsQueue = [];

// // ====================== VIDEO RECORDING ======================
// let videoMediaRecorder = null;
// let videoRecordedChunks = [];
// let isVideoRecording = false;

// // ====================== MODEL INITIALIZATION ======================
// async function initializeModel() {
//     if (transcriber) return;

//     try {
//         const baseUrl = chrome.runtime.getURL('');

//         env.allowLocalModels = true;
//         env.allowRemoteModels = false;

//         env.backends.onnx.wasm.wasmPaths = {
//             'ort-wasm-simd-threaded.wasm': baseUrl + 'ort-wasm-simd-threaded.wasm',
//             'ort-wasm-simd-threaded.jsep.wasm': baseUrl + 'ort-wasm-simd-threaded.jsep.wasm'
//         };
//         env.backends.onnx.wasm.jsepPath = baseUrl + 'ort-wasm-simd-threaded.jsep.mjs';

//         console.log("🚀 Loading Whisper tiny model from LOCAL files...");

//         transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//             device: "webgpu",
//             dtype: "fp32",
//             progress_callback: (data) => {
//                 console.log("Model loading progress:", data);
//                 if (data.status === "progress") {
//                     const percent = Math.round(data.progress || 0);
//                     document.getElementById("status").textContent = `Loading AI model... ${percent}%`;
//                 }
//             }
//         });

//         console.log("✅ Whisper model loaded successfully (WebGPU)");
//         document.getElementById("status").textContent = "AI Engine Ready (WebGPU)";

//     } catch (err) {
//         console.warn("WebGPU failed, falling back to WASM:", err.message);
//         // WASM fallback code (your existing one)
//     }
// }

// initializeModel();

// // ====================== MESSAGE LISTENER ======================
// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (msg.type === "START_STREAM") {
//         (async () => {
//             try {
//                 await startDubbingStream(msg.streamId, msg.language || "hi");
//                 sendResponse({ success: true });
//             } catch (error) {
//                 console.error("START_STREAM failed:", error);
//                 sendResponse({ success: false, error: error.message });
//             }
//         })();
//         return true;
//     }

//     if (msg.type === "STOP_DUBBING") {
//         stopDubbing();
//         sendResponse({ success: true });
//     }

//     if (msg.type === "START_VIDEO_RECORDING_INTERNAL") {
//         startVideoRecordingInternal(msg.streamId);
//         sendResponse({ success: true });
//     }

//     if (msg.type === "STOP_VIDEO_RECORDING") {
//         stopVideoRecording();
//         sendResponse({ success: true });
//     }
// });

// // ====================== SHARED STREAM LOGIC ======================
// async function getOrCreateMainStream(streamId) {
//     if (mainStream) return mainStream;

//     mainStream = await navigator.mediaDevices.getUserMedia({
//         audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId }},
//         video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId }}
//     });

//     console.log("✅ Main shared stream created");
//     return mainStream;
// }

// // ====================== START DUBBING ======================
// async function startDubbingStream(streamId, language) {
//     try {
//         const stream = await getOrCreateMainStream(streamId);
        
//         // Create a clone for dubbing
//         dubbingStream = stream.clone();

//         const audioTracks = dubbingStream.getAudioTracks();
//         audioTracks.forEach(track => track.enabled = true);

//         await new Promise(r => setTimeout(r, 600));

//         await initializeAudioPipeline(dubbingStream, language);

//         console.log("🎙️ Dubbing started using cloned stream");

//     } catch (err) {
//         console.error("❌ Dubbing start failed:", err);
//     }
// }

// // ====================== START VIDEO RECORDING ======================
// async function startVideoRecordingInternal(streamId) {
//     try {
//         const stream = await getOrCreateMainStream(streamId);
        
//         // Create a clone for recording
//         recordingStream = stream.clone();

//         const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") 
//             ? "video/webm;codecs=vp9,opus" 
//             : "video/webm;codecs=vp8,opus";

//         videoMediaRecorder = new MediaRecorder(recordingStream, { mimeType });
//         videoRecordedChunks = [];

//         videoMediaRecorder.ondataavailable = (e) => {
//             if (e.data.size > 0) videoRecordedChunks.push(e.data);
//         };

//         videoMediaRecorder.onstop = () => {
//             if (videoRecordedChunks.length > 0) {
//                 const blob = new Blob(videoRecordedChunks, { type: mimeType });
//                 downloadVideo(blob);
//             }
//             if (recordingStream) {
//                 recordingStream.getTracks().forEach(track => track.stop());
//                 recordingStream = null;
//             }
//         };

//         videoMediaRecorder.start(1000);
//         isVideoRecording = true;

//         console.log("✅ Video recording started using cloned stream");

//     } catch (err) {
//         console.error("❌ Failed to start video recording:", err);
//     }
// }

// function stopVideoRecording() {
//     if (videoMediaRecorder) {
//         videoMediaRecorder.stop();
//         isVideoRecording = false;
//     }
// }

// function downloadVideo(blob) {
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `YouDub_Recording_${Date.now()}.webm`;
//     a.click();
//     URL.revokeObjectURL(url);
// }

// // ====================== EXISTING DUBBING FUNCTIONS (Kept as-is) ======================
// // async function initializeAudioPipeline(stream, language) {
// //     // ... your existing initializeAudioPipeline function (unchanged) ...
// //     // Paste your full initializeAudioPipeline, calculateRMS, processChunk, speakText, stopDubbing here
// // }

// // function calculateRMS(audioData) { /* your existing function */ }
// // async function processChunk(audioData, language) { /* your existing function */ }
// // function speakText(text) { /* your existing function */ }

// async function initializeAudioPipeline(stream, language) {
//     audioContext = new AudioContext({ sampleRate: 16000 });

//     await audioContext.audioWorklet.addModule("audio-processor.js");

//     workletNode = new AudioWorkletNode(audioContext, "audio-processor");
//     source = audioContext.createMediaStreamSource(stream);

//     // Connect ONLY to worklet
//     source.connect(workletNode);

//     // === CRITICAL FIXES FOR AUDIO CAPTURE ===
//     const audioTracks = stream.getAudioTracks();
//     audioTracks.forEach(track => {
//         track.enabled = true;
//         console.log(`Audio track enabled: ${track.enabled}, muted: ${track.muted}`);
//     });

//     // Give the stream a moment to "warm up"
//     await new Promise(resolve => setTimeout(resolve, 800));

//     console.log(`✅ Audio pipeline initialized | Tracks: ${audioTracks.length}`);

//     // Ensure model is loaded
//     await initializeModel();

//     canStartAI = true;

//     // Message handler (keep the detailed debug version)
//     workletNode.port.onmessage = async (event) => {
//         const msg = event.data;

//         if (msg?.type === "volume_update") {
//             chrome.runtime.sendMessage({ type: "AUDIO_LEVEL", level: msg.level }).catch(() => {});
//             return;
//         }

//         if (msg?.type === "audio_chunk" && msg.data instanceof Float32Array) {
//             console.log(`📦 Received chunk #${msg.sequence} | Size: ${msg.data.length} samples | RMS: ${calculateRMS(msg.data).toFixed(4)}`);

//             if (!canStartAI || isProcessing) return;

//             const rms = calculateRMS(msg.data);
//             console.log(`🎤 Volume level (RMS): ${rms.toFixed(4)}`);

//             if (rms < 0.01) {                    // Slightly increased threshold
//                 console.log("🔇 Chunk too silent, skipping");
//                 return;
//             }

//             isProcessing = true;
//             console.log(`🚀 Starting transcription for chunk #${msg.sequence}`);

//             try {
//                 await processChunk(msg.data, language);
//                 console.log(`✅ Finished processing chunk #${msg.sequence}`);
//             } catch (e) {
//                 console.error(`❌ Chunk ${msg.sequence} failed:`, e);
//             } finally {
//                 isProcessing = false;
//             }
//         }
//     };
// }

// function calculateRMS(audioData) {
//     let sum = 0;
//     for (let i = 0; i < audioData.length; i++) {
//         sum += audioData[i] * audioData[i];
//     }
//     return Math.sqrt(sum / audioData.length);
// }

// async function processChunk(audioData, language) {
//     if (!transcriber) {
//         console.warn("Transcriber not ready yet");
//         return;
//     }

//     try {
//         const result = await transcriber(audioData, {
//             language: language,
//             task: "translate",
//             chunk_length_s: 25,
//         });

//         const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();

//         if (cleanedText.length > 8) {
//             console.log("🗣️ Translated:", cleanedText);
//             speakText(cleanedText);
//         }
//     } catch (e) {
//         console.error("Transcription error:", e);
//     }
// }

// function speakText(text) {
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = "en-US";
//     utterance.rate = 1.05;

//     utterance.onend = () => {
//         ttsQueue.shift();
//         if (ttsQueue.length > 0) {
//             speechSynthesis.speak(ttsQueue[0]);
//         }
//     };

//     ttsQueue.push(utterance);
//     if (!speechSynthesis.speaking) {
//         speechSynthesis.speak(utterance);
//     }
// }

// function stopDubbing(silent = false) {
//     canStartAI = false;
//     isProcessing = false;

//     if (workletNode) {
//         workletNode.port.postMessage({ type: "cleanup" });
//         workletNode.disconnect();
//         workletNode = null;
//     }
//     if (source) source.disconnect();
//     if (audioContext) audioContext.close().catch(() => {});

//     if (mainStream && !isVideoRecording) {   // Don't stop stream if recording is active
//         mainStream.getTracks().forEach(track => track.stop());
//         mainStream = null;
//     }

//     ttsQueue = [];
//     speechSynthesis.cancel();

//     if (!silent) {
//         console.log("🛑 Dubbing stopped");
//     }
// }


// console.log("🎥 Offscreen document ready - Starting AI model load...");

// window.addEventListener('beforeunload', () => {
//     if (mainStream) mainStream.getTracks().forEach(t => t.stop());
// });