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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // ====================== SELF VOICE DUB ======================
    if (msg.type === "START_SELF_DUB") {
        (async () => {
            await ensureOffscreen();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { 
                    type: "START_SELF_DUB_INTERNAL" 
                });
            }
        })();

        sendResponse({ success: true });
        return true;
    }

    if (msg.type === "STOP_SELF_DUB") {
        (async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { 
                    type: "STOP_SELF_DUB_INTERNAL" 
                });
            }
        })();

        sendResponse({ success: true });
        return true;
    }
});

// Inside background.js message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    
    // Proxy: Offscreen -> Background -> Content Script
    if (msg.type === "PROXY_GET_TIME") {
        if (currentDubbingTabId) {
            chrome.tabs.sendMessage(currentDubbingTabId, { type: "GET_CURRENT_VIDEO_TIME" }, (res) => {
                sendResponse(res);
            });
            return true; // Keep channel open for async response
        }
    }

    if (msg.type === "PROXY_PAUSE") {
        if (currentDubbingTabId) {
            chrome.tabs.sendMessage(currentDubbingTabId, { type: "PAUSE_VIDEO_FOR_DUB" });
        }
    }

    if (msg.type === "PROXY_RESUME") {
        if (currentDubbingTabId) {
            chrome.tabs.sendMessage(currentDubbingTabId, { type: "RESUME_VIDEO_AFTER_DUB" });
        }
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
        const contentResponse = await chrome.tabs.sendMessage(tabId, { type: "CAPTURE_SYNC_TIME" });
        const videoStartTime = contentResponse?.time || 0;
        // Forward to offscreen
        chrome.runtime.sendMessage({
            type: "START_STREAM",
            streamId: streamId,
            language: language,
            tabId: tabId,
            startTime: videoStartTime
        });

        sendResponse({ success: true });

    } catch (error) {
        console.error("Start dubbing failed:", error);
        isCapturing = false;
        currentDubbingTabId = null;
        sendResponse({ success: false, error: error.message });
    }
}

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

// for handling new function record video with original audio in popup.js, we need to get streamId here and forward to offscreen for recording

// background.js - Improved for Recording Stability
// let creatingOffscreen = null;
let isVideoRecording = false;

let offscreenReady = false;

async function ensureOffscreen() {
    try {
        if (await chrome.offscreen.hasDocument()) {
            offscreenReady = true;
            return;
        }

        await chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
            justification: "Real-time dubbing and video recording"
        });

        offscreenReady = true;
        console.log("✅ Offscreen Document Created");
    } catch (e) {
        console.error("Offscreen creation failed:", e);
    }
}

// Keep offscreen alive when recording
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // ==================== VIDEO RECORDING ====================
    if (msg.type === "START_VIDEO_RECORDING") {
        (async () => {
            await ensureOffscreen();   // Important

            isVideoRecording = true;
            await chrome.storage.local.set({ isVideoRecording: true });

            chrome.tabCapture.getMediaStreamId({
                targetTabId: msg.tabId
            }, (streamId) => {
                if (chrome.runtime.lastError || !streamId) {
                    console.error("Failed to get streamId:", chrome.runtime.lastError);
                    return;
                }

                chrome.runtime.sendMessage({
                    type: "START_VIDEO_RECORDING_INTERNAL",
                    streamId: streamId
                });
            });
        })();

        sendResponse({ success: true });
        return true;
    }

    if (msg.type === "STOP_VIDEO_RECORDING") {
        isVideoRecording = false;
        chrome.storage.local.set({ isVideoRecording: false });

        chrome.runtime.sendMessage({ type: "STOP_VIDEO_RECORDING" });
        sendResponse({ success: true });
        return true;
    }

    if (msg.type === "GET_RECORDING_STATUS") {
        sendResponse({ isRecording: isVideoRecording });
        return true;
    }

});



// Auto cleanup if user closes the YouTube tab
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentDubbingTabId) {
        handleStopDubbing(() => {});
    }
});
