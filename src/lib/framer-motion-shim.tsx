"use client";

import React from "react";

type MotionProps = Record<string, unknown> & {
  children?: React.ReactNode;
};

function createMotionComponent(tag: keyof React.JSX.IntrinsicElements) {
  return React.forwardRef<HTMLElement, MotionProps>(function MotionComponent(
    { children, animate, exit, initial, layout, transition, variants, viewport, whileHover, whileInView, whileTap, drag, dragConstraints, dragElastic, dragMomentum, ...rest },
    ref
  ) {
    void animate;
    void exit;
    void initial;
    void layout;
    void transition;
    void variants;
    void viewport;
    void whileHover;
    void whileInView;
    void whileTap;
    void drag;
    void dragConstraints;
    void dragElastic;
    void dragMomentum;

    return React.createElement(tag, { ...rest, ref }, children as React.ReactNode);
  });
}

export const motion = new Proxy(
  {},
  {
    get: (_, tag: string) => createMotionComponent(tag as keyof React.JSX.IntrinsicElements),
  }
) as Record<string, React.ForwardRefExoticComponent<MotionProps & React.RefAttributes<HTMLElement>>>;

export function AnimatePresence({ children, ..._props }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
