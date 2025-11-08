import * as React from 'react';

export function Icon({ as: Comp, className, title, 'aria-label': ariaLabel, ...rest }) {
  return (
    <Comp 
      className={className ?? 'w-5 h-5'} 
      aria-hidden={!ariaLabel} 
      title={title}
      aria-label={ariaLabel}
      {...rest} 
    />
  );
}