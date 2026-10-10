import "./ollie.css";

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

// One shared vector character for the logo, welcome screen, and live interview.
export function Ollie({ face, size = 260, blinking = false }: { face: OllieFace; size?: number; priority?: boolean; blinking?: boolean }) {
  const smiling = face === "happy" || face === "celebrate";
  const closed = blinking || face === "resting" || smiling;
  const openBeak = face === "talking" || face === "celebrate";
  return <div className="ollie" data-expression={face} style={{ "--size": `${size}px` } as React.CSSProperties} role="img" aria-label={descriptions[face]}>
    <svg viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      <g fill="#ffac22">
        <path d="M111 264c-12 0-27 14-25 24 2 10 40 11 49 1 7-8-8-25-24-25Z" />
        <path d="M209 264c12 0 27 14 25 24-2 10-40 11-49 1-7-8 8-25 24-25Z" />
      </g>
      <path fill="#2474e5" d="M72 104c0-40 22-65 56-65 13 0 21 5 32 5s19-5 32-5c34 0 56 25 56 65v88c0 58-31 88-88 88s-88-30-88-88Z" />
      <path fill="#2474e5" d="M138 47c-9-11-8-22-2-26 5-3 15 8 22 16 2-15 9-22 15-19 7 4 7 17 2 29Z" />
      <path fill="#fffdf5" d="M94 117c0-24 12-42 31-42 15 0 25 10 35 23 10-13 20-23 35-23 19 0 31 18 31 42 0 33-13 40-12 55 1 14 18 29 18 49 0 28-29 44-72 44s-72-16-72-44c0-20 17-35 18-49 1-15-12-22-12-55Z" />
      <g className="ollie-eyes" fill="#12315a">
        {closed ? <g fill="none" stroke="#12315a" strokeWidth="9" strokeLinecap="round">
          <path d={smiling ? "M111 127q13-17 25 0" : "M111 122q13 13 25 0"} />
          <path d={smiling ? "M184 127q13-17 25 0" : "M184 122q13 13 25 0"} />
        </g> : <g className="ollie-pupils">
          <rect x="117" y="105" width="23" height="40" rx="11.5" />
          <rect x="180" y="105" width="23" height="40" rx="11.5" />
          <g fill="#fffdf5"><circle cx="122" cy="114" r="6" /><circle cx="185" cy="114" r="6" /></g>
        </g>}
      </g>
      {face === "confused" && <path d="m178 88 22-6" fill="none" stroke="#12315a" strokeWidth="6" strokeLinecap="round" />}
      <g fill="#ffb8a7"><ellipse cx="108" cy="152" rx="13" ry="7" /><ellipse cx="212" cy="152" rx="13" ry="7" /></g>
      <g className="ollie-beak">
        {openBeak ? <><path fill="#ee8c15" d="M140 153h40v15c0 17-10 26-20 26s-20-9-20-26Z" /><path fill="#743a28" d="M146 158h28v10c0 12-6 20-14 20s-14-8-14-20Z" /><path fill="#ff8c9c" d="M150 182q10-13 20 0c-5 9-15 9-20 0Z" /></> : <path fill="#ee8c15" d={smiling ? "M137 155h46q-23 34-46 0Z" : "M140 154h40q-20 23-40 0Z"} />}
        <path fill="#ffbd35" d="M137 154c0-9 12-17 23-17s23 8 23 17c-8 5-38 5-46 0Z" />
      </g>
      <g fill="#2474e5">
        <path className="ollie-wing ollie-wing-left" d="M81 149c-14-6-23 4-31 22-10 23-20 59-7 62 15 4 39-26 48-46 8-18 3-32-10-38Z" />
        <path className="ollie-wing ollie-wing-right" d="M239 149c14-6 23 4 31 22 10 23 20 59 7 62-15 4-39-26-48-46-8-18-3-32 10-38Z" />
      </g>
      <path fill="#d9efff" d="M142 219q9 7 18 0 9 7 18 0c0 11-8 17-18 17s-18-6-18-17Z" />
    </svg>
  </div>;
}
