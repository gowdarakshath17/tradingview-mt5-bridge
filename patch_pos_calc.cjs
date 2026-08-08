const fs = require('fs');
let content = fs.readFileSync('src/components/PositionCalculator.tsx', 'utf8');
content = content.replace("import { useAuth } from '../hooks/useAuth';", "import { User } from 'firebase/auth';");
content = content.replace("interface PositionCalculatorProps {\n  config: BridgeConfig;\n}", "interface PositionCalculatorProps {\n  config: BridgeConfig;\n  user?: User | null;\n}");
content = content.replace("export default function PositionCalculator({ config }: PositionCalculatorProps) {\n  const [balance, setBalance] = useState<number>(10000);\n  const [isFetchingBalance, setIsFetchingBalance] = useState(false);\n  const { user } = useAuth();", "export default function PositionCalculator({ config, user }: PositionCalculatorProps) {\n  const [balance, setBalance] = useState<number>(10000);\n  const [isFetchingBalance, setIsFetchingBalance] = useState(false);");
fs.writeFileSync('src/components/PositionCalculator.tsx', content, 'utf8');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace('<PositionCalculator config={config} />', '<PositionCalculator config={config} user={user} />');
fs.writeFileSync('src/App.tsx', appContent, 'utf8');
