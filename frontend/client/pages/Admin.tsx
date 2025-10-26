import { useUser, useClerk, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchDashboardStats,
  fetchUsers,
  fetchPlants,
  fetchChats,
  getUserActivity,
  blockUser,
  suspendUser,
  deleteUser,
  deletePlantByAdmin,
  verifyPlant,
  deleteChat,
  resolveReportedChat,
  updateUserRole,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isBlocked: boolean;
  suspendedUntil?: string;
  createdAt: string;
  lastLogin: string;
}

interface Plant {
  _id: string;
  naturalName: string;
  scientificName: string;
  farmerName: string;
  imageUrl?: string;
  isVerified: boolean;
  viewCount: number;
  createdAt: string;
}

interface Chat {
  _id: string;
  plantName: string;
  farmerEmail: string;
  userEmail: string;
  isReported: boolean;
  lastMessageAt: string;
}

export default function Admin() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentPage, setCurrentPage] = useState({ users: 1, plants: 1, chats: 1 });
  const [pagination, setPagination] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userActivity, setUserActivity] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [isLoaded]);

  const loadDashboardData = async () => {
    if (!isLoaded) return;

    try {
      const token = await getToken();
      if (!token) return;

      const statsData = await fetchDashboardStats(token);
      setStats(statsData.data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      setLoading(false);
    }
  };

  const loadUsers = async (page = 1) => {
    try {
      const token = await getToken();
      if (!token) return;

      const filters: any = {};
      if (roleFilter) filters.role = roleFilter;
      if (searchQuery) filters.search = searchQuery;

      const data = await fetchUsers(token, page, 20, filters);
      setUsers(data.data.users);
      setPagination((prev) => ({ ...prev, users: data.data.pagination }));
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    }
  };

  const loadPlants = async (page = 1) => {
    try {
      const token = await getToken();
      if (!token) return;

      const filters: any = {};
      if (searchQuery) filters.search = searchQuery;

      const data = await fetchPlants(token, page, 20, filters);
      setPlants(data.data.plants);
      setPagination({ plants: data.data.pagination });
    } catch (error) {
      console.error("Failed to load plants:", error);
    }
  };

  const loadChats = async (page = 1) => {
    try {
      const token = await getToken();
      if (!token) return;

      const data = await fetchChats(token, page, 20);
      setChats(data.data.chats);
      setPagination({ chats: data.data.pagination });
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      loadUsers(currentPage.users);
    }
  }, [activeTab, currentPage.users, searchQuery, roleFilter]);

  useEffect(() => {
    if (activeTab === "plants") {
      loadPlants(currentPage.plants);
    }
  }, [activeTab, currentPage.plants, searchQuery]);

  useEffect(() => {
    if (activeTab === "chats") {
      loadChats(currentPage.chats);
    }
  }, [activeTab, currentPage.chats]);

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    try {
      const token = await getToken();
      if (!token) return;

      await blockUser(userId, isBlocked, "Admin action", token);
      await loadUsers(currentPage.users);
      toast.success(isBlocked ? "User blocked successfully" : "User unblocked successfully");
    } catch (error) {
      console.error("Failed to block user:", error);
      toast.error("Failed to block user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await deleteUser(userId, token);
      await loadUsers(currentPage.users);
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!confirm("Are you sure you want to delete this plant?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await deletePlantByAdmin(plantId, token);
      await loadPlants(currentPage.plants);
      toast.success("Plant deleted successfully");
    } catch (error) {
      console.error("Failed to delete plant:", error);
      toast.error("Failed to delete plant");
    }
  };

  const handleVerifyPlant = async (plantId: string, isVerified: boolean) => {
    try {
      const token = await getToken();
      if (!token) return;

      await verifyPlant(plantId, isVerified, "", token);
      await loadPlants(currentPage.plants);
      toast.success(isVerified ? "Plant verified successfully" : "Plant unverified successfully");
    } catch (error) {
      console.error("Failed to verify plant:", error);
      toast.error("Failed to verify plant");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await deleteChat(chatId, token);
      await loadChats(currentPage.chats);
      toast.success("Chat deleted successfully");
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  const handleViewUserActivity = async (user: User) => {
    try {
      const token = await getToken();
      if (!token) return;

      const activity = await getUserActivity(user._id, token);
      setUserActivity(activity.data);
      setSelectedUser(user);
      setShowUserModal(true);
    } catch (error) {
      console.error("Failed to load user activity:", error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage users, plants & chats</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
            <Button variant="outline" onClick={() => signOut()}>
              Logout
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Users ({stats?.overview?.totalUsers || 0})
          </button>
          <button
            onClick={() => setActiveTab("plants")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "plants"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Plants ({stats?.overview?.totalPlants || 0})
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "chats"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            Chats ({stats?.overview?.totalChats || 0})
          </button>
        </div>

        {/* Content */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Users</div>
                <div className="text-2xl font-bold">{stats.overview.totalUsers}</div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Farmers</div>
                <div className="text-2xl font-bold">{stats.overview.totalFarmers}</div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Plants</div>
                <div className="text-2xl font-bold">{stats.overview.totalPlants}</div>
              </div>
              <div className="bg-card border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Reported Chats</div>
                <div className="text-2xl font-bold text-destructive">{stats.overview.reportedChats}</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Recent Plant Uploads</h2>
              <div className="space-y-2">
                {stats.recentActivity.plants.slice(0, 5).map((plant: any) => (
                  <div key={plant._id} className="flex justify-between items-center p-2 hover:bg-accent rounded">
                    <div>
                      <div className="font-medium">{plant.naturalName}</div>
                      <div className="text-sm text-muted-foreground">{plant.farmerName || plant.farmerEmail}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(plant.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border rounded-md bg-background"
              >
                <option value="">All Roles</option>
                <option value="consumer">Consumers</option>
                <option value="farmer">Farmers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium">Name</th>
                    <th className="p-3 text-left text-sm font-medium">Email</th>
                    <th className="p-3 text-left text-sm font-medium">Role</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id} className="border-t">
                        <td className="p-3">{u.firstName} {u.lastName}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">{u.role}</td>
                        <td className="p-3">
                          {u.isBlocked ? (
                            <span className="text-destructive">Blocked</span>
                          ) : (
                            <span className="text-green-600">Active</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUserActivity(u)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant={u.isBlocked ? "default" : "destructive"}
                              onClick={() => handleBlockUser(u._id, !u.isBlocked)}
                            >
                              {u.isBlocked ? "Unblock" : "Block"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteUser(u._id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination?.users && (
                <div className="flex justify-between items-center p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.users.currentPage} of {pagination.users.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.users.hasPrev}
                      onClick={() => setCurrentPage({ ...currentPage, users: currentPage.users - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.users.hasNext}
                      onClick={() => setCurrentPage({ ...currentPage, users: currentPage.users + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "plants" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Input
                placeholder="Search plants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium">Plant Name</th>
                    <th className="p-3 text-left text-sm font-medium">Farmer</th>
                    <th className="p-3 text-left text-sm font-medium">Views</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plants.map((p) => (
                    <tr key={p._id} className="border-t">
                      <td className="p-3">{p.naturalName}</td>
                      <td className="p-3">{p.farmerName}</td>
                      <td className="p-3">{p.viewCount}</td>
                      <td className="p-3">
                        {p.isVerified ? (
                          <span className="text-green-600">Verified</span>
                        ) : (
                          <span className="text-yellow-600">Unverified</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={p.isVerified ? "outline" : "default"}
                            onClick={() => handleVerifyPlant(p._id, !p.isVerified)}
                          >
                            {p.isVerified ? "Unverify" : "Verify"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePlant(p._id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination?.plants && (
                <div className="flex justify-between items-center p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.plants.currentPage} of {pagination.plants.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.plants.hasPrev}
                      onClick={() => setCurrentPage({ ...currentPage, plants: currentPage.plants - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.plants.hasNext}
                      onClick={() => setCurrentPage({ ...currentPage, plants: currentPage.plants + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "chats" && (
          <div className="space-y-4">
            <div className="bg-card border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left text-sm font-medium">Plant</th>
                    <th className="p-3 text-left text-sm font-medium">Participants</th>
                    <th className="p-3 text-left text-sm font-medium">Last Message</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.map((c) => (
                    <tr key={c._id} className="border-t">
                      <td className="p-3">{c.plantName}</td>
                      <td className="p-3">
                        <div className="text-sm">
                          <div>{c.farmerEmail}</div>
                          <div className="text-muted-foreground">{c.userEmail}</div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(c.lastMessageAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        {c.isReported ? (
                          <span className="text-destructive">Reported</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteChat(c._id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination?.chats && (
                <div className="flex justify-between items-center p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.chats.currentPage} of {pagination.chats.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.chats.hasPrev}
                      onClick={() => setCurrentPage({ ...currentPage, chats: currentPage.chats - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.chats.hasNext}
                      onClick={() => setCurrentPage({ ...currentPage, chats: currentPage.chats + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Activity Modal */}
        <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Activity - {selectedUser?.email}</DialogTitle>
            </DialogHeader>
            {userActivity && (
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Plants Uploaded</div>
                    <div className="text-2xl font-bold">{userActivity.stats.totalPlants}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Chats</div>
                    <div className="text-2xl font-bold">{userActivity.stats.totalChats}</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-sm text-muted-foreground">Searches</div>
                    <div className="text-2xl font-bold">{userActivity.stats.totalSearches}</div>
                  </div>
                </div>

                {userActivity.plants && userActivity.plants.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">Plants Uploaded ({userActivity.plants.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userActivity.plants.map((plant: any) => (
                        <div key={plant._id} className="p-2 border rounded">
                          <div className="font-medium">{plant.naturalName}</div>
                          <div className="text-sm text-muted-foreground">{plant.scientificName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userActivity.chats && userActivity.chats.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">Chats ({userActivity.chats.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userActivity.chats.map((chat: any) => (
                        <div key={chat._id} className="p-2 border rounded">
                          <div className="font-medium">{chat.plantName || chat.plantId?.naturalName}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(chat.lastMessageAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
