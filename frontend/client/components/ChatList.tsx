import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
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
            // Admin view - show both
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
                <div className="text-gray-500">Loading chats...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
                <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        {searchQuery ? 'No chats found' : 'No chats yet'}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredChats.map((chat) => {
                            const other = getOtherParticipant(chat);
                            const unreadCount = getUnreadCount(chat);
                            const isSelected = chat._id === selectedChatId;
                            const isReported = chat.isReported;

                            return (
                                <div
                                    key={chat._id}
                                    onClick={() => onSelectChat(chat)}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${isSelected ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''
                                        } ${isReported ? 'bg-red-50' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            {other?.firstName ? (
                                                <span className="text-emerald-700 font-semibold">
                                                    {other.firstName[0]}{other.lastName[0]}
                                                </span>
                                            ) : (
                                                <span className="text-emerald-700">👤</span>
                                            )}
                                        </div>

                                        {/* Chat Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900 truncate">
                                                        {other?.firstName} {other?.lastName}
                                                    </span>
                                                    {isReported && (
                                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                                            Reported
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-500 flex-shrink-0">
                                                    {formatTime(chat.lastMessageAt)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-gray-600 truncate">
                                                    {getLastMessage(chat)}
                                                </p>
                                                {unreadCount > 0 && (
                                                    <span className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </div>

                                            {role === 'admin' && chat.plantId && (
                                                <p className="text-xs text-gray-500 mt-1 truncate">
                                                    Plant: {chat.plantName}
                                                </p>
                                            )}
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

