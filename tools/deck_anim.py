"""
Low-level PowerPoint animation XML used by make_deck.py (python-pptx has no animation API,
so we write the same XML PowerPoint itself writes).

  set_transition(slide, kind)      morph (fade fallback) | fade | push | zoom | wipe
  add_animations(slide, items)     everything plays AUTOMATICALLY when the slide appears

items: list of (shape_id, effect, delay_ms, duration_ms[, opts])
  entrance : fade | rise | left | right | drop | zoom | wipe | wipe_up | words (rise word-by-word)
  emphasis : pulse (grow 110% and back) | spin_loop (slow endless rotation) | float_loop (endless gentle drift)
  opts     : {"by": 112} for pulse size, {"dx": .02, "dy": .03} for float, {"repeat": "indefinite"}
"""
from __future__ import annotations

from lxml import etree

NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
NS_P159 = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"


def _insert_after_clrmap(slide, el) -> None:
    sld = slide._element
    clr = sld.find(f"{{{NS_P}}}clrMapOvr")
    (clr if clr is not None else sld.find(f"{{{NS_P}}}cSld")).addnext(el)


def set_transition(slide, kind: str = "morph", dur_ms: int = 1100) -> None:
    """Call BEFORE add_animations (XML order: transition, then timing)."""
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


class _Ids:
    def __init__(self) -> None:
        self.n = 2  # 1 = root, 2 = main sequence

    def next(self) -> int:
        self.n += 1
        return self.n


def _tgt(spid):
    return f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'


def _vis(ids, spid):
    return (f'<p:set><p:cBhvr><p:cTn id="{ids.next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'{_tgt(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:to><p:strVal val="visible"/></p:to></p:set>')


def _fade(ids, spid, dur):
    return (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>'
            f'{_tgt(spid)}</p:cBhvr></p:animEffect>')


def _prop(ids, spid, attr, frm, to, dur, decel=True):
    d = ' decel="100000"' if decel else ""
    return (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ids.next()}" dur="{dur}"{d} fill="hold"/>'
            f'{_tgt(spid)}<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>'
            f'<p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst></p:anim>')


def _move(ids, spid, dur, fx="#ppt_x", fy="#ppt_y"):
    return _prop(ids, spid, "ppt_x", fx, "#ppt_x", dur) + _prop(ids, spid, "ppt_y", fy, "#ppt_y", dur)


def _effect(ids, effect, spid, dur, o):
    """returns (presetClass, presetID, presetSubtype, body, extra cTn attrs, iterate xml)"""
    if effect == "fade":
        return "entr", 10, 0, _vis(ids, spid) + _fade(ids, spid, dur), "", ""
    if effect in ("rise", "words"):
        it = '<p:iterate type="wd"><p:tmPct val="12000"/></p:iterate>' if effect == "words" else ""
        return "entr", 47, 0, _vis(ids, spid) + _fade(ids, spid, dur) + _move(ids, spid, dur, fy="#ppt_y+.06"), "", it
    if effect == "drop":
        return "entr", 47, 0, _vis(ids, spid) + _fade(ids, spid, dur) + _move(ids, spid, dur, fy="#ppt_y-.06"), "", ""
    if effect == "left":
        return "entr", 47, 0, _vis(ids, spid) + _fade(ids, spid, dur) + _move(ids, spid, dur, fx="#ppt_x-.05"), "", ""
    if effect == "right":
        return "entr", 47, 0, _vis(ids, spid) + _fade(ids, spid, dur) + _move(ids, spid, dur, fx="#ppt_x+.05"), "", ""
    if effect == "zoom":
        return "entr", 53, 16, (_vis(ids, spid) + _prop(ids, spid, "ppt_w", "0", "#ppt_w", dur)
                                + _prop(ids, spid, "ppt_h", "0", "#ppt_h", dur) + _fade(ids, spid, dur)), "", ""
    if effect in ("wipe", "wipe_up"):
        f = "wipe(left)" if effect == "wipe" else "wipe(down)"
        return "entr", 22, 8 if effect == "wipe" else 4, (_vis(ids, spid)
               + f'<p:animEffect transition="in" filter="{f}"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}"/>{_tgt(spid)}</p:cBhvr></p:animEffect>'), "", ""
    if effect == "pulse":
        by = int(o.get("by", 110) * 1000)
        return "emph", 6, 0, (f'<p:animScale><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"/>{_tgt(spid)}</p:cBhvr>'
                              f'<p:by x="{by}" y="{by}"/></p:animScale>'), ' autoRev="1"', ""
    if effect == "spin_loop":
        return "emph", 8, 0, (f'<p:animRot by="21600000"><p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"/>{_tgt(spid)}'
                              f'<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>'), f' repeatCount="{o.get("repeat", "indefinite")}"', ""
    if effect == "float_loop":
        dx, dy = o.get("dx", 0.02), o.get("dy", 0.03)
        return "path", 0, 0, (f'<p:animMotion origin="layout" path="M 0 0 L {dx} {dy} E" pathEditMode="relative" ptsTypes="">'
                              f'<p:cBhvr><p:cTn id="{ids.next()}" dur="{dur}" fill="hold"/>{_tgt(spid)}'
                              f'<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>'), \
            f' accel="50000" decel="50000" autoRev="1" repeatCount="{o.get("repeat", "indefinite")}"', ""
    raise ValueError(f"unknown effect {effect}")


def add_animations(slide, items) -> None:
    for el in slide._element.findall(f"{{{NS_P}}}timing"):
        slide._element.remove(el)
    if not items:
        return
    ids = _Ids()
    outer_id, inner_id = ids.next(), ids.next()
    effects, entr_ids = [], []
    items = sorted(items, key=lambda t: t[2])
    for i, it in enumerate(items):
        spid, effect, delay, dur = it[:4]
        opts = it[4] if len(it) > 4 else {}
        ctn = ids.next()
        cls, preset, sub, body, extra, iterate = _effect(ids, effect, spid, dur, opts)
        node = "afterEffect" if i == 0 else "withEffect"
        grp = ' grpId="0"' if cls == "entr" else ' grpId="1"'
        if cls == "entr":
            entr_ids.append(spid)
        effects.append(
            f'<p:par><p:cTn id="{ctn}" presetID="{preset}" presetClass="{cls}" presetSubtype="{sub}" fill="hold"{grp}{extra} nodeType="{node}">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst>{iterate}<p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
        )
    xml = (
        f'<p:timing xmlns:p="{NS_P}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        f'<p:par><p:cTn id="{outer_id}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        f'<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="{inner_id}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        + "".join(effects)
        + "</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>"
        + '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        + '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>'
        + "</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>"
    )
    el = etree.fromstring(xml)
    ext = slide._element.find(f"{{{NS_P}}}extLst")
    (ext.addprevious(el) if ext is not None else slide._element.append(el))
