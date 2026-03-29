let waveformCanvas = null;
let waveformCtx = null;
let startTime = null;
let timerInterval = null;

const WAVE_COLOR = "#22ff88";

function initWaveformVisualizer() {
    waveformCanvas = document.getElementById("waveform");
    if (!waveformCanvas) return;
    waveformCtx = waveformCanvas.getContext("2d");
}
function updateTimer() {
    if (!startTime) return;
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById("time-info").innerText = `${mins}:${secs}`;
}

let audioHistory = [];
const PIXELS_PER_POINT = 6;

const scrollWrapper = document.getElementById('scroll-wrapper');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
let isUserScrolling = false;

scrollWrapper.addEventListener('scroll', () => {
    const isAtEnd = scrollWrapper.scrollLeft + scrollWrapper.clientWidth >= scrollWrapper.scrollWidth - 10;
    isUserScrolling = !isAtEnd;
});

function updateWaveform(level) {
    audioHistory.push(level);

    const newWidth = audioHistory.length * PIXELS_PER_POINT;
    canvas.width = Math.max(newWidth, scrollWrapper.clientWidth);

    draw();
    
    if (!isUserScrolling) {
        scrollWrapper.scrollLeft = scrollWrapper.scrollWidth;
    }
}

function draw() {
    const h = canvas.height;
    const centerY = h / 2;
    ctx.clearRect(0, 0, canvas.width, h);

    // X-Axis Baseline (Center Line)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    // ==================== MAIN WAVEFORM (Only Upper Line) ====================
    ctx.beginPath();
    ctx.strokeStyle = WAVE_COLOR;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = WAVE_COLOR;

    for (let i = 0; i < audioHistory.length; i++) {
        const x = i * PIXELS_PER_POINT;
        const amplitude = audioHistory[i] * (h * 0.42);   // Adjusted for better visibility
        
        const y = centerY - amplitude;                    // Only upper part

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.stroke();

    // ==================== X-AXIS LABELS (Time) ====================
    ctx.fillStyle = "#666";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";

    for (let i = 0; i < audioHistory.length; i += 50) {        // Every 50 points (~5 seconds)
        const x = i * PIXELS_PER_POINT;
        const seconds = Math.floor(i * PIXELS_PER_POINT / 60); // rough time in seconds
        ctx.fillText(seconds + "s", x, h - 8);
    }

    // ==================== Y-AXIS LABELS (Already in HTML) ====================
    // We are not drawing them on canvas since you have fixed HTML labels
}

// ==================== MESSAGE LISTENERS ====================
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "AUDIO_LEVEL") {
        if (!startTime) {
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
        }
        updateWaveform(msg.level);
    }

    if (msg.type === "DUBBING_STOPPED") {
        clearInterval(timerInterval);
        startTime = null;
        audioHistory = [];
        document.getElementById("time-info").innerText = "00:00";
        draw(); 
    }
});

document.addEventListener("DOMContentLoaded", initWaveformVisualizer);