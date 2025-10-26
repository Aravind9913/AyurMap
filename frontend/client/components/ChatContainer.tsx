import { useState } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

interface ChatContainerProps {
    role: 'farmer' | 'consumer' | 'admin';
    showReportedOnly?: boolean;
}

interface Chat {
    _id: string;
    plantId: any;
    farmerId?: any;
    userId?: any;
    plantName: string;
    messages: any[];
    lastMessageAt: Date | string;
    unreadCount: {
        farmer: number;
        user: number;
    };
    isReported?: boolean;
}

export default function ChatContainer({ role, showReportedOnly = false }: ChatContainerProps) {
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [showMobileChat, setShowMobileChat] = useState(false);

    return (
        <div className="flex h-full rounded-lg border border-gray-200 bg-white overflow-hidden">
            {/* Chat List - Visible on desktop or when no chat selected on mobile */}
            <div
                className={`${showMobileChat ? 'hidden lg:flex' : 'flex'
                    } w-full lg:w-80 flex-shrink-0 border-r border-gray-200`}
            >
                <ChatList
                    onSelectChat={(chat) => {
                        setSelectedChat(chat);
                        setShowMobileChat(true);
                    }}
                    selectedChatId={selectedChat?._id}
                    role={role}
                    showReportedOnly={showReportedOnly}
                />
            </div>

            {/* Chat Window - Visible on desktop or when chat selected on mobile */}
            <div
                className={`${showMobileChat ? 'flex' : 'hidden'
                    } lg:flex flex-1 relative`}
            >
                {selectedChat && (
                    <>
                        <ChatWindow
                            chat={selectedChat}
                            role={role}
                            onBack={() => setShowMobileChat(false)}
                        />
                        {showMobileChat && (
                            <button
                                onClick={() => setShowMobileChat(false)}
                                className="absolute top-4 left-4 lg:hidden z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
                            >
                                ←
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

