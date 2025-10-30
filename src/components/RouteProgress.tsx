'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Lightweight top progress bar that immediately reacts to link clicks
 * and hides when the route path changes. Improves perceived responsiveness.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const barStyle = useMemo(() => ({
    position: 'fixed' as const,
    top: 0,
    left: 0,
    height: '3px',
    width: `${progress}%`,
    background: '#0d6efd', // Bootstrap primary color
    boxShadow: '0 0 2px rgba(13,110,253,0.7)',
    zIndex: 9999,
    transition: 'width 150ms ease-out, opacity 200ms ease-out',
    opacity: visible ? 1 : 0,
    pointerEvents: 'none' as const,
  }), [progress, visible]);

  // Start progress animation
  const startProgress = () => {
    setVisible(true);
    setProgress(8); // Initial kick
    startTimeRef.current = performance.now();

    const step = (now: number) => {
      // Ease to 92% over time while pending
      const elapsed = now - startTimeRef.current;
      const target = Math.min(92, 8 + elapsed / 25); // ~2.5s to reach ~92%
      setProgress((p) => (p < target ? target : p));
      rafRef.current = requestAnimationFrame(step);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  // Complete and hide progress
  const completeProgress = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(100);
    // Slight delay to allow users to perceive completion
    setTimeout(() => {
      setVisible(false);
      // Reset for next navigation
      setTimeout(() => setProgress(0), 200);
    }, 200);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Only react to left-clicks without modifier keys
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Walk up the DOM tree to find nearest anchor
      const anchor = target.closest('a');
      if (!anchor) return;

      // Ignore external links or download links
      const href = anchor.getAttribute('href') || '';
      const rel = anchor.getAttribute('rel') || '';
      const targetAttr = anchor.getAttribute('target') || '';
      const isExternal = href.startsWith('http') || rel.includes('noopener') || targetAttr === '_blank';
      if (isExternal) return;

      // Ignore same-path navigation
      if (href && (href === pathname || href === window.location.pathname)) return;

      // Start progress for internal navigations
      startProgress();
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // When pathname changes, complete the progress
  useEffect(() => {
    if (visible) {
      completeProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return <div style={barStyle} />;
}