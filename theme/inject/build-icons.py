#!/usr/bin/env python3
"""把 fluent-emoji-high-contrast 全集拆成独立 SVG 文件，供 /mome-icons/ 自托管。

   输入   icons.json   从 https://cdn.jsdelivr.net/npm/@iconify-json/fluent-emoji-high-contrast/icons.json
                       下载的 Iconify 集合包（约 2.6MB，含全部 1596 个图标）
   输出   当前目录下 <name>.svg × 1596（含 aliases 指向的别名）

   为什么自托管：选择器一次要拉 ~480 个图标，走 api.iconify.design 的公共 API
   在国内时好时坏（实测一部分 200、一部分挂）。拆成本地文件后由 nginx
   `location /mome-icons/` 直接出，同源 + 浏览器缓存一天，全量秒开。

   用法：
       python3 build-icons.py [icons.json 路径，默认当前目录]
"""
import json
import os
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'icons.json'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'

d = json.load(open(SRC, encoding='utf-8'))
icons = d.get('icons', {})
aliases = d.get('aliases', {})
dw, dh = d.get('width', 24), d.get('height', 24)


def body_of(name):
    if name in icons:
        ic = icons[name]
        return ic['body'], ic.get('width', dw), ic.get('height', dh)
    if name in aliases:
        return body_of(aliases[name]['parent'])
    return None


os.makedirs(OUT, exist_ok=True)
count = 0
for name in list(icons.keys()) + list(aliases.keys()):
    r = body_of(name)
    if not r:
        continue
    body, iw, ih = r
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}">{}</svg>'.format(iw, ih, body)
    with open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
    count += 1

print('written:', count, 'svg files ->', os.path.abspath(OUT))
