/* ==========================================================================
   bts-moment —— 注入到 Ech0「自定义 JS」里的一段脚本，做五件事：

     0. CONFIG        下面那个配置对象，**你唯一需要改的地方**
     1. 顶栏          吃豆人 + 六栏目 + 语言药丸 + 开关灯（博客 header 的克隆）
                      窄屏（≤900px）六栏目收进汉堡，点开是全屏菜单
     1d. 颜文字模式   药丸第三段，句末标点后随机插一个颜文字（纯显示效果）
     2. 粒子壁纸      和博客 #wm-particle 同款，一个 fixed 的 iframe
     3. 源码入口      侧栏那行 `version: x.y.z` 改指本主题仓库（AGPL §13）
     4. 主题两态化    Ech0 原生是三态循环，这里接管成干净的明暗两态，
                      并把 Ech0 自己的主题键 / 语言键收掉（已被顶栏取代）
     5. en 页面       `?lang=en` 这种链接进来直接落到英文界面

   注入位置：面板 → 系统设置 → 自定义 JS
   样式在 custom.css 里，两边要一起改。

   ⚠️ 时机：脚本是在 Vue 挂载**之后**才被塞进 <head> 的，所以文档流已经
      建好了，可以直接 insertBefore。Ech0 是 SPA，站内跳转不会重新执行
      这个文件，所以下面用 pushState/replaceState 补丁保持高亮同步。
   ========================================================================== */
(function () {
  /* ---------- 0. 配置：唯一需要改的地方 ---------- */
  var CONFIG = {
    // 粒子壁纸的地址。extras/bg-particle/ 就是这个页面，自包含，
    // 整个目录丢到任意静态站点上填这里即可。留空则完全不挂粒子。
    particleUrl: '/bg-particle/index.html',

    // 顶栏六栏目。label 和 href 是**各自独立**的 —— 「Gadgets」指到 /radio/
    // 完全正常（这个标签本来就是个栏目名，不必等于路径）。href 换成你自己
    // 站点的真实路径，同域写 /xxx/，跨域就写完整 URL。
    // 想少放几个直接删行；留空数组 [] 则整个栏目区不出现。
    nav: [
      { label: 'Chat', href: '/chat/' },
      { label: 'Games', href: '/games/' },
      { label: 'Archives', href: '/archives/' },
      { label: 'Mome', href: '/' },
      { label: 'Gadgets', href: '/radio/' },
      { label: 'About', href: '/about/' }
    ],

    // 顶栏左边那个标志，点了回主站首页。icon 换成你自己的图；
    // 留空 icon 则左边整块不放东西（栏目会略微左移，属正常）。
    home: { href: '/', icon: '/pacman.svg' },

    // 右上角开关灯的图标：亮色用 light、暗色用 dark。
    // 两张都应该是**深色**线条图 —— 暗色下脚本会给它加 invert(1) 翻白，
    // 和博客那段 setTheme() 是同一个做法。
    themeIcons: { light: '/off.svg', dark: '/on.svg' },

    // 右上角语言药丸。code 是 Ech0 自己的语言代码，存在 localStorage.locale；
    // name 必须**逐字等于** Ech0 语言菜单里显示的那一项，脚本靠它去点原生菜单
    // （原生菜单被藏起来了，但程序化点击照样生效，而且它是响应式的，
    //  点完界面当场就变、不用刷新）。对不上就退回「写 localStorage + 刷新」。
    locales: [
      { code: 'zh-CN', label: '中', name: '简体中文' },
      { code: 'en-US', label: 'EN', name: 'English' }
    ],

    // 语言药丸的第三段：颜文字。跟博客那边一样 —— **它不是一种语言**，
    // 是在当前语言上叠的一层纯显示效果：句末标点后面随机插一个颜文字。
    // 不改 Ech0 的语言，也不碰任何数据，只动看得见的那层文本。
    //   · 点它 = 开 / 关，状态存在 localStorage.kaomoji（'1' / '0'，与博客同款）
    //   · 点「中」或「EN」会顺手把它关掉（博客也是这个行为）
    // 不想要这一段就把 enabled 改成 false。
    kaomoji: { enabled: true, label: '(´・ω・`)' },

    // 侧栏底部那行 `version: x.y.z` 换成指向**你自己那份主题仓库**的
    // 源码入口（图标 + SOURCE）。位置和元素都不动，只换 href 和内容。
    // 这东西同时就是 AGPL §13 要的「源码可得」入口，跑在公网上就该填上。
    // 留空字符串则整行藏掉 —— 也就是不启用这个功能。
    sourceUrl: '',

    // 首次访问落到哪套主题：'dark' 或 'light'
    defaultTheme: 'dark'
  }

  var THEMES = ['light', 'sunny', 'dark']

  function read(k) {
    try { return localStorage.getItem(k) } catch (e) { return null }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {}
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  /* ---------- 1. 顶栏 ---------- */
  function norm(p) {
    return (p || '/').replace(/\/+$/, '') || '/'
  }

  function isCurrent(href, here) {
    var p
    try {
      var u = new URL(href, location.origin)
      // 跨域链接永远不高亮 —— 我们无从知道对方站点当前停在哪一页。
      // （本站的栏目大多指向外面那个博客，不排掉的话它们会靠 pathname
      //   偶然对上，行为就成了碰运气。）
      if (u.origin !== location.origin) return false
      p = norm(u.pathname)
    } catch (e) {
      p = norm(href)
    }
    if (p === here) return true
    // 前缀也算命中：/archives/ 在 /archives/2026/xx 下仍高亮。
    // '/' 例外 —— 它对任何路径都是前缀，只认精确匹配。
    return p !== '/' && here.indexOf(p + '/') === 0
  }

  function mountNav() {
    if (document.getElementById('bt-nav')) return
    if (!document.body) return
    var nav = document.createElement('nav')
    nav.id = 'bt-nav'
    nav.setAttribute('aria-label', 'site')

    if (CONFIG.home && CONFIG.home.icon) {
      var home = el('a', 'bt-home')
      home.href = CONFIG.home.href || '/'
      var img = document.createElement('img')
      img.src = CONFIG.home.icon
      img.alt = 'home'
      img.width = 28
      img.height = 28
      home.appendChild(img)
      nav.appendChild(home)
    }

    if (CONFIG.nav && CONFIG.nav.length) {
      var links = el('div', 'bt-links')
      CONFIG.nav.forEach(function (item) {
        var a = el('a', null, item.label)
        a.href = item.href
        links.appendChild(a)
      })
      nav.appendChild(links)
    }

    var right = el('div', 'bt-right')
    mountLang(right)
    mountTheme(right)

    // 汉堡键。宽屏下 CSS 里是 display:none，只是把节点先放好。
    if (CONFIG.nav && CONFIG.nav.length) {
      var burger = el('button', 'bt-burger')
      burger.type = 'button'
      burger.setAttribute('aria-label', '菜单 / menu')
      burger.setAttribute('aria-expanded', 'false')
      for (var k = 0; k < 3; k++) burger.appendChild(el('span'))
      burger.addEventListener('click', function () {
        setMenu(!isMenuOpen())
      })
      right.appendChild(burger)
    }

    if (right.childNodes.length) nav.appendChild(right)

    // 放在 <body> 的第一个子节点。CSS 里是 position:sticky，所以它既常驻
    // 顶部、又仍在文档流里（不用给 #app 补 padding，也不会盖住浮层）。
    document.body.insertBefore(nav, document.body.firstChild)
    syncNav()
  }

  /* ---------- 1a. 窄屏的全屏菜单 ----------
     跟博客的 #mobile-menu 是同一套东西：fixed 铺满一屏、居中竖排、
     点条目就关。区别只在于博客拿 <label for="menu-toggle"> + :checked
     做纯 CSS 开关（它没有 JS 环境），我们是注入的脚本，直接用 class。 */
  function mountMenu() {
    if (document.getElementById('bt-menu')) return
    if (!CONFIG.nav || !CONFIG.nav.length) return
    if (!document.body) return
    var m = el('div', null)
    m.id = 'bt-menu'
    CONFIG.nav.forEach(function (item) {
      var a = el('a', null, item.label)
      a.href = item.href
      // 站内跳转是 SPA，不刷新页面 —— 菜单得自己收起来，
      // 否则覆盖层会一直压在刚换出来的那一页上面。
      a.addEventListener('click', function () { setMenu(false) })
      m.appendChild(a)
    })
    document.body.appendChild(m)
    syncNav()
  }

  function isMenuOpen() {
    var m = document.getElementById('bt-menu')
    return !!(m && m.classList.contains('bt-open'))
  }

  function setMenu(open) {
    var m = document.getElementById('bt-menu')
    var b = document.querySelector('#bt-nav .bt-burger')
    if (!m || !b) return
    m.classList.toggle('bt-open', open)
    b.classList.toggle('bt-open', open)
    b.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  // SPA 站内跳转不重新加载，高亮得自己跟着走。
  function syncNav() {
    var nav = document.getElementById('bt-nav')
    if (!nav) return
    var here = norm(location.pathname)
    // 顶栏里那六个和全屏菜单里那六个是同一批链接，两边都要跟着高亮。
    var links = document.querySelectorAll('#bt-nav .bt-links a, #bt-menu a')
    for (var i = 0; i < links.length; i++) {
      if (isCurrent(links[i].getAttribute('href'), here)) {
        links[i].setAttribute('aria-current', 'page')
      } else {
        links[i].removeAttribute('aria-current')
      }
    }
  }

  // 劫持 pushState/replaceState 是最省事的办法：不用轮询，
  // 也不用猜 Ech0 的路由实现。
  function patchHistory() {
    if (window.__btHistoryPatched) return
    window.__btHistoryPatched = true
    ;['pushState', 'replaceState'].forEach(function (name) {
      var orig = history[name]
      history[name] = function () {
        var r = orig.apply(this, arguments)
        try { syncNav() } catch (e) {}
        return r
      }
    })
    window.addEventListener('popstate', function () {
      try { syncNav() } catch (e) {}
    })
  }

  /* ---------- 1b. 开关灯 ---------- */
  function mountTheme(box) {
    if (!CONFIG.themeIcons || !CONFIG.themeIcons.light) return
    var b = el('button', 'bt-theme')
    b.type = 'button'
    b.id = 'bt-theme'
    b.setAttribute('aria-label', '切换主题 / toggle theme')
    var img = document.createElement('img')
    img.id = 'bt-theme-icon'
    img.alt = ''
    img.width = 20
    img.height = 20
    b.appendChild(img)
    b.addEventListener('click', function () {
      apply(current() === 'dark' ? 'light' : 'dark')
      paintTheme()
    })
    box.appendChild(b)
    paintTheme()
  }

  // 图标和滤镜跟着当前主题走 —— 等价于博客那段 setTheme() 里的两行。
  // 只在真的变了才写 DOM：watchDom 会反复调它，无脑写会自己触发自己。
  function paintTheme() {
    var img = document.getElementById('bt-theme-icon')
    if (!img || !CONFIG.themeIcons) return
    var dark = current() === 'dark'
    var src = dark ? CONFIG.themeIcons.dark : CONFIG.themeIcons.light
    var flt = dark ? 'invert(1)' : 'none'
    if (img.getAttribute('src') !== src) img.src = src
    if (img.style.filter !== flt) img.style.filter = flt
  }

  /* ---------- 1c. 语言药丸 ---------- */
  // Ech0 把语言存在 localStorage.locale，值是 **JSON 字符串**（带引号）。
  function storedLocale() {
    var raw = read('locale')
    if (!raw) return null
    try { return JSON.parse(raw) } catch (e) { return null }
  }

  function mountLang(box) {
    if (!CONFIG.locales || CONFIG.locales.length < 2) return
    var wrap = el('div', 'bt-lang')
    wrap.setAttribute('role', 'group')
    wrap.setAttribute('aria-label', 'Language / 语言')
    CONFIG.locales.forEach(function (loc) {
      var b = el('button', null, loc.label)
      b.type = 'button'
      b.setAttribute('data-locale', loc.code)
      b.title = loc.name
      b.addEventListener('click', function () {
        // 博客那边点「中」/「EN」也会把颜文字关掉，这里保持一致。
        setKao(false)
        switchLocale(loc)
      })
      wrap.appendChild(b)
    })
    // 第三段：颜文字。注意它**没有 data-locale** —— 它不是一种语言，
    // 是叠在当前语言上的显示效果（见下面 1d 那段）。
    if (CONFIG.kaomoji && CONFIG.kaomoji.enabled) {
      var k = el('button', 'bt-kao', CONFIG.kaomoji.label)
      k.type = 'button'
      k.title = '颜文字 / Kaomoji'
      k.addEventListener('click', function () { setKao(!kaoOn()) })
      wrap.appendChild(k)
    }
    box.appendChild(wrap)
    paintLang()
  }

  function paintLang() {
    var cur = storedLocale()
    var on = kaoOn()
    var bs = document.querySelectorAll('#bt-nav .bt-lang button')
    for (var i = 0; i < bs.length; i++) {
      // 颜文字那段没有 data-locale：它按下 = 颜文字开着；
      // 语言那两段在颜文字开着时**都不亮**（任何时刻只有一个亮着）。
      var code = bs[i].getAttribute('data-locale')
      var pressed = code ? (!on && code === cur) : on
      var v = pressed ? 'true' : 'false'
      if (bs[i].getAttribute('aria-pressed') !== v) {
        bs[i].setAttribute('aria-pressed', v)
      }
    }
  }

  // 优先借 Ech0 自己的菜单项：它是响应式的，点完界面**当场**就变、不用刷新。
  // 原生菜单虽然被 hideNativeControls 藏了，但节点还在，程序化 click 照样
  // 触发 Vue 的监听。菜单项身上没有语言代码属性（只有文案和 aria-checked），
  // 所以只能按 CONFIG.locales[].name 的文案去认 —— 认不出来就退回下面那条。
  function switchLocale(loc) {
    if (storedLocale() === loc.code) return
    var trigger = document.querySelector('.locale-toggle__trigger')
    if (trigger) {
      trigger.click()
      // floating-vue 是异步挂 popper 的，等一帧再找菜单项
      requestAnimationFrame(function () {
        setTimeout(function () {
          var items = document.querySelectorAll('.locale-toggle__item')
          for (var i = 0; i < items.length; i++) {
            if ((items[i].innerText || '').indexOf(loc.name) >= 0) {
              items[i].click()
              setTimeout(paintLang, 300)
              return
            }
          }
          fallbackLocale(loc.code)
        }, 0)
      })
    } else {
      fallbackLocale(loc.code)
    }
  }

  // 慢一点（整页刷新），但一定成。Ech0 开机时读的就是这个 key。
  function fallbackLocale(code) {
    write('locale', code)
    location.reload()
  }

  /* ---------- 1d. 颜文字模式 ----------
     效果抄自博客 src/layouts/Base.astro 里那段 _applyKao()：**不是一种语言**，
     是在当前语言上叠的一层纯显示效果 —— 每个句末标点后面随机插一个颜文字。
     （博客的 i18n 注释里写得很清楚：「颜文字模式不是独立语言，是在当前语言上
       叠加的显示效果」。）这里只动 DOM 里的文本节点，不改 Ech0 的语言，
     也不碰任何数据。

     ⚠️ 跟博客那段有**两个必须不同的地方**，都是 Ech0 是 SPA 导致的：

     1. **得盯着 DOM。** 博客是静态站，DOMContentLoaded 时跑一遍就完了；
        Ech0 往下滚会不断渲染出新的 echo，那些文本节点当时还不存在。
        所以多挂了一个 MutationObserver 给新来的补刀 —— 见 kaoWatch()。

     2. **观察器和写入必须互斥。** 我们自己改文本也会触发 characterData，
        不隔开就是自己触发自己、无限循环。kaoApply() 的做法是
        「先断开 → 写 → 再挂上」。副产品是：观察器**只要还挂着**，
        看见的变更就**一定不是我们写的**，可以放心当成「Vue 重渲染了」。

     ⚠️ 每个节点只插一次（__btKaoDone）。不然后台每来一条新 echo，
        kaoApply 会重走整棵树，把已经插好的颜文字全部换掉 —— 随机值一变，
        满屏颜文字当场跳一下，很难看。 */
  var KAO = [
    '(´・ω・`)', '(◕‿◕)', '(｡･ω･｡)', '(≧∇≦)', '(๑•̀ㅂ•́)و✧', '(◍•ᴗ•◍)',
    '(╯°□°）╯︵┻━┻', '┐(´д`)┌', '(￣▽￣)ノ', '(✿◠‿◠)', '(´▽`)ﾉ', '(・∀・)',
    '(◕ᴗ◕✿)', '(｡•̀ᴗ-)✧', '(◔‿◔)', '(─‿‿─)', '(人◕ω◕)', '(づ｡◕‿‿◕｡)づ',
    '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧'
  ]
  // 逐字照抄博客那行：中日文句末标点 + 英文的 . ! ? ;
  var KAO_MARK = /([。！？；…\.\!\?\;])/g

  // ⚠️ 一整块「没有空格、又全是 ASCII」的文本 = 标识符，不是句子：
  //    域名（bingtao.xyz）、URL、文件名、版本号。它们里面那个 `.` 不是句号，
  //    插进去会把 bingtao.xyz 劈成 `bingtao. (・∀・) xyz` —— 链接卡片上真踩过。
  //    中文正文不会命中：中文句号是全角「。」，而且中文本身不是 ASCII。
  //    英文整句（`Hello, world.`）有空格，也照插不误。
  var KAO_TOKEN = /^[\x21-\x7e]+$/

  // 不插的地方：我们自己的顶栏和菜单、Ech0 自己的头部和侧栏、按钮和输入框、
  // 脚本样式和图标。Ech0 的浮层（语言菜单、搜索面板）也排掉。
  // 博客那份黑名单里还有 chat / 桌宠几项，这边没有对应的东西。
  var KAO_SKIP = '#bt-nav, #bt-menu, script, style, noscript, svg, input, ' +
    'textarea, select, button, .locale-toggle, .home-header, .home-aside, ' +
    '.bt-native, .v-popper__popper'

  // 这个 key 跟博客是同一个、取值也同一套（'1' / '0'）。
  // ⚠️ 不能走上面那对 read/write —— 它们会 JSON.stringify，存进去的是带引号的
  //    `"1"`，跟博客对不上。
  function readRaw(k) {
    try { return localStorage.getItem(k) } catch (e) { return null }
  }
  function writeRaw(k, v) {
    try { localStorage.setItem(k, v) } catch (e) {}
  }

  function kaoOn() { return readRaw('kaomoji') === '1' }

  function kaoMark(t) {
    return t.replace(KAO_MARK, function (m) {
      return m + ' ' + KAO[Math.floor(Math.random() * KAO.length)] + ' '
    })
  }

  function kaoWalk(root, fn) {
    if (!root || typeof document.createTreeWalker !== 'function') return
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false)
    var n
    while ((n = w.nextNode())) {
      var p = n.parentElement
      if (!p || p.closest(KAO_SKIP)) continue
      if (!n.nodeValue || !n.nodeValue.trim()) continue
      if (KAO_TOKEN.test(n.nodeValue.trim())) continue
      fn(n)
    }
  }

  var kaoObs = null

  function kaoApply(on) {
    kaoStop()                       // 先摘掉观察器，免得看见自己写的（见上面 ⚠️2）
    try {
      kaoWalk(document.body, function (n) {
        if (on) {
          // 第一次碰它就把原文留底。之后每次插都从原文重来 ——
          // 直接往插过的文本上再插会滚雪球。
          if (n.__btKao == null) { n.__btKao = n.nodeValue; n.__btKaoDone = false }
          if (n.__btKaoDone) return
          n.nodeValue = kaoMark(n.__btKao)
          n.__btKaoDone = true
        } else if (n.__btKao != null) {
          n.nodeValue = n.__btKao   // 还原
          n.__btKao = null
          n.__btKaoDone = false
        }
      })
    } finally {
      if (on) kaoWatch()
    }
    paintLang()
  }

  function kaoWatch() {
    if (kaoObs || typeof MutationObserver === 'undefined' || !document.body) return
    kaoObs = new MutationObserver(function (muts) {
      if (!kaoOn()) return
      var dirty = false
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i]
        if (m.type === 'characterData') {
          // Vue 把这个节点的文字换掉了 —— 留底作废，以新文字为准重插。
          m.target.__btKao = null
          m.target.__btKaoDone = false
          dirty = true
        } else if (m.addedNodes && m.addedNodes.length) {
          dirty = true
        }
      }
      if (dirty) kaoQueue()
    })
    kaoObs.observe(document.body, { childList: true, subtree: true, characterData: true })
  }

  function kaoStop() {
    if (kaoObs) { kaoObs.disconnect(); kaoObs = null }
  }

  // 一帧里来一堆变动只补一次。铺开滚到底会连续插进来几十条 echo。
  var kaoQueued = false
  function kaoQueue() {
    if (kaoQueued) return
    kaoQueued = true
    requestAnimationFrame(function () {
      kaoQueued = false
      kaoApply(true)
    })
  }

  function setKao(on) {
    writeRaw('kaomoji', on ? '1' : '0')
    kaoApply(on)
  }

  /* ---------- 2. 粒子壁纸 ---------- */
  // ⚠️ 不要加 loading="lazy"：亮色下这个 iframe 是 display:none 的，
  //    懒加载会一直不触发，切到暗色时就是一片空的。
  function mountParticle() {
    if (!CONFIG.particleUrl) return
    if (document.getElementById('wm-particle')) return
    if (!document.body) return
    var f = document.createElement('iframe')
    f.id = 'wm-particle'
    f.src = CONFIG.particleUrl
    f.title = ''
    f.setAttribute('aria-hidden', 'true')
    f.setAttribute('tabindex', '-1')
    document.body.appendChild(f)
  }

  /* ---------- 3. 源码入口 ---------- */
  // 侧栏底部原来那行 `version: x.y.z`，是 Ech0 唯一一条指向上游的链接。
  // 这里把它改指到本主题的仓库 —— 见 custom.css 第 8 节里那段解释。
  // 图标是 Material Design Icons 的 github（Pictogrammers，Apache-2.0），
  // 署名在仓库的 NOTICE 里。
  var ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/>' +
    '</svg>'

  // 幂等：改过就撤。Vue 重建这个节点之后会退回原样，所以还会被再调 —— 见 watchDom。
  //
  // ⚠️ 判据**不能只看那个 class**。线上实测：Vue 是**异步**把这行的文字
  //    补上去的（`version: 5.7.0` 里那个版本号要等数据回来），
  //    流程是「元素建好 → 我们注入（href/class/内容一起设）→ Vue 补文字」。
  //    那一补只重置**内容**，class 和 href 都留着 —— 于是按 class 判的幂等
  //    会把 watchDom 送来的修复也一起挡掉，现象就是
  //    **href 已经指向主题仓库了，文字还写着 version: 5.7.0**。
  //    所以判据换成「内容里那张图标还在不在」：Vue 一覆盖它就没，下一次
  //    DOM 变动（watchDom 在看）就能补回来。其余几行每次都写，反正无副作用。
  function mountSource() {
    if (!CONFIG.sourceUrl) return
    var a = document.querySelector('.home-aside__version')
    if (!a) return
    a.href = CONFIG.sourceUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.classList.add('bt-source')
    if (!a.querySelector('svg')) a.innerHTML = ICON + '<span>source</span>'
  }

  /* ---------- 4. 收掉 Ech0 原生的主题键和语言键 ---------- */
  // 它们已经被顶栏那套取代了。**不能按类名一刀切** ——
  // `.home-header__link-icon` 是个通用类名，RSS / 禅模式 / 主题 / 登录
  // 四个按钮都挂着它，按它藏会连带干掉三个不相干的。
  // 所以这里逐个认出来打上 .bt-native，再由 CSS 收掉；认不出来就不动
  // （换语言或改版之后优雅退化，顶多和顶栏重复一次，不会坏）。
  function hideNativeControls() {
    var i, n

    // 语言：类名是它专用的，安全。
    n = document.querySelectorAll('.locale-toggle')
    for (i = 0; i < n.length; i++) n[i].classList.add('bt-native')

    // 主题：只能靠 aria-label。中文「切换主题（下一个：浅色）」、
    // 英文「Switch theme (next: ...)」，两种都盖住。
    // ⚠️ 只看元素**自己**的 label，不能用 isThemeButton 那种往上找的写法 ——
    //    那会把顶栏里我们自己的按钮也算进来。
    n = document.querySelectorAll('.home-header__link-icon, .echo-header-sticky button')
    for (i = 0; i < n.length; i++) {
      var l = (n[i].getAttribute('aria-label') || '').toLowerCase()
      if (l.indexOf('切换主题') >= 0 || l.indexOf('theme') >= 0) {
        n[i].classList.add('bt-native')
      }
    }
  }

  /* ---------- 5. 主题接管成两态 ---------- */
  // Ech0 原生是 light → sunny → dark 三态循环，而 CSS 里 sunny 和 light
  // 归到了同一套，照原样点就会出现「点一下没反应」的中间态。这里自己写
  // class 和 localStorage，绕过它那个 store —— 存进去的仍是 themeMode
  // 这个 key，所以刷新后 Ech0 自己读到的就是我们设的那套。
  // ⚠️ 代价：store 里的内存态会和 DOM 不同步，但因为它的 toggleTheme 永远不会
  //    再跑，所以不会打架。
  //
  // 现在的分工是两层：
  //   · 正常情况：原生那个按钮被 hideNativeControls() 打上 .bt-native 藏掉了，
  //     用户点的是顶栏里我们自己画的开关（paintTheme 负责图标）。
  //   · 兜底：hijack 这个是 document 级 capture 监听，**一直都在**。
  //     哪天 Ech0 改了 aria-label、hideNativeControls() 认不出没藏住，
  //     那个按钮就会露出来 —— 这时 hijack 拦下它，让它至少是个两态开关，
  //     而不是点一下卡在没反应的 sunny 上。relabel() 同理，只服务这条兜底路径。
  function apply(mode) {
    var el = document.documentElement
    for (var i = 0; i < THEMES.length; i++) el.classList.remove(THEMES[i])
    el.classList.add(mode)
    write('themeMode', mode)
  }

  function current() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  }

  function isThemeButton(el) {
    // 顶栏里我们自己那个按钮的 aria-label 也含 "theme"，别被自己截胡 ——
    // 那个按钮有独立的监听，被这里 stopPropagation 掉图标就不跟着换了。
    if (el && el.closest && el.closest('#bt-nav')) return false
    while (el && el.getAttribute) {
      var label = el.getAttribute('aria-label')
      if (label) {
        var l = label.toLowerCase()
        if (label.indexOf('主题') >= 0 || l.indexOf('theme') >= 0 ||
            l.indexOf('dark mode') >= 0) return true
      }
      el = el.parentNode
    }
    return false
  }

  // 按钮的 tooltip 是「切换主题（下一个：浅色）」这种，跟着 store 走。
  // 既然点击被我们截胡了，store 不会再动，label 就会一直停在旧值上 ——
  // 自己补一下。只认中文那套写法，认不出就不动（换语言时优雅退化）。
  function relabel() {
    var b = document.querySelector('.home-header__link-icon[aria-label*="下一个"]')
    if (!b) return
    b.setAttribute('aria-label',
      '切换主题（下一个：' + (current() === 'dark' ? '浅色' : '暗色') + '）')
  }

  function hijack(e) {
    if (!isThemeButton(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    apply(current() === 'dark' ? 'light' : 'dark')
    paintTheme()
    relabel()
  }

  /* ---------- 6. en 页面 ---------- */
  // `?lang=en` / `?lang=zh` 这类链接进来直接落到对应语言，于是「mome 的英文页」
  // 是一个可分享的地址。Ech0 自己只有 localStorage 一个开关，没有语言路由
  // （/en/ 是 404），所以只能这样做。
  // ⚠️ 先把参数从地址栏抹掉再刷新，否则刷新后又被处理一遍，来回死循环。
  var LANG_ALIAS = { zh: 'zh-CN', 'zh-cn': 'zh-CN', en: 'en-US', 'en-us': 'en-US' }

  function applyLangParam() {
    var m = /[?&]lang=([A-Za-z-]+)/.exec(location.search)
    if (!m) return
    var code = LANG_ALIAS[m[1].toLowerCase()]
    // 认不出来的值：只把参数抹掉，不改语言（别拿它去写 localStorage）
    var clean = location.pathname +
      location.search.replace(/([?&])lang=[^&]*/, '$1').replace(/[?&]$/, '').replace(/\?&/, '?') +
      location.hash
    history.replaceState(null, '', clean)
    if (!code || storedLocale() === code) return
    write('locale', code)
    location.reload()
  }

  /* ---------- 启动 ---------- */
  applyLangParam()

  // 首次访问落到 defaultTheme。
  // 真正「第一帧就是默认色」要靠 nginx/Worker 在 </head> 前塞的那行内联脚本
  // （见 deploy/），这里兜底：万一那层没生效，也只是闪一下。
  if (read('themeMode') === null) apply(CONFIG.defaultTheme)

  mountNav()
  mountMenu()
  mountParticle()
  mountSource()
  hideNativeControls()
  watchDom()
  patchHistory()

  // 颜文字是记在 localStorage 里的，开着就直接生效。
  // 此刻 feed 可能还没渲染出来 —— 没关系，kaoWatch() 会盯住后到的。
  if (kaoOn()) kaoApply(true)

  // 全屏菜单的两个出口：Esc，以及转回宽屏（菜单只在窄屏能开，
  // 但竖屏横过来就可能越过 900px，不收起来会一直盖着）。
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isMenuOpen()) setMenu(false)
  })
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900 && isMenuOpen()) setMenu(false)
  })

  // 刚注入时头部可能还没渲染完，Vue 随后那一 patch 会把 label 改回它自己的，
  // 所以多点几次
  ;[0, 400, 1200, 2500].forEach(function (t) { setTimeout(relabel, t) })
  document.addEventListener('click', hijack, true)

  // 这几个节点的归属都不稳：`.home-aside__version` 和整个头部都是 Vue 渲染的
  // （带 scoped 的 data-v 属性），HomeView 重建时会连 href 带类名一起恢复成
  // 原版；SPA 换路由也可能整块重渲染。所以不能只改一次，得盯着。
  // 观察整个 body 是因为节点出现和重建的时机都不确定；回调里只有几个
  // querySelector，并且用 rAF 把一帧内的多次变更压成一次，开销可以忽略。
  // 不会自激：下面每个函数写 DOM 前都先比过，已经是目标状态就直接返回。
  function watchDom() {
    if (!document.body || typeof MutationObserver === 'undefined') return
    var queued = false
    new MutationObserver(function () {
      if (queued) return
      queued = true
      requestAnimationFrame(function () {
        queued = false
        mountSource()
        hideNativeControls()
        paintTheme()
        paintLang()
      })
      // characterData 也要看：Vue 补那行文字时，如果它改的是**已有文本节点**
      // 的 data（而不是换掉整个子节点），那就只是 characterData 变动，
      // 只看 childList 会漏掉，mountSource() 也就补不回来。
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  }
})()
