import * as React from "react";

export function useVisualViewportHeight() {
  const [height, setHeight] = React.useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const update = () => setHeight(vv.height);

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return height;
}
