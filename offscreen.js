// offscreen.js - YouDub Offscreen (Compatible with your .mjs + .wasm files)

import { pipeline, env } from './transformers.min.js';

let audioContext = null;
let source = null;
let workletNode = null;
let transcriber = null;
let isProcessing = false;
let ttsQueue = [];
let canStartAI = false;

async function loadWhisper() {
    if (transcriber) return;

    try {
        console.log("🔧 Configuring ONNX Runtime paths...");

        // Important: Point to your local files
        const baseUrl = chrome.runtime.getURL('/');

        env.backends.onnx.wasm.wasmPaths = {
            'ort-wasm-simd-threaded.wasm': baseUrl + 'ort-wasm-simd-threaded.wasm',
            'ort-wasm-simd-threaded.jsep.wasm': baseUrl + 'ort-wasm-simd-threaded.jsep.wasm'
        };

        // Tell Transformers.js where to find the JSEP loader
        env.backends.onnx.wasm.jsepPath = baseUrl + 'ort-wasm-simd-threaded.jsep.mjs';

        env.allowLocalModels = false;
        env.allowRemoteModels = true;

        console.log("🚀 Loading Whisper tiny model with WebGPU support...");

        transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
            device: "webgpu",     // Try WebGPU first
            dtype: "fp32",
            progress_callback: (data) => {
                console.log("Model loading progress:", data);
            }
        });

        console.log("✅ Whisper model loaded successfully!");
        document.getElementById("status").textContent = "AI Engine Ready";

    } catch (err) {
        console.error("❌ WebGPU load failed:", err.message);

        // Fallback to WASM
        try {
            transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
                device: "wasm"
            });
            console.log("✅ Whisper loaded using WASM fallback");
            document.getElementById("status").textContent = "AI Engine Ready (WASM)";
        } catch (fallbackErr) {
            console.error("❌ Both WebGPU and WASM failed:", fallbackErr);
            document.getElementById("status").textContent = "AI Engine Failed";
        }
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_STREAM") {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: "tab",
                            chromeMediaSourceId: msg.streamId
                        }
                    },
                    video: false
                });

                console.log("✅ Stream captured with", stream.getAudioTracks().length, "audio track(s)");

                await startProcessing(stream, msg.language);
                sendResponse({ success: true });

            } catch (error) {
                console.error("getUserMedia failed:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (msg.type === "STOP_DUBBING") {
        stopProcessing();
        sendResponse({ success: true });
    }
});

async function startProcessing(stream, language) {
    try {
        console.log("🎛️ Creating AudioContext with loopback...");

        audioContext = new AudioContext({ sampleRate: 16000 });

        await audioContext.audioWorklet.addModule("audio-processor.js");

        workletNode = new AudioWorkletNode(audioContext, "audio-processor");
        source = audioContext.createMediaStreamSource(stream);

        // Strong Loopback - This should restore original audio
        source.connect(workletNode);
        source.connect(audioContext.destination);

        // Enable audio track
        stream.getAudioTracks().forEach(track => track.enabled = true);

        console.log("✅ Loopback connected. Original audio should be playing now.");

        debugDownloadStream(stream);

        setTimeout(() => {
            canStartAI = true;
            console.log("🚀 AI transcription started");
        }, 1500);

        workletNode.port.onmessage = async (event) => {
            const data = event.data;

            if (data?.type === "volume_update") {
                chrome.runtime.sendMessage({ type: "AUDIO_LEVEL", level: data.level }).catch(() => {});
                return;
            }

            const audioData = data;
            if (!audioData || !(audioData instanceof Float32Array) || !canStartAI || isProcessing) return;

            let sum = 0;
            for (let i = 0; i < audioData.length; i++) {
                sum += audioData[i] * audioData[i];
            }
            const rms = Math.sqrt(sum / audioData.length);
            if (rms < 0.008) return;

            isProcessing = true;
            await processChunk(audioData, language);
            isProcessing = false;
        };

    } catch (err) {
        console.error("startProcessing failed:", err);
    }
}

async function processChunk(audioData, language) {
    try {
        await loadWhisper();

        const result = await transcriber(audioData, {
            language: language || "hi",
            task: "translate",
            chunk_length_s: 25,
        });

        const cleanedText = result.text.replace(/\[.*?\]/g, "").trim();
        if (cleanedText.length > 8) {
            console.log("🗣️ Translated:", cleanedText);
            speakText(cleanedText);
        }
    } catch (e) {
        console.error("processChunk error:", e);
    }
}

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.05;

    utterance.onend = () => {
        ttsQueue.shift();
        if (ttsQueue.length > 0) speechSynthesis.speak(ttsQueue[0]);
    };

    ttsQueue.push(utterance);
    if (!speechSynthesis.speaking) speechSynthesis.speak(utterance);
}

function stopProcessing() {
    canStartAI = false;
    isProcessing = false;

    if (workletNode) {
        workletNode.port.postMessage({ type: "cleanup" });
        workletNode.disconnect();
        workletNode = null;
    }
    if (source) source.disconnect();
    if (audioContext) audioContext.close().catch(() => {});

    ttsQueue = [];
    speechSynthesis.cancel();
    console.log("🛑 Offscreen stopped");
}

// Debug recording
function debugDownloadStream(stream) {
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youdub_debug_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        console.log("✅ Debug audio saved");
    };

    recorder.start(1000);
    setTimeout(() => recorder.stop(), 5200);
}


//UPDATED ONE 28JUNE 2024 
// ================================================
// offscreen.js - Clean & Production Ready Version
// ================================================

// import { pipeline, env } from './transformers.min.js';

// let audioContext = null;
// let source = null;
// let workletNode = null;
// let transcriber = null;
// let currentStream = null;
// let isProcessing = false;
// let canStartAI = false;
// let ttsQueue = [];

// // ====================== MODEL INITIALIZATION ======================
// async function initializeModel() {
//     if (transcriber) return;

//     try {
//         const baseUrl = chrome.runtime.getURL('');

//         // Force fully offline mode
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

//         console.log("✅ Whisper model loaded successfully from local files (WebGPU)");
//         document.getElementById("status").textContent = "AI Engine Ready (WebGPU)";

//     } catch (err) {
//         console.warn("WebGPU failed, trying WASM fallback:", err.message);

//         try {
//             transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//                 device: "wasm",
//                 allowLocalModels: true,
//                 allowRemoteModels: false
//             });

//             console.log("✅ Whisper model loaded with WASM fallback");
//             document.getElementById("status").textContent = "AI Engine Ready (WASM)";
//         } catch (fallbackErr) {
//             console.error("❌ Model loading completely failed:", fallbackErr);
//             document.getElementById("status").textContent = "AI Engine Failed - Check Console";
//         }
//     }
// }

// // Load model as soon as offscreen document starts
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
//                 sendResponse({ success: false, error: error.message || "Unknown error" });
//             }
//         })();
//         return true;
//     }

//     if (msg.type === "STOP_DUBBING") {
//         stopDubbing();
//         sendResponse({ success: true });
//     }
// });

// // ====================== START DUBBING ======================
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
//             throw new Error("No audio tracks found in stream");
//         }

//         await initializeAudioPipeline(currentStream, language);

//     } catch (err) {
//         console.error("Failed to start dubbing stream:", err);
//         throw err;
//     }
// }

// async function initializeAudioPipeline(stream, language) {
//     audioContext = new AudioContext({ sampleRate: 16000 });

//     await audioContext.audioWorklet.addModule("audio-processor.js");

//     workletNode = new AudioWorkletNode(audioContext, "audio-processor");
//     source = audioContext.createMediaStreamSource(stream);

//     // Connect ONLY to worklet (NO destination - we don't want original audio)
//     source.connect(workletNode);

//     // Enable audio tracks
//     stream.getAudioTracks().forEach(track => track.enabled = true);

//     console.log("✅ Audio pipeline initialized successfully");

//     // Wait for model to be ready
//     await initializeModel();

//     canStartAI = true;

//     // Handle messages from AudioWorklet
//     workletNode.port.onmessage = async (event) => {
//         const data = event.data;

//         if (data?.type === "volume_update") {
//             chrome.runtime.sendMessage({ type: "AUDIO_LEVEL", level: data.level }).catch(() => {});
//             return;
//         }

//         if (!data || !(data instanceof Float32Array) || !canStartAI || isProcessing) return;

//         const rms = calculateRMS(data);
//         if (rms < 0.008) return;   // Silence threshold

//         isProcessing = true;
//         try {
//             await processChunk(data, language);
//         } catch (e) {
//             console.error("processChunk error:", e);
//         } finally {
//             isProcessing = false;
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
//         console.warn("Transcriber not loaded yet");
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
//     if (source) {
//         source.disconnect();
//         source = null;
//     }
//     if (audioContext) {
//         audioContext.close().catch(() => {});
//         audioContext = null;
//     }

//     // Important: Stop all media tracks
//     if (currentStream) {
//         currentStream.getTracks().forEach(track => track.stop());
//         currentStream = null;
//     }

//     ttsQueue = [];
//     speechSynthesis.cancel();

//     if (!silent) {
//         console.log("🛑 Dubbing stopped and all resources cleaned");
//     }
// }

// console.log("🎥 Offscreen document ready - Model loading started...");