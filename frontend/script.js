document.addEventListener("DOMContentLoaded", () => {
    
    // ================= 1. PAGE ROUTING LOGIC =================
    const navLinks = document.querySelectorAll('.nav-link, .route-btn');
    const pages = document.querySelectorAll('.page-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;
            
            pages.forEach(page => page.classList.remove('active'));
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            
            const targetPage = document.getElementById(targetId);
            if (targetPage) targetPage.classList.add('active');
            
            if (link.classList.contains('nav-link')) {
                link.classList.add('active');
            } else {
                const targetNav = document.querySelector(`.nav-link[data-target="${targetId}"]`);
                if (targetNav) targetNav.classList.add('active');
            }
        });
    });

    // ================= 2. IMD DOWNLOADER LOGIC =================
    const startYearSelect = document.getElementById("startYear");
    const endYearSelect = document.getElementById("endYear");
    const downloadBtn = document.getElementById("downloadBtn");
    const progressSection = document.getElementById("progressSection");
    const progressBar = document.getElementById("progressBar");
    const statusText = document.getElementById("statusText");
    const percentageText = document.getElementById("percentageText");

    const rainCheck = document.getElementById("var-rain");
    const tminCheck = document.getElementById("var-tmin");
    const tmaxCheck = document.getElementById("var-tmax");

    function updateYearDropdowns() {
        if (!startYearSelect || !endYearSelect) return;
        
        const hasTemperature = (tminCheck && tminCheck.checked) || (tmaxCheck && tmaxCheck.checked);
        const minYear = hasTemperature ? 1951 : 1901;

        let currentStart = parseInt(startYearSelect.value) || 2020;
        let currentEnd = parseInt(endYearSelect.value) || 2024;

        if (currentStart < minYear) currentStart = minYear;
        if (currentEnd < minYear) currentEnd = minYear;

        startYearSelect.innerHTML = "";
        endYearSelect.innerHTML = "";

        for (let year = minYear; year <= 2025; year++) {
            startYearSelect.add(new Option(year, year));
            endYearSelect.add(new Option(year, year));
        }

        startYearSelect.value = currentStart;
        endYearSelect.value = currentEnd;
    }

    if (rainCheck) rainCheck.addEventListener("input", updateYearDropdowns);
    if (tminCheck) tminCheck.addEventListener("input", updateYearDropdowns);
    if (tmaxCheck) tmaxCheck.addEventListener("input", updateYearDropdowns);

    // Dynamically refresh dropdown range the moment the user clicks or focuses on the year select fields
    if (startYearSelect) {
        startYearSelect.addEventListener("mousedown", updateYearDropdowns);
        startYearSelect.addEventListener("focus", updateYearDropdowns);
    }
    if (endYearSelect) {
        endYearSelect.addEventListener("mousedown", updateYearDropdowns);
        endYearSelect.addEventListener("focus", updateYearDropdowns);
    }
    updateYearDropdowns();

    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const startYear = parseInt(startYearSelect.value);
            const endYear = parseInt(endYearSelect.value);

            if (startYear > endYear) {
                alert("Error: Start Year cannot be greater than End Year.");
                return;
            }

            const selectedVars = [];
            if (rainCheck && rainCheck.checked) selectedVars.push("rain");
            if (tminCheck && tminCheck.checked) selectedVars.push("tmin");
            if (tmaxCheck && tmaxCheck.checked) selectedVars.push("tmax");

            if (selectedVars.length === 0) {
                alert("Error: Please select at least one variable to extract.");
                return;
            }

            const savePath = prompt("Enter the local folder path to save the NetCDF files:", "D:\\IMD_Data");
            if (!savePath) return;

            downloadBtn.disabled = true;
            if (progressSection) progressSection.classList.remove("hidden");
            if (progressBar) progressBar.style.width = "0%";
            if (percentageText) percentageText.textContent = "0%";
            if (statusText) statusText.textContent = "Establishing secure connection...";

            const encodedPath = encodeURIComponent(savePath);
            const varsParam = selectedVars.join(","); 
            
            const netcdfUrl = `/api/download?start_year=${startYear}&end_year=${endYear}&vars=${varsParam}&path=${encodedPath}`;
            const netcdfEventSource = new EventSource(netcdfUrl);

            netcdfEventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (statusText) statusText.textContent = data.message;
                if (progressBar) progressBar.style.width = data.progress + "%";
                if (percentageText) percentageText.textContent = data.progress + "%";

                if (data.progress === 0) {
                    alert(`Pipeline Error: ${data.message}`);
                    netcdfEventSource.close();
                    downloadBtn.disabled = false;
                }

                if (data.progress === 100) {
                    netcdfEventSource.close();
                    
                    if (data.download_url) {
                        window.location.href = data.download_url;
                    }

                    setTimeout(() => {
                        alert(`Extraction Complete! NetCDF files generated and downloaded successfully.`);
                        downloadBtn.disabled = false;
                        if (progressSection) progressSection.classList.add("hidden");
                        if (progressBar) progressBar.style.width = "0%";
                    }, 800);
                }
            };

            netcdfEventSource.onerror = (err) => {
                console.error("EventSource failed:", err);
                if (statusText) statusText.textContent = "Connection lost. Is the backend running?";
                netcdfEventSource.close();
                downloadBtn.disabled = false;
            };
        });
    }

    // ================= 3. COPERNICUS DEM DOWNLOADER LOGIC =================
    const demDownloadBtn = document.getElementById("demDownloadBtn");
    
    if (demDownloadBtn) {
        const demProgressSection = document.getElementById("demProgressSection");
        const demProgressBar = document.getElementById("demProgressBar");
        const demStatusText = document.getElementById("demStatusText");
        const demPercentageText = document.getElementById("demPercentageText");

        demDownloadBtn.addEventListener("click", () => {
            const minLon = parseFloat(document.getElementById("minLon").value);
            const minLat = parseFloat(document.getElementById("minLat").value);
            const maxLon = parseFloat(document.getElementById("maxLon").value);
            const maxLat = parseFloat(document.getElementById("maxLat").value);

            if (isNaN(minLon) || isNaN(minLat) || isNaN(maxLon) || isNaN(maxLat)) {
                alert("Mission Aborted: Please enter valid numerical coordinates for all fields.");
                return;
            }

            const savePath = prompt("Enter the local folder path to save the DEM GeoTIFFs:", "D:\\GIS_Gateway_Data");
            if (!savePath) return;

            demDownloadBtn.disabled = true;
            if (demProgressSection) demProgressSection.classList.remove("hidden");
            if (demProgressBar) demProgressBar.style.width = "0%";
            if (demPercentageText) demPercentageText.textContent = "0%";
            if (demStatusText) demStatusText.textContent = "Generating Anonymous Token & Searching Catalog...";

            const encodedPath = encodeURIComponent(savePath);
            const demUrl = `/api/dem?min_lon=${minLon}&min_lat=${minLat}&max_lon=${maxLon}&max_lat=${maxLat}&path=${encodedPath}`;
            const demEventSource = new EventSource(demUrl);
            
            demEventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (demStatusText) demStatusText.textContent = data.message;
                if (demProgressBar) demProgressBar.style.width = data.progress + "%";
                if (demPercentageText) demPercentageText.textContent = data.progress + "%";

                if (data.progress === 0 && data.message.includes("Error")) {
                    alert(`Pipeline Error: ${data.message}`);
                    demEventSource.close();
                    demDownloadBtn.disabled = false;
                }

                if (data.progress === 100) {
                    demEventSource.close();
                    
                    if (data.download_url) {
                        window.location.href = data.download_url;
                    }

                    setTimeout(() => {
                        alert(`Extraction Complete! Copernicus DEM tiles generated and downloaded successfully.`);
                        demDownloadBtn.disabled = false;
                        if (demProgressSection) demProgressSection.classList.add("hidden");
                        if (demProgressBar) demProgressBar.style.width = "0%";
                    }, 800);
                }
            };

            demEventSource.onerror = (err) => {
                console.error("EventSource failed:", err);
                if (demStatusText) demStatusText.textContent = "Connection lost. Is the backend running?";
                demEventSource.close();
                demDownloadBtn.disabled = false;
            };
        });
    }

    // ================= 3.1 SPATIAL EXTENT TYPE TOGGLE (POINT vs POLYGON/GEOJSON) =================
    const spatialRadios = document.querySelectorAll('input[name="extentType"], input[type="radio"]');
    const mapContainerWrapper = document.getElementById('demMap')?.closest('.study-area-container, .map-wrapper, div');

    spatialRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (mapContainerWrapper) {
                mapContainerWrapper.style.display = 'block'; 
            }
            
            if (window.demLeafletMap) {
                setTimeout(() => { window.demLeafletMap.invalidateSize(); }, 300);
            }
        });
    });

    // ================= 4. SPATIAL NETWORK ANIMATION =================
    const canvas = document.getElementById('spatial-network');
    
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particlesArray;
        let mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', function(event) {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        });

        function setupCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        setupCanvas();
        window.addEventListener('resize', setupCanvas);

        class Particle {
            constructor(x, y, directionX, directionY, size, color) {
                this.x = x;
                this.y = y;
                this.directionX = directionX;
                this.directionY = directionY;
                this.size = size;
                this.color = color;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
                if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;

                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    
                    this.x -= forceDirectionX * force * 3;
                    this.y -= forceDirectionY * force * 3;
                }

                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }

        function initNetwork() {
            particlesArray = [];
            let numberOfParticles = (canvas.height * canvas.width) / 12000;
            const isLight = document.body.classList.contains('light-mode');
            const pColor = isLight ? '#0891b2' : '#06b6d4';
            
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * ((window.innerWidth - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((window.innerHeight - size * 2) - (size * 2)) + size * 2);
                let directionX = (Math.random() * 1) - 0.5;
                let directionY = (Math.random() * 1) - 0.5;

                particlesArray.push(new Particle(x, y, directionX, directionY, size, pColor));
            }
        }

        function connectNodes() {
            let opacityValue = 1;
            const isLight = document.body.classList.contains('light-mode');
            
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                                 + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
                    
                    if (distance < (canvas.width / 10) * (canvas.height / 10)) {
                        opacityValue = 1 - (distance / 20000);
                        ctx.strokeStyle = isLight ? `rgba(15, 23, 42, ${opacityValue})` : `rgba(59, 130, 246, ${opacityValue})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                        ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                        ctx.stroke();
                    }
                }
            }
        }

        function animateNetwork() {
            requestAnimationFrame(animateNetwork);
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
            connectNodes();
        }

        initNetwork();
        animateNetwork();
        
        window.updateNetworkTheme = () => {
            initNetwork();
        };
    }

    // ================= 5. CLICK-TO-EXPAND WIDGET LOGIC =================
    const widgetHeaders = document.querySelectorAll('.widget-header');
    
    widgetHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const drawer = header.closest('.clickable-drawer');
            if (!drawer) return;
            
            document.querySelectorAll('.clickable-drawer.expanded').forEach(openDrawer => {
                if (openDrawer !== drawer) openDrawer.classList.remove('expanded');
            });

            drawer.classList.toggle('expanded');
        });
    });

    // ================= 6. INTERACTIVE MAP SELECTOR =================
    const mapElement = document.getElementById('demMap');
    
    if (mapElement && typeof L !== 'undefined') {
        const map = L.map('demMap').setView([20.5937, 78.9629], 5);
        window.demLeafletMap = map;
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            draw: {
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: {
                    shapeOptions: {
                        color: '#06b6d4'
                    }
                },
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#06b6d4',
                        weight: 2,
                        fillOpacity: 0.2
                    }
                },
                rectangle: {
                    shapeOptions: {
                        color: '#06b6d4', 
                        weight: 2,
                        fillOpacity: 0.2
                    }
                }
            },
            edit: {
                featureGroup: drawnItems
            }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, function (e) {
            drawnItems.clearLayers(); 
            const layer = e.layer;
            drawnItems.addLayer(layer);

            const minLonEl = document.getElementById('minLon');
            const minLatEl = document.getElementById('minLat');
            const maxLonEl = document.getElementById('maxLon');
            const maxLatEl = document.getElementById('maxLat');

            if (e.layerType === 'marker') {
                const latlng = layer.getLatLng();
                if (minLonEl) minLonEl.value = latlng.lng.toFixed(4);
                if (minLatEl) minLatEl.value = latlng.lat.toFixed(4);
                if (maxLonEl) maxLonEl.value = latlng.lng.toFixed(4);
                if (maxLatEl) maxLatEl.value = latlng.lat.toFixed(4);
            } else {
                const bounds = layer.getBounds();
                if (minLonEl) minLonEl.value = bounds.getWest().toFixed(4);
                if (minLatEl) minLatEl.value = bounds.getSouth().toFixed(4);
                if (maxLonEl) maxLonEl.value = bounds.getEast().toFixed(4);
                if (maxLatEl) maxLatEl.value = bounds.getNorth().toFixed(4);
            }
        });

        const demDownloadBtnEl = document.getElementById('demDownloadBtn');
        if (demDownloadBtnEl) {
            const demDrawer = demDownloadBtnEl.closest('.clickable-drawer');
            if (demDrawer) {
                demDrawer.addEventListener('click', () => {
                    setTimeout(() => { map.invalidateSize(); }, 400); 
                });
            }
        }
    }

    // ================= 7. LIGHT/DARK THEME TOGGLE =================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        if (sunIcon && moonIcon) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            
            if (document.body.classList.contains('light-mode')) {
                if (sunIcon) sunIcon.style.display = 'none';
                if (moonIcon) moonIcon.style.display = 'block';
                localStorage.setItem('theme', 'light');
            } else {
                if (sunIcon) sunIcon.style.display = 'block';
                if (moonIcon) moonIcon.style.display = 'none';
                localStorage.setItem('theme', 'dark');
            }
            
            if (typeof window.updateNetworkTheme === "function") {
                window.updateNetworkTheme();
            }
        });
    }

    // ================= 8. CONTACT FORM & ENVELOPE ANIMATION =================
    const contactForm = document.getElementById("contactForm");
    const envelopeOverlay = document.getElementById("envelopeOverlay");
    const successMessage = document.getElementById("successMessage");

    if (contactForm) {
        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("contactName").value;
            const email = document.getElementById("contactEmail").value;
            const message = document.getElementById("contactMessage").value;

            if (envelopeOverlay) envelopeOverlay.classList.add("active");

            try {
                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message })
                });

                const result = await response.json();

                setTimeout(() => {
                    if (envelopeOverlay) envelopeOverlay.classList.remove("active");
                    
                    if (result.success) {
                        if (successMessage) successMessage.classList.add("active");
                        contactForm.reset();
                    } else {
                        alert("Failed to send message: " + (result.message || "Unknown error"));
                    }
                }, 2500);

            } catch (err) {
                console.error("Network or Server error:", err);
                if (envelopeOverlay) envelopeOverlay.classList.remove("active");
                alert("An error occurred while sending your message. Please check your network connection.");
            }
        });
    }
});

// ================= GLOBAL HELPER FUNCTIONS =================
function resetContactForm() {
    const successMessage = document.getElementById("successMessage");
    if (successMessage) {
        successMessage.classList.remove("active");
    }
}

function copyUpiId() {
    const upiElement = document.getElementById('upiText');
    if (!upiElement) return;
    
    navigator.clipboard.writeText(upiElement.textContent).then(() => {
        alert("UPI ID copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function confirmPayment() {
    const modal = document.getElementById('donationModal');
    if (modal) modal.style.display = 'flex';
}

function skipDonationDetails() {
    const modal = document.getElementById('donationModal');
    if (modal) modal.style.display = 'none';
    triggerSuccessAnimation();
}

async function submitDonationDetails(event) {
    event.preventDefault();
    const nameEl = document.getElementById('donorName');
    const emailEl = document.getElementById('donorEmail');
    
    const name = nameEl ? nameEl.value || "Supporter" : "Supporter";
    const email = emailEl ? emailEl.value : "";

    const modal = document.getElementById('donationModal');
    if (modal) modal.style.display = 'none';

    if (email) {
        try {
            await fetch('/api/log-donor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });
        } catch (err) {
            console.log("Could not reach backend log route", err);
        }
    }

    triggerSuccessAnimation();
}

function triggerSuccessAnimation() {
    const btn = document.getElementById('paidBtn');
    const btnText = document.getElementById('btnText');
    const checkmarkAnim = document.getElementById('checkmarkAnim');
    const successNote = document.getElementById('successNote');

    if (btnText) btnText.style.display = 'none';
    if (checkmarkAnim) checkmarkAnim.style.display = 'inline-block';
    if (btn) btn.classList.add('success-state');
    if (successNote) successNote.style.display = 'block';
}