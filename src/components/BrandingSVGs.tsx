import React from 'react';

interface BrandingAssetProps {
  className?: string;
}

export const INSTITUTION_LOGO_SRC = '/assets/aistudio/square-image_781837b3.jpg';
export const OFFICIAL_SEAL_SRC = '/assets/aistudio/file_000000007378820b8f559430d0b22c58_357028df.png';
export const DIRECTOR_SIGNATURE_SRC = '/assets/aistudio/file_00000000208c820b9cedf3fa8c3a415f_28089f71.png';

/**
 * Official Institution Crest Logo (Radhe Learning Point — Shri Radhe Shikshan Sansthan)
 */
export const InstitutionLogo: React.FC<BrandingAssetProps> = ({ className = 'w-14 h-14' }) => {
  return (
    <img
      src={INSTITUTION_LOGO_SRC}
      alt="Shri Radhe Shikshan Sansthan — Radhe Learning Point Logo"
      referrerPolicy="no-referrer"
      className={`${className} rounded-full object-cover object-center border-2 border-[#D4AF37] bg-[#06214D] select-none`}
    />
  );
};

/**
 * Official Institution Rubber Stamp Seal (Mohar)
 */
export const OfficialSealSVG: React.FC<BrandingAssetProps> = ({ className = 'w-36 h-36' }) => {
  return (
    <img
      src={OFFICIAL_SEAL_SRC}
      alt="Official Seal: Shri Radhe Shikshan Sansthan — Radhe Learning Point"
      referrerPolicy="no-referrer"
      className={`${className} rounded-full object-contain brightness-105 contrast-115 mix-blend-multiply select-none`}
    />
  );
};

/**
 * Authorized Director Signature ("Krishna Kumar Sir")
 */
export const DirectorSignatureSVG: React.FC<BrandingAssetProps> = ({
  className = 'w-56 h-20',
}) => {
  return (
    <img
      src={DIRECTOR_SIGNATURE_SRC}
      alt="Director Signature: Krishna Kumar Sir"
      referrerPolicy="no-referrer"
      className={`${className} object-contain brightness-105 contrast-115 mix-blend-multiply select-none`}
    />
  );
};

/**
 * Subtle decorative Institution Crest watermark for dashboard & verification cards
 */
export const InstitutionWatermark: React.FC<BrandingAssetProps> = ({
  className = 'w-44 h-44 -right-8 -top-8 opacity-[0.07]',
}) => {
  return (
    <img
      src={INSTITUTION_LOGO_SRC}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
      className={`pointer-events-none select-none rounded-full object-cover absolute ${className}`}
    />
  );
};

