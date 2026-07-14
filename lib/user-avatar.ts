export const allowedUserAvatarTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type UserAvatarMimeType = typeof allowedUserAvatarTypes[number];

export const maxUserAvatarSize = 2 * 1024 * 1024;
export const userAvatarAccept = allowedUserAvatarTypes.join(",");

export function isAllowedUserAvatarType(value: string): value is UserAvatarMimeType {
  return (allowedUserAvatarTypes as readonly string[]).includes(value);
}

export function extensionForUserAvatarMimeType(mimeType: UserAvatarMimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".webp";
}

export function userAvatarMimeTypeForExtension(extension: string): UserAvatarMimeType | undefined {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return undefined;
}
