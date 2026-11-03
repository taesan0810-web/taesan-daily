# TAESAN PERSONAL ARCHIVE 改版审阅

基线：GitHub `main` 提交 `896f617209072619eec5b50435e9377555cd7d49`。经用户确认，本次仅提交独立 `preview-zine-archive-review` 分支用于审阅；未合并 main、未更改正式 GitHub Pages，也未修改生产数据库。

## 页面与功能

| 分区 | 页面 | 处理 |
| --- | --- | --- |
| 首页 | index.html | 复用上传的 Zine 参考和三张原图；独立 WORK / SELF / DAILY 链接；移动端排版及减少动态效果支持 |
| SELF | self.html | TMI、THOUGHTS、FRAGMENTS 独立入口 |
| TMI | tmi.html | 保留分类、搜索、双语、签名图片、后台、导入导出及发布状态；添加统一导航与配色 |
| THOUGHTS / FRAGMENTS | thoughts.html / fragments.html | 独立页面；中文、韩文、日期、来源、图片、标签、分类、搜索、排序、分页及后台 |
| WORK | work.html | STAGE、MUSIC、SHORT VIDEOS 入口 |
| STAGE | stage.html | 三类舞台；封面、标题、日期、演出、来源及后台 |
| MUSIC | music.html | 原有作品、团体音乐、推荐列表、播放器、歌词、私有上传及后台均保留；不合并 music_tracks 和 music_works |
| SHORT VIDEOS | short-videos.html | Solo / Special TikTok、合作对象、日期、封面、来源及后台；原 entries 中的 TikTok 只读复用并标记待分类 |
| DAILY | daily.html | 复用原营业页面全部逻辑；公开时间线仅展示指定五类平台；保留 DM 数量、日历、照片、视频、年度统计和管理 |
| DM JOURNEY | journey.html | 月份切换、按日数量、城市位置、播放和地点管理；仅跨城市时移动；October 原数据及原页面均保留 |
| MONTHLY ARCHIVE | daily.html?tab=monthly | 同月时间线、图片墙、DM 数量和 Journey 互联 |
| 旧首页 | legacy-daily.html | 与改版前首页逐字节一致的备份；其他历史页面不删除 |

## 数据与权限检查

- 生产有 entries 69 条、dm_stats 31 天、music_tracks 115 条、tmi_records 48 条、music_works 1 条、music_albums 0 条；七张表均启用 RLS。
- 匿名 Publishable Key 实际 REST 读取：69 / 31 / 115 / 0 / 1 / 0。TMI 48 条当前未公开，未自动改变发布状态。
- 管理员沿用现有固定 UID；访客仅能读取已发布的新档案。草稿图片拟存入私有 archive-images 桶并按发布状态提供读取权限。
- 现有 daily-photos、tmi-images、music-media 桶及文件保持原状。发现旧视频上传引用的 daily-videos 桶不存在；另附待审修复 SQL。
- 预览启用 preview-config.js。fetch / XMLHttpRequest 的生产数据写入会被拦截；签名图片读取允许通过。新模块可保存浏览器本机草稿，未写入生产数据库。
- DM 保留数量，不在公开 DAILY LOG 时间线展示；非零 DM 数量仍使日历当天标为营业。
- 原 entries 中非指定平台仍可通过原管理功能查看；照片墙保留原有媒体来源。

## 待确认数据库变更

`archive-schema-proposal.sql`：新增 archive_records、journey_locations、对应 RLS、索引、权限和私有图片桶。未执行。不会修改既有数据表。

`storage-repair-proposal.sql`：仅补建 daily-videos 桶及管理员上传权限。未执行。原公开视频功能在缺失该桶时无法完成真实上传。

新增档案云端保存及图片上传尚不能在生产验收，须审阅并批准 SQL 后再验证。未进行真实登录、上传、删除或其他生产写入测试。

## 验证

- Playwright：320 / 390 / 768 / 1440 宽度，44 个页面及视口组合；入口、页面可读性、无横向溢出、公开平台筛选、DM 日历、图片左右滑动、月份关联、原 TikTok 保留、本机草稿保存与编辑、Journey 跨城移动、fetch / XHR 写入阻止。
- 原照片回归：320 / 390，多图上传、排序、去重、末图移除、共享文件保护、失败清理与重试、部分上传重试、视频封面计数。
- 原音乐回归：115 条分页、原数据库 URL 保持、封面回退、加载失败重试、搜索及原标签页。
- 真实生产只读 API 与匿名角色查询均通过。
- 测试环境 Chromium 经代理直连 Supabase 时出现 ERR_CERT_AUTHORITY_INVALID；未关闭 TLS 验证。测试传输改经 Node 已配置的可信 CA 与代理，浏览器界面读取真实生产响应后通过：69 条营业、31 天 DM、115 首推荐音乐、独立作品读取、TMI 未公开状态及 October Journey；没有页面脚本异常。该测试验证真实读取与前端整合，不等同于在用户设备上验收证书或管理员写入。
- git diff --check 通过；data.json、tmi.js、music.js、music-playlist.js、October 原页面未改动；旧首页备份哈希与原首页相同。

## 确认后

1. 确认视觉及导航，以及两份 SQL 是否批准执行。
2. 备份待变更对象，在授权范围执行新增结构；用真实管理员验证新模块保存、上传、草稿和发布权限。
3. 将生产版本 preview-config.js 切为 false，保留私密审阅站只读配置。
4. 再检查远程 main 是否变化，解决差异后提交原 GitHub 仓库，触发 GitHub Pages。
5. 验证线上首页、分区、日历、媒体、音乐、TMI 与后台；保留回滚提交和旧页面。
