import { useState, useEffect } from "react";
import { useUser, useAuth, useClerk, SignInButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// AuthenticatedImage component that adds auth token to image requests
function AuthenticatedImage({ plantId, alt, className }: { plantId: string; alt: string; className?: string }) {
  const { getToken } = useAuth();
  const [imageSrc, setImageSrc] = useState<string>('/placeholder.svg');

  useEffect(() => {
    async function loadImage() {
      const token = await getToken();
      if (!token) {
        setImageSrc('/placeholder.svg');
        return;
      }

      const url = `http://localhost:5000/api/farmer/plants/${plantId}/image`;

      // Fetch the image as a blob with authentication
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          setImageSrc(objectUrl);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        setImageSrc('/placeholder.svg');
      }
    }

    loadImage();
  }, [plantId, getToken]);

  return <img src={imageSrc} alt={alt} className={className} />;
}

type Taxonomy = {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
};

type SimilarImage = {
  url: string;
  url_small: string;
  similarity: number;
  citation?: string;
  license_name?: string;
  license_url?: string;
};

type Watering = {
  min: number;
  max: number;
};

type PlantData = {
  name?: string;
  scientificName?: string;
  commonNames?: string[];
  confidence?: number;
  description?: string;
  medicinalUses?: string;
  taxonomy?: Taxonomy;
  edibleParts?: string[];
  propagationMethods?: string[];
  synonyms?: string[];
  watering?: Watering | null;
  gbifId?: number;
  inaturalistId?: number;
  wikipediaUrl?: string;
  similarImages?: SimilarImage[];
  imageBase64?: string;
  imageContentType?: string;
  imageOriginalName?: string;
};

export default function Farmer() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // Redirect to home if not signed in
  useEffect(() => {
    if (!isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [isSignedIn, navigate]);

  const [activeView, setActiveView] = useState<'add-new' | 'gallery'>('add-new');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<PlantData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNotification, setSavedNotification] = useState(false);
  const [myPlants, setMyPlants] = useState<any[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<string | null>(null);

  function handleFileUpload(f: File | null) {
    setFile(f);
    setPlantData(null);
    setStatusMessage(null);

    if (!f) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(f);
    setPreview(url);

    // Automatically recognize plant
    recognizePlant(f);
  }

  async function recognizePlant(f: File) {
    setRecognizing(true);
    setStatusMessage("🔍 Recognizing plant...");

    try {
      // Get Clerk token
      const token = await getToken();
      if (!token) {
        setStatusMessage("❌ Authentication required");
        setRecognizing(false);
        return;
      }

      const fd = new FormData();
      fd.append("plantImage", f);

      const res = await fetch("http://localhost:5000/api/farmer/recognize-plant", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: fd
      });

      if (!res.ok) {
        let errText = "❌ Plant recognition failed";
        try {
          const data = await res.json();
          errText = data.message || data.error || JSON.stringify(data);
        } catch (e) {
          errText = await res.text() || "❌ Plant recognition failed";
        }
        setStatusMessage(errText);
        setRecognizing(false);
        return;
      }

      const data = await res.json();

      if (data.status === 'success') {
        console.log('📦 Received data:', data.data);
        console.log('💊 Medicinal uses:', data.data.medicinalUses);
        setPlantData(data.data);
        setStatusMessage("✅ Plant recognized successfully!");
      } else {
        setStatusMessage("🌱 Could not identify this plant. Please try another image.");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Plant recognition failed");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleSave() {
    if (!plantData) return;

    setSaving(true);
    setStatusMessage("💾 Saving to database...");

    try {
      // Get Clerk token
      const token = await getToken();
      if (!token) {
        setStatusMessage("❌ Authentication required");
        setSaving(false);
        return;
      }

      const res = await fetch("http://localhost:5000/api/farmer/save-plant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(plantData),
      });

      if (!res.ok) {
        const error = await res.json();
        setStatusMessage(`❌ Save failed: ${error.message}`);
        setSaving(false);
        return;
      }

      const data = await res.json();
      setStatusMessage("✅ Plant saved successfully!");
      setSavedNotification(true);
      setTimeout(() => setSavedNotification(false), 3000);

      // Refresh gallery after saving
      fetchMyPlants();

    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Failed to save plant");
    } finally {
      setSaving(false);
    }
  }

  async function fetchMyPlants() {
    setLoadingPlants(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadingPlants(false);
        return;
      }

      const res = await fetch("http://localhost:5000/api/farmer/my-plants", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.error("Failed to fetch plants");
        setLoadingPlants(false);
        return;
      }

      const data = await res.json();
      if (data.status === 'success' && data.data?.plants) {
        setMyPlants(data.data.plants);
        console.log('📚 Fetched plants:', data.data.plants.length);
      }
    } catch (err) {
      console.error("Error fetching plants:", err);
    } finally {
      setLoadingPlants(false);
    }
  }

  // Fetch plants on mount and when switching to gallery view
  useEffect(() => {
    if (isSignedIn && activeView === 'gallery') {
      fetchMyPlants();
    }
  }, [activeView, isSignedIn]);

  async function handleDeletePlant(plantId: string) {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`http://localhost:5000/api/farmer/plants/${plantId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setMyPlants(myPlants.filter(p => p._id !== plantId));
        setSelectedPlant(null);
        setDeleteConfirmOpen(false);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen p-4">
          <div className="text-2xl font-bold text-emerald-900 mb-8">🌿 AyurMap</div>
          <div className="space-y-2">
            <button
              onClick={() => setActiveView('add-new')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeView === 'add-new'
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                : 'text-emerald-900 hover:bg-emerald-50'
                }`}
            >
              <span className="text-xl">🌱</span>
              <span className="font-medium">Add New Plant</span>
            </button>
            <button
              onClick={() => setActiveView('gallery')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeView === 'gallery'
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                : 'text-emerald-900 hover:bg-emerald-50'
                }`}
            >
              <span className="text-xl">📚</span>
              <span className="font-medium">My Plants</span>
            </button>
          </div>
          <div className="mt-8 pt-8 border-t border-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              {user && (
                <>
                  <img
                    src={((user as any)?.profileImageUrl ?? (user as any)?.imageUrl) as string}
                    alt={user.fullName || "user"}
                    className="h-10 w-10 rounded-full object-cover border-2 border-emerald-300"
                  />
                  <div className="text-sm text-emerald-900 font-medium">{user.fullName}</div>
                </>
              )}
            </div>
            <button
              onClick={() => signOut()}
              className="w-full px-4 py-2 bg-white text-emerald-800 rounded-lg shadow hover:bg-emerald-50 transition text-sm font-medium border border-emerald-200"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-emerald-900">
              {activeView === 'add-new' ? '🌱 Add New Plant' : '📚 My Plants Gallery'}
            </h1>
            <p className="text-emerald-700 mt-1">
              {activeView === 'add-new'
                ? 'Upload an image to identify and add a new plant to your collection'
                : `You have ${myPlants.length} ${myPlants.length === 1 ? 'plant' : 'plants'} in your collection`
              }
            </p>
          </div>

          {activeView === 'add-new' ? (
            <AddNewPlantView
              preview={preview}
              recognizing={recognizing}
              statusMessage={statusMessage}
              plantData={plantData}
              saving={saving}
              savedNotification={savedNotification}
              handleFileUpload={handleFileUpload}
              handleSave={handleSave}
            />
          ) : (
            <MyPlantsGallery
              myPlants={myPlants}
              loadingPlants={loadingPlants}
              setSelectedPlant={setSelectedPlant}
            />
          )}
        </main>
      </div>

      {/* Plant Detail Modal */}
      {selectedPlant && (
        <Dialog open={!!selectedPlant} onOpenChange={() => setSelectedPlant(null)}>
          <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-emerald-900">
                {selectedPlant.naturalName}
              </DialogTitle>
              <p className="text-emerald-700 italic">{selectedPlant.scientificName}</p>
            </DialogHeader>

            <div className="flex gap-4">
              {/* Left side - Image */}
              <div className="flex-shrink-0">
                {selectedPlant.imageBase64 ? (
                  <div className="w-64 h-80 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-300">
                    <AuthenticatedImage
                      plantId={selectedPlant._id.toString()}
                      alt={selectedPlant.naturalName}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : selectedPlant.imageUrl && !selectedPlant.imageUrl.startsWith('GridFS:') ? (
                  <div className="w-64 h-80 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-300">
                    <img src={`http://localhost:5000${selectedPlant.imageUrl}`} alt={selectedPlant.naturalName} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-64 h-80 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 border border-gray-300">No Image</div>
                )}
                {/* Image caption */}
                <p className="text-xs text-gray-500 mt-2 text-center italic">Image of {selectedPlant.naturalName}</p>
              </div>

              {/* Right side - Content */}
              <div className="flex-1 space-y-4">
                {/* Common Names */}
                {selectedPlant.commonNames && selectedPlant.commonNames.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-emerald-800 mb-2">Common Names</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlant.commonNames.map((name: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-sm">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedPlant.ayurvedicDescription && (
                  <div>
                    <h4 className="font-semibold text-emerald-800 mb-2">Description</h4>
                    <p className="text-sm text-emerald-900">{selectedPlant.ayurvedicDescription}</p>
                  </div>
                )}

                {/* Medicinal Benefits */}
                {selectedPlant.medicinalBenefits && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-emerald-800 mb-2">Medicinal Benefits</h4>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{selectedPlant.medicinalBenefits}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Taxonomy */}
                {selectedPlant.taxonomy && Object.keys(selectedPlant.taxonomy).length > 0 && (
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <h4 className="font-semibold text-emerald-800 mb-2">Taxonomy</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedPlant.taxonomy.family && (
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Family:</span>
                          <span className="text-emerald-900 font-medium">{selectedPlant.taxonomy.family}</span>
                        </div>
                      )}
                      {selectedPlant.taxonomy.genus && (
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Genus:</span>
                          <span className="text-emerald-900 font-medium">{selectedPlant.taxonomy.genus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Similar Images */}
                {selectedPlant.similarImages && selectedPlant.similarImages.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-emerald-800 mb-3">Similar Images</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedPlant.similarImages.map((img: any, idx: number) => (
                        <a
                          key={idx}
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-90 transition"
                        >
                          <img
                            src={img.url}
                            alt={`Similar plant ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Links */}
                {(selectedPlant.wikipediaUrl || selectedPlant.gbifId || selectedPlant.inaturalistId) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedPlant.wikipediaUrl && (
                      <a
                        href={selectedPlant.wikipediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium"
                      >
                        📖 Wikipedia
                      </a>
                    )}
                    {selectedPlant.gbifId && (
                      <a
                        href={`https://www.gbif.org/species/${selectedPlant.gbifId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-xs font-medium"
                      >
                        🔬 GBIF
                      </a>
                    )}
                    {selectedPlant.inaturalistId && (
                      <a
                        href={`https://www.inaturalist.org/taxa/${selectedPlant.inaturalistId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-xs font-medium"
                      >
                        🌿 iNaturalist
                      </a>
                    )}
                  </div>
                )}

                {/* Delete Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={() => {
                      setPlantToDelete(selectedPlant._id);
                      setDeleteConfirmOpen(true);
                    }}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                  >
                    🗑️ Delete Plant
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this plant? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (plantToDelete) {
                  handleDeletePlant(plantToDelete);
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddNewPlantView({
  preview,
  recognizing,
  statusMessage,
  plantData,
  saving,
  savedNotification,
  handleFileUpload,
  handleSave
}: any) {
  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-emerald-900 mb-4">Upload Plant Image</h2>

        {/* Dropzone */}
        <div className="border-2 border-dashed border-emerald-300 rounded-xl p-12 text-center hover:border-emerald-400 transition-colors bg-emerald-50/30">
          {preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-64 rounded-lg shadow-md mx-auto"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)}
                className="block mx-auto"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-6xl">🌱</div>
              <div className="text-emerald-700 font-medium">Drop your plant image here or click to browse</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)}
                className="block mx-auto"
              />
            </div>
          )}
        </div>

        {/* Loading State */}
        {recognizing && (
          <div className="mt-4 flex items-center justify-center gap-3 p-4 bg-emerald-50 rounded-lg">
            <div className="h-6 w-6 rounded-full border-4 border-emerald-300 border-t-emerald-600 animate-spin"></div>
            <span className="text-emerald-800 font-medium">Recognizing plant...</span>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && !recognizing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">{statusMessage}</p>
          </div>
        )}
      </div>

      {/* Plant Details Card */}
      {!recognizing && plantData && plantData.name && (
        <div className="bg-white rounded-2xl p-8 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header with Save Button */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-emerald-900 flex items-center gap-3">
              <span>📋</span> Plant Details
            </h3>
            <button
              onClick={handleSave}
              disabled={saving || savedNotification}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${saving || savedNotification
                ? 'bg-emerald-400 text-white cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg'
                }`}
            >
              {saving ? '💾 Saving...' : savedNotification ? '✅ Saved!' : '💾 Save to Database'}
            </button>
          </div>

          {/* Name and Scientific Name */}
          <div className="mb-6 pb-6 border-b border-emerald-200">
            <h2 className="text-3xl font-bold text-emerald-900 mb-2">{plantData.name}</h2>
            <p className="text-base italic text-emerald-700 mb-3">{plantData.scientificName}</p>
            {plantData.confidence && (
              <div>
                <div className="flex items-center justify-between text-sm text-emerald-700 mb-2">
                  <span className="font-semibold">Confidence</span>
                  <span>{Math.round((plantData.confidence || 0) * 100)}%</span>
                </div>
                <div className="w-full bg-emerald-100 rounded-full h-3">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(plantData.confidence || 0) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Common Names */}
          {plantData.commonNames && plantData.commonNames.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-emerald-800 mb-3">Common Names</h4>
              <div className="flex flex-wrap gap-2">
                {plantData.commonNames.map((name, idx) => (
                  <span key={idx} className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-full text-sm border border-emerald-200 font-medium">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Taxonomy */}
          {plantData.taxonomy && Object.keys(plantData.taxonomy).length > 0 && (
            <div className="mb-6 p-5 bg-emerald-50 rounded-lg">
              <h4 className="text-sm font-semibold text-emerald-800 mb-4">Classification</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {plantData.taxonomy.kingdom && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Kingdom:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.kingdom}</span>
                  </div>
                )}
                {plantData.taxonomy.phylum && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Phylum:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.phylum}</span>
                  </div>
                )}
                {plantData.taxonomy.class && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Class:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.class}</span>
                  </div>
                )}
                {plantData.taxonomy.order && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Order:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.order}</span>
                  </div>
                )}
                {plantData.taxonomy.family && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Family:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.family}</span>
                  </div>
                )}
                {plantData.taxonomy.genus && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">Genus:</span>
                    <span className="text-emerald-900">{plantData.taxonomy.genus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {plantData.description && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <span>📄</span> Description
              </h4>
              <p className="text-sm text-emerald-900 leading-relaxed">{plantData.description}</p>
            </div>
          )}

          {/* Medicinal Uses */}
          {plantData.medicinalUses && (
            <div className="mb-6 p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h4 className="text-sm font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                <span className="text-lg">💊</span> Medicinal Uses & Ayurvedic Information
              </h4>
              <div className="prose prose-sm max-w-none prose-headings:text-emerald-900 prose-p:text-emerald-900 prose-li:text-emerald-900 prose-strong:text-emerald-900">
                <ReactMarkdown
                  components={{
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-emerald-900 mt-4 mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-base font-bold text-emerald-900 mt-3 mb-2" {...props} />,
                    p: ({ node, ...props }) => <p className="text-sm text-emerald-900 mb-3 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 text-sm text-emerald-900 mb-3" {...props} />,
                    li: ({ node, ...props }) => <li className="text-emerald-900" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold text-emerald-900" {...props} />,
                  }}
                >
                  {plantData.medicinalUses}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Similar Images */}
          {plantData.similarImages && plantData.similarImages.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                <span>🖼️</span> Similar Images
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {plantData.similarImages.map((img, idx) => (
                  <a
                    key={idx}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-90 transition"
                  >
                    <img
                      src={img.url}
                      alt={`Similar plant ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* External Links */}
          <div className="flex flex-wrap gap-3 pt-6 border-t border-emerald-200">
            {plantData.wikipediaUrl && (
              <a
                href={plantData.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium flex items-center gap-2"
              >
                📖 Wikipedia
              </a>
            )}
            {plantData.gbifId && (
              <a
                href={`https://www.gbif.org/species/${plantData.gbifId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium flex items-center gap-2"
              >
                🔬 GBIF
              </a>
            )}
            {plantData.inaturalistId && (
              <a
                href={`https://www.inaturalist.org/taxa/${plantData.inaturalistId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium flex items-center gap-2"
              >
                🌿 iNaturalist
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MyPlantsGallery({ myPlants, loadingPlants, setSelectedPlant }: any) {
  if (loadingPlants) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-lg animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (myPlants.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
        <div className="text-6xl mb-4">🌿</div>
        <h3 className="text-xl font-semibold text-emerald-900 mb-2">No Plants Yet</h3>
        <p className="text-emerald-700">Start by adding your first plant using the "Add New Plant" button!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {myPlants.map((plant: any) => (
        <div
          key={plant._id}
          onClick={() => setSelectedPlant(plant)}
          className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition cursor-pointer"
        >
          <div className="aspect-square bg-gray-200 rounded-lg mb-4 overflow-hidden flex items-center justify-center">
            {plant.imageBase64 ? (
              <AuthenticatedImage
                plantId={plant._id.toString()}
                alt={plant.naturalName}
                className="w-full h-full object-cover"
              />
            ) : plant.imageUrl && !plant.imageUrl.startsWith('GridFS:') ? (
              <img
                src={`http://localhost:5000${plant.imageUrl}`}
                alt={plant.naturalName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5OYSBJbWFnZTwvdGV4dD48L3N2Zz4=';
                }}
              />
            ) : (
              <img
                src="/placeholder.svg"
                alt={plant.naturalName}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <h3 className="font-bold text-emerald-900 mb-1">{plant.naturalName}</h3>
          <p className="text-sm text-emerald-700 italic mb-2">{plant.scientificName}</p>
          <p className="text-xs text-gray-500">{new Date(plant.createdAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
