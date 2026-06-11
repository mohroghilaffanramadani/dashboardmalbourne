console.log("ADMIN JS LOADED");
const supabaseClient = supabase.createClient(
  "https://csrxiyvxesbqosbwdhpc.supabase.co",
  "sb_publishable_9Lsxw2xanLrtW_eGck5CCQ_L2yuT2hn",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

class MalbourneAdmin {
  async loadMediaFromDatabase() {
    const { data, error } = await supabaseClient
      .from("media")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      console.log("LOAD ERROR:", error);
      return;
    }

    this.mediaData = {};

    data.forEach((item) => {
      if (!this.mediaData[item.category]) {
        this.mediaData[item.category] = [];
      }

      this.mediaData[item.category].push({
        ...item,
        position: Number(item.position),
      });
    });

    this.updateStats();

    if (this.currentCategory === "dashboard") {
      this.loadDashboardContent();
    } else {
      this.loadCategoryContent(this.currentCategory);
    }
  }

  async uploadImage(file) {
    // 1. Bersihkan nama file (hapus spasi dan karakter aneh, ganti dengan underscore)
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-]/g, "_");
    const fileName = Date.now() + "-" + cleanFileName;

    // 2. Tambahkan opsi upsert untuk mencegah error HTTP2
    const { data, error } = await supabaseClient.storage
      .from("media")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false, // Set true jika ingin menimpa file dengan nama yang sama
      });

    if (error) {
      console.log("UPLOAD ERROR:", error);
      this.showNotification(error.message, "error");
      return null;
    }

    const { data: publicUrl } = supabaseClient.storage
      .from("media")
      .getPublicUrl(fileName);

    return {
      url: publicUrl.publicUrl,
      filename: fileName,
    };
  }

  constructor() {
    this.currentUser = null;
    this.currentCategory = "dashboard";
    this.currentPosition = null; // Untuk menyimpan posisi yang dipilih
    this.mediaData = {};
    setTimeout(() => {
      this.loadMediaFromDatabase();
    }, 500);
    this.initElements();
    this.initEventListeners();
    this.checkAuth();
    this.updateStats();
    this.initCategorySelector();
  }

  initElements() {
    this.loginView = document.getElementById("loginView");
    this.dashboardView = document.getElementById("dashboardView");

    this.loginForm = document.getElementById("loginForm");
    this.togglePassword = document.getElementById("togglePassword");
    this.passwordInput = document.getElementById("password");

    this.logoutBtn = document.getElementById("logoutBtn");
    this.mobileMenuToggle = document.getElementById("mobileMenuToggle");
    this.sidebar = document.querySelector(".sidebar");
    this.navItems = document.querySelectorAll(".nav-item");
    this.contentArea = document.getElementById("contentArea");

    this.uploadModal = document.getElementById("uploadModal");
    this.previewModal = document.getElementById("previewModal");
    this.deleteModal = document.getElementById("deleteModal");

    this.uploadForm = document.getElementById("uploadForm");
    console.log("UPLOAD FORM ELEMENT:", this.uploadForm);
    this.uploadArea = document.getElementById("uploadArea");
    this.fileInput = document.getElementById("fileInput");
    this.fileName = document.getElementById("fileName");
    this.categorySelector = document.getElementById("categorySelector");
    this.categoryOptions = document.querySelectorAll(".category-option");
    this.cancelUpload = document.getElementById("cancelUpload");
    this.closeUploadModal = document.getElementById("closeUploadModal");

    this.deleteFileInfo = document.getElementById("deleteFileInfo");
    this.cancelDelete = document.getElementById("cancelDelete");
    this.closeDeleteModal = document.getElementById("closeDeleteModal");
    this.confirmDelete = document.getElementById("confirmDelete");

    this.previewContainer = document.getElementById("previewContainer");
    this.previewDetails = document.getElementById("previewDetails");
    this.closePreviewModal = document.getElementById("closePreviewModal");

    this.totalMediaEl = document.getElementById("totalMedia");
    this.totalCategoriesEl = document.getElementById("totalCategories");

    this.itemToDelete = null;

    // Tambahkan properti baru untuk mobile
    this.sidebarBackdrop = null;
    this.sidebarClose = null;

    // Panggil fungsi untuk membuat elemen mobile
    this.createMobileElements();
  }

  // Method baru untuk inisialisasi category selector
  initCategorySelector() {
    this.categoryOptions = document.querySelectorAll(".category-option");
    this.categoryOptions.forEach((option) => {
      option.addEventListener("click", () => this.selectCategory(option));
    });
  }

  createMobileElements() {
    // Buat backdrop untuk sidebar (hanya sekali)
    if (!this.sidebarBackdrop) {
      this.sidebarBackdrop = document.createElement("div");
      this.sidebarBackdrop.className = "sidebar-backdrop";
      document.body.appendChild(this.sidebarBackdrop);
    }

    // Buat tombol close di sidebar (hanya sekali)
    if (!this.sidebarClose) {
      this.sidebarClose = document.createElement("button");
      this.sidebarClose.className = "sidebar-close";
      this.sidebarClose.innerHTML = '<i class="fas fa-times"></i>';

      const sidebarHeader = this.sidebar.querySelector(".sidebar-header");
      if (sidebarHeader && !sidebarHeader.contains(this.sidebarClose)) {
        sidebarHeader.appendChild(this.sidebarClose);
      }
    }

    // Hapus event listener lama jika ada, lalu tambahkan yang baru
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.removeEventListener("click", () =>
        this.closeMobileSidebar(),
      );
      this.sidebarBackdrop.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeMobileSidebar();
      });
    }

    if (this.sidebarClose) {
      this.sidebarClose.removeEventListener("click", () =>
        this.closeMobileSidebar(),
      );
      this.sidebarClose.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeMobileSidebar();
      });
    }

    // Event listener untuk resize window (hapus dulu yang lama)
    window.removeEventListener("resize", this.handleResize.bind(this));
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  handleResize() {
    if (window.innerWidth > 768) {
      this.closeMobileSidebar();
    }
  }

  openMobileSidebar() {
    this.sidebar.classList.add("active");
    this.sidebarBackdrop.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  closeMobileSidebar() {
    this.sidebar.classList.remove("active");
    this.sidebarBackdrop.classList.remove("show");
    document.body.style.overflow = "";
  }

  initEventListeners() {
    this.loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    if (this.uploadForm) {
      this.uploadForm.addEventListener("submit", (e) => this.handleUpload(e));
    }
    this.togglePassword.addEventListener("click", () =>
      this.togglePasswordVisibility(),
    );

    this.logoutBtn.addEventListener("click", () => this.handleLogout());

    this.mobileMenuToggle.addEventListener("click", () =>
      this.toggleMobileMenu(),
    );

    this.navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchCategory(item.dataset.category);
      });
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".open-upload-modal");
      if (btn) {
        e.preventDefault();
        this.openUploadModal();
      }
    });

    // Event listener untuk kategori di upload modal
    this.categoryOptions.forEach((option) => {
      option.addEventListener("click", () => this.selectCategory(option));
    });

    const browseBtn = this.uploadArea.querySelector(".btn-browse");
    if (browseBtn) {
      browseBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // cegah event bubble ke uploadArea
        this.fileInput.click();
      });
    }
    this.uploadArea.addEventListener("dragover", (e) => this.handleDragOver(e));
    this.uploadArea.addEventListener("dragleave", (e) =>
      this.handleDragLeave(e),
    );
    this.uploadArea.addEventListener("drop", (e) => this.handleDrop(e));
    this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));

    this.cancelUpload.addEventListener("click", () =>
      this.closeModal(this.uploadModal),
    );
    this.closeUploadModal.addEventListener("click", () =>
      this.closeModal(this.uploadModal),
    );

    this.cancelDelete.addEventListener("click", () =>
      this.closeModal(this.deleteModal),
    );
    this.closeDeleteModal.addEventListener("click", () =>
      this.closeModal(this.deleteModal),
    );
    this.closePreviewModal.addEventListener("click", () =>
      this.closeModal(this.previewModal),
    );

    this.confirmDelete.addEventListener("click", () =>
      this.handleConfirmDelete(),
    );

    // Event listener untuk modal backdrop
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal");
        this.closeModal(modal);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  updateStats() {
    let totalMedia = 0;
    Object.values(this.mediaData).forEach((category) => {
      totalMedia += category.length;
    });

    if (this.totalMediaEl) {
      this.totalMediaEl.textContent = totalMedia;
    }

    // Update badges untuk semua kategori (TAMBAHKAN HOME)
    const categories = [
      "home", // <-- TAMBAH INI
      "story",
      "experience",
      "menu",
      "training",
      "retail-beans",
      "wholesale",
      "merchandise",
      "community",
      "loyalty",
    ];
    categories.forEach((cat) => {
      const badge = document.getElementById(`badge-${cat}`);
      if (badge) {
        badge.textContent = this.mediaData[cat]?.length || 0;
      }
    });
  }

  togglePasswordVisibility() {
    const type =
      this.passwordInput.getAttribute("type") === "password"
        ? "text"
        : "password";
    this.passwordInput.setAttribute("type", type);
    this.togglePassword.innerHTML =
      type === "password"
        ? '<i class="far fa-eye"></i>'
        : '<i class="far fa-eye-slash"></i>';
  }

  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      this.showNotification("Login gagal", "error");
      console.log(error);
      return;
    }

    await supabaseClient.auth.getSession();

    this.currentUser = {
      name: "Admin User",
      email: email,
    };

    localStorage.setItem("malbourneAdmin", JSON.stringify(this.currentUser));

    this.loginView.style.opacity = "0";

    setTimeout(() => {
      this.loginView.classList.remove("active");
      this.dashboardView.classList.add("active");

      setTimeout(() => {
        this.dashboardView.style.opacity = "1";
        this.loadDashboardContent();
      }, 50);
    }, 300);
  }

  handleLogout() {
    localStorage.removeItem("malbourneAdmin");
    this.currentUser = null;

    this.dashboardView.style.opacity = "0";
    setTimeout(() => {
      this.dashboardView.classList.remove("active");
      this.loginView.classList.add("active");
      setTimeout(() => {
        this.loginView.style.opacity = "1";
      }, 50);
    }, 300);
  }

  checkAuth() {
    const savedUser = localStorage.getItem("malbourneAdmin");
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
      this.loginView.classList.remove("active");
      this.dashboardView.classList.add("active");
      this.loadDashboardContent();

      // Pastikan sidebar tertutup di mobile saat pertama kali load
      if (window.innerWidth <= 768) {
        this.closeMobileSidebar();
      }
    } else {
      this.loginView.classList.add("active");
    }
  }

  toggleMobileMenu() {
    if (window.innerWidth <= 768) {
      if (this.sidebar.classList.contains("active")) {
        this.closeMobileSidebar();
      } else {
        this.openMobileSidebar();
      }
    } else {
      this.sidebar.classList.toggle("active");
    }
  }

  switchCategory(category) {
    this.currentCategory = category;

    this.navItems.forEach((item) => {
      if (item.dataset.category === category) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Tutup sidebar mobile jika lebar layar <= 768px
    if (window.innerWidth <= 768) {
      this.closeMobileSidebar();
    } else {
      this.sidebar.classList.remove("active");
    }

    if (category === "dashboard") {
      this.loadDashboardContent();
    } else {
      this.loadCategoryContent(category);
    }
  }

  loadDashboardContent() {
    // Hitung total untuk setiap kategori (TAMBAHKAN HOME)
    const homeCount = this.mediaData.home?.length || 0; // <-- TAMBAH INI
    const storyCount = this.mediaData.story?.length || 0;
    const experienceCount = this.mediaData.experience?.length || 0;
    const menuCount = this.mediaData.menu?.length || 0;
    const trainingCount = this.mediaData.training?.length || 0;
    const retailBeansCount = this.mediaData["retail-beans"]?.length || 0;
    const wholesaleCount = this.mediaData.wholesale?.length || 0;
    const merchandiseCount = this.mediaData.merchandise?.length || 0;
    const communityCount = this.mediaData.community?.length || 0;
    const loyaltyCount = this.mediaData.loyalty?.length || 0;

    this.contentArea.innerHTML = `
      <div class="category-header">
        <h2>Dashboard</h2>
        <p>Selamat datang kembali, ${this.currentUser?.name || "Admin"}</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card" data-category="home">
          <div class="stat-icon"><i class="fas fa-home"></i></div>
          <div class="stat-content">
            <h4>Home</h4>
            <span class="stat-number">${homeCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="story">
          <div class="stat-icon"><i class="fas fa-book-open"></i></div>
          <div class="stat-content">
            <h4>Story</h4>
            <span class="stat-number">${storyCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="experience">
          <div class="stat-icon"><i class="fas fa-camera"></i></div>
          <div class="stat-content">
            <h4>Experience</h4>
            <span class="stat-number">${experienceCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="menu">
          <div class="stat-icon"><i class="fas fa-utensils"></i></div>
          <div class="stat-content">
            <h4>Menu</h4>
            <span class="stat-number">${menuCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="training">
          <div class="stat-icon"><i class="fas fa-graduation-cap"></i></div>
          <div class="stat-content">
            <h4>Training</h4>
            <span class="stat-number">${trainingCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="retail-beans">
          <div class="stat-icon"><i class="fas fa-coffee"></i></div>
          <div class="stat-content">
            <h4>Retail Beans</h4>
            <span class="stat-number">${retailBeansCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="wholesale">
          <div class="stat-icon"><i class="fas fa-truck"></i></div>
          <div class="stat-content">
            <h4>Wholesale</h4>
            <span class="stat-number">${wholesaleCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="merchandise">
          <div class="stat-icon"><i class="fas fa-tshirt"></i></div>
          <div class="stat-content">
            <h4>Merchandise</h4>
            <span class="stat-number">${merchandiseCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="community">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-content">
            <h4>Community</h4>
            <span class="stat-number">${communityCount}</span>
          </div>
        </div>
        <div class="stat-card" data-category="loyalty">
          <div class="stat-icon"><i class="fas fa-star"></i></div>
          <div class="stat-content">
            <h4>Loyalty</h4>
            <span class="stat-number">${loyaltyCount}</span>
          </div>
        </div>
      </div>
      
      <div class="quick-actions">
        <h3>Akses Cepat ke Halaman</h3>
        <div class="quick-grid">
          <button class="quick-btn" data-category="home">Home (9 slot)</button>
          <button class="quick-btn" data-category="story">Story (6 slot)</button>
          <button class="quick-btn" data-category="experience">Experience (4 slot)</button>
          <button class="quick-btn" data-category="menu">Menu (8 slot)</button>
          <button class="quick-btn" data-category="training">Training (1 slot)</button>
          <button class="quick-btn" data-category="retail-beans">Retail Beans (8 slot)</button>
          <button class="quick-btn" data-category="wholesale">Wholesale (2 slot)</button>
          <button class="quick-btn" data-category="merchandise">Merchandise (10 slot)</button>
          <button class="quick-btn" data-category="community">Community (11 slot)</button>
          <button class="quick-btn" data-category="loyalty">Loyalty (1 slot)</button>
        </div>
      </div>
    `;

    // Tambahkan event listener untuk stat cards
    document.querySelectorAll(".stat-card").forEach((card) => {
      card.addEventListener("click", () => {
        const category = card.dataset.category;
        if (category) {
          this.switchCategory(category);
        }
      });
    });

    // Tambahkan event listener untuk quick buttons
    document.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const category = btn.dataset.category;
        if (category) {
          this.switchCategory(category);
        }
      });
    });
  }

  loadCategoryContent(category) {
    // Konfigurasi jumlah slot per kategori (TAMBAHKAN HOME)
    const categoryConfig = {
      home: { name: "Home", slots: 9, icon: "fa-home" },
      story: { name: "Story", slots: 6, icon: "fa-book-open" },

      experience: { name: "Experience", slots: 4, icon: "fa-camera" }, // dari 3 → 4

      menu: { name: "Menu", slots: 8, icon: "fa-utensils" },
      training: { name: "Training", slots: 1, icon: "fa-graduation-cap" },
      "retail-beans": { name: "Retail Beans", slots: 8, icon: "fa-coffee" },

      wholesale: { name: "Wholesale", slots: 2, icon: "fa-truck" }, // dari 3 → 2

      merchandise: { name: "Merchandise", slots: 10, icon: "fa-tshirt" }, // dari 9 → 10

      community: { name: "Community", slots: 11, icon: "fa-users" },
      loyalty: { name: "Loyalty", slots: 1, icon: "fa-star" },
    };

    const config = categoryConfig[category] || {
      name: category,
      slots: 6,
      icon: "fa-folder",
    };
    const mediaItems = this.mediaData[category] || [];

    // Hitung berapa slot yang terisi
    const filledSlots = mediaItems.length;

    // Generate grid untuk semua slot (1 sampai config.slots)
    let gridHTML = "";
    for (let i = 1; i <= config.slots; i++) {
      // Cari media yang ada di posisi ini
      const existingMedia = mediaItems.find((m) => m.position === i);

      gridHTML += `
        <div class="placeholder-card" data-category="${category}" data-position="${i}">
          <div class="placeholder-preview">
            ${
              existingMedia
                ? `<img src="${existingMedia.url}" alt="${existingMedia.filename}">`
                : `<div class="placeholder-empty">
                <i class="fas fa-image"></i>
                <span>Kosong</span>
              </div>`
            }
            <span class="placeholder-badge">#${i}</span>
          </div>
          <div class="placeholder-info">
            <div class="placeholder-title">${config.name} - Gambar ${i}</div>
            ${
              existingMedia
                ? `<div class="placeholder-subtitle">${existingMedia.filename}</div>`
                : `<div class="placeholder-subtitle">Belum ada gambar</div>`
            }
            <div class="placeholder-actions">
              <button class="btn-card ubah" onclick="window.malbourneAdmin.openUploadForPosition('${category}', ${i})">
                <i class="fas fa-edit"></i> Ubah
              </button>
              ${
                existingMedia
                  ? `<button class="btn-card hapus" onclick="window.malbourneAdmin.deletePosition('${category}', ${i})">
                  <i class="fas fa-trash"></i> Hapus
                </button>`
                  : `<button class="btn-card hapus" disabled style="opacity:0.5; cursor:not-allowed;">
                  <i class="fas fa-trash"></i> Hapus
                </button>`
              }
            </div>
          </div>
        </div>
      `;
    }

    this.contentArea.innerHTML = `
      <div class="page-header">
        <div>
          <h2><i class="fas ${config.icon}"></i> ${config.name}</h2>
          <p>Kelola ${config.slots} gambar untuk halaman ${config.name}</p>
        </div>
        <div class="page-badge">
          <i class="fas fa-images"></i> ${filledSlots}/${config.slots} Terisi
        </div>
      </div>
      <div class="placeholder-grid">
        ${gridHTML}
      </div>
    `;
  }

  // Method baru untuk membuka upload dengan posisi tertentu
  openUploadForPosition(category, position) {
    this.currentPosition = position;
    this.currentCategory = category; // ← tambah ini
    this.selectCategoryByValue(category);
    this.openUploadModal();
  }

  // Method baru untuk menghapus gambar di posisi tertentu
  deletePosition(category, position) {
    console.log("MEDIA DATA:", this.mediaData);
    console.log("CATEGORY:", category);
    console.log("POSITION:", position);
    const mediaList = this.mediaData[category] || [];

    const mediaItem = mediaList.find((m) => m.position === Number(position));

    if (!mediaItem) {
      console.log("MEDIA LIST:", mediaList);
      console.log("POSITION:", position);
      this.showNotification("Media tidak ditemukan", "error");
      return;
    }

    this.openDeleteModal(mediaItem.id, mediaItem.filename);
  }

  formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  openUploadModal() {
    this.categoryOptions.forEach((opt) => {
      opt.style.display = "none";
    });

    if (this.currentCategory !== "dashboard") {
      const selectedOption = Array.from(this.categoryOptions).find(
        (opt) => opt.dataset.category === this.currentCategory,
      );
      if (selectedOption) {
        selectedOption.style.display = "flex";
        this.selectCategory(selectedOption); // ini sudah set selectedCategory value
      }
    } else {
      this.categoryOptions.forEach((opt) => {
        opt.style.display = "flex";
      });
    }

    // ← TAMBAH INI: pastikan posisi tidak null
    if (!this.currentPosition) {
      this.currentPosition = 1;
    }

    this.uploadModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  closeModal(modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";

    if (modal === this.uploadModal) {
      this.uploadForm.reset();
      this.fileName.textContent = "Belum ada file dipilih";
      // Reset tampilan kategori
      this.categoryOptions.forEach((opt) => {
        opt.style.display = "flex";
      });
    }
  }

  closeAllModals() {
    this.closeModal(this.uploadModal);
    this.closeModal(this.previewModal);
    this.closeModal(this.deleteModal);
  }

  selectCategory(option) {
    this.categoryOptions.forEach((opt) => opt.classList.remove("active"));
    option.classList.add("active");
    document.getElementById("selectedCategory").value = option.dataset.category;
  }

  selectCategoryByValue(category) {
    this.categoryOptions.forEach((opt) => {
      if (opt.dataset.category === category) {
        opt.classList.add("active");
      } else {
        opt.classList.remove("active");
      }
    });
    document.getElementById("selectedCategory").value = category;
  }

  handleDragOver(e) {
    e.preventDefault();
    this.uploadArea.style.borderColor = "var(--color-accent)";
    this.uploadArea.style.background = "var(--color-accent-soft)";
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.uploadArea.style.borderColor = "var(--color-border)";
    this.uploadArea.style.background = "var(--color-surface-hover)";
  }

  handleDrop(e) {
    e.preventDefault();
    this.handleDragLeave(e);

    const file = e.dataTransfer.files[0];
    if (file) {
      this.fileInput.files = e.dataTransfer.files;
      this.fileName.textContent = file.name;
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.fileName.textContent = file.name;
    }
  }

  // UPDATED HANDLE UPLOAD FUNCTION
  async handleUpload(e) {
    console.log("FORM SUBMITTED");
    e.preventDefault();

    const file = this.fileInput.files[0];
    const category = document.getElementById("selectedCategory").value;
    const position = this.currentPosition || 1; // Gunakan posisi yang disimpan

    if (!file) {
      this.showNotification("Pilih file dulu", "error");
      return;
    }

    // --- TAMBAHAN: Buat UI Loading ---
    const submitBtn = this.uploadForm.querySelector('button[type="submit"]');
    const originalBtnContent = submitBtn.innerHTML;

    // Ubah tombol jadi loading dan matikan agar tidak diklik 2 kali
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> <span>Uploading...</span>';
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";
    submitBtn.style.cursor = "not-allowed";

    try {
      // cek apakah ada media lama di posisi ini
      const oldMedia = (this.mediaData[category] || []).find(
        (item) => item.position === position,
      );

      // kalau ada file lama, hapus dari storage
      if (oldMedia) {
        const oldFileName = oldMedia.filename;

        const { error: deleteOldError } = await supabaseClient.storage
          .from("media")
          .remove([oldFileName]);

        console.log("FILE LAMA DIHAPUS:", oldFileName);
        if (deleteOldError)
          console.log("ERROR DELETE FILE LAMA:", deleteOldError);

        // hapus juga dari database
        await supabaseClient.from("media").delete().eq("id", oldMedia.id);
      }

      const uploadResult = await this.uploadImage(file);
      if (!uploadResult) throw new Error("Gagal mengupload gambar ke storage");

      const url = uploadResult.url;
      const filename = uploadResult.filename;

      if (!url) throw new Error("URL gambar tidak ditemukan");

      // Simpan ke database Supabase
      const { data, error: dbError } = await supabaseClient
        .from("media")
        .insert([
          {
            filename: filename,
            type: file.type.startsWith("video") ? "video" : "image",
            category: category,
            position: position,
            url: url,
            size: file.size,
          },
        ])
        .select();

      if (dbError) {
        console.log("DATABASE ERROR:", dbError);
        throw new Error("Gagal menyimpan ke database");
      }

      // Hapus gambar lama di posisi yang sama jika ada (update state lokal)
      if (this.mediaData[category]) {
        this.mediaData[category] = this.mediaData[category].filter(
          (item) => item.position !== position,
        );
      }

      await this.loadMediaFromDatabase();

      this.closeModal(this.uploadModal);
      this.currentPosition = null; // Reset posisi
      this.showNotification("Upload berhasil!", "success");
    } catch (error) {
      console.error("UPLOAD PROCESS ERROR:", error);
      this.showNotification(
        error.message || "Terjadi kesalahan saat upload",
        "error",
      );
    } finally {
      // --- TAMBAHAN: Kembalikan tombol ke kondisi semula ---
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
    }
  }

  openDeleteModal(mediaId, fileName) {
    this.itemToDelete = mediaId;
    this.deleteFileInfo.textContent = fileName;
    this.deleteModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  async handleConfirmDelete() {
    if (!this.itemToDelete && this.itemToDelete !== 0) return;

    // --- TAMBAHAN: Buat UI Loading ---
    const originalBtnContent = this.confirmDelete.innerHTML;

    // Ubah tombol jadi loading dan matikan agar tidak diklik 2 kali
    this.confirmDelete.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> <span>Menghapus...</span>';
    this.confirmDelete.disabled = true;
    this.confirmDelete.style.opacity = "0.7";
    this.confirmDelete.style.cursor = "not-allowed";

    try {
      let mediaItem = null;

      // cari media di semua kategori
      Object.values(this.mediaData).forEach((category) => {
        const found = category.find((m) => m.id === this.itemToDelete);
        if (found) {
          mediaItem = found;
        }
      });

      if (!mediaItem) {
        throw new Error("Media tidak ditemukan");
      }

      const fileName = mediaItem.filename;

      // 1. Hapus file dari storage
      const { error: storageError } = await supabaseClient.storage
        .from("media")
        .remove([fileName]);

      if (storageError) {
        console.log("STORAGE ERROR:", storageError);
        // Kita biarkan lanjut ke hapus database meskipun storage error (misal file sudah tidak ada)
      }

      // 2. Hapus data dari database
      const { error: dbError } = await supabaseClient
        .from("media")
        .delete()
        .eq("id", this.itemToDelete);

      if (dbError) {
        throw new Error("Gagal menghapus data dari database");
      }

      // 3. Refresh data
      await this.loadMediaFromDatabase();

      // 4. Tutup modal dan reset
      this.closeModal(this.deleteModal);
      this.itemToDelete = null;
      this.showNotification("Media berhasil dihapus", "success");
    } catch (error) {
      console.error("DELETE ERROR:", error);
      this.showNotification(
        error.message || "Terjadi kesalahan saat menghapus",
        "error",
      );
    } finally {
      // --- TAMBAHAN: Kembalikan tombol ke kondisi semula ---
      this.confirmDelete.innerHTML = originalBtnContent;
      this.confirmDelete.disabled = false;
      this.confirmDelete.style.opacity = "1";
      this.confirmDelete.style.cursor = "pointer";
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle"}"></i>
      <span>${message}</span>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background: ${type === "success" ? "#588157" : type === "error" ? "#a44a3f" : "#7f8565"};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      z-index: 2000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  loadMockData() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Mock data dengan posisi (TAMBAHKAN HOME)
    return {
      home: [
        // <-- TAMBAH INI
        {
          id: "home-1",
          filename: "hero-banner.jpg",
          type: "image",
          category: "home",
          position: 1,
          size: 2457600,
          url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400",
          uploadedAt: today.toISOString(),
        },
        {
          id: "home-2",
          filename: "about-us.jpg",
          type: "image",
          category: "home",
          position: 2,
          size: 1835008,
          url: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=400",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      story: [
        {
          id: "1",
          filename: "coastal-sunset.jpg",
          type: "image",
          category: "story",
          position: 1,
          size: 2457600,
          url: "https://images.unsplash.com/photo-1507525425510-1e2d3b4a3e3b?w=400",
          uploadedAt: today.toISOString(),
        },
        {
          id: "2",
          filename: "mountain-retreat.jpg",
          type: "image",
          category: "story",
          position: 2,
          size: 1835008,
          url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      experience: [
        {
          id: "3",
          filename: "surf-lesson.mp4",
          type: "video",
          category: "experience",
          position: 1,
          size: 15728640,
          url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          uploadedAt: today.toISOString(),
        },
      ],
      menu: [
        {
          id: "7",
          filename: "espresso-shot.jpg",
          type: "image",
          category: "menu",
          position: 1,
          size: 2156789,
          url: "https://images.unsplash.com/photo-1510591509098-f4a7a38a5033?w=400",
          uploadedAt: today.toISOString(),
        },
        {
          id: "8",
          filename: "latte-art.mp4",
          type: "video",
          category: "menu",
          position: 2,
          size: 18945678,
          url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      training: [
        {
          id: "6",
          filename: "workshop-materials.jpg",
          type: "image",
          category: "training",
          position: 1,
          size: 1572864,
          url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      "retail-beans": [
        {
          id: "9",
          filename: "coffee-beans-bag.jpg",
          type: "image",
          category: "retail-beans",
          position: 1,
          size: 2345678,
          url: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400",
          uploadedAt: twoDaysAgo.toISOString(),
        },
        {
          id: "10",
          filename: "roasting-process.mp4",
          type: "video",
          category: "retail-beans",
          position: 2,
          size: 22345678,
          url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          uploadedAt: threeDaysAgo.toISOString(),
        },
      ],
      wholesale: [
        {
          id: "11",
          filename: "bulk-order.jpg",
          type: "image",
          category: "wholesale",
          position: 1,
          size: 1987654,
          url: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=400",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      merchandise: [
        {
          id: "12",
          filename: "coffee-mug.jpg",
          type: "image",
          category: "merchandise",
          position: 1,
          size: 1456789,
          url: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400",
          uploadedAt: today.toISOString(),
        },
        {
          id: "13",
          filename: "t-shirt-design.mp4",
          type: "video",
          category: "merchandise",
          position: 2,
          size: 15678901,
          url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          uploadedAt: twoDaysAgo.toISOString(),
        },
      ],
      community: [
        {
          id: "14",
          filename: "coffee-festival.jpg",
          type: "image",
          category: "community",
          position: 1,
          size: 2876543,
          url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400",
          uploadedAt: yesterday.toISOString(),
        },
      ],
      loyalty: [
        {
          id: "15",
          filename: "rewards-program.jpg",
          type: "image",
          category: "loyalty",
          position: 1,
          size: 1678901,
          url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400",
          uploadedAt: threeDaysAgo.toISOString(),
        },
      ],
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.malbourneAdmin = new MalbourneAdmin();
});
