import { forwardRef } from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

const sizes = {
  sm: {
    trackWidth: "2.5rem",
    trackHeight: "1.25rem",
    thumbSize: "1rem",
    thumbTranslate: "1.25rem",
    shadowSize: "0.125rem",
  },
  md: {
    trackWidth: "4rem",
    trackHeight: "2.25rem",
    thumbSize: "1.75rem",
    thumbTranslate: "2.25rem",
    shadowSize: "0.25rem",
  },
  lg: {
    trackWidth: "5rem",
    trackHeight: "2.75rem",
    thumbSize: "2.25rem",
    thumbTranslate: "2.75rem",
    shadowSize: "0.375rem",
  },
};

const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  (
    {
      checked,
      onChange,
      disabled = false,
      size = "md",
      className = "",
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const style = sizes[size];

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || (checked ? "启用" : "关闭")}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex items-center justify-start rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-orange/50 focus-visible:ring-offset-2 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:scale-105 active:scale-95"
        } ${className}`}
        style={{
          width: style.trackWidth,
          height: style.trackHeight,
        }}
      >
        {/* 背景轨道 */}
        <span
          className={`absolute inset-0 rounded-full transition-all duration-300 ${
            checked
              ? "bg-gradient-to-r from-accent-orange to-accent-orange/80 shadow-lg shadow-accent-orange/30"
              : "bg-accent-grayLight hover:bg-accent-grayLight/80"
          }`}
        />
        
        {/* 背景光晕 */}
        {checked && (
          <span className="absolute inset-0 rounded-full bg-accent-orange/20 animate-pulse" />
        )}
        
        {/* 滑块 */}
        <span
          className={`relative flex items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ease-out ${
            checked ? "shadow-lg" : ""
          }`}
          style={{
            width: style.thumbSize,
            height: style.thumbSize,
            transform: checked ? `translateX(${style.thumbTranslate})` : "translateX(0.25rem)",
            boxShadow: checked
              ? `0 ${style.shadowSize} ${style.shadowSize} rgba(255, 127, 80, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.5) inset`
              : "0 2px 4px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05) inset",
          }}
        >
          {/* 滑块内图标 */}
          <span
            className={`w-1/2 h-1/2 rounded-full transition-all duration-300 ${
              checked ? "bg-accent-orange" : "bg-accent-inkMute"
            }`}
          />
        </span>
        
        {/* 点击反馈波纹 */}
        <span className="absolute inset-0 rounded-full overflow-hidden">
          <span
            className={`absolute inset-0 bg-white/20 transform scale-0 transition-transform duration-300 ${
              checked ? "" : "opacity-0"
            }`}
            style={{
              transform: checked ? "scale(1)" : "scale(0)",
            }}
          />
        </span>
      </button>
    );
  }
);

ToggleSwitch.displayName = "ToggleSwitch";

export default ToggleSwitch;
