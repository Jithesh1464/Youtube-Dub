// let isCapturing = false;
// let creatingOffscreen;

// async function setupOffscreen() {
//   const exists = await chrome.offscreen.hasDocument();
//   if (exists) return;

//   if (creatingOffscreen) {
//     await creatingOffscreen;
//   } else {
//     creatingOffscreen = chrome.offscreen.createDocument({
//       url: "offscreen.html",
//       reasons: ["AUDIO_PLAYBACK", "USER_MEDIA"],
//       justification: "Processing audio for dubbing"
//     });

//     await creatingOffscreen;
//     creatingOffscreen = null;
//   }
// }

// chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
//   if (msg.type === "START_DUBBING") {
//     if (isCapturing) {
//       console.log("Already capturing, skipping...");
//       return;
//     }

//     isCapturing = true;

//     await setupOffscreen();

//     const streamId = await chrome.tabCapture.getMediaStreamId({
//       targetTabId: msg.tabId
//     });

//     chrome.runtime.sendMessage({
//       type: "START_STREAM",
//       streamId: streamId,
//       language: msg.language
//     });

//     sendResponse({ status: "started" });
//   }
// });
let isCapturing = false;
let creatingOffscreen;

// Helper to ensure Offscreen Document exists
async function setupOffscreen() {
  const exists = await chrome.offscreen.hasDocument();
  if (exists) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK", "USER_MEDIA"],
      justification: "Processing audio for dubbing"
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_DUBBING") {
    const streamId = chrome.tabCapture.getMediaStreamId({
  targetTabId: msg.tabId
});
console.log("Generated Stream ID:", streamId);
    // Handle the async logic inside a separate function
    handleStartDubbing(msg, sendResponse);
    return true; // Keeps the message channel open for sendResponse
  }

  if (msg.type === "STOP_DUBBING") {
    isCapturing = false;
    chrome.offscreen.closeDocument();
    sendResponse({ status: "stopped" });
  }
});


async function handleStartDubbing(msg, sendResponse) {
  try {
    if (isCapturing) {
      sendResponse({ success: false, error: "Already capturing" });
      return;
    }

    // 1. Ensure Offscreen is ready
    await setupOffscreen();

    // 2. Critical: Use the streamId passed from the popup 
    // (Generating it in the popup is safer for permissions)
    const streamId = msg.streamId; 

    if (!streamId) {
      throw new Error("No StreamID received from popup");
    }

    // 3. Send the token to the Offscreen document
    // We add a small delay to ensure the offscreen's listener is active
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "START_STREAM",
        streamId: streamId,
        language: msg.language
      });
      
      isCapturing = true;
      sendResponse({ success: true, status: "Handed off to Offscreen" });
    }, 200);

  } catch (error) {
    console.error("Background Error:", error);
    isCapturing = false;
    sendResponse({ success: false, error: error.message });
  }
}