// DOM elements
const mainContent = document.getElementById('main-content');
const startExploringBtn = document.getElementById('start-exploring');
const cameraFeed = document.getElementById('camera-feed');
const canvas = document.getElementById('canvas');
const landmarkInfo = document.getElementById('landmark-info');
const factList = document.getElementById('fact-list');
const loadMoreBtn = document.getElementById('load-more-btn');
const placesList = document.getElementById('places-list');

// API keys and endpoints (Consider moving these to a secure backend)
const GOOGLE_API_KEY = 'AIzaSyA4Xo27wNyl5vJXm32137rlFa4VAcc7JJ4';
const VISION_API_ENDPOINT = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`;
const GEMINI_API_KEY = 'AIzaSyDPFQk3OacdkghR1ayiz0SE_MBfwuoXsgE';
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Global variables
let facts = [];
let currentFactIndex = 0;
let frameProcessing = false; // To throttle frame processing

// Navigation
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', handleNavigation);
});

function handleNavigation(e) {
    e.preventDefault();
    const targetId = e.target.getAttribute('href').slice(1);
    showSection(targetId);
}

function showSection(sectionId) {
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
}

startExploringBtn.addEventListener('click', () => {
    showSection('explore');
    startCamera();
});

// Camera Functions
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        cameraFeed.srcObject = stream;
        await cameraFeed.play();
        detectLandmarks();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Unable to access the camera. Please check permissions.');
    }
}

async function detectLandmarks() {
    const ctx = canvas.getContext('2d');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;

    async function processFrame() {
        if (frameProcessing) return; // Throttle API calls
        frameProcessing = true;

        try {
            ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            const base64Image = imageData.split(',')[1];

            const response = await fetch(VISION_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: base64Image },
                        features: [{ type: 'LANDMARK_DETECTION', maxResults: 1 }]
                    }]
                })
            });

            const data = await response.json();
            if (data.responses[0]?.landmarkAnnotations) {
                const landmark = data.responses[0].landmarkAnnotations[0];
                updateLandmarkInfo(landmark.description);
                getNearbyPlaces(landmark.locations[0]?.latLng);
            } else {
                console.log("No landmark detected or Vision API issue.");
            }
        } catch (error) {
            console.error('Error detecting landmarks:', error);
        } finally {
            frameProcessing = false;
            setTimeout(() => requestAnimationFrame(processFrame), 1000); // Throttle to 1 call per second
        }
    }

    processFrame();
}

// Landmark Info
async function updateLandmarkInfo(landmarkName) {
    landmarkInfo.querySelector('h2').textContent = landmarkName;
    facts = await getGeminiFacts(landmarkName);
    displayFactList();
}

async function getGeminiFacts(landmarkName) {
    const prompt = `Provide 10 concise and factual points about the landmark "${landmarkName}".`;

    try {
        const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            return ['Error fetching facts from Gemini.'];
        }

        return data.candidates[0]?.content?.parts[0]?.text?.split('\n') || ['No information available.'];
    } catch (error) {
        console.error('Error fetching facts from Gemini:', error);
        return ['Unable to fetch information.'];
    }
}

function displayFactList() {
    factList.innerHTML = '';
    facts.slice(0, 10).forEach(fact => {
        const factItem = document.createElement('li');
        factItem.textContent = fact.trim();
        factList.appendChild(factItem);
    });

    if (facts.length > 10) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
}

loadMoreBtn.addEventListener('click', loadMoreFacts);

function loadMoreFacts() {
    const currentFactCount = factList.children.length;
    const nextFacts = facts.slice(currentFactCount, currentFactCount + 10);

    nextFacts.forEach(fact => {
        const factItem = document.createElement('li');
        factItem.textContent = fact.trim();
        factList.appendChild(factItem);
    });

    if (factList.children.length >= facts.length) {
        loadMoreBtn.classList.add('hidden');
    }
}

// Nearby Places
function getNearbyPlaces(location) {
    if (!location) return;

    const service = new google.maps.places.PlacesService(document.createElement('div'));
    const request = {
        location: location,
        radius: '500',
        type: ['point_of_interest']
    };

    service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            updateNearbyPlacesList(results);
        } else {
            console.error('Error fetching nearby places:', status);
        }
    });
}

function updateNearbyPlacesList(places) {
    placesList.innerHTML = '';
    places.slice(0, 5).forEach(place => {
        const li = document.createElement('li');
        li.textContent = place.name;
        placesList.appendChild(li);
    });
}
