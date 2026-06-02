# 飞书数据同步配置指南

## 第一步：飞书妙搭创建应用
在飞书妙搭中用提示词创建"AI赛事掘金"应用（提示词见下方）

## 第二步：获取 Bitable 信息
1. 打开飞书妙搭中创建好的应用
2. 进入"数据管理" → 找到底层的多维表格
3. 复制两个值：
   - **app_token**：多维表格 URL 中 `/base/` 后面的那串（如 `bascnXXXX`）
   - **table_id**：表格 URL 中 `table=` 后面的那串（如 `tblXXXX`）

## 第三步：手动导入首批数据
在飞书多维表格中：
1. 点击右上角 "..." → "导入数据" → "CSV"
2. 选择 `contests_for_import.csv` 文件
3. 确认导入

## 第四步：配置自动同步
在 GitHub 仓库 Settings → Secrets and variables → Actions，添加：
- `FEISHU_APP_ID` = `cli_aa943c65cef81cc6`
- `FEISHU_APP_SECRET` = `6lJ2gJXTdMDBZlHjQyJsDdG6Zl0YWcXS`
- `BITABLE_APP_TOKEN` = 第2步获取的值
- `BITABLE_TABLE_ID` = 第2步获取的值

同时开通飞书应用权限：
- 打开 https://open.feishu.cn/app/cli_aa943c65cef81cc6/auth
- 搜索 `bitable`，开通 `bitable:app` 权限

## 完成！
之后每 3 天 GitHub Actions 会自动：
1. 抓取最新赛事数据
2. 同步到飞书多维表格
3. 飞书妙搭页面自动更新显示
