const browser = window.browser || window.chrome;

function findURLs() {
  return new Promise((resolve) => {
    browser.runtime.sendMessage({ message: "findURLs" }, (response) => {
      const urls = response.urls
        .map((url) => new URL(url))
        .map((url) => {
          const pathname = url.pathname;
          const filename = url.pathname.split("/").pop();
          return { href: url.href, filename };
        });

      resolve(urls);
    });
  });
}

Vue.component("findurlsbutton", {
  template: "#findurlsbutton-template",
  methods: {
    findURLs: function (path) {
      app.screen = "findurlsscreen";
    },
  },
});

Vue.component("mainscreen", {
  template: "#mainscreen-template",
});

Vue.component("findurlsscreen", {
  template: "#findurlsscreen-template",
  data: function () {
    return {
      urls: [],
    };
  },
  created: async function () {
    const urls = await findURLs();
    this.urls = urls;
  },
});

const app = new Vue({
  el: "#app",
  data: { screen: "mainscreen" },
});
