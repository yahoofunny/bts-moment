/**
 * Cloudflare Worker —— HTML 改写层
 *
 * 和 deploy/nginx.conf.example 是同一件事的两种做法：那份靠 nginx 的 sub_filter，
 * 这份靠 Cloudflare 边缘的 HTMLRewriter。二选一即可，别同时上（会各改一遍）。
 *
 * 为什么需要它：加载页（笑脸 + "Ech0" / "静候灵感落笔"）写死在 Ech0 的
 * web/index.html 里，被 //go:embed 烘进了 Go 二进制；它的样式也是 index.html
 * 里的那段内联 <style>，所以第一帧就画好了。而 Ech0 的 custom_css / custom_js
 * 要等 Vue 挂载之后才注入 —— 够不着。只有在 HTML 到达浏览器之前改写才行。
 *
 * 部署方式：Workers Routes，绑到 __DOMAIN__/*。
 *   路由优先于隧道回源，所以 cloudflared 那边不用动。
 *   兜底很干净：Worker 出任何问题，删掉这条路由即可，源站从没被碰过。
 *
 * ---------------------------------------------------------------------------
 * 占位符：
 *   __SITE_NAME__   站名。会写进 <title>、og:title、加载页大字里。
 *   __DOMAIN__      你的站点域名，只出现在上面的路由说明里，代码里不用改。
 *                   路由是配在 Cloudflare 面板/wrangler 里的，不写在本文件里。
 *   __ECH0_ORIGIN__ 只有把 Worker 挂在 workers.dev（而不是自己域名的路由）上时
 *                   才需要：那时 fetch(request) 没有源站可回，得写死回源地址。
 *                   见下面 fetch 里的 NOTE。
 * ---------------------------------------------------------------------------
 */

const NAME = '__SITE_NAME__';
const PAPER = '#0e0e13'; // 主题暗色的底色（--color-bg-canvas 那类变量）
const BLUE = '#6e6eff'; //  主题暗色的主色

/* EOS Icons 的 loading 8 点转圈。
   注意：圆圈用 SMIL <animate>，必须内联成 <svg> 元素才动 —— 塞进
   CSS background-image / <img> 里动画会失效，所以走 setInnerContent。 */
const SPINNER = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><!-- Icon from EOS Icons by SUSE UX/UI team - https://gitlab.com/SUSE-UIUX/eos-icons/-/blob/master/LICENSE --><circle cx="12" cy="2" r="0" fill="currentColor"><animate attributeName="r" begin="0" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(45 12 12)"><animate attributeName="r" begin="0.125s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(90 12 12)"><animate attributeName="r" begin="0.25s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(135 12 12)"><animate attributeName="r" begin="0.375s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(180 12 12)"><animate attributeName="r" begin="0.5s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(225 12 12)"><animate attributeName="r" begin="0.625s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(270 12 12)"><animate attributeName="r" begin="0.75s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="2" r="0" fill="currentColor" transform="rotate(315 12 12)"><animate attributeName="r" begin="0.875s" calcMode="spline" dur="1s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle></svg>`;

/* 加载页新内容。类名全部用 ech0-loader__ 前缀，跟 index.html 里原有的
   .loader-shell / .loader-widget-smile / .loader-brand 规则互不干扰。
   规则本身随便取名，只要不和你自己已有的自定义样式撞车。 */
const LOADER_HTML = `
  <div class="ech0-loader">
    <div class="ech0-loader__spin">${SPINNER}</div>
    <div class="ech0-loader__brand">${NAME}</div>
  </div>`;

const LOADER_CSS = `<style id="ech0-loader-style">
/* 盖掉 index.html 里那段内联 <style>：奶油色径向渐变 + 网格纹理。
   这条 background 也是「暗色第一帧」的来源 —— 粒子壁纸是 custom_js 注入的
   跨域 iframe，等 JS 跑起来才出现，第一帧只能靠这里的底色。 */
#app-loader {
  background: ${PAPER} !important;
  color: ${BLUE};
  transition: opacity .34s ease, visibility .34s ease;
}
#app-loader::before { display: none !important; }

#app-loader .ech0-loader {
  display: grid;
  justify-items: center;
  gap: 20px;
}
#app-loader .ech0-loader__spin {
  color: ${BLUE};
  line-height: 0;
  filter: drop-shadow(0 0 14px rgba(110, 110, 255, .5));
  animation: ech0-loader-in .6s ease-out both;
}
#app-loader .ech0-loader__brand {
  font-family: "Oswald", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-weight: 600;
  font-size: 20px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: .34em;
  text-indent: .34em;          /* 补齐 letter-spacing 在末尾多出的一格，保证视觉居中 */
  color: #f0f0f2;              /* 主题暗色的文字色变量 */
  animation: ech0-loader-in .7s .08s ease-out both;
}
@keyframes ech0-loader-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  #app-loader .ech0-loader__spin, #app-loader .ech0-loader__brand { animation: none; }
}
</style>`;

export default {
  async fetch(request) {
    // 挂在自定义域名的 Route 上时，fetch(request) 会照常回源（走你的隧道/源站），
    // 不需要写死地址。
    //
    // NOTE：如果是把 Worker 部署在 workers.dev 上（没有绑自己域名的路由），
    //   这里就没有源站可回，得改成显式回源，例如：
    //     const u = new URL(request.url);
    //     const res = await fetch('__ECH0_ORIGIN__' + u.pathname + u.search, request);
    const res = await fetch(request);

    // 只碰 HTML，资源和 API 原样放行
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res;

    return (
      new HTMLRewriter()
        // 1. 加载页样式（追加到 </head> 前，晚于 index.html 自己的 <style>，
        //    同优先级下靠后者胜）。只加样式，#app-loader 元素本身必须留着 ——
        //    Ech0 的淡出逻辑（startLoaderFade）靠它找元素，删了加载页就不会消失。
        .on('head', {
          element(el) {
            el.append(LOADER_CSS, { html: true });
          },
        })
        // 2. 加载页内容。只换 innerHTML，保留 id="app-loader" 本身
        .on('#app-loader', {
          element(el) {
            el.setInnerContent(LOADER_HTML, { html: true });
          },
        })
        // 3. index.html 里写死的那个 "Ech0"（Vue 挂载前标签页显示的就是它）
        .on('title', {
          element(el) {
            el.setInnerContent(NAME);
          },
        })
        .on('meta[property="og:title"]', setContent(NAME))
        .on('meta[property="og:site_name"]', setContent(NAME))
        .on('meta[name="twitter:title"]', setContent(NAME))
        // 4. 主题色：原来是奶油色，改成暗色底，影响手机浏览器地址栏的配色
        .on('meta[name="theme-color"]', setContent(PAPER))
        .on('link[type="application/atom+xml"]', {
          element(el) {
            el.setAttribute('title', NAME + ' Atom Feed');
          },
        })
        .transform(res)
    );
  },
};

function setContent(value) {
  return {
    element(el) {
      el.setAttribute('content', value);
    },
  };
}
