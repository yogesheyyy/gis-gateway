document.addEventListener("DOMContentLoaded", () => {
    
    // ================= 1. PAGE ROUTING LOGIC (RESTORED) =================
    const navLinks = document.querySelectorAll('.nav-link, .route-btn');
    const pages = document.querySelectorAll('.page-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetId = link.getAttribute('data-target');
            
            pages.forEach(page => page.classList.remove('active'));
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            
            document.getElementById(targetId).classList.add('active');
            
            if (link.classList.contains('nav-link')) {
                link.classList.add('active');
            } else {
                const targetNav = document.querySelector(`.nav-link[data-target="${targetId}"]`);
                if(targetNav) targetNav.classList.add('active');
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
        const hasTemperature = tminCheck.checked || tmaxCheck.checked;
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

    if(rainCheck) {
        rainCheck.addEventListener("input", updateYearDropdowns);
        tminCheck.addEventListener("input", updateYearDropdowns);
        tmaxCheck.addEventListener("input", updateYearDropdowns);
        updateYearDropdowns();
    }

    if(downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const startYear = parseInt(startYearSelect.value);
            const endYear = parseInt(endYearSelect.value);

            if (startYear > endYear) {
                alert("Error: Start Year cannot be greater than End Year.");
                return;
            }

            const selectedVars = [];
            if (rainCheck.checked) selectedVars.push("rain");
            if (tminCheck.checked) selectedVars.push("tmin");
            if (tmaxCheck.checked) selectedVars.push("tmax");

            if (selectedVars.length === 0) {
                alert("Error: Please select at least one variable to extract.");
                return;
            }

            const savePath = prompt("Enter the local folder path to save the NetCDF files:", "D:\\IMD_Data");
            if (!savePath) return;

            downloadBtn.disabled = true;
            progressSection.classList.remove("hidden");
            progressBar.style.width = "0%";
            percentageText.textContent = "0%";
            statusText.textContent = "Establishing secure connection...";

            const encodedPath = encodeURIComponent(savePath);
            const varsParam = selectedVars.join(","); 
            
            const hostIp = window.location.hostname;
            const url = `http://${hostIp}:5000/api/download?start_year=${startYear}&end_year=${endYear}&vars=${varsParam}&path=${encodedPath}`;
            
            const eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                statusText.textContent = data.message;
                progressBar.style.width = data.progress + "%";
                percentageText.textContent = data.progress + "%";

                if (data.progress === 0) {
                    alert(`Pipeline Error: ${data.message}`);
                    eventSource.close();
                    downloadBtn.disabled = false;
                }

                if (data.progress === 100) {
                    eventSource.close();
                    setTimeout(() => {
                        alert(`Extraction Complete! NetCDF files generated successfully in ${savePath}`);
                        downloadBtn.disabled = false;
                        progressSection.classList.add("hidden");
                        progressBar.style.width = "0%";
                    }, 800);
                }
            };

            eventSource.onerror = (err) => {
                console.error("EventSource failed:", err);
                statusText.textContent = "Connection lost. Is the backend running?";
                eventSource.close();
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
                alert("Mission Aborted: Please enter valid numerical coordinates for all four Bounding Box fields.");
                return;
            }

            if (minLon >= maxLon || minLat >= maxLat) {
                alert("Mission Aborted: Minimum coordinates must be strictly less than Maximum coordinates.");
                return;
            }

            const savePath = prompt("Enter the local folder path to save the DEM GeoTIFFs:", "D:\\GIS_Gateway_Data");
            if (!savePath) return;

            demDownloadBtn.disabled = true;
            demProgressSection.classList.remove("hidden");
            demProgressBar.style.width = "0%";
            demPercentageText.textContent = "0%";
            demStatusText.textContent = "Generating Anonymous Token & Searching Catalog...";

            const encodedPath = encodeURIComponent(savePath);
            const hostIp = window.location.hostname;
            const url = `http://${hostIp}:5000/api/dem?min_lon=${minLon}&min_lat=${minLat}&max_lon=${maxLon}&max_lat=${maxLat}&path=${encodedPath}`;
            
            const eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                demStatusText.textContent = data.message;
                demProgressBar.style.width = data.progress + "%";
                demPercentageText.textContent = data.progress + "%";

                if (data.progress === 0 && data.message.includes("Error")) {
                    alert(`Pipeline Error: ${data.message}`);
                    eventSource.close();
                    demDownloadBtn.disabled = false;
                }

                if (data.progress === 100) {
                    eventSource.close();
                    setTimeout(() => {
                        alert(`Extraction Complete! Copernicus DEM tiles generated successfully in ${savePath}`);
                        demDownloadBtn.disabled = false;
                        demProgressSection.classList.add("hidden");
                        demProgressBar.style.width = "0%";
                    }, 800);
                }
            };

            eventSource.onerror = (err) => {
                console.error("EventSource failed:", err);
                demStatusText.textContent = "Connection lost. Is the backend running?";
                eventSource.close();
                demDownloadBtn.disabled = false;
            };
        });
    }

    // ================= 4. SPATIAL NETWORK ANIMATION (RESPONSIVE TO THEME) =================
    const canvas = document.getElementById('spatial-network');
    
    if(canvas) {
        const ctx = canvas.getContext('2d');
        
        let particlesArray;
        let mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', function(event) {
            mouse.x = event.x;
            mouse.y = event.y;
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
            
            // Check theme dynamically
            const isLight = document.body.classList.contains('light-mode');
            const pColor = isLight ? '#0891b2' : '#06b6d4'; // Darker teal in light mode
            
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
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
                        
                        // Switch connecting lines to dark navy in light mode
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
            ctx.clearRect(0, 0, innerWidth, innerHeight);

            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
            connectNodes();
        }

        initNetwork();
        animateNetwork();
        
        // Expose initNetwork so the toggle button can trigger a re-draw
        window.updateNetworkTheme = () => {
            initNetwork();
        };
    }

    // ================= 5. CLICK-TO-EXPAND WIDGET LOGIC =================
    const widgetHeaders = document.querySelectorAll('.widget-header');
    
    widgetHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const drawer = header.closest('.clickable-drawer');
            
            document.querySelectorAll('.clickable-drawer.expanded').forEach(openDrawer => {
                if (openDrawer !== drawer) openDrawer.classList.remove('expanded');
            });

            drawer.classList.toggle('expanded');
        });
    });

    // ================= 6. INTERACTIVE MAP SELECTOR =================
    const mapElement = document.getElementById('demMap');
    
    if (mapElement) {
        const map = L.map('demMap').setView([20.5937, 78.9629], 5);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            draw: {
                polygon: false,
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
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

            const bounds = layer.getBounds();
            
            document.getElementById('minLon').value = bounds.getWest().toFixed(4);
            document.getElementById('minLat').value = bounds.getSouth().toFixed(4);
            document.getElementById('maxLon').value = bounds.getEast().toFixed(4);
            document.getElementById('maxLat').value = bounds.getNorth().toFixed(4);
        });

        const demDrawer = document.getElementById('demDownloadBtn').closest('.clickable-drawer');
        if (demDrawer) {
            demDrawer.addEventListener('click', () => {
                setTimeout(() => { map.invalidateSize(); }, 400); 
            });
        }
    }

    // ================= 7. LIGHT/DARK THEME TOGGLE =================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    
    // 1. Check LocalStorage on page load
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        if (sunIcon && moonIcon) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    // 2. Setup the Click Listener
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            
            // Swap icons and update storage
            if (document.body.classList.contains('light-mode')) {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
                localStorage.setItem('theme', 'light');
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
                localStorage.setItem('theme', 'dark');
            }
            
            // Trigger the background canvas to redraw with the new colors immediately
            if (typeof window.updateNetworkTheme === "function") {
                window.updateNetworkTheme();
            }
        });
    }
});