import * as React from "react";

const Slider = React.forwardRef(({ className, min, max, step, value, onValueChange, ...props }, ref) => {
  const handleChange = (e) => {
    if (onValueChange) {
      onValueChange([Number(e.target.value)]);
    }
  };

  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={Array.isArray(value) ? value[0] : value}
      onChange={handleChange}
      className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 ${className}`}
      {...props}
    />
  );
});

Slider.displayName = "Slider";

export { Slider };