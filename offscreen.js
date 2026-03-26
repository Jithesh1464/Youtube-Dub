// let audioContext;
// let source;
// let processor;
// import { pipeline, env } from './transformers.min.js';
// let transcriber = null;

// console.log("Transformers:", window.transformers);

// async function loadWhisper() {
//   if (transcriber) return;

//   console.log("Loading Whisper model...");

//   env.allowLocalModels = false;
// env.useBrowserCache = true;

// // transcriber = await pipeline(
// //   "automatic-speech-recognition",
// //   "Xenova/whisper-tiny.en",
// //   {
// //     device: "webgpu"
// //   }
// // );

//   // ✅ Enable WebGPU
//   env.allowLocalModels = false;
//   env.useBrowserCache = true;

//   transcriber = await pipeline(
//     "automatic-speech-recognition",
//   "Xenova/whisper-tiny.en",
//   {
//     device: "wasm"   // 🔥 fallback if GPU fails
//   }
//   );

//   console.log("Whisper loaded!");
// }
// console.log("Offscreen script loaded");




// chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//   console.log("Received message in offscreen:", msg);

//   if (msg.type === "START_STREAM") {
//     // We use an async IIFE because the listener itself shouldn't be async 
//     // if we want to use sendResponse correctly in some Chrome versions
//     (async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           audio: {
//             mandatory: {
//               chromeMediaSource: "tab",
//               chromeMediaSourceId: msg.streamId // Note: This should be the streamId from background
//             }
//           }
//         });

//         startProcessing(stream, msg.language);
        
//         // Success response
//         sendResponse({ success: true, status: "Stream captured" });
//       } catch (error) {
//         console.error("Stream capture failed:", error);
//         sendResponse({ success: false, error: error.message });
//       }
//     })();

//     return true; // CRITICAL: Keeps the message channel open for the async sendResponse
//   }
// });


// async function startProcessing(stream, language) {
//   audioContext = new AudioContext();

//   if (audioContext.state === "suspended") {
//     await audioContext.resume();
//   }

//   source = audioContext.createMediaStreamSource(stream);

//   // ✅ Load worklet
//   await audioContext.audioWorklet.addModule("audio-processor.js");

//   const workletNode = new AudioWorkletNode(audioContext, "audio-processor");

//   source.connect(workletNode);

//   let audioBuffer = [];

//   workletNode.port.onmessage = (event) => {
//     const input = event.data;
//     console.log("Audio chunk received");

//     audioBuffer.push(new Float32Array(input));

//     if (audioBuffer.length > 100) {
//       const chunk = mergeBuffers(audioBuffer);
//       audioBuffer = [];

//       processChunk(chunk, language);
//     }
//   };
// }

// function mergeBuffers(buffers) {
//   let length = buffers.reduce((sum, b) => sum + b.length, 0);
//   let result = new Float32Array(length);

//   let offset = 0;
//   for (let b of buffers) {
//     result.set(b, offset);
//     offset += b.length;
//   }

//   return result;
// }


// // Placeholder for actual processing logic

// //*****
// async function processChunk(audioData, language) {
//   console.log("Processing chunk...");

//   const sampleRate = audioContext.sampleRate;

//   const downsampled = downsampleBuffer(audioData, sampleRate, 16000);

//   const text = await realSTT(downsampled);

//   const translated = await fakeTranslate(text, language);

//   speakText(translated);
// }

// // async function fakeSTT() {
// //   return "Hello, this is a test sentence";
// // }

// async function realSTT(audioData) {
//   await loadWhisper();

//   console.log("Running Whisper...");

//   // Convert Float32 → required format
//   const result = await transcriber(audioData, {
//     chunk_length_s: 5,
//     stride_length_s: 1
//   });

//   console.log("Transcription:", result.text);

//   return result.text;
// }

// async function fakeTranslate(text) {
//   return text; // already English for now
// }

// function speakText(text) {
//   const utterance = new SpeechSynthesisUtterance(text);
//   utterance.lang = "en-US";

//   speechSynthesis.speak(utterance);
// }


// function downsampleBuffer(buffer, sampleRate, targetRate) {
//   if (targetRate === sampleRate) return buffer;

//   const ratio = sampleRate / targetRate;
//   const newLength = Math.round(buffer.length / ratio);
//   const result = new Float32Array(newLength);

//   let offset = 0;

//   for (let i = 0; i < newLength; i++) {
//     const nextOffset = Math.round((i + 1) * ratio);
//     let accum = 0, count = 0;

//     for (let j = offset; j < nextOffset && j < buffer.length; j++) {
//       accum += buffer[j];
//       count++;
//     }

//     result[i] = accum / count;
//     offset = nextOffset;
//   }

//   return result;
// }
import { pipeline, env } from './transformers.min.js';

// let audioContext;
// let transcriber = null;
let isProcessing = false;
let ttsQueue = [];
// let source;

let audioContext = null;
let source = null;
let workletNode = null;
let transcriber = null;

// // 1. Optimized Model Loading
// async function loadWhisper() {
//   if (transcriber) return;
  
//   // Necessary for Chrome Extensions to find WASM/WebGPU files locally
//   env.allowLocalModels = false;
//   env.useBrowserCache = true;

//   console.log("Loading Multilingual Whisper on WebGPU...");
  
// //   transcriber = await pipeline("automatic-speech-recognition", "openai/whisper-tiny", {
// //     device: "webgpu", // Use WebGPU for 2026 performance
// //   });
//   transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//     device: "webgpu",
// });
// }

// async function loadWhisper() {
//   if (transcriber) return;

//   console.log("Starting Local WebGPU Pipeline...");

//   try {
//     // 1. Tell the engine to find WASM/JSEP files in your extension root
//     const extensionPath = chrome.runtime.getURL('/');
    
//     env.allowLocalModels = false; // We are still fetching the .onnx model from HuggingFace
//     env.allowRemoteModels = true; 
    
//     // This points to where you saved 'ort-wasm-simd-threaded.jsep.mjs'
//     env.backends.onnx.wasm.wasmPaths = extensionPath;

//     // 2. Initialize the pipeline
//     // Using 'onnx-community' is more reliable for WebGPU in 2026
//     transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//       device: "webgpu",
//       dtype: "fp32" 
//     });

//     console.log("✅ YouDub AI Engine: Whisper Loaded Successfully!");
//   } catch (err) {
//     console.error("❌ FATAL: Whisper could not start. Reason:", err.message);
    
//     // Fallback to WASM if WebGPU fails (slower but works)
//     if (err.message.includes("webgpu")) {
//         console.log("Falling back to WASM backend...");
//         transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
//             device: "wasm"
//         });
//     }
//   }
// }
async function loadWhisper() {
  if (transcriber) return;

  try {
    // 1. Tell Transformers.js to find local .wasm and .mjs files
    const extensionPath = chrome.runtime.getURL('/');
    env.backends.onnx.wasm.wasmPaths = extensionPath;

    // 2. Allow remote model fetching (until you download the 100MB+ model files)
    env.allowLocalModels = false;
    env.allowRemoteModels = true;

    console.log("🚀 Initializing WebGPU Multilingual Pipeline...");

    transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
      device: "webgpu",
      dtype: "fp32" 
    });

    console.log("✅ AI Engine Ready!");
  } catch (err) {
    console.error("❌ Startup Failed:", err.message);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_STREAM") {
    (async () => {
      try {
        // const stream = await navigator.mediaDevices.getUserMedia({
        //   audio: {
        //     mandatory: {
        //       chromeMediaSource: "tab",
        //       chromeMediaSourceId: msg.streamId 
        //     }
        //   }
        // });
        // // console.log("✅ Tab audio captured successfully!");
        // console.log("✅ Stream captured!");
        // debugDownloadStream(stream);

        const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    mandatory: {
      chromeMediaSource: 'tab',
      chromeMediaSourceId: msg.streamId
    }
  },
  video: false // Explicitly tell Chrome we only want the audio track
});



// Check if the stream actually has tracks
console.log("Audio Tracks found:", stream.getAudioTracks().length);
debugDownloadStream(stream);
if (stream.getAudioTracks().length === 0) {
  console.error("❌ Captured stream contains NO audio tracks!");
}


        startProcessing(stream, msg.language);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  else if (msg.type === "STOP_DUBBING") {
        stopProcessing();
        sendResponse({ success: true });
    }
});

async function stopProcessing() {
    console.log("🛑 Cleaning up audio pipeline...");

    if (workletNode) {
        workletNode.port.postMessage("cleanup"); // Tell worklet to clear its internal buffer
        workletNode.disconnect();
        workletNode = null;
    }

    if (source) {
        source.disconnect();
        source = null;
    }

    if (audioContext) {
        await audioContext.close();
        audioContext = null;
        console.log("✅ AudioContext Closed.");
    }
}


// async function startProcessing(stream, language) {
//   audioContext = new AudioContext({ sampleRate: 16000 }); // Set 16kHz immediately
//   const source = audioContext.createMediaStreamSource(stream);

//   await audioContext.audioWorklet.addModule("audio-processor.js");
//   const workletNode = new AudioWorkletNode(audioContext, "audio-processor");
//   source.connect(workletNode);

//   let currentBuffer = [];

//   workletNode.port.onmessage = async (event) => {
//     // Collect Float32 audio data
//     currentBuffer.push(...event.data);
//     const audioData = event.data;
  
//   // Calculate Volume Level
//   let sum = 0;
//   for (let i = 0; i < audioData.length; i++) {
//     sum += audioData[i] * audioData[i];
//   }
//   const volume = Math.sqrt(sum / audioData.length);

//   // Send volume to Popup (only if popup is open)
//   chrome.runtime.sendMessage({
//     type: "AUDIO_LEVEL",
//     level: volume
//   }).catch(() => {});

//     // Process in ~5 second chunks for a balance of speed and context
//     // 16000 samples/sec * 5 sec = 80,000 samples
//     if (currentBuffer.length >= 80000 && !isProcessing) {
//       const toProcess = new Float32Array(currentBuffer);
//       currentBuffer = []; // Reset buffer
      
//       isProcessing = true;
//       await processChunk(toProcess, language);
//       isProcessing = false;
//     }
//   };
// }

// async function processChunk(audioData, language) {
//   try {
//     await loadWhisper();

//     // 'translate' task tells Whisper to output English regardless of input lang
//     const result = await transcriber(audioData, {
//       language: language, // 'hindi', 'telugu', 'tamil'
//       task: 'translate', 
//       chunk_length_s: 30,
//     });

//     if (result.text.trim()) {
//       console.log("AI Output:", result.text);
//       speakText(result.text);
//     }
//   } catch (e) {
//     console.error("Inference Error:", e);
//   }
// }


// async function startProcessing(stream, language) {
//   audioContext = new AudioContext({ sampleRate: 16000 });
  
//   // Now this will work because 'source' was declared at the top
//   source = audioContext.createMediaStreamSource(stream); 

//   await audioContext.audioWorklet.addModule("audio-processor.js");
//   const workletNode = new AudioWorkletNode(audioContext, "audio-processor");

//   source.connect(workletNode);
// }

// Inside startProcessing in offscreen.js
async function startProcessing(stream, language) {
  // 1. Initialize Context at a standard 16kHz (Less data = less stress)
  audioContext = new AudioContext({ sampleRate: 16000 });
  
  // 2. Load the Worklet first
  await audioContext.audioWorklet.addModule("audio-processor.js");
  workletNode = new AudioWorkletNode(audioContext, "audio-processor");

  source = audioContext.createMediaStreamSource(stream);
  source.connect(workletNode);

  // 3. START THE RECORDER FIRST
  debugDownloadStream(stream); 

  // 4. WAIT 1 SECOND before letting the AI "Inference" start
  // This gives the recorder a "head start" so it doesn't crash
  setTimeout(() => {
    canStartAI = true; 
    console.log("🚀 AI Warm-up complete. Starting transcription...");
  }, 1000);
}


async function processChunk(audioData, language) {
  // Check the average volume of the chunk (Root Mean Square)
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);

  // If the volume is lower than 0.01, it's basically silence
  if (rms < 0.01) {
    console.log("🤫 Chunk too quiet, skipping AI...");
    return;
  }

  await loadWhisper();
  
  const result = await transcriber(audioData, {
    language: language,
    task: 'translate', // Ensures it outputs English
    return_timestamps: false,
  });

  const cleanedText = result.text.replace(/\[.*?\]/g, "").trim(); // Removes [Music], [Silence], etc.

  if (cleanedText.length > 0) {
    console.log("🗣️ Transcription:", cleanedText);
    speakText(cleanedText);
  }
}

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.1; // Slightly faster to keep up with video

  // TTS Queue Logic
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

// FOR VERIFICATION: VIDEO FIRST 5 SEC CHUNK DOWNLOAD WITH AUDIO
// 1. Add this helper function to offscreen.js
// function debugDownloadStream(stream) {
//   console.log("🛠️ Debug: Starting 5-second recording for verification...");
  
//   const mediaRecorder = new MediaRecorder(stream);
//   const chunks = [];

//   mediaRecorder.ondataavailable = (e) => {
//     if (e.data.size > 0) chunks.push(e.data);
//   };

//   mediaRecorder.onstop = () => {
//     const blob = new Blob(chunks, { type: 'audio/webm' });
//     const url = URL.createObjectURL(blob);
    
//     // Create a temporary hidden link to trigger the download
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `debug_audio_capture_${Date.now()}.webm`;
//     document.body.appendChild(a);
//     a.click();
    
//     // Cleanup
//     setTimeout(() => {
//       document.body.removeChild(a);
//       URL.revokeObjectURL(url);
//       console.log("✅ Debug file downloaded. Check your downloads folder!");
//     }, 100);
//   };

//   // Record for exactly 5 seconds then stop
//   mediaRecorder.start();
//   setTimeout(() => mediaRecorder.stop(), 5000);
// }

// function debugDownloadStream(stream) {
//   const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
//   const chunks = [];

//   mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
//   mediaRecorder.onstop = () => {
//     const blob = new Blob(chunks, { type: 'audio/webm' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `TEST_CAPTURE_${Date.now()}.webm`;
//     a.click();
//   };

//   mediaRecorder.start();
//   console.log("🎙️ Recording 5 seconds of Tab Audio...");
//   setTimeout(() => mediaRecorder.stop(), 5000);
// }

function debugDownloadStream(stream) {
  const mediaRecorder = new MediaRecorder(stream, { 
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000 // Lower bitrate to save CPU
  });
  
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_audio_${Date.now()}.webm`;
    a.click();
  };

  // Record in 1000ms "slices" instead of one giant 5-second block
  mediaRecorder.start(1000); 
  setTimeout(() => mediaRecorder.stop(), 5000);
}