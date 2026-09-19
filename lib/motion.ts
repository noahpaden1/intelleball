/**
 * Typed façade over the motion tokens in theme.config.mjs.
 * All Framer Motion components import animation constants from here —
 * never hard-code a duration, easing, or spring in a component.
 */
import type { Transition } from "framer-motion";
import { motionTokens } from "@/theme.config.mjs";

type Bezier = [number, number, number, number];

export const ease = {
  glide: motionTokens.ease.glide as Bezier,
  swing: motionTokens.ease.swing as Bezier,
  soft: motionTokens.ease.soft as Bezier,
};

export const dur = motionTokens.duration as {
  fast: number;
  base: number;
  slow: number;
};

export const spring = {
  snappy: motionTokens.spring.snappy as Transition,
  gentle: motionTokens.spring.gentle as Transition,
  whisper: motionTokens.spring.whisper as Transition,
};

export const reveal = motionTokens.reveal as {
  distance: number;
  stagger: number;
  viewportMargin: string;
};

export const parallax = motionTokens.parallax as {
  subtle: number;
  medium: number;
  strong: number;
};

export const nav = motionTokens.nav as {
  glassAt: number;
  hideAfter: number;
};

export const deck = motionTokens.deck as {
  scaleTo: number; rotateTo: number; fadeTo: number;
  gentleScaleTo: number; gentleRotateTo: number; gentleFadeTo: number;
};
