import { useEffect, useRef, useState } from "react";
import { useUser, useClerk, SignInButton, useAuth } from "@clerk/clerk-react";
import L from "leaflet";
import { API_CONFIG, API_ENDPOINTS, buildApiUrl, apiCall } from "@/lib/api";

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

type Message = { id: string; sender: string; text: string; createdAt?: string };

export default function User() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [query, setQuery] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [chat, setChat] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        const map = leafletMapRef.current;
        if (!map) return;
        map.setView([lat, lng], 9);
        const userMarker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: "#059669",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);
        const circle = L.circle([lat, lng], { radius: 50000, color: "#34d399", opacity: 0.2 }).addTo(map);
        return () => {
          userMarker.remove();
          circle.remove();
        };
      },
      () => {},
    );
  }, []);

  async function fetchPlants() {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = await getToken({ template: "ayurmap_backend" });
      const url = buildApiUrl(API_ENDPOINTS.USER_PLANTS_NEARBY, {
        latitude: userLocation?.lat || 20.5937,
        longitude: userLocation?.lng || 78.9629,
        radius: 100
      });
      
      const response = await apiCall(url, { method: 'GET' }, token);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Transform backend data to frontend format
        const transformedPlants = data.data.plants.map((plant: any) => ({
          id: plant._id,
          name: plant.naturalName,
          scientificName: plant.scientificName,
          description: plant.ayurvedicDescription,
          medicinalUses: plant.medicinalBenefits,
          image: plant.imageUrl,
          lat: plant.location.latitude,
          lng: plant.location.longitude,
          farmerName: plant.farmerName,
          farmerEmail: plant.farmerEmail,
          confidence: plant.viewCount
        }));
        setPlants(transformedPlants);
      } else {
        throw new Error(data.message || 'Failed to fetch plants');
      }
    } catch (err) {
      console.error('Error fetching plants:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch plants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlants();
    const t = setInterval(fetchPlants, 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    plants.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      const el = L.divIcon({
        html: `<div class="rounded-full bg-white p-1 shadow-md" style="border:2px solid rgba(52,211,153,0.25)"><img src="${p.image || "/placeholder.svg"}" style="width:36px;height:36px;border-radius:999px;object-fit:cover;border:2px solid rgba(0,0,0,0.06)"/></div>`,
        className: "",
        iconSize: [40, 40],
      });
      const marker = L.marker([p.lat, p.lng], { icon: el }).addTo(map);
      marker.bindPopup(`<div style="max-width:220px"><img src="${p.image || "/placeholder.svg"}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px"/><strong>${p.name}</strong><div style="font-size:12px;color:#065f46">${p.description ?? ""}</div></div>`);
      marker.on("click", () => setSelectedPlant(p));
      markersRef.current.push(marker);
    });
  }, [plants]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!query) return fetchPlants();
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
            radius: 100
          })
        }, token);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
          // Transform backend data to frontend format
          const transformedPlants = data.data.results.map((plant: any) => ({
            id: plant._id,
            name: plant.naturalName,
            scientificName: plant.scientificName,
            description: plant.ayurvedicDescription,
            medicinalUses: plant.medicinalBenefits,
            image: plant.imageUrl,
            lat: plant.location.latitude,
            lng: plant.location.longitude,
            farmerName: plant.farmerName,
            farmerEmail: plant.farmerEmail,
            confidence: plant.viewCount
          }));
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

  useEffect(() => {
    let poll: number | undefined;
    const loadChat = async () => {
      if (!selectedPlant?.id || !user) {
        setChat([]);
        return;
      }
      
      try {
        const token = await getToken({ template: "ayurmap_backend" });
        
        // First, start a chat if it doesn't exist
        const startChatUrl = buildApiUrl(API_ENDPOINTS.USER_START_CHAT);
        const startChatResponse = await apiCall(startChatUrl, {
          method: 'POST',
          body: JSON.stringify({ plantId: selectedPlant.id })
        }, token);
        
        if (startChatResponse.ok) {
          const startChatData = await startChatResponse.json();
          const chatId = startChatData.data.chatId;
          
          // Then get chat messages
          const chatUrl = buildApiUrl(`${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`);
          const chatResponse = await apiCall(chatUrl, { method: 'GET' }, token);
          
          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            if (chatData.status === 'success') {
              // Transform backend messages to frontend format
              const transformedMessages = chatData.data.messages.map((msg: any) => ({
                id: msg._id,
                sender: msg.senderEmail,
                text: msg.message,
                createdAt: new Date(msg.timestamp).toLocaleString()
              }));
              setChat(transformedMessages);
            }
          }
        }
      } catch (err) {
        console.error('Error loading chat:', err);
      }
    };
    
    loadChat();
    poll = window.setInterval(loadChat, 3000);
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [selectedPlant, user]);

  async function sendMessage() {
    if (!selectedPlant?.id || !user || !messageText.trim()) return;
    
    try {
      const token = await getToken({ template: "ayurmap_backend" });
      
      // First, start a chat if it doesn't exist
      const startChatUrl = buildApiUrl(API_ENDPOINTS.USER_START_CHAT);
      const startChatResponse = await apiCall(startChatUrl, {
        method: 'POST',
        body: JSON.stringify({ plantId: selectedPlant.id })
      }, token);
      
      if (startChatResponse.ok) {
        const startChatData = await startChatResponse.json();
        const chatId = startChatData.data.chatId;
        
        // Send the message
        const messageUrl = buildApiUrl(`${API_ENDPOINTS.CHAT_MESSAGES}/${chatId}/messages`);
        const messageResponse = await apiCall(messageUrl, {
          method: 'POST',
          body: JSON.stringify({ 
            message: messageText,
            messageType: 'text'
          })
        }, token);
        
        if (messageResponse.ok) {
          setMessageText("");
          // Refresh chat messages
          const chatUrl = buildApiUrl(`${API_ENDPOINTS.CHAT_DETAILS}/${chatId}`);
          const chatResponse = await apiCall(chatUrl, { method: 'GET' }, token);
          
          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            if (chatData.status === 'success') {
              const transformedMessages = chatData.data.messages.map((msg: any) => ({
                id: msg._id,
                sender: msg.senderEmail,
                text: msg.message,
                createdAt: new Date(msg.timestamp).toLocaleString()
              }));
              setChat(transformedMessages);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-background p-6">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-extrabold text-emerald-900">AyurMap</div>
          <div className="text-sm text-emerald-800/80">Explore Ayurvedic plants</div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <img src={((user as any)?.profileImageUrl ?? (user as any)?.imageUrl) as string} alt={user.fullName || "user"} className="h-8 w-8 rounded-full object-cover" />
              <div className="text-sm text-emerald-900">{user.fullName}</div>
              <button onClick={() => signOut()} className="ml-3 inline-flex items-center rounded-md bg-white px-3 py-1 text-sm shadow">Logout</button>
            </>
          ) : (
            <SignInButton mode="modal">
              <button className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">Sign in</button>
            </SignInButton>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4 shadow">
            <label className="block text-sm font-medium text-emerald-900 mb-2">Search Ayurvedic Plants</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by plant, disease, or health condition" className="w-full rounded-lg border border-emerald-100 px-3 py-2 shadow-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              {["Tulsi", "Neem", "Amla", "Stress", "Immunity", "Fever"].map((t) => (
                <button key={t} onClick={() => setQuery(t)} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 shadow-sm">{t}</button>
              ))}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-emerald-900 mb-2">Results</h3>
              {loading && <div className="text-sm text-emerald-700 mb-2">Loading...</div>}
              {error && <div className="text-sm text-red-600 mb-2">Error: {error}</div>}
              <div className="space-y-2 max-h-[45vh] overflow-auto">
                {plants.map((p) => (
                  <div key={p.id} className="p-2 rounded-lg hover:bg-emerald-50 transition cursor-pointer flex gap-3 items-start" onClick={() => setSelectedPlant(p)}>
                    <img src={p.image || "/placeholder.svg"} className="w-14 h-14 rounded-md object-cover shadow-sm" />
                    <div>
                      <div className="font-semibold text-emerald-900">{p.name}</div>
                      <div className="text-xs text-emerald-800/70">{p.description}</div>
                    </div>
                  </div>
                ))}
                {plants.length === 0 && !loading && !error && (
                  <div className="text-sm text-emerald-700 text-center py-4">
                    {query ? 'No plants found for your search.' : 'No plants available nearby.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow">
            <h4 className="font-semibold text-emerald-900">Your Location</h4>
            <div className="text-sm text-emerald-700">{userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : "Detecting..."}</div>
          </div>
        </section>

        <section className="lg:col-span-2 relative">
          <div className="h-[70vh] rounded-2xl overflow-hidden shadow-lg">
            <div ref={mapRef} style={{ height: "100%" }} className="w-full h-full" />
          </div>

          <aside className={`transition-transform fixed right-6 top-24 w-full max-w-md h-[70vh] bg-white rounded-2xl shadow-xl p-4 overflow-auto ${selectedPlant ? "translate-x-0" : "translate-x-[120%]"}`}>
            {selectedPlant ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-emerald-900">{selectedPlant.name}</h3>
                    <div className="text-sm text-emerald-700">{selectedPlant.scientificName}</div>
                  </div>
                  <img src={selectedPlant.image || "/placeholder.svg"} className="w-16 h-16 rounded-md object-cover shadow" />
                </div>

                <div className="text-sm text-emerald-800">{selectedPlant.description}</div>
                <div className="text-sm text-emerald-800"><strong>Medicinal Uses:</strong> {selectedPlant.medicinalUses}</div>
                <div className="text-sm text-emerald-800"><strong>Farmer:</strong> {selectedPlant.farmerName}</div>

                <div className="pt-2 border-t" />

                <div className="flex flex-col h-56">
                  <div className="flex-1 overflow-auto space-y-2 p-2 bg-emerald-50 rounded-md">
                    {chat.map((m) => (
                      <div key={m.id} className={`max-w-[80%] p-2 rounded-lg ${m.sender === (user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress) ? "ml-auto bg-emerald-500 text-white" : "bg-white text-emerald-900"}`}>
                        <div className="text-sm">{m.text}</div>
                        <div className="text-xs text-emerald-700 mt-1">{m.createdAt}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Message farmer..." className="flex-1 rounded-lg border border-emerald-100 px-3 py-2" />
                    <button onClick={sendMessage} className="rounded-lg bg-emerald-600 px-4 text-white">Send</button>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-end">
                  <button onClick={() => setSelectedPlant(null)} className="text-sm text-emerald-700">Close</button>
                </div>
              </div>
            ) : (
              <div className="text-center text-emerald-700">Select a plant marker or result to see details</div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
