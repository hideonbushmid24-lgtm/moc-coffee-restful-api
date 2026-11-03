"use strict";

(function () {
  const API_ORIGIN = window.location.origin;
  const API_BASE_URL = `${API_ORIGIN}/api`;

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json; charset=utf-8" }
          : {}),
        ...(options.headers || {}),
      },
      body: options.body
        ? JSON.stringify(options.body)
        : undefined,
    });

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Phản hồi từ máy chủ không hợp lệ.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || "Không thể kết nối đến máy chủ."
      );
    }

    return result;
  }

  function resolveProductImage(product, insidePages = true) {
    const fallback = insidePages
      ? "../assets/images/products/default-product.jpg"
      : "assets/images/products/default-product.jpg";

    const image = product?.image_url || product?.image || "";

    if (!image) {
      return fallback;
    }

    if (/^https?:\/\//i.test(image)) {
      return image;
    }

    if (image.startsWith("/uploads/")) {
      return `${API_ORIGIN}${image}`;
    }

    if (image.startsWith("assets/")) {
      return insidePages ? `../${image}` : image;
    }

    if (image.startsWith("../assets/")) {
      return insidePages ? image : image.replace(/^\.\.\//, "");
    }

    return insidePages
      ? `../assets/images/products/${image}`
      : `assets/images/products/${image}`;
  }

  function normalizeProduct(product, insidePages = true) {
    return {
      id: Number(product.id),
      categoryId: Number(product.category_id),
      categoryName: product.category_name || "Chưa phân loại",
      name: product.name || "Sản phẩm",
      slug: product.slug || String(product.id),
      description: product.description || "",
      price: Number(product.price) || 0,
      image: resolveProductImage(product, insidePages),
      status: Number(product.status ?? 1),
    };
  }

  async function getProducts(options = {}) {
    const searchParams = new URLSearchParams();

    if (options.search) {
      searchParams.set("search", options.search);
    }

    if (options.categoryId) {
      searchParams.set("category_id", options.categoryId);
    }

    const query = searchParams.toString();
    const result = await request(
      `/products${query ? `?${query}` : ""}`
    );

    return result.data || [];
  }

  async function getProductById(productId) {
    const result = await request(
      `/products/${encodeURIComponent(productId)}`
    );

    return result.data;
  }

  async function createOrder(order) {
    const result = await request("/orders", {
      method: "POST",
      body: order,
    });

    return result.data;
  }

  // Gửi yêu cầu đặt bàn lên server
  async function createBooking(booking) {
    const result = await request("/bookings", {
      method: "POST",
      body: booking,
    });

    return result.data;
  }

  window.MocCoffeeApi = {
    API_ORIGIN,
    API_BASE_URL,
    request,
    resolveProductImage,
    normalizeProduct,
    getProducts,
    getProductById,
    createOrder,
    createBooking,
  };
})();
