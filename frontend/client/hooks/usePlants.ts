import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import {
    fetchMyPlants as fetchPlantsAPI,
    recognizePlant as recognizePlantAPI,
    savePlant as savePlantAPI,
    deletePlant as deletePlantAPI,
} from "@/lib/api";

// Query keys for React Query cache
export const plantQueryKeys = {
    all: ["plants"] as const,
    myPlants: () => [...plantQueryKeys.all, "my-plants"] as const,
    processedForMap: () => [...plantQueryKeys.all, "processed-map"] as const,
};

// Hook to fetch user's plants
export function usePlants() {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: plantQueryKeys.myPlants(),
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            return fetchPlantsAPI(token);
        },
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
        enabled: !!getToken,
    });
}

// Hook for plant recognition
export function useRecognizePlant() {
    const { getToken } = useAuth();

    return useMutation({
        mutationFn: async (file: File) => {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            return recognizePlantAPI(file, token);
        },
    });
}

// Hook for saving plants
export function useSavePlant() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            return savePlantAPI(data, token);
        },
        onSuccess: () => {
            // Invalidate and refetch plants data after successful save
            queryClient.invalidateQueries({ queryKey: plantQueryKeys.myPlants() });
        },
    });
}

// Hook for deleting plants
export function useDeletePlant() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (plantId: string) => {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            return deletePlantAPI(plantId, token);
        },
        onMutate: async (plantId) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: plantQueryKeys.myPlants() });

            // Snapshot the previous value
            const previousPlants = queryClient.getQueryData(plantQueryKeys.myPlants());

            // Optimistically update to the new value
            queryClient.setQueryData(plantQueryKeys.myPlants(), (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    plants: old.plants.filter((p: any) => p._id !== plantId),
                };
            });

            // Return a context object with the snapshotted value
            return { previousPlants };
        },
        onError: (_err, _plantId, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousPlants) {
                queryClient.setQueryData(plantQueryKeys.myPlants(), context.previousPlants);
            }
        },
        onSuccess: () => {
            // Always refetch after error or success to ensure we have the latest data
            queryClient.invalidateQueries({ queryKey: plantQueryKeys.myPlants() });
            // Also invalidate processed map data
            queryClient.invalidateQueries({ queryKey: plantQueryKeys.processedForMap() });
        },
    });
}

// Helper function to geocode a plant location
async function geocodePlant(plant: any): Promise<any | null> {
    if (plant.location?.latitude &&
        plant.location?.longitude &&
        plant.location.latitude !== 0 &&
        plant.location.longitude !== 0) {
        return {
            ...plant,
            displayLat: plant.location.latitude,
            displayLng: plant.location.longitude,
            locationType: 'gps',
            locationSource: 'GPS coordinates'
        };
    }

    if (plant.location?.city && plant.location?.country) {
        try {
            const query = [plant.location.city, plant.location.state, plant.location.country]
                .filter(Boolean)
                .join(', ');

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
                {
                    headers: {
                        'User-Agent': 'AyurMap/1.0'
                    }
                }
            );

            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    ...plant,
                    displayLat: parseFloat(data[0].lat),
                    displayLng: parseFloat(data[0].lon),
                    locationType: 'geocoded',
                    locationSource: `Approximate location: ${query}`
                };
            }
        } catch (error) {
            console.error('Geocoding failed for:', plant.naturalName, error);
        }
    }

    return null;
}

// Hook to process plants for map display with caching
export function useProcessedPlantsForMap(plants: any[]) {
    return useQuery({
        queryKey: [...plantQueryKeys.processedForMap(), plants.map(p => p._id).sort()],
        queryFn: async () => {
            if (!plants || plants.length === 0) {
                return [];
            }

            const processed = await Promise.all(
                plants.map(geocodePlant)
            );

            return processed.filter(p => p !== null);
        },
        staleTime: 30 * 60 * 1000, // Geocoding data is valid for 30 minutes
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
        enabled: plants.length > 0,
    });
}

