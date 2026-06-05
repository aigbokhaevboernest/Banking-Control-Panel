// Semantic status color helpers used across the admin dashboard.
// completed/approved/active -> green (success)
// pending/processing/blocked -> amber (warning)
// failed/rejected/deleted -> red (destructive)

export function statusBadgeClasses(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (["completed", "approved", "active", "success"].includes(s))
    return "border-success/30 bg-success/10 text-success";
  if (["pending", "processing", "blocked", "frozen"].includes(s))
    return "border-warning/30 bg-warning/10 text-warning";
  if (["failed", "rejected", "declined", "deleted"].includes(s))
    return "border-destructive/30 bg-destructive/10 text-destructive";
  return "";
}

export function statusButtonClasses(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (["completed", "approved", "active"].includes(s))
    return "bg-success text-success-foreground hover:bg-success/90 border-success";
  if (["pending", "processing", "blocked"].includes(s))
    return "bg-warning text-warning-foreground hover:bg-warning/90 border-warning";
  if (["failed", "rejected", "deleted", "delete"].includes(s))
    return "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive";
  return "";
}
