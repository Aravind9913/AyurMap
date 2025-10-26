import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, useClerk, SignInButton, useAuth } from "@clerk/clerk-react";
import L from "leaflet";
import { API_CONFIG, API_ENDPOINTS, buildApiUrl, apiCall } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import ChatContainer from "@/components/ChatContainer";
import { toast } from "sonner";

type Plant = {
  id: string;
  name: string;
  scientificName?: string;
  description?: string;
  medicinalUses?: string;
  image?: string;
  lat?: number;
  lng?: number;
  farmerName?: string;
  farmerEmail?: string;
  confidence?: number;
};


export default function User() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkersRef = useRef<L.Layer[]>([]);
  const [query, setQuery] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCityInput, setShowCityInput] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [geocodingCity, setGeocodingCity] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showChangeLocation, setShowChangeLocation] = useState(false);
  const [popularPlants, setPopularPlants] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'map' | 'chats'>('map');
  const [initiatingChat, setInitiatingChat] = useState(false);

  // Function to start a chat with the farmer
  async function startChatWithFarmer() {
    if (!selectedPlant?.id || !user || initiatingChat) return;

    try {
      setInitiatingChat(true);
      const token = await getToken({ template: "ayurmap_backend" });

      // Start a chat for this plant
      const startChatUrl = buildApiUrl(API_ENDPOINTS.USER_START_CHAT);
      const response = await apiCall(startChatUrl, {
        method: 'POST',
        body: JSON.stringify({ plantId: selectedPlant.id })
      }, token);

      if (response.ok) {
        // Navigate to chats tab
        setActiveView('chats');
        toast.success('Chat opened successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to start chat');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
    } finally {
      setInitiatingChat(false);
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current, { zoomControl: true });
      leafletMapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.setView([20.5937, 78.9629], 5);
    }
  }, []);

  // Function to add user location markers to map
  function addUserLocationMarkers(lat: number, lng: number) {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear existing user markers
    userMarkersRef.current.forEach((m) => m.remove());
    userMarkersRef.current = [];

    // Add new user marker
    const userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#059669",
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    const circle = L.circle([lat, lng], {
      radius: 50000,
      color: "#34d399",
      opacity: 0.2
    }).addTo(map);

    userMarkersRef.current.push(userMarker, circle);
  }

  // Function to geocode city name to coordinates and update map
  async function geocodeCity(cityName: string) {
    try {
      setGeocodingCity(true);
      setLocationError(null);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`,
        {
          headers: {
            'User-Agent': 'AyurMap/1.0'
          }
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        // Update user location
        setUserLocation({ lat, lng });
        setShowCityInput(false);
        setShowChangeLocation(false);
        setCityInput("");
        setLocationError(null);

        // Update map view and add markers
        const map = leafletMapRef.current;
        if (map) {
          map.setView([lat, lng], 9);
          addUserLocationMarkers(lat, lng);
        }

        return { lat, lng };
      } else {
        throw new Error('City not found');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setLocationError('Failed to find the city. Please try another name.');
      return null;
    } finally {
      setGeocodingCity(false);
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      // Geolocation not supported - ask for city
      setShowCityInput(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        const map = leafletMapRef.current;
        if (!map) return;
        map.setView([lat, lng], 9);
        addUserLocationMarkers(lat, lng);
      },
      (err) => {
        // Location permission denied or error occurred - ask for city
        console.log('Geolocation error:', err);
        setShowCityInput(true);
      },
    );
  }, []);

  const fetchPlants = useCallback(async () => {
    if (!user || !userLocation) {
      console.log('❌ Cannot fetch plants - user:', !!user, 'userLocation:', !!userLocation);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await getToken({ template: "ayurmap_backend" });
      const url = buildApiUrl(API_ENDPOINTS.USER_PLANTS_NEARBY, {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius: 50
      });

      console.log('🌱 Fetching plants from:', url);
      console.log('📍 User location:', userLocation);

      const response = await apiCall(url, { method: 'GET' }, token);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 API Response:', data);

      if (data.status === 'success') {
        console.log('✅ Plants found:', data.data.plants.length);
        console.log('📊 Plant data:', data.data.plants);

        // Transform backend data to frontend format
        const transformedPlants = data.data.plants.map((plant: any) => {
          let imageUrl = undefined;

          // Use base64 image if available, otherwise try imageUrl
          if (plant.imageBase64) {
            imageUrl = `data:${plant.imageContentType || 'image/jpeg'};base64,${plant.imageBase64}`;
          } else if (plant.imageUrl) {
            // If imageUrl doesn't start with /uploads/, add the path
            let url = plant.imageUrl;
            if (!url.startsWith('/uploads/')) {
              url = `/uploads/plants/${url}`;
            }
            imageUrl = `${API_CONFIG.BASE_URL}${url}`;
          }

          return {
            id: plant._id,
            name: plant.naturalName,
            scientificName: plant.scientificName,
            description: plant.ayurvedicDescription,
            medicinalUses: plant.medicinalBenefits,
            image: imageUrl,
            lat: plant.location?.latitude,
            lng: plant.location?.longitude,
            farmerName: plant.farmerName,
            farmerEmail: plant.farmerEmail,
            confidence: plant.viewCount
          };
        });

        console.log('🔄 Transformed plants:', transformedPlants);
        setPlants(transformedPlants);
      } else {
        console.error('❌ API returned error:', data.message);
        throw new Error(data.message || 'Failed to fetch plants');
      }
    } catch (err) {
      console.error('❌ Error fetching plants:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch plants');
    } finally {
      setLoading(false);
    }
  }, [user, userLocation, getToken]);

  // Fetch popular plants for suggestions
  useEffect(() => {
    const fetchPopularPlants = async () => {
      if (!user) return;

      try {
        const token = await getToken({ template: "ayurmap_backend" });
        const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.USER_POPULAR_PLANTS}?limit=6`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            setPopularPlants(data.data.plants || []);
          }
        }
      } catch (err) {
        console.error('Error fetching popular plants:', err);
      }
    };

    fetchPopularPlants();
  }, [user]);

  useEffect(() => {
    if (!userLocation) return;
    fetchPlants();
    const t = setInterval(fetchPlants, 15_000);
    return () => clearInterval(t);
  }, [userLocation, fetchPlants]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    console.log('🗺️ Rendering markers for', plants.length, 'plants');

    // Only clear and update plant markers, keep user markers separate
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    let validPlants = 0;
    let invalidPlants = 0;

    plants.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") {
        console.log('⚠️ Invalid coordinates for plant:', p.name, 'lat:', p.lat, 'lng:', p.lng);
        invalidPlants++;
        return;
      }

      const borderColor = '#10b981'; // Emerald green for user view
      const imageSrc = p.image || '/placeholder.svg';

      const icon = L.divIcon({
        html: `
          <div style="position: relative; border: 3px solid ${borderColor}; border-radius: 50%; padding: 2px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: #e5e7eb;">
              <img src="${imageSrc}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          </div>
        `,
        className: "custom-plant-marker",
        iconSize: [44, 44]
      });

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);

      // Create popup content
      const popupContent = `<div style="max-width:220px"><img src="${imageSrc}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px"/><strong>${p.name}</strong><div style="font-size:12px;color:#065f46">${p.description ?? ""}</div></div>`;

      // Show popup on hover
      marker.on("mouseover", (e) => {
        marker.bindPopup(popupContent).openPopup();
      });

      // Close popup when mouse leaves
      marker.on("mouseout", () => {
        marker.closePopup();
      });

      // Open detailed sidebar on click
      marker.on("click", () => setSelectedPlant(p));
      markersRef.current.push(marker);
      validPlants++;
      console.log('✅ Added marker for:', p.name, 'at', p.lat, p.lng);
    });

    console.log('📊 Marker summary - Valid:', validPlants, 'Invalid:', invalidPlants);

    // Re-add user location markers if they exist
    if (userLocation) {
      addUserLocationMarkers(userLocation.lat, userLocation.lng);
    }
  }, [plants, userLocation]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!query) {
        if (userLocation) fetchPlants();
        return;
      }
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        const token = await getToken({ template: "ayurmap_backend" });
        const url = buildApiUrl(API_ENDPOINTS.USER_SEARCH_PLANTS);

        const response = await apiCall(url, {
          method: 'POST',
          body: JSON.stringify({
            query,
            latitude: userLocation?.lat,
            longitude: userLocation?.lng,
            radius: 50
          })
        }, token);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
          // Transform backend data to frontend format
          const transformedPlants = data.data.results.map((plant: any) => {
            let imageUrl = undefined;

            // Use base64 image if available, otherwise try imageUrl
            if (plant.imageBase64) {
              imageUrl = `data:${plant.imageContentType || 'image/jpeg'};base64,${plant.imageBase64}`;
            } else if (plant.imageUrl) {
              // If imageUrl doesn't start with /uploads/, add the path
              let url = plant.imageUrl;
              if (!url.startsWith('/uploads/')) {
                url = `/uploads/plants/${url}`;
              }
              imageUrl = `${API_CONFIG.BASE_URL}${url}`;
            }

            return {
              id: plant._id,
              name: plant.naturalName,
              scientificName: plant.scientificName,
              description: plant.ayurvedicDescription,
              medicinalUses: plant.medicinalBenefits,
              image: imageUrl,
              lat: plant.location.latitude,
              lng: plant.location.longitude,
              farmerName: plant.farmerName,
              farmerEmail: plant.farmerEmail,
              confidence: plant.viewCount
            };
          });
          setPlants(transformedPlants);
        } else {
          throw new Error(data.message || 'Search failed');
        }
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query, user, userLocation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold text-gray-900">AyurMap</div>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="hidden sm:block text-sm text-gray-700">{user.fullName}</div>
                  <img src={((user as any)?.profileImageUrl ?? (user as any)?.imageUrl) as string} alt={user.fullName || "user"} className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-100" />
                  <button onClick={() => signOut()} className="text-sm text-gray-600 hover:text-gray-900 transition">Logout</button>
                </>
              ) : (
                <SignInButton mode="modal">
                  <button className="text-sm text-gray-600 hover:text-gray-900 transition">Sign in</button>
                </SignInButton>
              )}
            </div>
          </div>
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveView('map')}
              className={`px-4 py-2 text-sm font-medium transition ${activeView === 'map'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Explore Plants
            </button>
            <button
              onClick={() => setActiveView('chats')}
              className={`px-4 py-2 text-sm font-medium transition ${activeView === 'chats'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              My Chats
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'chats' ? (
          <div className="h-[calc(100vh-200px)]">
            <ChatContainer role="consumer" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-900 mb-2">Search Plants</label>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by plant, disease, or health condition" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {popularPlants.map((t) => (
                    <button key={t} onClick={() => setQuery(t)} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 transition">{t}</button>
                  ))}
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Results {plants.length > 0 && <span className="text-gray-500">({plants.length})</span>}
                  </h3>
                  {loading && <div className="text-sm text-gray-500 mb-2">Loading...</div>}
                  {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
                  {plants.length === 0 && !loading && !error && (
                    <div className="text-sm text-gray-500 text-center py-8">
                      {query ? 'No plants found for your search.' : 'No plants found within 50km.'}
                    </div>
                  )}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {plants.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg hover:bg-gray-50 transition cursor-pointer flex gap-3 border border-gray-200" onClick={() => setSelectedPlant(p)}>
                        <img src={p.image || "/placeholder.svg"} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* City Input Field - Shown when GPS is not available or user wants to change location */}
              {showCityInput && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Enter Your City</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    We need your location to show nearby plants.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="Enter city name"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && cityInput.trim() && !geocodingCity) {
                          geocodeCity(cityInput);
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        if (cityInput.trim() && !geocodingCity) {
                          await geocodeCity(cityInput);
                        }
                      }}
                      disabled={geocodingCity || !cityInput.trim()}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap hover:bg-emerald-700 transition"
                    >
                      {geocodingCity ? 'Finding...' : 'Search'}
                    </button>
                  </div>
                  {locationError && <div className="text-xs text-red-600 mt-2">{locationError}</div>}
                </div>
              )}

              {/* Current Location Display - Shown when location is available and not changing */}
              {!showCityInput && !showChangeLocation && userLocation && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Your Location</h4>
                    <button
                      onClick={() => {
                        setShowChangeLocation(true);
                        setCityInput("");
                        setLocationError(null);
                      }}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Change
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">{userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</div>
                </div>
              )}

              {/* Change Location Input */}
              {showChangeLocation && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Change Location</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="Enter city name"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && cityInput.trim() && !geocodingCity) {
                          geocodeCity(cityInput);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        setShowChangeLocation(false);
                        setCityInput("");
                      }}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 whitespace-nowrap hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (cityInput.trim() && !geocodingCity) {
                          await geocodeCity(cityInput);
                          setShowChangeLocation(false);
                        }
                      }}
                      disabled={geocodingCity || !cityInput.trim()}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap hover:bg-emerald-700"
                    >
                      {geocodingCity ? 'Finding...' : 'Update'}
                    </button>
                  </div>
                  {locationError && <div className="text-xs text-red-600 mt-2">{locationError}</div>}
                </div>
              )}

              {/* Loading state - when initializing */}
              {!showCityInput && !userLocation && !showChangeLocation && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900">Your Location</h4>
                  <div className="text-sm text-gray-500">Detecting...</div>
                </div>
              )}
            </section>

            <section className="lg:col-span-2 relative">
              <div className="h-[calc(100vh-120px)] rounded-lg overflow-hidden border border-gray-200 bg-white relative z-0">
                <div ref={mapRef} style={{ height: "100%" }} className="w-full h-full" />
              </div>

              <aside className={`transition-transform fixed right-6 top-32 w-full max-w-md h-[calc(100vh-160px)] bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 z-50 ${selectedPlant ? "translate-x-0" : "translate-x-[120%]"}`}>
                {selectedPlant ? (
                  <div className="flex flex-col h-full">
                    {/* Header with close button */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <div className="flex items-center gap-4 flex-1">
                        <img src={selectedPlant.image || "/placeholder.svg"} className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">{selectedPlant.name}</h3>
                          <div className="text-xs text-gray-500 truncate">{selectedPlant.scientificName}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPlant(null)}
                        className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
                        aria-label="Close"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {selectedPlant.description && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                          <div className="prose prose-sm max-w-none text-sm text-gray-600">
                            <ReactMarkdown>{selectedPlant.description}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {selectedPlant.medicinalUses && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Medicinal Uses</h4>
                          <div className="prose prose-sm max-w-none text-sm text-gray-600">
                            <ReactMarkdown>{selectedPlant.medicinalUses}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {selectedPlant.farmerName && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Farmer</h4>
                          <p className="text-sm text-gray-600">{selectedPlant.farmerName}</p>
                        </div>
                      )}

                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Chat with Farmer</h4>
                        <button
                          onClick={startChatWithFarmer}
                          disabled={initiatingChat}
                          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {initiatingChat ? 'Starting...' : 'Open Chat'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 mt-20 p-6">Select a plant to see details</div>
                )}
              </aside>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
