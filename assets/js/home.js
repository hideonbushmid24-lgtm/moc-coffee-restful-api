"use strict";

document.addEventListener("DOMContentLoaded", async function () {
  const productList = document.querySelector(
    "#featured-product-list"
  );

  if (!productList || !window.MocCoffeeApi) {
    return;
  }

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

  function renderProducts(products) {
    productList.innerHTML = products
      .slice(0, 4)
      .map(function (rawProduct, index) {
        const product = window.MocCoffeeApi.normalizeProduct(
          rawProduct,
          false
        );

        return `
          <div class="col-12 col-sm-6 col-lg-3">
            <article class="card product-card h-100">
              <div class="position-relative">
                <img
                  src="${escapeHTML(product.image)}"
                  class="card-img-top"
                  alt="${escapeHTML(product.name)}"
                  data-product-image
                  loading="lazy" 
                />
                ${index === 0
                  ? '<span class="badge bg-danger position-absolute top-0 start-0 m-3">Nổi bật</span>'
                  : ""}
              </div>
              <div class="card-body d-flex flex-column">
                <p class="small text-secondary mb-1">
                  ${escapeHTML(product.categoryName)}
                </p>
                <h3 class="card-title h5">
                  ${escapeHTML(product.name)}
                </h3>
                <p class="card-text text-secondary">
                  ${escapeHTML(product.description || "Món ngon tại Mộc Coffee.")}
                </p>
                <div class="d-flex justify-content-between align-items-center gap-2 mt-auto">
                  <span class="fw-bold text-danger">
                    ${formatCurrency(product.price)}
                  </span>
                  <div class="d-flex gap-2">
                    <a
                      href="pages/product-detail.html?id=${product.id}"
                      class="btn btn-outline-coffee btn-sm"
                    >
                      Chi tiết
                    </a>
                    <button
                      type="button"
                      class="btn btn-coffee btn-sm home-add-to-cart"
                      data-product-id="${product.id}"
                      aria-label="Thêm ${escapeHTML(product.name)} vào giỏ"
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

    productList
      .querySelectorAll("[data-product-image]")
      .forEach(function (image) {
        image.addEventListener("error", function () {
          this.src =
            "assets/images/products/default-product.jpg";
        }, { once: true });
      });

    productList
      .querySelectorAll(".home-add-to-cart")
      .forEach(function (button) {
        button.addEventListener("click", function () {
          const product = products.find(
            (item) =>
              Number(item.id) ===
              Number(this.dataset.productId)
          );

          if (!product || !window.MocCoffee?.addToCart) {
            return;
          }

          const normalized =
            window.MocCoffeeApi.normalizeProduct(
              product,
              false
            );

          window.MocCoffee.addToCart({
            id: normalized.id,
            name: normalized.name,
            image: normalized.image,
            price: normalized.price,
            quantity: 1,
            size: "M",
            sugar: "70%",
            ice: "70%",
            toppings: [],
            note: "",
          });

          const original = this.innerHTML;
          this.disabled = true;
          this.innerHTML = '<i class="bi bi-check-lg"></i>';

          window.setTimeout(() => {
            this.disabled = false;
            this.innerHTML = original;
          }, 800);
        });
      });
  }

  try {
    productList.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="spinner-border text-secondary" role="status"></div>
        <p class="text-secondary mt-3 mb-0">Đang tải món nổi bật...</p>
      </div>
    `;

    const products = await window.MocCoffeeApi.getProducts();

    if (products.length > 0) {
      renderProducts(products);
    } else {
      productList.innerHTML = `
        <div class="col-12 text-center text-secondary py-5">
          Hiện chưa có sản phẩm đang bán.
        </div>
      `;
    }
  } catch (error) {
    console.error(
      "Không thể tải món nổi bật từ API:",
      error
    );
    productList.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger text-center mb-0" role="alert">
          Không thể tải món nổi bật. Vui lòng thử lại sau.
        </div>
      </div>
    `;
  }
});
