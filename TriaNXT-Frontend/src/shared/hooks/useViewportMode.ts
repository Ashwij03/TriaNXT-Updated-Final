import { useEffect, useState } from "react";

export function useViewportMode() {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") {
      return "desktop";
    }

    const width = window.innerWidth;

    if (width <= 767) {
      return "mobile";
    }

    if (width <= 1024) {
      return "tablet";
    }

    return "desktop";
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      if (width <= 767) {
        setMode("mobile");
      } else if (width <= 1024) {
        setMode("tablet");
      } else {
        setMode("desktop");
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return mode;
}
