# bt's moment

**mome.bingtao.xyz 的完整外观与交互层 —— 在不改 Ech0 一行源码的前提下，把默认的 Ech0 换成暗色星空 + 吃豆人 + 全胶囊 + 推特式透明评论区。**

两段注入（一段 CSS、一段 JS）+ 一份 nginx 配置，全部内容见下方[文件地图](#文件地图)。

---

## 这是什么

[Ech0](https://github.com/lin-snow/Ech0) 是一个极简的自托管 moments 平台，本仓库把它改成了现在你看到的 [mome.bingtao.xyz](https://mome.bingtao.xyz)：

- **纯黑加载页**：蓝色吃豆人 + 向左流动的豆子 +「不敢高声语，恐惊天上人」
- **全站胶囊化**：日期条、导航、按钮、评论、搜索框——所有矩形全部变成胶囊/圆角，图片刻意保留 14px 圆角不被裁成椭圆
- **星空全透明**：内容直接浮在粒子星空背景上，评论区是推特式的「无卡片 + 细分隔线」
- **弹幕式评论条**：😊 表情按钮 + 输入框 + 发送，像发弹幕一样评论
- **emoji 全集选择器**：fluent-emoji-high-contrast 全套 1595 个图标，分类 + 搜索，点击插入 unicode emoji
- **大圆盘调色盘**：canvas 手绘 HSV 色环，拖动取色、实时 hex、悬停时水上漂浮、拖动时抖动反馈，色值插入正文
- **彩色文字**：`#6e6eff 这段是蓝色` 这样的标记语法，发布后在所有访客浏览器里渲染成彩色（一篇动态可以混任意多种颜色）
- **细节**：日期行无小手指、点文字区进详情、链接渲染成纯文本超链接、标签页 favicon 换成吃豆人、加载期标题显示 loading

## 两种语法（彩色文字）

```
#cc5de8 这段是紫色，一直作用到行尾或下一个标记
#20c997 换绿色接棒继续
```

- 标记本身不显示；遇到下一个 `#hex` 就换色，否则作用到行尾
- 旧语法 `==#hex 文字==`（带定界符）仍然兼容
- 代码块和行内代码里的 `#hex` 不会被误染

## 文件地图

```
theme/
  custom.css / custom.js   面板层：贴进 Ech0「系统设置 → 自定义 CSS / JS」
                           的基础皮肤（暗色玻璃 + 顶栏 + 粒子壁纸）
  src/                     custom.css 的构建源（tokens + build.py）
  inject/
    mome.css               注入层样式（历次迭代的完整演化产物）
    mome.js                注入层脚本（全部交互：调色盘/emoji/标记渲染/…）
    emoji-map.json         fluent-emoji 图标名 → unicode emoji 映射（94% 覆盖）
    build-icons.py         把 Iconify 集合包拆成 1596 个独立 SVG 的脚本
deploy/
  nginx.conf.example       nginx 注入层完整配置（含 sub_filter 与静态路由）
  ech0.service             systemd 单元
  worker.js                同一件事的 Cloudflare Worker 版
fonts/ extras/ screenshots/  字体 / 粒子壁纸 / 截图
```

## 装法

### A. 最小安装（面板层，五分钟）

1. 字体：`fonts/` 丢到站点根目录，保证 `/fonts/oswald-var.woff2` 可访问
2. Ech0 面板 → 系统设置 → 「自定义 CSS」贴 `theme/custom.css`，「自定义 JS」贴 `theme/custom.js`
3. 刷新，玻璃主题生效

### B. 完整安装（nginx 注入层，加载页改写 + 全部交互）

面板层够不着的东西（加载页第一帧、表情图标自托管、跨页面持久 UI）都在这一层：

1. 把 `deploy/nginx.conf.example` 按注释部署（需要 nginx 编译了 `http_sub_module`）
2. 把 `theme/inject/` 的四个文件放到 nginx 能出的路径：
   - `mome.css`、`mome.js` → sub_filter 注入到每个页面
   - `emoji-map.json` → 选择器数据
   - `python3 build-icons.py` 生成约 1596 个 SVG，放到 `/mome-icons/` 路径下
3. `nginx -t && systemctl reload nginx`

注入的具体位置都在 `nginx.conf.example` 里，搜 `mome` 即可。

## 设计说明（节选）

- **为什么通篇改 CSS 变量**：Ech0 前端是 UnoCSS 原子类，语义类名极少；变量是它官方的定制入口
- **为什么彩色文字用标记而不是 HTML**：Ech0 的 markdown-it 是 `html: false`，原生 `<span>` 会被转义成文字（源码 `web/src/editor/core/markdown.ts` 实锤）；标记方案把渲染放到客户端注入脚本里，不依赖上游改动
- **为什么 emoji 图标自托管**：选择器一次拉几百个图标，走公共 Iconify API 在国内时好时坏；拆成本地 SVG 后同源 + 浏览器缓存，全量秒开
- **为什么 CSS 文件名要带版本号**：Cloudflare 对 `.css` 有约 4 小时边缘缓存，改样式必须换文件名才能立刻生效

## 注意

- 仓库不含任何密钥；`deploy/nginx.conf.example` 中的域名与 UUID 均为占位符
- Ech0 上游升级不影响本主题（注入层全部 `!important` + 独立文件名）
- LICENSE / NOTICE 沿用上游 Ech0（AGPL-3.0-or-later）与所引用图标集的许可
