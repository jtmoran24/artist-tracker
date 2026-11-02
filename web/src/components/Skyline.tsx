// Decorative horizon: a pink sun hanging over wireframe mountains and a pine
// forest. Fixed behind the page, standing on the grid floor's far edge.
const WIDTH = 1600;
const HEIGHT = 400;
const CENTER = WIDTH / 2;
// Low edge sits just above the middle peaks (back range is ~290 there); top
// edge just inside the viewBox so it clears the nav on wide screens.
const SUN = { cy: 145, r: 140 };

// Seeded so the forest is identical on every render (no hydration drift).
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Three stacked triangles plus a stub of trunk.
function pinePath(x: number, base: number, height: number) {
  const tiers: [number, number, number][] = [
    [0, 0.45, 0.18],
    [0.25, 0.75, 0.26],
    [0.5, 0.97, 0.34],
  ];
  const top = base - height;
  const triangles = tiers
    .map(([start, end, halfWidth]) => {
      const y0 = top + start * height;
      const y1 = top + end * height;
      const hw = halfWidth * height;
      return `M${x} ${y0}L${x + hw} ${y1}L${x - hw} ${y1}Z`;
    })
    .join("");
  return `${triangles}M${x} ${base - 0.03 * height}L${x} ${base}`;
}

// Trees on both flanks, leaving the middle open for the sun.
function forest(seed: number, count: number, minHeight: number, spread: number) {
  const random = seededRandom(seed);
  const trees: { x: number; height: number }[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const offset = 260 + random() * (CENTER - 240);
    const x = CENTER + side * offset;
    // Taller toward the edges, like the forest closes in.
    const edge = offset / CENTER;
    trees.push({ x, height: minHeight + spread * edge + random() * 30 });
  }
  return trees.sort((a, b) => a.height - b.height);
}

const backTrees = forest(7, 26, 40, 70);
const frontTrees = forest(42, 18, 70, 150);

const backRange =
  "0,400 0,300 90,250 180,290 260,215 350,275 430,240 520,300 600,262 700,320 800,292 900,325 1000,255 1090,300 1170,230 1260,285 1340,220 1430,270 1520,240 1600,290 1600,400";
const frontRange =
  "0,400 0,340 120,300 220,345 330,295 450,350 560,322 680,362 800,348 920,362 1040,315 1150,350 1270,300 1380,340 1490,305 1600,335 1600,400";

export function Skyline() {
  return (
    <div className="vapor-skyline" aria-hidden>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        // "slice" scales to fill the width and anchors at the bottom, so on
        // wide screens the top of the scene would be cropped. Let it spill
        // upward instead.
        overflow="visible"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="skyline-sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe3f6" />
            <stop offset="35%" stopColor="#ff9be5" />
            <stop offset="70%" stopColor="#ff7ad9" />
            <stop offset="100%" stopColor="#d9469f" />
          </linearGradient>
          <filter id="skyline-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
        </defs>

        <circle
          cx={CENTER}
          cy={SUN.cy}
          r={SUN.r + 15}
          fill="#ff7ad9"
          opacity="0.3"
          filter="url(#skyline-glow)"
        />
        <circle cx={CENTER} cy={SUN.cy} r={SUN.r} fill="url(#skyline-sun)" />

        <polygon
          points={backRange}
          fill="#0a1f17"
          stroke="#7dffb3"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        <polygon
          points={frontRange}
          fill="#06160f"
          stroke="#7dffb3"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />

        {backTrees.map((tree, i) => (
          <path
            key={`b${i}`}
            d={pinePath(tree.x, HEIGHT, tree.height)}
            fill="#0a1f17"
            stroke="#7dffb3"
            strokeOpacity="0.3"
            strokeWidth="1.2"
          />
        ))}
        {frontTrees.map((tree, i) => (
          <path
            key={`f${i}`}
            d={pinePath(tree.x, HEIGHT, tree.height)}
            fill="#04110c"
            stroke="#7dffb3"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
        ))}

        <line
          x1="0"
          y1={HEIGHT - 1}
          x2={WIDTH}
          y2={HEIGHT - 1}
          stroke="#7dffb3"
          strokeWidth="2"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}
