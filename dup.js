// ====================== IMPROVED SELF VOICE DUB ======================
let selfMicStream = null;
let selfMediaRecorder = null;
let selfRecordedChunks = [];
let silenceCheckInterval = null;
let isSelfDubbingActive = false;
let consecutiveSilentChunks = 0;
const SILENCE_THRESHOLD = 0.008;        // Adjust this value if needed
const REQUIRED_SILENT_CHUNKS = 12;      // ~6 seconds of real silence (at 500ms chunks)

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
        consecutiveSilentChunks = 0;

        selfMediaRecorder = new MediaRecorder(selfMicStream, {
            mimeType: "audio/webm;codecs=opus"
        });

        selfMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                selfRecordedChunks.push(e.data);
                handleAudioChunk(e.data);
            }
        };

        selfMediaRecorder.start(500);   // 500ms chunks

        console.log("✅ Self Voice Dub: Listening to microphone");

    } catch (err) {
        console.error("Microphone access error:", err);
        chrome.runtime.sendMessage({ 
            type: "SELF_DUB_ERROR", 
            error: "Microphone permission denied or unavailable." 
        });
    }
}

// New: Handle each audio chunk with RMS calculation
function handleAudioChunk(audioBlob) {
    if (!isSelfDubbingActive) return;

    // Simple way to check if chunk has meaningful audio
    // For better accuracy, we can convert to Float32Array, but for speed we'll use a simple check first
    const reader = new FileReader();
    reader.onload = function() {
        // This is a simplified check. For production we can improve it.
        if (reader.result.byteLength < 2000) {   // Very small chunk = likely silence
            consecutiveSilentChunks++;
        } else {
            consecutiveSilentChunks = 0;
        }

        if (consecutiveSilentChunks >= REQUIRED_SILENT_CHUNKS) {
            console.log(`🛑 Real silence detected (${consecutiveSilentChunks} silent chunks) → Processing audio`);
            clearInterval(silenceCheckInterval);
            processSelfRecordedAudio();
        }
    };
    reader.readAsArrayBuffer(audioBlob);
}

function stopSelfVoiceDub() {
    if (selfMediaRecorder) selfMediaRecorder.stop();
    if (selfMicStream) selfMicStream.getTracks().forEach(track => track.stop());
    isSelfDubbingActive = false;
    consecutiveSilentChunks = 0;
    console.log("⏹️ Self Voice Dub stopped manually");
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
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const audioData = audioBuffer.getChannelData(0);

        console.log(`✅ Audio decoded | Duration: ${audioBuffer.duration.toFixed(2)}s`);

        chrome.runtime.sendMessage({
            type: "PROCESS_SELF_AUDIO",
            audioData: Array.from(audioData)
        });

    } catch (err) {
        console.error("Self dub processing error:", err);
        chrome.runtime.sendMessage({ type: "SELF_DUB_FINISHED" });
    }
}