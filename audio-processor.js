class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(0);        // More efficient than regular array
        this.bufferSize = 0;
        
        this.totalSamplesProcessed = 0;
        this.initialVideoTime = 0; 
        this.isSynced = false;

        // Better chunk settings for real-time dubbing
        this.chunkDuration = 12;                  // 12 seconds per chunk (good balance)
        this.overlapDuration = 4;                 // 4 seconds overlap between chunks
        this.sampleRate = 16000;
        
        this.targetChunkSize = this.sampleRate * this.chunkDuration;
        this.overlapSize = this.sampleRate * this.overlapDuration;
        
        this.lastChunkTime = Date.now();
        this.sequence = 0;
        this.port.onmessage = (event) => {
            if (event.data.type === "SET_SYNC_INTERNAL") {
                console.log("WORKLET: Sync Received!", event.data.startTime); // ADD THIS
                this.initialVideoTime = event.data.startTime;
                this.totalSamplesProcessed = 0; // Reset for new start/seek
                this.isSynced = true;
                console.log(`[Processor] Synced to YT Time: ${this.initialVideoTime}`);
            }
        };
    }

    // process(inputs, outputs, parameters) {
    //     const input = inputs[0]; // First input channel

    //     if (!input || input.length === 0 || !input[0]) {
    //         return true;
    //     }

    //     const audioData = input[0]; // Float32Array

    //     // Append new audio data efficiently
    //     const newBuffer = new Float32Array(this.bufferSize + audioData.length);
    //     newBuffer.set(this.buffer, 0);
    //     newBuffer.set(audioData, this.bufferSize);
        
    //     this.buffer = newBuffer;
    //     this.bufferSize += audioData.length;

    //     // Send volume update (throttled)
    //     if (this.bufferSize % 800 === 0) {   // ~every 50ms
    //         const rms = this.calculateRMS(audioData);
    //         this.port.postMessage({
    //             type: "volume_update",
    //             level: Math.min(rms * 2, 1.0)   // Normalize a bit
    //         });
    //     }

    //     // Send chunk when we have enough data
    //     if (this.bufferSize >= this.targetChunkSize) {
    //         const chunk = this.buffer.slice(0, this.targetChunkSize);
            
    //         this.port.postMessage({
    //             type: "audio_chunk",
    //             data: chunk,
    //             sequence: this.sequence++,
    //             timestamp: Date.now(),
    //             duration: this.chunkDuration
    //         });

    //         // Keep overlap for next chunk (smooth transitions)
    //         const remaining = this.buffer.slice(this.targetChunkSize - this.overlapSize);
    //         this.buffer = remaining;
    //         this.bufferSize = remaining.length;
    //     }

    //     return true; // Keep processor alive
    // }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0] || !this.isSynced) return true;

        const audioData = input[0];
        if (this.bufferSize > 0 && this.bufferSize % 16000 < audioData.length) {
        console.log(`[Worklet] Data flowing. Buffer: ${this.bufferSize} samples`);
        }
        
        // Buffer management
        const newBuffer = new Float32Array(this.bufferSize + audioData.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(audioData, this.bufferSize);
        this.buffer = newBuffer;
        this.bufferSize += audioData.length;

        if (this.bufferSize % 800 === 0) {   // ~every 50ms
            const rms = this.calculateRMS(audioData);
            this.port.postMessage({
                type: "volume_update",
                level: Math.min(rms * 2, 1.0)   // Normalize a bit
            });
        }

        if (this.bufferSize >= this.targetChunkSize) {
            // --- CALCULATE START/END TIMESTAMPS ---
            const startTimeOffset = this.totalSamplesProcessed / this.sampleRate;
            const endTimeOffset = (this.totalSamplesProcessed + this.targetChunkSize) / this.sampleRate;

            this.port.postMessage({
                type: "audio_chunk",
                data: this.buffer.slice(0, this.targetChunkSize),
                ytStart: this.initialVideoTime + startTimeOffset,
                ytEnd: this.initialVideoTime + endTimeOffset
            });

            this.totalSamplesProcessed += this.targetChunkSize;
            
            // Keep overlap (4s)
            const overlapSize = this.sampleRate * 4;
            const remaining = this.buffer.slice(this.targetChunkSize - overlapSize);
            this.buffer = remaining;
            this.bufferSize = remaining.length;
        }

        return true;
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