# bt's moment

**给 [Ech0](https://github.com/lin-snow/Ech0) 换一层皮：暗色玻璃 + 亮色纸面。**

一套运行时主题（一段 CSS + 一段 JS，通过面板注入，不改 Ech0 源码），
外加可选的加载页改写与 systemd/反代部署示例。

> **English abstract** — *bts-moment* is a runtime theme kit for
> [Ech0](https://github.com/lin-snow/Ech0), a self-hosted single-user microblog
> written in Go + Vue. It injects a frosted-glass dark theme (and a clean paper
> light theme) through Ech0's built-in *Custom CSS / Custom JS* settings — no
> source changes, no rebuild. It also ships a self-contained particle wallpaper
> page, optional nginx/Cloudflare-Worker snippets that restyle the pre-Vue
> loading screen, and a hardened systemd unit. Licensed AGPL-3.0-or-later,
> matching upstream.

---

## 目录

- [这是什么](#这是什么)
- [长什么样](#长什么样)
- [装法](#装法)
- [配置](#配置)
- [设计说明](#设计说明)
- [部署套件](#部署套件)
- [已知限制](#已知限制)
- [合规](#合规)
- [许可与致谢](#许可与致谢)

---

## 这是什么

Ech0 是一个自托管的单人微博客：Go 写的单文件二进制，前端是 Vue 3 + UnoCSS，
前端资源用 `//go:embed` 烘进二进制里。它自带两个口子 —— **自定义 CSS** 和
**自定义 JS** —— 允许你在不碰源码的前提下换掉整站外观。

**bts-moment 就是往这两个口子里塞的东西。** 具体地：

| | |
|---|---|
| **它是什么** | Ech0 的一个第三方主题 + 一套部署套件 |
| **它不是什么** | 不是 Ech0 的 fork，不含 Go / Vue 源码，不含二进制 |
| **怎么生效** | 面板 → 系统设置 → 自定义 CSS / 自定义 JS |
| **改了什么** | 只加样式和客户端脚本；Ech0 一行源码都没动 |
| **许可** | AGPL-3.0-or-later（跟上游一致，见 [NOTICE](NOTICE)） |

「玻璃」的部分来自另一个模板项目
[liquid-glasses-template-for-blog](https://github.com/yahoofunny/liquid-glasses-template-for-blog)
的那套毛玻璃配方（半透明填充 + 1px 描边 + `backdrop-filter`），
但**三个旋钮全部换成了配套博客的色值**，配方本身照搬、不发明新东西。

所以这套东西可以一句话概括：**Ech0 的骨架 + 玻璃的材质 + 博客的排版习惯。**

---

## 长什么样

**暗色（默认）** —— 玻璃面板浮在粒子壁纸上：

![暗色](screenshots/dark.png)

**亮色** —— 干净的纸面，没有粒子也没有玻璃：

![亮色](screenshots/light.png)

两套颜色的分工是刻意的：

| | 暗色 | 亮色 |
|---|---|---|
| 底色 | `#0e0e13` 近黑 | `#fdfdfd` 近白 |
| 面板 | 玻璃：`--wm-card` 的 58% + `blur(14px)` + 1px 描边 | 不透明纸面 |
| 粒子壁纸 | 开（`display:block`） | 关（`display:none`） |
| 主色 | `#6e6eff` | `#0000f2` |

> 亮色**刻意不给玻璃**。那边粒子是关的，面板后面只有一块纯色纸，
> 加玻璃唯一的效果是让纸面发脏。

---

## 装法

### 最小可用（三步，五分钟）

**1. 字体**

把 `fonts/` 整个目录放到你站点的根目录下，让它能通过
`https://你的域名/fonts/oswald-var.woff2` 访问到。

> 仓库里的 `theme/custom.css` 是按 `/fonts` 这个路径构建的。
> 想放别处，或者想直接外链别人的（需要对方带 CORS），
> 用 `python theme/src/build.py <你的字体目录URL>` 重新构建一份。

**2. 注入 CSS 和 JS**

打开 Ech0 面板 → **系统设置**：

- 「自定义 CSS」← 粘贴 `theme/custom.css` 的全文
- 「自定义 JS」← 粘贴 `theme/custom.js` 的全文

保存，刷新。这一步做完主题就已经生效了。

**3. 粒子壁纸（可选）**

`extras/bg-particle/` 是一个自包含的粒子页面。把它整个目录丢到任意
静态站点上（跟 Ech0 同域或跨域都行），然后改 `custom.js` 顶部的配置：

```js
particleUrl: 'https://你的静态站/bg-particle/index.html',
```

不想挂粒子就留空字符串 `''`，主题在暗色下就只是一块纯色底，其余照常。

### 完整一点

再往下还有两件可选的：

- **加载页改写** —— Ech0 的加载页（笑脸 + "Ech0"）写死在二进制里，
  `custom_css` / `custom_js` 都够不着它（那两个要等 Vue 挂载）。想改就得
  在 HTML 出站前动手。→ 见 [`deploy/`](#部署套件)
- **systemd 服务** —— 一个跑在非特权用户下、带 systemd 加固的单元文件。

---

## 配置

**你要改的东西全在 `theme/custom.js` 顶部的 `CONFIG` 里**，就三个字段：

```js
var CONFIG = {
  // 粒子壁纸地址。留空则完全不挂粒子。
  particleUrl: '/bg-particle/index.html',

  // 顶栏六栏目。换成你自己站点的真实路径；少放几个就删行；
  // 留空数组 [] 则整个顶栏不出现。
  nav: [
    { label: 'Chat',     href: '/chat/' },
    { label: 'Games',    href: '/games/' },
    { label: 'Archives', href: '/archives/' },
    { label: 'Mome',     href: '/' },
    { label: 'Gadgets',  href: '/radio/' },
    { label: 'About',    href: '/about/' }
  ],

  // 首次访问落到哪套主题：'dark' 或 'light'
  defaultTheme: 'dark'
}
```

上面是仓库里的**占位路径**，记得换成你自己的。
顶栏当前页会自动高亮，SPA 站内跳转也会跟着更新（脚本打了
`pushState` / `replaceState` 补丁，不轮询）。

想改**样式**（颜色、圆角、玻璃强度）要动 `theme/src/`：

```
theme/
├─ custom.css        ← 构建产物。**别手改**，会被下次构建覆盖
├─ custom.js         ← 手写，直接改
└─ src/
   ├─ tokens.css     ← 暗色的所有色值，按 /* ===== 2.x */ 分节
   ├─ tail.css       ← 第 3 节往后的所有规则（都走 var()，明暗自动跟）
   └─ build.py       ← tokens + tail → custom.css
```

改完重新构建：

```bash
python theme/src/build.py                  # 字体走 /fonts
python theme/src/build.py https://cdn.example.com/fonts   # 字体走外链
```

`build.py` 干的事很简单：把 `tokens.css` 里那**一个** `:root:root { }` 块
按节拆开 —— 字体和圆角那两节明暗共用，其余（都是暗色值）按一张固定的映射表
机械生成亮色版 —— 再拼上 `tail.css`，输出三段式：

```css
:root:root                        { /* 字体、圆角 —— 与主题无关 */ }
:root:root.dark                   { /* 暗色 */ }
:root:root.light, :root:root.sunny { /* 亮色，由暗色机械映射而来 */ }
```

构建是**可重复**的：同一个输入跑多少次，输出的 bytes 都一样。
亮色块是生成的，所以**不要手改 `custom.css`** —— 改 `tokens.css`，
或者改 `build.py` 里的 `PALETTE`。

---

## 设计说明

这一节解释「为什么是这样写的」。如果你只是想用，可以跳过。

### 为什么通篇都在改 CSS 变量

Ech0 的前端是 UnoCSS 原子类。翻它编译出来的主 CSS（v5.7.0 那份
`index-*.css`，约 100 KB）：一共只有 **412 个类名 token**，其中真正语义化的
组件类只有 `.widget` / `.x-scrollbar` / `.route-progress__bar` 三个 ——
其余全是 `text-sm` `bg-surface` `rounded-lg` 这种。**按类名写样式是写不动的。**

唯一的杠杆是变量：原子类最终都会落到 `--color-*` / `--radius-*` /
`--font-*` 上。所以主题的主体是「盖变量」，选择器只用在变量够不着的地方。

变量盖不到的地方有两类：

1. **裸写在规则里的字面值。** 主 CSS 里一共 499 处颜色字面量 ——
   464 处在变量定义里（那些正是我们盖掉的），15 处是 `var()` 的 fallback，
   真正裸写在规则里的只有 20 处。
2. **懒加载 chunk。** HomeView / EchoView / TheMdEditor / floating-vue 的样式
   主 CSS 里一行都没有，全在各自的 chunk 里，颜色和圆角都是不走变量的字面值。
   `--md-*`（Markdown 渲染与编辑器）、`--comment-*`（评论区）、
   `--heatmap-*`（热力图）都属于这一类。

第二类只能逐个点名，也是 `custom.css` 篇幅最大的部分。

> 顺带一提：**浮层类**（主题切换 / 用户菜单 / 语言切换的下拉）在 Ech0 里
> 是写死的白底黑字，暗色站里点一下会弹出一个白框。这是最扎眼的一处，
> `tail.css` 第 4 节专门修了它。

### 玻璃是怎么调的

配方只有三个旋钮，来自那个玻璃模板项目：

```
填充 rgba(255,255,255,.06)   描边 1px rgba(255,255,255,.1)   blur(16px)
```

搬过来时把三个旋钮换成博客的 token、圆角归零（全站 `border-radius: 0`
是这套视觉的一部分）：

```
填充 = --wm-card 的 58%   描边 = --wm-line   blur = 14px（面板）/ 20px（顶栏）
```

**照模板的方子，不加 `saturate()`** —— 加了会明显发灰。

两个坑，都是实测出来的，不是推断：

1. **`backdrop-filter` 确实能采样到跨源 iframe。** 粒子壁纸是一个跨源
   iframe，Chrome 在这块历史上有过 bug，所以专门做了对照实验：`blur(4px)`
   时粒子仍清晰可见、只是变虚 —— 证明确实在采样。

2. **但粒子只有 1px 上下，模糊半径一大就整个糊没了。** `blur(18px)` 直接
   看不见粒子。所以**模糊半径是个真·设计旋钮**，不是随手填的数：
   14px / 20px 是「糊得动背景、又留得住粒子」那个位置。

还有一条实现细节：描边用 `box-shadow: inset 0 0 0 1px` 画，**不用 `border`**。
那些元素原本没有 border，直接加会挤掉 2px 内容高度，滚动时能看见轻微跳动。

### 三档字体

排版系统只有三条规则，照搬配套博客的：

| 角色 | 字族 | 规格 | 用在哪 |
|---|---|---|---|
| **标题** | Oswald | 600，`letter-spacing .01em` | `h1`–`h4`、页面标题、Markdown 标题 |
| **微标签** | Courier Prime | 700 + `uppercase` + `letter-spacing .12em` | 顶栏、时间戳、标签名、按钮、设置项名 |
| **正文** | 系统方体 | — | echo 正文、编辑器、输入框 |

第三条是刻意的：**正文保持系统字体**。等宽字体只用在「微标签」那一档 ——
它负责气质，正文负责能读。中文正文尤其不能用 Oswald / Courier Prime，
它们没有汉字，会掉到 fallback 上去。

### 顶栏那六项

元素由 `custom.js` 注入，样式在 `tail.css` 第 10 节。三个坑：

1. **必须自己抬层。** 粒子 iframe 是 `position:fixed; inset:0; z-index:1`，
   它的 `body` 是不透明的 `#060914` —— 暗色下它就是一块盖住整个视口的深色板。
   普通文档流里的元素 `z-index` 是 `auto`，会被它整个盖住。（亮色下粒子是
   `display:none`，所以**只在暗色里消失**，特别容易看漏。）顶栏跟着
   `.app-stack` 抬到 `z-index: 3`。

2. **不做 `position:fixed`。** 配套博客顶栏是 fixed 的，但 Ech0 自己顶上
   已经有一个 sticky 的 `.home-header` 了，再来一个 fixed 的会直接压在一起。
   放在正常文档流里把 `#app` 往下挤，最稳。

3. **侧栏当前项只能点 `--active` 修饰类。** Ech0 给四个导航项**都**挂了
   `router-link-active` / `router-link-exact-active`，按那个写会把四项全点亮。

### 主题为什么被「接管」

Ech0 原生是 **三态循环**：`light → sunny → dark → light`。而这里只有明暗两套
（`sunny` 在 CSS 里被归到了亮色那套），照原样点就会出现「点一下没反应」的
中间态。所以 `custom.js` 直接接管了主题按钮：自己写 class 和 `localStorage`，
绕过它那个 store —— 存进去的仍是 `themeMode` 这个 key，所以刷新后
Ech0 读到的就是我们设的那套。

代价写在代码注释里了：store 里的内存态会和 DOM 不同步。但因为所有点击都被
拦下了，它的 `toggleTheme` 永远不会再跑，所以不会打架。
如果哪天 Ech0 改了按钮的 `aria-label`，这段会静默失效并退回原生三态 ——
不会坏，只是多一个空档。

---

## 部署套件

`deploy/` 下三个文件，**都是可选的**，都用 `__占位符__`，用之前全局替换。

### `nginx.conf.example` —— 改写加载页

解决的是一件 `custom_css` 够不着的事：Ech0 的加载页写死在 `web/index.html`
里，被 `//go:embed` 烘进了二进制；它的样式也是那段内联 `<style>`，
所以**第一帧**画出来就是它。而自定义 CSS/JS 要等 Vue 挂载之后才注入 ——
改不到第一帧。只有在 HTML 出站之前动手。

用 nginx 的 `sub_filter` 做三处替换：加载页内容、加载页样式、`<title>`。

文件里记了几条踩过的坑，最重要的一条是：

> **`proxy_set_header` 不跨层级合并。** 只要某个 `location` 里出现了任意一条
> `proxy_set_header`，server 级别的那一组就**整组失效**、不再继承 ——
> `Host` / `X-Real-IP` 全没了，上游拿到的是错的 Host，表现得很像
> 「sub_filter 没生效」，其实是这里。

需要 nginx 编译了 `http_sub_module`（Debian/Ubuntu 官方包和 `nginx:alpine`
都自带）。

### `worker.js` —— 同一件事的 Cloudflare 版

用 `HTMLRewriter` 在边缘改写，功能比 nginx 那份还多一点（顺带改
`og:title` / `theme-color` / Atom 标题）。**和 nginx 那份二选一，别同时上**
（会各改一遍）。

### `ech0.service` —— systemd 单元模板

一个跑在非特权用户下、带 systemd 加固的单元文件
（`ProtectSystem=strict` + `ReadWritePaths`、`CapabilityBoundingSet=` 清空等）。

里面特别写了一条：**别指望用 `IPAddressDeny` / `IPAddressAllow` 来封端口** ——
那会把本机回源（`nginx -> 127.0.0.1:6277`）一起弄坏。Ech0 默认绑**所有网卡**，
封端口是防火墙/安全组的活。

---

## 已知限制

- **只对 Ech0 v5.7.0 验证过。** 主题大量依赖 Ech0 的类名和 CSS 变量。
  Ech0 升级后如果改了变量名，部分样式会静默失效（不会把站弄坏，
  只是变回原版配色）。`tail.css` 第 3 节往后的类名都是语义化的、
  不带 scoped 的 `data-v` 哈希，所以那部分相对抗升级。
- **Ech0 只有明暗两态可用。** 它的 `sunny` 主题被归到了亮色那套，
  想要第三套配色得改 `build.py` 的 `PALETTE`。
- **粒子壁纸是 iframe，不是 canvas。** 好处是跟主站完全隔离、零耦合；
  代价是每个页面多一个跨源请求，以及上面说的那个 `z-index` 坑。
  不想要就配 `particleUrl: ''`。
- **`extras/bg-particle/index.html` 里有一处 `img/github.svg` 的引用**，
  那个文件不在仓库里。粒子形状配的是 `circle`，这条分支永远不会走到，
  留着只是因为它是上游模板的原样。
- **字体只带了拉丁字形。** Oswald 和 Courier Prime 都没有汉字，
  中文会掉到系统字体 —— 这是设计如此（见[三档字体](#三档字体)）。

---

## 合规

本仓库以 **AGPL-3.0-or-later** 发布（见 [LICENSE](LICENSE)）。
选它而不是 MIT，是因为它是专为 Ech0 写的衍生作品，跟上游一致最省事。

AGPL §13 要求：**通过网络与它交互的用户，必须能拿到对应源码。**
跑这套主题对外提供服务的人，需要提供一个源码链接。两种做法：

1. 在页脚加一条很轻的链接指向你这份主题的仓库；
2. 确保站上有一个显眼的「源码 / Source」入口。

> 顺带说一句：Ech0 主页右下角那行 `version: x.y.z` 是它**唯一**一条指向上游的
> 链接。主题里把它藏掉了（`tail.css` 第 8 节，那行太出戏），所以如果你也
> 藏了它，记得在别处把源码入口补回来。

`NOTICE` 里有完整的修改声明（§5(a) 要求）和第三方组件清单。

---

## 许可与致谢

- 本仓库：**AGPL-3.0-or-later**
- [Ech0](https://github.com/lin-snow/Ech0) — L1nSn0w and contributors，AGPL-3.0
- 玻璃配方来自 [liquid-glasses-template-for-blog](https://github.com/yahoofunny/liquid-glasses-template-for-blog)
- Oswald / Courier Prime — SIL OFL 1.1（[fonts/](fonts/)）
- particles.js — Vincent Garreau，MIT
- 加载页那个转圈图标 — EOS Icons（SUSE UX/UI team），MIT

作者：[@yahoofunny](https://github.com/yahoofunny) ·
线上实例：[mome.bingtao.xyz](https://mome.bingtao.xyz)
