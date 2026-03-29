// // offscreen.js - YouDub Offscreen (Compatible with your .mjs + .wasm files)

// import { pipeline, env } from './transformers.min.js';

// let audioContext = null;
// let source = null;
// let workletNode = null;
// let transcriber = null;
// let isProcessing = false;
// let ttsQueue = [];
// let canStartAI = false;

// async function loadWhisper() {
//     if (transcriber) return;

//     try {
//         console.log("🔧 Configuring ONNX Runtime paths...");

//         // Important: Point to your local files
//         const baseUrl = chrome.runtime.getURL('/');

//         env.backends.onnx.wasm.wasmPaths = {
//             'ort-wasm-simd-threaded.wasm': baseUrl + 'ort-wasm-simd-threaded.wasm',
//             'ort-wasm-simd-threaded.jsep.wasm': baseUrl + 'ort-wasm-simd-threaded.jsep.wasm'
//         };

//         // Tell Transformers.js where to find the JSEP loader
//         env.backends.onnx.wasm.jsepPath = baseUrl + 'ort-wasm-simd-threaded.jsep.mjs';

//         env.allowLocalModels = false;
//         env.allowRemoteModels = true;

//         console.log("🚀 Loading Whisper tiny model with WebGPU support...");

//         transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//             device: "webgpu",     // Try WebGPU first
//             dtype: "fp32",
//             progress_callback: (data) => {
//                 console.log("Model loading progress:", data);
//             }
//         });

//         console.log("✅ Whisper model loaded successfully!");
//         document.getElementById("status").textContent = "AI Engine Ready";

//     } catch (err) {
//         console.error("❌ WebGPU load failed:", err.message);

//         // Fallback to WASM
//         try {
//             transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//                 device: "wasm"
//             });
//             console.log("✅ Whisper loaded using WASM fallback");
//             document.getElementById("status").textContent = "AI Engine Ready (WASM)";
//         } catch (fallbackErr) {
//             console.error("❌ Both WebGPU and WASM failed:", fallbackErr);
//             document.getElementById("status").textContent = "AI Engine Failed";
//         }
//     }
// }

// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (msg.type === "START_STREAM") {
//         (async () => {
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     audio: {
//                         mandatory: {
//                             chromeMediaSource: "tab",
//                             chromeMediaSourceId: msg.streamId
//                         }
//                     },
//                     video: false
//                 });

//                 console.log("✅ Stream captured with", stream.getAudioTracks().length, "audio track(s)");

//                 await startProcessing(stream, msg.language);
//                 sendResponse({ success: true });

//             } catch (error) {
//                 console.error("getUserMedia failed:", error);
//                 sendResponse({ success: false, error: error.message });
//             }
//         })();
//         return true;
//     }

//     if (msg.type === "STOP_DUBBING") {
//         stopProcessing();
//         sendResponse({ success: true });
//     }
// });

// async function startProcessing(stream, language) {
//     try {
//         console.log("🎛️ Creating AudioContext with loopback...");

//         audioContext = new AudioContext({ sampleRate: 16000 });

//         await audioContext.audioWorklet.addModule("audio-processor.js");

//         workletNode = new AudioWorkletNode(audioContext, "audio-processor");
//         source = audioContext.createMediaStreamSource(stream);

//         // Strong Loopback - This should restore original audio
//         source.connect(workletNode);
//         source.connect(audioContext.destination);

//         // Enable audio track
//         stream.getAudioTracks().forEach(track => track.enabled = true);

//         console.log("✅ Loopback connected. Original audio should be playing now.");

//         debugDownloadStream(stream);

//         setTimeout(() => {
//             canStartAI = true;
//             console.log("🚀 AI transcription started");
//         }, 1500);

//         workletNode.port.onmessage = async (event) => {
//             const data = event.data;

//             if (data?.type === "volume_update") {
//                 chrome.runtime.sendMessage({ type: "AUDIO_LEVEL", level: data.level }).catch(() => {});
//                 return;
//             }

//             const audioData = data;
//             if (!audioData || !(audioData instanceof Float32Array) || !canStartAI || isProcessing) return;

//             let sum = 0;
//             for (let i = 0; i < audioData.length; i++) {
//                 sum += audioData[i] * audioData[i];
//             }
//             const rms = Math.sqrt(sum / audioData.length);
//             if (rms < 0.008) return;

//             isProcessing = true;
//             await processChunk(audioData, language);
//             isProcessing = false;
//         };

//     } catch (err) {
//         console.error("startProcessing failed:", err);
//     }
// }

// async function processChunk(audioData, language) {
//     try {
//         await loadWhisper();

//         const result = await transcriber(audioData, {
//             language: language || "hi",
//             task: "translate",
//             chunk_length_s: 25,
//         });

//         const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();
//         if (cleanedText.length > 8) {
//             console.log("🗣️ Translated:", cleanedText);
//             speakText(cleanedText);
//         }
//     } catch (e) {
//         console.error("processChunk error:", e);
//     }
// }

// function speakText(text) {
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.lang = "en-US";
//     utterance.rate = 1.05;

//     utterance.onend = () => {
//         ttsQueue.shift();
//         if (ttsQueue.length > 0) speechSynthesis.speak(ttsQueue[0]);
//     };

//     ttsQueue.push(utterance);
//     if (!speechSynthesis.speaking) speechSynthesis.speak(utterance);
// }

// function stopProcessing() {
//     canStartAI = false;
//     isProcessing = false;

//     if (workletNode) {
//         workletNode.port.postMessage({ type: "cleanup" });
//         workletNode.disconnect();
//         workletNode = null;
//     }
//     if (source) source.disconnect();
//     if (audioContext) audioContext.close().catch(() => {});

//     ttsQueue = [];
//     speechSynthesis.cancel();
//     console.log("🛑 Offscreen stopped");
// }

// // Debug recording
// function debugDownloadStream(stream) {
//     const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
//     const chunks = [];

//     recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
//     recorder.onstop = () => {
//         const blob = new Blob(chunks, { type: 'audio/webm' });
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `youdub_debug_${Date.now()}.webm`;
//         a.click();
//         URL.revokeObjectURL(url);
//         console.log("✅ Debug audio saved");
//     };

//     recorder.start(1000);
//     setTimeout(() => recorder.stop(), 5200);
// }


//UPDATED ONE 28JUNE 2024 
// ================================================
// offscreen.js - Final Updated Version for YouDub
// ================================================

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

// ====================== START DUBBING ======================
// async function startDubbingStream(streamId, language) {
//     if (!streamId) throw new Error("Missing streamId");

//     // Clean any previous session
//     stopDubbing(true);

//     try {
//         console.log("🎙️ Capturing tab audio stream...");

//         currentStream = await navigator.mediaDevices.getUserMedia({
//             audio: {
//                 mandatory: {
//                     chromeMediaSource: "tab",
//                     chromeMediaSourceId: streamId
//                 }
//             },
//             video: false
//         });

//         const audioTracks = currentStream.getAudioTracks();
//         console.log(`✅ Captured stream with ${audioTracks.length} audio track(s)`);

//         if (audioTracks.length === 0) {
//             throw new Error("No audio tracks found in captured stream");
//         }
//         startRecording(currentStream);

//         await initializeAudioPipeline(currentStream, language);

//     } catch (err) {
//         console.error("Failed to start dubbing stream:", err);
//         throw err;
//     }
// }
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


//THE NBELOW TWO FUNCTIONS ARE FOR DOWNLOADING THE VIDEO STREAM FOR DEBUGGING PURPOSE.
// function startRecording(stream) {
//     try {
//         if (!stream) {
//             throw new Error("Stream is not available for recording");
//         }

//         if (mediaRecorder && mediaRecorder.state === "recording") {
//             console.warn("⚠️ Recording already in progress");
//             return;
//         }

//         recordedChunks = [];

//         // Choose the best mimeType for video + audio
//         const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") 
//             ? "video/webm;codecs=vp9,opus"
//             : "video/webm;codecs=vp8,opus";

//         console.log(`🎥 Starting MediaRecorder with mimeType: ${mimeType}`);

//         mediaRecorder = new MediaRecorder(stream, {
//             mimeType: mimeType
//         });

//         mediaRecorder.ondataavailable = (event) => {
//             if (event.data && event.data.size > 0) {
//                 recordedChunks.push(event.data);
//             }
//         };

//         mediaRecorder.onerror = (event) => {
//             console.error("❌ MediaRecorder error:", event.error);
//         };

//         mediaRecorder.onstop = () => {
//             try {
//                 if (recordedChunks.length === 0) {
//                     console.warn("⚠️ No data recorded");
//                     return;
//                 }

//                 const blob = new Blob(recordedChunks, { 
//                     type: mimeType 
//                 });

//                 console.log(`🎥 Recording complete! Size: ${(blob.size / (1024*1024)).toFixed(2)} MB`);

//                 downloadRecording(blob);

//             } catch (err) {
//                 console.error("❌ Error processing recorded blob:", err);
//             }
//         };

//         // Start recording with 1-second timeslices (good for memory management)
//         mediaRecorder.start(1000);

//         console.log("🎥 Video + Audio recording started (10 seconds debug)");

//         // Auto stop after 10 seconds for debugging
//         setTimeout(() => {
//             if (mediaRecorder && mediaRecorder.state === "recording") {
//                 mediaRecorder.stop();
//             }
//         }, 10000);

//     } catch (err) {
//         console.error("❌ Recording setup failed:", err);
//     }
// }

// function downloadRecording(blob) {
//     try {
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement("a");
        
//         a.href = url;
//         a.download = `youdub_recording_${Date.now()}.webm`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);

//         URL.revokeObjectURL(url);

//         console.log("📥 Recording downloaded successfully");
//     } catch (err) {
//         console.error("❌ Download failed:", err);
//     }
// }