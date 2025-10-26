interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    variant?: "default" | "success" | "warning" | "destructive";
}

export function StatsCard({ title, value, subtitle, variant = "default" }: StatsCardProps) {
    const variantStyles = {
        default: "text-foreground",
        success: "text-success",
        warning: "text-yellow-600",
        destructive: "text-destructive",
    };

    return (
        <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="text-sm text-muted-foreground mb-1">{title}</div>
            <div className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
        </div>
    );
}

