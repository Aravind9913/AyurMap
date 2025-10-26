import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Column<T> {
    key: keyof T | string;
    header: string;
    render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    searchPlaceholder?: string;
    pagination?: {
        currentPage: number;
        totalPages: number;
        hasPrev: boolean;
        hasNext: boolean;
        onPageChange: (page: number) => void;
    };
    loading?: boolean;
    emptyMessage?: string;
}

export function DataTable<T extends { _id: string }>({
    data,
    columns,
    searchPlaceholder = "Search...",
    pagination,
    loading = false,
    emptyMessage = "No data available",
}: DataTableProps<T>) {
    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead className="bg-muted">
                    <tr>
                        {columns.map((col) => (
                            <th key={String(col.key)} className="p-3 text-left text-sm font-medium">
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                                Loading...
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((item) => (
                            <tr key={item._id} className="border-t hover:bg-accent/50 transition-colors">
                                {columns.map((col) => (
                                    <td key={String(col.key)} className="p-3">
                                        {col.render ? col.render(item) : String(item[col.key as keyof T] || "")}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {pagination && (
                <div className="flex justify-between items-center p-4 border-t bg-muted/50">
                    <div className="text-sm text-muted-foreground">
                        Page {pagination.currentPage} of {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!pagination.hasPrev}
                            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!pagination.hasNext}
                            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

