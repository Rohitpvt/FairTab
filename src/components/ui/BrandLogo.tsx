import React from "react";

export interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  alt?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

/**
 * Official FairTab Brand Logo component rendering the glowing neon FT icon from public/icons/icon-192.png.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "",
  size = "md",
  alt = "FairTab Logo",
}) => {
  const basePath = import.meta.env.BASE_URL || "/";
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const iconSrc = `${normalizedBase}icons/icon-192.png`;

  return (
    <img
      src={iconSrc}
      alt={alt}
      role="img"
      aria-label={alt}
      className={`rounded-xl object-contain shrink-0 select-none shadow-md shadow-accent-cyan/15 ${sizeClasses[size]} ${className}`}
      loading="eager"
    />
  );
};

export default BrandLogo;
