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

let currentDubbingTabId = null;

const startBtn = document.getElementById("start");
const langSelect = document.getElementById("language");
const statusContainer = document.getElementById("status-container");
const statusMsg = document.getElementById("status-msg");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Load state when popup opens
async function loadState() {
    const data = await chrome.storage.local.get(["dubbingTabId", "dubbingLanguage"]);
    currentDubbingTabId = data.dubbingTabId || null;

    if (currentDubbingTabId) {
        updateUIState(true);
        updateStatus("YouDub is Active on another tab", "success");
    } else {
        updateUIState(false);
    }
}

// Main button handler
startBtn.onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes("youtube.com")) {
        updateStatus("Please open a YouTube video first.", "error");
        return;
    }

    if (currentDubbingTabId) {
        // Stop dubbing
        await stopDubbing();
    } else {
        // Start dubbing
        await startDubbing(tab);
    }
};

async function startDubbing(tab) {
    const language = langSelect.value;

    updateUIState(true);
    updateStatus("Requesting tab capture...", "info");

    try {
        // Modern Promise version (cleaner)
        const streamId = await new Promise((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
                if (chrome.runtime.lastError || !id) {
                    reject(chrome.runtime.lastError || new Error("Failed to get streamId"));
                } else {
                    resolve(id);
                }
            });
        });

        // Send to background/offscreen
        const response = await chrome.runtime.sendMessage({
            type: "START_DUBBING",
            language: language,
            streamId: streamId,
            tabId: tab.id
        });

        if (!response?.success) throw new Error("Failed to start AI pipeline");

        // Mute the video (cleaner version)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
        });

        await chrome.tabs.sendMessage(tab.id, { type: "MUTE_VIDEO" });

        // Save persistent state
        await chrome.storage.local.set({
            dubbingTabId: tab.id,
            dubbingLanguage: language
        });

        currentDubbingTabId = tab.id;
        updateStatus("YouDub is Active! 🎙️", "success");

    } catch (err) {
        console.error(err);
        updateStatus("Failed to start dubbing: " + err.message, "error");
        updateUIState(false);
    }
}

async function stopDubbing() {
    if (!currentDubbingTabId) return;

    try {
        await chrome.runtime.sendMessage({
            type: "STOP_DUBBING",
            tabId: currentDubbingTabId
        });

        // Try to unmute (ignore if content script not present)
        try {
            await chrome.tabs.sendMessage(currentDubbingTabId, { type: "UNMUTE_VIDEO" });
        } catch (e) {}

    } catch (e) {
        console.warn("Stop message failed", e);
    }

    // Clear saved state
    await chrome.storage.local.remove(["dubbingTabId", "dubbingLanguage"]);
    currentDubbingTabId = null;

    updateUIState(false);
    updateStatus("", "info");
}

// UI Helpers
function updateUIState(isActive) {
    if (isActive) {
        startBtn.textContent = "Stop Dubbing";
        startBtn.style.background = "linear-gradient(135deg, #444 0%, #222 100%)";
        langSelect.disabled = true;
        statusContainer.style.display = "block";
    } else {
        startBtn.textContent = "Start Dubbing";
        startBtn.style.background = "linear-gradient(135deg, #ff0000 0%, #b91c1c 100%)";
        langSelect.disabled = false;
        statusContainer.style.display = "none";
    }
}

function updateStatus(message, type = "info") {
    statusMsg.textContent = message;
    statusMsg.innerText = message;
    const pulse = document.querySelector(".pulse");
    
    // Change pulse color based on status
    if (type === "error") {
        pulse.style.backgroundColor = "#ff4444";
        statusMsg.style.color = "#ff4444";
    } else if (type === "success") {
        pulse.style.backgroundColor = "#4ade80"; // Green
        statusMsg.style.color = "#4ade80";
    } else {
        pulse.style.backgroundColor = "#6366f1"; // Blue
        statusMsg.style.color = "#ccc";
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", loadState);

// Optional: Listen for updates from background
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "DUBBING_STOPPED") {
        currentDubbingTabId = null;
        updateUIState(false);
    }
});