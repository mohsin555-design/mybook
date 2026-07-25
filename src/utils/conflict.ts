export function isDriveVersionNewer(lastSyncedAt: string | null, driveModifiedTime: string | null | undefined) {
  if (!lastSyncedAt || !driveModifiedTime) return false
  return new Date(driveModifiedTime).getTime() > new Date(lastSyncedAt).getTime()
}
