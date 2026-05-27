import fs from 'fs';
import path from 'path';

// Interfaces do Modelo de Dados
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  houseId: string | null;
  passwordHash: string; // Guardado apenas no backend
  sessionToken?: string; // Token de sessão ativo
}

export interface Expense {
  id: string;
  userId: string;
  userName: string;
  description: string;
  value: number;
  quantity: number;
  type: 'comida' | 'higiene' | 'utilitários' | 'outros';
  date: string;
}

export interface Transaction {
  fromUser: string;
  fromUserName: string;
  toUser: string;
  toUserName: string;
  amount: number;
}

export interface MonthlyHistory {
  id: string;
  year: number;
  month: number;
  expenses: Expense[];
  totalSpent: number;
  sharePerPerson: number;
  transactions: Transaction[];
}

export interface House {
  id: string;
  name: string;
  code: string;
  adminId: string;
  residents: string[]; // Array de IDs de usuários
  currentExpenses: Expense[];
  history: MonthlyHistory[];
}

export interface DatabaseSchema {
  users: Record<string, User>;
  houses: Record<string, House>;
}

const DB_FILE_PATH = path.join(process.cwd(), 'src/data/db.json');

// Função de leitura atômica/síncrona para simplificar concorrência no node
export function readDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      // Cria o diretório se não existir
      fs.mkdirSync(path.dirname(DB_FILE_PATH), { recursive: true });
      const initialDB: DatabaseSchema = { users: {}, houses: {} };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDB, null, 2), 'utf-8');
      return initialDB;
    }
    const rawData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(rawData) as DatabaseSchema;
  } catch (error) {
    console.error('Erro ao ler banco de dados JSON:', error);
    return { users: {}, houses: {} };
  }
}

// Função de escrita atômica/síncrona
export function writeDB(data: DatabaseSchema): void {
  try {
    fs.mkdirSync(path.dirname(DB_FILE_PATH), { recursive: true });
    // Escreve primeiro num arquivo temporário e depois renomeia para evitar corrupção de arquivos
    const tempPath = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (error) {
    console.error('Erro ao salvar banco de dados JSON:', error);
  }
}
