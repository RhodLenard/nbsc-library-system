export function assertSelfAccountSafe(actorId: string, targetId: string, targetStatus: "Active" | "Inactive", targetRole: string, actorRole: string) {
  if (actorId === targetId && (targetStatus === "Inactive" || targetRole !== actorRole)) throw new Error("You cannot deactivate or change the role of your own account.");
}

export function assertLastAdminSafe(targetWasActiveAdmin: boolean, removesAdminAccess: boolean, otherActiveAdminCount: number) {
  if (targetWasActiveAdmin && removesAdminAccess && otherActiveAdminCount < 1) throw new Error("The system must keep at least one active Admin.");
}
