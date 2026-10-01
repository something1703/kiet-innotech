"""
InnoTech hero background film: 17 photos from InnoTech'25, ~23 s, silent, seamless loop.

Story in four acts, fast cuts, every shot moving (ease-out Ken Burns), with a cyan flash and an RGB-split glitch
on each act change. Graded toward the brand: navy shadows, cyan lift, warm highlights. No text: the hero has its own.

  Act 1  IGNITE  sparks launch, ribbon cut, keynote, packed audience
  Act 2  BUILD   teams and their prototypes
  Act 3  PITCH   chief guest and jury at the stalls, drones, rovers, the press
         BURST   six 0.2 s flash cuts of the teams: the pressure before the result
  Act 4  WIN     the cheque, the trophies, the whole crew  -> flash -> loops to the sparks

Writes filter.txt and the input list for ffmpeg (see render.sh).
"""

FPS = 30
W, H = 1280, 720
T = 0.32  # transition length inside an act
A = 0.36  # transition length at an act change

# (photo, seconds, move, focus x, focus y, crop y)  move: in (push in), out (pull out), lr / rl (pan), zoom amount
SHOTS = [
    # Act 1: IGNITE
    (4, 2.3, "in", 0.78, 0.35, 0.0),  # sparks over the INNOTECH emblem
    (6, 1.5, "rl", 0.5, 0.35, 0.3),  # ribbon cutting
    (20, 1.5, "in", 0.3, 0.3, 0.2),  # keynote at the podium
    (15, 1.6, "out", 0.5, 0.5, 0.5),  # packed audience
    # Act 2: BUILD
    (8, 1.4, "lr", 0.5, 0.4, 0.2),  # hardware team
    (9, 1.4, "in", 0.45, 0.35, 0.2),  # smart helmet team
    (10, 1.3, "in", 0.62, 0.4, 0.3),  # VR art wall
    (11, 1.6, "out", 0.5, 0.45, 0.4),  # Innogeeks crew
    # Act 3: PITCH
    (12, 1.5, "in", 0.3, 0.4, 0.3),  # chief guest at a stall
    (16, 1.4, "rl", 0.5, 0.45, 0.4),  # drone lab demo
    (17, 1.4, "in", 0.55, 0.62, 0.5),  # rover demo
    (19, 1.4, "lr", 0.5, 0.45, 0.4),  # outdoor drone stall
    (13, 1.4, "in", 0.45, 0.7, 0.6),  # press mics
    # Burst: rapid-fire recap before the results
    (8, 0.24, "punch", 0.5, 0.35, 0.2),
    (12, 0.24, "punch", 0.6, 0.45, 0.3),
    (9, 0.24, "punch", 0.5, 0.3, 0.2),
    (16, 0.24, "punch", 0.6, 0.5, 0.4),
    (11, 0.24, "punch", 0.45, 0.45, 0.4),
    (19, 0.6, "punch", 0.55, 0.5, 0.4),
    # Act 4: WIN
    (7, 2.0, "in", 0.4, 0.72, 0.6),  # winners' cheque
    (18, 1.4, "out", 0.5, 0.4, 0.3),  # trophy
    (14, 1.4, "in", 0.5, 0.45, 0.4),  # memento
    (5, 2.7, "out", 0.5, 0.5, 0.45),  # the whole crew
]
TRANSITIONS = [
    "smoothleft", "smoothright", "zoomin", None,  # None = act change (fadewhite)
    "slideleft", "smoothleft", "zoomin", None,
    "slideright", "smoothleft", "zoomin", "smoothright",
    "cut", "cut", "cut", "cut", "cut", "cut", None,
    "smoothleft", "slideleft", "zoomin",
]
FLASH = "0x7fd6f5"  # brand cyan-300

SRC_W, SRC_H = 1125, 720
CROP_H = round(SRC_W * 9 / 16)  # 633: 16:9 out of the 1125x720 photos
BIG_W, BIG_H = 3840, 2160  # zoompan works on a large frame so the motion stays smooth


def ease(p: str) -> str:
    """Ease-out over the shot: fast start, gentle landing."""
    return f"(1-pow(1-{p},2))"


def shot_filter(i: int, photo, seconds, move, fx, fy, cy) -> str:
    frames = round(seconds * FPS)
    p = f"(on/{frames - 1})"
    e = ease(p)
    if move == "in":
        z, x, y = f"1+0.16*{e}", f"(iw-iw/zoom)*{fx}", f"(ih-ih/zoom)*{fy}"
    elif move == "out":
        z, x, y = f"1.16-0.16*{e}", f"(iw-iw/zoom)*{fx}", f"(ih-ih/zoom)*{fy}"
    elif move == "punch":  # fast hard push for the burst
        z, x, y = f"1.18+0.14*{e}", f"(iw-iw/zoom)*{fx}", f"(ih-ih/zoom)*{fy}"
    elif move == "lr":
        z, x, y = "1.12", f"(iw-iw/zoom)*{e}", f"(ih-ih/zoom)*{fy}"
    else:  # rl
        z, x, y = "1.12", f"(iw-iw/zoom)*(1-{e})", f"(ih-ih/zoom)*{fy}"
    crop_y = round((SRC_H - CROP_H) * cy)
    return (
        f"[{i}:v]crop={SRC_W}:{CROP_H}:0:{crop_y},scale={BIG_W}:{BIG_H}:flags=lanczos,setsar=1,"
        f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS},"
        f"trim=end_frame={frames},setpts=PTS-STARTPTS,format=yuv420p[s{i}]"
    )


def build() -> tuple[str, list[tuple[int, float]], float]:
    parts = [shot_filter(i, *shot) for i, shot in enumerate(SHOTS)]
    elapsed = SHOTS[0][1]
    label = "s0"
    act_times = []
    burst = []
    for k in range(1, len(SHOTS)):
        kind = TRANSITIONS[k - 1]
        out = f"x{k}"
        if kind == "cut":
            # A hard cut: append the shot.
            parts.append(f"[{label}][s{k}]concat=n=2:v=1:a=0,settb=1/{FPS},fps={FPS}[{out}]")
            burst.append(elapsed)
            elapsed += SHOTS[k][1]
            label = out
            continue
        length = A if kind is None else T
        offset = elapsed - length
        parts.append(f"[{label}][s{k}]xfade=transition={kind or 'fadewhite'}:duration={length}:offset={offset:.4f}[{out}]")
        if kind is None:
            act_times.append(offset + length / 2)
        elapsed = offset + SHOTS[k][1]
        label = out
    total = elapsed

    # Grade, then the act-change glitch and flash, then fade in from and out to the same cyan so the loop is seamless.
    glitches = "+".join([f"between(t,{t - 0.1:.2f},{t + 0.12:.2f})" for t in act_times] + [f"between(t,{t:.2f},{t + 0.07:.2f})" for t in burst])
    flashes = "+".join(f"between(t,{t - 0.04:.2f},{t + 0.06:.2f})" for t in act_times)
    parts.append(
        f"[{label}]trim=duration={total:.4f},setpts=PTS-STARTPTS,eq=contrast=1.07:saturation=1.12:brightness=-0.015,"
        "colorbalance=rs=-0.04:gs=-0.01:bs=0.07:rh=0.03:bh=-0.02,"
        "vignette=angle=PI/5,"
        f"rgbashift=rh=-10:bh=10:enable='{glitches}',"
        f"drawbox=c={FLASH}@0.28:t=fill:enable='{flashes}',"
        f"fade=t=in:st=0:d=0.3:color={FLASH},fade=t=out:st={total - 0.3:.3f}:d=0.3:color={FLASH},"
        "format=yuv420p[out]"
    )
    return ";\n".join(parts), act_times, total


if __name__ == "__main__":
    graph, acts, total = build()
    open("filter.txt", "w").write(graph)
    inputs = " ".join(f"-loop 1 -framerate {FPS} -t {s + 0.5} -i /src/{p}.png" for p, s, *_ in SHOTS)
    open("inputs.txt", "w").write(inputs)
    print(f"{len(SHOTS)} shots, {total:.2f} s, act changes at {', '.join(f'{t:.2f}' for t in acts)} s")
