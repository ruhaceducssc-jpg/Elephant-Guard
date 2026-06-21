import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Camera, Map, History, UserPlus, 
  User, LogOut, ShieldAlert, Send, Menu, X, MapPin, CheckCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import lankaBeaconLogo from '../../../design-reference/logo.png';
import notificationBellUrl from '../../../design-reference/notification-bell.png';
import { io } from 'socket.io-client';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService';

const formatNotificationTime = (value) => {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return new Intl.DateTimeFormat('en-LK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [isReadingAll, setIsReadingAll] = useState(false);
  const notificationPanelRef = useRef(null);
  const guardId = user?._id || user?.id;

  const loadUnreadCount = useCallback(async () => {
    if (!guardId) return;

    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (error) {
      console.error('Failed to load notification unread count:', error);
    }
  }, [guardId]);

  const loadNotifications = useCallback(async () => {
    if (!guardId) return;

    setIsNotificationLoading(true);
    setNotificationError('');

    try {
      const data = await getNotifications({ limit: 20, page: 1 });
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotificationError('Failed to load notifications.');
    } finally {
      setIsNotificationLoading(false);
    }
  }, [guardId]);

  useEffect(() => {
    if (!guardId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsNotificationOpen(false);
      return undefined;
    }

    loadUnreadCount();

    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
    });

    const joinGuardRoom = () => {
      socket.emit('join', guardId);
    };

    const handleNewNotification = ({ notification, unreadCount: nextUnreadCount } = {}) => {
      if (notification?._id) {
        setNotifications((current) => [
          notification,
          ...current.filter((item) => String(item._id) !== String(notification._id)),
        ].slice(0, 20));
      }

      setUnreadCount((current) => (
        Number.isFinite(Number(nextUnreadCount))
          ? Number(nextUnreadCount)
          : current + 1
      ));
    };

    const handleReadNotification = ({
      notificationId,
      unreadCount: nextUnreadCount,
      all,
      readAt,
    } = {}) => {
      setNotifications((current) => current.map((notification) => {
        if (all || String(notification._id) === String(notificationId)) {
          return {
            ...notification,
            isRead: true,
            readAt: readAt || notification.readAt || new Date().toISOString(),
          };
        }

        return notification;
      }));

      if (Number.isFinite(Number(nextUnreadCount))) {
        setUnreadCount(Number(nextUnreadCount));
      }
    };

    socket.on('connect', joinGuardRoom);
    socket.on('guard-notification:new', handleNewNotification);
    socket.on('guard-notification:read', handleReadNotification);

    return () => {
      socket.off('connect', joinGuardRoom);
      socket.off('guard-notification:new', handleNewNotification);
      socket.off('guard-notification:read', handleReadNotification);
      socket.disconnect();
    };
  }, [guardId, loadUnreadCount]);

  useEffect(() => {
    if (!isNotificationOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (
        notificationPanelRef.current
        && !notificationPanelRef.current.contains(event.target)
      ) {
        setIsNotificationOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationOpen]);

  const toggleNotificationPanel = () => {
    const nextOpen = !isNotificationOpen;
    setIsNotificationOpen(nextOpen);

    if (nextOpen) {
      loadNotifications();
    }
  };

  const handleNotificationRead = async (notification) => {
    if (!notification?._id || notification.isRead) return;

    try {
      const data = await markNotificationRead(notification._id);
      setNotifications((current) => current.map((item) => (
        String(item._id) === String(notification._id)
          ? { ...item, isRead: true, readAt: data?.notification?.readAt }
          : item
      )));
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setNotificationError('Failed to update notification.');
    }
  };

  const handleReadAll = async () => {
    if (isReadingAll || unreadCount === 0) return;

    setIsReadingAll(true);
    setNotificationError('');

    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt,
      })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setNotificationError('Failed to read all notifications.');
    } finally {
      setIsReadingAll(false);
    }
  };

  const menuItems = [
    { path: '/dashboard', name: 'Overview', icon: <LayoutDashboard size={18} /> },
    { path: '/dashboard/detection', name: 'Scanner', icon: <Camera size={18} /> },
    { path: '/dashboard/map', name: 'Map', icon: <Map size={18} /> },
    { path: '/dashboard/history', name: 'Logs', icon: <History size={18} /> },
    { path: '/dashboard/delivery', name: 'Tracking', icon: <Send size={18} /> },
    { path: '/dashboard/register-user', name: 'Registrations', icon: <UserPlus size={18} /> },
    { path: '/dashboard/profile', name: 'Profile', icon: <User size={18} /> },
  ];

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className="h-[86px] bg-white border-b border-[#dfe7f1] shadow-sm sticky top-0 z-[1000] w-full box-border">
      <div className="max-w-[1920px] w-full mx-auto h-full px-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 lg:gap-10">
        {/* Brand Section */}
        <div className="flex items-center shrink-0 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-[56px] h-[56px] flex items-center justify-center transition-transform group-hover:scale-[1.02] shrink-0">
              <img src={lankaBeaconLogo} alt="Lanka Beacon elephant logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-[26px] font-[800] text-[#0b2d63] tracking-tighter leading-none truncate">
                Lanka Beacon
              </h1>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center min-w-0">
          <div className="flex items-center gap-1 xl:gap-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) => 
                  `flex items-center gap-2.5 h-[48px] px-3 xl:px-4 rounded-[5px] text-[13.5px] font-[600] transition-all border-b-2 shrink-0 ${
                    isActive 
                      ? 'bg-[#eaf2ff] text-[#1768d1] border-[#1768d1]' 
                      : 'text-[#334155] border-transparent hover:bg-[#f4f8ff] hover:text-[#1768d1]'
                  }`
                }
              >
                {React.cloneElement(item.icon, { size: 18, strokeWidth: 2.5 })}
                <span className="hidden xl:inline">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0 justify-end">
          <div className="hidden sm:flex h-10 px-4 bg-[#edfcf4] border border-[#b7efcf] rounded-[5px] items-center gap-2 text-[#0e7a42] font-[700] text-[10px] xl:text-[11px] uppercase tracking-wider shadow-sm shrink-0">
            <div className="w-2 h-2 bg-[#18b866] rounded-full animate-pulse shrink-0"></div>
            <span className="hidden xl:inline">Network Active</span>
            <span className="xl:hidden">Active</span>
          </div>

          <div className="hidden md:block h-10 w-px bg-slate-200 shrink-0"></div>

          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <div className="text-right hidden xl:block min-w-0 max-w-[150px]">
              <p className="text-[14px] font-[700] text-slate-900 leading-none truncate">{user?.name || 'Officer'}</p>
              <p className="text-[10px] font-[700] text-slate-400 uppercase tracking-widest mt-1.5 flex items-center justify-end gap-1">
                 <MapPin size={10} className="text-[#2878e8]" />
                 <span className="truncate">{user?.assignedArea || 'Sector 01'}</span>
              </p>
            </div>
            <Link to="/dashboard/profile" className="w-11 h-11 bg-slate-100 rounded-[5px] overflow-hidden border border-slate-200 hover:border-[#2878e8] transition-colors shrink-0 shadow-sm">
               {user?.avatar ? (
                 <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-[#eaf2ff] text-[#1768d1] font-bold text-lg">
                   {user?.name?.charAt(0)}
                 </div>
               )}
            </Link>
          </div>

          <div className="relative shrink-0" ref={notificationPanelRef}>
            <button
              type="button"
              onClick={toggleNotificationPanel}
              className="relative w-11 h-11 flex items-center justify-center bg-white rounded-[5px] transition-all border border-[#dfe7f1] hover:bg-[#f4f8ff] hover:border-[#2878e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878e8]/40 shrink-0 shadow-sm"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={isNotificationOpen}
              title="Notifications"
            >
              <img
                src={notificationBellUrl}
                alt=""
                aria-hidden="true"
                className="w-[22px] h-[22px] object-contain"
              />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-[#e02424] text-white border-2 border-white flex items-center justify-center text-[9px] font-[800] leading-none shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <section
                className="absolute right-0 top-[54px] w-[calc(100vw-2rem)] sm:w-[420px] max-h-[calc(100vh-110px)] bg-white border border-[#dfe7f1] rounded-[5px] shadow-2xl overflow-hidden z-[1100]"
                aria-label="Guard notifications"
              >
                <div className="px-5 py-4 border-b border-[#dfe7f1] bg-[#f8fafc] flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[14px] font-[800] text-[#0f172a] uppercase tracking-wider">
                      Notifications
                    </h2>
                    <p className="text-[10px] font-[700] text-[#64748b] uppercase tracking-widest mt-1">
                      {unreadCount} unread
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReadAll}
                    disabled={isReadingAll || unreadCount === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-[5px] border border-[#b9d4f8] text-[#1768d1] bg-[#eaf2ff] text-[10px] font-[800] uppercase tracking-wider hover:bg-[#dceaff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCheck size={15} />
                    {isReadingAll ? 'Reading...' : 'Read all notifications'}
                  </button>
                </div>

                <div className="max-h-[calc(100vh-190px)] overflow-y-auto">
                  {isNotificationLoading && (
                    <p className="px-5 py-10 text-center text-[12px] font-[700] text-[#64748b]">
                      Loading notifications...
                    </p>
                  )}

                  {!isNotificationLoading && notificationError && (
                    <div className="px-5 py-8 text-center">
                      <p className="text-[12px] font-[700] text-[#c81e1e]">
                        {notificationError}
                      </p>
                      <button
                        type="button"
                        onClick={loadNotifications}
                        className="mt-3 text-[10px] font-[800] text-[#1768d1] uppercase tracking-wider"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {!isNotificationLoading && !notificationError && notifications.length === 0 && (
                    <p className="px-5 py-10 text-center text-[12px] font-[700] text-[#64748b]">
                      No notifications yet.
                    </p>
                  )}

                  {!isNotificationLoading && !notificationError && notifications.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleNotificationRead(notification)}
                      className={`w-full text-left px-5 py-4 border-b border-[#edf1f6] transition-colors ${
                        notification.isRead
                          ? 'bg-white hover:bg-[#f8fafc]'
                          : 'bg-[#f3f8ff] hover:bg-[#eaf2ff]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-[800] text-[#0f172a]">
                            {notification.title}
                          </p>
                          <p className="text-[11px] font-[600] text-[#475569] mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                        </div>
                        <span className={`shrink-0 mt-1 w-2.5 h-2.5 rounded-full ${
                          notification.isRead ? 'bg-[#cbd5e1]' : 'bg-[#e02424]'
                        }`} />
                      </div>

                      <dl className="mt-3 grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-[10.5px] leading-relaxed">
                        <dt className="font-[800] text-[#64748b] uppercase">Resident</dt>
                        <dd className="font-[700] text-[#0f172a] break-words">
                          {notification.residentSnapshot?.name || 'Unavailable'}
                        </dd>
                        <dt className="font-[800] text-[#64748b] uppercase">Phone</dt>
                        <dd className="font-[700] text-[#0f172a] break-all">
                          {notification.residentSnapshot?.phone || 'Unavailable'}
                        </dd>
                        <dt className="font-[800] text-[#64748b] uppercase">Telegram ID</dt>
                        <dd className="font-[700] text-[#0f172a] break-all">
                          {notification.residentSnapshot?.telegramChatId || 'Unavailable'}
                        </dd>
                        <dt className="font-[800] text-[#64748b] uppercase">Reply</dt>
                        <dd className="font-[800] text-[#1768d1]">
                          {notification.residentReply?.label || notification.residentReply?.status || 'Unavailable'}
                        </dd>
                        <dt className="font-[800] text-[#64748b] uppercase">Detection</dt>
                        <dd className="font-[700] text-[#0f172a] break-words">
                          {notification.detectionSnapshot?.locationName || 'Location unavailable'}
                        </dd>
                        <dt className="font-[800] text-[#64748b] uppercase">Time</dt>
                        <dd className="font-[700] text-[#0f172a]">
                          {formatNotificationTime(notification.residentReply?.repliedAt || notification.createdAt)}
                        </dd>
                      </dl>

                      <p className={`mt-3 text-[9px] font-[800] uppercase tracking-[0.18em] ${
                        notification.isRead ? 'text-[#94a3b8]' : 'text-[#e02424]'
                      }`}>
                        {notification.isRead ? 'Read' : 'Unread'}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
          
          {/* Mobile Toggle */}
          <div className="lg:hidden flex items-center ml-2">
            <button 
              className="p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-[5px] hover:bg-slate-100 transition-colors"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-[88px] left-0 right-0 bg-white border-b border-slate-200 shadow-2xl lg:hidden flex flex-col p-4 gap-2 animate-in slide-in-from-top-4 duration-300 z-[1001]">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => 
                `flex items-center gap-4 p-4 rounded-[5px] font-[700] text-[14px] transition-all ${
                  isActive ? 'bg-[#eaf2ff] text-[#1768d1] border-l-4 border-[#1768d1]' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {React.cloneElement(item.icon, { size: 20 })}
              {item.name}
            </NavLink>
          ))}
          <div className="h-px bg-slate-100 my-2"></div>
          <button 
            onClick={() => { logout(); setIsMobileMenuOpen(false); }}
            className="flex items-center gap-4 p-4 rounded-[5px] font-[700] text-[14px] text-[#e02424] hover:bg-[#fff1f1] transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
};

export default TopNavbar;
