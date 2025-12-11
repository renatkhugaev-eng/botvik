// Temporary augmentation so MotionProps includes className under React 19
// without shadowing the original framer-motion exports.
import type { MouseEventHandler } from "react";
import "framer-motion";

declare module "framer-motion" {
  interface MotionProps {
    className?: string;
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLElement>;
  }
}

