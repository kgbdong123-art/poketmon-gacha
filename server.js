import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

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
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
    next();
});

app.use(express.static(path.join(__dirname, 'dist')));

// MongoDB Connection
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB Atlas'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('WARNING: MONGODB_URI is not defined. Database features will not work.');
}

// User Schema
const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, lowercase: true, trim: true },
    pw: { type: String, required: true },
    name: { type: String, required: true },
    contact: String,
    address: String,
    coins: { type: Number, default: 0 },
    gachaHistory: [{
        grade: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Inventory Schema
const inventorySchema = new mongoose.Schema({
    key: { type: String, default: 'global' },
    counts: {
        type: Map,
        of: Number,
        default: {
            "SAR": 5, "UR": 5, "SR": 20, "AR or ACE": 10, "RRR": 10, "RR": 50, "C or U": 50, "프로모카드팩": 10, "꽝": 9999
        }
    }
});

const Inventory = mongoose.model('Inventory', inventorySchema);

// Helper to ensure inventory exists
const getInventory = async () => {
    let inv = await Inventory.findOne({ key: 'global' });
    if (!inv) {
        inv = new Inventory({ key: 'global' });
        await inv.save();
    }
    return inv;
};

// Signup Route
app.post('/api/signup', async (req, res) => {
    let { id, pw, name, contact, address } = req.body;
    if (!id || !pw || !name) {
        console.warn('Signup attempt failed: Missing required fields');
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    const normalizedId = id.trim().toLowerCase();
    try {
        const existingUser = await User.findOne({ id: normalizedId });
        if (existingUser) {
            console.warn(`Signup attempt failed: ID already exists (${normalizedId})`);
            return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
        }

        const newUser = new User({ id: normalizedId, pw, name, contact, address });
        await newUser.save();

        console.log(`User signed up successfully: ${normalizedId}`);
        res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            user: { id: newUser.id, name: newUser.name, coins: newUser.coins }
        });
    } catch (error) {
        console.error('CRITICAL: Signup error:', error);
        res.status(500).json({ error: '회원가입 중 서버 오류가 발생했습니다.' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    let { id, pw } = req.body;

    // Type check to prevent .trim() crashes
    if (typeof id !== 'string' || typeof pw !== 'string') {
        console.warn('Login attempt failed: Invalid input types', { idType: typeof id, pwType: typeof pw });
        return res.status(400).json({ error: '아이디와 비밀번호는 문자열이어야 합니다.' });
    }

    if (!id.trim() || !pw) {
        console.warn('Login attempt failed: Empty ID or PW');
        return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const normalizedId = id.trim().toLowerCase();
    console.log(`Login attempt for ID: ${normalizedId}`);

    try {
        // Check DB connection state
        if (mongoose.connection.readyState !== 1) {
            console.error('Database is not connected. Current state:', mongoose.connection.readyState);
            return res.status(503).json({ error: '데이터베이스 연결이 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해주세요.' });
        }

        const user = await User.findOne({ id: normalizedId, pw });
        if (!user) {
            console.warn(`Login failed for ID: ${normalizedId} (Invalid credentials)`);
            return res.status(401).json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        console.log(`Login successful for ID: ${normalizedId}`);
        const safeUser = user.toObject();
        delete safeUser.pw;
        res.status(200).json({ message: '로그인 성공', user: safeUser });
    } catch (error) {
        console.error(`CRITICAL: Login error for ID ${normalizedId || 'unknown'}:`, error);
        res.status(500).json({ error: '로그인 중 서버 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.' });
    }
});

// Inventory Route
app.get('/api/inventory', async (req, res) => {
    try {
        console.log('GET /api/inventory request received');
        const inv = await getInventory();
        console.log('Inventory data fetched successfully');
        res.status(200).json(inv.counts);
    } catch (error) {
        console.error('CRITICAL ERROR: GET /api/inventory failed:', error);
        res.status(500).json({ error: '재고 조회 중 오류가 발생했습니다.' });
    }
});

// Gacha Result Route
app.post('/api/gacha', async (req, res) => {
    const { id, gradeName } = req.body;
    if (!id || !gradeName) {
        return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    try {
        const user = await User.findOne({ id: id.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
        }

        if (user.coins <= 0) {
            return res.status(403).json({ error: '코인이 부족합니다.' });
        }

        user.coins -= 1;
        user.gachaHistory.push({ grade: gradeName });

        // Deduct from inventory (except for '꽝')
        if (gradeName !== '꽝') {
            const inv = await getInventory();
            const currentCount = inv.counts.get(gradeName) || 0;
            if (currentCount > 0) {
                inv.counts.set(gradeName, currentCount - 1);
                await inv.save();
            }
        }

        await user.save();

        const safeUser = user.toObject();
        delete safeUser.pw;
        res.status(200).json({ message: '결과가 저장되었습니다.', user: safeUser });
    } catch (error) {
        res.status(500).json({ error: '가챠 처리 중 서버 오류가 발생했습니다.' });
    }
});

// Get User Status (Coins)
app.get('/api/user/status/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`GET /api/user/status/${id} request received`);
        const user = await User.findOne({ id: id.toLowerCase() });
        if (!user) {
            console.warn(`User status check failed: User not found (${id})`);
            return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
        }
        res.status(200).json({ coins: user.coins || 0 });
    } catch (error) {
        console.error(`CRITICAL ERROR: GET /api/user/status/${id} failed:`, error);
        res.status(500).json({ error: '상태 조회 중 오류가 발생했습니다.' });
    }
});
// Admin Get All Users Route
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({}, { pw: 0 }); // 비밀번호 제외
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: '유저 목록 조회 중 오류가 발생했습니다.' });
    }
});


// Admin Add Coins Route
app.post('/api/admin/add-coins', async (req, res) => {
    const { id, amount } = req.body;
    if (!id || !amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: '유효하지 않은 요청입니다.' });
    }

    try {
        const user = await User.findOne({ id: id.trim().toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
        }

        user.coins += parseInt(amount, 10);
        await user.save();

        res.status(200).json({
            message: `${id} 유저에게 ${amount}코인이 충전되었습니다.`,
            coins: user.coins
        });
    } catch (error) {
        res.status(500).json({ error: '코인 충전 중 오류가 발생했습니다.' });
    }
});

// Admin Update Inventory Route
app.post('/api/admin/update-inventory', async (req, res) => {
    const { inventory } = req.body;
    if (!inventory) {
        return res.status(400).json({ error: '데이터가 없습니다.' });
    }

    try {
        const inv = await getInventory();
        inv.counts = inventory;
        await inv.save();
        res.status(200).json({ message: '재고 정보가 업데이트되었습니다.', inventory: inv.counts });
    } catch (error) {
        res.status(500).json({ error: '재고 업데이트 중 오류가 발생했습니다.' });
    }
});

// All other requests serve the React app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

