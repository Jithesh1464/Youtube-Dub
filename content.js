// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.type === "MUTE_VIDEO") {
//     const video = document.querySelector("video");
//     if (video) {
//       video.muted = true;
//     }
//   }
// });
// console.log("Content script loaded");/
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const video = document.querySelector("video");

  if (msg.type === "MUTE_VIDEO") {
    if (video) {
      video.muted = true;
      // Send response back so popup/background knows it worked
      sendResponse({ status: "muted", success: true });
    } else {
      sendResponse({ status: "no_video_found", success: false });
    }
  }

  if (msg.type === "UNMUTE_VIDEO") {
    if (video) {
      video.muted = false;
      sendResponse({ status: "unmuted" });
    }
  }
  
  // Important: return true to keep the message channel open for async response
  return true; 
});

console.log("YouDub Content Script Active");