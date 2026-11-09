"""
Low-level PowerPoint XML helpers used by make_deck.py:
  * set_transition(slide, kind)   -> morph (with fade fallback), fade, push, zoom
  * add_animations(slide, items)  -> entrance effects that play automatically
                                     after the slide appears (no extra clicks)
python-pptx has no animation API, so we write the same XML PowerPoint writes.
"""
from __future__ import annotations

from lxml import etree

NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
NS_P159 = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"


def _strip_existing(slide) -> None:
    sld = slide._element
    for tag in (f"{{{NS_P}}}transition", f"{{{NS_P}}}timing", f"{{{NS_MC}}}AlternateContent"):
        for el in sld.findall(tag):
            sld.remove(el)


def _insert_after_clrmap(slide, el) -> None:
    sld = slide._element
    clr = sld.find(f"{{{NS_P}}}clrMapOvr")
    if clr is not None:
        clr.addnext(el)
    else:
        sld.find(f"{{{NS_P}}}cSld").addnext(el)


def set_transition(slide, kind: str = "morph", dur_ms: int = 1100) -> None:
    """Call BEFORE add_animations (order in the XML matters: transition, then timing)."""
    for el in slide._element.findall(f"{{{NS_MC}}}AlternateContent") + slide._element.findall(f"{{{NS_P}}}transition"):
        slide._element.remove(el)
    if kind == "morph":
        xml = (
            f'<mc:AlternateContent xmlns:mc="{NS_MC}">'
            f'<mc:Choice xmlns:p159="{NS_P159}" xmlns:p14="{NS_P14}" Requires="p159">'
            f'<p:transition xmlns:p="{NS_P}" spd="slow" p14:dur="{dur_ms}"><p159:morph option="byObject"/></p:transition>'
            f"</mc:Choice>"
            f'<mc:Fallback><p:transition xmlns:p="{NS_P}" spd="slow"><p:fade/></p:transition></mc:Fallback>'
            f"</mc:AlternateContent>"
        )
    else:
        inner = {"fade": "<p:fade/>", "push": '<p:push dir="u"/>', "zoom": "<p:zoom/>", "wipe": '<p:wipe dir="r"/>'}.get(kind, "<p:fade/>")
        xml = f'<p:transition xmlns:p="{NS_P}" spd="med">{inner}</p:transition>'
    _insert_after_clrmap(slide, etree.fromstring(xml))


# ------------------------------- animations --------------------------------
class _Ids:
    def __init__(self) -> None:
        self.n = 2  # 1 = root, 2 = main sequence

    def next(self) -> int:
        self.n += 1
        return self.n


def _vis(ids: _Ids, spid: int) -> str:
    return (
        f'<p:set><p:cBhvr><p:cTn id="{ids.next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
        f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>'
        f'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
    )


def _fade(ids: _Ids, spid: int, dur: int) -> str:
    return (
        f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>'
        f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
    )


def _prop(ids: _Ids, spid: int, attr: str, frm: str, to: str, dur: int, decel: bool = True) -> str:
    d = ' decel="100000"' if decel else ""
    return (
        f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ids.next()}" dur="{dur}"{d} fill="hold"/>'
        f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>'
        f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>'
        f'<p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst></p:anim>'
    )


# effect name -> (presetID, presetSubtype, builder)
def _effect_body(ids: _Ids, effect: str, spid: int, dur: int) -> tuple[int, int, str]:
    if effect == "fade":
        return 10, 0, _vis(ids, spid) + _fade(ids, spid, dur)
    if effect == "rise":  # PowerPoint "Ascend": fade + move up
        return 47, 0, (_vis(ids, spid) + _fade(ids, spid, dur)
                       + _prop(ids, spid, "ppt_x", "#ppt_x", "#ppt_x", dur)
                       + _prop(ids, spid, "ppt_y", "#ppt_y+.08", "#ppt_y", dur))
    if effect == "left":  # fade + slide in from the left a little
        return 47, 0, (_vis(ids, spid) + _fade(ids, spid, dur)
                       + _prop(ids, spid, "ppt_x", "#ppt_x-.06", "#ppt_x", dur)
                       + _prop(ids, spid, "ppt_y", "#ppt_y", "#ppt_y", dur))
    if effect == "zoom":  # grow from 0 + fade
        return 53, 16, (_vis(ids, spid)
                        + _prop(ids, spid, "ppt_w", "0", "#ppt_w", dur)
                        + _prop(ids, spid, "ppt_h", "0", "#ppt_h", dur)
                        + _fade(ids, spid, dur))
    if effect == "wipe":  # reveal left -> right (good for arrows, bars, lines)
        return 22, 8, (_vis(ids, spid)
                       + f'<p:animEffect transition="in" filter="wipe(left)"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>'
                         f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')
    raise ValueError(f"unknown effect {effect}")


def add_animations(slide, items: list[tuple[int, str, int, int]]) -> None:
    """
    items: [(shape_id, effect, delay_ms, duration_ms), ...]
    effect: fade | rise | left | zoom | wipe
    All effects start automatically when the slide appears ("With Previous" + delay).
    """
    for el in slide._element.findall(f"{{{NS_P}}}timing"):
        slide._element.remove(el)
    if not items:
        return
    ids = _Ids()
    outer_id = ids.next()  # click-group par
    inner_id = ids.next()  # step par
    effects = []
    for i, (spid, effect, delay, dur) in enumerate(items):
        ctn_id = ids.next()
        preset, sub, body = _effect_body(ids, effect, spid, dur)
        node = "afterEffect" if i == 0 else "withEffect"
        effects.append(
            f'<p:par><p:cTn id="{ctn_id}" presetID="{preset}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
        )
    xml = (
        f'<p:timing xmlns:p="{NS_P}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'<p:par><p:cTn id="{outer_id}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        f'<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="{inner_id}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        + "".join(effects)
        + "</p:childTnLst></p:cTn></p:par>"
        + "</p:childTnLst></p:cTn></p:par>"
        + "</p:childTnLst></p:cTn>"
        + '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        + '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>'
        + "</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>"
        + "</p:timing>"
    )
    sld = slide._element
    # timing must come after transition / AlternateContent, before extLst
    ext = sld.find(f"{{{NS_P}}}extLst")
    el = etree.fromstring(xml)
    if ext is not None:
        ext.addprevious(el)
    else:
        sld.append(el)
