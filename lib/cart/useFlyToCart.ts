"use client";

import { useEffect, useRef } from "react";

export function useFlyToCart() {
  const sourceRef = useRef<HTMLDivElement>(null);
  const cleanups = useRef(new Set<() => void>());

  useEffect(() => {
    const active = cleanups.current;

    return () => {
      for (const cleanup of active) cleanup();
      active.clear();
    };
  }, []);

  function flyToCart() {
    // Tôn trọng thiết lập giảm chuyển động của người dùng.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const source = sourceRef.current;
    const target = document.querySelector<HTMLElement>("[data-cart-target]");

    if (!source || !target) return;
    if (typeof source.animate !== "function") return;

    const start = source.getBoundingClientRect();
    const end = target.getBoundingClientRect();

    // Header có thể nằm ngoài màn hình khi người dùng cuộn.
    if (
      end.width === 0 ||
      end.height === 0 ||
      end.bottom <= 0 ||
      end.top >= window.innerHeight
    ) {
      return;
    }

    const size = 64;
    const startX = start.left + start.width / 2 - size / 2;
    const startY = start.top + start.height / 2 - size / 2;

    const dx = end.left + end.width / 2 - (startX + size / 2);
    const dy = end.top + end.height / 2 - (startY + size / 2);

    const ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");

    Object.assign(ghost.style, {
      position: "fixed",
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: "9999",
      pointerEvents: "none",
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      borderRadius: "16px",
      background: "#fff1e5",
      color: "#bc9876",
      border: "2px solid #ffaf79",
      boxShadow: "0 10px 25px rgba(255, 95, 30, 0.24)",
      boxSizing: "border-box",
    });

    // Hỗ trợ cả ảnh thật lẫn SVG placeholder hiện tại.
    const artwork = source.querySelector("img, svg");

    if (artwork) {
      const clone = artwork.cloneNode(true) as Element;
      clone.removeAttribute("id");

      for (const node of clone.querySelectorAll("[id]")) {
        node.removeAttribute("id");
      }

      clone.setAttribute(
        "style",
        artwork.tagName.toLowerCase() === "img"
          ? "width:100%;height:100%;object-fit:cover;display:block"
          : "width:36px;height:36px;display:block",
      );

      ghost.appendChild(clone);
    } else {
      ghost.textContent = "🍽️";
      ghost.style.fontSize = "30px";
    }

    document.body.appendChild(ghost);

    let disposed = false;
    let flight: Animation | undefined;
    let pulse: Animation | undefined;

    function cleanup() {
      disposed = true;
      flight?.cancel();
      pulse?.cancel();
      ghost.remove();
      cleanups.current.delete(cleanup);
    }

    cleanups.current.add(cleanup);

    flight = ghost.animate(
      [
        {
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
          offset: 0,
        },
        {
          transform: `translate(${dx * 0.45}px, ${
            dy * 0.45 - 70
          }px) scale(0.8)`,
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.15)`,
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: 650,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      },
    );

    void flight.finished
      .then(async () => {
        ghost.remove();

        if (disposed || !target.isConnected) return;

        pulse = target.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.22) rotate(-8deg)" },
            { transform: "scale(0.95) rotate(5deg)" },
            { transform: "scale(1)" },
          ],
          {
            duration: 300,
            easing: "ease-out",
          },
        );

        await pulse.finished;
      })
      .catch(() => {
        // Animation bị hủy khi chuyển trang là bình thường.
      })
      .finally(cleanup);
  }

  return { sourceRef, flyToCart };
}
