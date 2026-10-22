TAESAN DAILY V5 安装
1. 先在旧网站管理页导出 data.json 备份，保留好。
2. 上传 index.html 和 supabase-config.js 到 GitHub 仓库根目录。不要删除 data.json。
3. GitHub 打开 supabase-config.js，点击编辑铅笔，把 PASTE_YOUR_sb_publishable_KEY_HERE 替换为 Supabase 的 sb_publishable_... 密钥；保留前后双引号，Commit changes。
4. 等待 GitHub Pages 部署完成，刷新网页，点管理，用 Supabase Authentication 中创建的邮箱和密码登录。
5. 首次登录后用 导入旧 data.json 把41条记录导入云端；以后编辑直接保存。
6. 只使用 publishable key；不要放入 secret、service_role 或密码。
注意：上线前应核对管理员写入 RLS 策略和关闭公开注册；如果数据为空，先导入备份，不要删除旧 data.json。
