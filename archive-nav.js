document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const file = location.pathname.split("/").pop();
  const titles = {
    "daily.html": "每日记录",
    "tmi.html": "TMI",
    "music.html": "音乐",
    "thoughts.html": "想法",
    "stage.html": "舞台",
    "short-videos.html": "短视频",
    "self.html": "人物",
    "work.html": "作品",
  };

  function disclosure(title, nodes, host, before = null) {
    const items = [...new Set(nodes)].filter(Boolean);
    if (!items.length || !host) return null;
    const details = document.createElement("details");
    details.className = "interface-disclosure full";
    const summary = document.createElement("summary");
    summary.textContent = title;
    const content = document.createElement("div");
    content.className = "disclosure-content";
    details.append(summary, content);
    host.insertBefore(details, before);
    items.forEach((node) => content.append(node));
    return details;
  }
  function fields(form, ids, title) {
    const nodes = ids
      .map((id) => $(id)?.closest("label"))
      .filter((node) => node && form.contains(node));
    if (nodes.length) disclosure(title, nodes, nodes[0].parentElement);
  }

  // Move existing controls so their IDs, values and event handlers survive.
  if (window.TAESAN_WORKSPACE) {
    if ($("editor") && file === "tmi.html") {
      fields(
        $("editor"),
        ["korean", "translation", "editStage", "tags", "source", "url", "note"],
        "补充资料",
      );
      disclosure(
        "维护",
        [
          $("new"),
          $("export"),
          ...document.querySelectorAll("#admin > details"),
        ],
        $("admin"),
      );
    }
    if ($("saveCloud")) {
      fields(
        $("editor"),
        ["korean", "tags", "source", "coverUrl", "imageUrls"],
        "补充资料",
      );
      $("saveCloud").classList.add("primary");
      $("saveLocal").classList.remove("primary");
      disclosure(
        "更多",
        [$("newRecord"), $("saveLocal"), $("export")],
        $("saveCloud").parentElement,
      );
    }
    if ($("workForm")) {
      fields(
        $("workForm"),
        [
          "titleKo",
          "titleZh",
          "role",
          "release",
          "order",
          "lyricists",
          "composers",
          "arrangers",
          "description",
          "sourceUrl",
        ],
        "作品资料",
      );
      disclosure(
        "维护",
        [$("newWork"), $("backup"), $("cleanup")],
        $("workForm"),
      );
    }
    if ($("entryForm")) {
      fields(
        $("entryForm"),
        [
          "entryTime",
          "entryKind",
          "entryWeibo",
          "entryVideoCover",
          "entryPhotoCount",
          "entryVideoCount",
          "entryPhoto",
        ],
        "补充资料",
      );
      const panels = [...document.querySelectorAll("#manage > .panel")].filter(
        (panel) =>
          !panel.contains($("entryForm")) && !panel.contains($("loginBox")),
      );
      disclosure("其他管理", panels, $("manage"));
      $("entryForm").append($("cloudStatus"));
    }
    const returnTargets = {
      "tmi.html": "cards",
      "music.html": "works",
      "daily.html": "manageList",
    };
    const cancel =
      $("cancel") || $("reset") || $("cancelWork") || $("cancelEditBtn");
    cancel?.addEventListener("click", () =>
      requestAnimationFrame(() => {
        const target = $(returnTargets[file]) || $("records");
        for (
          let parent = target?.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (parent.tagName === "DETAILS") parent.open = true;
        }
        target?.scrollIntoView({ block: "start" });
      }),
    );
    document
      .querySelectorAll(
        "#admin > .sectionhead h2,#editorPanel > .archive-toolbar h2,#adminPanel > .playerHead h2",
      )
      .forEach((node) => (node.hidden = true));
    // Required fields in closed groups must remain reachable by native form validation.
    document.addEventListener(
      "invalid",
      (event) => {
        let parent = event.target.parentElement;
        while (parent) {
          if (parent.tagName === "DETAILS") parent.open = true;
          parent = parent.parentElement;
        }
      },
      true,
    );
    return;
  }

  const root = document.querySelector("main");
  if (!root) return;
  const parents = {
    "tmi.html": "self.html",
    "thoughts.html": "self.html",
    "stage.html": "work.html",
    "music.html": "work.html",
    "short-videos.html": "work.html",
    "self.html": "daily.html",
    "work.html": "daily.html",
  };
  const header = document.createElement("header");
  header.className = "archive-nav";
  header.innerHTML =
    '<div class="nav-start">' +
    (parents[file]
      ? '<a class="icon-link back-link" href="' +
        parents[file] +
        '" aria-label="返回" title="返回"><span class="back-icon" aria-hidden="true"></span></a>'
      : "") +
    '<a class="archive-brand" href="daily.html"><img src="assets/home-blue-portrait.webp" width="32" height="32" alt="">韩泰山档案</a></div><details class="archive-menu"><summary aria-label="档案菜单" title="档案菜单"><span class="menu-icon" aria-hidden="true"></span></summary><nav aria-label="档案"><a href="daily.html">每日记录</a><a href="work.html">作品</a><a href="self.html">人物</a><a href="admin.html">管理</a></nav></details>';
  root.prepend(header);
  header.querySelectorAll("nav a").forEach((link) => {
    if (link.getAttribute("href") === file)
      link.setAttribute("aria-current", "page");
  });
  const heading = document.querySelector("h1");
  if (heading && titles[file]) heading.textContent = titles[file];
  document
    .querySelectorAll(
      ".hero > :not(h1),.archive-heading > :not(h1),.archive-footer,.footer",
    )
    .forEach((node) => (node.hidden = true));

  if ($("tabs")) {
    const tabNames = {
      daily: "每日记录",
      monthly: "月度归档",
      dm: "DM 统计",
      photos: "照片",
      yearly: "年度统计",
    };
    const tabs = $("tabs");
    tabs
      .querySelectorAll('a,[data-tab="manage"]')
      .forEach((node) => (node.hidden = true));
    tabs.querySelectorAll("[data-tab]").forEach((button) => {
      if (tabNames[button.dataset.tab])
        button.textContent = tabNames[button.dataset.tab];
    });
    const secondary = [...tabs.querySelectorAll("button")].filter(
      (button) => button.dataset.tab !== "manage",
    );
    const details = disclosure("其他记录", secondary, tabs);
    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]")?.dataset.tab;
      if (!tab || tab === "manage") return;
      const url = new URL(location.href);
      url.searchParams.set("tab", tab);
      history.replaceState(null, "", url);
      heading.textContent = tabNames[tab] || titles[file];
      if (details) {
        details.open = false;
        details.querySelector("summary").focus({ preventScroll: true });
      }
    });
    const tab = new URLSearchParams(location.search).get("tab");
    if (tabNames[tab]) heading.textContent = tabNames[tab];
    const headings = $("daily").querySelectorAll("h2");
    headings[0].textContent = "日历";
    headings[1].textContent = "记录";
    const panel = $("calendar").closest("section");
    const calendar = disclosure("日历", [panel], panel.parentElement, panel);
    calendar.classList.add("calendar-disclosure");
    calendar.open = matchMedia("(min-width: 760px)").matches;
    document
      .querySelectorAll(
        "#photos > .panel > p.tiny,#yearly > .panel > p.tiny,.dmhero .dmnote",
      )
      .forEach((node) => (node.hidden = true));
  }
  if ($("stage") && file === "tmi.html") {
    disclosure(
      "筛选",
      [$("stage").closest("label"), $("sort").closest("label")],
      $("stage").closest(".filterrow"),
    );
  }
  document.addEventListener("click", (event) => {
    const menu = header.querySelector("details");
    if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    const menu = header.querySelector("details");
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
});
