interface TimelineEvent {
    id: string;
    title: string;
    description: string;
    timestamp: Date;
    type?: "default" | "success" | "warning" | "destructive";
}

interface ActivityTimelineProps {
    events: TimelineEvent[];
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
    const getTypeStyles = (type?: string) => {
        switch (type) {
            case "success":
                return "bg-green-100 border-green-500";
            case "warning":
                return "bg-yellow-100 border-yellow-500";
            case "destructive":
                return "bg-red-100 border-red-500";
            default:
                return "bg-blue-100 border-blue-500";
        }
    };

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${getTypeStyles(event.type)}`} />
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium">{event.title}</h4>
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                {new Date(event.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

