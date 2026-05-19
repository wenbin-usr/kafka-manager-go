import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

/** Kafka Manager 品牌图标：K 字形 + 消息流分区线 */
const AppLogo: React.FC<AppLogoProps> = ({ size = 36, className }) => (
  <img
    src="/logo.svg"
    alt=""
    width={size}
    height={size}
    className={className}
    draggable={false}
    style={{ display: 'block', flexShrink: 0 }}
  />
);

export default AppLogo;
