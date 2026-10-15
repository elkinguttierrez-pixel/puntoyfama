/**
 * Gestor multi-usuario, perfiles, estadísticas y tabla de clasificación (Leaderboard).
 * Persistencia garantizada con LocalStorage.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UserManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'punto_fama_users_v2';
  const ACTIVE_USER_KEY = 'punto_fama_active_user_id';

  const DEFAULT_AVATARS = ['🎯', '👑', '🚀', '⚡', '🦊', '🦁', '👾', '🔥', '💎', '🦄'];

  const INITIAL_USERS = [
    {
      id: 'usr_p1',
      name: 'Jugador 1',
      avatar: '👑',
      createdAt: Date.now(),
      stats: {
        played: 0,
        won: 0,
        bestAttempts: null,
        bestTimeSec: null,
        totalAttempts: 0,
        totalFamas: 0,
        totalPuntos: 0
      }
    },
    {
      id: 'usr_p2',
      name: 'Jugador 2',
      avatar: '⚡',
      createdAt: Date.now() + 1,
      stats: {
        played: 0,
        won: 0,
        bestAttempts: null,
        bestTimeSec: null,
        totalAttempts: 0,
        totalFamas: 0,
        totalPuntos: 0
      }
    }
  ];

  function loadUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error al cargar perfiles de usuario:', e);
    }
    // Guardar iniciales si no existen
    saveUsers(INITIAL_USERS);
    return [...INITIAL_USERS];
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Error al guardar perfiles de usuario:', e);
    }
  }

  function getActiveUserId() {
    try {
      const saved = localStorage.getItem(ACTIVE_USER_KEY);
      if (saved) return saved;
    } catch (e) {}
    return 'usr_p1';
  }

  function setActiveUserId(id) {
    try {
      localStorage.setItem(ACTIVE_USER_KEY, id);
    } catch (e) {}
  }

  function getActiveUser() {
    const users = loadUsers();
    const activeId = getActiveUserId();
    const user = users.find(u => u.id === activeId);
    return user || users[0] || null;
  }

  function createUser(name, avatar) {
    const users = loadUsers();
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('El nombre de usuario no puede estar vacío.');
    }

    const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: cleanName,
      avatar: avatar || randomAvatar,
      createdAt: Date.now(),
      stats: {
        played: 0,
        won: 0,
        bestAttempts: null,
        bestTimeSec: null,
        totalAttempts: 0,
        totalFamas: 0,
        totalPuntos: 0
      }
    };

    users.push(newUser);
    saveUsers(users);
    setActiveUserId(newUser.id);
    return newUser;
  }

  function deleteUser(id) {
    let users = loadUsers();
    if (users.length <= 1) {
      throw new Error('Debe existir al menos un usuario registrado en el sistema.');
    }

    users = users.filter(u => u.id !== id);
    saveUsers(users);

    if (getActiveUserId() === id) {
      setActiveUserId(users[0].id);
    }
    return users;
  }

  function recordGameResult(userId, { won, attempts, timeSec, famasCount = 0, puntosCount = 0 }) {
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return null;

    const user = users[userIndex];
    user.stats.played = (user.stats.played || 0) + 1;
    user.stats.totalAttempts = (user.stats.totalAttempts || 0) + attempts;
    user.stats.totalFamas = (user.stats.totalFamas || 0) + famasCount;
    user.stats.totalPuntos = (user.stats.totalPuntos || 0) + puntosCount;

    if (won) {
      user.stats.won = (user.stats.won || 0) + 1;

      if (user.stats.bestAttempts === null || attempts < user.stats.bestAttempts) {
        user.stats.bestAttempts = attempts;
      }

      if (typeof timeSec === 'number' && timeSec > 0) {
        if (user.stats.bestTimeSec === null || timeSec < user.stats.bestTimeSec) {
          user.stats.bestTimeSec = timeSec;
        }
      }
    }

    users[userIndex] = user;
    saveUsers(users);
    return user;
  }

  function getLeaderboard() {
    const users = loadUsers();
    return users
      .map(user => {
        const played = user.stats.played || 0;
        const won = user.stats.won || 0;
        const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
        const avgAttempts = won > 0 ? (user.stats.totalAttempts / played).toFixed(1) : '-';

        return {
          ...user,
          winRate,
          avgAttempts
        };
      })
      .sort((a, b) => {
        // Criterio de ranking:
        // 1. Más victorias
        if (b.stats.won !== a.stats.won) {
          return b.stats.won - a.stats.won;
        }
        // 2. Menor récord de intentos
        const aBest = a.stats.bestAttempts ?? 9999;
        const bBest = b.stats.bestAttempts ?? 9999;
        if (aBest !== bBest) {
          return aBest - bBest;
        }
        // 3. Menor tiempo
        const aTime = a.stats.bestTimeSec ?? 999999;
        const bTime = b.stats.bestTimeSec ?? 999999;
        return aTime - bTime;
      });
  }

  function resetStats(userId) {
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.stats = {
        played: 0,
        won: 0,
        bestAttempts: null,
        bestTimeSec: null,
        totalAttempts: 0,
        totalFamas: 0,
        totalPuntos: 0
      };
      saveUsers(users);
    }
  }

  return {
    DEFAULT_AVATARS,
    loadUsers,
    saveUsers,
    getActiveUserId,
    setActiveUserId,
    getActiveUser,
    createUser,
    deleteUser,
    recordGameResult,
    getLeaderboard,
    resetStats
  };
});
