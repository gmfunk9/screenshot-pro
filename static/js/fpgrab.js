class GrabController {
    constructor(container) {
        this.isDragging = false;
        this.initialX = 0;
        this.currentTransform = 0;
        this.container = container;
        this.lastX = 0;
        this.momentum = 0;
        this.friction = 0.97;
        this.allContentLoaded = false;
        this.currentPage = 1; 
        this.isFetching = false;
        this.containerWidth = this.container.scrollWidth;
        this.viewportWidth = window.innerWidth;

        this.initEventListeners();
        requestAnimationFrame(this.applyMomentum.bind(this));
    }

    initEventListeners() {
        this.container.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.handleDrag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        window.addEventListener('blur', this.onWindowBlur.bind(this));
        window.addEventListener('focus', this.onWindowFocus.bind(this));
    }

    onWindowBlur() {
        this.endDrag();
    }

    onWindowFocus() {
        this.lastX = 0;
        this.momentum = 0;
    }

    startDrag(e) {
        this.isDragging = true;
        this.container.classList.add('grabbing');
        this.initialX = e.pageX;
        this.lastX = this.initialX;
        this.lastTime = Date.now();
        this.momentum = 0;
        e.preventDefault();
    }

    handleDrag(e) {
        if (!this.isDragging) return;
        const currentX = e.pageX;
        const currentTimestamp = Date.now();
        const timeDifference = currentTimestamp - this.lastTime;

        if (timeDifference) {
            const distanceMoved = this.lastX - currentX;
            this.momentum += (distanceMoved * 1) / timeDifference;
            this.lastX = currentX;
            this.lastTime = currentTimestamp;
        }
    }

    endDrag(e) {
        this.isDragging = false;
        this.container.classList.remove('grabbing');
    }

    updateDimensions() {
        this.containerWidth = this.container.scrollWidth;
        this.viewportWidth = window.innerWidth;
    }

    clampTransform() {
        const maxTransform = this.containerWidth - this.viewportWidth;
        this.currentTransform = Math.min(Math.max(this.currentTransform, 0), maxTransform);
    }

    applyMomentum() {
        this.currentTransform += this.momentum;
        this.momentum *= this.friction;

        if (Math.abs(this.momentum) < 0.1) {
            this.momentum = 0;
        }

        this.clampTransform();
        this.container.style.transform = `translate3d(-${this.currentTransform}px, 0, 0)`;
        requestAnimationFrame(this.applyMomentum.bind(this));
    }
}

class CustomScroller {
    constructor() {
        console.log("GRAB")
        const container = document.querySelector('#result');
        this.grabController = new GrabController(container);
        console.log(container)

        // Initialize the MutationObserver
        this.observer = new MutationObserver(this.handleDOMChanges.bind(this));
        this.observer.observe(container, {
            childList: true,
            subtree: false
        });
    }

    handleDOMChanges(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                this.grabController.updateDimensions();
            }
        }
    }
}

new CustomScroller();
