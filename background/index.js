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

function modifyResHeader(details) {
  if (details.initiator !== "https://app.kosmi.io") return;
  if (new URL(details.url).host.endsWith("kosmi.io")) return;
  if (details.type !== "xmlhttprequest" && details.type !== "media") return;
  const accessControlAllowOriginHeader =
    details.responseHeaders["Access-Control-Allow-Origin"];
  if (accessControlAllowOriginHeader === "*") return;
  if (
    accessControlAllowOriginHeader &&
    accessControlAllowOriginHeader.indexOf("app.kosmi.io" !== -1)
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

chrome.webRequest.onHeadersReceived.removeListener(modifyResHeader);
chrome.webRequest.onHeadersReceived.addListener(
  modifyResHeader,
  { urls: ["<all_urls>"] },
  ["responseHeaders", "blocking", "extraHeaders"]
);
