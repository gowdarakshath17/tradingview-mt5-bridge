import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { UserProfile } from '../types'; // Wait, UserProfile might not be in types.

export function useAdmin() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const setMockUsers = useCallback(() => {
    setUsersList([
      {
        uid: 'gowda_admin',
        email: 'gowdarakshath17@gmail.com',
        displayName: 'Gowda Rakshath (You)',
        firstName: 'Gowda',
        lastName: 'Rakshath',
        phoneNumber: '+91 98765 43210',
        photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=gowda',
        approved: true,
        maxAccounts: 10,
        isAdmin: true,
        createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString()
      },
      {
        uid: 'user_micheal',
        email: 'michael.algo@gmail.com',
        displayName: 'Michael K. Sterling',
        firstName: 'Michael',
        lastName: 'Sterling',
        phoneNumber: '+1 (555) 019-2834',
        photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=michael',
        approved: true,
        maxAccounts: 2,
        isAdmin: false,
        createdAt: new Date(Date.now() - 3600000 * 24 * 12).toISOString()
      },
      {
        uid: 'user_sara',
        email: 'sara.forex@outlook.com',
        displayName: 'Sara Jenkins',
        firstName: 'Sara',
        lastName: 'Jenkins',
        phoneNumber: '+44 20 7946 0958',
        photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=sara',
        approved: false,
        maxAccounts: 1,
        isAdmin: false,
        createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
      },
      {
        uid: 'user_dave',
        email: 'dave.trader@yahoo.com',
        displayName: 'Dave Thompson',
        firstName: 'Dave',
        lastName: 'Thompson',
        phoneNumber: '+1 (555) 042-9911',
        photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=dave',
        approved: false,
        maxAccounts: 1,
        isAdmin: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ]);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (db) {
        const usersRef = collection(db, 'users');
        const querySnap = await getDocs(usersRef);
        const loaded: any[] = [];
        querySnap.forEach((docSnap) => {
          loaded.push({ uid: docSnap.id, ...docSnap.data() });
        });

        if (loaded.length > 0) {
          loaded.sort((a, b) => {
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return (a.email || '').localeCompare(b.email || '');
          });
          setUsersList(loaded);
        } else {
          setMockUsers();
        }
      } else {
        setMockUsers();
      }
    } catch (err: any) {
      console.warn("Failed to retrieve live users from Firestore:", err);
      setErrorMsg("Operating in simulated directory mode. Database read skipped.");
      setMockUsers();
    } finally {
      setLoading(false);
    }
  }, [setMockUsers]);

  const updateApproval = async (uid: string, approveState: boolean) => {
    setUpdatingUid(uid);
    try {
      if (db) {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { approved: approveState });
      }
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, approved: approveState } : u));
      toast.success(approveState ? 'User approved' : 'User access revoked');
    } catch (err) {
      console.error("Firestore approval update failed:", err);
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, approved: approveState } : u));
      toast.error('Could not save to database, updated locally');
    } finally {
      setUpdatingUid(null);
    }
  };

  const updateMaxAccounts = async (uid: string, limitVal: number) => {
    if (limitVal < 1) return;
    setUpdatingUid(uid);
    try {
      if (db) {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { maxAccounts: limitVal });
      }
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, maxAccounts: limitVal } : u));
      toast.success(`Account limit updated to ${limitVal}`);
    } catch (err) {
      console.error("Firestore limit update failed:", err);
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, maxAccounts: limitVal } : u));
      toast.error('Could not save to database, updated locally');
    } finally {
      setUpdatingUid(null);
    }
  };

  const fetchUserData = async (uid: string) => {
    if (db) {
      try {
        // 1. Fetch Config
        const configRef = doc(db, 'users', uid, 'configs', 'bridgeConfig');
        const configSnap = await getDoc(configRef);
        const userConfig = configSnap.exists() ? configSnap.data() : null;

        // 2. Fetch Signals
        const signalsRef = collection(db, 'users', uid, 'signals');
        const signalsSnap = await getDocs(signalsRef);
        const userSignals: any[] = [];
        signalsSnap.forEach((docSnap) => {
          userSignals.push({ id: docSnap.id, ...docSnap.data() });
        });
        userSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // 3. Fetch Funded Accounts
        const accountsRef = collection(db, 'users', uid, 'funded_accounts');
        const accountsSnap = await getDocs(accountsRef);
        const userAccounts: any[] = [];
        accountsSnap.forEach((docSnap) => {
          userAccounts.push({ id: docSnap.id, ...docSnap.data() });
        });

        return {
          config: userConfig,
          signals: userSignals,
          fundedAccounts: userAccounts
        };
      } catch (err) {
        console.error("Error fetching user subdata for admin:", err);
        toast.error("Failed to fetch user data from Firestore");
      }
    }

    // Simulated fallback if db is not connected or fails
    const sampleSignals = [
      {
        id: "sig_mock_1",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: "BUY",
        symbol: "XAUUSD",
        price: 4045.50,
        sl: 4035.50,
        tp: 4065.50,
        lotSize: 0.1,
        source: "TradingView",
        status: "Executed",
        executedAt: new Date(Date.now() - 3600000 * 2 + 3000).toISOString(),
        executedPrice: 4045.65,
        executionDetails: "MT5 Order #554432",
        accountBalanceUsed: 25000.00
      },
      {
        id: "sig_mock_2",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        type: "SELL",
        symbol: "XAUUSD",
        price: 4060.00,
        sl: 4070.00,
        tp: 4040.00,
        lotSize: 0.1,
        source: "Simulator",
        status: "Failed",
        executionDetails: "Failed: Invalid Lot Size"
      }
    ];

    const sampleAccounts = [
      {
        id: 'acc_mock_1',
        propFirm: 'MyForexFunds',
        accountId: '554312',
        platform: 'MT5',
        accountSize: 50000,
        currentBalance: 51200,
        currentEquity: 51100,
        leverage: '1:50',
        dailyDrawdownLimitPercent: 5,
        maxDrawdownLimitPercent: 10,
        status: 'Authorized',
        authorizedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
        mt5Server: 'MFF-Demo',
        emergencyKillSwitch: false
      }
    ];

    const sampleConfigs = {
      passphrase: "mock_secret_phrase",
      riskPercent: 1.5,
      stopLossPoints: 12.0,
      takeProfitPoints: 24.0,
      contractSize: 100,
      lotSizingMode: "DynamicRisk",
      fixedLotSize: 0.2,
      dailyProfitGoal: 750,
      holdTillCounterDirection: true,
      dynamicTrailingStop: false
    };

    return {
      config: sampleConfigs,
      signals: sampleSignals,
      fundedAccounts: sampleAccounts
    };
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    usersList,
    loading,
    errorMsg,
    updatingUid,
    fetchUsers,
    updateApproval,
    updateMaxAccounts,
    fetchUserData
  };
}
