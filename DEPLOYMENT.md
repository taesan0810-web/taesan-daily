# 正式发布记录

用户已确认正式发布，并明确批准新增数据表、私有档案图片桶、公开视频桶及仅管理员写入的访问策略。

正式地址：https://taesan0810-web.github.io/taesan-daily/

管理工作台：https://taesan0810-web.github.io/taesan-daily/admin.html

## 最终范围

- 首页仅在首屏换用蓝色街拍和录音细节，纸条缩小并去掉末尾心形。
- WORK / SELF / DAILY 三个入口的原图片和排版恢复，撤去底部新增照片区。
- SELF 只有 TMI、THOUGHTS；所有录入、上传、分类、备份操作在管理工作台。
- DM Journey 独立保留原版地图 UI，从 DM COUNTS 按月份进入。

## 数据库

已应用 Supabase 迁移 `add_personal_archive_and_upload_support`。

- 新增 archive_records、journey_locations，启用 RLS；管理员沿用原 UID，访客只能读取已发布档案。
- 新增私有 archive-images、公开 daily-videos 桶，仅原管理员可上传。公开视频 URL 可被任何人访问。
- daily-photos 仅允许管理员清理 entries/ 下且未被营业或推荐音乐记录引用的临时图片；没有删除现有文件。
- 原 October Journey 的四个已知城市停留节点写入新增地点表；原 DM 数量表不变。
- 原 entries 69 条、DM 31 天、TMI 48 条、推荐音乐 115 条、音乐作品 1 条及 292 个存储对象保持不变。
- archive-schema-proposal.sql、storage-repair-proposal.sql 是历史审阅草案，已经由上述迁移落实，请勿重复执行。

## 录入

使用原管理员账号在管理工作台登录。THOUGHTS、STAGE、SHORT VIDEOS 可以保存本机草稿，也可以保存到云端。公开发布框未勾选时，云端档案保持草稿，不向访客展示；本机草稿本身不会自动发布。

新文件上传后仍须保存对应记录。已有 TMI 发布状态保留，48 条均仍为草稿，未自动公开。

## 验证与限制

- 首页六种尺寸、统一工作台登录与退出、七个模块、跨模块保留输入、照片上传回归和音乐封面回归通过。
- 使用事务内角色验证检查真实数据库的管理员增改删、草稿隔离、公开读取及普通账号写入拒绝；全部测试数据回滚。
- 真实管理员密码未由助手获取，未冒用用户账号进行实际媒体上传。实际管理员登录与上传仍由用户使用原账号完成。
- Supabase 既有泄露密码检测未启用的警告保持原状：[官方说明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。本次没有调整账户或密码设置。

## 回滚

前端旧生产基线为 `896f617209072619eec5b50435e9377555cd7d49`。需要回滚时使用新提交恢复前端文件；保留新增数据库表与上传文件，避免丢失发布后录入的内容。`legacy-daily.html` 和原 October Journey 页面仍保留。
