import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Global Error Handlers to prevent process exit
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const dataFile = path.join(__dirname, 'users.json');
const inventoryFile = path.join(__dirname, 'inventory.json');

app.use(cors());
app.use(express.json());

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Helper to read users
const readUsers = () => {
    try {
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
};

// Helper to write users
const writeUsers = (users) => {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error writing users file:', error);
    }
};

// Helper to read inventory
const readInventory = () => {
    try {
        if (!fs.existsSync(inventoryFile)) {
            const initial = { "SAR": 5, "UR": 5, "SR": 20, "AR or ACE": 10, "RRR": 10, "RR": 50, "C or U": 50, "프로모카드팩": 10, "꽝": 9999 };
            fs.writeFileSync(inventoryFile, JSON.stringify(initial, null, 2));
            return initial;
        }
        const data = fs.readFileSync(inventoryFile, 'utf8');
        return JSON.parse(data || '{}');
    } catch (error) {
        console.error('Error reading inventory file:', error);
        return {};
    }
};

// Helper to write inventory
const writeInventory = (inventory) => {
    try {
        fs.writeFileSync(inventoryFile, JSON.stringify(inventory, null, 2));
    } catch (error) {
        console.error('Error writing inventory file:', error);
    }
};

// Signup Route
app.post('/api/signup', (req, res) => {
    let { id, pw, name, contact, address } = req.body;
    if (!id || !pw || !name) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    id = id.trim().toLowerCase();
    const users = readUsers();
    if (users.find(u => u.id.toLowerCase() === id)) {
        return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
    }

    const newUser = { id, pw, name, contact, address, coins: 0, gachaHistory: [], createdAt: new Date().toISOString() };
    users.push(newUser);
    writeUsers(users);

    res.status(201).json({ message: '회원가입이 완료되었습니다.', user: { id: newUser.id, name: newUser.name, coins: newUser.coins } });
});

// Login Route
app.post('/api/login', (req, res) => {
    let { id, pw } = req.body;
    if (!id || !pw) return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });

    id = id.trim().toLowerCase();
    const users = readUsers();

    const user = users.find(u => u.id.toLowerCase() === id && u.pw === pw);
    if (!user) {
        return res.status(401).json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
    }

    // Omit password from response
    const { pw: _, ...safeUser } = user;
    res.status(200).json({ message: '로그인 성공', user: safeUser });
});

// Inventory Route
app.get('/api/inventory', (req, res) => {
    const inventory = readInventory();
    res.status(200).json(inventory);
});

// Gacha Result Route
app.post('/api/gacha', (req, res) => {
    const { id, gradeName } = req.body;
    if (!id || !gradeName) {
        return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }

    // Default existing users without coins to 0
    if (typeof users[userIndex].coins === 'undefined') {
        users[userIndex].coins = 0;
    }

    if (users[userIndex].coins <= 0) {
        return res.status(403).json({ error: '코인이 부족합니다.' });
    }

    users[userIndex].coins -= 1; // Deduct coin

    const rollRecord = { grade: gradeName, timestamp: new Date().toISOString() };
    users[userIndex].gachaHistory.push(rollRecord);

    // Deduct from inventory (except for '꽝')
    if (gradeName !== '꽝') {
        const inventory = readInventory();
        if (inventory[gradeName] > 0) {
            inventory[gradeName] -= 1;
            writeInventory(inventory);
        }
    }

    writeUsers(users);

    const { pw: _, ...safeUser } = users[userIndex];
    res.status(200).json({ message: '결과가 저장되었습니다.', user: safeUser });
});

// Get User Status (Coins)
app.get('/api/user/status/:id', (req, res) => {
    const { id } = req.params;
    const users = readUsers();
    const user = users.find(u => u.id.toLowerCase() === id.toLowerCase());

    if (!user) {
        return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }

    res.status(200).json({
        coins: user.coins || 0
    });
});

// Admin Add Coins Route
app.post('/api/admin/add-coins', (req, res) => {
    const { id, amount } = req.body;
    console.log(`Admin request to add ${amount} coins to user ${id}`);

    if (!id || !amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: '유효하지 않은 요청입니다. (id, amount 양수 필수)' });
    }

    const users = readUsers();
    const targetId = (id || "").trim().toLowerCase();
    const userIndex = users.findIndex(u => (u.id || "").toLowerCase() === targetId);

    if (userIndex === -1) {
        return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }

    // Initialize if it doesn't exist for older accounts
    if (typeof users[userIndex].coins === 'undefined') {
        users[userIndex].coins = 0;
    }

    users[userIndex].coins += parseInt(amount, 10);
    writeUsers(users);

    res.status(200).json({
        message: `${id} 유저에게 ${amount}코인이 충전되었습니다.`,
        coins: users[userIndex].coins
    });
});

// Admin Update Inventory Route
app.post('/api/admin/update-inventory', (req, res) => {
    const { inventory } = req.body; // Expects full inventory object
    if (!inventory) {
        return res.status(400).json({ error: '데이터가 없습니다.' });
    }
    writeInventory(inventory);
    res.status(200).json({ message: '재고 정보가 업데이트되었습니다.', inventory });
});

// All other requests serve the React app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
