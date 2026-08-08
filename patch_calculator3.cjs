const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');

const importStr = `import { BridgeConfig } from '../types';`;
const newImportStr = `import { BridgeConfig } from '../types';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';`;

content = content.replace(importStr, newImportStr);

const stateStr = `  const [balance, setBalance] = useState<number>(10000);`;
const newStateStr = `  const [balance, setBalance] = useState<number>(10000);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchFundedBalance = async () => {
      if (!user) return;
      setIsFetchingBalance(true);
      try {
        const collRef = collection(db, \`users/\${user.uid}/funded_accounts\`);
        const snapshot = await getDocs(collRef);
        if (!snapshot.empty) {
          // Find the first active or highest balance account
          const accounts = snapshot.docs.map(d => d.data());
          const activeAccounts = accounts.filter(a => a.status === 'Active');
          const targetAccount = activeAccounts.length > 0 ? activeAccounts[0] : accounts[0];
          
          if (targetAccount && targetAccount.currentBalance) {
            setBalance(targetAccount.currentBalance);
          } else if (targetAccount && targetAccount.accountSize) {
            setBalance(targetAccount.accountSize);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch funded accounts for calculator:", err);
      } finally {
        setIsFetchingBalance(false);
      }
    };
    
    fetchFundedBalance();
  }, [user]);`;

content = content.replace(stateStr, newStateStr);
fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');
