// server.js
// Ensure your .env file has variables named GOOGLE_MAPS_API_KEY and GEMINI_API_KEY
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { Client } = require("@googlemaps/google-maps-services-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret for JWTs (store this securely in .env in a real app!)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforpublicgardenapp2025';

// Admin secret code (for registration)
const ADMIN_SECRET_CODE = '202507';

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Successfully connected to MongoDB Atlas! ✅"))
  .catch(err => console.error("Error connecting to MongoDB:", err));

// --- Mongoose Schemas ---

const gardenSchema = new mongoose.Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    customName: { type: String, default: '' },
    city: { type: String, default: 'Unknown' },
    address: { type: String, default: 'Address not found' },
    hasWaterTap: { type: Boolean, default: false },
    hasSlide: { type: Boolean, default: false },
    hasCarrousel: { type: Boolean, default: false },
    hasSwings: { type: Boolean, default: false },
    hasSpringHorse: { type: Boolean, default: false },
    hasPublicBooksShelf: { type: Boolean, default: false },
    hasPingPongTable: { type: Boolean, default: false },
    hasPublicGym: { type: Boolean, default: false },
    hasBasketballField: { type: Boolean, default: false },
    hasFootballField: { type: Boolean, default: false },
    hasSpaceForDogs: { type: Boolean, default: false },
    kidsCount: { type: Number, default: 0 },
    kidsCountLastUpdated: { type: Date }
});

const Garden = mongoose.model('Garden', gardenSchema);

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: true }
});

const Admin = mongoose.model('Admin', adminSchema);

const filterClickSchema = new mongoose.Schema({
    filterName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const FilterClick = mongoose.model('FilterClick', filterClickSchema);

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) return res.status(401).json({ message: 'Authentication token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// --- API Routes ---

app.get('/api/config', (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/config - Request for API key received.`);
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
});

app.get('/api/gardens', async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/gardens - Fetching all gardens.`);
    try {
        const gardens = await Garden.find();
        res.json(gardens);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching gardens', error });
    }
});

app.get('/api/gardens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[${new Date().toISOString()}] GET /api/gardens/${id} - Fetching single garden.`);
        const garden = await Garden.findById(id);
        if (!garden) {
            return res.status(404).json({ message: 'Garden not found' });
        }
        res.json(garden);
    } catch (error) {
        console.error(`Error fetching garden ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching garden', error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, secretCode } = req.body;
    console.log(`[${new Date().toISOString()}] POST /api/auth/register - Attempting admin registration for: ${email}`);

    if (secretCode !== ADMIN_SECRET_CODE) {
        return res.status(403).json({ message: 'Invalid secret code' });
    }
    try {
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(409).json({ message: 'Admin with this email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({ name, email, password: hashedPassword });
        await newAdmin.save();
        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error("Error during admin registration:", error);
        res.status(500).json({ message: 'Error registering admin', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[${new Date().toISOString()}] POST /api/auth/login - Attempting admin login for: ${email}`);
    try {
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: admin._id, email: admin.email, isAdmin: true }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token, isAdmin: true });
    } catch (error) {
        console.error("Error during admin login:", error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
});

app.get('/api/auth/check-admin', authenticateToken, (req, res) => {
    res.json({ isAdmin: req.user.isAdmin, email: req.user.email });
});

app.put('/api/gardens/:id/kidscount', async (req, res) => {
    const { id } = req.params;
    const { kidsCount } = req.body;

    if (typeof kidsCount === 'undefined' || kidsCount < 0) {
        return res.status(400).json({ message: 'Invalid kidsCount value provided. Must be a non-negative number.' });
    }
    console.log(`[${new Date().toISOString()}] PUT /api/gardens/${id}/kidscount - Updating kidsCount to: ${kidsCount}`);
    try {
        const updatedGarden = await Garden.findByIdAndUpdate(
            id,
            { $set: { kidsCount: kidsCount, kidsCountLastUpdated: new Date() } },
            { new: true, runValidators: true }
        );
        if (!updatedGarden) {
            return res.status(404).json({ message: 'Garden not found' });
        }
        res.json({ message: 'Kids count updated successfully', garden: updatedGarden });
    } catch (error) {
        console.error(`Error updating kids count for garden ${id}:`, error);
        res.status(500).json({ message: 'Error updating kids count', error: error.message });
    }
});

app.post('/api/gardens', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/gardens - Attempting to add new garden.`);
    const {
        latitude, longitude, customName, hasWaterTap, hasSlide, hasCarrousel,
        hasSwings, hasSpringHorse, hasPublicBooksShelf, hasPingPongTable,
        hasPublicGym, hasBasketballField, hasFootballField, hasSpaceForDogs, kidsCount
    } = req.body;

    const mapsClient = new Client({});
    let cityName = 'Unknown';
    let fullAddress = 'Address not found';

    try {
        const geoResponse = await mapsClient.reverseGeocode({
            params: {
                latlng: { latitude, longitude },
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
        if (geoResponse.data.results.length > 0) {
            fullAddress = geoResponse.data.results[0].formatted_address;
            for (const component of geoResponse.data.results[0].address_components) {
                if (component.types.includes('locality')) {
                    cityName = component.long_name;
                    break;
                }
            }
        }
    } catch (e) {
        console.error("Reverse geocoding failed:", e.response ? e.response.data.error_message : e.message);
    }

    const newGardenData = {
        latitude, longitude, customName, city: cityName, address: fullAddress,
        hasWaterTap, hasSlide, hasCarrousel, hasSwings, hasSpringHorse,
        hasPublicBooksShelf, hasPingPongTable, hasPublicGym, hasBasketballField,
        hasFootballField, hasSpaceForDogs, kidsCount, kidsCountLastUpdated: new Date()
    };

    try {
        const newGarden = new Garden(newGardenData);
        await newGarden.save();
        console.log(`[${new Date().toISOString()}] Successfully added garden: ${newGarden._id} in ${cityName}`);
        res.status(201).json(newGarden);
    } catch (error) {
        res.status(500).json({ message: 'Error adding garden', error });
    }
});

app.put('/api/gardens/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updateFields = { ...req.body, kidsCountLastUpdated: new Date() };

    // Filter out undefined values to only update what's provided
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);
    
    console.log(`[${new Date().toISOString()}] PUT /api/gardens/${id} - Updating garden by admin: ${req.user.email}`);
    try {
        const updatedGarden = await Garden.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
        if (!updatedGarden) {
            return res.status(404).json({ message: 'Garden not found' });
        }
        res.json(updatedGarden);
    } catch (error) {
        console.error(`Error updating garden ${id}:`, error);
        res.status(500).json({ message: 'Error updating garden', error });
    }
});

app.delete('/api/gardens/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    console.log(`[${new Date().toISOString()}] DELETE /api/gardens/${id} - Deleting garden by admin: ${req.user.email}`);
    try {
        const deletedGarden = await Garden.findByIdAndDelete(id);
        if (!deletedGarden) {
            return res.status(404).json({ message: 'Garden not found' });
        }
        res.json({ message: 'Garden deleted successfully', deletedGardenId: id });
    } catch (error) {
        console.error(`Error deleting garden ${id}:`, error);
        res.status(500).json({ message: 'Error deleting garden', error: error.message });
    }
});

// --- ⭐️ START: MODIFIED GEMINI API ENDPOINT ⭐️ ---
// This route now expects a prompt for an animation script and returns clean JSON.
app.post('/api/gemini-insight', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }

    console.log(`[${new Date().toISOString()}] POST /api/gemini-insight - Received prompt for Gemini animation.`);

    try {
        // Using a more recent model suitable for JSON output
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;

        let text = response.text();

        // Clean the response to ensure it's valid JSON
        // Gemini might wrap the JSON in ```json ... ``` or just ```...```
        const jsonMatch = text.match(/```(json\s*)?([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[2]) {
            text = jsonMatch[2];
        }

        // Attempt to parse to ensure it's valid before sending
        const animationScript = JSON.parse(text);

        console.log(`[${new Date().toISOString()}] Gemini API animation script generated successfully.`);
        res.json({ animationScript }); // Send the parsed script to the client

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error calling Gemini API or parsing JSON:`, error);
        res.status(500).json({ message: 'Error generating animation script from Gemini API', error: error.message });
    }
});
// --- ⭐️ END: MODIFIED GEMINI API ENDPOINT ⭐️ ---

app.post('/api/stats/filter-click', async (req, res) => {
    const { filterName } = req.body;
    if (!filterName) {
        return res.status(400).json({ message: 'Filter name is required.' });
    }
    try {
        const newClick = new FilterClick({ filterName });
        await newClick.save();
        res.status(201).json({ message: 'Click logged successfully.' });
    } catch (error) {
        console.error("Error logging filter click:", error);
        res.status(500).json({ message: 'Error logging click', error });
    }
});

app.get('/api/stats/filter-clicks', async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/stats/filter-clicks - Fetching stats.`);
    try {
        const now = new Date();
        const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const dailyStats = await FilterClick.aggregate([
            { $match: { createdAt: { $gte: lastDay } } },
            { $group: { _id: '$filterName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const weeklyStats = await FilterClick.aggregate([
            { $match: { createdAt: { $gte: lastWeek } } },
            { $group: { _id: '$filterName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const monthlyStats = await FilterClick.aggregate([
            { $match: { createdAt: { $gte: lastMonth } } },
            { $group: { _id: '$filterName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            lastDay: dailyStats,
            lastWeek: weeklyStats,
            lastMonth: monthlyStats
        });

    } catch (error) {
        console.error("Error fetching filter stats:", error);
        res.status(500).json({ message: 'Error fetching filter stats', error });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT} ✅`);
});