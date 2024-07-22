const express = require('express');
const axios = require('axios');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const PORT = 3000;
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY_HERE';

app.use(express.static('public'));
app.use(express.json());

const fetchPlaceDetails = async (placeId) => {
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(apiUrl);
    return response.data.result;
};

const fetchPlaces = async (apiUrl, results = []) => {
    try {
        const response = await axios.get(apiUrl);
        const places = response.data.results;

        for (const place of places) {
            const details = await fetchPlaceDetails(place.place_id);
            results.push({
                name: place.name,
                address: place.formatted_address,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                logo: details.icon,
                description: details.editorial_summary ? details.editorial_summary.overview : '',
                opening_hours: details.opening_hours ? details.opening_hours.weekday_text.join(', ') : '',
                category: details.types ? details.types.join(', ') : ''
            });
        }

        if (response.data.next_page_token) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const nextApiUrl = `${apiUrl}&pagetoken=${response.data.next_page_token}`;
            return fetchPlaces(nextApiUrl, results);
        } else {
            return results;
        }
    } catch (error) {
        throw new Error('Failed to fetch places');
    }
};

app.post('/search', async (req, res) => {
    const { query, location, radius } = req.body;
    const apiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${location}&radius=${radius}&key=${GOOGLE_API_KEY}`;
    
    try {
        const places = await fetchPlaces(apiUrl);
        res.json(places);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/export', async (req, res) => {
    const places = req.body;
    const csvWriter = createObjectCsvWriter({
        path: 'places.csv',
        header: [
            { id: 'name', title: 'Name' },
            { id: 'address', title: 'Address' },
            { id: 'rating', title: 'Rating' },
            { id: 'user_ratings_total', title: 'User Ratings Total' },
            { id: 'logo', title: 'Logo' },
            { id: 'description', title: 'Description' },
            { id: 'opening_hours', title: 'Opening Hours' },
            { id: 'category', title: 'Category' }
        ]
    });

    await csvWriter.writeRecords(places);
    res.download('places.csv');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
