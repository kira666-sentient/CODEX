"use client";

/**
 * Pure SVG + CSS animated bear sleeping under a tree.
 * No external dependencies. All motion is CSS keyframe-driven.
 */
export default function LandingBearScene() {
  return (
    <svg
      aria-hidden="true"
      className="landing-scene-svg"
      fill="none"
      focusable="false"
      viewBox="0 0 440 560"
    >
      {/* Ground shadow */}
      <ellipse cx="220" cy="510" rx="180" ry="40" fill="rgba(89, 130, 87, 0.16)" />

      {/* Tree trunk */}
      <rect
        className="scene-tree-trunk"
        x="90" y="140" width="70" height="240" rx="32"
        fill="#8f5d3b"
      />
      {/* Trunk texture lines */}
      <path d="M105 180 Q115 220 108 280" stroke="#7a4e30" strokeWidth="2" opacity="0.3" />
      <path d="M140 200 Q135 260 142 340" stroke="#7a4e30" strokeWidth="1.5" opacity="0.25" />

      {/* Tree canopy (gentle sway) */}
      <g className="scene-tree-canopy">
        <circle cx="60"  cy="140" r="62"  fill="#7ca56c" />
        <circle cx="130" cy="100" r="78"  fill="#88b276" />
        <circle cx="200" cy="130" r="68"  fill="#8fbf79" />
        <circle cx="110" cy="180" r="56"  fill="#6e9960" />
        <circle cx="170" cy="160" r="48"  fill="#7dac6a" />
        {/* Highlight patches */}
        <circle cx="140" cy="90"  r="30"  fill="#9dcc88" opacity="0.5" />
        <circle cx="78"  cy="130" r="22"  fill="#a4d48f" opacity="0.4" />
      </g>

      {/* Falling leaves */}
      <g className="scene-leaf-group">
        <circle className="scene-leaf scene-leaf-a" cx="260" cy="150" r="7" fill="#c07a3e" />
        <circle className="scene-leaf scene-leaf-b" cx="285" cy="190" r="5" fill="#d78b4f" />
        <circle className="scene-leaf scene-leaf-c" cx="245" cy="220" r="4.5" fill="#e0a060" />
      </g>

      {/* Ground/hill */}
      <path
        d="M20 440 C80 390 160 370 240 380 C300 388 360 410 420 420 L420 530 L20 530 Z"
        fill="rgba(110, 155, 88, 0.22)"
      />
      {/* Extra ground layer */}
      <path
        d="M0 470 C60 450 140 440 220 448 C300 456 380 470 440 475 L440 560 L0 560 Z"
        fill="rgba(100, 145, 78, 0.15)"
      />

      {/* === BEAR === */}

      {/* Bear shadow */}
      <ellipse cx="260" cy="440" rx="90" ry="16" fill="rgba(60,40,25,0.12)" />

      {/* Tail */}
      <g className="bear-tail">
        <ellipse cx="152" cy="400" rx="18" ry="14" fill="#7f583d" />
      </g>

      {/* Bear body (breathing) */}
      <g className="bear-body-group">
        <ellipse cx="255" cy="408" rx="92" ry="44" fill="#6c4a33" />
        {/* Belly lighter patch */}
        <ellipse cx="260" cy="415" rx="55" ry="25" fill="#8a6548" opacity="0.5" />
      </g>

      {/* Back legs */}
      <ellipse cx="185" cy="432" rx="22" ry="14" fill="#7f583d" />
      <ellipse cx="210" cy="438" rx="20" ry="12" fill="#7f583d" />

      {/* Front paws */}
      <ellipse cx="300" cy="436" rx="22" ry="13" fill="#7f583d" />
      <ellipse cx="326" cy="432" rx="18" ry="12" fill="#7f583d" />
      {/* Paw pads */}
      <ellipse cx="300" cy="440" rx="8" ry="5" fill="#5c3d28" opacity="0.3" />
      <ellipse cx="326" cy="436" rx="6" ry="4" fill="#5c3d28" opacity="0.3" />

      {/* Head (bob with breathing) */}
      <g className="bear-head-group">
        <ellipse cx="330" cy="378" rx="42" ry="36" fill="#6c4a33" />
        {/* Left ear */}
        <g className="bear-ear-flick">
          <circle cx="300" cy="348" r="15" fill="#6c4a33" />
          <circle cx="300" cy="350" r="8" fill="#c9917a" opacity="0.5" />
        </g>
        {/* Right ear */}
        <g className="bear-ear-flick-r">
          <circle cx="356" cy="350" r="15" fill="#6c4a33" />
          <circle cx="356" cy="352" r="8" fill="#c9917a" opacity="0.5" />
        </g>
        {/* Snout */}
        <ellipse cx="340" cy="386" rx="22" ry="14" fill="#8f6444" />
        {/* Nose */}
        <ellipse cx="340" cy="380" rx="7" ry="5" fill="#1f1a14" />
        {/* Closed eyes — sleeping */}
        <path d="M318 374 Q323 377 328 374" stroke="#1f1a14" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M345 375 Q350 378 355 375" stroke="#1f1a14" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Tiny smile */}
        <path d="M334 391 Q340 396 346 391" stroke="#1f1a14" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Cheek blush */}
        <circle cx="316" cy="383" r="6" fill="#d4917a" opacity="0.25" />
        <circle cx="358" cy="384" r="6" fill="#d4917a" opacity="0.25" />
      </g>

      {/* Zzz floating */}
      <text className="bear-zzz" x="360" y="340" fontSize="16" fontWeight="700" fill="#8f6444" opacity="0.5">z</text>
      <text className="bear-zzz-2" x="374" y="322" fontSize="13" fontWeight="700" fill="#8f6444" opacity="0.4">z</text>
      <text className="bear-zzz-3" x="384" y="306" fontSize="10" fontWeight="700" fill="#8f6444" opacity="0.3">z</text>

      {/* Grass tufts */}
      <g className="scene-grass">
        <path d="M130 470 C138 448 140 430 136 414 C152 430 154 452 144 472" stroke="#6d9a5d" strokeLinecap="round" strokeWidth="5" fill="none" />
        <path d="M152 474 C162 452 166 432 162 412 C178 430 180 456 166 476" stroke="#82ad69" strokeLinecap="round" strokeWidth="4" fill="none" />
        <path d="M340 472 C332 450 332 434 338 418 C356 432 360 456 348 474" stroke="#7aa562" strokeLinecap="round" strokeWidth="4.5" fill="none" />
        <path d="M370 476 C366 460 366 442 372 426 C384 438 386 462 374 478" stroke="#6d9a5d" strokeLinecap="round" strokeWidth="3.5" fill="none" />
      </g>

      {/* Small mushroom */}
      <ellipse cx="390" cy="466" rx="10" ry="4" fill="#c48860" />
      <rect x="387" y="458" width="6" height="10" rx="2" fill="#e8d5bb" />
      <ellipse cx="390" cy="457" rx="11" ry="6" fill="#d4715a" />
      <circle cx="386" cy="455" r="2" fill="#e8a090" opacity="0.6" />
      <circle cx="393" cy="453" r="1.5" fill="#e8a090" opacity="0.5" />
    </svg>
  );
}
