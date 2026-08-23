"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, Plus, RotateCcw, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n/locale-provider";
import {
  createSnapshot,
  getSnapshots,
  restoreSnapshot,
  deleteSnapshot,
} from "@/app/actions/snapshots";
import type { ScheduleData } from "@/lib/schedule-data";

type SnapshotItem = {
  id: string;
  name: string;
  createdAt: Date;
};

type Props = {
  onRestored: (data: ScheduleData) => void;
  disabled?: boolean;
};

export function SnapshotManager({ onRestored, disabled }: Props) {
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      loadSnapshots();
    }
  }, [open]);

  async function loadSnapshots() {
    setLoading(true);
    const res = await getSnapshots();
    if (res.ok && res.snapshots) {
      setSnapshots(res.snapshots);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await createSnapshot(newName.trim());
    setCreating(false);
    if (res.ok) {
      toast.success(s("snapshots.toastCreated"));
      setCreateOpen(false);
      setNewName("");
      loadSnapshots();
    } else {
      toast.error(s("snapshots.toastFailed"), { description: res.message });
    }
  }

  async function handleRestore(id: string) {
    if (!window.confirm(s("snapshots.confirmRestore"))) return;
    const res = await restoreSnapshot(id);
    if (res.ok && res.data) {
      toast.success(s("snapshots.toastRestored"));
      onRestored(res.data);
      setOpen(false);
    } else {
      toast.error(s("snapshots.toastFailed"), { description: res.message });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(s("snapshots.confirmDelete"))) return;
    const res = await deleteSnapshot(id);
    if (res.ok) {
      toast.success(s("snapshots.toastDeleted"));
      loadSnapshots();
    } else {
      toast.error(s("snapshots.toastFailed"), { description: res.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <History className="mr-2 h-4 w-4" /> {s("snapshots.title")}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{s("snapshots.title")}</DialogTitle>
          <DialogDescription>{s("snapshots.desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">History</h4>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm" variant="secondary" />}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {s("snapshots.create")}
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{s("snapshots.createTitle")}</DialogTitle>
                <DialogDescription>{s("snapshots.createDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1.5">
                  <Label>{s("snapshots.name")}</Label>
                  <Input
                    autoFocus
                    placeholder={s("snapshots.placeholder")}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  {s("common.cancel")}
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {s("snapshots.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">
              {s("snapshots.empty")}
            </p>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center justify-between rounded-md border p-2.5 shadow-sm"
              >
                <div>
                  <div className="text-sm font-medium">{snap.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(snap.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(snap.id)}
                    title={s("snapshots.restore")}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    {s("snapshots.restore")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(snap.id)}
                    title={s("snapshots.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
