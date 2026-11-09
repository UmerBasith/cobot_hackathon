import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, type Variants } from "motion/react";
import { cn } from "@/lib/cn";
import { STATIC } from "@/lib/static";

/** Fades + slides children up when they scroll into view. */
export function Reveal({ children, delay = 0, y = 24, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/** Wrap a grid with <Stagger>, and each child with <StaggerItem>. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}>
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}

/** Number that counts up when visible. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1.6, className }: {
  to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(STATIC ? to : 0);
  const from = useRef(0);
  useEffect(() => {
    if (STATIC) { setVal(to); return; }
    if (!inView) return;
    // First time: count from 0. Later updates: glide from the current number (fast for live data).
    const first = from.current === 0;
    const controls = animate(from.current, to, {
      duration: first ? duration : 0.4, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { from.current = v; setVal(v); },
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}{val.toFixed(decimals)}{suffix}
    </span>
  );
}

/** Headline whose words rise in one by one. */
export function WordsReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}
