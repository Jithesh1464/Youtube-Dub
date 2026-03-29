// // content.js - YouDub Content Script (Fixed)

// (() => {
//     // Prevent multiple executions if injected again
//     if (window.__YOUDUB_CONTENT_SCRIPT_LOADED) {
//         console.log("YouDub Content Script already running");
//         return;
//     }
//     window.__YOUDUB_CONTENT_SCRIPT_LOADED = true;

//     let currentVideo = null;

//     function getVideoElement() {
//         const videos = document.querySelectorAll('video');
//         if (videos.length === 0) return null;

//         // Return the largest (main) video player
//         return Array.from(videos).reduce((best, current) => {
//             const bestArea = best.clientWidth * best.clientHeight;
//             const currentArea = current.clientWidth * current.clientHeight;
//             return currentArea > bestArea ? current : best;
//         });
//     }


//     chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//         const video = getYouTubeVideoElement() || currentVideo;

//         switch (msg.type) {
//             case "MUTE_VIDEO":
//                 if (video) {
//                     video.muted = true;
//                     video.volume = 0;
//                     currentVideo = video;
//                     console.log("✅ YouDub: Video muted");
//                     sendResponse({ success: true, status: "muted" });
//                 } else {
//                     console.warn("⚠️ YouDub: No video element found");
//                     sendResponse({ success: false, status: "no_video_found" });
//                 }
//                 break;

//             case "UNMUTE_VIDEO":
//                 if (video) {
//                     video.muted = false;
//                     video.volume = 1.0;
//                     console.log("✅ YouDub: Video unmuted");
//                     sendResponse({ success: true, status: "unmuted" });
//                 } else {
//                     sendResponse({ success: false, status: "no_video" });
//                 }
//                 break;

//             default:
//                 sendResponse({ success: false, error: "unknown_type" });
//         }

//         return true; // Keep message channel open
//     });

//     // MutationObserver for dynamic YouTube video loading
//     const observer = new MutationObserver(() => {
//         if (!currentVideo) {
//             const video = getVideoElement();
//             if (video) {
//                 currentVideo = video;
//                 console.log("🎥 YouDub: Video element detected");
//             }
//         }
//     });

//     observer.observe(document.body, { childList: true, subtree: true });

//     console.log("🎥 YouDub Content Script Loaded Successfully");

//     // Cleanup
//     window.addEventListener('beforeunload', () => observer.disconnect());
// })();


// content.js - YouDub Content Script (Optimized for YouTube) - WORKING VERSION
(() => {
    if (window.__YOUDUB_CONTENT_SCRIPT_LOADED) {
        console.log("YouDub Content Script already running");
        return;
    }
    window.__YOUDUB_CONTENT_SCRIPT_LOADED = true;

    let currentVideo = null;
    let originalVolume = 1.0;

    // Reliable + async video detector
    async function getYouTubeVideoElement(timeout = 15000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const video = document.querySelector('video.html5-main-video') ||
                          document.querySelector('#movie_player video');

            if (video && video.readyState >= 1) {   // metadata loaded
                return video;
            }

            await new Promise(r => setTimeout(r, 300));
        }

        console.warn("YouDub: Video element not found after timeout");
        return null;
    }

    // Message listener
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        switch (msg.type) {
            case "MUTE_VIDEO":
                // handleMute(sendResponse);
                console.log("🔇 Mute request received - SKIPPED for debugging");
                sendResponse({ success: true, status: "mute_skipped_for_debug" });
                break;

            case "UNMUTE_VIDEO":
                // handleUnmute(sendResponse);
                console.log("🔊 Unmute request received - SKIPPED for debugging");
                sendResponse({ success: true, status: "unmute_skipped_for_debug" });
                break;

            default:
                sendResponse({ success: false, error: "unknown_type" });
        }
        return true; // Keep channel open for async response
    });

    async function handleMute(sendResponse) {
        let video = currentVideo;

        if (!video) {
            video = await getYouTubeVideoElement(8000);
        }

        if (video) {
            originalVolume = video.volume;     // Save original volume
            video.muted = true;
            video.volume = 0;
            currentVideo = video;

            console.log("✅ YouDub: Video muted");
            sendResponse({ success: true, status: "muted" });
        } else {
            console.warn("⚠️ YouDub: No video element found for muting");
            sendResponse({ success: false, status: "no_video_found" });
        }
    }

    async function handleUnmute(sendResponse) {
        let video = currentVideo;

        if (!video) {
            video = await getYouTubeVideoElement(5000);
        }

        if (video) {
            video.muted = false;
            video.volume = originalVolume;     // Restore original volume
            console.log("✅ YouDub: Video unmuted");
            sendResponse({ success: true, status: "unmuted" });
        } else {
            sendResponse({ success: false, status: "no_video" });
        }
    }

    // Lighter MutationObserver (only when needed)
    const observer = new MutationObserver(async () => {
        if (!currentVideo) {
            const video = document.querySelector('video.html5-main-video') ||
                          document.querySelector('#movie_player video');
            if (video && video.readyState >= 1) {
                currentVideo = video;
                console.log("🎥 YouDub: Video element auto-detected");
            }
        }
    });

    // Start observing only after a small delay
    setTimeout(() => {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }, 1000);

    console.log("🎥 YouDub Content Script Loaded Successfully");

    // Cleanup
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });
})();