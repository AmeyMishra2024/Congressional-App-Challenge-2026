const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  lessons: (
    <>
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
      <path d="M12 5v15" />
    </>
  ),
  explore: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  portfolio: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="1" />
      <path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3" />
    </>
  ),
  replay: (
    <>
      <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" />
    </>
  ),
  tools: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 3h1m6 0h1" />
    </>
  ),
  parent: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  guide: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m10 8 6 4-6 4Z" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
  ),
  brand: (
    <>
      <path d="M5 20V9m7 11V4m7 16V12" />
      <path d="m3 7 6-4 6 4 6-4" />
    </>
  ),
};

export default function Icon({ name, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.overview}
    </svg>
  );
}
