"""把 tokens.css 展开成「明暗两套」的 custom.css。

   输入   tokens.css   一个 :root:root { } 块，用 `/* ===== 2.x */` 分节
                       （2.2 字体 / 2.3 直角 与主题无关，其余是暗色数值）
           tail.css    第 3 节往后的所有规则，一律走 var()，明暗自动跟着走
   输出   custom.css   = 三段 :root:root + tail，推给 Ech0 的就是它

节的分工：
    :root:root              2.2 字体、2.3 直角（明暗共用）
    :root:root.dark         2.1、2.4~2.9（博客暗色）
    :root:root.light/.sunny 2.1、2.4~2.9 按 PALETTE 机械映射出的亮色

⚠️ 与旧 build_css.py 的区别（两个都是 bug，必须记住）：
  1. 旧脚本第 173 行把结果写回了 **输入文件** 而不是输出文件，跑一次就把
     自己的输入覆盖掉了 —— 于是第二次跑必炸在 assert 'color-scheme' 上。
     这个版本写 OUT，可以反复跑。
  2. 旧脚本没有幂等性可言。这个版本读的 tokens.css 永远是「单块」形态，
     与 custom.css 的「三块」形态不同，所以重跑任意次结果都一样。

改暗色数值请改 tokens.css 后重跑；改第 3 节往后的规则请改 tail.css。
亮色块是生成的，**不要手改 custom.css**。

字体从哪来：@font-face 的 URL 由命令行第一个参数决定，默认 `/fonts`
（即把仓库里的 fonts/ 放到站点根目录下，最省事）。

    python build.py                                  # → url("/fonts/oswald-var.woff2")
    python build.py https://example.com/fonts        # → 外链
    python build.py https://example.com/fonts/       # 结尾带斜杠也行

⚠️ 这是**每套部署不一样**的唯一一处。仓库里 theme/custom.css 是默认值构建的，
   线上那份是外链构建的，所以两者的 @font-face 三行必然不同 —— 其余逐字节一致。

用法: python build.py [字体目录 URL]
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_BASE = (sys.argv[1] if len(sys.argv) > 1 else '/fonts').rstrip('/')
TOKENS = os.path.join(HERE, 'tokens.css')
TAIL = os.path.join(HERE, 'tail.css')
OUT = os.path.join(HERE, '..', 'custom.css')

# 暗色 → 亮色。数值来自博客 global.css 的 html:not(.dark) 段。
PALETTE = [
    (r'rgba\(240, 240, 242, ([0-9.]+)\)', r'rgba(17, 17, 17, \1)'),      # --wm-line / ink 系
    (r'rgba\(110, 110, 255, ([0-9.]+)\)', r'rgba(0, 0, 242, \1)'),       # primary
    (r'rgba\(23, 23, 29, ([0-9.]+)\)',    r'rgba(255, 255, 255, \1)'),   # card
    (r'rgba\(21, 21, 28, ([0-9.]+)\)',    r'rgba(245, 245, 245, \1)'),   # panel
    (r'rgba\(14, 14, 19, ([0-9.]+)\)',    r'rgba(253, 253, 253, \1)'),   # paper
    (r'rgba\(6, 6, 10, ([0-9.]+)\)',      r'rgba(255, 255, 255, \1)'),   # 遮罩
    (r'rgba\(139, 139, 149, ([0-9.]+)\)', r'rgba(138, 138, 138, \1)'),   # muted
    (r'rgba\(255, 107, 107, ([0-9.]+)\)', r'rgba(217, 45, 32, \1)'),     # danger
    (r'#15151c', '#f5f5f5'),   # 必须排在 #15151c00 之前也成立：结果都是 #f5f5f500
    (r'#0e0e13', '#fdfdfd'),
    (r'#17171d', '#ffffff'),
    (r'#f0f0f2', '#111111'),
    (r'#b9b9c2', '#4a4a4a'),
    (r'#8b8b95', '#8a8a8a'),
    (r'#5c5c66', '#b9b9b9'),
    (r'#6e6eff', '#0000f2'),
    (r'#8f8fff', '#2b2bf5'),
    (r'#3a3a44', '#c9c9c9'),
    (r'#ff6b6b', '#d92d20'),
]

# 亮色下需要单独纠正的（机械映射会得到不合理的值）
LIGHT_FIXUP = [
    ('--switch-thumb-color: #111111;', '--switch-thumb-color: #ffffff;'),  # 亮色的滑块是白的
]

# 桥接变量：给第 3、4 节里够不着语义变量的地方用。
# 追加而不是写进 tokens.css —— tokens.css 里再写一遍就会重复。
BRIDGE = """
  /* ===== 2.9 桥接变量（给下面第 3、4 节用）===== */
  --bt-dotted: #3a3a44;            /* ← --wm-dotted */
  --bt-primary-soft: #8f8fff;      /* ← --wm-primary-soft */
"""

HEADER = """/* ==========================================================================
   bts-moment —— 给 Ech0 换上配套博客那一套皮（暗色 + 亮色两套）
   注入位置：面板 → 系统设置 → 自定义 CSS
   数值全部取自配套博客的 src/styles/global.css

   为什么通篇都在改 CSS 变量而不是写选择器：
   Ech0 的前端是 UnoCSS 原子类（v5.7.0 的主 CSS 只有 412 个类名 token，
   语义化的组件类只有 .widget / .x-scrollbar / .route-progress__bar 三个）。
   原子类最终都会落到 --color-* / --radius-* / --font-* 这些变量上，
   所以「盖变量」才是唯一的杠杆；按类名去写样式是写不动的。

   变量盖不到的是**懒加载 chunk**：HomeView / EchoView / TheMdEditor /
   floating-vue 的样式在主 CSS 里一行都没有，全在各自的 chunk 里，
   颜色和圆角都是不走变量的字面值（--md-* / --comment-* / --heatmap-* 等）。
   那些只能逐个点名，也是本文件绝大部分篇幅的由来。

   ⚠️ 本文件是 build.py 生成的，不要手改。
     改暗色数值 → tokens.css ；改第 3 节往后 → tail.css ；然后重跑 build.py。

   结构：
     :root:root                      字体、直角（与主题无关）
     :root:root.dark                 博客暗色 + 粒子
     :root:root.light, :root:root.sunny
                                     博客亮色，无粒子
   ========================================================================== */"""


def block_body(text, selector):
    """取出某个选择器那一层 { } 的内容（不含花括号本身）。"""
    i = text.index(selector)
    start = text.index('{', i)
    depth = 0
    for j in range(start, len(text)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return text[start + 1:j]
    raise ValueError(f'{selector} 的括号没闭合')


def main():
    src = open(TOKENS, encoding='utf-8').read()
    body = block_body(src, ':root:root {')

    # 按 "/* ===== 2.x" 分片，把字体/直角归为「与主题无关」
    parts = re.split(r'(?=\n  /\* ===== 2\.)', '\n' + body)
    shared, themed = ['\n'], []
    for p in parts:
        if not p.strip():
            continue
        head = re.search(r'/\* ===== (2\.\d) (\S+)', p)
        if head and head.group(1) in ('2.2', '2.3'):   # 字体、直角
            shared.append(p)
        else:
            themed.append(p)

    assert 'color-scheme' in body, 'tokens.css 里没找到 color-scheme 那行'
    assert len(shared) == 3, f'2.2 / 2.3 两个节没切出来（切到 {len(shared) - 1} 个）'

    dark_body = ''.join(themed).rstrip() + '\n' + BRIDGE

    # ---- 生成亮色块 ----
    light_body = dark_body.replace('color-scheme: dark', 'color-scheme: light')
    for pat, rep in PALETTE:
        light_body = re.sub(pat, rep, light_body)
    for a, b in LIGHT_FIXUP:
        light_body = light_body.replace(a, b)

    section2 = f"""{HEADER}

/* ---------- 1. 字体：Oswald + Courier Prime ----------
   仓库里 fonts/ 带了这三个文件（两个字族都是 OFL-1.1，
   许可全文在同目录的 OFL-*.txt）。把 fonts/ 放到站点根目录即可，
   或者用 `python build.py <你的字体目录URL>` 重新构建换成外链。 */
@font-face {{
  font-family: "Oswald";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("{FONT_BASE}/oswald-var.woff2") format("woff2");
}}
@font-face {{
  font-family: "Courier Prime";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("{FONT_BASE}/courier-prime-400.woff2") format("woff2");
}}
@font-face {{
  font-family: "Courier Prime";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("{FONT_BASE}/courier-prime-700.woff2") format("woff2");
}}

/* ---------- 2-A 与主题无关的 token ----------
   优先级说明：:root:root 是 (0,2,0)，和 Ech0 自带的 :root.dark / :root.light
   / :root.sunny 打平；我们的 <style> 是运行时最后插进 <head> 的，同优先级靠后者胜。
   .dark / .light / .sunny 那份再多一个类，是 (0,3,0)，稳过。 */
:root:root {{
{''.join(shared).strip()}
}}

/* ---------- 2-B 博客暗色（默认主题）---------- */
:root:root.dark {{
{dark_body.strip()}
}}

/* ---------- 2-C 博客亮色 ----------
   Ech0 的 sunny 也归到这里 —— 博客只有明暗两套，
   sunny 如果留着 Ech0 自己的暖色原样，会跟旁边两个状态完全不是一套语言。 */
:root:root.light,
:root:root.sunny {{
{light_body.strip()}
}}
"""

    tail = open(TAIL, encoding='utf-8').read()
    out = section2 + '\n' + tail
    open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
    print(f'{OUT} 已由 {TOKENS} + {TAIL} 生成：{len(out)} 字节')


main()
