// audio-processor.js - Optimized for YouDub

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.bufferSize = 0;
        this.targetChunkSize = 16000 * 5;   // ~5 seconds at 16kHz (good for Whisper)
    }

    process(inputs) {
        const input = inputs[0]; // First input (mono or stereo)

        if (!input || input.length === 0 || !input[0]) {
            return true; // Keep processor alive
        }

        const audioData = input[0]; // Float32Array chunk

        // Add current chunk to buffer
        this.buffer.push(...audioData);
        this.bufferSize += audioData.length;

        // When we have enough data (~5 seconds), send to offscreen.js
        if (this.bufferSize >= this.targetChunkSize) {
            const chunk = new Float32Array(this.buffer);
            this.port.postMessage(chunk);   // Send full chunk to offscreen

            // Reset buffer
            this.buffer = [];
            this.bufferSize = 0;
        }

        // Send volume updates for visualizer (throttled)
        if (this.bufferSize % 1600 === 0) {   // roughly every 100ms
            let sum = 0;
            for (let i = 0; i < audioData.length; i++) {
                sum += audioData[i] * audioData[i];
            }
            const rms = Math.sqrt(sum / audioData.length);

            this.port.postMessage({
                type: "volume_update",
                level: rms
            });
        }

        return true; // Keep the AudioWorklet running
    }
}

// Register the processor so offscreen.js can use it
registerProcessor("audio-processor", AudioProcessor);