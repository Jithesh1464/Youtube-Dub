let creatingOffscreen = null;
let currentStreamId = null;   // Store for reuse

async function ensureOffscreen() {
    try {
        if (await chrome.offscreen.hasDocument()) return true;

        if (creatingOffscreen) {
            await creatingOffscreen;
            return true;
        }

        creatingOffscreen = chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
            justification: "For real-time dubbing and video recording"
        });

        await creatingOffscreen;
        creatingOffscreen = null;
        return true;
    } catch (e) {
        console.error("Offscreen failed:", e);
        return false;
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.type === "START_DUBBING" || msg.type === "START_VIDEO_RECORDING") {
        (async () => {
            await ensureOffscreen();

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Get streamId only once
            if (!currentStreamId) {
                currentStreamId = await new Promise(resolve => {
                    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, resolve);
                });
            }

            chrome.runtime.sendMessage({
                type: msg.type === "START_DUBBING" ? "START_DUBBING_INTERNAL" : "START_VIDEO_RECORDING_INTERNAL",
                streamId: currentStreamId,
                tabId: tab.id,
                language: msg.language
            });
        })();

        sendResponse({ success: true });
        return true;
    }

    if (msg.type === "STOP_DUBBING" || msg.type === "STOP_VIDEO_RECORDING") {
        chrome.runtime.sendMessage({ type: msg.type });
        sendResponse({ success: true });
        return true;
    }
});