class FAQSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      isLoading: true,
      error: null,
      faqs: [],
    };
  }

  static get observedAttributes() {
    return ["title"];
  }

  async connectedCallback() {
    await this.loadFAQs();
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  async loadFAQs() {
    try {
      const response = await fetch("/data/faqs.json");
      if (!response.ok)
        throw new Error(`Failed to load FAQ data: ${response.statusText}`);
      this.state.faqs = await response.json();
    } catch (error) {
      console.error("Error loading FAQs:", error);
      this.state.error = error.message;
    } finally {
      this.state.isLoading = false;
      this.render();
    }
  }

  render() {
    const styles = `
      <style>
        :host {
          --faq-primary: var(--color-primary, #9C7DB9);
          --faq-text: var(--color-text, #1a1a1a);
          --faq-text-secondary: var(--color-text-secondary, #666666);
          --faq-background: var(--color-background, white);
          --faq-border: var(--color-border, rgba(156, 125, 185, 0.2));
          --faq-hover: var(--color-hover, rgba(156, 125, 185, 0.05));
          display: block;
          width: 100%;
        }

        .container {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto;
          padding: 2rem 1rem;
        }
        
        .header {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .title {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--faq-primary) 0%, #007BFF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          line-height: 1.2;
        }
        
        .subtitle {
          font-size: 1.125rem;
          color: var(--faq-text-secondary);
          max-width: 36rem;
          margin: 0 auto;
          line-height: 1.6;
        }
        
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .faq-item {
          border: 1px solid var(--faq-border);
          border-radius: 1rem;
          overflow: hidden;
          background: var(--faq-background);
          transition: all 0.3s ease;
        }
        
        .faq-item:hover {
          border-color: var(--faq-primary);
          box-shadow: 0 4px 20px rgba(156, 125, 185, 0.15);
        }
        
        .faq-button {
          width: 100%;
          text-align: left;
          padding: 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--faq-text);
          transition: all 0.3s ease;
        }
        
        .faq-button:hover {
          color: var(--faq-primary);
        }
        
        .faq-button[aria-expanded="true"] {
          color: var(--faq-primary);
        }
        
        .faq-icon-wrapper {
          flex-shrink: 0;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: var(--faq-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        
        .faq-button:hover .faq-icon-wrapper {
          background: var(--faq-primary);
        }
        
        .faq-button[aria-expanded="true"] .faq-icon-wrapper {
          background: var(--faq-primary);
        }
        
        .faq-icon {
          width: 1.25rem;
          height: 1.25rem;
          transition: transform 0.3s ease;
          stroke: var(--faq-text);
        }
        
        .faq-button:hover .faq-icon {
          stroke: white;
        }
        
        .faq-button[aria-expanded="true"] .faq-icon {
          stroke: white;
          transform: rotate(180deg);
        }
        
        .faq-content {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s ease;
        }
        
        .faq-content > div {
          overflow: hidden;
        }
        
        .faq-content.expanded {
          grid-template-rows: 1fr;
        }
        
        .faq-answer {
          padding: 0 1.5rem 1.5rem;
          color: var(--faq-text-secondary);
          font-size: 1rem;
          line-height: 1.6;
          opacity: 0;
          transform: translateY(-0.5rem);
          transition: all 0.3s ease;
        }
        
        .faq-content.expanded .faq-answer {
          opacity: 1;
          transform: translateY(0);
        }
        
        .error-message {
          text-align: center;
          color: #ef4444;
          padding: 2rem;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 1rem;
          font-weight: 500;
        }
        
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 4rem 2rem;
        }
        
        .loading-spinner {
          width: 3rem;
          height: 3rem;
          border: 3px solid var(--faq-border);
          border-top-color: var(--faq-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .container {
            padding: 1.5rem 1rem;
          }
          
          .title {
            font-size: 2rem;
          }
          
          .subtitle {
            font-size: 1rem;
          }
          
          .faq-button {
            padding: 1.25rem;
            font-size: 1rem;
          }
          
          .faq-icon-wrapper {
            width: 1.75rem;
            height: 1.75rem;
          }
          
          .faq-icon {
            width: 1rem;
            height: 1rem;
          }
          
          .faq-answer {
            padding: 0 1.25rem 1.25rem;
            font-size: 0.9375rem;
          }
        }
      </style>
    `;

    const title = this.getAttribute("title") || "Frequently Asked Questions";

    let content;
    if (this.state.isLoading) {
      content = `
        <div class="loading">
          <div class="loading-spinner"></div>
        </div>
      `;
    } else if (this.state.error) {
      content = `
        <div class="error-message">
          ${this.state.error}
        </div>
      `;
    } else {
      content = `
        <div class="faq-list">
          ${this.state.faqs
            .map(
              (faq, index) => `
            <div class="faq-item">
              <button class="faq-button" aria-expanded="false" aria-controls="faq-content-${index}">
                <span>${faq.question}</span>
                <div class="faq-icon-wrapper">
                  <svg class="faq-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div id="faq-content-${index}" class="faq-content" role="region">
                <div>
                  <div class="faq-answer">${faq.answer}</div>
                </div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="container">
        <div class="header">
          <h2 class="title">${title}</h2>
          <p class="subtitle">Find quick answers to frequently asked questions about our AI solutions and services.</p>
        </div>
        ${content}
      </div>
    `;

    // Setup event listeners after rendering
    if (!this.state.isLoading && !this.state.error) {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    const faqButtons = this.shadowRoot.querySelectorAll(".faq-button");

    faqButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const isExpanded = button.getAttribute("aria-expanded") === "true";
        const content = button.nextElementSibling;

        // Close all other FAQs
        faqButtons.forEach((otherButton) => {
          if (otherButton !== button) {
            otherButton.setAttribute("aria-expanded", "false");
            otherButton.nextElementSibling.classList.remove("expanded");
          }
        });

        // Toggle current FAQ
        button.setAttribute("aria-expanded", !isExpanded);
        content.classList.toggle("expanded", !isExpanded);
      });
    });
  }
}

customElements.define("faq-section", FAQSection);
