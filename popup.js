// let isStarted = false;

// document.getElementById("start").onclick = async () => {
//   if (isStarted) {
//     alert("Dubbing already running!");
//     return;
//   }

//   isStarted = true;

//   const language = document.getElementById("language").value;

//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

//   try {
//     await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
//   } catch {
//     await chrome.scripting.executeScript({
//       target: { tabId: tab.id },
//       files: ["content.js"]
//     });

//     await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
//   }

//   chrome.runtime.sendMessage({
//     type: "START_DUBBING",
//     language,
//     tabId: tab.id
//   });
// };

// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // FOR DEBUGGING AND SEEING MSSG OF updateStatus("Injecting audio controller...", "info");

// let isStarted = false;

// // UI Elements
// const startBtn = document.getElementById("start");
// const langSelect = document.getElementById("language");
// const statusContainer = document.getElementById("status-container");
// const statusMsg = document.getElementById("status-msg");

// document.getElementById("start").onclick = async () => {
//     // If already running, we treat the click as a "Stop" command
//     if (isStarted) {
//         stopDubbing();
//         return;
//     }

//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     const debugData = [{
//         id: tab.id,
//         url: tab.url,
//         title: tab.title,
//         windowId: tab.windowId
//     }];
    
//     console.log("--- CURRENT ACTIVE TAB DATA ---");
//     console.table(debugData); // This prints it in a nice table format
//     console.log("Full Object:", debugData);

//     // Validation: Ensure we are on a video page (like YouTube)
//     if (!tab.url.includes("youtube.com") && !tab.url.includes("video")) {
//         updateStatus("Please open a video page first.", "error");
//         await sleep(800);
//         return;
//     }

//     updateUIState(true);
//     const language = langSelect.value;

//     try {
//         updateStatus("Injecting audio controller...", "info");
//         await sleep(800);
        
//         // 1. Try to mute the video (Injecting content script if missing)
//         try {
//             await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
//         } catch (err) {
//             await chrome.scripting.executeScript({
//                 target: { tabId: tab.id },
//                 files: ["content.js"]
//             });
//             await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
//         }
//         //I want to see these in between msg too , so i think i need to add wait() for debugging
//         // 2. Signal the Background Script to start the AI Pipeline
//         updateStatus("Starting AI Pipeline (WebGPU)...", "info");
//         await sleep(800);
        
        
//         chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
    
//     // 2. Now send BOTH the language and the TOKEN to the background/offscreen
//     chrome.runtime.sendMessage({
//         type: "START_DUBBING",
//         language: language,
//         streamId: streamId, // This is the secret sauce
//         tabId: tab.id
//     }, (response) => {
//         if (chrome.runtime.lastError || !response?.success) {
//             updateStatus("AI Engine failed to start.", "error");
//             updateUIState(false);
//         } else {
//             updateStatus("YouDub is Active!", "success");
//         }
//     });
// });

//     } catch (error) {
//         console.error("Dubbing Error:", error);
//         updateStatus("Connection failed.", "error");
//         updateUIState(false);
//     }
// };

// // --- Helper Functions for Clean Logic ---

// function updateUIState(started) {
//     isStarted = started;
//     if (started) {
//         startBtn.innerText = "Stop Dubbing";
//         startBtn.style.background = "linear-gradient(135deg, #444 0%, #222 100%)";
//         statusContainer.style.display = "block";
//         langSelect.disabled = true;
//     } else {
//         startBtn.innerText = "Start Dubbing";
//         startBtn.style.background = "linear-gradient(135deg, #ff0000 0%, #b91c1c 100%)";
//         langSelect.disabled = false;
//     }
// }

// function updateStatus(message, type) {
//     statusMsg.innerText = message;
//     const pulse = document.querySelector(".pulse");
    
//     // Change pulse color based on status
//     if (type === "error") {
//         pulse.style.backgroundColor = "#ff4444";
//         statusMsg.style.color = "#ff4444";
//     } else if (type === "success") {
//         pulse.style.backgroundColor = "#4ade80"; // Green
//         statusMsg.style.color = "#4ade80";
//     } else {
//         pulse.style.backgroundColor = "#6366f1"; // Blue
//         statusMsg.style.color = "#ccc";
//     }
// }

// async function stopDubbing() {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     // Send stop signal
//     chrome.runtime.sendMessage({ type: "STOP_DUBBING", tabId: tab.id });
    
//     // Unmute the video
//     try {
//         await chrome.tabs.sendMessage(tab.id, { type: "UNMUTE_VIDEO" });
//     } catch(e) {}

//     updateUIState(false);
//     statusContainer.style.display = "none";
// }

// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.type === "AUDIO_LEVEL") {
//     // console.log("Popup received level:", msg.level); // Add this line
//     const bars = document.querySelectorAll(".bar");
//     const container = document.querySelector(".visualizer-container");
    
//     if (container) container.style.display = "flex"; 

//     bars.forEach((bar, index) => {
//       const multi = [0.8, 1.2, 1.5, 1.1, 0.9];
//       const height = Math.min(30, msg.level * 500 * multi[index]); 
//       bar.style.height = `${Math.max(5, height)}px`;
//     });
//   }
// });


// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// let isStarted = false;

// // UI Elements
// const startBtn = document.getElementById("start");
// const langSelect = document.getElementById("language");
// const statusContainer = document.getElementById("status-container");
// const statusMsg = document.getElementById("status-msg");

// document.getElementById("start").onclick = async () => {
//     if (isStarted) {
//         stopDubbing();
//         return;
//     }

//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
//     // Debugging tab data
//     console.log("--- CURRENT ACTIVE TAB DATA ---");
//     console.table([{ id: tab.id, url: tab.url, title: tab.title }]);

//     if (!tab.url.includes("youtube.com") && !tab.url.includes("video")) {
//         updateStatus("Please open a video page first.", "error");
//         return;
//     }

//     updateUIState(true);
//     const language = langSelect.value;

//     try {
//         // STEP 1: Get the Stream ID FIRST (while audio is still playing)
//         updateStatus("Requesting Tab Capture...", "info");
//         await sleep(600);

//         chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, async (streamId) => {
//             if (!streamId) {
//                 updateStatus("Capture denied. Refresh page.", "error");
//                 updateUIState(false);
//                 return;
//             }

//             // STEP 2: Signal Background/Offscreen to start AI
//             updateStatus("Starting AI Pipeline (WebGPU)...", "info");
            
//             chrome.runtime.sendMessage({
//                 type: "START_DUBBING",
//                 language: language,
//                 streamId: streamId,
//                 tabId: tab.id
//             }, async (response) => {
//                 if (chrome.runtime.lastError || !response?.success) {
//                     updateStatus("AI Engine failed to start.", "error");
//                     updateUIState(false);
//                 } else {
//                     // STEP 3: Now that AI is listening, MUTE the video
//                     updateStatus("Injecting audio controller...", "info");
//                     await sleep(800);
                    
//                     try {
//                         setTimeout(async () => {
//     await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
// }, 2000);
//                     } catch (err) {
//                         await chrome.scripting.executeScript({
//                             target: { tabId: tab.id },
//                             files: ["content.js"]
//                         });
//                         // await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
//                         setTimeout(async () => {
//     await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });
// }, 2000);
//                     }
                    
//                     updateStatus("YouDub is Active!", "success");
//                 }
//             });
//         });

//     } catch (error) {
//         console.error("Dubbing Error:", error);
//         updateStatus("Connection failed.", "error");
//         updateUIState(false);
//     }
// };

// // --- Helper Functions ---

// function updateUIState(started) {
//     isStarted = started;
//     if (started) {
//         startBtn.innerText = "Stop Dubbing";
//         startBtn.style.background = "linear-gradient(135deg, #444 0%, #222 100%)";
//         statusContainer.style.display = "block";
//         langSelect.disabled = true;
//     } else {
//         startBtn.innerText = "Start Dubbing";
//         startBtn.style.background = "linear-gradient(135deg, #ff0000 0%, #b91c1c 100%)";
//         langSelect.disabled = false;
//         statusContainer.style.display = "none";
//     }
// }

// function updateStatus(message, type) {
//     statusMsg.innerText = message;
//     const pulse = document.querySelector(".pulse");
//     if (!pulse) return;
    
//     if (type === "error") {
//         pulse.style.backgroundColor = "#ff4444";
//         statusMsg.style.color = "#ff4444";
//     } else if (type === "success") {
//         pulse.style.backgroundColor = "#4ade80";
//         statusMsg.style.color = "#4ade80";
//     } else {
//         pulse.style.backgroundColor = "#6366f1";
//         statusMsg.style.color = "#ccc";
//     }
// }

// async function stopDubbing() {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     chrome.runtime.sendMessage({ type: "STOP_DUBBING", tabId: tab.id });
    
//     try {
//         await chrome.tabs.sendMessage(tab.id, { type: "UNMUTE_VIDEO" });
//     } catch(e) {}

//     updateUIState(false);
// }

// chrome.runtime.onMessage.addListener((msg) => {
//     if (msg.type === "AUDIO_LEVEL") {
//         const bars = document.querySelectorAll(".bar");
//         const container = document.querySelector(".visualizer-container");
//         if (container) container.style.display = "flex"; 

//         bars.forEach((bar, index) => {
//             const multi = [0.8, 1.2, 1.5, 1.1, 0.9];
//             const height = Math.min(30, msg.level * 500 * multi[index]); 
//             bar.style.height = `${Math.max(5, height)}px`;
//         });
//     }
// });


// popup.js - Improved Version

// popup.js
let currentDubbingTabId = null;

const startBtn = document.getElementById("start");
const langSelect = document.getElementById("language");
const statusContainer = document.getElementById("status-container");
const statusMsg = document.getElementById("status-msg");
const autoDub = document.getElementById("auto-dub-self");
const recordVideo = document.getElementById("record-video");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



let isRecording = false;

async function updateRecordButtonState() {
    const response = await chrome.runtime.sendMessage({ type: "GET_RECORDING_STATUS" });
    isRecording = response?.isRecording || false;

    if (isRecording) {
        recordVideo.innerHTML = `<i class="fa-solid fa-circle-dot"></i>`;
        recordVideo.style.color = "#ef4444";
    } else {
        recordVideo.innerHTML = `<i class="fa-solid fa-video"></i>`;
        recordVideo.style.color = "";
    }
}

// Button Click
recordVideo.onclick = async () => {
    if (!isRecording) {
        // Start Recording
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.url?.includes("youtube.com")) {
            alert("Please open a YouTube video first!");
            return;
        }

        recordVideo.innerHTML = `<i class="fa-solid fa-circle-dot"></i>`;
        recordVideo.style.color = "#ef4444";

        await chrome.runtime.sendMessage({ 
            type: "START_VIDEO_RECORDING",
            tabId: tab.id 
        });

        isRecording = true;

    } else {
        // Stop Recording
        await chrome.runtime.sendMessage({ type: "STOP_VIDEO_RECORDING" });
        resetRecordButton();
    }
};

function resetRecordButton() {
    recordVideo.innerHTML = `<i class="fa-solid fa-video"></i>`;
    recordVideo.style.color = "";
    isRecording = false;
}

// Load correct button state when popup opens
document.addEventListener("DOMContentLoaded", () => {
    updateRecordButtonState();
});

// recordVideo.onclick = async () => {
//     const btn = recordVideo;

//     if (!isRecording) {
//         try {
//             const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

//             if (!tab?.url?.includes("youtube.com")) {
//                 alert("Please open a YouTube video first!");
//                 return;
//             }

//             btn.innerHTML = `<i class="fa-solid fa-circle-dot"></i>`;
//             btn.style.color = "#ef4444";

//             isRecording = true;

//             // Pass tabId to background
//             await chrome.runtime.sendMessage({ 
//                 type: "START_VIDEO_RECORDING",
//                 tabId: tab.id 
//             });

//         } catch (err) {
//             console.error(err);
//             alert("Failed to start recording");
//             resetRecordButton();
//         }
//     } else {
//         await chrome.runtime.sendMessage({ type: "STOP_VIDEO_RECORDING" });
//         resetRecordButton();
//     }
// };


// function resetRecordButton() {
//     recordVideo.innerHTML = `<i class="fa-solid fa-video"></i>`;
//     recordVideo.style.color = "";
//     isRecording = false;
// }


async function loadState() {
    try {
        const { dubbingTabId } = await chrome.storage.local.get("dubbingTabId");

        currentDubbingTabId = dubbingTabId || null;

        if (currentDubbingTabId) {
            updateUIState(true);
            updateStatus("YouDub is Active ", "success");
        } else {
            updateUIState(false);
            updateStatus("Ready", "info");
        }
    } catch (err) {
        console.error("Failed to load state:", err);
        updateUIState(false);
    }
}


// SYNC bloacks the main thread, so we use async/await for better UX handling it wont block the popup while we wait for responses from background or content scripts
startBtn.onclick = async () => {

    // returns an array,then it takes the first element of that array and puts it into the variable tab SIMPLY IT MEANS TAB[0]
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Optional Chaining (?.)
    // if (!tab || !tab.url || !tab.url.includes("youtube.com"))
    if (!tab?.url?.includes("youtube.com")) {
        updateStatus("Please open a YouTube video first", "error");
        return;
    }

    if (currentDubbingTabId) {
        await stopDubbing();
    } else {
        await startDubbing(tab);
    }
};

async function startDubbing(tab) {
    const language = langSelect.value;

    updateUIState(true);
    updateStatus("Requesting audio capture...", "info");

    try {
    // Much cleaner - native promise support
    const streamId = await chrome.tabCapture.getMediaStreamId({ 
        targetTabId: tab.id 
    });
    // sending message to background with streamId and language
    const response = await chrome.runtime.sendMessage({
        type: "START_DUBBING",
        streamId: streamId,
        language: language,
        tabId: tab.id
    });


    // Because it's inside a try block, when throw new Error() runs, JavaScript jumps directly to the catch block.
    if (!response?.success) {
        throw new Error(response?.error || "Failed to start dubbing");
    }

    // Inject content script + mute
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    });

    await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });

    await chrome.storage.local.set({ dubbingTabId: tab.id });
    currentDubbingTabId = tab.id;

    updateStatus("YouDub is Active!", "success");

} catch (err) {
    console.error("Dubbing start failed:", err);
    updateStatus("Failed to start: " + (err.message || err), "error");
    updateUIState(false);
}
}

// async function stopDubbing() {

//     // If there's no active dubbing tab, just exit silently. This prevents unnecessary errors.
//     if (!currentDubbingTabId) return;

//     try {
//         await chrome.runtime.sendMessage({ type: "STOP_DUBBING" });

//         try {
//             await chrome.tabs.sendMessage(currentDubbingTabId, { type: "UNMUTE_VIDEO" });
//         } catch (e) {}
//     } catch (e) {
//         console.warn(e);
//     }

//     await chrome.storage.local.remove("dubbingTabId");
//     currentDubbingTabId = null;

//     updateUIState(false);
//     updateStatus("", "info");
// }

async function stopDubbing() {
    if (!currentDubbingTabId) return;

    try {
        // Wait for background to actually stop everything
        const response = await chrome.runtime.sendMessage({ 
            type: "STOP_DUBBING" 
        });

        // Safely try to unmute (tab might be closed)
        try {
            await chrome.tabs.sendMessage(currentDubbingTabId, { 
                type: "UNMUTE_VIDEO" 
            });
        } catch (e) {
            console.debug("Could not unmute: tab may be closed");
        }

        // Clean up
        await chrome.storage.local.remove("dubbingTabId");
        currentDubbingTabId = null;

        updateUIState(false);
        updateStatus("Dubbing stopped successfully", "success");

        // Auto clear message
        setTimeout(() => updateStatus("Ready", "info"), 1500);

    } catch (err) {
        console.error("Stop dubbing failed:", err);
        
        // Force cleanup even on error
        await chrome.storage.local.remove("dubbingTabId");
        currentDubbingTabId = null;
        updateUIState(false);
        
        updateStatus("Dubbing stopped with issues", "error");
    }
}

function updateUIState(isActive) {
    if (isActive) {
        startBtn.textContent = "Stop Dubbing";
        startBtn.style.background = "linear-gradient(135deg, #444, #222)";
        langSelect.disabled = true;
        statusContainer.style.display = "block";
    } else {
        startBtn.textContent = "Start Dubbing";
        startBtn.style.background = "linear-gradient(135deg, #ff0000, #b91c1c)";
        langSelect.disabled = false;
        statusContainer.style.display = "none";
    }
}

function updateStatus(message, type = "info") {
    statusMsg.textContent = message;
    // Add your pulse color logic here if needed
}

document.addEventListener("DOMContentLoaded", () => {
    loadState();        // Restore previous state when popup opens
});

// Listen for background notifications
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "DUBBING_STOPPED") {
        currentDubbingTabId = null;
        updateUIState(false);
    }
});

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
const PIXELS_PER_POINT = 10;

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
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";

    for (let i = 0; i < audioHistory.length; i += 10) {        // Every 10 points (~5 seconds)
        const x = i * PIXELS_PER_POINT;
        const seconds = Math.floor(i * PIXELS_PER_POINT / 100); // rough time in seconds
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