// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:8080',
  CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Y2xpbWJpbmctbWFybW90LTE4LmNsZXJrLmFjY291bnRzLmRldiQ'
};

// API Endpoints
export const API_ENDPOINTS = {
  // User endpoints
  USER_SEARCH_PLANTS: '/api/user/search-plants',
  USER_PLANTS_NEARBY: '/api/user/plants-nearby',
  USER_PLANT_DETAILS: '/api/user/plants',
  USER_SEARCH_HISTORY: '/api/user/search-history',
  USER_START_CHAT: '/api/user/start-chat',
  USER_MY_CHATS: '/api/user/my-chats',
  USER_PROFILE: '/api/user/profile',
  USER_POPULAR_PLANTS: '/api/user/popular-plants',

  // Farmer endpoints
  FARMER_UPLOAD_PLANT: '/api/farmer/upload-plant',
  FARMER_MY_PLANTS: '/api/farmer/my-plants',
  FARMER_PLANT_DETAILS: '/api/farmer/plants',
  FARMER_PROFILE: '/api/farmer/profile',

  // Chat endpoints
  CHAT_DETAILS: '/api/chat',
  CHAT_MESSAGES: '/api/chat',
  CHAT_FARMER_CHATS: '/api/chat/farmer/my-chats',

  // Admin endpoints
  ADMIN_USERS: '/api/admin/users',
  ADMIN_FARMERS: '/api/admin/farmers',
  ADMIN_PLANTS: '/api/admin/plants',
  ADMIN_CHATS: '/api/admin/chats',

  // Health check
  HEALTH: '/api/health'
};

// Helper function to build full API URL
export const buildApiUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  return url;
};

// Helper function to make authenticated API calls
export const apiCall = async (url: string, options: RequestInit = {}, token?: string): Promise<Response> => {
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    console.log('🔑 Sending token:', token.substring(0, 20) + '...');
  } else {
    console.log('❌ No token provided for API call to:', url);
  }

  console.log('📡 API call:', {
    url,
    method: options.method || 'GET',
    hasToken: !!token,
    headers: Object.keys(headers)
  });

  return fetch(url, {
    ...options,
    headers,
  });
};

// Farmer API functions
export async function fetchMyPlants(token: string) {
  const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.FARMER_MY_PLANTS}`;
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch plants');
  }

  const data = await response.json();
  return data;
}

export async function recognizePlant(file: File, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/farmer/recognize-plant`;
  const formData = new FormData();
  formData.append('plantImage', file);

  const response = await apiCall(url, {
    method: 'POST',
    body: formData,
  }, token);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Plant recognition failed' }));
    throw new Error(error.message || 'Plant recognition failed');
  }

  return response.json();
}

export async function savePlant(data: any, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/farmer/save-plant`;
  const response = await apiCall(url, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save plant');
  }

  return response.json();
}

export async function deletePlant(plantId: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/farmer/plants/${plantId}`;
  const response = await apiCall(url, {
    method: 'DELETE',
  }, token);

  if (!response.ok) {
    throw new Error('Failed to delete plant');
  }

  return response.json();
}

// Admin API functions
export async function fetchDashboardStats(token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/dashboard`;
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.json();
}

export async function fetchUsers(token: string, page = 1, limit = 20, filters: Record<string, string> = {}) {
  const params = { page: String(page), limit: String(limit), ...filters };
  const url = buildApiUrl('/api/admin/users', params);
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

export async function fetchPlants(token: string, page = 1, limit = 20, filters: Record<string, string> = {}) {
  const params = { page: String(page), limit: String(limit), ...filters };
  const url = buildApiUrl('/api/admin/plants', params);
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch plants');
  }

  return response.json();
}

export async function fetchChats(token: string, page = 1, limit = 20, filters: Record<string, string> = {}) {
  const params = { page: String(page), limit: String(limit), ...filters };
  const url = buildApiUrl('/api/admin/chats', params);
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch chats');
  }

  return response.json();
}

export async function getUserActivity(userId: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/users/${userId}/activity`;
  const response = await apiCall(url, {}, token);

  if (!response.ok) {
    throw new Error('Failed to fetch user activity');
  }

  return response.json();
}

export async function blockUser(userId: string, isBlocked: boolean, reason: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/users/${userId}/block`;
  const response = await apiCall(url, {
    method: 'PUT',
    body: JSON.stringify({ isBlocked, blockReason: reason }),
  }, token);

  if (!response.ok) {
    throw new Error('Failed to block user');
  }

  return response.json();
}

export async function suspendUser(userId: string, suspendedUntil: string, reason: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/users/${userId}/suspend`;
  const response = await apiCall(url, {
    method: 'PUT',
    body: JSON.stringify({ suspendedUntil, blockReason: reason }),
  }, token);

  if (!response.ok) {
    throw new Error('Failed to suspend user');
  }

  return response.json();
}

export async function deleteUser(userId: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/users/${userId}`;
  const response = await apiCall(url, {
    method: 'DELETE',
  }, token);

  if (!response.ok) {
    throw new Error('Failed to delete user');
  }

  return response.json();
}

export async function updateUserRole(userId: string, role: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/users/${userId}/role`;
  const response = await apiCall(url, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  }, token);

  if (!response.ok) {
    throw new Error('Failed to update user role');
  }

  return response.json();
}

export async function deletePlantByAdmin(plantId: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/plants/${plantId}`;
  const response = await apiCall(url, {
    method: 'DELETE',
  }, token);

  if (!response.ok) {
    throw new Error('Failed to delete plant');
  }

  return response.json();
}

export async function verifyPlant(plantId: string, isVerified: boolean, notes: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/plants/${plantId}/verify`;
  const response = await apiCall(url, {
    method: 'PUT',
    body: JSON.stringify({ isVerified, notes }),
  }, token);

  if (!response.ok) {
    throw new Error('Failed to verify plant');
  }

  return response.json();
}

export async function deleteChat(chatId: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/chats/${chatId}`;
  const response = await apiCall(url, {
    method: 'DELETE',
  }, token);

  if (!response.ok) {
    throw new Error('Failed to delete chat');
  }

  return response.json();
}

export async function resolveReportedChat(chatId: string, notes: string, token: string) {
  const url = `${API_CONFIG.BASE_URL}/api/admin/chats/${chatId}/resolve-report`;
  const response = await apiCall(url, {
    method: 'PUT',
    body: JSON.stringify({ adminNotes: notes }),
  }, token);

  if (!response.ok) {
    throw new Error('Failed to resolve chat report');
  }

  return response.json();
}
