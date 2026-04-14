import { forwardRef } from 'react';

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const OatButton = forwardRef(function OatButton(
  {
    variant = 'primary',
    outline = false,
    ghost = false,
    size = 'medium',
    icon = false,
    className,
    type = 'button',
    as: Component = 'button',
    ...props
  },
  ref,
) {
  const classes = joinClasses(
    outline && 'outline',
    ghost && 'ghost',
    size === 'small' && 'small',
    size === 'large' && 'large',
    icon && 'icon',
    className,
  );

  const variantProps = variant && variant !== 'primary' ? { 'data-variant': variant } : {};

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      className={classes}
      {...variantProps}
      {...props}
    />
  );
});

export function OatCard({ className, ...props }) {
  return <div className={joinClasses('card', className)} {...props} />;
}

export function OatField({ className, label, hint, error, children, ...props }) {
  return (
    <label
      className={joinClasses(className)}
      data-field={error ? 'error' : undefined}
      {...props}
    >
      {label && <span>{label}</span>}
      {children}
      {hint && <div data-hint>{hint}</div>}
      {error && <div className="error">{error}</div>}
    </label>
  );
}

export const OatSelect = forwardRef(function OatSelect({ className, ...props }, ref) {
  return <select ref={ref} className={joinClasses(className)} {...props} />;
});

export const OatTextarea = forwardRef(function OatTextarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={joinClasses(className)} {...props} />;
});

export const OatInput = forwardRef(function OatInput({ className, ...props }, ref) {
  return <input ref={ref} className={joinClasses(className)} {...props} />;
});
