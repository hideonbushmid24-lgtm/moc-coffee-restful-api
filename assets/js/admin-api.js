"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const API_ORIGIN = window.location.origin;
  const API_BASE_URL = `${API_ORIGIN}/api`;
  const Auth = window.AdminAuth;
  const REMEMBERED_EMAIL_KEY = "mocCoffeeAdminEmail";
  const DEFAULT_PRODUCT_IMAGE =
    "../assets/images/products/default-product.jpg";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "Chưa cập nhật";

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  }

  function showToast(message, type = "success") {
    const toastElement = $("#admin-toast") || $("#login-toast");
    const messageElement =
      $("#admin-toast-message") || $("#login-toast-message");
    const iconElement = $("#admin-toast-icon");

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (iconElement) {
      iconElement.className = "bi me-2";

      if (type === "danger") {
        iconElement.classList.add("bi-x-circle-fill", "text-danger");
      } else if (type === "warning") {
        iconElement.classList.add(
          "bi-exclamation-triangle-fill",
          "text-warning"
        );
      } else {
        iconElement.classList.add(
          "bi-check-circle-fill",
          "text-success"
        );
      }
    }

    if (toastElement && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(toastElement).show();
    }
  }

  function showModal(selector) {
    const element = $(selector);

    if (element && typeof bootstrap !== "undefined") {
      bootstrap.Modal.getOrCreateInstance(element).show();
    }
  }

  function hideModal(selector) {
    const element = $(selector);

    if (element && typeof bootstrap !== "undefined") {
      bootstrap.Modal.getOrCreateInstance(element).hide();
    }
  }

  // Ba hàm dưới chỉ "nhờ" AdminAuth (admin-auth.js) lưu, đọc, xóa token
  function getToken() {
    return Auth.getToken();
  }

  function saveAuthentication(token) {
    Auth.setToken(token);
  }

  function clearAuthentication() {
    Auth.clearToken();
  }

  async function apiRequest(
    endpoint,
    { method = "GET", body, authentication = true } = {}
  ) {
    const headers = {
      Accept: "application/json",
    };

    if (authentication) {
      const token = getToken();

      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }

      headers.Authorization = `Bearer ${token}`;
    }

    let requestBody = body;

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      requestBody = JSON.stringify(body);
    }

    let response;

    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: requestBody,
      });
    } catch (error) {
      throw new Error(
        "Không thể kết nối backend. Hãy kiểm tra npm run dev."
      );
    }

    let result = {};

    try {
      result = await response.json();
    } catch (error) {
      result = {};
    }

    if (!response.ok) {
      if (authentication && (response.status === 401 || response.status === 403)) {
        clearAuthentication();

        if (!$("#admin-login-form")) {
          window.location.replace("login.html");
        }
      }

      throw new Error(result.message || `Lỗi HTTP ${response.status}`);
    }

    return result;
  }

  function getProductImageUrl(product) {
    if (product.image_url) {
      return product.image_url;
    }

    if (!product.image) {
      return DEFAULT_PRODUCT_IMAGE;
    }

    if (product.image.startsWith("/uploads/")) {
      return `${API_ORIGIN}${product.image}`;
    }

    if (/^https?:\/\//i.test(product.image)) {
      return product.image;
    }

    return `../assets/images/products/${product.image}`;
  }

  function initializeLogoutLinks() {
    $$('a[href="login.html"]').forEach((link) => {
      if (!link.textContent.includes("Đăng xuất")) return;

      link.addEventListener("click", function () {
        clearAuthentication();
      });
    });
  }

  function initializeLoginPage() {
    const form = $("#admin-login-form");

    if (!form) return;

    const emailInput = $("#login-username");
    const passwordInput = $("#login-password");
    const rememberInput = $("#remember-login");
    const errorAlert = $("#login-error-alert");
    const errorMessage = $("#login-error-message");
    const successAlert = $("#login-success-alert");
    const submitButton = $("#login-submit-button");
    const normalContent = $("#login-button-content");
    const loadingContent = $("#login-loading-content");
    const toggleButton = $("#toggle-password-button");
    const toggleIcon = $("#password-toggle-icon");

    const demoEmail = "admin@moccoffee.local";
    const demoPassword = "MocAdmin@123";

    const label = $('label[for="login-username"]');

    if (label) {
      label.innerHTML = 'Email <span class="text-danger">*</span>';
    }

    emailInput.type = "email";
    emailInput.name = "email";
    emailInput.placeholder = "Nhập email Admin";
    emailInput.autocomplete = "email";

    const rememberedEmail = localStorage.getItem(
      REMEMBERED_EMAIL_KEY
    );

    if (rememberedEmail) {
      emailInput.value = rememberedEmail;
      rememberInput.checked = true;
    }

    if ($("#demo-username")) {
      $("#demo-username").textContent = demoEmail;
    }

    if ($("#demo-password")) {
      $("#demo-password").textContent = demoPassword;
    }

    toggleButton?.addEventListener("click", function () {
      const showPassword = passwordInput.type === "password";

      passwordInput.type = showPassword ? "text" : "password";
      toggleIcon.className = showPassword
        ? "bi bi-eye-slash"
        : "bi bi-eye";
    });

    $("#fill-demo-account-button")?.addEventListener(
      "click",
      function () {
        emailInput.value = demoEmail;
        passwordInput.value = demoPassword;
        errorAlert?.classList.add("d-none");
      }
    );

    $("#copy-demo-username")?.addEventListener(
      "click",
      async function () {
        await navigator.clipboard.writeText(demoEmail);
        showToast("Đã sao chép email Admin.");
      }
    );

    $("#copy-demo-password")?.addEventListener(
      "click",
      async function () {
        await navigator.clipboard.writeText(demoPassword);
        showToast("Đã sao chép mật khẩu Admin.");
      }
    );

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      form.classList.add("was-validated");
      errorAlert?.classList.add("d-none");
      successAlert?.classList.add("d-none");

      if (!form.checkValidity()) return;

      submitButton.disabled = true;
      normalContent?.classList.add("d-none");
      loadingContent?.classList.remove("d-none");

      try {
        const result = await apiRequest("/auth/login", {
          method: "POST",
          authentication: false,
          body: {
            email: emailInput.value.trim(),
            password: passwordInput.value,
          },
        });

        if (result.data.user.role !== "admin") {
          throw new Error("Tài khoản không có quyền Admin.");
        }

        saveAuthentication(
          result.data.token,
          result.data.user,
          rememberInput.checked
        );

        successAlert?.classList.remove("d-none");

        window.setTimeout(function () {
          window.location.replace("products.html");
        }, 500);
      } catch (error) {
        errorMessage.textContent = error.message;
        errorAlert?.classList.remove("d-none");

        submitButton.disabled = false;
        normalContent?.classList.remove("d-none");
        loadingContent?.classList.add("d-none");
      }
    });
  }

  const productStatusInformation = {
    1: {
      key: "available",
      text: "Đang bán",
      className: "text-bg-success",
    },
    0: {
      key: "hidden",
      text: "Ngừng bán",
      className: "text-bg-danger",
    },
  };

  async function initializeProductsPage() {
    const tableBody = $("#product-table-body");

    if (!tableBody) return;

    const state = {
      categories: [],
      products: [],
      selectedProductId: null,
      gridMode: false,
      searchTimer: null,
    };

    const searchInput = $("#product-search-input");
    const categoryFilter = $("#product-category-filter");
    const statusFilter = $("#product-status-filter");
    const sortSelect = $("#product-sort");
    const categoryInput = $("#admin-product-category");
    const statusInput = $("#admin-product-status");
    const productForm = $("#admin-product-form");
    const imageInput = $("#admin-product-image");
    const imagePreview = $("#product-image-preview");

    statusFilter.innerHTML = `
      <option value="all">Tất cả</option>
      <option value="1">Đang bán</option>
      <option value="0">Ngừng bán</option>
    `;

    statusInput.innerHTML = `
      <option value="1">Đang bán</option>
      <option value="0">Ngừng bán</option>
    `;

    const unavailableCard = $("#unavailable-product-count")?.closest(
      ".col-12"
    );

    unavailableCard?.classList.add("d-none");

    $("#admin-product-featured")
      ?.closest(".col-12")
      ?.classList.add("d-none");

    $("#product-size-s-price")
      ?.closest(".row")
      ?.parentElement?.classList.add("d-none");

    const imageHelp = imageInput
      ?.closest(".product-image-upload")
      ?.querySelector("small");

    if (imageHelp) {
      imageHelp.textContent = "JPG, PNG hoặc WEBP. Tối đa 5MB.";
    }

    try {
      const profileResult = await apiRequest("/admin/me");

      if (profileResult.data.role !== "admin") {
        throw new Error("Tài khoản không có quyền Admin.");
      }

      const userBox = $(".admin-user-box");

      if (userBox) {
        $("strong", userBox).textContent = profileResult.data.full_name;
        $("small", userBox).textContent = profileResult.data.email;
      }
    } catch (error) {
      clearAuthentication();
      window.location.replace("login.html");
      return;
    }

    function getProductById(id) {
      return state.products.find(
        (product) => Number(product.id) === Number(id)
      );
    }

    function getVisibleProducts() {
      const selectedStatus = statusFilter.value;
      const selectedSort = sortSelect.value;

      const products = state.products.filter((product) => {
        return (
          selectedStatus === "all" ||
          Number(product.status) === Number(selectedStatus)
        );
      });

      products.sort((first, second) => {
        if (selectedSort === "name-asc") {
          return first.name.localeCompare(second.name, "vi");
        }

        if (selectedSort === "name-desc") {
          return second.name.localeCompare(first.name, "vi");
        }

        if (selectedSort === "price-asc") {
          return Number(first.price) - Number(second.price);
        }

        if (selectedSort === "price-desc") {
          return Number(second.price) - Number(first.price);
        }

        return Number(second.id) - Number(first.id);
      });

      return products;
    }

    function renderStatistics() {
      const availableCount = state.products.filter(
        (product) => Number(product.status) === 1
      ).length;

      const hiddenCount = state.products.length - availableCount;

      $("#total-product-count").textContent = state.products.length;
      $("#available-product-count").textContent = availableCount;
      $("#hidden-product-count").textContent = hiddenCount;
      $("#unavailable-product-count").textContent = 0;
    }

    function renderTable(products) {
      tableBody.innerHTML = products
        .map((product) => {
          const information =
            productStatusInformation[Number(product.status)];

          const imageUrl = getProductImageUrl(product);
          const nextStatus = Number(product.status) === 1 ? 0 : 1;
          const nextStatusText =
            nextStatus === 1 ? "Mở bán lại" : "Ngừng bán";

          return `
            <tr
              class="admin-product-row"
              data-id="${product.id}"
              data-name="${escapeHtml(product.name)}"
              data-category="${product.category_id}"
              data-price="${product.price}"
              data-status="${information.key}"
            >
              <td class="ps-4">
                <div class="d-flex align-items-center">
                  <img
                    src="${escapeHtml(imageUrl)}"
                    class="admin-product-image"
                    alt="${escapeHtml(product.name)}"
                    onerror="this.src='${DEFAULT_PRODUCT_IMAGE}'"
                  />
                  <div class="ms-3">
                    <strong>${escapeHtml(product.name)}</strong>
                    <small class="d-block text-secondary">
                      ${escapeHtml(product.description || "Chưa có mô tả")}
                    </small>
                  </div>
                </div>
              </td>
              <td>#SP${String(product.id).padStart(3, "0")}</td>
              <td>${escapeHtml(product.category_name)}</td>
              <td class="fw-semibold">${formatCurrency(product.price)}</td>
              <td>0</td>
              <td>
                <span class="badge ${information.className}">
                  ${information.text}
                </span>
              </td>
              <td class="text-center pe-4">
                <div class="dropdown">
                  <button
                    class="btn btn-sm btn-light"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <i class="bi bi-three-dots-vertical"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <button
                        type="button"
                        class="dropdown-item api-view-product"
                        data-id="${product.id}"
                      >
                        <i class="bi bi-eye me-2"></i>Xem chi tiết
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        class="dropdown-item api-edit-product"
                        data-id="${product.id}"
                      >
                        <i class="bi bi-pencil-square me-2"></i>Chỉnh sửa
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        class="dropdown-item api-toggle-product"
                        data-id="${product.id}"
                        data-status="${nextStatus}"
                      >
                        <i class="bi bi-arrow-repeat me-2"></i>${nextStatusText}
                      </button>
                    </li>
                    <li><hr class="dropdown-divider" /></li>
                    <li>
                      <button
                        type="button"
                        class="dropdown-item text-danger api-delete-product"
                        data-id="${product.id}"
                      >
                        <i class="bi bi-trash3 me-2"></i>Xóa món
                      </button>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      $("#visible-product-count").textContent = products.length;
      $("#empty-product-result").classList.toggle(
        "d-none",
        products.length !== 0
      );
    }

    function renderGrid(products) {
      const container = $("#product-grid-container");

      container.innerHTML = `
        <div class="row g-4">
          ${products
            .map((product) => {
              const information =
                productStatusInformation[Number(product.status)];

              return `
                <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
                  <div class="card h-100 border-0 shadow-sm">
                    <img
                      src="${escapeHtml(getProductImageUrl(product))}"
                      class="card-img-top admin-grid-product-image"
                      alt="${escapeHtml(product.name)}"
                      onerror="this.src='${DEFAULT_PRODUCT_IMAGE}'"
                    />
                    <div class="card-body">
                      <h3 class="h5">${escapeHtml(product.name)}</h3>
                      <p class="fw-bold text-danger">
                        ${formatCurrency(product.price)}
                      </p>
                      <span class="badge ${information.className}">
                        ${information.text}
                      </span>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    function renderProducts() {
      const products = getVisibleProducts();

      renderStatistics();
      renderTable(products);

      if (state.gridMode) {
        renderGrid(products);
      }
    }

    async function loadCategories() {
      const result = await apiRequest("/categories/admin");

      state.categories = result.data;

      categoryFilter.innerHTML = `
        <option value="all">Tất cả danh mục</option>
        ${state.categories
          .map(
            (category) => `
              <option value="${category.id}">
                ${escapeHtml(category.name)}
              </option>
            `
          )
          .join("")}
      `;

      categoryInput.innerHTML = `
        <option value="" selected disabled>Chọn danh mục</option>
        ${state.categories
          .map(
            (category) => `
              <option value="${category.id}">
                ${escapeHtml(category.name)}
              </option>
            `
          )
          .join("")}
      `;
    }

    async function loadProducts() {
      const params = new URLSearchParams();
      const keyword = searchInput.value.trim();

      if (keyword) {
        params.set("search", keyword);
      }

      if (categoryFilter.value !== "all") {
        params.set("category_id", categoryFilter.value);
      }

      const query = params.toString();
      const result = await apiRequest(
        `/products/admin${query ? `?${query}` : ""}`
      );

      state.products = result.data;
      renderProducts();
    }

    function resetProductForm() {
      productForm.reset();
      productForm.classList.remove("was-validated");
      $("#admin-product-id").value = "";
      $("#product-form-title").textContent = "Thêm món mới";
      $("#product-description-count").textContent = "0";
      imagePreview.src = DEFAULT_PRODUCT_IMAGE;
      imageInput.value = "";
      statusInput.value = "1";
      $("#submit-product-button-label").textContent = "Thêm món";
    }

    function openProductDetail(product) {
      state.selectedProductId = product.id;
      $("#detail-product-id").textContent = `#SP${String(
        product.id
      ).padStart(3, "0")}`;
      $("#detail-product-name").textContent = product.name;
      $("#detail-product-category").textContent =
        product.category_name;
      $("#detail-product-price").textContent = formatCurrency(
        product.price
      );
      $("#detail-product-description").textContent =
        product.description || "Chưa có mô tả.";
      $("#detail-product-sold").textContent = "Chưa thống kê";
      $("#detail-product-featured").textContent = "Chưa hỗ trợ";
      $("#detail-product-updated").textContent = formatDate(
        product.updated_at
      );

      const information =
        productStatusInformation[Number(product.status)];

      $("#detail-product-status").className =
        `badge ${information.className}`;
      $("#detail-product-status").textContent = information.text;
      $("#detail-product-image").src = getProductImageUrl(product);
      $("#detail-product-image").alt = product.name;
      $("#detail-edit-product-button").dataset.id = product.id;

      showModal("#product-detail-modal");
    }

    function openProductEdit(product) {
      $("#product-form-title").textContent =
        `Chỉnh sửa ${product.name}`;
      $("#admin-product-id").value = product.id;
      $("#admin-product-name").value = product.name;
      categoryInput.value = product.category_id;
      $("#admin-product-price").value = Number(product.price);
      $("#admin-product-description").value =
        product.description || "";
      $("#product-description-count").textContent = String(
        (product.description || "").length
      );
      statusInput.value = String(Number(product.status));
      imageInput.value = "";
      imagePreview.src = getProductImageUrl(product);
      productForm.classList.remove("was-validated");
      $("#submit-product-button-label").textContent = "Lưu thay đổi";

      showModal("#product-form-modal");
    }

    await loadCategories();
    await loadProducts();

    searchInput.addEventListener("input", function () {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(function () {
        loadProducts().catch((error) =>
          showToast(error.message, "danger")
        );
      }, 350);
    });

    categoryFilter.addEventListener("change", function () {
      loadProducts().catch((error) =>
        showToast(error.message, "danger")
      );
    });

    statusFilter.addEventListener("change", renderProducts);
    sortSelect.addEventListener("change", renderProducts);

    $("#reset-product-filter")?.addEventListener(
      "click",
      function () {
        searchInput.value = "";
        categoryFilter.value = "all";
        statusFilter.value = "all";
        sortSelect.value = "default";

        loadProducts().catch((error) =>
          showToast(error.message, "danger")
        );
      }
    );

    $("#product-list-view")?.addEventListener("click", function () {
      state.gridMode = false;
      $("#product-table-view").classList.remove("d-none");
      $("#product-grid-container").classList.add("d-none");
      this.className = "btn btn-coffee";
      $("#product-grid-view").className = "btn btn-outline-coffee";
    });

    $("#product-grid-view")?.addEventListener("click", function () {
      state.gridMode = true;
      renderGrid(getVisibleProducts());
      $("#product-table-view").classList.add("d-none");
      $("#product-grid-container").classList.remove("d-none");
      this.className = "btn btn-coffee";
      $("#product-list-view").className = "btn btn-outline-coffee";
    });

    $("#open-add-product-button")?.addEventListener(
      "click",
      resetProductForm
    );

    $("#admin-product-description")?.addEventListener(
      "input",
      function () {
        $("#product-description-count").textContent =
          this.value.length;
      }
    );

    imageInput?.addEventListener("change", function () {
      const file = this.files[0];

      if (!file) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

      if (!allowedTypes.includes(file.type)) {
        showToast("Chỉ chấp nhận JPG, PNG hoặc WEBP.", "warning");
        this.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("Ảnh không được vượt quá 5MB.", "warning");
        this.value = "";
        return;
      }

      imagePreview.src = URL.createObjectURL(file);
    });

    tableBody.addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-id]");

      if (!button) return;

      const product = getProductById(button.dataset.id);

      if (!product) return;

      if (button.classList.contains("api-view-product")) {
        openProductDetail(product);
        return;
      }

      if (button.classList.contains("api-edit-product")) {
        openProductEdit(product);
        return;
      }

      if (button.classList.contains("api-delete-product")) {
        $("#delete-product-id").value = product.id;
        $("#delete-product-name").textContent = product.name;
        showModal("#delete-product-modal");
        return;
      }

      if (button.classList.contains("api-toggle-product")) {
        const formData = new FormData();
        formData.append("status", button.dataset.status);

        try {
          await apiRequest(`/products/${product.id}`, {
            method: "PUT",
            body: formData,
          });

          showToast("Đã cập nhật trạng thái món.");
          await loadProducts();
        } catch (error) {
          showToast(error.message, "danger");
        }
      }
    });

    $("#detail-edit-product-button")?.addEventListener(
      "click",
      function () {
        const product = getProductById(this.dataset.id);

        if (!product) return;

        hideModal("#product-detail-modal");
        window.setTimeout(() => openProductEdit(product), 200);
      }
    );

    productForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      productForm.classList.add("was-validated");

      if (!productForm.checkValidity()) return;

      const productId = $("#admin-product-id").value;
      const formData = new FormData();

      formData.append("name", $("#admin-product-name").value.trim());
      formData.append("category_id", categoryInput.value);
      formData.append("price", $("#admin-product-price").value);
      formData.append(
        "description",
        $("#admin-product-description").value.trim()
      );
      formData.append("status", statusInput.value);

      if (imageInput.files[0]) {
        formData.append("image", imageInput.files[0]);
      }

      const submitButton = $('button[type="submit"]', productForm);
      submitButton.disabled = true;

      try {
        await apiRequest(
          productId ? `/products/${productId}` : "/products",
          {
            method: productId ? "PUT" : "POST",
            body: formData,
          }
        );

        hideModal("#product-form-modal");
        showToast(
          productId
            ? "Cập nhật sản phẩm thành công."
            : "Thêm sản phẩm thành công."
        );

        await loadProducts();
      } catch (error) {
        showToast(error.message, "danger");
      } finally {
        submitButton.disabled = false;
      }
    });

    $("#confirm-delete-product")?.addEventListener(
      "click",
      async function () {
        const productId = $("#delete-product-id").value;

        if (!productId) return;

        this.disabled = true;

        try {
          await apiRequest(`/products/${productId}`, {
            method: "DELETE",
          });

          hideModal("#delete-product-modal");
          showToast("Xóa sản phẩm thành công.");
          await loadProducts();
        } catch (error) {
          showToast(error.message, "danger");
        } finally {
          this.disabled = false;
        }
      }
    );
  }

  initializeLogoutLinks();
  initializeLoginPage();

  initializeProductsPage().catch((error) => {
    if (error.message === "AUTH_REQUIRED") {
      clearAuthentication();
      window.location.replace("login.html");
      return;
    }

    showToast(error.message, "danger");
  });
});
