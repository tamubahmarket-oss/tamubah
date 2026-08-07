export function validatePassword(password: string): { isValid: boolean; message?: string } {
  const trimmed = (password || "").trim();
  if (trimmed.length < 6) {
    return { isValid: false, message: "Password must be at least 6 characters long." };
  }

  return { isValid: true };
}
