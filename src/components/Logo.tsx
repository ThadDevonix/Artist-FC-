import Image from "next/image";
import logo from "@/assets/artist-fc.png";

export function Logo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={logo}
      alt="Artist FC"
      width={size}
      height={size}
      priority
      className={`shrink-0 ${className}`}
      style={{ width: size, height: "auto" }}
    />
  );
}
