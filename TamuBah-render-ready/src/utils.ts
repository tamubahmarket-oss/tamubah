/**
 * SSM (Suruhanjaya Syarikat Malaysia / Companies Commission of Malaysia) Number Validation Utility
 */

export interface SSMValidationResult {
  isValid: boolean;
  format: "new" | "old_company" | "old_business" | "old_llp" | "sabah_license" | null;
  entityType?: string;
  year?: string;
  normalized?: string;
  message?: string;
}

/**
 * Validates a Malaysia SSM registration number or a Sabah local Trading License format.
 * Works for:
 * 1. New 12-digit Format (e.g., 201901000001)
 * 2. Old Company Format (e.g., 123456-A or 123456A)
 * 3. Old Business / Sole-Prop Format (e.g., 001234567-T, SA0123456-X)
 * 4. Old LLP Format (e.g., LLP0001234-LGN)
 * 5. Sabah local Trading License / Municipal Council Permit (e.g., DBKK/12345/2023, KKS-12345, MDG/8834/B, etc.)
 */
export function validateSSM(ssmStr: string): SSMValidationResult {
  const clean = ssmStr.replace(/\s+/g, "").toUpperCase();
  if (!clean) {
    return { isValid: false, format: null, message: "License / SSM number is empty." };
  }

  // 1. New 12-digit Format (introduced 12 October 2019)
  // Format: YYYY (year of incorporation) + XX (entity type) + NNNNNN (sequential number)
  const newFormatRegex = /^(19\d\d|20[0-2]\d)(0[1-6])(\d{6})$/;
  const newMatch = clean.match(newFormatRegex);
  if (newMatch) {
    const year = newMatch[1];
    const typeCode = newMatch[2];
    let entityType = "Registered Entity";
    if (typeCode === "01") entityType = "Local Company (Sdn. Bhd. / Bhd.)";
    else if (typeCode === "02") entityType = "Foreign Company";
    else if (typeCode === "03") entityType = "Sole Proprietorship / Partnership";
    else if (typeCode === "04") entityType = "Local LLP";
    else if (typeCode === "05") entityType = "Foreign LLP";
    else if (typeCode === "06") entityType = "Professional LLP";

    return {
      isValid: true,
      format: "new",
      entityType,
      year,
      normalized: clean,
      message: `Valid 12-digit SSM Number (${entityType}, registered in ${year}).`
    };
  }

  // 2. Old Company Format (1 to 7 digits followed by optional hyphen and a letter)
  const oldCompanyRegex = /^(\d{1,7})-?([A-Z])$/;
  const companyMatch = clean.match(oldCompanyRegex);
  if (companyMatch) {
    const digits = companyMatch[1];
    const checkDigit = companyMatch[2];
    return {
      isValid: true,
      format: "old_company",
      entityType: "Sdn. Bhd. / Bhd. (Old Format)",
      normalized: `${digits}-${checkDigit}`,
      message: `Valid Old Company SSM format (${digits}-${checkDigit}).`
    };
  }

  // 3. Old Business Format (9 digits OR 2 state letters + 7 digits, followed by hyphen and a letter)
  const oldBusinessRegex = /^([A-Z]{2}\d{7}|\d{9})-?([A-Z])$/;
  const businessMatch = clean.match(oldBusinessRegex);
  if (businessMatch) {
    const main = businessMatch[1];
    const checkDigit = businessMatch[2];
    
    let stateInfo = "";
    if (isNaN(Number(main.substring(0, 2)))) {
      const prefix = main.substring(0, 2);
      if (prefix === "SB") stateInfo = " (Sabah Business Prefix)";
      else if (prefix === "SW") stateInfo = " (Sarawak Business Prefix)";
      else if (prefix === "SA") stateInfo = " (Selangor Business Prefix)";
    }

    return {
      isValid: true,
      format: "old_business",
      entityType: "Sole Proprietorship / Partnership (Old Format)",
      normalized: `${main}-${checkDigit}`,
      message: `Valid Old Business SSM format (${main}-${checkDigit})${stateInfo}.`
    };
  }

  // 4. Old LLP Format
  const oldLlpRegex = /^(LLP\d{7})-?([A-Z]*)$/;
  const llpMatch = clean.match(oldLlpRegex);
  if (llpMatch) {
    const llpId = llpMatch[1];
    const suffix = llpMatch[2] ? `-${llpMatch[2]}` : "";
    return {
      isValid: true,
      format: "old_llp",
      entityType: "Limited Liability Partnership (Old Format)",
      normalized: `${llpId}${suffix}`,
      message: `Valid Old LLP SSM format (${llpId}${suffix}).`
    };
  }

  // 5. Sabah local Trading License / Municipal Council Permit (Lesen Perniagaan Sabah)
  // Supporting alphanumeric characters with optional slashes, hyphens, and spaces. E.g., DBKK/12345/2023, KKS-12345
  const sabahLicenseRegex = /^[A-Z0-9\/\-]{4,35}$/;
  if (sabahLicenseRegex.test(clean)) {
    return {
      isValid: true,
      format: "sabah_license",
      entityType: "Sabah Trading License / Municipal Council Permit",
      normalized: clean,
      message: "Valid Sabah Trading License / Business Permit format."
    };
  }

  return {
    isValid: false,
    format: null,
    message: "Invalid format. Enter a valid Sabah Trading License or SSM number (e.g., DBKK/12345/2026, KKS-12345, or 202603120150)."
  };
}

/**
 * Compresses and resizes an image file or Base64 string.
 * Forces the image to fit within maxDimension (width or height) while preserving aspect ratio.
 * Converts the output format to either image/webp or image/jpeg.
 */
export function compressAndResizeImage(
  input: File | string,
  maxDimension: number = 800,
  quality: number = 0.8,
  preferredFormat: "image/webp" | "image/jpeg" = "image/webp"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImageSource = (src: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Resize proportionally if dimensions exceed maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get 2D context from canvas."));
            return;
          }

          // Clear background (draw white background for JPEGs if needed to avoid black bars on transparent PNGs)
          if (preferredFormat === "image/jpeg") {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Get compressed data URL
          const compressedDataUrl = canvas.toDataURL(preferredFormat, quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for compression."));
      };
      img.src = src;
    };

    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImageSource(e.target.result as string);
        } else {
          reject(new Error("FileReader read empty result."));
        }
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file."));
      };
      reader.readAsDataURL(input);
    } else if (typeof input === "string") {
      processImageSource(input);
    } else {
      reject(new Error("Invalid input type. Must be a File or base64 Data URL."));
    }
  });
}

