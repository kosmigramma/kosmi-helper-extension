const KOSMI_DOMAIN = "kosmi.io";
const capturedUrls = {};

function getCurrentWindowActiveTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(
      {
        currentWindow: true,
        active: true,
      },
      (currentWindowActiveTabs) => {
        if (!currentWindowActiveTabs) resolve(null);
        if (!currentWindowActiveTabs.length) resolve(null);
        try {
          resolve(currentWindowActiveTabs[0].id);
        } catch (e) {
          resolve(null);
        }
      }
    );
  });
}

function addHeader(headers, name, value) {
  const head = headers.find((item) => {
    return item.name.toLowerCase() === name.toLowerCase();
  });
  if (!head) {
    if (typeof value === "function") {
      value = value();
      if (value === undefined) {
        return;
      }
    }
    headers.push({
      name,
      value: value + "",
    });
  } else {
    head.value = (typeof value === "function" ? value(head.value) : value) + "";
  }
}

async function getCapturedUrlsForCurrentTab() {
  const tabid = await getCurrentWindowActiveTabId();
  return capturedUrls[tabid] || [];
}

function onResponseStarted(details) {
  const url = new URL(details.url);
  if (
    details.type === "media" ||
    url.pathname.endsWith("m3u8") ||
    url.pathname.endsWith(".mpd")
  ) {
    const tabid = details.tabId;
    let urls = capturedUrls[tabid];
    if (!urls) urls = capturedUrls[tabid] = [];
    if (urls.indexOf(url.href) === -1) {
      urls.push(url.href);
    }
  }
}

function onHeadersReceived(details) {
  const APP_URL = `https://app.${KOSMI_DOMAIN}`;
  if (details.initiator) {
    if (details.initiator !== APP_URL) {
      return;
    }
  }
  if (details.originUrl) {
    if (!details.originUrl.startsWith(APP_URL)) {
      return;
    }
  }
  if (new URL(details.url).host.endsWith(KOSMI_DOMAIN)) return;
  if (details.type !== "xmlhttprequest" && details.type !== "media") return;

  const accessControlAllowOriginHeader =
    details.responseHeaders["Access-Control-Allow-Origin"];

  if (accessControlAllowOriginHeader === "*") return;

  if (
    accessControlAllowOriginHeader &&
    accessControlAllowOriginHeader.indexOf(KOSMI_DOMAIN !== -1)
  )
    return;

  Object.entries({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Methods": ["GET", "HEAD", "OPTIONS"],
    "Access-Control-Allow-Headers": (originvalue) => {
      let list = [];
      if (originvalue) {
        list = originvalue.split(",").map((v) => v.trim());
      }
      list = list.concat(["Range"]);
      return [...new Set(list)];
    },
  }).forEach(([name, value]) => {
    addHeader(details.responseHeaders, name, value);
  });
  return {
    responseHeaders: details.responseHeaders
      .slice()
      .filter((h) => h.name.toLowerCase() !== "x-frame-options"),
  };
}

function onMessage(request, sender, sendResponse) {
  if (request.message == "findURLs") {
    (async () => {
      const urls = await getCapturedUrlsForCurrentTab();
      sendResponse({ urls });
    })();
  } else {
    sendResponse({});
  }
  return true;
}

function onTabClose(tabid) {
  delete capturedUrls[tabid];
}

function onUpdated(tabid, changeInfo, tab) {
  if (changeInfo.url) {
    delete capturedUrls[tabid];
  }
}

function onCommitted(details) {
  if (details.transitionType === "reload") {
    delete capturedUrls[details.tabId];
  }
}

chrome.tabs.onUpdated.removeListener(onUpdated);
chrome.tabs.onUpdated.addListener(onUpdated);

chrome.tabs.onRemoved.removeListener(onTabClose);
chrome.tabs.onRemoved.addListener(onTabClose);

chrome.runtime.onMessage.removeListener(onMessage);
chrome.runtime.onMessage.addListener(onMessage);

chrome.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
try {
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    { urls: ["<all_urls>"] },
    ["responseHeaders", "blocking", "extraHeaders"]
  );
} catch (e) {
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    { urls: ["<all_urls>"] },
    ["responseHeaders", "blocking"]
  );
}

chrome.webRequest.onResponseStarted.removeListener(onResponseStarted);
chrome.webRequest.onResponseStarted.addListener(onResponseStarted, {
  urls: ["<all_urls>"],
});

chrome.webNavigation.onCommitted.addListener(onCommitted);
