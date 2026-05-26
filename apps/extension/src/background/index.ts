chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      apiBase: "http://localhost:3000",
      installedAt: Date.now(),
    });
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/popup/index.html"),
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "ping") {
    sendResponse({ ok: true, ts: Date.now() });
    return true;
  }
  return false;
});
