import { useState, useEffect, useRef } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import L from "leaflet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlants, useRecognizePlant, useSavePlant, useDeletePlant, useProcessedPlantsForMap } from "@/hooks/usePlants";

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

  // React Query hooks
  const { data: plantsData, isLoading: loadingPlants } = usePlants();
  const recognizeMutation = useRecognizePlant();
  const saveMutation = useSavePlant();
  const deleteMutation = useDeletePlant();

  // Extract plants from the query response
  const myPlants = plantsData?.data?.plants || [];

  useEffect(() => {
    if (!isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [isSignedIn, navigate]);

  const [activeView, setActiveView] = useState<'add-new' | 'gallery' | 'map'>('add-new');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [plantData, setPlantData] = useState<PlantData | null>(null);
  const [savedNotification, setSavedNotification] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);

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
    recognizePlant(f);
  }

  async function recognizePlant(f: File) {
    setRecognizing(true);
    setStatusMessage("🔍 Recognizing plant...");

    try {
      const data = await recognizeMutation.mutateAsync(f);

      if (data.status === 'success') {
        setPlantData(data.data);
        setStatusMessage("✅ Plant recognized successfully!");
      } else {
        setStatusMessage("🌱 Could not identify this plant. Please try another image.");
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message || "❌ Plant recognition failed");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleSave(formData?: any) {
    if (!plantData) return;

    setStatusMessage("💾 Saving to database...");

    try {
      const saveData = {
        ...plantData,
        ...formData
      };

      await saveMutation.mutateAsync(saveData);

      setStatusMessage("✅ Plant saved successfully!");
      setSavedNotification(true);
      setShowSaveForm(false);
      setTimeout(() => setSavedNotification(false), 3000);

    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ Failed to save plant: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleDeletePlant(plantId: string) {
    try {
      await deleteMutation.mutateAsync(plantId);
      setSelectedPlant(null);
      setDeleteConfirmOpen(false);
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
            <button
              onClick={() => setActiveView('map')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeView === 'map'
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600'
                : 'text-emerald-900 hover:bg-emerald-50'
                }`}
            >
              <span className="text-xl">🗺️</span>
              <span className="font-medium">Map View</span>
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
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-emerald-900">
              {activeView === 'add-new' ? '🌱 Add New Plant' : activeView === 'map' ? '🗺️ Map View' : '📚 My Plants Gallery'}
            </h1>
            <p className="text-emerald-700 mt-1">
              {activeView === 'add-new'
                ? 'Upload an image to identify and add a new plant to your collection'
                : activeView === 'map'
                  ? 'View your plants on an interactive map'
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
              isSaving={saveMutation.isPending}
              savedNotification={savedNotification}
              handleFileUpload={handleFileUpload}
              handleSave={handleSave}
              setShowSaveForm={setShowSaveForm}
            />
          ) : activeView === 'map' ? (
            <PlantMapView
              key="map-view"
              myPlants={myPlants}
              loadingPlants={loadingPlants}
              setSelectedPlant={setSelectedPlant}
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
                <p className="text-xs text-gray-500 mt-2 text-center italic">Image of {selectedPlant.naturalName}</p>
              </div>

              <div className="flex-1 space-y-4">
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

                {selectedPlant.ayurvedicDescription && (
                  <div>
                    <h4 className="font-semibold text-emerald-800 mb-2">Description</h4>
                    <p className="text-sm text-emerald-900">{selectedPlant.ayurvedicDescription}</p>
                  </div>
                )}

                {selectedPlant.medicinalBenefits && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-emerald-800 mb-2">Medicinal Benefits</h4>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{selectedPlant.medicinalBenefits}</ReactMarkdown>
                    </div>
                  </div>
                )}

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

      <SavePlantFormDialog
        open={showSaveForm}
        onOpenChange={setShowSaveForm}
        user={user}
        saving={saveMutation.isPending}
        onSave={handleSave}
      />
    </div>
  );
}

function AddNewPlantView({
  preview,
  recognizing,
  statusMessage,
  plantData,
  isSaving,
  savedNotification,
  handleFileUpload,
  handleSave,
  setShowSaveForm
}: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-emerald-900 mb-4">Upload Plant Image</h2>

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

        {recognizing && (
          <div className="mt-4 flex items-center justify-center gap-3 p-4 bg-emerald-50 rounded-lg">
            <div className="h-6 w-6 rounded-full border-4 border-emerald-300 border-t-emerald-600 animate-spin"></div>
            <span className="text-emerald-800 font-medium">Recognizing plant...</span>
          </div>
        )}

        {statusMessage && !recognizing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">{statusMessage}</p>
          </div>
        )}
      </div>

      {!recognizing && plantData && plantData.name && (
        <div className="bg-white rounded-2xl p-8 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-emerald-900 flex items-center gap-3">
              <span>📋</span> Plant Details
            </h3>
            <button
              onClick={() => setShowSaveForm(true)}
              disabled={isSaving || savedNotification}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${isSaving || savedNotification
                ? 'bg-emerald-400 text-white cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg'
                }`}
            >
              {isSaving ? '💾 Saving...' : savedNotification ? '✅ Saved!' : '💾 Save to Database'}
            </button>
          </div>

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

          {plantData.description && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <span>📄</span> Description
              </h4>
              <p className="text-sm text-emerald-900 leading-relaxed">{plantData.description}</p>
            </div>
          )}

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
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
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

function SavePlantFormDialog({
  open,
  onOpenChange,
  user,
  saving,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  saving: boolean;
  onSave: (formData: any) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    location: {
      latitude: null as number | null,
      longitude: null as number | null,
      country: '',
      state: '',
      city: ''
    }
  });

  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        phoneNumber: '',
        location: {
          latitude: null,
          longitude: null,
          country: '',
          state: '',
          city: ''
        }
      });

      requestGPSLocation();
    }
  }, [open, user]);

  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      setLocationGranted(false);
      return;
    }

    setRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationGranted(true);
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
        }));
        setRequestingLocation(false);
      },
      (error) => {
        setLocationGranted(false);
        setRequestingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
    }

    if (locationGranted === true) {
      if (!formData.location.latitude || !formData.location.longitude) {
        errors.location = 'Location not captured yet';
      }
    } else if (locationGranted === false) {
      if (!formData.location.country.trim()) {
        errors.country = 'Country is required';
      }
      if (!formData.location.state.trim()) {
        errors.state = 'State is required';
      }
      if (!formData.location.city.trim()) {
        errors.city = 'City is required';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const submitData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      location: locationGranted === true
        ? {
          latitude: formData.location.latitude,
          longitude: formData.location.longitude
        }
        : {
          latitude: 0,
          longitude: 0,
          country: formData.location.country,
          state: formData.location.state,
          city: formData.location.city
        }
    };

    onSave(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-900">
            Save Plant to Database
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-emerald-800">Personal Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-emerald-900">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={formErrors.firstName ? 'border-red-500' : ''}
                  disabled={saving}
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.firstName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName" className="text-emerald-900">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-emerald-900">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={formErrors.email ? 'border-red-500' : ''}
                disabled={saving}
              />
              {formErrors.email && (
                <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phoneNumber" className="text-emerald-900">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="+1234567890"
                className={formErrors.phoneNumber ? 'border-red-500' : ''}
                disabled={saving}
              />
              {formErrors.phoneNumber && (
                <p className="text-xs text-red-600 mt-1">{formErrors.phoneNumber}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-emerald-800">Location Information</h4>

            {requestingLocation && locationGranted === null && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-800">📍 Requesting GPS location...</p>
              </div>
            )}

            {locationGranted === true && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">✅ Location captured via GPS</p>
                <p className="text-xs text-green-700 mt-1">
                  Coordinates: {formData.location.latitude?.toFixed(4)}, {formData.location.longitude?.toFixed(4)}
                </p>
              </div>
            )}

            {locationGranted === false && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">📍 GPS access denied. Please enter location manually.</p>
                </div>

                <div>
                  <Label htmlFor="country" className="text-emerald-900">Country *</Label>
                  <Input
                    id="country"
                    value={formData.location.country}
                    onChange={(e) => handleInputChange('location.country', e.target.value)}
                    className={formErrors.country ? 'border-red-500' : ''}
                    disabled={saving}
                  />
                  {formErrors.country && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.country}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state" className="text-emerald-900">State/Province *</Label>
                  <Input
                    id="state"
                    value={formData.location.state}
                    onChange={(e) => handleInputChange('location.state', e.target.value)}
                    className={formErrors.state ? 'border-red-500' : ''}
                    disabled={saving}
                  />
                  {formErrors.state && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.state}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city" className="text-emerald-900">City *</Label>
                  <Input
                    id="city"
                    value={formData.location.city}
                    onChange={(e) => handleInputChange('location.city', e.target.value)}
                    className={formErrors.city ? 'border-red-500' : ''}
                    disabled={saving}
                  />
                  {formErrors.city && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.city}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || requestingLocation}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '💾 Saving...' : '💾 Save Plant'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlantMapView({ myPlants, loadingPlants, setSelectedPlant }: any) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Use React Query to cache processed plants for map
  const { data: processedPlants = [], isLoading: geocodingPlants } = useProcessedPlantsForMap(myPlants);

  // Initialize map when component mounts and container is ready
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initMap = () => {
      if (!mapContainerRef.current) return;

      // Wait for container to have dimensions
      const checkDimensions = () => {
        const rect = mapContainerRef.current!.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          setTimeout(checkDimensions, 50);
          return;
        }

        // Create map
        const map = L.map(mapContainerRef.current!, {
          center: [20.5937, 78.9629],
          zoom: 5,
          zoomControl: true
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        // Ensure proper sizing
        setTimeout(() => {
          map.invalidateSize();
          setMapReady(true);
        }, 100);

        // Try to get user location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.setView([pos.coords.latitude, pos.coords.longitude], 9);
            },
            () => {
              // Keep default view
            }
          );
        }
      };

      checkDimensions();
    };

    // Small delay to ensure DOM is ready
    setTimeout(initMap, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add markers to map
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    processedPlants.forEach((plant) => {
      const borderColor = plant.locationType === 'gps' ? '#10b981' : '#3b82f6';

      let imageSrc = '/placeholder.svg';
      if (plant.imageBase64) {
        imageSrc = `data:${plant.imageContentType || 'image/jpeg'};base64,${plant.imageBase64}`;
      }

      const icon = L.divIcon({
        html: `<div style="border: 3px solid ${borderColor}; border-radius: 50%; padding: 2px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: #e5e7eb;">
            <img src="${imageSrc}" alt="${plant.naturalName}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        </div>`,
        className: "custom-plant-marker",
        iconSize: [44, 44]
      });

      const marker = L.marker([plant.displayLat, plant.displayLng], { icon }).addTo(map);

      marker.bindPopup(`
        <div style="max-width: 220px; font-family: system-ui;">
          <div style="font-weight: bold; color: #065f46; font-size: 14px; margin-bottom: 4px;">
            ${plant.naturalName || plant.naturalName}
          </div>
          <div style="font-style: italic; color: #047857; font-size: 12px; margin-bottom: 8px;">
            ${plant.scientificName || ''}
          </div>
          <div style="padding: 4px 8px; background: ${plant.locationType === 'gps' ? '#d1fae5' : '#dbeafe'}; border-radius: 4px; font-size: 11px; color: #065f46;">
            ${plant.locationType === 'gps' ? '📍 GPS Location' : '📌 Approximate Location'}
          </div>
          ${plant.location?.city ? `
            <div style="margin-top: 8px; font-size: 11px; color: #6b7280;">
              ${plant.location.city}${plant.location.state ? ', ' + plant.location.state : ''}, ${plant.location.country}
            </div>
          ` : ''}
        </div>
      `);

      marker.on('click', () => {
        setSelectedPlant(plant);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [processedPlants, setSelectedPlant, mapReady]);

  const gpsPlants = processedPlants.filter(p => p.locationType === 'gps').length;
  const geocodedPlants = processedPlants.filter(p => p.locationType === 'geocoded').length;
  const noLocationPlants = myPlants.length - processedPlants.length;

  return (
    <div className="space-y-4">
      {/* Legend and Statistics - Skeleton while loading */}
      <div className="bg-white rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-emerald-900">Map Legend</h3>
          <div className="text-sm text-emerald-700">
            {processedPlants.length > 0
              ? `${processedPlants.length} plant${processedPlants.length !== 1 ? 's' : ''} displayed`
              : 'No plants with location data'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-green-600"></div>
            <span className="text-emerald-800">
              <strong>{gpsPlants}</strong> GPS locations
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-blue-600"></div>
            <span className="text-emerald-800">
              <strong>{geocodedPlants}</strong> Approximate locations
            </span>
          </div>
          {noLocationPlants > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-300"></div>
              <span className="text-emerald-800">
                <strong>{noLocationPlants}</strong> Without location
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden h-[600px] w-full relative">
        <div
          ref={mapContainerRef}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        ></div>

        {!mapReady && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🗺️</div>
              <div className="text-emerald-800 font-medium text-lg">Initializing map...</div>
              <div className="mt-4 w-64 h-2 bg-emerald-200 rounded-full">
                <div className="h-2 bg-emerald-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>
        )}

        {mapReady && processedPlants.length === 0 && !loadingPlants && !geocodingPlants && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 pointer-events-none">
            <div className="text-center">
              <div className="text-6xl mb-4">🗺️</div>
              <h3 className="text-xl font-semibold text-emerald-900 mb-2">No Plants on Map</h3>
              <p className="text-emerald-700">
                {noLocationPlants > 0
                  ? `${noLocationPlants} plant${noLocationPlants !== 1 ? 's' : ''} without location data`
                  : 'Add plants with location data to see them on the map'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}