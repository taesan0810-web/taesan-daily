# TAESAN PERSONAL ARCHIVE 改版审阅

基线：GitHub `main` 提交 `896f617209072619eec5b50435e9377555cd7d49`。经用户确认，本次仅提交独立 `preview-zine-archive-review` 分支用于审阅；未合并 main、未更改正式 GitHub Pages，也未修改生产数据库。

## 页面与功能

| 分区 | 页面 | 处理 |
| --- | --- | --- |
| 首页 | index.html | 按最终修正，仅在首屏拼贴换用蓝色街拍与录音细节；三个入口保留原图片、排版和链接；撤去新增的底部照片区；小纸条缩小并去掉心形 |
| SELF | self.html | 仅保留 TMI、THOUGHTS 两个入口；FRAGMENTS 已从导航移除，旧页面不删除 |
| TMI | tmi.html | 保留分类、搜索、双语、签名图片、后台、导入导出及发布状态；添加统一导航与配色 |
| THOUGHTS | thoughts.html | 独立页面；中文、韩文、日期、来源、图片、标签、分类、搜索、排序和分页；编辑移入管理工作台 |
| WORK | work.html | STAGE、MUSIC、SHORT VIDEOS 入口 |
| STAGE | stage.html | 三类舞台；封面、标题、日期、演出、来源及后台 |
| MUSIC | music.html | 原有作品、团体音乐、推荐列表、播放器、歌词、私有上传及后台均保留；不合并 music_tracks 和 music_works |
| SHORT VIDEOS | short-videos.html | Solo / Special TikTok、合作对象、日期、封面、来源及后台；原 entries 中的 TikTok 只读复用并标记待分类 |
| DAILY | daily.html | 复用原营业页面全部逻辑；公开时间线仅展示指定五类平台；保留 DM 数量、日历、照片、视频、年度统计和管理 |
| DM JOURNEY | journey.html | 独立页面，复用原 October 的浅蓝地图、气泡、头像、日期条和播放 UI；从 DM COUNTS 按所选月份直达；同城不移动；支持月份切换和真实数量读取 |
| MONTHLY ARCHIVE | daily.html?tab=monthly | 同月时间线、图片墙及 DM COUNTS 互联；Journey 链接统一放在 DM COUNTS 内 |
| 管理工作台 | admin.html | 统一登录/退出；营业、DM、图片视频、TMI、THOUGHTS、STAGE、SHORT VIDEOS、音乐作品、推荐、导入导出及 Journey 地点均在此操作；复用现有表单，切换模块保留未保存内容 |
| 旧首页 | legacy-daily.html | 与改版前首页逐字节一致的备份；其他历史页面不删除 |

## 数据与权限检查

- 首页仅首屏换用用户提供的蓝色街拍与录音照片；其余新素材保留为资源，不增加页面区块或更改三个入口。已补上 ZIP 中的蓝色街拍；“dear, taesan” 纸条缩小并去掉末尾心形。

- 生产有 entries 69 条、dm_stats 31 天、music_tracks 115 条、tmi_records 48 条、music_works 1 条、music_albums 0 条；七张表均启用 RLS。
- 匿名 Publishable Key 实际 REST 读取：69 / 31 / 115 / 0 / 1 / 0。TMI 48 条当前未公开，未自动改变发布状态。
- 管理员沿用现有固定 UID；访客仅能读取已发布的新档案。草稿图片拟存入私有 archive-images 桶并按发布状态提供读取权限。
- 现有 daily-photos、tmi-images、music-media 桶及文件保持原状。发现旧视频上传引用的 daily-videos 桶不存在；另附待审修复 SQL。
- 预览启用 preview-config.js。fetch / XMLHttpRequest 的生产数据写入会被拦截；签名图片读取允许通过。新模块可在管理工作台保存浏览器本机草稿，公开页面不展示本机草稿、编辑器或上传控件。
- 工作台沿用 Supabase 的原有会话和固定管理员 UID，各模块复用已有实现。统一退出会通知所有已打开模块更新权限；旧管理地址自动跳转工作台。
- DM 保留数量，不在公开 DAILY LOG 时间线展示；非零 DM 数量仍使日历当天标为营业。
- 原 entries 中非指定平台仍可通过原管理功能查看；照片墙保留原有媒体来源。

## 待确认数据库变更

`archive-schema-proposal.sql`：新增 archive_records、journey_locations、对应 RLS、索引、权限和私有图片桶。未执行。不会修改既有数据表。

`storage-repair-proposal.sql`：仅补建 daily-videos 桶及管理员上传权限。未执行。原公开视频功能在缺失该桶时无法完成真实上传。

新增档案云端保存及图片上传尚不能在生产验收，须审阅并批准 SQL 后再验证。未进行真实登录、上传、删除或其他生产写入测试。

## 验证

- 首页专项：320×568、390×844、768×1024、1440×900、1920×1080、1440×650；新照片加载、文字容器、拼贴稳定、首屏露出后续内容、三入口实际跳转、探索锚点和减少动画偏好。

- Playwright：320 / 390 / 768 / 1440 宽度，44 个页面及视口组合；SELF 两个入口、公开页面无编辑或上传控件、公开平台筛选、DM 日历、图片左右滑动、DM COUNTS 的月份链接、原版 Journey 地图与跨城移动、fetch / XHR 写入阻止。
- 工作台隔离测试：320 / 390 / 1440；统一登录/退出、七个管理模块、上传表单、本机草稿、切换保留未保存内容、公开页面不泄漏草稿、旧管理地址重定向。认证及所有数据使用测试桩，未写生产数据。
- 原照片回归：320 / 390，多图上传、排序、去重、末图移除、共享文件保护、失败清理与重试、部分上传重试、视频封面计数。
- 原音乐回归：115 条分页、原数据库 URL 保持、封面回退、加载失败重试、搜索及原标签页。
- 真实生产只读 API 与匿名角色查询均通过。
- 测试环境 Chromium 经代理直连 Supabase 时出现 ERR_CERT_AUTHORITY_INVALID；未关闭 TLS 验证。测试传输改经 Node 已配置的可信 CA 与代理，浏览器界面读取真实生产响应后通过：69 条营业、31 天 DM、115 首推荐音乐、独立作品读取、TMI 未公开状态及 October Journey；没有页面脚本异常。该测试验证真实读取与前端整合，不等同于在用户设备上验收证书或管理员写入。
- 检查保留原文件的 CRLF 换行与旧首页空白行；data.json、music-playlist.js、October 原页面未改动；旧首页备份哈希与原首页相同。TMI、音乐及营业脚本仅增加工作台上下文和统一权限同步，原有数据结构与媒体操作保留。

## 确认后

1. 确认视觉及导航，以及两份 SQL 是否批准执行。
2. 备份待变更对象，在授权范围执行新增结构；用真实管理员验证新模块保存、上传、草稿和发布权限。
3. 将生产版本 preview-config.js 切为 false，保留私密审阅站只读配置。
4. 再检查远程 main 是否变化，解决差异后提交原 GitHub 仓库，触发 GitHub Pages。
5. 验证线上首页、分区、日历、媒体、音乐、TMI 与后台；保留回滚提交和旧页面。
