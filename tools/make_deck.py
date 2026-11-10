r"""
make_deck.py - build a designed, HEAVILY animated PowerPoint from a JSON file.

    .venv\Scripts\python tools\make_deck.py round1\deck\deck.json round1\deliver\Ctrl.Alt.Elite_Round1_Deck.pptx

LOOK: light theme (default) with a 4-colour palette taken from the WEBSITE's own colours, so the deck
and the app match. Set in "meta":
    "site": "../frontend"        <- reads --brand-hue / --accent-hue from <site>/src/index.css (recommended)
    or "brand_hue": 265, "accent_hue": 195
    or "brand": "#6D4AFF", "accent": "#06B6D4"   (hex, old style)
    "theme": "light" (default) | "dark"

MOTION (all automatic, presenter just clicks to the next slide):
  * Morph transition: glowing blobs, a ring, a dot cluster and the bottom progress bar glide between slides
  * Titles rise in word by word, cards rise one by one, icons pop, numbers pulse, lines draw themselves
  * Gentle endless motion on the title and closing slides (rotating rings, floating dots, confetti)

Slide types (see tools/deck_example.json for every one):
  title      title, highlight, subtitle, tag
  statement  text, highlight, sub, stat:{value,label} (optional big number card on the right)
  cards      title, eyebrow, intro, cards:[{icon,title,text}] (2-4)
  bullets    title, eyebrow, bullets:[str] (max 6), side:{value,label}?
  flow       title, eyebrow, steps:[{title,text}] (3-6)
  stats      title, eyebrow, stats:[{value,label}] (2-4), note
  image      title, eyebrow, image, caption, points:[str] (0-4), url
  compare    title, eyebrow, left:{title,items}, right:{title,items}
  table      title, eyebrow, columns, rows, highlight_col
  timeline   title, eyebrow, phases:[{title,text}] (3-5)
  closing    title, highlight, sub, contact
Every slide may have "notes" (speaker script) and "highlight" (phrase in the title that gets the gradient).
"""
from __future__ import annotations

import json
import math
import random
import re
import sys
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

sys.path.insert(0, str(Path(__file__).parent))
from deck_anim import add_animations, set_transition  # noqa: E402

W, H = 13.333, 7.5
FONT_HEAD = "Segoe UI Semibold"
FONT_BOLD = "Segoe UI Black"
FONT_BODY = "Segoe UI"
FONT_NUM = "Bahnschrift SemiBold"
FONT_MONO = "Consolas"
FONT_EMOJI = "Segoe UI Emoji"


# ------------------------------------------------------------------ colour
def oklch_hex(L: float, C: float, h: float) -> str:
    """OKLCH (the colour space the website uses) -> sRGB hex."""
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)

    def g(x):
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return "".join(f"{round(g(c) * 255):02X}" for c in lin)


def hex_hue(hx: str) -> float:
    """Approximate OKLCH hue of a hex colour (when only a hex brand colour is given)."""
    r, g, b = (int(hx.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 265.0
    d = mx - mn
    h = ((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return (h * 60 + 25) % 360


class Theme:
    def __init__(self, meta: dict, base: Path):
        bh, ah = 265.0, 195.0
        hex_mode = bool(meta.get("brand")) and not meta.get("site") and "brand_hue" not in meta
        if meta.get("site"):
            css = base / meta["site"] / "src" / "index.css"
            if css.is_file():
                txt = css.read_text(encoding="utf-8", errors="ignore")
                m1 = re.search(r"--brand-hue:\s*([\d.]+)", txt)
                m2 = re.search(r"--accent-hue:\s*([\d.]+)", txt)
                bh = float(m1.group(1)) if m1 else bh
                ah = float(m2.group(1)) if m2 else ah
            else:
                print(f"WARNING: {css} not found - using default colours")
        bh = float(meta.get("brand_hue", bh))
        ah = float(meta.get("accent_hue", ah))
        if hex_mode:
            bh = hex_hue(meta["brand"])
            ah = hex_hue(meta["accent"]) if meta.get("accent") else ah
        self.bh, self.ah = bh, ah
        self.dark = meta.get("theme", "light") == "dark"
        # warm highlight = amber, or coral if the brand itself is already yellow/orange; pop = brand + 115 deg
        wh = 25.0 if 40 <= bh <= 115 else 75.0
        ph = (bh + 115) % 360
        if abs(((ph - wh + 180) % 360) - 180) < 35:  # keep pop clearly different from warm
            ph = (ph + 60) % 360
        self.brand = meta["brand"].lstrip("#").upper() if hex_mode else oklch_hex(0.56, 0.21, bh)
        self.accent = meta["accent"].lstrip("#").upper() if hex_mode and meta.get("accent") else oklch_hex(0.68, 0.14, ah)
        self.warm = oklch_hex(0.76, 0.16, wh)
        self.pop = oklch_hex(0.63, 0.21, ph)
        self.palette = [self.brand, self.accent, self.warm, self.pop]
        hues = (bh, ah, wh, ph)
        if self.dark:
            self.bg, self.card = oklch_hex(0.17, 0.02, bh), oklch_hex(0.215, 0.025, bh)
            self.border, self.text = oklch_hex(0.32, 0.03, bh), "F4F5FB"
            self.muted, self.faint = oklch_hex(0.72, 0.03, bh), oklch_hex(0.26, 0.03, bh)
            self.tints = [oklch_hex(0.3, 0.07, hh) for hh in hues]
            self.shadow = "000000"
        else:
            self.bg, self.card = oklch_hex(0.985, 0.007, bh), "FFFFFF"
            self.border, self.text = oklch_hex(0.915, 0.015, bh), oklch_hex(0.22, 0.035, bh)
            self.muted, self.faint = oklch_hex(0.5, 0.03, bh), oklch_hex(0.955, 0.02, bh)
            self.tints = [oklch_hex(0.95, 0.04, hh) for hh in hues]
            self.shadow = "1E1B4B"

    def c(self, i: int) -> str:
        return self.palette[i % 4]

    def pair(self, i: int) -> tuple[str, str]:
        return self.palette[i % 4], self.palette[(i + 1) % 4]


def rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h.lstrip("#").upper())


class Deck:
    def __init__(self, meta: dict, base: Path):
        self.meta = meta
        self.t = Theme(meta, base)
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(W), Inches(H)
        self.blank = self.prs.slide_layouts[6]
        self.n = 0
        self.total = 1

    # ============================================================ primitives
    def text(self, parent, x, y, w, h, text, size=16, color=None, font=FONT_BODY, bold=False, align="l",
             anchor="t", spacing=None, highlight=None, line=1.1, grad=None):
        tb = parent.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
        for i, ln in enumerate(str(text).split("\n")):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
            p.line_spacing = line
            parts = [(ln, False)]
            if highlight and highlight in ln:
                a, b = ln.split(highlight, 1)
                parts = [(a, False), (highlight, True), (b, False)]
            for seg, hl in parts:
                if not seg:
                    continue
                r = p.add_run()
                r.text = seg
                f = r.font
                f.size, f.name, f.bold = Pt(size), font, bold
                f.color.rgb = rgb(color or self.t.text)
                if spacing is not None:
                    r._r.get_or_add_rPr().set("spc", str(int(spacing * 100)))
                if hl or grad:
                    self._grad_run(r, *(grad or (self.t.brand, self.t.accent)))
        return tb

    def _grad_run(self, run, c1, c2):
        rPr = run._r.get_or_add_rPr()
        for el in rPr.findall(qn("a:solidFill")):
            rPr.remove(el)
        grad = etree.Element(qn("a:gradFill"))
        gs = etree.SubElement(grad, qn("a:gsLst"))
        for pos, col in ((0, c1), (100000, c2)):
            etree.SubElement(etree.SubElement(gs, qn("a:gs"), pos=str(pos)), qn("a:srgbClr"), val=col.upper())
        etree.SubElement(grad, qn("a:lin"), ang="0", scaled="0")
        latin = rPr.find(qn("a:latin"))
        if latin is not None:
            latin.addprevious(grad)
        else:
            rPr.insert(0, grad)

    def _effects(self, shape):
        """Get or create <a:effectLst> in the schema-correct place inside spPr."""
        spPr = shape._element.spPr
        eff = spPr.find(qn("a:effectLst"))
        if eff is None:
            eff = etree.Element(qn("a:effectLst"))
            anchor = None
            for tag in ("a:ln", "a:solidFill", "a:gradFill", "a:noFill", "a:prstGeom"):
                anchor = spPr.find(qn(tag))
                if anchor is not None:
                    break
            anchor.addnext(eff)
        return eff

    def shadow(self, shape, blur=0.28, dist=0.06, alpha=11):
        sh = etree.SubElement(self._effects(shape), qn("a:outerShdw"), blurRad=str(int(Inches(blur))),
                              dist=str(int(Inches(dist))), dir="5400000", algn="t", rotWithShape="0")
        etree.SubElement(etree.SubElement(sh, qn("a:srgbClr"), val=self.t.shadow), qn("a:alpha"), val=str(alpha * 1000))

    def soft(self, shape, radius_in):
        etree.SubElement(self._effects(shape), qn("a:softEdge"), rad=str(int(Inches(radius_in))))

    def shape(self, parent, kind, x, y, w, h, fill=None, line=None, line_w=0.75, alpha=None, radius=None, name=None, line_alpha=None):
        s = parent.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
        if radius is not None and kind == MSO_SHAPE.ROUNDED_RECTANGLE:
            s.adjustments[0] = radius
        if fill:
            s.fill.solid()
            s.fill.fore_color.rgb = rgb(fill)
            if alpha is not None:
                etree.SubElement(s.fill._xPr.find(qn("a:solidFill"))[0], qn("a:alpha"), val=str(int(alpha * 1000)))
        else:
            s.fill.background()
        if line:
            s.line.color.rgb = rgb(line)
            s.line.width = Pt(line_w)
            if line_alpha is not None:
                clr = s.line._get_or_add_ln().find(qn("a:solidFill"))[0]
                etree.SubElement(clr, qn("a:alpha"), val=str(int(line_alpha * 1000)))
        else:
            s.line.fill.background()
        # remove the theme's default text style colour/shadow on shapes
        s.shadow.inherit = False
        if name:
            s.name = name
        return s

    def grad(self, shape, c1, c2, angle=45):
        spPr = shape._element.spPr
        for tag in ("a:solidFill", "a:noFill", "a:gradFill"):
            for el in spPr.findall(qn(tag)):
                spPr.remove(el)
        g = etree.Element(qn("a:gradFill"), rotWithShape="1")
        gs = etree.SubElement(g, qn("a:gsLst"))
        for pos, col in ((0, c1), (100000, c2)):
            etree.SubElement(etree.SubElement(gs, qn("a:gs"), pos=str(pos)), qn("a:srgbClr"), val=col.upper())
        etree.SubElement(g, qn("a:lin"), ang=str(int(angle * 60000)), scaled="0")
        spPr.find(qn("a:prstGeom")).addnext(g)
        return shape

    def card(self, parent, x, y, w, h, fill=None, border=None, radius=0.08, shadow=True, line_w=0.75):
        s = self.shape(parent, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill or self.t.card, border or self.t.border, line_w, radius=radius)
        if shadow:
            self.shadow(s)
        return s

    def badge(self, parent, x, y, d, label, i=0, emoji=False):
        c = self.shape(parent, MSO_SHAPE.OVAL, x, y, d, d, fill=self.t.c(i))
        self.grad(c, *self.t.pair(i), angle=45)
        self.shadow(c, blur=0.2, dist=0.04, alpha=18)
        tf = c.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(label)
        r.font.size = Pt(d * (30 if emoji else 24))
        r.font.bold = not emoji
        r.font.name = FONT_EMOJI if emoji else FONT_NUM
        r.font.color.rgb = rgb("FFFFFF")
        return c

    def pill_w(self, text, size=11):
        return 0.42 + len(text) * size * 0.0098

    def pill(self, parent, x, y, text, color, size=11, tint=None, h=0.36):
        p = self.shape(parent, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, self.pill_w(text, size), h, fill=tint or self.t.tints[0], radius=0.5)
        tf = p.text_frame
        tf.margin_left = tf.margin_right = Inches(0.14)
        tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.word_wrap = False
        para = tf.paragraphs[0]
        para.alignment = PP_ALIGN.CENTER
        r = para.add_run()
        r.text = text
        r.font.size, r.font.name, r.font.bold = Pt(size), FONT_MONO, True
        r.font.color.rgb = rgb(color)
        r._r.get_or_add_rPr().set("spc", "100")
        return p

    # ================================================================ chrome
    def new_slide(self, eyebrow=None, title=None, highlight=None, title_size=36, title_w=11.8):
        self.n += 1
        k, t = self.n, self.t
        s = self.prs.slides.add_slide(self.blank)
        s.background.fill.solid()
        s.background.fill.fore_color.rgb = rgb(t.bg)
        anims = []
        # --- decoration with the same names on every slide -> Morph glides them between slides ---
        al = 30 if not t.dark else 40
        ax, ay = 11.4 - 3.2 * math.sin(k * 1.25), 0.9 + 1.0 * math.cos(k * 0.85)
        bx, by = 1.2 + 2.6 * math.cos(k * 1.05), 6.6 - 0.9 * math.sin(k * 1.6)
        cx, cy = 7.0 + 4.0 * math.sin(k * 0.7 + 1), 7.3 - 0.5 * math.cos(k)
        blobA = self.shape(s, MSO_SHAPE.OVAL, ax - 2.9, ay - 2.9, 5.8, 5.8, fill=t.brand, alpha=al, name="!!blobA")
        blobB = self.shape(s, MSO_SHAPE.OVAL, bx - 2.4, by - 2.4, 4.8, 4.8, fill=t.accent, alpha=al, name="!!blobB")
        blobC = self.shape(s, MSO_SHAPE.OVAL, cx - 1.6, cy - 1.6, 3.2, 3.2, fill=t.warm, alpha=al - 6, name="!!blobC")
        for b, r in ((blobA, 2.1), (blobB, 1.8), (blobC, 1.2)):
            self.soft(b, r)
        rd = 3.4 + 0.6 * math.sin(k)
        rx, ry = (12.9 - 0.7 * math.cos(k * 0.9), 7.25 + 0.3 * math.sin(k * 1.3)) if k > 1 else (15.5, 9.5)
        ring = self.shape(s, MSO_SHAPE.OVAL, rx - rd / 2, ry - rd / 2, rd, rd, line=t.brand, line_w=1.25, line_alpha=28, name="!!ring")
        dots = s.shapes.add_group_shape()
        dots.name = "!!dots"
        dxo, dyo = (11.55, 0.42 + 0.12 * math.cos(k)) if k % 2 else (7.4 + 0.5 * math.sin(k), 0.42)
        for i in range(4):
            for j in range(3):
                self.shape(dots, MSO_SHAPE.OVAL, dxo + i * 0.22, dyo + j * 0.22, 0.07, 0.07, fill=t.c(i + j), alpha=70)
        # LIVE BACKGROUND: blobs drift, ring turns, dots float - endlessly, on every slide
        # (turn off with "live_bg": false in meta). One click still moves to the next slide.
        if self.meta.get("live_bg", True):
            sgn = 1 if k % 2 else -1
            anims += [(blobA.shape_id, "float_loop", 0, 7000, {"dx": 0.035 * sgn, "dy": 0.045}),
                      (blobB.shape_id, "float_loop", 0, 8500, {"dx": -0.04 * sgn, "dy": -0.035}),
                      (blobC.shape_id, "float_loop", 0, 6000, {"dx": 0.03, "dy": -0.03 * sgn}),
                      (ring.shape_id, "spin_loop", 0, 45000),
                      (dots.shape_id, "float_loop", 0, 5000, {"dx": 0.008 * sgn, "dy": 0.012})]
        # progress bar (grows slide by slide through Morph)
        self.shape(s, MSO_SHAPE.RECTANGLE, 0, H - 0.07, W, 0.07, fill=t.faint, name="!!track")
        prog = self.shape(s, MSO_SHAPE.RECTANGLE, 0, H - 0.07, max(0.2, W * k / self.total), 0.07, fill=t.brand, name="!!progress")
        self.grad(prog, t.brand, t.accent, 0)
        if eyebrow:
            e = self.pill(s, 0.75, 0.55, f"{k:02d} · {eyebrow.upper()}", t.brand, 11, t.tints[0])
            anims.append((e.shape_id, "zoom", 0, 450))
        if title:
            size = title_size if len(title) <= 38 else title_size - 6 if len(title) <= 60 else title_size - 10
            tt = self.text(s, 0.75, 1.05, title_w, 1.1, title, size, None, FONT_HEAD, highlight=highlight, line=1.0)
            anims.append((tt.shape_id, "words", 150, 650))
        self.text(s, 0.75, 6.98, 7, 0.3, f"{self.meta.get('team', '')}  ·  {self.meta.get('event', '')}", 10, t.muted)
        self.text(s, W - 2.25, 6.98, 1.5, 0.3, f"{k:02d} / {self.total:02d}", 10, t.muted, FONT_MONO, align="r")
        return s, anims

    def finish(self, slide, anims, notes=None):
        set_transition(slide, "morph", 1000)
        add_animations(slide, anims)
        if notes:
            slide.notes_slide.notes_text_frame.text = notes

    # ================================================================ layouts
    def s_title(self, d):
        s, a = self.new_slide()
        t = self.t
        cx, cy = 10.35, 3.55
        rings = []
        for i, (dd, col, wdt) in enumerate(((4.6, t.brand, 1.5), (3.7, t.accent, 2.25), (5.5, t.warm, 1.25))):
            r = self.shape(s, MSO_SHAPE.OVAL, cx - dd / 2, cy - dd / 2, dd, dd, line=col, line_w=wdt)
            if i == 2:
                etree.SubElement(r.line._get_or_add_ln(), qn("a:prstDash"), val="dash")
            rings.append(r)
        sphere = self.shape(s, MSO_SHAPE.OVAL, cx - 1.35, cy - 1.35, 2.7, 2.7, fill=t.brand)
        self.grad(sphere, t.brand, t.accent, 45)
        self.shadow(sphere, blur=0.6, dist=0.15, alpha=25)
        shine = self.shape(s, MSO_SHAPE.OVAL, cx - 0.85, cy - 1.0, 0.9, 0.55, fill="FFFFFF", alpha=35)
        self.soft(shine, 0.2)
        a += [(sphere.shape_id, "zoom", 200, 900), (shine.shape_id, "fade", 900, 600)]
        for i, r in enumerate(rings):
            a.append((r.shape_id, "zoom", 450 + i * 150, 900))
            a.append((r.shape_id, "spin_loop", 1500 + i * 100, 26000 + i * 9000))
        for i in range(6):
            ang = i * math.pi / 3 + 0.4
            rr = 2.3 if i % 2 else 2.75
            dsz = 0.22 if i % 2 else 0.32
            dot = self.shape(s, MSO_SHAPE.OVAL, cx + rr * math.cos(ang) - dsz / 2, cy + rr * math.sin(ang) - dsz / 2, dsz, dsz, fill=t.c(i))
            a.append((dot.shape_id, "zoom", 900 + i * 90, 400))
            a.append((dot.shape_id, "float_loop", 1400 + i * 120, 2600 + i * 300, {"dx": 0.01 * (1 if i % 2 else -1), "dy": 0.018}))
        a.append((sphere.shape_id, "float_loop", 1600, 3600, {"dx": 0.0, "dy": 0.015}))
        tag = d.get("tag") or self.meta.get("event", "")
        if tag:
            p = self.pill(s, 0.75, 1.35, tag.upper(), t.brand, 11, t.tints[0])
            a.append((p.shape_id, "zoom", 0, 450))
        title = d["title"]
        size = 54 if len(title) <= 26 else 46 if len(title) <= 44 else 38
        tt = self.text(s, 0.75, 1.95, 7.6, 2.8, title, size, None, FONT_HEAD, highlight=d.get("highlight"), line=0.98, anchor="m")
        a.append((tt.shape_id, "words", 250, 700))
        if d.get("subtitle"):
            st = self.text(s, 0.75, 4.85, 7.2, 1.0, d["subtitle"], 18, t.muted, line=1.2)
            a.append((st.shape_id, "rise", 1100, 700))
        bar = self.shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.75, 5.95, 0.09, 0.72, fill=t.brand, radius=0.5)
        self.grad(bar, t.brand, t.accent, 90)
        team = self.text(s, 1.02, 5.9, 6, 0.42, self.meta.get("team", ""), 20, None, FONT_HEAD)
        mem = self.text(s, 1.02, 6.32, 7, 0.35, "  ·  ".join(self.meta.get("members", [])), 13, t.muted)
        a += [(bar.shape_id, "wipe_up", 1400, 400), (team.shape_id, "left", 1450, 600), (mem.shape_id, "left", 1550, 600)]
        self.finish(s, a, d.get("notes"))

    def s_statement(self, d):
        stat = d.get("stat")
        s, a = self.new_slide(d.get("eyebrow", "The problem"))
        t = self.t
        txt = d["text"]
        w = 7.9 if stat else 11.6
        if stat:
            size = 40 if len(txt) <= 70 else 33 if len(txt) <= 120 else 28
        else:
            size = 46 if len(txt) <= 70 else 38 if len(txt) <= 120 else 31
        q = self.text(s, 0.6, 0.85, 1.4, 1.4, "“", 120, None, "Georgia", bold=True, grad=(t.brand, t.accent))
        a.append((q.shape_id, "zoom", 0, 500))
        tt = self.text(s, 0.75, 1.95, w, 3.2, txt, size, None, FONT_HEAD, highlight=d.get("highlight"), line=1.05, anchor="m")
        a.append((tt.shape_id, "words", 200, 650))
        if d.get("sub"):
            st = self.text(s, 0.75, 5.35, w, 1.1, d["sub"], 17, t.muted, line=1.2)
            a.append((st.shape_id, "rise", 1300, 600))
        if stat:
            c = self.card(s, 9.15, 2.0, 3.45, 3.6, radius=0.1)
            band = self.shape(s, MSO_SHAPE.RECTANGLE, 9.5, 2.0, 2.75, 0.09, fill=t.warm)
            self.grad(band, t.warm, t.pop, 0)
            v = str(stat["value"])
            num = self.text(s, 9.25, 2.4, 3.25, 1.6, v, 64 if len(v) <= 4 else 50, None, FONT_NUM, align="c", anchor="m", grad=(t.warm, t.pop))
            lab = self.text(s, 9.45, 4.05, 2.85, 1.3, stat.get("label", ""), 14, t.muted, align="c", line=1.15)
            a += [(c.shape_id, "rise", 700, 600), (band.shape_id, "wipe", 1000, 400), (num.shape_id, "zoom", 1050, 600),
                  (num.shape_id, "pulse", 1750, 300, {"by": 112}), (lab.shape_id, "fade", 1200, 500)]
        self.finish(s, a, d.get("notes"))

    def s_cards(self, d):
        s, a = self.new_slide(d.get("eyebrow"), d["title"], d.get("highlight"))
        t = self.t
        y0 = 2.3
        if d.get("intro"):
            it = self.text(s, 0.75, 2.05, 11.5, 0.6, d["intro"], 16, t.muted)
            a.append((it.shape_id, "fade", 600, 600))
            y0 = 2.85
        cards = d["cards"][:4]
        n = len(cards)
        gap = 0.32
        cw = (W - 1.5 - gap * (n - 1)) / n
        longest = max(len(c.get("text", "")) for c in cards)
        ch = min(6.65 - y0, 2.6 + 0.3 * math.ceil(longest / max(16, (cw - 0.7) * 11)))
        for i, c in enumerate(cards):
            x = 0.75 + i * (cw + gap)
            base = 800 + i * 220
            box = self.card(s, x, y0, cw, ch)
            strip = self.shape(s, MSO_SHAPE.RECTANGLE, x + 0.35, y0 + ch - 0.14, cw - 0.7, 0.05, fill=t.c(i))
            self.grad(strip, *t.pair(i), angle=0)
            icon = c.get("icon")
            bd = self.badge(s, x + 0.35, y0 + 0.35, 0.72, icon or i + 1, i, emoji=bool(icon))
            num = self.text(s, x + cw - 0.95, y0 + 0.42, 0.6, 0.4, f"{i + 1:02d}", 12, t.c(i), FONT_MONO, bold=True, align="r")
            ti = self.text(s, x + 0.35, y0 + 1.3, cw - 0.7, 0.55, c["title"], 20 if cw > 3.5 else 18, None, FONT_HEAD)
            tx = self.text(s, x + 0.35, y0 + 1.88, cw - 0.7, ch - 2.15, c.get("text", ""), 14 if cw > 3.5 else 13, t.muted, line=1.2)
            a += [(box.shape_id, "rise", base, 650), (bd.shape_id, "zoom", base + 250, 450),
                  (bd.shape_id, "pulse", base + 700, 250, {"by": 115}), (num.shape_id, "fade", base + 300, 400),
                  (ti.shape_id, "rise", base + 300, 500), (tx.shape_id, "fade", base + 420, 500),
                  (strip.shape_id, "wipe", base + 500, 500)]
        self.finish(s, a, d.get("notes"))

    def s_bullets(self, d):
        s, a = self.new_slide(d.get("eyebrow"), d["title"], d.get("highlight"))
        t = self.t
        side = d.get("side")
        width = 7.6 if side else 11.5
        bullets = d["bullets"][:6]
        step = min(0.8, 4.4 / max(1, len(bullets)))
        for i, b in enumerate(bullets):
            y = 2.35 + i * step
            dot = self.shape(s, MSO_SHAPE.OVAL, 0.8, y + 0.08, 0.22, 0.22, fill=t.c(i))
            self.grad(dot, *t.pair(i))
            tx = self.text(s, 1.25, y, width - 0.5, step, b, 18 if len(b) < 90 else 16, None, line=1.15)
            a += [(dot.shape_id, "zoom", 800 + i * 170, 350), (tx.shape_id, "left", 850 + i * 170, 550)]
        if side:
            c = self.card(s, 8.9, 2.3, 3.7, 3.9, radius=0.1)
            v = str(side["value"])
            num = self.text(s, 9.1, 2.7, 3.3, 1.6, v, 66 if len(v) <= 4 else 50, None, FONT_NUM, align="c", anchor="m", grad=t.pair(0))
            lab = self.text(s, 9.15, 4.4, 3.2, 1.5, side.get("label", ""), 15, t.muted, align="c", line=1.15)
            d0 = 900 + len(bullets) * 170
            a += [(c.shape_id, "rise", d0, 600), (num.shape_id, "zoom", d0 + 250, 600),
                  (num.shape_id, "pulse", d0 + 900, 300, {"by": 112}), (lab.shape_id, "fade", d0 + 400, 500)]
        self.finish(s, a, d.get("notes"))

    def s_flow(self, d):
        s, a = self.new_slide(d.get("eyebrow", "How it works"), d["title"], d.get("highlight"))
        t = self.t
        steps = d["steps"][:6]
        n = len(steps)
        gap = 0.45
        bw = (W - 1.5 - gap * (n - 1)) / n
        longest = max(len(st.get("text", "")) for st in steps)
        bh = min(4.0, 2.35 + 0.3 * math.ceil(longest / max(14, bw * 8.5)))
        y = 2.35 + (4.3 - bh) / 2
        line = self.shape(s, MSO_SHAPE.RECTANGLE, 0.75 + bw / 2, y + 0.6, W - 1.5 - bw, 0.05, fill=t.brand)
        self.grad(line, t.brand, t.accent, 0)
        a.append((line.shape_id, "wipe", 700, 300 + 350 * n))
        for i, st in enumerate(steps):
            x = 0.75 + i * (bw + gap)
            base = 800 + i * 350
            box = self.card(s, x, y + 0.6, bw, bh - 0.6, radius=0.08)
            bd = self.badge(s, x + bw / 2 - 0.4, y + 0.2, 0.8, i + 1, i)
            ti = self.text(s, x + 0.18, y + 1.3, bw - 0.36, 0.6, st["title"], 17 if bw > 2 else 15, None, FONT_HEAD, align="c")
            tx = self.text(s, x + 0.18, y + 1.92, bw - 0.36, bh - 2.0, st.get("text", ""), 12.5 if bw > 2 else 11.5, t.muted, align="c", line=1.15)
            bottom = self.shape(s, MSO_SHAPE.RECTANGLE, x + 0.4, y + bh - 0.13, bw - 0.8, 0.05, fill=t.c(i))
            a += [(box.shape_id, "rise", base, 550), (bd.shape_id, "zoom", base + 120, 450),
                  (bd.shape_id, "pulse", base + 560, 250, {"by": 115}), (ti.shape_id, "fade", base + 250, 450),
                  (tx.shape_id, "fade", base + 350, 450), (bottom.shape_id, "wipe", base + 400, 350)]
        self.finish(s, a, d.get("notes"))

    def s_stats(self, d):
        s, a = self.new_slide(d.get("eyebrow", "Results"), d["title"], d.get("highlight"))
        t = self.t
        stats = d["stats"][:4]
        n = len(stats)
        gap = 0.32
        cw = (W - 1.5 - gap * (n - 1)) / n
        for i, st in enumerate(stats):
            x = 0.75 + i * (cw + gap)
            base = 800 + i * 230
            c = self.card(s, x, 2.45, cw, 3.25, radius=0.09)
            tint = self.shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x + 0.25, 2.7, cw - 0.5, 1.75, fill=t.tints[i % 4], radius=0.12)
            v = str(st["value"])
            size = 60 if len(v) <= 4 else 46 if len(v) <= 6 else 36
            num = self.text(s, x + 0.2, 2.75, cw - 0.4, 1.65, v, size, None, FONT_NUM, align="c", anchor="m", grad=t.pair(i))
            bar = self.shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, x + cw / 2 - 0.45, 4.62, 0.9, 0.07, fill=t.c(i), radius=0.5)
            lab = self.text(s, x + 0.3, 4.85, cw - 0.6, 0.85, st.get("label", ""), 14.5, t.muted, align="c", line=1.15)
            a += [(c.shape_id, "rise", base, 600), (tint.shape_id, "fade", base + 200, 500), (num.shape_id, "zoom", base + 300, 600),
                  (num.shape_id, "pulse", base + 1000, 280, {"by": 112}), (bar.shape_id, "wipe", base + 550, 400),
                  (lab.shape_id, "fade", base + 600, 500)]
        if d.get("note"):
            nt = self.text(s, 0.75, 6.0, 11.8, 0.6, d["note"], 12.5, t.muted, align="c")
            a.append((nt.shape_id, "fade", 1000 + n * 230, 600))
        self.finish(s, a, d.get("notes"))

    def s_image(self, d):
        s, a = self.new_slide(d.get("eyebrow", "Live demo"), d["title"], d.get("highlight"))
        t = self.t
        pts = d.get("points", [])[:4]
        maxw = 8.15 if pts else 11.8
        ix, iy, ih_max = 0.75, 2.5, 3.95
        img = Path(d.get("image", ""))
        ar = 0.625
        if img.is_file():
            from PIL import Image
            with Image.open(img) as im:
                ar = im.height / im.width
        w, h = maxw, maxw * ar
        if h > ih_max:
            h, w = ih_max, ih_max / ar
        ch = 0.38
        frame = self.card(s, ix - 0.04, iy - ch, w + 0.08, h + ch + 0.04, fill=t.card, radius=0.03)
        barr = self.shape(s, MSO_SHAPE.RECTANGLE, ix, iy - ch + 0.03, w, ch - 0.06, fill=t.faint)
        a += [(frame.shape_id, "zoom", 700, 650), (barr.shape_id, "fade", 900, 400)]
        for j, col in enumerate(("FF5F57", "FEBC2E", "28C840")):
            lt = self.shape(s, MSO_SHAPE.OVAL, ix + 0.15 + j * 0.2, iy - ch + 0.13, 0.12, 0.12, fill=col)
            a.append((lt.shape_id, "zoom", 1000 + j * 80, 250))
        url = d.get("url", "localhost:5173")
        up = self.pill(s, ix + w / 2 - self.pill_w(url, 8) / 2, iy - ch + 0.07, url, t.muted, 8, t.card, h=0.24)
        a.append((up.shape_id, "fade", 1000, 400))
        if img.is_file():
            pic = s.shapes.add_picture(str(img), Inches(ix), Inches(iy), Inches(w), Inches(h))
            a.append((pic.shape_id, "fade", 1100, 700))
        else:
            ph = self.text(s, ix, iy + h / 2 - 0.3, w, 0.6, f"[ screenshot missing: {img.name or 'set image path'} ]", 14, t.muted, FONT_MONO, align="c")
            a.append((ph.shape_id, "fade", 1100, 500))
        if d.get("caption"):
            cap = self.text(s, ix, iy + h + 0.12, w, 0.3, d["caption"], 11, t.muted, FONT_MONO)
            a.append((cap.shape_id, "fade", 1500, 500))
        for i, p in enumerate(pts):
            y = 2.15 + i * 1.12
            base = 1600 + i * 220
            c = self.card(s, 9.3, y, 3.3, 0.98, radius=0.14)
            bd = self.badge(s, 9.45, y + 0.21, 0.56, i + 1, i)
            tx = self.text(s, 10.15, y + 0.1, 2.35, 0.8, p, 12.5, None, anchor="m", line=1.1)
            a += [(c.shape_id, "right", base, 500), (bd.shape_id, "zoom", base + 200, 400), (tx.shape_id, "fade", base + 250, 450),
                  (bd.shape_id, "pulse", base + 600, 220, {"by": 118})]
        self.finish(s, a, d.get("notes"))

    def s_compare(self, d):
        s, a = self.new_slide(d.get("eyebrow", "Why it's better"), d["title"], d.get("highlight"))
        t = self.t
        L, R = d["left"], d["right"]
        lc = self.card(s, 0.75, 2.35, 5.75, 4.3, fill=t.faint, border=t.border, shadow=False, radius=0.04)
        lt = self.text(s, 1.15, 2.62, 5, 0.5, L["title"], 20, t.muted, FONT_HEAD)
        a += [(lc.shape_id, "left", 700, 600), (lt.shape_id, "fade", 900, 400)]
        for i, it in enumerate(L["items"][:5]):
            yy = 3.35 + i * 0.62
            mk = self.shape(s, MSO_SHAPE.OVAL, 1.15, yy + 0.05, 0.32, 0.32, fill="FDE2E2")
            mt = self.text(s, 1.15, yy + 0.03, 0.32, 0.34, "✕", 12, "DC2626", FONT_HEAD, align="c", anchor="m")
            tx = self.text(s, 1.65, yy, 4.6, 0.45, it, 15, t.muted, anchor="m")
            a += [(mk.shape_id, "zoom", 1000 + i * 140, 300), (mt.shape_id, "zoom", 1000 + i * 140, 300), (tx.shape_id, "fade", 1050 + i * 140, 400)]
        d0 = 1300 + len(L["items"][:5]) * 140
        rc = self.card(s, 6.83, 2.2, 5.75, 4.55, border=t.brand, line_w=2, radius=0.04)
        head = self.shape(s, MSO_SHAPE.RECTANGLE, 6.84, 2.21, 5.73, 0.85, fill=t.brand)
        self.grad(head, t.brand, t.accent, 0)
        rt = self.text(s, 7.2, 2.21, 5, 0.85, R["title"], 21, "FFFFFF", FONT_HEAD, anchor="m")
        a += [(rc.shape_id, "right", d0, 650), (head.shape_id, "wipe", d0 + 300, 500), (rt.shape_id, "fade", d0 + 450, 400)]
        for i, it in enumerate(R["items"][:5]):
            yy = 3.45 + i * 0.62
            mk = self.shape(s, MSO_SHAPE.OVAL, 7.2, yy + 0.05, 0.32, 0.32, fill="10B981")
            mt = self.text(s, 7.2, yy + 0.03, 0.32, 0.34, "✓", 12, "FFFFFF", FONT_HEAD, align="c", anchor="m")
            tx = self.text(s, 7.7, yy, 4.6, 0.45, it, 15, None, anchor="m")
            b = d0 + 650 + i * 160
            a += [(mk.shape_id, "zoom", b, 300), (mt.shape_id, "zoom", b, 300), (tx.shape_id, "left", b + 50, 450)]
        a.append((rc.shape_id, "pulse", d0 + 900 + len(R["items"][:5]) * 160, 300, {"by": 103}))
        self.finish(s, a, d.get("notes"))

    def s_table(self, d):
        s, a = self.new_slide(d.get("eyebrow", "Comparison"), d["title"], d.get("highlight"))
        t = self.t
        cols, rows = d["columns"], d["rows"]
        hl = d.get("highlight_col")
        nr, nc = len(rows) + 1, len(cols)
        h = min(4.0, 0.62 * nr)
        tw, tx0, ty0 = 11.8, 0.75, 2.55
        c = self.card(s, tx0 - 0.1, ty0 - 0.1, tw + 0.2, h + 0.2, radius=0.04)
        a.append((c.shape_id, "rise", 700, 600))
        gf = s.shapes.add_table(nr, nc, Inches(tx0), Inches(ty0), Inches(tw), Inches(h))
        tbl = gf.table
        tblPr = tbl._tbl.tblPr
        tblPr.set("bandRow", "0")
        tblPr.set("firstRow", "0")
        sid = tblPr.find(qn("a:tableStyleId"))
        if sid is None:
            sid = etree.SubElement(tblPr, qn("a:tableStyleId"))
        sid.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"
        for r in range(nr):
            for ci in range(nc):
                cell = tbl.cell(r, ci)
                val = cols[ci] if r == 0 else (str(rows[r - 1][ci]) if ci < len(rows[r - 1]) else "")
                cell.text = ""
                p = cell.text_frame.paragraphs[0]
                p.alignment = PP_ALIGN.LEFT if ci == 0 else PP_ALIGN.CENTER
                run = p.add_run()
                run.text = val
                is_hl = hl is not None and ci == hl
                run.font.size = Pt(14 if r else 13)
                run.font.name = FONT_HEAD if (r == 0 or ci == 0 or is_hl) else FONT_BODY
                run.font.color.rgb = rgb("FFFFFF" if r == 0 else (t.brand if is_hl else t.text if ci == 0 else t.muted))
                run.font.bold = bool(is_hl and r > 0)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
                cell.margin_left = cell.margin_right = Inches(0.16)
                cell.fill.solid()
                cell.fill.fore_color.rgb = rgb((t.pop if is_hl else t.brand) if r == 0 else (t.tints[0] if is_hl else (t.card if r % 2 else t.faint)))
        a.append((gf.shape_id, "fade", 1000, 700))
        if hl is not None:
            colw = tw / nc
            label = "★ BEST"
            star = self.pill(s, tx0 + colw * hl + colw / 2 - self.pill_w(label, 10) / 2, ty0 - 0.52, label, "FFFFFF", 10, t.pop)
            a += [(star.shape_id, "drop", 1700, 500), (star.shape_id, "pulse", 2250, 300, {"by": 115})]
        self.finish(s, a, d.get("notes"))

    def s_timeline(self, d):
        s, a = self.new_slide(d.get("eyebrow", "Roadmap"), d["title"], d.get("highlight"))
        t = self.t
        phases = d["phases"][:5]
        n = len(phases)
        seg = (W - 1.9) / n
        line = self.shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, 0.95, 3.45, W - 1.9, 0.08, fill=t.brand, radius=0.5)
        self.grad(line, t.brand, t.warm, 0)
        a.append((line.shape_id, "wipe", 700, 400 + 300 * n))
        for i, ph in enumerate(phases):
            cx = 0.95 + seg * i + seg / 2
            base = 800 + i * 300
            halo = self.shape(s, MSO_SHAPE.OVAL, cx - 0.5, 2.99, 1.0, 1.0, fill=t.c(i), alpha=20)
            bd = self.badge(s, cx - 0.33, 3.16, 0.66, i + 1, i)
            longest = max(len(p.get("text", "")) for p in phases)
            c = self.card(s, cx - seg / 2 + 0.12, 4.25, seg - 0.24, min(2.4, 1.2 + 0.3 * math.ceil(longest / max(14, (seg - 0.5) * 9))), radius=0.1)
            ti = self.text(s, cx - seg / 2 + 0.25, 4.45, seg - 0.5, 0.5, ph["title"], 17, t.c(i) if i % 4 != 2 else t.text, FONT_HEAD, align="c")
            tx = self.text(s, cx - seg / 2 + 0.25, 5.0, seg - 0.5, 1.5, ph.get("text", ""), 12.5, t.muted, align="c", line=1.15)
            a += [(halo.shape_id, "zoom", base, 500), (bd.shape_id, "zoom", base + 100, 450), (bd.shape_id, "pulse", base + 550, 250, {"by": 115}),
                  (c.shape_id, "rise", base + 150, 550), (ti.shape_id, "fade", base + 300, 400), (tx.shape_id, "fade", base + 400, 450)]
        self.finish(s, a, d.get("notes"))

    def s_closing(self, d):
        s, a = self.new_slide()
        t = self.t
        rnd = random.Random(11)
        placed = 0
        for i in range(60):
            if placed >= 26:
                break
            x, y = rnd.uniform(0.3, W - 0.5), rnd.uniform(0.3, 6.6)
            if 1.6 < x < 11.6 and 1.2 < y < 6.5:
                continue
            placed += 1
            sz = rnd.uniform(0.09, 0.22)
            oval = placed % 3 != 0
            kind = MSO_SHAPE.OVAL if oval else MSO_SHAPE.ROUNDED_RECTANGLE
            cf = self.shape(s, kind, x, y, sz, sz * (1 if oval else 1.8), fill=t.c(placed), alpha=85)
            if not oval:
                cf.rotation = rnd.uniform(0, 180)
            a.append((cf.shape_id, "zoom", 1200 + placed * 45, 350))
            if placed % 2:
                a.append((cf.shape_id, "float_loop", 1800 + placed * 40, 2400 + (placed % 5) * 400, {"dx": round(rnd.uniform(-0.01, 0.01), 4), "dy": 0.015}))
        tt = self.text(s, 0.75, 1.55, 11.8, 1.9, d.get("title", "Thank you"), 80, None, FONT_HEAD, align="c",
                       highlight=d.get("highlight"), anchor="m")
        a += [(tt.shape_id, "words", 100, 800), (tt.shape_id, "pulse", 1400, 350, {"by": 106})]
        if d.get("sub"):
            st = self.text(s, 1.5, 3.55, 10.3, 0.9, d["sub"], 20, t.muted, align="c")
            a.append((st.shape_id, "rise", 900, 650))
        line = self.shape(s, MSO_SHAPE.ROUNDED_RECTANGLE, W / 2 - 1.2, 4.6, 2.4, 0.07, fill=t.brand, radius=0.5)
        self.grad(line, t.brand, t.accent, 0)
        team = self.text(s, 0.75, 4.85, 11.8, 0.55, self.meta.get("team", ""), 26, None, FONT_HEAD, align="c", grad=t.pair(0))
        mem = self.text(s, 0.75, 5.4, 11.8, 0.4, "  ·  ".join(self.meta.get("members", [])), 15, t.muted, align="c")
        a += [(line.shape_id, "wipe", 1100, 450), (team.shape_id, "rise", 1250, 600), (mem.shape_id, "rise", 1350, 600)]
        if d.get("contact"):
            cp = self.pill(s, W / 2 - self.pill_w(d["contact"], 11) / 2, 6.0, d["contact"], t.brand, 11, t.tints[0])
            a.append((cp.shape_id, "zoom", 1700, 450))
        self.finish(s, a, d.get("notes"))

    # ================================================================ build
    def build(self, slides, out: Path) -> Path:
        self.total = len(slides)
        for d in slides:
            fn = getattr(self, f"s_{d['type']}", None)
            if fn is None:
                raise SystemExit(f"Unknown slide type: {d['type']}")
            fn(d)
        out.parent.mkdir(parents=True, exist_ok=True)
        target, v = out, 2
        while True:
            try:
                self.prs.save(target)
                break
            except PermissionError:  # open in PowerPoint -> save a new version instead
                target = out.with_name(f"{out.stem}_v{v}{out.suffix}")
                v += 1
        if target != out:
            print(f"NOTE: {out.name} is open in PowerPoint, saved as {target.name} instead")
        return target


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = json.loads(src.read_text(encoding="utf-8-sig"))
    base = src.parent
    for sl in spec["slides"]:  # image paths are relative to the json file
        if sl.get("image") and not Path(sl["image"]).is_absolute():
            sl["image"] = str((base / sl["image"]).resolve())
    deck = Deck(spec.get("meta", {}), base)
    saved = deck.build(spec["slides"], out)
    t = deck.t
    print(f"OK  {saved}  ({len(spec['slides'])} slides, {'dark' if t.dark else 'light'} theme, "
          f"palette #{t.brand} #{t.accent} #{t.warm} #{t.pop})")


if __name__ == "__main__":
    main()
