import { useEffect, useRef, type FC } from "react";

export const CustomFPSStat: FC = () => {
  const spanFPSContentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let fps = 0;
    let frameCount = 0;
    let lastTime = performance.now();

    function updateFPS(currentTime: number) {
      frameCount++;

      if (currentTime >= lastTime + 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        if (spanFPSContentRef.current) {
          spanFPSContentRef.current.textContent = String(fps);
        }
      }

      requestAnimationFrame(updateFPS);
    }
    requestAnimationFrame(updateFPS);
  }, [spanFPSContentRef.current]);

  return (
    <div
      style={{
        position: "absolute",
        top: "48px",
        left: "0",
        width: "70px",
        height: "32px",
        display: "flex",
        background: "black",
      }}
    >
      <span>FPS =</span>
      <span ref={spanFPSContentRef}></span>
    </div>
  );
};
