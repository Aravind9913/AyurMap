import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { API_CONFIG, API_ENDPOINTS } from '@/lib/api';
import { apiCall } from '@/lib/api';

interface Message {
    senderId: string;
    senderEmail: string;
    senderName: string;
    message: string;
    timestamp: Date | string;
}

interface Chat {
    _id: string;
    plantId: {
        _id: string;
        naturalName: string;
        scientificName: string;
        imageUrl?: string;
    };
    farmerId?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    userId?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    plantName: string;
    messages: Message[];
    lastMessageAt: Date | string;
    unreadCount: {
        farmer: number;
        user: number;
    };
    isReported?: boolean;
}

interface ChatListProps {
    onSelectChat: (chat: Chat) => void;
    selectedChatId?: string;
    role: 'farmer' | 'consumer' | 'admin';
    showReportedOnly?: boolean;
}

export default function ChatList({ onSelectChat, selectedChatId, role, showReportedOnly = false }: ChatListProps) {
    const { getToken } = useAuth();
    const { user } = useUser();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadChats();
    }, [role, showReportedOnly]);

    const loadChats = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: 'ayurmap_backend' });

            let url: string;
            if (role === 'admin') {
                url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_ADMIN_CHATS}?reported=${showReportedOnly}`;
            } else if (role === 'farmer') {
                url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_FARMER_CHATS}`;
            } else {
                url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_USER_CHATS}`;
            }

            const response = await apiCall(url, { method: 'GET' }, token);

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    const chatsArray = Array.isArray(data.data) ? data.data : data.data.chats || [];
                    setChats(chatsArray);
                }
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLastMessage = (chat: Chat) => {
        if (!chat.messages || chat.messages.length === 0) {
            return 'No messages yet';
        }
        const lastMsg = chat.messages[chat.messages.length - 1];
        return lastMsg.message;
    };

    const getOtherParticipant = (chat: Chat) => {
        if (role === 'farmer') {
            return chat.userId;
        } else if (role === 'consumer') {
            return chat.farmerId;
        } else {
            return chat.farmerId || chat.userId;
        }
    };

    const getUnreadCount = (chat: Chat) => {
        if (role === 'farmer') {
            return chat.unreadCount.farmer || 0;
        } else if (role === 'consumer') {
            return chat.unreadCount.user || 0;
        }
        return 0;
    };

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        const now = new Date();
        const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const filteredChats = chats.filter((chat) => {
        if (!searchQuery) return true;
        const other = getOtherParticipant(chat);
        const searchLower = searchQuery.toLowerCase();
        return (
            chat.plantName.toLowerCase().includes(searchLower) ||
            other?.email.toLowerCase().includes(searchLower) ||
            `${other?.firstName} ${other?.lastName}`.toLowerCase().includes(searchLower)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 text-sm">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white w-full">
            {/* Simple Search Bar */}
            <div className="p-3 border-b border-gray-100">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                />
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6">
                        <p className="text-gray-400 text-sm">{searchQuery ? 'No chats found' : 'No conversations yet'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredChats.map((chat) => {
                            const other = getOtherParticipant(chat);
                            const unreadCount = getUnreadCount(chat);
                            const isSelected = chat._id === selectedChatId;
                            const isReported = chat.isReported;

                            return (
                                <div
                                    key={chat._id}
                                    onClick={() => onSelectChat(chat)}
                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                                        } ${isReported ? 'bg-red-50' : ''}`}
                                >
                                    <div className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                                                    <img
                                                        src={(other as any)?.profileImage || `https://ui-avatars.com/api/?name=${other?.firstName}+${other?.lastName}&background=10b981&color=fff`}
                                                        alt={`${other?.firstName} ${other?.lastName}`}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${other?.firstName}+${other?.lastName}&background=10b981&color=fff`;
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Chat Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-gray-900 truncate text-sm">
                                                        {other?.firstName} {other?.lastName}
                                                    </span>
                                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                                        {formatTime(chat.lastMessageAt)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm text-gray-500 truncate">
                                                        {getLastMessage(chat)}
                                                    </p>
                                                    {unreadCount > 0 && (
                                                        <span className="bg-emerald-500 text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                                                            {unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
