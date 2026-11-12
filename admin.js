"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    ADMIN = "0c40000a-9f2c-46dc-8ba7-a0b016e6988e";
  const modules = {
    daily: { name: "营业 / DM / 媒体", path: "daily.html?tab=manage" },
    tmi: { name: "TMI", path: "tmi.html" },
    thoughts: { name: "THOUGHTS", path: "thoughts.html" },
    stage: { name: "STAGE", path: "stage.html" },
    shorts: { name: "SHORT VIDEOS", path: "short-videos.html" },
    music: { name: "MUSIC", path: "music.html" },
    journey: { name: "Journey 地点", path: "journey-admin.html" },
  };
  let client,
    admin = false,
    current = "daily";
  const frames = new Map();
  function select(key, push = true) {
    current = Object.hasOwn(modules, key) ? key : "daily";
    if ((admin || window.TAESAN_PREVIEW) && !frames.has(current)) {
      const frame = document.createElement("iframe");
      frame.className = "workspace-frame";
      frame.title = modules[current].name + " 管理工作区";
      frame.name = "workspace-" + current;
      const url = new URL(modules[current].path, location.href);
      url.searchParams.set("workspace", "1");
      frame.src = url.href;
      frames.set(current, frame);
      $("workspaceViews").append(frame);
    }
    for (const [key, frame] of frames) frame.hidden = key !== current;
    $("modulePicker").value = current;
    const publicPages = {
      daily: "daily.html",
      tmi: "tmi.html",
      thoughts: "thoughts.html",
      stage: "stage.html",
      shorts: "short-videos.html",
      music: "music.html",
      journey: "journey.html",
    };
    $("returnToArchive").href = publicPages[current];
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set("module", current);
      history.pushState(null, "", url);
    }
    $("workspaceStatus").textContent = window.TAESAN_PREVIEW ? "只读预览" : "";
  }
  async function syncAuth() {
    if (!client) return;
    const previous = admin;
    const { data, error } = await client.auth.getUser();
    admin = !error && data.user?.id === ADMIN;
    $("identity").textContent = admin
      ? "已登录 · " + (data.user.email || "管理员")
      : "未登录";
    $("openLogin").hidden = admin;
    $("logout").hidden = !admin;
    $("identity").hidden = !admin;
    $("accountMenu").hidden = !admin;
    $("adminModules").hidden = !admin && !window.TAESAN_PREVIEW;
    $("workspaceViews").hidden = !admin && !window.TAESAN_PREVIEW;
    if (admin || window.TAESAN_PREVIEW) select(current, false);
    $("workspaceStatus").textContent = window.TAESAN_PREVIEW ? "只读预览" : "";
    if (previous !== admin)
      for (const frame of frames.values())
        frame.contentWindow?.postMessage(
          { type: "taesan:auth-changed", admin },
          location.origin,
        );
  }
  async function init() {
    $("modulePicker").onchange = () => select($("modulePicker").value);
    window.addEventListener("popstate", () =>
      select(new URLSearchParams(location.search).get("module"), false),
    );
    $("openLogin").onclick = () => {
      $("loginStatus").textContent = "";
      $("login").showModal();
    };
    $("cancelLogin").onclick = () => $("login").close();
    $("loginForm").onsubmit = async (event) => {
      event.preventDefault();
      const button = $("loginForm").querySelector("[type=submit]");
      button.disabled = true;
      try {
        if (!client) throw Error("连接组件未加载");
        const { data, error } = await client.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value,
        });
        $("password").value = "";
        if (error) throw error;
        if (data.user?.id !== ADMIN) {
          await client.auth.signOut();
          throw Error("此账号没有管理员权限");
        }
        await syncAuth();
        $("login").close();
      } catch (error) {
        $("loginStatus").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    $("logout").onclick = async () => {
      try {
        if (!client) return;
        const { error } = await client.auth.signOut();
        if (error) throw error;
        await syncAuth();
      } catch (error) {
        $("workspaceStatus").textContent = error.message;
      }
    };
    select(new URLSearchParams(location.search).get("module"), false);
    try {
      if (!window.supabase || !window.TAESAN_SUPABASE_PUBLISHABLE_KEY)
        throw Error("连接组件未加载");
      client = window.supabase.createClient(
        "https://shwilnzlpychjoasvqtg.supabase.co",
        window.TAESAN_SUPABASE_PUBLISHABLE_KEY,
      );
      client.auth.onAuthStateChange(() =>
        setTimeout(
          () =>
            syncAuth().catch(
              (error) => ($("identity").textContent = error.message),
            ),
          0,
        ),
      );
      await syncAuth();
    } catch (error) {
      $("identity").textContent = "连接失败：" + error.message;
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
