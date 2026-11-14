const paths = {
  note: "M6 3h9l4 4v14H5V3h1m8 0v5h5M9 12h6m-6 4h4",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14M5 12h14",
  hash: "M5 9h15M4 15h15M11 3 7 21M17 3l-4 18",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  close: "m6 6 12 12M6 18 18 6",
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3M13 6l5 5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  check: "m5 12 4 4L19 6",
  calendar: "M4 5h16v16H4V5m4-3v6m8-6v6M4 11h16",
  menu: "M4 6h16M4 12h16M4 18h16",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  book: "M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16",
};
export function Icon({
  name,
  size = 20,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
