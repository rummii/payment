"use client";

// Live ticking countdown to a target ISO timestamp — used for monthly due
// dates (unpaid items) and trial end dates.

import { useEffect, useState } from "react";

interface Props {
  target: string;
  overdue?: boolean;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

function compute(target: string): Remaining {
  const diff = new Date(target).getTime() - Date.now();
  const past = diff <= 0;
  const abs = Math.abs(diff);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
    past,
  };
}

export default function Countdown({ target, overdue }: Props) {
  const [rem, setRem] = useState<Remaining>(() => compute(target));

  useEffect(() => {
    setRem(compute(target));
    const t = setInterval(() => setRem(compute(target)), 1000);
    return () => clearInterval(t);
  }, [target]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const cls = `countdown${rem.past || overdue ? " overdue" : ""}`;

  return (
    <div className={cls}>
      <div className="seg">
        <div className="num">{rem.past ? "—" : rem.days}</div>
        <div className="lab">days</div>
      </div>
      <div className="seg">
        <div className="num">{pad(rem.past ? 0 : rem.hours)}</div>
        <div className="lab">hrs</div>
      </div>
      <div className="seg">
        <div className="num">{pad(rem.past ? 0 : rem.minutes)}</div>
        <div className="lab">min</div>
      </div>
      <div className="seg">
        <div className="num">{pad(rem.past ? 0 : rem.seconds)}</div>
        <div className="lab">sec</div>
      </div>
    </div>
  );
}
