/**
 * 羊毛管家 Logo 组件
 * 融合羊毛、优惠券和管家元素的可爱设计
 */

export function LogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none">
      {/* 背景圆角矩形 */}
      <rect x="4" y="4" width="40" height="40" rx="12" fill="#FFB088"/>
      
      {/* 羊的脸部轮廓 */}
      <ellipse cx="24" cy="28" rx="14" ry="12" fill="#FFFFFF"/>
      
      {/* 羊耳朵 */}
      <ellipse cx="13" cy="22" rx="5" ry="7" fill="#FFFFFF"/>
      <ellipse cx="35" cy="22" rx="5" ry="7" fill="#FFFFFF"/>
      
      {/* 羊毛卷 - 左边 */}
      <circle cx="16" cy="18" r="5" fill="#FFF5EE"/>
      <circle cx="12" cy="25" r="4" fill="#FFF5EE"/>
      <circle cx="18" cy="28" r="3" fill="#FFF5EE"/>
      
      {/* 羊毛卷 - 右边 */}
      <circle cx="32" cy="18" r="5" fill="#FFF5EE"/>
      <circle cx="36" cy="25" r="4" fill="#FFF5EE"/>
      <circle cx="30" cy="28" r="3" fill="#FFF5EE"/>
      
      {/* 羊毛卷 - 头顶 */}
      <circle cx="24" cy="14" r="6" fill="#FFF5EE"/>
      <circle cx="19" cy="12" r="4" fill="#FFF5EE"/>
      <circle cx="29" cy="12" r="4" fill="#FFF5EE"/>
      
      {/* 眼睛 */}
      <circle cx="19" cy="26" r="3" fill="#3D3D3D"/>
      <circle cx="29" cy="26" r="3" fill="#3D3D3D"/>
      <circle cx="19.5" cy="25.5" r="1" fill="#FFFFFF"/>
      <circle cx="29.5" cy="25.5" r="1" fill="#FFFFFF"/>
      
      {/* 鼻子 */}
      <ellipse cx="24" cy="30" rx="3" ry="2" fill="#FFB088"/>
      
      {/* 嘴巴 */}
      <path d="M21 33 Q24 35 27 33" stroke="#3D3D3D" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      
      {/* 优惠券角标 */}
      <g transform="translate(32, 8)">
        <rect x="0" y="0" width="12" height="14" rx="2" fill="#FF6B35"/>
        <rect x="2" y="2" width="8" height="10" rx="1" fill="white"/>
        <text x="6" y="9" fontSize="6" fill="#FF6B35" textAnchor="middle" fontWeight="bold">
          券
        </text>
      </g>
      
      {/* 铃铛装饰 */}
      <g transform="translate(24, 38)">
        <ellipse cx="0" cy="-2" rx="4" ry="3" fill="#FFD700"/>
        <rect x="-1" y="1" width="2" height="4" fill="#FFD700"/>
        <circle cx="0" cy="6" r="1.5" fill="#FFB088"/>
      </g>
    </svg>
  );
}

export default LogoIcon;