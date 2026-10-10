import { useEffect, useRef, useState } from "react";
import { Ollie, type OllieFace } from "@/components/ollie";

// One-shot body reactions played when Ollie's expression changes (spring-like overshoot, Duolingo style).
const SPRING = "cubic-bezier(.34, 1.56, .64, 1)";
type Reaction = { body: Keyframe[]; shadow?: Keyframe[]; duration: number; easing?: string };
const hop = (height: number): Reaction => ({
  body: [
    { transform: "translateY(0) scale(1, 1)" },
    { transform: "translateY(4px) scale(1.06, .94)", offset: 0.15 },
    { transform: `translateY(-${height}px) scale(.96, 1.05)`, offset: 0.45 },
    { transform: "translateY(0) scale(1.05, .95)", offset: 0.78 },
    { transform: "translateY(0) scale(1, 1)" },
  ],
  shadow: [{ transform: "scale(1)" }, { transform: "scale(1.08)", offset: 0.15 }, { transform: "scale(.7)", opacity: 0.6, offset: 0.45 }, { transform: "scale(1.06)", offset: 0.78 }, { transform: "scale(1)" }],
  duration: 620,
  easing: "ease-in-out",
});
const REACTIONS: Partial<Record<OllieFace, Reaction>> = {
  happy: hop(22),
  celebrate: {
    body: [
      { transform: "translateY(0) rotate(0)" },
      { transform: "translateY(-28px) rotate(-6deg)", offset: 0.22 },
      { transform: "translateY(0) rotate(0) scale(1.05, .95)", offset: 0.42 },
      { transform: "translateY(-20px) rotate(6deg)", offset: 0.64 },
      { transform: "translateY(0) rotate(0) scale(1.04, .96)", offset: 0.86 },
      { transform: "translateY(0) rotate(0)" },
    ],
    shadow: [{ transform: "scale(1)" }, { transform: "scale(.68)", offset: 0.22 }, { transform: "scale(1.05)", offset: 0.42 }, { transform: "scale(.75)", offset: 0.64 }, { transform: "scale(1.04)", offset: 0.86 }, { transform: "scale(1)" }],
    duration: 1100,
    easing: "ease-in-out",
  },
  confused: { body: [{ transform: "rotate(0)" }, { transform: "rotate(-9deg)", offset: 0.25 }, { transform: "rotate(6deg)", offset: 0.55 }, { transform: "rotate(-3deg)", offset: 0.8 }, { transform: "rotate(0)" }], duration: 700 },
  thinking: { body: [{ transform: "rotate(0)" }, { transform: "rotate(-5deg) translateY(-4px)", offset: 0.5 }, { transform: "rotate(0)" }], duration: 900, easing: "ease-in-out" },
  listening: { body: [{ transform: "scale(1)" }, { transform: "scale(1.06) translateY(-3px)", offset: 0.4 }, { transform: "scale(1)" }], duration: 520, easing: SPRING },
  gentle: { body: [{ transform: "translateY(0)" }, { transform: "translateY(5px)", offset: 0.4 }, { transform: "translateY(0)" }], duration: 800, easing: "ease-in-out" },
};

const BLINKABLE: OllieFace[] = ["hello", "listening", "thinking", "confused"];

/** Ollie with an idle breath, blinking, ground shadow and springy reactions. */
export function Mascot({ face, speaking, reducedMotion }: { face: OllieFace; speaking: boolean; reducedMotion: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const [blinking, setBlinking] = useState(false);
  const canBlink = !reducedMotion && BLINKABLE.includes(face);

  // Play the reaction for the new expression.
  useEffect(() => {
    const reaction = REACTIONS[face];
    if (!reaction || reducedMotion) return;
    const options: KeyframeAnimationOptions = { duration: reaction.duration, easing: reaction.easing ?? SPRING };
    const animations = [body.current?.animate(reaction.body, options), reaction.shadow && shadow.current?.animate(reaction.shadow, options)];
    return () => animations.forEach((animation) => animation?.cancel());
  }, [face, reducedMotion]);

  // Blink every few seconds by flashing the closed-eye face.
  useEffect(() => {
    if (!canBlink) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true);
        timer = setTimeout(() => { setBlinking(false); schedule(); }, 130);
      }, 2600 + Math.random() * 3200);
    };
    schedule();
    return () => { clearTimeout(timer); setBlinking(false); };
  }, [canBlink]);

  const shown: OllieFace = blinking && canBlink ? "resting" : face;
  return <div className="iv-mascot" data-face={face} data-fast={speaking || blinking}>
    <div className="iv-shadow" ref={shadow} aria-hidden />
    <div className="iv-body" ref={body}>
      <div className="iv-breathe" data-speaking={speaking}>
        <Ollie face={shown} size={240} />
      </div>
    </div>
  </div>;
}
