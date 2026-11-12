const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const ADMIN = "0c40000a-9f2c-46dc-8ba7-a0b016e6988e",
  user = {
    id: ADMIN,
    email: "fixture@example.invalid",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
const jwt =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: ADMIN,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
    .join(".") + ".fixture";
const base = process.env.TEST_BASE || "http://127.0.0.1:8000";
const date = new Date().toISOString().slice(0, 10);
async function setup(context, recordDate = date) {
  let signedIn = false,
    failSave = false;
  const records = new Map(),
    writes = [];
  const entries = [
    {
      id: "entry-fixture",
      date: recordDate,
      time: "12:00",
      platform: "Weverse",
      kind: "帖子",
      title: "公开近况",
      summary: "今天留下的记录。",
      photos: [
        "https://shwilnzlpychjoasvqtg.supabase.co/storage/v1/object/public/daily-photos/fixture.jpg",
      ],
      videos: [],
      photo_count: 1,
      video_count: 0,
    },
  ];
  await context.route("**/preview-config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.TAESAN_PREVIEW=false;",
    }),
  );
  await context.route("https://**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (!url.hostname.endsWith(".supabase.co")) return route.abort();
    if (req.resourceType() === "image")
      return route.fulfill({
        contentType: "image/webp",
        body: fs.readFileSync("assets/home-blue-portrait.webp"),
      });
    if (url.pathname.endsWith("/auth/v1/token")) {
      if (req.postDataJSON().password !== "fixture-password")
        return route.fulfill({
          status: 400,
          json: { code: "invalid_credentials", message: "邮箱或密码错误" },
        });
      signedIn = true;
      return route.fulfill({
        json: {
          access_token: jwt,
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    }
    if (url.pathname.endsWith("/auth/v1/user"))
      return route.fulfill({ json: signedIn ? user : {} });
    if (url.pathname.endsWith("/auth/v1/logout")) {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    const table = url.pathname.split("/").at(-1);
    let rows = [];
    if (table === "entries") rows = entries;
    if (table === "tmi_categories")
      rows = [{ name: "其他" }, { name: "基本资料" }];
    if (table === "tmi_records") {
      const id = url.searchParams.get("id")?.slice(3);
      if (["POST", "PATCH", "DELETE"].includes(req.method())) {
        if (!signedIn)
          return route.fulfill({
            status: 403,
            json: { code: "42501", message: "登录已过期" },
          });
        if (failSave)
          return route.fulfill({
            status: 503,
            json: { code: "PGRST001", message: "暂时不可用" },
          });
        const data = req.postDataJSON();
        writes.push({ method: req.method(), table, data, id });
        if (req.method() === "DELETE") {
          const row = records.get(id);
          records.delete(id);
          return route.fulfill({ json: row });
        }
        const value = {
          tags: [],
          images: [],
          original_ko: "",
          translation_zh: "",
          source: "",
          source_url: "",
          source_note: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...data,
        };
        records.set(value.id, value);
        return route.fulfill({ json: value });
      }
      rows = [...records.values()];
    }
    if (table === "archive_records" && req.method() === "POST") {
      const row = req.postDataJSON();
      writes.push({ method: "POST", table, data: row });
      return route.fulfill({ json: row });
    }
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((row) => String(row[key]) === value.slice(3));
    const count = rows.length,
      offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 1000);
    rows = rows.slice(offset, offset + limit);
    return route.fulfill({
      headers: {
        "content-range": (count ? "0-" + (count - 1) : "*") + "/" + count,
        "access-control-expose-headers": "content-range",
      },
      json: rows,
    });
  });
  return { records, writes, setFailSave: (value) => (failSave = value) };
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
        }),
        api = await setup(context),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => d.accept());
      page.setDefaultTimeout(15000);
      await page.goto(base + "/index.html");
      await page.waitForURL("**/daily.html");
      await page
        .locator("#dailyList")
        .filter({ hasText: "公开近况" })
        .waitFor();
      assert.equal(await page.locator("h1").textContent(), "每日记录");
      assert(await page.locator(".archive-brand").isVisible());
      assert.equal(await page.locator("#tabs button:visible").count(), 0);
      assert(await page.locator("#tabs [data-tab=photos]").isHidden());
      assert.equal(await page.locator("input[type=file]:visible").count(), 0);
      await page.screenshot({
        path: "work/screenshots/simple-daily-" + width + ".png",
        fullPage: true,
      });
      await page.locator("#tabs summary").click();
      await page.locator("[data-tab=photos]").click();
      assert(await page.locator("#photos").isVisible());
      assert.equal(await page.locator("h1").textContent(), "照片");
      assert(!(await page.locator("#tabs details").evaluate((d) => d.open)));
      await page.locator(".archive-menu summary").click();
      await page.locator('.archive-menu a[href="work.html"]').click();
      assert(await page.locator('a[href="music.html"]').isVisible());
      assert(
        await page.locator('.chapter-links a[href="stage.html"]').isHidden(),
      );
      await page.locator(".chapter-links summary").click();
      await page.locator('.chapter-links a[href="stage.html"]').click();
      await page.locator(".back-link").click();
      await page.waitForURL("**/work.html");
      await page.locator(".back-link").click();
      await page.waitForURL("**/daily.html");
      await page.locator(".archive-menu summary").click();
      await page.locator('.archive-menu a[href="self.html"]').click();
      await page.locator('.chapter-links a[href="tmi.html"]').click();
      await page.locator(".back-link").click();
      await page.waitForURL("**/self.html");
      await page.goto(base + "/admin.html?module=tmi");
      assert(await page.locator("#workspaceViews").isHidden());
      assert.equal(await page.locator("iframe").count(), 0);
      await page.locator("#openLogin").click();
      await page.locator("#cancelLogin").click();
      assert(await page.locator("#login").isHidden());
      await page.locator("#openLogin").click();
      await page.locator("#email").fill(user.email);
      await page.locator("#password").fill("wrong-password");
      await page.locator("#loginForm [type=submit]").click();
      await page
        .locator("#loginStatus")
        .filter({ hasText: "邮箱或密码错误" })
        .waitFor();
      assert(await page.locator("#workspaceViews").isHidden());
      await page.locator("#password").fill("fixture-password");
      await page.locator("#loginForm [type=submit]").click();
      await page.locator("#identity").filter({ hasText: "已登录" }).waitFor();
      const frame = page.frameLocator('iframe[name="workspace-tmi"]');
      await frame
        .locator("#editStatus")
        .filter({ hasText: "新档案" })
        .waitFor();
      assert(await frame.locator("#source").isHidden());
      assert.equal(await frame.locator("button.primary:visible").count(), 1);
      await frame.locator("#save").click();
      assert(
        await frame
          .locator("#content")
          .evaluate((input) => input.validity.valueMissing),
      );
      assert.equal(api.records.size, 0);
      await frame.locator("#title").fill("待提交档案");
      await frame.locator("#content").fill("保存与返回测试");
      await frame.locator("summary").filter({ hasText: "补充资料" }).click();
      await frame.locator("#korean").fill("한국어");
      await frame.locator("#source").fill("采访");
      await frame.locator("#url").fill("not-a-url");
      await frame.locator("summary").filter({ hasText: "补充资料" }).click();
      await frame.locator("#save").click();
      assert(await frame.locator("#url").isVisible());
      assert.equal(api.records.size, 0);
      await frame.locator("#url").fill("https://example.com/source");
      api.setFailSave(true);
      await frame.locator("#save").click();
      await frame
        .locator("#editStatus")
        .filter({ hasText: "保存失败" })
        .waitFor();
      assert.equal(
        await frame.locator("#content").inputValue(),
        "保存与返回测试",
      );
      assert.equal(api.records.size, 0);
      api.setFailSave(false);
      await frame.locator("#save").click();
      await frame
        .locator("#editStatus")
        .filter({ hasText: "已保存为草稿" })
        .waitFor();
      assert.equal(api.records.size, 1);
      const row = [...api.records.values()][0];
      assert.equal(row.original_ko, "한국어");
      assert.equal(row.published, false);
      await frame.locator("#reset").click();
      assert.equal(await frame.locator("#content").inputValue(), "");
      await frame.locator("#content").fill("切换模块保留草稿");
      await page.locator("#modulePicker").selectOption("thoughts");
      const thoughts = page.frameLocator('iframe[name="workspace-thoughts"]');
      await thoughts.locator("#editorPanel").waitFor({ state: "visible" });
      assert.equal(await thoughts.locator("button.primary:visible").count(), 1);
      assert(await thoughts.locator("#saveLocal").isHidden());
      await page.locator("#modulePicker").selectOption("tmi");
      assert.equal(
        await frame.locator("#content").inputValue(),
        "切换模块保留草稿",
      );
      await frame.locator("#reset").click();
      await page.screenshot({
        path: "work/screenshots/simple-admin-" + width + ".png",
        fullPage: true,
      });
      await page.locator("#returnToArchive").click();
      await page.waitForURL("**/tmi.html");
      assert(await page.locator("#admin").isHidden());
      assert.equal(await page.locator("#cards article").count(), 0);
      await page.goto(base + "/admin.html?module=tmi");
      await page.locator("#accountMenu summary").click();
      await page.locator("#logout").click();
      await page.locator("#openLogin").waitFor();
      assert(await page.locator("#workspaceViews").isHidden());
      assert(
        !(await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        "PASS " +
          width +
          "px: direct archive, folded navigation, back links, login cancel/error/success, failed submission preserves text, cloud draft save, reset/return, module switching and logout; isolated API writes",
      );
    }
    const context = await browser.newContext();
    await setup(context, "2026-10-01");
    const page = await context.newPage();
    await page.goto(base + "/index.html");
    await page.locator("#dailyList").filter({ hasText: "公开近况" }).waitFor();
    assert.equal(await page.locator("#dayPicker").inputValue(), "2026-10-01");
    await page.locator("#dayPicker").fill(date);
    await page.locator("#dayPicker").dispatchEvent("change");
    assert.equal(await page.locator("#dayPicker").inputValue(), date);
    await page
      .locator("#dailyList")
      .filter({ hasText: "暂无公开营业记录" })
      .waitFor();
    await page.goto(base + "/daily.html?date=" + date);
    await page
      .locator("#dailyList")
      .filter({ hasText: "暂无公开营业记录" })
      .waitFor();
    assert.equal(await page.locator("#dayPicker").inputValue(), date);
    await context.close();
    console.log(
      "PASS latest archive date by default; explicit date and user date changes never overridden",
    );
  } finally {
    await browser?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
