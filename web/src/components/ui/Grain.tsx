/** Film-grain + vignette overlay, fixed above everything. Kills gradient banding and adds
 *  a graded-still texture. Pure CSS/SVG, pointer-events none, GPU-cheap. */
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
      <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>
      <feColorMatrix type='saturate' values='0'/></filter>
      <rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/>
    </svg>`
  );

export function Grain() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90] mix-blend-soft-light"
        style={{ backgroundImage: `url("${NOISE}")`, opacity: 0.05 }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90]"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 38%, transparent 55%, rgba(2,3,5,0.55) 100%)",
        }}
      />
    </>
  );
}
