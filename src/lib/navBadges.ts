import { useEffect, useState, useTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { loadPosts, currentJournalUser, JOURNAL_CHANGED_EVENT } from './journal';
import { loadEvents, eventsByDay, dateKey, CALENDAR_CHANGED_EVENT } from './calendar';
import { useAccessRequests, pendingIncoming, ACCESS_CHANGED_EVENT } from './access';
import { useMedAlerts } from './medAlerts';
import { MEDS_CHANGED_EVENT } from './meds';
import { SETTINGS_CHANGED_EVENT, CURRENT_MEMBER_ID } from './settings';
import { MEMBERS_CHANGED_EVENT } from './members';
import { NOTIFICATIONS_CHANGED_EVENT, loadStoredNotifications } from './notifications';

export const NAV_BADGES_CHANGED_EVENT = 'growa-nav-badges-changed';

const SEEN_PREFIX = 'growa_seen_nav_';

export function markNavSeen(path: string): void {
  try {
    if (path === '/calendar') {
      localStorage.setItem(`${SEEN_PREFIX}${path}`, dateKey(new Date()));
    } else {
      localStorage.setItem(`${SEEN_PREFIX}${path}`, new Date().toISOString());
    }
  } catch {
    // ข้ามได้
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NAV_BADGES_CHANGED_EVENT));
  }
}

/** คำนวณจำนวนการอัพเดตของแต่ละช่อง/เมนูในบ้าน */
export function computeNavBadges(
  currentPath: string,
  incomingRequestsCount: number,
  medAlertsCount: number
): Record<string, number> {
  const badges: Record<string, number> = {};
  const now = new Date();
  const todayKeyStr = dateKey(now);
  const user = currentJournalUser();

  // 1. ช่องบันทึกอาการ (/journal)
  if (currentPath === '/journal') {
    badges['/journal'] = 0;
  } else {
    try {
      const lastSeen = localStorage.getItem(`${SEEN_PREFIX}/journal`);
      const posts = loadPosts();
      let unreadPosts = 0;
      let unreadComments = 0;

      if (lastSeen) {
        for (const post of posts) {
          if (post.createdAt > lastSeen && post.authorId !== user.id) {
            unreadPosts++;
          }
          if (Array.isArray(post.comments)) {
            for (const comment of post.comments) {
              if (comment.createdAt > lastSeen && comment.authorId !== user.id) {
                unreadComments++;
              }
            }
          }
        }
      } else {
        // ยังไม่เคยเปิด: ดูโพสต์วันนี้ของคนอื่นในบ้าน
        for (const post of posts) {
          if (post.createdAt.startsWith(todayKeyStr) && post.authorId !== user.id) {
            unreadPosts++;
          }
        }
      }
      badges['/journal'] = unreadPosts + unreadComments;
    } catch {
      badges['/journal'] = 0;
    }
  }

  // 2. ช่องปฏิทิน (/calendar)
  if (currentPath === '/calendar') {
    badges['/calendar'] = 0;
  } else {
    try {
      const lastSeenDate = localStorage.getItem(`${SEEN_PREFIX}/calendar`);
      if (lastSeenDate !== todayKeyStr) {
        const events = loadEvents();
        const map = eventsByDay(events, now, now);
        const todayEvents = map.get(todayKeyStr) ?? [];
        badges['/calendar'] = todayEvents.length;
      } else {
        badges['/calendar'] = 0;
      }
    } catch {
      badges['/calendar'] = 0;
    }
  }

  // 3. ช่องสมาชิกในบ้าน (/members)
  badges['/members'] = currentPath === '/members' ? 0 : incomingRequestsCount;

  // 4. ช่องยาและการดูแล (/meds)
  badges['/meds'] = currentPath === '/meds' ? 0 : medAlertsCount;

  // 5. ช่องศูนย์การแจ้งเตือน (/notifications)
  if (currentPath === '/notifications') {
    badges['/notifications'] = 0;
  } else {
    try {
      const allNotifs = loadStoredNotifications();
      const unread = allNotifs.filter((n) => {
        const forUser = n.recipients.length === 0 || n.recipients.some((r) => r.memberId === CURRENT_MEMBER_ID);
        if (!forUser) return false;
        const recipient = n.recipients.find((r) => r.memberId === CURRENT_MEMBER_ID);
        return recipient ? !recipient.readAt : !n.isRead;
      }).length;
      badges['/notifications'] = unread;
    } catch {
      badges['/notifications'] = 0;
    }
  }

  return badges;
}

/** Hook สำหรับดึงจำนวนการอัพเดตของแต่ละเมนูแบบเรียลไทม์ */
export function useNavBadges(): Record<string, number> {
  const location = useLocation();
  const currentPath = location.pathname;
  const accessRequests = useAccessRequests();
  const incomingCount = pendingIncoming(accessRequests).length;
  const medAlerts = useMedAlerts();
  const medAlertsCount = medAlerts.length;

  const [, startTransition] = useTransition();

  const [badges, setBadges] = useState<Record<string, number>>(() =>
    computeNavBadges(currentPath, incomingCount, medAlertsCount)
  );

  // เมื่อเข้าหน้าไหน ให้ถือว่าดูหน้านั้นแล้ว
  useEffect(() => {
    markNavSeen(currentPath);
  }, [currentPath]);

  useEffect(() => {
    const update = () => {
      startTransition(() => {
        setBadges(computeNavBadges(currentPath, incomingCount, medAlertsCount));
      });
    };

    update();

    window.addEventListener(NAV_BADGES_CHANGED_EVENT, update);
    window.addEventListener(JOURNAL_CHANGED_EVENT, update);
    window.addEventListener(CALENDAR_CHANGED_EVENT, update);
    window.addEventListener(ACCESS_CHANGED_EVENT, update);
    window.addEventListener(MEDS_CHANGED_EVENT, update);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, update);
    window.addEventListener(MEMBERS_CHANGED_EVENT, update);
    window.addEventListener(SETTINGS_CHANGED_EVENT, update);
    window.addEventListener('storage', update);

    const interval = window.setInterval(update, 30_000);

    return () => {
      window.removeEventListener(NAV_BADGES_CHANGED_EVENT, update);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, update);
      window.removeEventListener(CALENDAR_CHANGED_EVENT, update);
      window.removeEventListener(ACCESS_CHANGED_EVENT, update);
      window.removeEventListener(MEDS_CHANGED_EVENT, update);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, update);
      window.removeEventListener(MEMBERS_CHANGED_EVENT, update);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, update);
      window.removeEventListener('storage', update);
      window.clearInterval(interval);
    };
  }, [currentPath, incomingCount, medAlertsCount]);

  return badges;
}
