import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold">Admin account</h3>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold">About</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Nova Bank Admin Dashboard. All controls take effect instantly across the platform.
        </p>
      </Card>
    </div>
  );
}
