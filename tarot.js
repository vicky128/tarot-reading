const startBtn = document.getElementById('startBtn');
const reverseContainer = document.getElementById('reverseContainer');
const chatContainer = document.getElementById('chatContainer');
const cardContainer = document.getElementById('cardContainer');
const drawnCardContainer = document.getElementById('drawnCardContainer');
const limitMessage = document.getElementById('limitMessage');
const shuffleSound = document.getElementById('shuffle-sound');
const flipSound = document.getElementById('flip-sound');
const reverseMode = document.getElementById('reverseMode');
const chatInput = document.getElementById('chatInput');
const aiResponse = document.getElementById('aiResponse');
const askBtn = document.getElementById('askBtn');

let tarotDeck = [];
let drawnCards = [];
let isShuffling = false;
const MAX_CARDS = 6;

async function loadTarotDeck() {
    try {
        const response = await fetch('tarot-images.json');
        const data = await response.json();
        tarotDeck = data.cards.map(card => ({
            name: card.name,
            image: `images/${card.img}`,
            description: card.meanings.light.join('； '),
            reversedDescription: card.meanings.shadow.join('； ')
        }));
    } catch (error) {
        console.error("Error loading tarot deck:", error);
        // Fallback mock data in case JSON loading fails
        tarotDeck = Array(78).fill().map((_, i) => ({
            name: `Card ${i + 1}`,
            image: 'images/card-back.jpg',
            description: "Light meaning placeholder",
            reversedDescription: "Shadow meaning placeholder"
        }));
    }
}

function shuffleDeck() {
    for (let i = tarotDeck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [tarotDeck[i], tarotDeck[j]] = [tarotDeck[j], tarotDeck[i]];
    }
}

function clearChat() {
    // Clear input and response
    chatInput.value = '';
    aiResponse.innerHTML = '';
    aiResponse.style.display = 'none';
}

function clearDrawnCards() {
    drawnCardContainer.innerHTML = '';
    drawnCards = [];
}

function startShuffling() {
    if (isShuffling) return;
    isShuffling = true;

    // Clear previous drawn cards and chat
    clearDrawnCards();
    clearChat();

    startBtn.style.display = 'none';
    reverseContainer.style.display = 'none';

    cardContainer.style.display = 'block';
    chatContainer.style.display = 'block';
    
    // Reset chat container position and opacity
    chatContainer.style.opacity = 0;
    gsap.to(chatContainer, { opacity: 1, y: -20, duration: 1 });

    shuffleDeck();
    shuffleSound.play();

    // Move the button and checkbox to the top right corner
    setTimeout(() => {
        startBtn.style.left = 'auto';
        startBtn.style.right = '30px';
        startBtn.style.top = '30px';
        startBtn.style.transform = 'none';
        startBtn.style.width = '60px';
        startBtn.style.height = '60px';
        startBtn.style.fontSize = '16px';
        startBtn.textContent = '重洗';
        startBtn.style.display = 'flex';

        reverseContainer.style.right = '100px';
        reverseContainer.style.left = 'auto';
        reverseContainer.style.top = '30px';
        reverseContainer.style.display = 'flex';

        isShuffling = false;
    }, 1000);

    const a = 500;
    const b = 100;
    const centerX = 600;
    const centerY = 250;

    // Clear previous cards
    cardContainer.innerHTML = '';

    // Speed up card display by reducing the delay between cards
    tarotDeck.forEach((tarotCard, i) => {
        let angle = -80 + (160 / 77) * i;
        let radian = angle * (Math.PI / 180);
        let x = centerX + a * Math.sin(radian) - 50;
        let y = centerY - b * Math.cos(radian);

        let card = document.createElement('div');
        card.classList.add('card');
        card.dataset.index = i;
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        card.style.transform = `rotate(${angle}deg)`;
        cardContainer.appendChild(card);

        // Improved hover effect
        card.addEventListener('mouseenter', () => {
            gsap.to(card, {
                y: -10,
                scale: 1.05,
                duration: 0.2
            });
        });
        
        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                y: 0,
                scale: 1,
                duration: 0.2,
                rotate: `${angle}deg`
            });
        });

        card.addEventListener('click', () => {
            if (drawnCards.length >= MAX_CARDS) {
                showLimitMessage();
                return;
            }

            flipSound.play();

            // Modified card drawing animation
            const cardClone = document.createElement('div');
            cardClone.classList.add('card');
            cardClone.style.position = 'fixed';
            cardClone.style.left = card.getBoundingClientRect().left + 'px';
            cardClone.style.top = card.getBoundingClientRect().top + 'px';
            cardClone.style.transform = card.style.transform;
            cardClone.style.zIndex = '1500';
            document.body.appendChild(cardClone);

            // Check if reverse mode is enabled
            const isReversed = reverseMode.checked && Math.random() > 0.5;

            // Store selected card info
            drawnCards.push({
                card: tarotCard,
                isReversed: isReversed
            });

            // Animate selecting card from spread
            gsap.to(cardClone, {
                left: '50%',
                top: '50%',
                xPercent: -50,
                yPercent: -50,
                rotation: 0,
                duration: 0.4,
                onComplete: () => {
                    // Flip the card with 3D effect
                    gsap.to(cardClone, {
                        rotationY: 180,
                        duration: 0.5,
                        onUpdate: function() {
                            // Change background at midpoint of flip
                            if (this.progress() >= 0.5 && cardClone.style.backgroundImage === '') {
                                cardClone.style.background = `url('${tarotCard.image}') no-repeat center/cover`;
                            }
                        },
                        onComplete: () => {
                            // Add to drawn cards section
                            addDrawnCard(tarotCard, isReversed);

                            // Remove animation clone
                            cardClone.remove();
                        }
                    });
                }
            });

            // Remove original card
            card.remove();
        });

        // Speed up the initial card display by reducing delay between cards
        gsap.to(card, {
            opacity: 1,
            duration: 0.03,
            delay: i * 0.005, // Faster display (reduced from 0.01)
        });
    });
}

function addDrawnCard(tarotCard, isReversed) {
    const drawnCardWrapper = document.createElement('div');
    drawnCardWrapper.classList.add('drawn-card-wrapper');

    const drawnCard = document.createElement('div');
    drawnCard.classList.add('drawn-card');
    drawnCard.style.backgroundImage = `url('${tarotCard.image}')`;
    if (isReversed) {
        drawnCard.classList.add('reversed');
    }

    const cardName = document.createElement('div');
    cardName.classList.add('card-name');
    cardName.textContent = tarotCard.name + (isReversed ? ' (逆位)' : '');

    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.textContent = isReversed ? tarotCard.reversedDescription : tarotCard.description;

    drawnCardWrapper.appendChild(drawnCard);
    drawnCardWrapper.appendChild(cardName);
   // drawnCardWrapper.appendChild(tooltip);

    drawnCardContainer.appendChild(drawnCardWrapper);

    // Add hover effect for tooltip
    drawnCard.addEventListener('mouseenter', () => {
        tooltip.style.display = 'block';
    });

    drawnCard.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}

// In tarot.js, replace the getAIInterpretation function with this:
async function getAIInterpretation() {
    aiResponse.style.display = 'block';
    
    try {
        // Prepare request data
        const requestData = {
            question: chatInput.value.trim() || "无特定问题",
            cards: drawnCards.map(card => ({
                name: card.card.name,
                reversed: card.isReversed,
                description: card.isReversed ? card.card.reversedDescription : card.card.description
            }))
        };
        
        console.log("塔罗牌解读请求:", requestData);
        
        // Use the client.js function to handle the interpretation
        await getCardInterpretation(requestData.question, requestData.cards);
        
        // After setting the response content, scroll the chat container
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
        
    } catch (error) {
        console.error('解读错误:', error);
        aiResponse.innerHTML = `解读失败: ${error.message || '服务器连接错误'}`;
    }
}

// Helper function to format the response with nicer styling
function formatTarotResponse(text) {
    // Split by paragraphs and wrap them in proper HTML
    return text.split('\n\n')
        .map(paragraph => {
            // Check if it's a heading
            if (paragraph.startsWith('#')) {
                const level = paragraph.match(/^#+/)[0].length;
                const content = paragraph.replace(/^#+\s*/, '');
                return `<h${level}>${content}</h${level}>`;
            }
            return `<p>${paragraph}</p>`;
        })
        .join('');
}

function showLimitMessage() {
    limitMessage.style.display = 'block';
    gsap.to(limitMessage, {
        opacity: 1,
        duration: 0.3,
        onComplete: () => {
            setTimeout(() => {
                gsap.to(limitMessage, {
                    opacity: 0,
                    duration: 0.3,
                    onComplete: () => {
                        limitMessage.style.display = 'none';
                    }
                });
            }, 2000);
        }
    });
}

function handleEnterKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); // 阻止表单默认提交行为
        getAIInterpretation();
    }
}

// Initialize event listeners
function initEventListeners() {
    startBtn.addEventListener('click', startShuffling);
    askBtn.addEventListener('click', getAIInterpretation);
    chatInput.addEventListener('keypress', handleEnterKey);
}

// Initialize
function init() {
    loadTarotDeck();
    initEventListeners();
}

// Start the application
document.addEventListener('DOMContentLoaded', init);