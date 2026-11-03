"""Вырезать знак (лошадь + дубовые листья + жёлудь) из логотипа без фона.

Фон — размытая степь и полупрозрачные буквы HRS — светлее тёмного контура
гравюры. Заливка от краёв по «нестенам» снимает фон и останавливается на
контуре. Затем: крупнейший связный кусок (чтобы тёмные пятна холмов не
прилипли), возврат ореола от расширения стен, мягкий край альфы.

Как пересобрать public/brand/emblem.png (нужен numpy):

    node -e "require('sharp')('public/brand/artwork.jpg').raw().toBuffer()
        .then(b => require('fs').writeFileSync('/tmp/source.rgb', b))"
    python3 -I scripts/brand/cutout.py /tmp/source.rgb /tmp/emblem.rgba 1072 992 60 \\
        552,528 602,578 w:748,592,758,585
    node -e "require('sharp')(require('fs').readFileSync('/tmp/emblem.rgba'),
        {raw:{width:883,height:731,channels:4}}).png({compressionLevel:9}).toFile('public/brand/emblem.png')"

Файл в репозитории сделан с теми же параметрами, но JPEG тогда раскодировал ffmpeg:
у sharp декодер чуть другой, и край знака отличается примерно на 600 пикселей из 645
тысяч — на глаз не видно.

Семена «y,x» 552,528 и 602,578 — фон между ногами лошади, отрезанный от краёв.
Стена w:748,592,758,585 закрывает щель в самом рисунке между копытом и контуром
правого листа: без неё фон затекал внутрь листа. Вывод печатает «leaf-like pixels
removed» — сколько пикселей листа ушло в фон; норма — единицы, и те в степи.
"""
import sys
from collections import deque

import numpy as np

src, out_rgba, W, H, T = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
img = np.fromfile(src, dtype=np.uint8).reshape(H, W, 3)
f = img.astype(np.float32)
lum = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]

wall0 = lum < T
# Ручные стены «x1,y1,x2,y2» (аргументы с префиксом w:) — закрыть щели в самом рисунке,
# где контур листа не доходит до контура копыта и фон затекает внутрь листа.
for spec in [a[2:] for a in sys.argv[6:] if a.startswith("w:")]:
    x1, y1, x2, y2 = map(int, spec.split(","))
    n = max(abs(x2 - x1), abs(y2 - y1)) * 2 + 1
    for t in np.linspace(0.0, 1.0, n):
        cx, cy = round(x1 + (x2 - x1) * t), round(y1 + (y2 - y1) * t)
        wall0[cy - 1 : cy + 2, cx - 1 : cx + 2] = True
# Закрыть волосяные щели в контуре: расширение стен на 1 пиксель (3×3).
wall = wall0.copy()
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        wall |= np.roll(np.roll(wall0, dy, 0), dx, 1)


def flood(allowed: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    seen = np.zeros_like(allowed, dtype=bool)
    q = deque()
    for y, x in seeds:
        if allowed[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
    al = allowed
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and al[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


border = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]
extra = [tuple(map(int, s.split(","))) for s in sys.argv[6:] if not s.startswith("w:")]  # семена фона «y,x»
background = flood(~wall, border + extra)

# Вернуть фону ореол, отъеденный расширением стен (но не настоящий контур).
halo = np.zeros_like(background)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        halo |= np.roll(np.roll(background, dy, 0), dx, 1)
background |= halo & ~wall0

emblem = ~background
# Крупнейший связный кусок знака.
labels = np.zeros((H, W), dtype=np.int32)
best, best_size, current = 0, 0, 0
ys, xs = np.nonzero(emblem)
for y, x in zip(ys.tolist(), xs.tolist()):
    if labels[y, x]:
        continue
    current += 1
    labels[y, x] = current
    q = deque([(y, x)])
    size = 0
    while q:
        cy, cx = q.popleft()
        size += 1
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < H and 0 <= nx < W and emblem[ny, nx] and not labels[ny, nx]:
                labels[ny, nx] = current
                q.append((ny, nx))
    if size > best_size:
        best, best_size = current, size
keep = labels == best
print(f"components: {current}, kept {best_size} px ({best_size / (W * H) * 100:.1f}% of image)")

# Мягкий край: размытие альфы 3×3.
alpha = keep.astype(np.float32)
soft = np.zeros_like(alpha)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        soft += np.roll(np.roll(alpha, dy, 0), dx, 1)
soft /= 9.0
alpha = np.where(keep, np.maximum(soft, 0.5), soft * 0.9)
alpha[~keep & (soft < 0.12)] = 0

# Проверка утечек: насыщенно-зелёные пиксели (тело листа), ушедшие в фон.
R, G, B = f[..., 0], f[..., 1], f[..., 2]
leafy = (G - B > 45) & (G > R + 8) & (lum > 60) & (lum < 175)
lost = leafy & ~keep
print(f"leaf-like pixels removed: {int(lost.sum())} of {int(leafy.sum())}")
if lost.any():
    ly, lx = np.nonzero(lost)
    for yy, xx in list(zip(ly.tolist(), lx.tolist()))[:: max(1, len(ly) // 12)]:
        print(f"  lost leaf-like at x={xx} y={yy} lum={lum[yy, xx]:.0f}")

ys, xs = np.nonzero(keep)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
print(f"bbox x {x0}..{x1}, y {y0}..{y1} ({x1 - x0 + 1}×{y1 - y0 + 1})")
rgba = np.dstack([img, (alpha * 255).astype(np.uint8)])[y0 : y1 + 1, x0 : x1 + 1]
rgba.tofile(out_rgba)
print(f"size {rgba.shape[1]} {rgba.shape[0]}")
