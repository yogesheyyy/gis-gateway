document.addEventListener("DOMContentLoaded", () => {

    // ================= 1. TAB / SECTION ROUTING =================
    const navLinks = document.querySelectorAll('.nav-link, .route-btn');
    const pages = document.querySelectorAll('.page-section');

    function activateSection(targetId) {
        const targetPage = document.getElementById(targetId);
        if (!targetPage) return;

        pages.forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));

        targetPage.classList.add('active');
        const activeNav = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if (activeNav) activeNav.classList.add('active');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;
            e.preventDefault();
            window.location.hash = targetId;
            activateSection(targetId);
        });
    });

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(initialHash)) {
        activateSection(initialHash);
    }

    // ================= 2. SPATIAL NETWORK ANIMATION =================
    const canvas = document.getElementById('spatial-network');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particlesArray;
        let mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('mousemove', (event) => {
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
            const isLight = document.body.classList.contains('light-mode');
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    let distance = ((particlesArray[a].x - particlesArray[b].x) ** 2)
                                 + ((particlesArray[a].y - particlesArray[b].y) ** 2);
                    if (distance < (canvas.width / 10) * (canvas.height / 10)) {
                        let opacityValue = 1 - (distance / 20000);
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
        window.updateNetworkTheme = () => initNetwork();
    }

    // ================= 3. LIGHT/DARK THEME TOGGLE =================
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

    // ================= 4. STATIC CONTACT FORM =================
    const contactForm = document.getElementById("contactForm");
    if (contactForm) {
        contactForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("Thanks for reaching out! Your message has been noted.");
            contactForm.reset();
        });
    }

    // Initialize Q & A Board
    renderQaThreads();
});

// ================= 5. FLASHCARD CATEGORY FILTER =================
function filterFlashcards(category, activeBtn) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.flashcard').forEach(card => {
        const cardCategories = card.getAttribute('data-category') || '';
        if (category === 'all' || cardCategories.includes(category)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ================= 6. TUTORIAL VIDEO SEARCH =================
function filterTutorials() {
    const inputEl = document.getElementById('tutorialSearchInput');
    const query = (inputEl ? inputEl.value : '').trim().toLowerCase();
    const cards = document.querySelectorAll('.tutorial-card');

    cards.forEach(card => {
        const textContent = (card.textContent || '').toLowerCase();
        const searchMeta = (card.getAttribute('data-search') || '').toLowerCase();
        if (!query || textContent.includes(query) || searchMeta.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ================= 7. INTERACTIVE COMMUNITY Q & A =================
const QA_FIREBASE_URL = "https://gis-gateway-qa-default-rtdb.asia-southeast1.firebasedatabase.app/"; // Replace with your Firebase Realtime Database URL so all visitors share posts
const QA_LOCAL_KEY = "gis_gateway_qa_threads_v1";

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getDefaultThreads() {
    return {
        "welcome_thread": {
            username: "GIS_Gateway_Admin",
            message: "Welcome to the GIS Gateway Q & A board! Post a question or comment above, or click Reply below to answer anyone's question.",
            timestamp: "Pinned • Community Forum",
            createdAt: 1,
            replies: {
                "welcome_reply_1": {
                    username: "Spatial_User",
                    message: "Great setup—anyone can post a question or reply here with just a username and message.",
                    timestamp: "Community Member",
                    createdAt: 2
                }
            }
        }
    };
}

async function fetchQaThreads() {
    const isConfigured = QA_FIREBASE_URL && !QA_FIREBASE_URL.includes("YOUR_FIREBASE_DB_URL");
    if (isConfigured) {
        try {
            const res = await fetch(`${QA_FIREBASE_URL}/qa_threads.json`);
            if (res.ok) {
                const data = await res.json();
                return data || getDefaultThreads();
            }
        } catch (err) {
            console.warn("Falling back to local storage for Q&A:", err);
        }
    }
    const saved = localStorage.getItem(QA_LOCAL_KEY);
    return saved ? JSON.parse(saved) : getDefaultThreads();
}

async function renderQaThreads() {
    const container = document.getElementById("qaThreadList");
    if (!container) return;

    const threadsObj = await fetchQaThreads();
    const threadEntries = Object.entries(threadsObj).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    if (threadEntries.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #94a3b8;">No questions yet. Be the first to ask above!</p>`;
        return;
    }

    container.innerHTML = threadEntries.map(([id, item]) => {
        const repliesObj = item.replies || {};
        const replyEntries = Object.entries(repliesObj).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

        const repliesHtml = replyEntries.length > 0 ? `
            <div class="qa-replies-container">
                ${replyEntries.map(([, rep]) => `
                    <div class="qa-reply-item">
                        <div class="qa-thread-header" style="margin-bottom: 6px;">
                            <span class="qa-author-badge" style="font-size: 0.85rem;">
                                <i class="fa-solid fa-reply" style="color: #22d3ee;"></i> ${escapeHtml(rep.username)}
                            </span>
                            <span class="qa-timestamp">${escapeHtml(rep.timestamp || "")}</span>
                        </div>
                        <p class="qa-question-text" style="margin: 0; font-size: 0.9rem;">${escapeHtml(rep.message)}</p>
                    </div>
                `).join("")}
            </div>
        ` : "";

        return `
            <div class="qa-thread-card">
                <div class="qa-thread-header">
                    <span class="qa-author-badge">
                        <i class="fa-solid fa-user-astronaut"></i> ${escapeHtml(item.username)}
                    </span>
                    <span class="qa-timestamp">${escapeHtml(item.timestamp || "")}</span>
                </div>
                <p class="qa-question-text">${escapeHtml(item.message)}</p>

                <button type="button" class="qa-reply-toggle-btn" onclick="toggleReplyForm('${id}')">
                    <i class="fa-solid fa-reply"></i> Reply (${replyEntries.length})
                </button>

                <form id="reply-form-${id}" class="qa-reply-form" onsubmit="submitReply(event, '${id}')">
                    <input type="text" id="reply-user-${id}" class="qa-field" placeholder="Your Username" required maxlength="40">
                    <textarea id="reply-msg-${id}" class="qa-field" rows="2" placeholder="Write your answer or comment..." required maxlength="800"></textarea>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" class="filter-btn" onclick="toggleReplyForm('${id}')">Cancel</button>
                        <button type="submit" class="qa-reply-toggle-btn" style="background: linear-gradient(135deg, #0284c7, #06b6d4); color: #fff;">Post Reply</button>
                    </div>
                </form>

                ${repliesHtml}
            </div>
        `;
    }).join("");
}

function toggleReplyForm(threadId) {
    const form = document.getElementById(`reply-form-${threadId}`);
    if (!form) return;
    form.style.display = form.style.display === "flex" ? "none" : "flex";
}

async function submitNewQuestion(event) {
    event.preventDefault();
    const userInput = document.getElementById("qaUserName");
    const msgInput = document.getElementById("qaQuestionMessage");
    const username = userInput.value.trim();
    const message = msgInput.value.trim();
    if (!username || !message) return;

    const newPost = {
        username,
        message,
        timestamp: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        createdAt: Date.now()
    };

    const isConfigured = QA_FIREBASE_URL && !QA_FIREBASE_URL.includes("YOUR_FIREBASE_DB_URL");
    if (isConfigured) {
        await fetch(`${QA_FIREBASE_URL}/qa_threads.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPost)
        });
    } else {
        const threads = await fetchQaThreads();
        threads[`q_${Date.now()}`] = newPost;
        localStorage.setItem(QA_LOCAL_KEY, JSON.stringify(threads));
    }

    userInput.value = "";
    msgInput.value = "";
    await renderQaThreads();
}

async function submitReply(event, threadId) {
    event.preventDefault();
    const userInput = document.getElementById(`reply-user-${threadId}`);
    const msgInput = document.getElementById(`reply-msg-${threadId}`);
    const username = userInput.value.trim();
    const message = msgInput.value.trim();
    if (!username || !message) return;

    const newReply = {
        username,
        message,
        timestamp: new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
        createdAt: Date.now()
    };

    const isConfigured = QA_FIREBASE_URL && !QA_FIREBASE_URL.includes("YOUR_FIREBASE_DB_URL");
    if (isConfigured) {
        await fetch(`${QA_FIREBASE_URL}/qa_threads/${threadId}/replies.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newReply)
        });
    } else {
        const threads = await fetchQaThreads();
        if (!threads[threadId].replies) threads[threadId].replies = {};
        threads[threadId].replies[`r_${Date.now()}`] = newReply;
        localStorage.setItem(QA_LOCAL_KEY, JSON.stringify(threads));
    }

    await renderQaThreads();
}

// ================= 8. GLOBAL DONATE HELPERS =================
function copyUpiId() {
    const upiElement = document.getElementById('upiText');
    if (!upiElement) return;
    navigator.clipboard.writeText(upiElement.textContent).then(() => {
        alert("UPI ID copied to clipboard!");
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

function submitDonationDetails(event) {
    event.preventDefault();
    const modal = document.getElementById('donationModal');
    if (modal) modal.style.display = 'none';
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