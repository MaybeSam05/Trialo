import Image from "next/image";

export const ollieFaces = ["hello", "happy", "talking", "listening", "thinking", "confused", "gentle", "celebrate", "resting"] as const;
export type OllieFace = (typeof ollieFaces)[number];

const descriptions: Record<OllieFace, string> = {
  hello: "Ollie the penguin says hello",
  happy: "Ollie is smiling",
  talking: "Ollie is talking",
  listening: "Ollie is listening",
  thinking: "Ollie is thinking",
  confused: "Ollie looks puzzled",
  gentle: "Ollie looks kind and calm",
  celebrate: "Ollie is celebrating",
  resting: "Ollie is resting",
};

// All faces stay mounted so switching expressions is instant and cross-fades.
export function Ollie({ face, size = 260, priority = false }: { face: OllieFace; size?: number; priority?: boolean }) {
  return <div className="ollie" style={{ "--size": `${size}px` } as React.CSSProperties} role="img" aria-label={descriptions[face]}>
    {ollieFaces.map((name) => <Image key={name} src={`/ollie/${name}.webp`} alt="" aria-hidden width={size} height={size}
      data-active={name === face} priority={priority && name === "hello"} unoptimized />)}
  </div>;
}
