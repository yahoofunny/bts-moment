(function () {
  try { document.title = "loading"; var PAC = "https://bingtao.xyz/pacman.svg"; document.querySelectorAll('link[rel*="icon"]').forEach(function (l) { l.href = PAC; }); var mk = document.createElement("link"); mk.rel = "icon"; mk.href = PAC; document.head.appendChild(mk); } catch (e) {}
  var FINGER = String.fromCodePoint(0x1F449);
  var SMILEY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T22.213 8.1T23 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m-3.5-8q.625 0 1.063-.437T10 10.5t-.437-1.062T8.5 9t-1.062.438T7 10.5t.438 1.063T8.5 12m7 0q.625 0 1.063-.437T17 10.5t-.437-1.062T15.5 9t-1.062.438T14 10.5t.438 1.063T15.5 12M12 17.5q1.525 0 2.75-.85t1.725-2.275q.125-.325-.062-.6t-.538-.275H8.125q-.35 0-.537.275t-.063.6q.5 1.425 1.725 2.275T12 17.5"/></svg>';
  var PALETTE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32" d="M430.11 347.9c-6.6-6.1-16.3-7.6-24.6-9c-11.5-1.9-15.9-4-22.6-10c-14.3-12.7-14.3-31.1 0-43.8l30.3-26.9c46.4-41 46.4-108.2 0-149.2c-34.2-30.1-80.1-45-127.8-45c-55.7 0-113.9 20.3-158.8 60.1c-83.5 73.8-83.5 194.7 0 268.5c41.5 36.7 97.5 55 152.9 55.4h1.7c55.4 0 110-17.9 148.8-52.4c14.4-12.7 11.99-36.6.1-47.7Z"/><circle cx="144" cy="208" r="32" fill="currentColor"/><circle cx="152" cy="311" r="32" fill="currentColor"/><circle cx="224" cy="144" r="32" fill="currentColor"/><circle cx="256" cy="367" r="48" fill="currentColor"/><circle cx="328" cy="144" r="32" fill="currentColor"/></svg>';
  var MARK_RE = /==#([0-9a-fA-F]{6})\s+([\s\S]*?)==/g;
  var NEW_RE = /#([0-9a-fA-F]{6})\s/g;

  /* ---------- finger removal ---------- */
  function stripFingerText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n, hits = [];
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.indexOf(FINGER) !== -1) hits.push(n);
    }
    for (var i = 0; i < hits.length; i++) hits[i].nodeValue = hits[i].nodeValue.split(FINGER).join('');
  }
  function killFingerPseudos() {
    var sel = [];
    for (var s = 0; s < document.styleSheets.length; s++) {
      var rules;
      try { rules = document.styleSheets[s].cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (var r = 0; r < rules.length; r++) {
        var t = rules[r].cssText || '';
        if (t.indexOf(FINGER) !== -1 && t.indexOf('content') !== -1) {
          var m = t.match(/([^{}]+){/);
          if (m) sel.push(m[1].trim() + '::before', m[1].trim() + '::after');
        }
      }
    }
    if (sel.length && !document.getElementById('mome-finger-kill')) {
      var st = document.createElement('style');
      st.id = 'mome-finger-kill';
      st.textContent = sel.join(',') + ' { content: none !important; }';
      document.head.appendChild(st);
    }
  }

  /* ---------- links: card -> plain text ---------- */
  function plainLink(href, title) {
    var a = document.createElement('a');
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.className = 'mome-text-link';
    a.textContent = title;
    return a;
  }
  function resolveBlock(el) {
    var md = el.closest('.echo-markdown');
    if (!md) return el;
    var block = el;
    while (block.parentElement && block.parentElement !== md) block = block.parentElement;
    return block;
  }
  function transformLinks() {
    var links = document.querySelectorAll('.website-card__link');
    for (var i = 0; i < links.length; i++) {
      var link = links[i], block = resolveBlock(link);
      if (block.dataset.momeDone) continue;
      block.dataset.momeDone = '1';
      var titleEl = link.querySelector('[class*="title"]');
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (!title) { try { title = new URL(link.href, location.href).hostname; } catch (e) { title = link.href; } }
      block.parentNode.replaceChild(plainLink(link.href, title), block);
    }
    var chips = document.querySelectorAll('.mome-link-chip');
    for (var j = 0; j < chips.length; j++) {
      var chip = chips[j], blk = resolveBlock(chip);
      if (blk.dataset.momeDone) continue;
      blk.dataset.momeDone = '1';
      blk.parentNode.replaceChild(plainLink(chip.href, chip.textContent.trim()), blk);
    }
  }
  /* mobile: leftover label rows ("网站") inside echo-markdown */
  function cleanLabels(root) {
    var scope = (root.querySelectorAll) ? root : document;
    var links = scope.querySelectorAll('.mome-text-link');
    for (var a = 0; a < links.length; a++) {
      var L = links[a], p = L.parentElement;
      while (p && p !== document.body && !/timeline-content|home-main-track/.test(p.className || '')) {
        var cs = getComputedStyle(p);
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none') {
          p.style.setProperty('background', 'transparent', 'important');
          p.style.setProperty('border', 'none', 'important');
          p.style.setProperty('box-shadow', 'none', 'important');
        }
        p = p.parentElement;
      }
    }
    var els = scope.querySelectorAll('*');
    for (var j = 0; j < els.length; j++) {
      var e = els[j];
      if (e.dataset && e.dataset.momeLabelKilled) continue;
      if (e.closest && e.closest('.mome-emoji-picker, .mome-palette, script, style')) continue;
      if (e.querySelector && e.querySelector('.mome-text-link')) continue;
      var t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      var isLabel = (t === '网站' || t === '🔗 网站' || t === '链接' || t === '🔗 链接') && e.childElementCount <= 2;
      if (!isLabel) continue;
      e.dataset.momeLabelKilled = '1';
      var target = e, q = e.parentElement;
      while (q && q !== document.body) {
        var t2 = (q.textContent || '').replace(/\s+/g, ' ').trim();
        if (t2 === '网站' || t2 === '🔗 网站' || t2 === '链接' || t2 === '🔗 链接') { target = q; q = q.parentElement; }
        else break;
      }
      target.style.setProperty('display', 'none', 'important');
    }
  }
  function bindCards() {
    var cards = document.querySelectorAll('.echo-timeline.group');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.dataset.momeClick) continue;
      c.dataset.momeClick = '1';
      c.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, textarea, select, [role="button"], [contenteditable]')) return;
        var b = e.currentTarget.querySelector('.echo-open-btn');
        if (b) b.click();
      });
    }
  }

  /* ---------- color marker rendering: ==#hex text== -> colored span ---------- */
  function appendColored(frag, text, color) {
    if (!text) return;
    if (color) {
      var s = document.createElement('span');
      s.style.color = color;
      s.textContent = text;
      frag.appendChild(s);
    } else frag.appendChild(document.createTextNode(text));
  }
  function colorizePlain(node) {
    var txt = node.nodeValue;
    NEW_RE.lastIndex = 0;
    var m = NEW_RE.exec(txt);
    if (!m) return;
    var frag = document.createDocumentFragment();
    var pos = 0, cur = null;
    while (m) {
      appendColored(frag, txt.slice(pos, m.index), cur);
      cur = '#' + m[1];
      pos = m.index + m[0].length;
      NEW_RE.lastIndex = pos;
      m = NEW_RE.exec(txt);
    }
    appendColored(frag, txt.slice(pos), cur);
    node.parentNode.replaceChild(frag, node);
  }
  function transformMarkers(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || (n.nodeValue.indexOf('==') === -1 && NEW_RE.test(n.nodeValue) === false && (NEW_RE.lastIndex = 0, true) && !/#([0-9a-fA-F]{6})\s/.test(n.nodeValue))) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest('textarea, input, [contenteditable="true"], .mome-emoji-picker, script, style, code, pre')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    for (var i = 0; i < targets.length; i++) {
      var node = targets[i], txt = node.nodeValue;
      MARK_RE.lastIndex = 0;
      if (!MARK_RE.test(txt)) { colorizePlain(node); continue; }
      MARK_RE.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, mm;
      MARK_RE.lastIndex = 0;
      while ((mm = MARK_RE.exec(txt)) !== null) {
        if (mm.index > last) frag.appendChild(document.createTextNode(txt.slice(last, mm.index)));
        var span = document.createElement('span');
        span.style.color = '#' + mm[1];
        span.textContent = mm[2];
        frag.appendChild(span);
        last = mm.index + mm[0].length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  /* ---------- comment bar (danmaku) + emoji picker ---------- */
  var pickerState = { open: false, node: null, data: null, tab: 'ALL', q: '', ta: null };
  var SMILEY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T22.213 8.1T23 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m-3.5-8q.625 0 1.063-.437T10 10.5t-.437-1.062T8.5 9t-1.062.438T7 10.5t.438 1.063T8.5 12m7 0q.625 0 1.063-.437T17 10.5t-.437-1.062T15.5 9t-1.062.438T14 10.5t.438 1.063T15.5 12M12 17.5q1.525 0 2.75-.85t1.725-2.275q.125-.325-.062-.6t-.538-.275H8.125q-.35 0-.537.275t-.063.6q.5 1.425 1.725 2.275T12 17.5"/></svg>';
  function insertText(ta, text) {
    var st = ta.selectionStart || 0, en = ta.selectionEnd || 0;
    var v = ta.value;
    ta.value = v.slice(0, st) + text + v.slice(en);
    var pos = st + text.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  }
  function closePicker() {
    if (pickerState.node && pickerState.node.parentNode) pickerState.node.parentNode.removeChild(pickerState.node);
    pickerState.open = false; pickerState.node = null;
  }
  function buildPicker(anchor, ta) {
    var p = document.createElement('div');
    p.className = 'mome-emoji-picker';
    var search = document.createElement('input');
    search.className = 'mome-emoji-search';
    search.placeholder = '搜索表情...';
    var tabs = document.createElement('div');
    tabs.className = 'mome-emoji-tabs';
    var grid = document.createElement('div');
    grid.className = 'mome-emoji-grid';
    p.appendChild(search); p.appendChild(tabs); p.appendChild(grid);
    document.body.appendChild(p);
    var ar = anchor.getBoundingClientRect();
    var left = Math.min(Math.max(8, ar.left - 60), window.innerWidth - 340);
    var top = ar.top - 336;
    if (top < 8) top = ar.bottom + 8;
    p.style.left = left + 'px';
    p.style.top = Math.max(8, top) + 'px';
    pickerState.open = true; pickerState.node = p; pickerState.ta = ta;
    fetch('/mome-emoji-map.json').then(function (r) { return r.json(); }).then(function (data) {
      pickerState.data = data;
      var catNames = ['ALL'].concat(Object.keys(data.cats || {}));
      var labels = { ALL: '全部' };
      catNames.forEach(function (cn) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mome-emoji-tab' + (cn === pickerState.tab ? ' is-active' : '');
        b.textContent = labels[cn] || cn;
        b.addEventListener('click', function () {
          pickerState.tab = cn;
          tabs.querySelectorAll('.mome-emoji-tab').forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
          render();
        });
        tabs.appendChild(b);
      });
      function render() {
        grid.innerHTML = '';
        var names = [];
        if (pickerState.tab === 'ALL') {
          names = Object.keys(data.map);
        } else {
          names = (data.cats[pickerState.tab] || []).filter(function (n) { return data.map[n]; });
        }
        if (pickerState.q) names = names.filter(function (n) { return n.indexOf(pickerState.q) !== -1; });
        names.slice(0, 480).forEach(function (n) {
          var img = document.createElement('img');
          img.src = '/mome-icons/' + n + '.svg';
          img.title = n;
          
          img.addEventListener('click', function () {
            insertText(ta, data.map[n] || ('![' + n + '](' + location.origin + '/mome-icons/' + n + '.svg)'));
            closePicker();
          });
          grid.appendChild(img);
        });
        if (!names.length) { grid.innerHTML = '<div style="grid-column:1/-1;color:#888;font-size:12px;padding:12px">没有匹配的表情</div>'; }
      }
      render();
      search.addEventListener('input', function () { pickerState.q = search.value.trim().toLowerCase(); render(); });
      setTimeout(function () { search.focus(); }, 50);
      p.addEventListener('click', function (e) { e.stopPropagation(); });
    });
  }
  function ensureCommentBar() {
    var form = document.querySelector('form.comment-form-panel');
    if (!form || form.dataset.momeBar) return;
    var ta = form.querySelector('textarea');
    if (!ta) return;
    form.dataset.momeBar = '1';
    ta.placeholder = '发一条友好的弹幕吧';
    var bar = document.createElement('div');
    bar.className = 'mome-danmaku-bar';
    var emo = document.createElement('button');
    emo.type = 'button'; emo.className = 'mome-emoji-btn';
    emo.setAttribute('aria-label', '表情');
    emo.innerHTML = SMILEY;
    var pal = document.createElement('button');
    pal.type = 'button'; pal.className = 'mome-emoji-btn';
    pal.setAttribute('aria-label', '调色盘');
    pal.innerHTML = PALETTE_ICON;
    var send = document.createElement('button');
    send.type = 'button'; send.className = 'mome-send-btn';
    send.textContent = '发送';
    ta.parentNode.insertBefore(bar, ta);
    bar.appendChild(emo);
    bar.appendChild(pal);
    bar.appendChild(ta);
    bar.appendChild(send);
    emo.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pickerState.open) { closePicker(); return; }
      buildPicker(emo, ta);
    });
    pal.addEventListener('click', function (e) {
      e.stopPropagation();
      if (paletteBox) { closePalette(); return; }
      openPalette(pal, ta);
    });
    document.addEventListener('click', function (e) {
      if (pickerState.open && pickerState.node && !pickerState.node.contains(e.target) && !emo.contains(e.target)) closePicker();
    });
    send.addEventListener('click', function () {
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  /* ---------- color palette for composers ---------- */
  var OPEN_COLORS = [
    ['默认', 'inherit'], ['#ff6b6b', '#ff6b6b'], ['#fa5252', '#fa5252'], ['#f06595', '#f06595'], ['#cc5de8', '#cc5de8'], ['#845ef7', '#845ef7'],
    ['#5c7cfa', '#5c7cfa'], ['#339af0', '#339af0'], ['#22b8cf', '#22b8cf'], ['#20c997', '#20c997'], ['#51cf66', '#51cf66'], ['#94d82d', '#94d82d'],
    ['#ffd43b', '#ffd43b'], ['#ff922b', '#ff922b'], ['#adb5bd', '#adb5bd'], ['#f1f3f5', '#f1f3f5'], ['#6e6eff', '#6e6eff'], ['#000000', '#000000']
  ];
  var paletteBtn = null, paletteBox = null, paletteTarget = null;
  function closePalette() {
    if (paletteBox && paletteBox.parentNode) paletteBox.parentNode.removeChild(paletteBox);
    paletteBox = null;
  }
  function hsvToRgb(h, s, v) {
    var f = function (n) {
      var k = (n + h / 60) % 6;
      return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
    };
    return [f(5), f(3), f(1)];
  }
  function rgbToHex(r, g, b) {
    var h = function (x) { var t = x.toString(16); return t.length === 1 ? '0' + t : t; };
    return '#' + h(r) + h(g) + h(b);
  }
  function openPalette(btn, target) {
    closePalette();
    var SIZE = 170, HALF = SIZE / 2;
    var box = document.createElement('div');
    box.className = 'mome-palette mome-palette--wheel';
    var grip = document.createElement('div');
    grip.className = 'mome-wheel-grip';
    grip.title = '拖动移动';
    var rz = document.createElement('div');
    rz.className = 'mome-wheel-resize';
    rz.title = '拖动调节大小';
    grip.appendChild(rz);
    box.appendChild(grip);
    var wrap = document.createElement('div');
    wrap.className = 'mome-wheel-wrap';
    var cv = document.createElement('canvas');
    cv.className = 'mome-wheel-canvas';
    wrap.appendChild(cv);
    box.appendChild(wrap);
    var row = document.createElement('div');
    row.className = 'mome-wheel-row';
    var prev = document.createElement('div');
    prev.className = 'mome-wheel-preview';
    var hexLabel = document.createElement('div');
    hexLabel.className = 'mome-wheel-hex';
    var applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'mome-wheel-apply';
    applyBtn.textContent = '应用';
    row.appendChild(prev); row.appendChild(hexLabel); row.appendChild(applyBtn);
    box.appendChild(row);
    var quick = document.createElement('div');
    quick.className = 'mome-quick-row';
    box.appendChild(quick);
    document.body.appendChild(box);

    var ctx = cv.getContext('2d');
    var cur = { hex: '#cc5de8' };
    var frac = { x: 0.72, y: 0.28 };
    function hsvToRgbL(h, s, v) {
      var f = function (n) {
        var k = (n + h / 60) % 6;
        return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
      };
      return [f(5), f(3), f(1)];
    }
    function rgbToHexL(r, g, b) {
      var h = function (x) { var t = x.toString(16); return t.length === 1 ? '0' + t : t; };
      return '#' + h(r) + h(g) + h(b);
    }
    var handle = document.createElement('div');
    handle.className = 'mome-wheel-handle';
    wrap.appendChild(handle);
    function drawWheel() {
      cv.width = SIZE; cv.height = SIZE;
      var img = ctx.createImageData(SIZE, SIZE);
      var d = img.data;
      for (var y = 0; y < SIZE; y++) {
        for (var x = 0; x < SIZE; x++) {
          var dx = x - HALF + 0.5, dy = y - HALF + 0.5;
          var rr = Math.sqrt(dx * dx + dy * dy) / HALF;
          var idx = (y * SIZE + x) * 4;
          if (rr > 1) { d[idx + 3] = 0; continue; }
          var ang = Math.atan2(dy, dx) * 180 / Math.PI;
          var hue = (ang + 90 + 360) % 360;
          var rgb = hsvToRgbL(hue, Math.min(1, rr), 1);
          d[idx] = rgb[0]; d[idx + 1] = rgb[1]; d[idx + 2] = rgb[2]; d[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      handle.style.left = (frac.x * SIZE) + 'px';
      handle.style.top = (frac.y * SIZE) + 'px';
    }
    function setFromPoint(px, py) {
      frac = { x: px / SIZE, y: py / SIZE };
      var dx = px - HALF, dy = py - HALF;
      var rr2 = Math.min(1, Math.sqrt(dx * dx + dy * dy) / HALF);
      var ang2 = Math.atan2(dy, dx) * 180 / Math.PI;
      var hue2 = (ang2 + 90 + 360) % 360;
      var rgb2 = hsvToRgbL(hue2, rr2, 1);
      cur.hex = rgbToHexL(rgb2[0], rgb2[1], rgb2[2]);
      prev.style.background = cur.hex;
      hexLabel.textContent = cur.hex;
      handle.style.left = px + 'px';
      handle.style.top = py + 'px';
    }
    var dragging = false;
    function evPos(e) {
      var r = cv.getBoundingClientRect();
      var cx = (e.clientX - r.left) * (SIZE / r.width);
      var cy = (e.clientY - r.top) * (SIZE / r.height);
      var dx = cx - HALF, dy = cy - HALF;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > HALF - 2) { var k = (HALF - 2) / dist; cx = HALF + dx * k; cy = HALF + dy * k; }
      return [cx, cy];
    }
    wrap.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      dragging = true;
      wrap.classList.add('dragging');
      var p = evPos(e); setFromPoint(p[0], p[1]);
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var p = evPos(e); setFromPoint(p[0], p[1]);
    });
    document.addEventListener('mouseup', function () {
      dragging = false;
      wrap.classList.remove('dragging');
    });
    wrap.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation();
      dragging = true;
      wrap.classList.add('dragging');
      var p = evPos(e.touches[0]); setFromPoint(p[0], p[1]);
    }, { passive: false });
    wrap.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var p = evPos(e.touches[0]); setFromPoint(p[0], p[1]);
    }, { passive: false });
    wrap.addEventListener('touchend', function () {
      dragging = false;
      wrap.classList.remove('dragging');
    });
    drawWheel();
    setFromPoint(frac.x * SIZE, frac.y * SIZE);
    applyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      applyColor(target, cur.hex);
      closePalette();
    });
    var QUICK = ['#ff6b6b', '#fa5252', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf', '#20c997', '#51cf66', '#ffd43b', '#ff922b', '#f1f3f5', '#6e6eff'];
    QUICK.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.title = c;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        applyColor(target, c);
        closePalette();
      });
      quick.appendChild(b);
    });

    var moving = false, mx = 0, my = 0, bl = 0, bt = 0;
    grip.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      moving = true; mx = e.clientX; my = e.clientY;
      var r = box.getBoundingClientRect(); bl = r.left; bt = r.top;
    });
    document.addEventListener('mousemove', function (e) {
      if (!moving) return;
      box.style.left = Math.max(4, bl + e.clientX - mx) + 'px';
      box.style.top = Math.max(4, bt + e.clientY - my) + 'px';
    });
    document.addEventListener('mouseup', function () { moving = false; });
    grip.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation();
      moving = true; mx = e.touches[0].clientX; my = e.touches[0].clientY;
      var r = box.getBoundingClientRect(); bl = r.left; bt = r.top;
    }, { passive: false });
    grip.addEventListener('touchmove', function (e) {
      if (!moving) return;
      e.preventDefault();
      box.style.left = Math.max(4, bl + e.touches[0].clientX - mx) + 'px';
      box.style.top = Math.max(4, bt + e.touches[0].clientY - my) + 'px';
    }, { passive: false });
    grip.addEventListener('touchend', function () { moving = false; });

    var resizing = false, rsx = 0, startSize = SIZE;
    rz.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      resizing = true; rsx = e.clientX; startSize = SIZE;
    });
    document.addEventListener('mousemove', function (e) {
      if (!resizing) return;
      var ns = Math.max(130, Math.min(300, startSize + (e.clientX - rsx)));
      if (ns !== SIZE) {
        SIZE = ns; HALF = SIZE / 2;
        box.style.setProperty('--wheel-size', SIZE + 'px');
        drawWheel();
      }
    });
    document.addEventListener('mouseup', function () { resizing = false; });
    rz.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation();
      resizing = true; rsx = e.touches[0].clientX; startSize = SIZE;
    }, { passive: false });
    rz.addEventListener('touchmove', function (e) {
      if (!resizing) return;
      e.preventDefault();
      var ns = Math.max(130, Math.min(300, startSize + (e.touches[0].clientX - rsx)));
      if (ns !== SIZE) {
        SIZE = ns; HALF = SIZE / 2;
        box.style.setProperty('--wheel-size', SIZE + 'px');
        drawWheel();
      }
    }, { passive: false });
    rz.addEventListener('touchend', function () { resizing = false; });

    var br = btn.getBoundingClientRect();
    var bw = box.offsetWidth || 260, bh = box.offsetHeight || 360;
    var left = Math.min(window.innerWidth - bw - 8, Math.max(8, br.left + br.width / 2 - bw / 2));
    var top = br.top - bh - 12;
    if (top < 8) top = Math.min(window.innerHeight - bh - 8, br.bottom + 10);
    box.style.left = left + 'px';
    box.style.top = Math.max(8, top) + 'px';
    paletteBox = box;
    setTimeout(function () {
      document.addEventListener('click', function h(e) {
        if (!paletteBox) { document.removeEventListener('click', h); return; }
        if (!paletteBox.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { closePalette(); document.removeEventListener('click', h); }
      });
    }, 10);
  }
  function applyColor(target, color) {
    var marker = color === 'inherit' ? '' : '#' + color.replace('#', '');
    if (target && target.classList && target.classList.contains('cm-content')) {
      var sel = window.getSelection();
      var text = sel ? sel.toString() : '';
      if (text) {
        document.execCommand('insertText', false, marker + ' ' + text);
      }
      return;
    }
    var ta = target;
    if (!ta || ta.selectionStart === undefined) return;
    var st = ta.selectionStart, en = ta.selectionEnd;
    if (st === en) { insertText(ta, marker + ' '); return; }
    var sel = ta.value.slice(st, en);
    var v = ta.value;
    ta.value = v.slice(0, st) + marker + ' ' + sel + v.slice(en);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  var paletteFor = new WeakSet ? new WeakSet() : [];
  function attachPalette(el, alwaysVisible) {
    if (!el || el.dataset.momePalette) return;
    el.dataset.momePalette = '1';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mome-palette-btn';
    btn.innerHTML = PALETTE_ICON;
    btn.title = '调色盘（先框选文字）';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (paletteBox) { closePalette(); return; }
      paletteTarget = el;
      openPalette(btn, el);
    });
    el.parentElement ? el.parentElement.insertBefore(btn, el) : document.body.appendChild(btn);
    var update = function () {
      var r = el.getBoundingClientRect();
      var hasSel = false;
      if (el.tagName === 'TEXTAREA') hasSel = el.selectionStart !== el.selectionEnd;
      else { var s = window.getSelection(); hasSel = s && !s.isCollapsed && el.contains(s.anchorNode); }
      var show = hasSel || (alwaysVisible && document.activeElement === el);
      btn.style.display = show ? 'flex' : (alwaysVisible ? 'flex' : 'none');
      btn.style.left = Math.min(window.innerWidth - 50, Math.max(8, r.right - 30)) + 'px';
      btn.style.top = Math.max(8, r.top - 44) + 'px';
    };
    document.addEventListener('selectionchange', update);
    el.addEventListener('focus', update);
    el.addEventListener('blur', function () { setTimeout(update, 200); });
    update();
  }
  function ensureComposerPalette() {
    var cta = document.querySelector('textarea[placeholder*="吐"], textarea[placeholder*="moment"], textarea[placeholder*="想法"]');
    if (!cta) return;
    var cr = cta.getBoundingClientRect();
    // 找发布框正下方的工具栏行：行内（不限直接子级）有 >=3 个按钮/链接，取最靠下的一行
    var rows = document.querySelectorAll('div');
    var toolbar = null, bestTop = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var bs = r.querySelectorAll('button, a, [role="button"]');
      if (bs.length < 3) continue;
      var rr = r.getBoundingClientRect();
      if (rr.width < 120 || rr.height < 28 || rr.height > 100) continue;
      if (rr.top < cr.bottom - 14) continue;
      if (rr.top > cr.bottom + 320) continue;
      if (rr.top < bestTop) { bestTop = rr.top; toolbar = r; }
    }
    if (!toolbar) return;
    // 挂错位置的旧按钮一律删除
    document.querySelectorAll('[aria-label="调色盘"]').forEach(function (b) {
      if (!toolbar.contains(b)) b.remove();
    });
    if (toolbar.querySelector('[aria-label="调色盘"]')) return;
    var ref = toolbar.querySelector('button:last-of-type, a:last-of-type');
    var b2 = document.createElement('button');
    b2.type = 'button';
    b2.className = ref ? ref.className : '';
    b2.setAttribute('aria-label', '调色盘');
    b2.title = '调色盘（框选文字后选色）';
    b2.innerHTML = PALETTE_ICON;
    toolbar.appendChild(b2);
    b2.addEventListener('click', function (e) {
      e.stopPropagation();
      if (paletteBox) { closePalette(); return; }
      openPalette(b2, cta);
    });
  }
  function ensurePalettes() {
    document.querySelectorAll('textarea').forEach(function (ta) {
      if (ta.closest('.mome-emoji-picker') || ta.closest('.mome-danmaku-bar')) return;
      if (ta.closest('.md-editor') || ta.closest('.cm-editor')) return;
      var r = ta.getBoundingClientRect();
      if (r.width > 150 && r.height > 25) attachPalette(ta, ta.closest('.mome-danmaku-bar') ? true : false);
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(function (ce) {
      if (ce.closest('.mome-emoji-picker')) return;
      var r = ce.getBoundingClientRect();
      if (r.width > 200) attachPalette(ce);
    });
  }

  /* ---------- run loop ---------- */
  function hideColortest() {
    document.querySelectorAll('[class*="comment"]').forEach(function (e) {
      if (String(e.className).indexOf("comment-form") !== -1) return;
      if (e.textContent.indexOf('COLORTEST') !== -1 && e.textContent.indexOf('蓝字') !== -1) {
        e.style.setProperty('display', 'none', 'important');
      }
    });
  }
  window.momeErrs = [];
  function safe(name, fn) { try { fn(); } catch (e) { window.momeErrs.push(name + ": " + e.message); if (window.momeErrs.length > 20) window.momeErrs.shift(); } }
  function run() { safe("hideColortest", hideColortest);
    safe("transformLinks", transformLinks);
    safe("cleanLabels", function () { cleanLabels(document); });
    safe("stripFingerText", function () { stripFingerText(document); });
    safe("killFingerPseudos", killFingerPseudos);
    safe("bindCards", bindCards);
    safe("transformMarkers", function () { transformMarkers(document); });
    safe("ensureCommentBar", ensureCommentBar);
    safe("ensurePalettes", ensurePalettes);
    safe("ensureComposerPalette", ensureComposerPalette);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
  new MutationObserver(function () { run(); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
