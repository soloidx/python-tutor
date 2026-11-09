import React from "react";

export function Icon({ name, ...props }) {
  const paths = {
    book: "M4 4h6a3 3 0 0 1 3 2v15a4 4 0 0 0-3-2H4z M13 6a3 3 0 0 1 3-2h5v15h-5a4 4 0 0 0-3 2",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    code: "m8 7-5 5 5 5 m8-10 5 5-5 5 m-3-14-2 18",
    arrow: "M5 12h14 m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    play: "m8 5 11 7-11 7z",
    bulb: "M9 18h6 m-6 3h6 M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2",
    back: "m14 6-6 6 6 6",
    clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.code} />
    </svg>
  );
}
