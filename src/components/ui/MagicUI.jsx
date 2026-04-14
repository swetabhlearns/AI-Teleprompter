import { forwardRef } from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const MotionDiv = motion.div;

export function MagicBackground({ children, className = '' }) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-surface text-text', className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(248,250,252,1))]" />
        <MotionDiv
          aria-hidden="true"
          className="absolute left-[-12%] top-[-10%] h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, 24, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <MotionDiv
          aria-hidden="true"
          className="absolute right-[-10%] top-[12%] h-96 w-96 rounded-full bg-sky-300/15 blur-3xl"
          animate={{ x: [0, -22, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:36px_36px] opacity-[0.35]" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export const MagicCard = forwardRef(function MagicCard(
  { className = '', children, hover = true, ...props },
  ref,
) {
  return (
    <MotionDiv
      ref={ref}
      whileHover={hover ? { y: -2, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/72 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl',
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.08),_transparent_38%)]" />
      </div>
      <div className="relative">{children}</div>
    </MotionDiv>
  );
});

export const MagicButton = forwardRef(function MagicButton(
  {
    variant = 'primary',
    className = '',
    as: Component = 'button',
    type = 'button',
    ...props
  },
  ref,
) {
  const variantClasses = {
    primary: 'bg-slate-950 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-slate-900',
    secondary: 'border border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    accent: 'bg-emerald-600 text-white shadow-[0_20px_50px_rgba(16,185,129,0.18)] hover:-translate-y-0.5 hover:bg-emerald-500'
  };

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      className={cn(
        'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold leading-none transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40',
        variantClasses[variant] || variantClasses.primary,
        className,
      )}
      {...props}
    />
  );
});

export const MagicInput = forwardRef(function MagicInput({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full min-h-[48px] rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10',
        className,
      )}
      {...props}
    />
  );
});

export const MagicTextarea = forwardRef(function MagicTextarea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[180px] w-full resize-y rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4 text-[15px] leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10',
        className,
      )}
      {...props}
    />
  );
});

export const MagicSelect = forwardRef(function MagicSelect({ className = '', ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full min-h-[48px] cursor-pointer rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3.5 text-[15px] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10',
        className,
      )}
      {...props}
    />
  );
});

export function MagicBadge({ children, className = '' }) {
  return (
    <span className={cn('inline-flex min-h-[32px] items-center rounded-full border border-slate-200 bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600', className)}>
      {children}
    </span>
  );
}

export function MagicGlowText({ children, className = '' }) {
  return (
    <span className={cn('bg-gradient-to-r from-slate-900 via-emerald-700 to-sky-700 bg-clip-text text-transparent', className)}>
      {children}
    </span>
  );
}

export function MagicSectionHeader({ eyebrow, title, description, right }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">{eyebrow}</p> : null}
        <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function MagicDock({ children, className = '' }) {
  return (
    <div className={cn('rounded-full border border-slate-200/80 bg-white/75 px-4 py-2.5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl', className)}>
      {children}
    </div>
  );
}

export function MagicDockLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium leading-none transition',
        active ? 'bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      )}
    >
      {children}
    </Link>
  );
}

export function MagicBentoGrid({ children, className = '' }) {
  return <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function MagicBentoCard({ title, value, description, icon, className = '' }) {
  return (
    <MagicCard className={cn('p-5', className)} hover={false}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">{value}</p>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {icon ? <div className="text-2xl">{icon}</div> : null}
      </div>
    </MagicCard>
  );
}

export function MagicField({ label, hint, error, children, className = '' }) {
  return (
    <label className={cn('flex flex-col gap-2', className)} data-field={error ? 'error' : undefined}>
      {label ? <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span> : null}
      {children}
      {hint ? <span className="text-xs leading-5 text-slate-500">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-red-500">{error}</span> : null}
    </label>
  );
}
