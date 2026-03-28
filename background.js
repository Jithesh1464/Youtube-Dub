// background.js
let isCapturing = false;
let currentDubbingTabId = null;
let creatingOffscreen = null;

async function setupOffscreen() {
    try {
        const exists = await chrome.offscreen.hasDocument();
        if (exists) return;

        if (creatingOffscreen) {
            await creatingOffscreen;
            return;
        }

        creatingOffscreen = chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
            justification: "Real-time audio capture and AI dubbing for YouTube videos"
        });

        await creatingOffscreen;
        creatingOffscreen = null;
    } catch (err) {
        console.error("Offscreen creation failed:", err);
        throw err;
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_DUBBING") {
        handleStartDubbing(msg, sendResponse);
        return true;
    }

    if (msg.type === "STOP_DUBBING") {
        handleStopDubbing(sendResponse);
        return true;
    }
});

async function handleStartDubbing(msg, sendResponse) {
    try {
        if (isCapturing) {
            sendResponse({ success: false, error: "Already capturing" });
            return;
        }

        const { streamId, language, tabId } = msg;
        if (!streamId || !tabId) {
            throw new Error("Missing streamId or tabId");
        }

        await setupOffscreen();

        currentDubbingTabId = tabId;
        isCapturing = true;

        // Forward to offscreen
        chrome.runtime.sendMessage({
            type: "START_STREAM",
            streamId: streamId,
            language: language,
            tabId: tabId
        });

        sendResponse({ success: true });

    } catch (error) {
        console.error("Start dubbing failed:", error);
        isCapturing = false;
        currentDubbingTabId = null;
        sendResponse({ success: false, error: error.message });
    }
}

// async function handleStopDubbing(sendResponse) {
//     try {
//         isCapturing = false;
//         const tabId = currentDubbingTabId;
//         currentDubbingTabId = null;

//         chrome.runtime.sendMessage({ type: "STOP_DUBBING" });

//         try {
//             await chrome.offscreen.closeDocument();
//         } catch (e) {}

//         // Notify popup if needed
//         chrome.runtime.sendMessage({ type: "DUBBING_STOPPED" });

//         sendResponse({ success: true });
//     } catch (error) {
//         console.error("Stop dubbing error:", error);
//         sendResponse({ success: false });
//     }
// }

async function handleStopDubbing(sendResponse) {
    try {
        isCapturing = false;

        const tabId = currentDubbingTabId;
        currentDubbingTabId = null;

        // Close offscreen document properly (this is the heavy part)
        try {
            await chrome.offscreen.closeDocument();
        } catch (e) {
            console.debug("Offscreen document already closed or not found");
        }

        // Notify content script if needed (optional)
        if (tabId) {
            try {
                await chrome.tabs.sendMessage(tabId, { type: "UNMUTE_VIDEO" });
            } catch (e) {
                // Content script may not exist - it's okay
            }
        }

        // Notify popup that everything is stopped
        chrome.runtime.sendMessage({ 
            type: "DUBBING_STOPPED" 
        });

        // Send success response back to popup
        sendResponse({ success: true });

    } catch (error) {
        console.error("Stop dubbing error:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error while stopping" 
        });
    }
} 

// Auto cleanup if user closes the YouTube tab
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentDubbingTabId) {
        handleStopDubbing(() => {});
    }
});