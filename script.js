const canvas = document.getElementById('gameCanvas'),
      ctx = canvas.getContext('2d');

let DECIMAL_MULTIPLIER = 1000;

let WIDTH = canvas.getBoundingClientRect().width,
    HEIGHT = canvas.getBoundingClientRect().height,
    ballRadios = 7,
    obstacleRadius = 4,
    gravity = 0.7,
    horizontalFriction = 0.5,
    verticalFriction = 0.8,
    balls = [],
    obstacles = [],
    sinks = [];

function pad(n) { return n * DECIMAL_MULTIPLIER; }
function unpad(n) { return Math.round(n / DECIMAL_MULTIPLIER); }
const getColor = gsap.utils.interpolate('#b7183c', '#cda43a');

// Utility function to convert RGB to HSL
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
}

// Utility function to convert HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    h /= 360;
    s /= 100;
    l /= 100;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}

// Function to increase the saturation of an RGB color
function saturateRgbColor(rgbColor, amount) {
    let [r, g, b] = rgbColor.match(/\d+/g).map(Number);
    let [h, s, l] = rgbToHsl(r, g, b);
    s = Math.min(100, s + amount); // Increase saturation
    let [newR, newG, newB] = hslToRgb(h, s, l);
    return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
}

// Set canvas size based on the window size
function resizeCanvas() {
    const aspectRatio = 1 / 1; // Set your desired aspect ratio here

    let width = window.innerWidth - 40;
    let height = window.innerHeight - 40;

    // Adjust dimensions to maintain aspect ratio
    if (width / height > aspectRatio) { width = height * aspectRatio; }
                                 else { height = width / aspectRatio; }

    // Set the canvas dimensions
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(pixelRatio, pixelRatio);

    WIDTH = canvas.width / pixelRatio;
    HEIGHT = canvas.height / pixelRatio;

    createObstacles();
    createSinks();
    draw(); // Redraw the canvas after resizing
}

function createObstacles() {
    obstacles = [];
    const rows = 16,
          spacing = 36;

    for (let row = 2; row < rows; row++) {
        const numObstacles = row + 1;
        const y = 0 + row * 35;
        for (let col = 0; col < numObstacles; col++) {
            const x = WIDTH / 2 - spacing * (row / 2 - col);
            obstacles.push({ x: x, y: y, radius: obstacleRadius });
        }
    }
}

function createSinks() {
    sinks = [];
    const sinksWidth = 30,
          NUM_SINKS = 15,
          ht = canvas.getBoundingClientRect().height;

    for (let i = 0; i < NUM_SINKS; i++) {
        const gap = obstacles[i].radius * 2;
        const x = WIDTH / 2 - (NUM_SINKS / 2) * (sinksWidth + gap) + i * (sinksWidth + gap) + obstacleRadius;
        const y = ht * 0.85;
        const width = sinksWidth;
        const height = width;
        const prg1 = gsap.utils.mapRange(0, NUM_SINKS, 0, 2, i);
        const prg2 = gsap.utils.mapRange(0, NUM_SINKS, 2, 0, i);
        const prg = prg1 < 1 ? prg1 : prg2;
        const color = getColor(prg);
        sinks.push({ x, y, width, height, color });
    }
}

class Ball {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // Change the velocity & position
        this.vy += gravity;
        this.x += this.vx;
        this.y += this.vy;

        // Collision with the obstacles
        obstacles.forEach(obstacle => {
            const dist = Math.hypot(this.x - obstacle.x, this.y - obstacle.y);

            if (dist < this.radius + obstacle.radius) {
                // Calculate the collision angle
                const angle = Math.atan2(this.y - obstacle.y, this.x - obstacle.x);
                // Reflect velocity
                const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
                this.vx = Math.cos(angle) * speed * horizontalFriction;
                this.vy = Math.sin(angle) * speed * verticalFriction;

                // Adjust position to prevent stacking
                const overlap = this.radius + obstacle.radius - dist;
                this.x += Math.cos(angle) * overlap;
                this.y += Math.sin(angle) * overlap;
            }
        });

        // Collision with sinks
        sinks.forEach(sink => {
            if (
                this.x > sink.x - sink.width / 2 &&
                this.x < sink.x + sink.width / 2 &&
                this.y + this.radius > sink.y - sink.height / 2
            ) {
                this.vx = 0;
                this.vy = 0;
            }
        });
    }
}

function drawObstacles() {
    ctx.fillStyle = 'white';
    obstacles.forEach(obstacle => {
        const { x, y, radius } = obstacle;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
}

function drawSinks() {
    sinks.forEach(sink => {
        ctx.fillStyle = sink.color;
        const { x, y, width, height } = sink;

        // Increase saturation for shadow color
        const shadowColor = saturateRgbColor(sink.color, 100);

        ctx.shadowColor = shadowColor; // Slightly more saturated shadow color
        ctx.shadowBlur = 1; // Shadow blur amount
        ctx.shadowOffsetX = 0; // Horizontal shadow offset
        ctx.shadowOffsetY = 3; // Vertical shadow offset

        drawRoundedRect(ctx, x, y, width, height, 7); // Adjust the radius as needed
    });

    // Reset shadow properties for subsequent drawings
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

function addBall() {
    const x = gsap.utils.random(WIDTH / 2 - 23, WIDTH / 2 + 23);
    const ball = new Ball(x, 50, ballRadios, 'yellow');
    balls.push(ball);
}

document.getElementById('add-ball').addEventListener('click', () => addBall());

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawObstacles();
    drawSinks();
    balls.forEach(ball => {
        ball.draw();
        ball.update();
    });
}

function update() {
    draw();
    requestAnimationFrame(update);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
update();