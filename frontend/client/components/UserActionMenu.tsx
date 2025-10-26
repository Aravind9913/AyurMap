import { Button } from "@/components/ui/button";

interface UserActionMenuProps {
    onBlock: () => void;
    onSuspend: () => void;
    onDelete: () => void;
    onViewActivity?: () => void;
    isBlocked?: boolean;
}

export function UserActionMenu({
    onBlock,
    onSuspend,
    onDelete,
    onViewActivity,
    isBlocked = false,
}: UserActionMenuProps) {
    return (
        <div className="flex gap-2">
            {onViewActivity && (
                <Button size="sm" variant="outline" onClick={onViewActivity}>
                    View
                </Button>
            )}
            <Button
                size="sm"
                variant={isBlocked ? "default" : "destructive"}
                onClick={onBlock}
            >
                {isBlocked ? "Unblock" : "Block"}
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={onSuspend}
            >
                Suspend
            </Button>
            <Button
                size="sm"
                variant="destructive"
                onClick={onDelete}
            >
                Delete
            </Button>
        </div>
    );
}

