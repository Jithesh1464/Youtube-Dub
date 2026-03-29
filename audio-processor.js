// // audio-processor.js - Optimized for YouDub

// class AudioProcessor extends AudioWorkletProcessor {
//     constructor() {
//         super();
//         this.buffer = [];
//         this.bufferSize = 0;
//         this.targetChunkSize = 16000 * 5;   // ~5 seconds at 16kHz (good for Whisper)
//     }

//     process(inputs) {
//         const input = inputs[0]; // First input (mono or stereo)

//         if (!input || input.length === 0 || !input[0]) {
//             return true; // Keep processor alive
//         }

//         const audioData = input[0]; // Float32Array chunk

//         // Add current chunk to buffer
//         this.buffer.push(...audioData);
//         this.bufferSize += audioData.length;

//         // When we have enough data (~5 seconds), send to offscreen.js
//         if (this.bufferSize >= this.targetChunkSize) {
//             const chunk = new Float32Array(this.buffer);
//             this.port.postMessage(chunk);   // Send full chunk to offscreen

//             // Reset buffer
//             this.buffer = [];
//             this.bufferSize = 0;
//         }

//         // Send volume updates for visualizer (throttled)
//         if (this.bufferSize % 1600 === 0) {   // roughly every 100ms
//             let sum = 0;
//             for (let i = 0; i < audioData.length; i++) {
//                 sum += audioData[i] * audioData[i];
//             }
//             const rms = Math.sqrt(sum / audioData.length);

//             this.port.postMessage({
//                 type: "volume_update",
//                 level: rms
//             });
//         }

//         return true; // Keep the AudioWorklet running
//     }
// }

// // Register the processor so offscreen.js can use it
// registerProcessor("audio-processor", AudioProcessor);

// audio-processor.js - Improved for YouDub Real-time Dubbing

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(0);        // More efficient than regular array
        this.bufferSize = 0;
        
        // Better chunk settings for real-time dubbing
        this.chunkDuration = 12;                  // 12 seconds per chunk (good balance)
        this.overlapDuration = 4;                 // 4 seconds overlap between chunks
        this.sampleRate = 16000;
        
        this.targetChunkSize = this.sampleRate * this.chunkDuration;
        this.overlapSize = this.sampleRate * this.overlapDuration;
        
        this.lastChunkTime = Date.now();
        this.sequence = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]; // First input channel

        if (!input || input.length === 0 || !input[0]) {
            return true;
        }

        const audioData = input[0]; // Float32Array

        // Append new audio data efficiently
        const newBuffer = new Float32Array(this.bufferSize + audioData.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(audioData, this.bufferSize);
        
        this.buffer = newBuffer;
        this.bufferSize += audioData.length;

        // Send volume update (throttled)
        if (this.bufferSize % 800 === 0) {   // ~every 50ms
            const rms = this.calculateRMS(audioData);
            this.port.postMessage({
                type: "volume_update",
                level: Math.min(rms * 2, 1.0)   // Normalize a bit
            });
        }

        // Send chunk when we have enough data
        if (this.bufferSize >= this.targetChunkSize) {
            const chunk = this.buffer.slice(0, this.targetChunkSize);
            
            this.port.postMessage({
                type: "audio_chunk",
                data: chunk,
                sequence: this.sequence++,
                timestamp: Date.now(),
                duration: this.chunkDuration
            });

            // Keep overlap for next chunk (smooth transitions)
            const remaining = this.buffer.slice(this.targetChunkSize - this.overlapSize);
            this.buffer = remaining;
            this.bufferSize = remaining.length;
        }

        return true; // Keep processor alive
    }

    calculateRMS(audioData) {
        let sum = 0;
        const len = audioData.length;
        for (let i = 0; i < len; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / len);
    }

    // Handle cleanup message from offscreen.js
    static get parameterDescriptors() {
        return [];
    }
}

// Register the processor
registerProcessor("audio-processor", AudioProcessor);

console.log("✅ AudioWorklet Processor loaded with overlapping chunks");