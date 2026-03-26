// class AudioProcessor extends AudioWorkletProcessor {
//   process(inputs) {
//     const input = inputs[0];

//     if (input.length > 0) {
//       const channelData = input[0];

//       // Send audio data to main thread
//       this.port.postMessage(channelData);
//     }

//     return true;
//   }
// }

// registerProcessor("audio-processor", AudioProcessor);


class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = (event) => {
            if (event.data === "cleanup") {
                // Logic to clear any local arrays if you had them
                console.log("Worklet: Cleaning up...");
            }
        };
    }

    process(inputs) {
        const input = inputs[0];
        if (input && input.length > 0 && input[0]) {
            // Transfer the data immediately so it doesn't linger
            this.port.postMessage(new Float32Array(input[0]));
        }
        return true;
    }
}

registerProcessor("audio-processor", AudioProcessor);