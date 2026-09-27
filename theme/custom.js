/* ==========================================================================
   bts-moment —— 注入到 Ech0「自定义 JS」里的一段脚本，做三件事：

     0. CONFIG        下面那个配置对象，**你唯一需要改的地方**
     1. 顶栏导航      照博客 .nav-link 写的六栏目横条
     2. 粒子壁纸      和博客 #wm-particle 同款，一个 fixed 的 iframe
     3. 主题两态化    Ech0 原生是三态循环，这里接管成干净的明暗两态

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

    // 顶栏六栏目。href 换成**自己站点的真实路径**；
    // 想少放几个就直接删行，留空数组 [] 则整个顶栏不出现。
    nav: [
      { label: 'Chat', href: '/chat/' },
      { label: 'Games', href: '/games/' },
      { label: 'Archives', href: '/archives/' },
      { label: 'Mome', href: '/' },
      { label: 'Gadgets', href: '/gadgets/' },
      { label: 'About', href: '/about/' }
    ],

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

  /* ---------- 1. 顶栏导航 ---------- */
  function norm(p) {
    return (p || '/').replace(/\/+$/, '') || '/'
  }

  function isCurrent(href, here) {
    var p = norm(href)
    if (p === here) return true
    // 前缀也算命中：/archives/ 在 /archives/2026/xx 下仍高亮。
    // '/' 例外 —— 它对任何路径都是前缀，只认精确匹配。
    return p !== '/' && here.indexOf(p + '/') === 0
  }

  function mountNav() {
    if (document.getElementById('bt-nav')) return
    if (!document.body || !CONFIG.nav || !CONFIG.nav.length) return
    var here = norm(location.pathname)
    var nav = document.createElement('nav')
    nav.id = 'bt-nav'
    nav.setAttribute('aria-label', 'site')
    CONFIG.nav.forEach(function (item) {
      var a = document.createElement('a')
      a.textContent = item.label
      a.href = item.href
      if (isCurrent(item.href, here)) a.setAttribute('aria-current', 'page')
      nav.appendChild(a)
    })
    // 放在 <body> 的第一个子节点 → 正常文档流，把 #app 往下挤。
    // 不用 position:fixed —— 那样正文会从它底下穿过去。
    document.body.insertBefore(nav, document.body.firstChild)
  }

  // SPA 站内跳转不重新加载，高亮得自己跟着走。
  function syncNav() {
    var nav = document.getElementById('bt-nav')
    if (!nav) return
    var here = norm(location.pathname)
    var links = nav.getElementsByTagName('a')
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

  /* ---------- 3. 主题接管成两态 ---------- */
  // Ech0 原生是 light → sunny → dark 三态循环，而 CSS 里 sunny 和 light
  // 归到了同一套，照原样点就会出现「点一下没反应」的中间态。这里自己写
  // class 和 localStorage，绕过它那个 store —— 存进去的仍是 themeMode
  // 这个 key，所以刷新后 Ech0 自己读到的就是我们设的那套。
  // ⚠️ 代价：store 里的内存态会和 DOM 不同步，但因为所有点击都被我们拦下了，
  //    它的 toggleTheme 永远不会再跑，所以不会打架。
  //    如果哪天 Ech0 改了按钮的 aria-label，这里会静默失效并退回原生三态 ——
  //    不会坏，只是多一个空档。
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
    var b = document.querySelector('button[aria-label*="下一个"]')
    if (!b) return
    b.setAttribute('aria-label',
      '切换主题（下一个：' + (current() === 'dark' ? '浅色' : '暗色') + '）')
  }

  function hijack(e) {
    if (!isThemeButton(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    apply(current() === 'dark' ? 'light' : 'dark')
    relabel()
  }

  /* ---------- 启动 ---------- */
  // 首次访问落到 defaultTheme。
  // 真正「第一帧就是默认色」要靠 nginx/Worker 在 </head> 前塞的那行内联脚本
  // （见 deploy/），这里兜底：万一那层没生效，也只是闪一下。
  if (read('themeMode') === null) apply(CONFIG.defaultTheme)

  mountNav()
  mountParticle()
  patchHistory()
  // 刚注入时头部可能还没渲染完，Vue 随后那一 patch 会把 label 改回它自己的，
  // 所以多点几次
  ;[0, 400, 1200, 2500].forEach(function (t) { setTimeout(relabel, t) })
  document.addEventListener('click', hijack, true)
})()
