import React, { useState, useEffect } from 'react';
import { MessageCircle, MessageSquare, Search, MoreHorizontal, Send, Smile, Plus, Check, X, UserPlus, Trash2, ChevronLeft, ChevronRight, Pin, PinOff, Users } from 'lucide-react';
import TaskModal from '../components/TaskModal';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Types (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTasksModule, Task } from '@/modules/tasks';
import { Friend } from '@/modules/friends';


// ═══════════════════════════════════════════════════════════════════
// Messaging hooks (MIGRÉ Supabase)
// ═══════════════════════════════════════════════════════════════════
import { useSendChatMessage, useConversationMessages, useMessagingRealtime } from '@/modules/messaging/messaging.hooks';

// ═══════════════════════════════════════════════════════════════════
// TaskContext - uniquement pour domaines NON MIGRÉS
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTaskContext } from '../context/TaskContext';

// ═══════════════════════════════════════════════════════════════════
// BillingContext — vérification premium côté serveur
// ═══════════════════════════════════════════════════════════════════
import { useBilling } from '@/modules/billing/billing.context';

// Types pour MessagingPage
interface FriendRequest {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface GroupMember {
  id: string;
  name: string;
  avatar: string;
}

interface GroupConversation {
  id: string;
  name: string;
  avatar?: string;
  isGroup: true;
  ownerId: string;
  members: GroupMember[];
  unread: number;
  lastMessage?: string;
  timestamp?: string;
  time?: string;
}

interface IndividualConversation {
  id: string;
  name: string;
  avatar?: string;
  type: 'individual';
  lastMessage: string;
  time: string;
  timestamp: number;
  unread: number;
}

type Conversation = GroupConversation | IndividualConversation;

// Type guard pour vérifier si c'est un groupe
function isGroupConversation(conv: Conversation | GroupConversation | undefined): conv is GroupConversation {
  return conv !== undefined && 'isGroup' in conv && conv.isGroup === true;
}

const RenderAvatar = ({ avatar, className = "w-10 h-10", textClassName = "text-lg" }: { avatar: string | undefined, className?: string, textClassName?: string }) => {
  const isUrl = avatar && (avatar.startsWith('http') || avatar.startsWith('data:image') || avatar.startsWith('/'));
  
  return (
    <div className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 transition-colors ${className}`}>
      {isUrl ? (
        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className={textClassName}>{avatar || '👤'}</span>
      )}
    </div>
  );
};

const MessagingPage: React.FC = () => {
 // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [] } = useTasksModule();

  // ═══════════════════════════════════════════════════════════════════
  // Domaines NON MIGRÉS (depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const {
    user,
    messages,
    sendFriendRequest,
    friends
  } = useTaskContext();

  // ═══════════════════════════════════════════════════════════════════
  // Premium — vérification côté serveur via BillingContext
  // ═══════════════════════════════════════════════════════════════════
  const { isPremium } = useBilling();

  // State — déclaré avant les hooks qui en dépendent
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFriend, setSearchFriend] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'friends'>('messages');
  const [showAddFriendForm, setShowAddFriendForm] = useState(false);
  const [addFriendEmail, setAddFriendEmail] = useState('');
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // ═══════════════════════════════════════════════════════════════════
  // Messaging — hooks Supabase (persistance + realtime)
  // ═══════════════════════════════════════════════════════════════════
  const sendMessageMutation = useSendChatMessage();
  const { data: conversationMessages = [] } = useConversationMessages(selectedConversation);
  useMessagingRealtime(selectedConversation);

  // Friend requests stub (à migrer dans un prochain sprint)
  const friendRequests: FriendRequest[] = [];
  const sendMessage = (conversationId: string, message: string) => {
    sendMessageMutation.mutate({ receiverId: conversationId, content: message });
  };
  const acceptFriendRequest = (_id: string) => { /* TODO: migrer vers useAcceptFriendRequest */ };
  const rejectFriendRequest = (_id: string) => { /* TODO: migrer vers useRejectFriendRequest */ };
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [pinnedConversations, setPinnedConversations] = useState<string[]>(['equipe-design']);
  const [deletedConversations, setDeletedConversations] = useState<string[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);

  const clearGroupChanges = (groupId: string) => {
    setGroupConversations(prev => prev.map(g => {
      if (g.id === groupId) {
        let members = g.members;
        if (groupId === 'equipe-design') {
          members = [
            { id: 'user1', name: 'Utilisateur Demo', avatar: '👤' },
            { id: 'marie-dupont', name: 'Marie Dupont', avatar: '👩‍💼' },
            { id: 'thomas-laurent', name: 'Thomas Laurent', avatar: '👨‍💻' }
          ];
        } else if (groupId === 'dev-produit') {
          members = [
            { id: 'marie-dupont', name: 'Marie Dupont', avatar: '👩‍💼' },
            { id: 'thomas-laurent', name: 'Thomas Laurent', avatar: '👨‍💻' },
            { id: 'sophia-martin', name: 'Sophia Martin', avatar: '👩‍🔬' }
          ];
        }
        return { ...g, unread: 0, members };
      }
      return g;
    }));
    setPinnedConversations(prev => prev.filter(id => id !== groupId));
  };

  // État pour les conversations de groupe
  const [groupConversations, setGroupConversations] = useState([
    {
      id: 'equipe-design',
      name: 'Équipe Design',
      type: 'group' as const,
      ownerId: 'user1',
      members: [
        { id: 'user1', name: 'Utilisateur Demo', avatar: '👤' },
        { id: 'marie-dupont', name: 'Marie Dupont', avatar: '👩‍💼' },
        { id: 'thomas-laurent', name: 'Thomas Laurent', avatar: '👨‍💻' }
      ],
      lastMessage: 'Bonjour à tous ! J\'ai terminé la première version de la maquette pour le dashboard',
      time: '14:34',
      unread: 0
    },
    {
      id: 'dev-produit',
      name: 'Développement Produit',
      type: 'group' as const,
      ownerId: 'marie-dupont',
      members: [
        { id: 'marie-dupont', name: 'Marie Dupont', avatar: '👩‍💼' },
        { id: 'thomas-laurent', name: 'Thomas Laurent', avatar: '👨‍💻' },
        { id: 'sophia-martin', name: 'Sophia Martin', avatar: '👩‍🔬' }
      ],
      lastMessage: 'Marie : Réunion à 15h demain',
      time: '14:34',
      unread: 0
    }]
  );

    const allConversations = [
      ...friends.map(f => {
        const convoMessages = messages.filter(m => m.senderId === f.id || m.receiverId === f.id)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const lastM = convoMessages[0];
        return {
          id: f.id,
          name: f.name,
          avatar: f.avatar,
          type: 'individual' as const,
          lastMessage: lastM?.content || 'Commencer la discussion',
          time: lastM ? new Date(lastM.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          timestamp: lastM ? new Date(lastM.timestamp).getTime() : 0,
          unread: messages.filter(m => m.senderId === f.id && !m.read).length
        };
      }),
      ...groupConversations.map(group => {
        const groupMsgs = messages.filter(m => m.receiverId === group.id)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const lastM = groupMsgs[0];
        const updatedMembers = group.members.map(member => 
          member.id === user.id ? { ...member, avatar: user.avatar || '👤', name: user.name } : member
        );
        return {
          ...group,
          members: updatedMembers,
          lastMessage: lastM ? lastM.content : group.lastMessage,
          time: lastM ? new Date(lastM.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : group.time,
          timestamp: lastM ? new Date(lastM.timestamp).getTime() : 0,
        };
      })
    ];

    const sortedConversations = [...allConversations].sort((a, b) => {
      const aPinned = pinnedConversations.includes(a.id);
      const bPinned = pinnedConversations.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.timestamp - a.timestamp;
    });

    useEffect(() => {
      if (window.innerWidth < 1024 && !selectedConversation && sortedConversations.length > 0) {
        setSelectedConversation(sortedConversations[0].id);
        setShowLeftSidebar(false);
      }
    }, [sortedConversations.length, selectedConversation]);

  const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘'],
    gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
    hearts2: ['🎉', '🎊', '🎈', '🎂', '🎁', '🧨', '🧧', '🎇', '🎆', '🎐', '🎑', '🎍', '🎋', '🎏', '💎', '💍']
  };

  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<keyof typeof emojiCategories>('smileys');
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const emojiCategoryLabels = {
    smileys: '😀', gestures: '👍', hearts: '❤️', hearts2: '🎉'
  };

  const pendingRequests = friendRequests.filter(r => r.status === 'pending');

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessage(selectedConversation, newMessage);
    setNewMessage('');
    setShowEmojiPicker(false);
  };

  const handleCreateGroup = () => {
    setShowCreateGroupModal(true);
  };

  const handleCreateGroupSubmit = () => {
    if (!groupName.trim() || selectedFriendsForGroup.length === 0) return;
    
    const newGroup = {
      id: `group-${Date.now()}`,
      name: groupName,
      type: 'group' as const,
      ownerId: user.id,
      members: [
        { id: user.id, name: user.name, avatar: user.avatar || '👤' },
        ...selectedFriendsForGroup.map(id => {
          const friend = friends.find(f => f.id === id);
          return { id: friend?.id || id, name: friend?.name || 'Ami', avatar: friend?.avatar || '👤' };
        })
      ],
      lastMessage: 'Groupe créé',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: 0
    };

    setGroupConversations(prev => [newGroup, ...prev]);
    setShowCreateGroupModal(false);
    setGroupName('');
    setSelectedFriendsForGroup([]);
    setSelectedConversation(newGroup.id);
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendsForGroup(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleTogglePinFromList = (id: string) => {
    setPinnedConversations(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleTogglePin = () => {
    if (!selectedConversation) return;
    handleTogglePinFromList(selectedConversation);
    setShowMoreOptions(false);
  };

  const handleDeleteConversation = () => {
    if (!selectedConversation) return;
    setDeletedConversations(prev => [...prev, selectedConversation]);
    setSelectedConversation('');
    setShowMoreOptions(false);
  };

  const handleAcceptRequest = (id: string) => {
    acceptFriendRequest(id);
  };

  const handleRejectRequest = (id: string) => {
    rejectFriendRequest(id);
  };

  const handleSendFriendRequest = () => {
    if (!addFriendEmail.trim()) return;
    const email = addFriendEmail.trim().toLowerCase();
    const foundFriend = friends.find(f => f.email.toLowerCase() === email);
    if (foundFriend) {
      alert('Cet utilisateur est déjà votre ami');
    } else {
      sendFriendRequest(email);
    }
    setAddFriendEmail('');
    setShowAddFriendForm(false);
  };

  const currentConversation = allConversations.find(c => c.id === selectedConversation);
  const totalUnreadCount = sortedConversations.reduce((acc, conv) => acc + (conv.unread || 0), 0);

  const currentConversationMessages = messages
    .filter(m => m.senderId === selectedConversation || m.receiverId === selectedConversation)
    .map(m => ({
      id: m.id,
      sender: m.senderId === user.id ? user.name : (friends.find(f => f.id === m.senderId)?.name || 'Inconnu'),
      content: m.content,
      time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: m.senderId === user.id,
      avatar: m.senderId === user.id ? user.avatar : friends.find(f => f.id === m.senderId)?.avatar,
      taskId: m.taskId
    }));

  const switchToFriendsTab = () => setActiveTab('friends');
  const switchToMessagesTab = () => setActiveTab('messages');

  if (!user) return null;
  if (!isPremium()) {
    return (
      <div className="p-8">
        <div className="card p-16 text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageCircle size={32} className="text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Messagerie Premium</h1>
          <p className="text-xl text-slate-600 mb-8">
            Débloquez Premium pour accéder à la messagerie et aux fonctionnalités collaboratives
          </p>
          <button className="btn-primary text-lg px-8 py-4">
            Débloquer Premium
          </button>
        </div>
      </div>);
  }

  return (

    <div className="h-full w-full flex relative bg-gray-50 dark:bg-slate-900 transition-colors overflow-hidden">
        <div className={`${mobileShowChat ? 'hidden lg:flex' : 'flex'} lg:w-80 w-full bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex-col transition-all duration-300 overflow-x-hidden`}>
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Messagerie</h1>
                <button
                  onClick={() => setShowRightSidebar(true)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors relative"
                  title="Gérer les amis"
                >
                  <Users size={18} />
                  {pendingRequests.length > 0 && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>
                  )}
                </button>
              </div>
            </div>
            
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 dark:text-white transition-colors" />
            </div>
          </div>

          <div className="flex border-b border-gray-200 dark:border-slate-700 transition-colors">
            <button
              onClick={switchToMessagesTab}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'messages' ?
              'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' :
              'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
              }>
              Messages
            </button>
            <button
              onClick={switchToFriendsTab}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'friends' ?
              'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' :
              'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
              }>
              Amis
            </button>
          </div>

          <div className={`p-4 border-b border-gray-200 dark:border-slate-700 transition-colors ${activeTab === 'friends' ? 'hidden lg:block' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Conversations récentes
              </h3>
              <button
                onClick={handleCreateGroup}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Créer un groupe">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${activeTab === 'friends' ? 'hidden' : ''}`}>
              {sortedConversations.filter((conv) =>
              conv.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((conv) => {
                const isPinned = pinnedConversations.includes(conv.id);
                return (
                    <div
                        key={conv.id}
                        onClick={() => {
                          setSelectedConversation(conv.id);
                          setMobileShowChat(true);
                        }}
                        className={`p-4 cursor-pointer transition-colors border-l-4 ${
                    selectedConversation === conv.id ?
                    'border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-900/10' :
                    isPinned ?
                    'border-yellow-400 dark:border-yellow-500 conversation-pinned' :
                    'border-transparent'}`
                    }>
                  <div className="flex items-center gap-3">
                        <div className="relative">
                          {conv.type === 'group' ? (
                            <div className="flex -space-x-2">
                              {conv.members?.slice(0, 2).map((member: any, index: number) => (
                                <RenderAvatar 
                                  key={index} 
                                  avatar={member.avatar} 
                                  className="w-10 h-10 bg-gray-100 dark:bg-slate-700 border-2 border-white dark:border-slate-800" 
                                />
                              ))}
                            </div>
                          ) : (
                            <RenderAvatar 
                              avatar={conv.avatar} 
                              className="w-10 h-10 bg-gray-100 dark:bg-slate-700 relative" 
                            />
                          )}
                        </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">{conv.name}</h4>
                        </div>
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePinFromList(conv.id);
                            }}
                            title={isPinned ? "Désépingler" : "Épingler"}
                            className="p-1 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors">
                          {isPinned ? <Pin size={16} className="text-yellow-600 dark:text-yellow-500" /> : <PinOff size={16} className="text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-500" />}
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{conv.time}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{conv.lastMessage}</p>
                    </div>
                    
                    {conv.unread > 0 &&
                      <div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unread}
                      </div>
                    }
                  </div>
                </div>);
              })}
              
              {sortedConversations.filter((conv) =>
              conv.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).length === 0 &&
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <MessageCircle size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-lg font-medium">Aucune conversation</p>
                  <p className="text-sm">Commencez une nouvelle conversation</p>
                </div>
              }
            </div>

            <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 ${activeTab === 'messages' ? 'hidden' : ''}`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mes amis ({friends.length})
                  </h3>
                  <button
                    onClick={() => setShowAddFriendForm(true)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="Ajouter un ami">
                    <UserPlus size={16} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {friends.filter((friend) =>
                  friend.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((friend) =>
                    <div
                        key={friend.id}
                        onClick={() => {
                          setSelectedConversation(friend.id);
                          setActiveTab('messages');
                          setMobileShowChat(true);
                        }}
                      className="p-3 cursor-pointer transition-colors rounded-lg border border-gray-100 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                              <RenderAvatar 
                                avatar={friend.avatar} 
                                className="w-10 h-10 bg-gray-100 dark:bg-slate-600" 
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-gray-900 dark:text-white truncate">{friend.name}</h4>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{friend.email}</p>
                          </div>
                      </div>
                    </div>
                  )}
                  
                  {friends.length === 0 &&
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <UserPlus size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                      <p className="text-lg font-medium">Aucun ami pour le moment</p>
                      <p className="text-sm">Ajoutez des amis pour commencer à discuter</p>
                    </div>
                  }
                </div>
              </div>
            </div>
        </div>

        <div className={`flex-1 flex-col bg-white dark:bg-slate-800 transition-colors ${mobileShowChat ? 'flex' : 'hidden lg:flex'}`}>
          {currentConversation && !deletedConversations.includes(currentConversation.id) ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileShowChat(false);
                        }}
                        className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Retour"
                      >
                        <ChevronLeft size={24} />
                      </button>

                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 p-1 rounded-xl transition-colors"
                        onClick={() => currentConversation.type === 'group' && setShowGroupSettings(true)}
                      >
                        {currentConversation.type === 'group' ? (
                          <div className="flex -space-x-2">
                            {(currentConversation as any).members?.slice(0, 3).map((member: any, index: number) => (
                              <RenderAvatar 
                                key={index} 
                                avatar={member.avatar} 
                                className="w-8 h-8 bg-gray-100 dark:bg-slate-600 border-2 border-white dark:border-slate-800" 
                                textClassName="text-xs"
                              />
                            ))}
                          </div>
                        ) : (
                          <RenderAvatar 
                            avatar={currentConversation.avatar} 
                            className="w-8 h-8 bg-gray-100 dark:bg-slate-600 relative" 
                            textClassName="text-sm"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{currentConversation.name}</h3>
                          <div className="flex items-center gap-2">
                            {currentConversation.type === 'group' && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">{(currentConversation as any).members?.length} membres</span>
                            )}
                            {pinnedConversations.includes(currentConversation.id) &&
                              <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit">
                                <Pin size={10} /> Épinglée
                              </div>
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button onClick={() => setShowMoreOptions(!showMoreOptions)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <MoreHorizontal size={20} />
                    </button>
                    {showMoreOptions && (
                      <div className="absolute right-0 top-12 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg py-2 w-48 z-10">
                        <button onClick={handleTogglePin} className="w-full px-4 py-2 text-left text-sm text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center gap-2">
                          {pinnedConversations.includes(currentConversation.id) ? <><PinOff size={16} /> Désépingler</> : <><Pin size={16} /> Épingler</>}
                        </button>
                        <button onClick={handleDeleteConversation} className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                          <Trash2 size={16} /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                {currentConversationMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-3 max-w-[85%] lg:max-w-md ${message.isOwn ? 'flex-row-reverse' : ''}`}>
                      {!message.isOwn && (
                        <RenderAvatar 
                          avatar={message.avatar} 
                          className="w-8 h-8 bg-gray-100 dark:bg-slate-600" 
                          textClassName="text-xs"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                      <div className={`px-4 py-2 rounded-2xl ${message.isOwn ? 'bg-blue-500 dark:bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-bl-md'}`}>
                        {!message.isOwn && <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">{message.sender}</div>}
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        
                          {message.taskId && (
                            <div 
                              onClick={() => {
                                const task = tasks.find(t => t.id === message.taskId);
                                if (task) setSelectedTaskForModal(task);
                              }}
                              className={`mt-3 p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all group/task ${message.isOwn ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 shadow-sm hover:border-blue-300 dark:hover:border-blue-700'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg group-hover/task:scale-110 transition-transform">
                                  <Check size={16} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className={`text-xs font-bold truncate ${message.isOwn ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                    {tasks.find(t => t.id === message.taskId)?.name || 'Tâche partagée'}
                                  </h5>
                                  <p className={`text-[10px] ${message.isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>Cliquez pour voir les détails</p>
                                </div>
                              </div>
                              <div className={`w-full mt-3 py-1.5 rounded-lg text-[10px] font-bold text-center transition-colors ${message.isOwn ? 'bg-white text-blue-600 group-hover/task:bg-blue-50' : 'bg-blue-500 text-white group-hover/task:bg-blue-600'}`}>
                                Voir la tâche
                              </div>
                            </div>
                          )}
                        <div className={`text-[10px] mt-1 text-right ${message.isOwn ? 'text-blue-100 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{message.time}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Écrivez votre message..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-colors" />
                </div>
                <button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-3 bg-blue-500 dark:bg-blue-600 text-white rounded-xl hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <MessageCircle size={64} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-xl font-medium">Sélectionnez une conversation</p>
              <p className="text-sm">Choisissez une conversation pour commencer à discuter</p>
            </div>
          </div>
        )}
      </div>

      {showRightSidebar && (
        <div className="absolute inset-0 bg-black/50 z-40 lg:hidden animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowRightSidebar(false)} />
      )}
      <div className={`${showRightSidebar ? 'absolute inset-y-0 right-0 z-50 w-full sm:w-80 shadow-2xl lg:relative lg:inset-auto lg:z-0 lg:shadow-none lg:w-80 animate-[slideInRight_0.3s_ease-out]' : 'hidden lg:flex lg:w-12'} bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col transition-all duration-300 overflow-x-hidden`}>
        <div className={`${showRightSidebar ? 'p-4' : 'p-1 py-4'} border-b border-gray-200 dark:border-slate-700 flex items-center ${showRightSidebar ? 'justify-between' : 'justify-center'} transition-colors`}>
          {showRightSidebar && <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gestion des amis</h2>}
          <button onClick={() => setShowRightSidebar(!showRightSidebar)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors relative">
            {showRightSidebar ? <X size={20} /> : <ChevronLeft size={20} />}
            {!showRightSidebar && pendingRequests.length > 0 && <span className="absolute -top-1 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">{pendingRequests.length}</span>}
          </button>
        </div>

        {showRightSidebar && (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 transition-colors">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Demandes d'amis ({pendingRequests.length})</h3>
              <div className="space-y-3">
                    {pendingRequests.map((request) => {
                      const sender = request.sender;
                      return (
                        <div key={request.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 transition-colors">
                          <div className="flex items-center gap-3 mb-3">
                            <RenderAvatar 
                              avatar={sender?.avatar} 
                              className="w-10 h-10 bg-gray-100 dark:bg-slate-600" 
                            />
                            <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">{sender?.name || 'Inconnu'}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{sender?.email || request.senderId}</p>
                          </div>
                        </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptRequest(request.id)} className="flex-1 bg-blue-500 dark:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">Accepter</button>
                        <button onClick={() => handleRejectRequest(request.id)} className="flex-1 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors">Refuser</button>
                      </div>
                    </div>
                  );
                })}
                {pendingRequests.length === 0 && <div className="text-center text-gray-500 dark:text-gray-400 py-4"><p className="text-sm">Aucune demande en attente</p></div>}
              </div>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ajouter un ami</h3>
                <button onClick={() => setShowAddFriendForm(true)} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"><Plus size={16} /></button>
              </div>
            </div>
          </>
        )}

        {!showRightSidebar && (
          <div className="flex-1 flex flex-col items-center justify-center p-2">
            <div className="transform -rotate-90 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium tracking-wider uppercase">Gestion des amis</div>
          </div>
        )}
      </div>

      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50/50 dark:from-blue-900/10 to-purple-50/50 dark:to-purple-900/10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Créer un nouveau groupe</h2>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nom du groupe</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors" placeholder="Ex: Équipe Design, Projet X..." required />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sélectionner les membres ({selectedFriendsForGroup.length})</label>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input type="text" value={searchFriend} onChange={(e) => setSearchFriend(e.target.value)} placeholder="Rechercher un ami..." className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors" />
                </div>
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 max-h-60 overflow-y-auto space-y-2">
                    {friends.filter(f => f.name.toLowerCase().includes(searchFriend.toLowerCase()) || f.email.toLowerCase().includes(searchFriend.toLowerCase())).map((friend) => (
                      <div key={friend.id} onClick={() => toggleFriendSelection(friend.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedFriendsForGroup.includes(friend.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-white dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700'}`}>
                        <div className="flex items-center gap-3">
                          <RenderAvatar 
                            avatar={friend.avatar} 
                            className="w-10 h-10 bg-gray-100 dark:bg-slate-700" 
                          />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{friend.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{friend.email}</div>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedFriendsForGroup.includes(friend.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-slate-600'}`}>{selectedFriendsForGroup.includes(friend.id) && <Check size={14} className="text-white" />}</div>
                      </div>
                    ))}
                  </div>
              </div>

              {selectedFriendsForGroup.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Membres sélectionnés</h4>
                  <div className="flex flex-wrap gap-2">
                      {selectedFriendsForGroup.map((id) => {
                        const friend = friends.find(f => f.id === id);
                        return friend ? (
                          <div key={id} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                            <RenderAvatar 
                              avatar={friend.avatar} 
                              className="w-5 h-5" 
                              textClassName="text-[10px]"
                            /> 
                            <span>{friend.name}</span>
                            <button onClick={() => toggleFriendSelection(id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400"><X size={14} /></button>
                          </div>
                        ) : null;
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowCreateGroupModal(false)} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-colors">Annuler</button>
              <button onClick={handleCreateGroupSubmit} disabled={!groupName.trim() || selectedFriendsForGroup.length === 0} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">Créer le groupe</button>
            </div>
          </div>
          </div>
        )}

        {showAddFriendForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors"
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50/50 dark:from-blue-900/10 to-purple-50/50 dark:to-purple-900/10">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajouter un ami</h2>
                <button onClick={() => { setShowAddFriendForm(false); setAddFriendEmail(''); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email de l'ami</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={addFriendEmail} 
                      onChange={(e) => setAddFriendEmail(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendFriendRequest(); }}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors" 
                      placeholder="exemple@email.com" 
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Entrez l'adresse email de la personne que vous souhaitez ajouter comme ami.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
                <button onClick={() => { setShowAddFriendForm(false); setAddFriendEmail(''); }} className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-colors">Annuler</button>
                <button onClick={handleSendFriendRequest} disabled={!addFriendEmail.trim()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20">
                  Envoyer la demande
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {(showMoreOptions || showEmojiPicker || showCreateGroupModal) && (
        <div className="absolute inset-0 z-0" onClick={() => { setShowMoreOptions(false); setShowEmojiPicker(false); setShowCreateGroupModal(false); }} />
      )}

      {selectedTaskForModal && (
        <TaskModal 
          task={selectedTaskForModal} 
          isOpen={!!selectedTaskForModal} 
          onClose={() => setSelectedTaskForModal(null)} 
        />
      )}

      {showGroupSettings && currentConversation?.type === 'group' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50/50 dark:from-blue-900/10 to-purple-50/50 dark:to-purple-900/10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gérer le groupe</h2>
              <button onClick={() => setShowGroupSettings(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <Users size={16} /> Membres actuels ({(currentConversation as any).members.length})
                </h3>
                <div className="space-y-3">
                    {(currentConversation as any).members.map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <RenderAvatar 
                            avatar={member.avatar} 
                            className="w-10 h-10 bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700" 
                            textClassName="text-xl"
                          />
                          <div>
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {member.name}
                            {member.id === (currentConversation as any).ownerId && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Chef</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{member.id === user.id ? 'Vous' : 'Membre'}</div>
                        </div>
                      </div>
                      
                      {user.id === (currentConversation as any).ownerId && member.id !== user.id && (
                        <button 
                          onClick={() => {
                            if (window.confirm(`Voulez-vous vraiment retirer ${member.name} du groupe ?`)) {
                              setGroupConversations(prev => prev.map(c => {
                                if (c.id === currentConversation.id) {
                                  return {
                                    ...c,
                                    members: (c as any).members.filter((m: any) => m.id !== member.id)
                                  };
                                }
                                return c;
                              }));
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Retirer du groupe"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <UserPlus size={16} /> Ajouter des membres
                </h3>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input 
                    type="text" 
                    value={searchFriend} 
                    onChange={(e) => setSearchFriend(e.target.value)} 
                    placeholder="Rechercher parmi vos amis..." 
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors" 
                  />
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {friends
                    .filter(f => 
                      (f.name.toLowerCase().includes(searchFriend.toLowerCase()) || f.email.toLowerCase().includes(searchFriend.toLowerCase())) &&
                      !(currentConversation as any).members.some((m: any) => m.id === f.id)
                    )
                    .map((friend) => (
                        <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                          <div className="flex items-center gap-3">
                            <RenderAvatar 
                              avatar={friend.avatar} 
                              className="w-8 h-8 bg-gray-100 dark:bg-slate-700" 
                              textClassName="text-sm"
                            />
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{friend.name}</div>
                          </div>
                        <button 
                          onClick={() => {
                            setGroupConversations(prev => prev.map(c => {
                              if (c.id === currentConversation.id) {
                                return {
                                  ...c,
                                  members: [...(c as any).members, { id: friend.id, name: friend.name, avatar: friend.avatar }]
                                };
                              }
                              return c;
                            }));
                            setSearchFriend('');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    ))}
                  
                  {friends.filter(f => 
                    (f.name.toLowerCase().includes(searchFriend.toLowerCase()) || f.email.toLowerCase().includes(searchFriend.toLowerCase())) &&
                    !(currentConversation as any).members.some((m: any) => m.id === f.id)
                  ).length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 italic">
                      Aucun autre ami trouvé
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end">
              <button 
                onClick={() => setShowGroupSettings(false)} 
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/25"
              >
                Terminer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MessagingPage;
