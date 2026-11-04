"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const productList = document.querySelector("#product-list");
  const searchInput = document.querySelector("#search-input");
  const clearSearchButton = document.querySelector("#clear-search");
  const categoryFilter = document.querySelector("#category-filter");
  const sortFilter = document.querySelector("#sort-filter");
  const resetFilterButton = document.querySelector("#reset-filter");
  const categoryButtons = document.querySelector("#category-buttons");
  const productCountElement = document.querySelector("#product-count");
  const emptyResult = document.querySelector("#empty-result");
  const emptyResetFilterButton = document.querySelector("#empty-reset-filter");
  const cartToast = document.querySelector("#cart-toast");

  if (!productList || !window.MocCoffeeApi) return;

  const CATEGORY_ALIASES = {
    coffee: "ca-phe",
    tea: "tra-trai-cay",
    "ice-blended": "da-xay",
    cake: "banh-ngot",
  };

  const CATEGORY_ICONS = {
    "ca-phe": "bi-cup-hot",
    "tra-trai-cay": "bi-cup-straw",
    "da-xay": "bi-snow",
    "banh-ngot": "bi-cake2",
  };

  let products = [];
  let selectedCategory = "all";
  let searchTimer;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return window.MocCoffee?.normalizeText
      ? window.MocCoffee.normalizeText(value)
      : String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
  }

  function createCategoryKey(value) {
    return normalizeText(value)
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatCurrency(value) {
    return window.MocCoffee?.formatCurrency
      ? window.MocCoffee.formatCurrency(value)
      : new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(Number(value) || 0);
  }

  function getCategories() {
    const map = new Map();

    products.forEach(function (product) {
      const key = createCategoryKey(product.categoryName);

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: product.categoryName,
        });
      }
    });

    return Array.from(map.values());
  }

  function updateCategoryButtons() {
    categoryButtons
      ?.querySelectorAll(".category-btn")
      .forEach(function (button) {
        const active = button.dataset.category === selectedCategory;

        button.classList.toggle("active", active);
        button.classList.toggle("btn-coffee", active);
        button.classList.toggle("btn-outline-coffee", !active);
      });
  }

  function renderCategoryControls() {
    const categories = getCategories();

    if (categoryFilter) {
      categoryFilter.innerHTML = [
        '<option value="all">Tất cả danh mục</option>',
        ...categories.map(
          (category) =>
            `<option value="${category.key}">${escapeHTML(category.name)}</option>`
        ),
      ].join("");
    }

    if (categoryButtons) {
      categoryButtons.innerHTML = [
        '<button type="button" class="btn category-btn" data-category="all">Tất cả</button>',
        ...categories.map(function (category) {
          const icon = CATEGORY_ICONS[category.key] || "bi-tag";

          return `
            <button
              type="button"
              class="btn category-btn"
              data-category="${category.key}"
            >
              <i class="bi ${icon} me-1"></i>
              ${escapeHTML(category.name)}
            </button>
          `;
        }),
      ].join("");
    }

    updateCategoryButtons();
  }

  function getVisibleProducts() {
    const keyword = normalizeText(searchInput?.value);

    const filtered = products.filter(function (product) {
      const categoryKey = createCategoryKey(product.categoryName);

      const matchesCategory =
        selectedCategory === "all" ||
        categoryKey === selectedCategory;

      const matchesSearch =
        !keyword ||
        normalizeText(product.name).includes(keyword) ||
        normalizeText(product.description).includes(keyword);

      return matchesCategory && matchesSearch;
    });

    const sortValue = sortFilter?.value || "default";

    return [...filtered].sort(function (first, second) {
      if (sortValue === "name-asc") {
        return first.name.localeCompare(second.name, "vi");
      }

      if (sortValue === "name-desc") {
        return second.name.localeCompare(first.name, "vi");
      }

      if (sortValue === "price-asc") {
        return first.price - second.price;
      }

      if (sortValue === "price-desc") {
        return second.price - first.price;
      }

      return second.id - first.id;
    });
  }

  function renderProducts() {
    const visibleProducts = getVisibleProducts();

    if (productCountElement) {
      productCountElement.textContent = visibleProducts.length;
    }

    emptyResult?.classList.toggle(
      "d-none",
      visibleProducts.length > 0
    );

    productList.innerHTML = visibleProducts
      .map(function (product) {
        return `
          <div
            class="col-12 col-sm-6 col-lg-4 col-xl-3 product-item"
            data-id="${product.id}"
            data-name="${escapeHTML(product.name)}"
            data-category="${createCategoryKey(product.categoryName)}"
            data-price="${product.price}"
          >
            <article class="card product-card h-100">
              <div class="position-relative">
                <img
                  src="${escapeHTML(product.image)}"
                  class="card-img-top"
                  alt="${escapeHTML(product.name)}"
                  data-product-image
                  loading="lazy"
                />
              </div>

              <div class="card-body d-flex flex-column">
                <p class="small text-secondary mb-1">
                  ${escapeHTML(product.categoryName)}
                </p>

                <h3 class="card-title h5">
                  ${escapeHTML(product.name)}
                </h3>

                <p class="card-text text-secondary">
                  ${escapeHTML(
                    product.description || "Món ngon tại Mộc Coffee."
                  )}
                </p>

                <div class="mt-auto">
                  <p class="fw-bold text-danger fs-5 mb-3">
                    ${formatCurrency(product.price)}
                  </p>

                  <div class="d-flex gap-2">
                    <a
                      href="product-detail.html?id=${product.id}"
                      class="btn btn-outline-coffee flex-grow-1"
                    >
                      Chi tiết
                    </a>

                    <button
                      type="button"
                      class="btn btn-coffee add-to-cart"
                      data-product-id="${product.id}"
                      title="Thêm vào giỏ hàng"
                    >
                      <i class="bi bi-cart-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        `;
      })
      .join("");
  }

  function showCartToast(productName) {
    const message = cartToast?.querySelector(".toast-body");

    if (message) {
      message.textContent = `Đã thêm "${productName}" vào giỏ hàng.`;
    }

    if (cartToast && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(cartToast).show();
    }
  }

  function addProductToCart(productId, button) {
    const product = products.find(
      (item) => Number(item.id) === Number(productId)
    );

    if (!product || !window.MocCoffee?.addToCart) return;

    window.MocCoffee.addToCart({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
      size: "M",
      sugar: "70%",
      ice: "70%",
      toppings: [],
      note: "",
    });

    showCartToast(product.name);

    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-check-lg"></i>';

    window.setTimeout(function () {
      button.disabled = false;
      button.innerHTML = original;
    }, 800);
  }

  function updateUrl() {
    const url = new URL(window.location.href);

    if (selectedCategory === "all") {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set("category", selectedCategory);
    }

    window.history.replaceState({}, "", url);
  }

  function selectCategory(category, shouldUpdateUrl = true) {
    const available = [
      "all",
      ...getCategories().map((item) => item.key),
    ];

    selectedCategory = available.includes(category)
      ? category
      : "all";

    if (categoryFilter) {
      categoryFilter.value = selectedCategory;
    }

    updateCategoryButtons();
    renderProducts();

    if (shouldUpdateUrl) {
      updateUrl();
    }
  }

  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (sortFilter) sortFilter.value = "default";

    selectCategory("all");
  }

  productList.addEventListener("click", function (event) {
    const button = event.target.closest(".add-to-cart");

    if (button) {
      addProductToCart(button.dataset.productId, button);
    }
  });

  productList.addEventListener(
    "error",
    function (event) {
      if (
        event.target instanceof HTMLImageElement &&
        event.target.matches("[data-product-image]") &&
        event.target.dataset.fallbackApplied !== "true"
      ) {
        event.target.dataset.fallbackApplied = "true";
        event.target.src =
          "../assets/images/products/default-product.jpg";
      }
    },
    true
  );

  categoryButtons?.addEventListener("click", function (event) {
    const button = event.target.closest(".category-btn");

    if (button) {
      selectCategory(button.dataset.category);
    }
  });

  categoryFilter?.addEventListener("change", function () {
    selectCategory(this.value);
  });

  searchInput?.addEventListener("input", function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderProducts, 150);
  });

  clearSearchButton?.addEventListener("click", function () {
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    renderProducts();
  });

  sortFilter?.addEventListener("change", renderProducts);
  resetFilterButton?.addEventListener("click", resetFilters);
  emptyResetFilterButton?.addEventListener("click", resetFilters);

  async function initialize() {
    productList.innerHTML = `
      <div class="col-12 text-center py-5">
        <div
          class="spinner-border text-secondary"
          role="status"
        ></div>
        <p class="text-secondary mt-3 mb-0">
          Đang tải thực đơn...
        </p>
      </div>
    `;

    try {
      const rawProducts = await window.MocCoffeeApi.getProducts();

      products = rawProducts.map((product) =>
        window.MocCoffeeApi.normalizeProduct(product, true)
      );

      const urlCategory = new URLSearchParams(
        window.location.search
      ).get("category");

      selectedCategory =
        CATEGORY_ALIASES[urlCategory] || urlCategory || "all";

      renderCategoryControls();
      selectCategory(selectedCategory, false);
    } catch (error) {
      if (productCountElement) {
        productCountElement.textContent = "0";
      }

      emptyResult?.classList.add("d-none");

      productList.innerHTML = `
        <div class="col-12">
          <div
            class="alert alert-danger text-center"
            role="alert"
          >
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${escapeHTML(error.message)}
            <div class="small mt-2">
              Hãy kiểm tra kết nối và API sản phẩm của backend.
            </div>
          </div>
        </div>
      `;
    }
  }

  initialize();
});