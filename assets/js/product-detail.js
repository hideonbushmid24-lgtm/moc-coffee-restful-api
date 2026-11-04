"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const detailContent = document.querySelector("#product-detail-content");
  const notFound = document.querySelector("#product-not-found");
  const form = document.querySelector("#product-option-form");
  const productImage = document.querySelector("#product-main-image");
  const thumbnails = document.querySelector("#product-thumbnails");
  const productBadge = document.querySelector("#product-badge");
  const productName = document.querySelector("#product-name");
  const breadcrumbName = document.querySelector("#breadcrumb-product-name");
  const productCategory = document.querySelector("#product-category");
  const productPrice = document.querySelector("#product-price");
  const productOldPrice = document.querySelector("#product-old-price");
  const productDescription = document.querySelector("#product-description");
  const quantityInput = document.querySelector("#product-quantity");
  const decreaseButton = document.querySelector("#decrease-product-quantity");
  const increaseButton = document.querySelector("#increase-product-quantity");
  const totalPrice = document.querySelector("#product-total-price");
  const noteInput = document.querySelector("#product-note");
  const noteCount = document.querySelector("#product-note-count");
  const relatedList = document.querySelector("#related-product-list");
  const cartToast = document.querySelector("#cart-toast");

  if (!form || !window.MocCoffeeApi) return;

  const productId = new URLSearchParams(window.location.search).get("id");
  const fallbackImage = "../assets/images/products/default-product.jpg";

  let currentProduct = null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function getQuantity() {
    const value = Number(quantityInput?.value || 1);

    return Math.min(
      99,
      Math.max(1, Number.isInteger(value) ? value : 1)
    );
  }

  function getSelectedSize() {
    const selected = form.querySelector(
      'input[name="productSize"]:checked'
    );

    return {
      name: selected?.value || "M",
      extraPrice: Number(selected?.dataset.extraPrice || 0),
    };
  }

  function getSelectedToppings() {
    return Array.from(
      form.querySelectorAll(".topping-checkbox:checked")
    ).map(function (topping) {
      return {
        name: topping.value,
        price: Number(topping.dataset.price || 0),
      };
    });
  }

  function calculateUnitPrice() {
    if (!currentProduct) return 0;

    const toppingPrice = getSelectedToppings().reduce(
      (total, topping) => total + topping.price,
      0
    );

    return Math.max(
      0,
      currentProduct.price +
        getSelectedSize().extraPrice +
        toppingPrice
    );
  }

  function updatePrice() {
    const unitPrice = calculateUnitPrice();
    const quantity = getQuantity();

    if (quantityInput) {
      quantityInput.value = quantity;
    }

    if (productPrice) {
      productPrice.textContent = formatCurrency(unitPrice);
    }

    if (totalPrice) {
      totalPrice.textContent = formatCurrency(unitPrice * quantity);
    }
  }

  function showToast(message) {
    const body = cartToast?.querySelector(".toast-body");

    if (body) {
      body.textContent = message;
    }

    if (cartToast && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(cartToast).show();
    }
  }

  function applyFallback(image) {
    if (
      !(image instanceof HTMLImageElement) ||
      image.dataset.fallbackApplied === "true"
    ) {
      return;
    }

    image.dataset.fallbackApplied = "true";
    image.src = fallbackImage;
  }

  function renderProduct() {
    document.title = `${currentProduct.name} | Mộc Coffee`;

    if (productName) {
      productName.textContent = currentProduct.name;
    }

    if (breadcrumbName) {
      breadcrumbName.textContent = currentProduct.name;
    }

    if (productCategory) {
      productCategory.textContent = currentProduct.categoryName;
    }

    if (productDescription) {
      productDescription.textContent =
        currentProduct.description || "Món ngon tại Mộc Coffee.";
    }

    if (productImage) {
      delete productImage.dataset.fallbackApplied;
      productImage.src = currentProduct.image;
      productImage.alt = currentProduct.name;
    }

    productOldPrice?.classList.add("d-none");
    productBadge?.classList.add("d-none");

    if (thumbnails) {
      thumbnails.innerHTML = `
        <button
          type="button"
          class="product-thumbnail active"
          data-image="${escapeHTML(currentProduct.image)}"
        >
          <img
            src="${escapeHTML(currentProduct.image)}"
            alt="${escapeHTML(currentProduct.name)}"
          />
        </button>
      `;
    }

    if (noteCount) {
      noteCount.textContent = noteInput?.value.length || 0;
    }

    updatePrice();
    detailContent?.classList.remove("d-none");
    notFound?.classList.add("d-none");
  }

  function renderRelated(rawProducts) {
    if (!relatedList) return;

    const products = rawProducts
      .map((product) =>
        window.MocCoffeeApi.normalizeProduct(product, true)
      )
      .filter((product) => product.id !== currentProduct.id)
      .sort(function (first, second) {
        const firstSame =
          first.categoryId === currentProduct.categoryId ? 0 : 1;

        const secondSame =
          second.categoryId === currentProduct.categoryId ? 0 : 1;

        return firstSame - secondSame;
      })
      .slice(0, 4);

    relatedList.innerHTML = products
      .map(function (product) {
        return `
          <div class="col-12 col-sm-6 col-lg-3">
            <article class="card product-card h-100">
              <img
                src="${escapeHTML(product.image)}"
                class="card-img-top"
                alt="${escapeHTML(product.name)}"
                data-related-image
                loading="lazy"
              />

              <div class="card-body d-flex flex-column">
                <p class="small text-secondary mb-1">
                  ${escapeHTML(product.categoryName)}
                </p>

                <h3 class="h5">
                  ${escapeHTML(product.name)}
                </h3>

                <p class="text-secondary">
                  ${escapeHTML(
                    product.description || "Món ngon tại Mộc Coffee."
                  )}
                </p>

                <div
                  class="d-flex justify-content-between align-items-center mt-auto"
                >
                  <strong class="text-danger">
                    ${formatCurrency(product.price)}
                  </strong>

                  <a
                    href="product-detail.html?id=${product.id}"
                    class="btn btn-sm btn-coffee"
                  >
                    Xem món
                  </a>
                </div>
              </div>
            </article>
          </div>
        `;
      })
      .join("");
  }

  function showUnavailable(message) {
    currentProduct = null;
    detailContent?.classList.add("d-none");
    notFound?.classList.remove("d-none");

    const paragraph = notFound?.querySelector("p");

    if (paragraph && message) {
      paragraph.textContent = message;
    }

    if (relatedList) {
      relatedList.innerHTML = "";
    }
  }

  function addToCart() {
    if (!currentProduct) return;

    if (!window.MocCoffee?.addToCart) {
      window.alert("Chưa tải được chức năng giỏ hàng. Vui lòng tải lại trang.");
      return;
    }

    const item = window.MocCoffee.addToCart({
      id: currentProduct.id,
      name: currentProduct.name,
      image: currentProduct.image,
      price: calculateUnitPrice(),
      quantity: getQuantity(),
      size: getSelectedSize().name,
      sugar: form.querySelector("#sugar-level")?.value || "70%",
      ice: form.querySelector("#ice-level")?.value || "70%",
      toppings: getSelectedToppings(),
      note: noteInput?.value.trim() || "",
    });

    showToast(`Đã thêm "${item.name}" vào giỏ hàng.`);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    updatePrice();

    try {
      addToCart();
    } catch (error) {
      console.error("Không thể thêm sản phẩm vào giỏ:", error);
      window.alert("Không thể lưu giỏ hàng. Vui lòng kiểm tra trình duyệt.");
    }
  });

  decreaseButton?.addEventListener("click", function () {
    if (!quantityInput) return;

    quantityInput.value = Math.max(1, getQuantity() - 1);
    updatePrice();
  });

  increaseButton?.addEventListener("click", function () {
    if (!quantityInput) return;

    quantityInput.value = Math.min(99, getQuantity() + 1);
    updatePrice();
  });

  quantityInput?.addEventListener("change", updatePrice);

  form
    .querySelectorAll('input[name="productSize"], .topping-checkbox')
    .forEach(function (input) {
      input.addEventListener("change", updatePrice);
    });

  noteInput?.addEventListener("input", function () {
    if (noteCount) {
      noteCount.textContent = this.value.length;
    }
  });

  thumbnails?.addEventListener("click", function (event) {
    const button = event.target.closest(".product-thumbnail");

    if (!button || !productImage) return;

    delete productImage.dataset.fallbackApplied;
    productImage.src = button.dataset.image || fallbackImage;

    thumbnails
      .querySelectorAll(".product-thumbnail")
      .forEach(function (item) {
        item.classList.toggle("active", item === button);
      });
  });

  productImage?.addEventListener("error", function () {
    applyFallback(this);
  });

  thumbnails?.addEventListener(
    "error",
    function (event) {
      applyFallback(event.target);
    },
    true
  );

  relatedList?.addEventListener(
    "error",
    function (event) {
      if (
        event.target instanceof HTMLImageElement &&
        event.target.matches("[data-related-image]")
      ) {
        applyFallback(event.target);
      }
    },
    true
  );

  async function initialize() {
    if (
      !productId ||
      !/^[1-9]\d*$/.test(productId) ||
      !Number.isSafeInteger(Number(productId))
    ) {
      showUnavailable("ID sản phẩm không hợp lệ.");
      return;
    }

    detailContent?.classList.add("d-none");
    notFound?.classList.add("d-none");

    if (relatedList) {
      relatedList.innerHTML = "";
    }

    try {
      const rawProduct =
        await window.MocCoffeeApi.getProductById(productId);

      if (!rawProduct || Number(rawProduct.id) !== Number(productId)) {
        throw new Error("Không tìm thấy sản phẩm.");
      }

      currentProduct = window.MocCoffeeApi.normalizeProduct(
        rawProduct,
        true
      );

      renderProduct();
    } catch (error) {
      showUnavailable(error.message || "Không thể tải sản phẩm.");
      return;
    }

    try {
      const rawProducts = await window.MocCoffeeApi.getProducts();
      renderRelated(rawProducts);
    } catch (error) {
      console.error("Không thể tải món liên quan:", error);

      if (relatedList) {
        relatedList.innerHTML = `
          <div class="col-12">
            <p class="text-secondary">
              Chưa tải được món liên quan. Vui lòng thử lại sau.
            </p>
          </div>
        `;
      }
    }
  }

  initialize();
});