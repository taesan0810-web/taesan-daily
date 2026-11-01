# TAESAN TMI 使用与回滚

## 打开和管理
主站导航点击「TMI」，或访问 tmi.html。点击「管理档案」，使用主站相同的管理员账号登录；已在同一浏览器主站登录时共享会话。

管理员可使用状态筛选「全部（含草稿）」或「仅草稿」，编辑初始资料。新记录默认草稿；勾选「公开发布」再保存，或在卡片上点击「发布」。删除需要确认。

童年/出道前与内容分类独立，支持上学前、小学、中学、未明确；初中、高中、练习生可作为标签。日期未知留空，列表将未知日期排在最后。每24条加载一次。卡片的独立链接可直接分享。

## 资料说明
48条 PDF 初步整理资料已导入为草稿，公开日期为空，包含文档页码和待核实说明。原始韩文和来源链接没有凭空补充。自动审批拒绝直接公开未核实资料，因此未将这些内容写入公开仓库或网站静态文件。请核实后自行发布。

## 图片
使用独立私有桶 tmi-images，最多5MB，支持 JPG、PNG、WebP；iPhone HEIC 请先转换。上传后可预览、上下移动、移除，最后保存记录。移除只解除引用，不自动销毁文件。取消发布后不再发放新的访客图片链接；已签发链接最多仍有效5分钟。

DM 只录入自己整理的摘要；客户端和数据库均拒绝 DM 原文、翻译和图片。其他来源也仅上传有权公开的内容。

## JSON 导入和备份
下载 tmi-import-example.json，替换内容后上传。可使用数组或 {"version":1,"records":[...]}。必须有 content_zh；分类必须已存在；tags/images 是数组；日期是 YYYY-MM-DD 或 null；published 默认 false。图片路径必须属于该记录 UUID 文件夹。

先预览，错误项和疑似重复不写入；已有 ID 跳过，不覆盖。点击确认才写入有效项，逐条显示成功或失败；重试会跳过成功项。取消不再写入；导入过程中不能更换文件。网络中断后若记录实际上已成功，稳定 UUID 加 ignoreDuplicates 可防止重复写入。

「导出完整 TMI 备份」包含草稿及图片路径，但不含图片二进制；恢复图片需要另保留 Storage 文件。任何修改前建议导出备份。

## 本次文件
新增 tmi.html、tmi.css、tmi.js、tmi-import-example.json、tmi-schema.sql、本说明；index.html 仅新增一个 TMI 链接。supabase-config.js 和既有业务文件没有改变。

## 回滚
部署前 main 提交：c326b81f94c72ce1c927f47cf5fbc2a5c13f34ff。通过新建 revert 提交撤销 TMI 前端提交，避免强推或覆盖后来工作。先隐藏主页入口并保留新增数据表是最安全的即时回滚。

需要撤销数据库时：先导出 tmi_records、tmi_categories 和私有桶文件；确认可恢复后，只移除 tmi_images_admin、tmi_images_published 两条 storage.objects 策略，移除新建的 tmi_records、tmi_categories 表及 tmi_prepare 函数；通过 Storage API 清理本次 tmi-images 桶。不要修改 entries、dm_stats、music_tracks 或 daily-photos，也不要直接删除 storage.objects 元数据。此说明不会自动执行破坏性回滚。

迁移已通过 Supabase MCP apply_migration 执行，名称 add_taesan_tmi_archive；tmi-schema.sql 为该次 SQL 原文，非可反复执行脚本。

## 测试范围
数据库事务测试：管理员新增/读取草稿/编辑/发布/删除、匿名草稿隔离、非管理员写入拒绝，通过后回滚所有测试记录。
页面自动化：使用隔离的内存数据库模拟连接，验证加载更多、搜索、分类/学段、展开、管理员新增/编辑/草稿/发布/取消发布/删除，JSON日期与重复校验/预览/取消/插入，1280与390像素布局，均通过。
实际数据库管理权限通过 SQL 模拟 JWT 验证，未使用管理员密码自动登录；真实手机 Safari 和真实图片上传未完成端到端测试。不要将模拟浏览器测试理解为真实账号全部流程实测。

补充验证：既有音乐封面与照片上传两组回归测试通过，包含音乐及六个原有标签页、320/390像素照片管理。既有 entries 69条、DM 31天、music_tracks 115首，前后内容指纹一致。TMI SDK 已改为随站点提供的 supabase-local.js（2.49.1），避免 jsDelivr 连接重置。当前自动化浏览器到 Supabase REST 域名仍遇到网络连接重置，因此未将真实浏览器登录/上传宣称为已完成；数据库端权限测试通过。

