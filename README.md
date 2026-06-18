# 机器学习 · 知识库 & 题库

基于课程 PPT（2026 春 · 顾小东）整理的机器学习复习网站，纯静态 SPA，适合部署到 Cloudflare Pages。

## 内容
- **19 讲**：线性回归 → 决策树 → 贝叶斯 → KNN → 逻辑回归 → SVM → MLP → PyTorch → 语言模型 → Transformer → LLM → CNN → CV → K-means → 降维 → 生成模型 → 强化学习 → 期末复习
- **254 个知识点**讲解（含 KaTeX 公式）
- **323 道题**（单选 / 多选 / 判断 / 简答，含答案与解析）
- 功能：讲次浏览、知识点带目录导航、题库练习（按讲次/题型/难度筛选、乱序、提交评分）、全站搜索、深浅色主题

## 本地预览
```bash
cd ml-course-site
python3 -m http.server 8099
# 打开 http://localhost:8099
```

## 部署到 Cloudflare Pages
```bash
# 1. 登录（浏览器授权，一次即可）
npx wrangler login

# 2. 部署（首次会提示创建项目，选生产分支 main 即可）
npx wrangler pages deploy . --project-name=ml-course --commit-dirty=true
```
部署完成后会得到一个 `https://ml-course.pages.dev` 地址。

## 目录结构
```
index.html          # 页面外壳
assets/app.js       # SPA 路由 / 渲染 / 题库逻辑 / 搜索
assets/style.css    # 样式（含深浅色主题）
data/lectures.json  # 讲次索引
data/<id>.json      # 每讲的知识点 + 题库
```
新增/修改内容只需编辑 `data/*.json`，无需构建。
