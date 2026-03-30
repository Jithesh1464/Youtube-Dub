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