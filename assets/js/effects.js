"use strict";

/* =========================================================
   EFFECTS.JS - MỘC COFFEE
   Hiệu ứng giao diện trang chủ. Không phụ thuộc main.js,
   an toàn khi chạy cùng main.js / home.js.
========================================================= */

(function () {
  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- 1. Hiện dần khi cuộn ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");

    if (!items.length) {
      return;
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });

    // Các thẻ món nổi bật do home.js tạo lại sau khi tải API
    var list = document.getElementById("featured-product-list");

    if (list) {
      new MutationObserver(function () {
        list
          .querySelectorAll(".col-12:not(.reveal)")
          .forEach(function (col, i) {
            col.classList.add("reveal");
            col.style.setProperty("--d", i * 0.09 + "s");
            observer.observe(col);
          });
      }).observe(list, { childList: true });
    }
  }

  /* ---------- 2. Navbar đổi nền khi cuộn + thanh tiến độ ---------- */
  function initScroll() {
    var navbar = document.querySelector(".navbar");
    var bar = document.querySelector(".scroll-progress");
    var ticking = false;

    function update() {
      var y = window.scrollY || document.documentElement.scrollTop;
      var max =
        document.documentElement.scrollHeight - window.innerHeight;

      if (navbar) {
        navbar.classList.toggle("is-scrolled", y > 40);
      }

      if (bar && max > 0) {
        bar.style.transform = "scaleX(" + Math.min(y / max, 1) + ")";
      }

      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  }

  /* ---------- 3. Hiệu ứng nghiêng nhẹ theo chuột (card) ---------- */
  function initTilt() {
    if (
      reduceMotion ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }

    document.addEventListener("mousemove", function (event) {
      var card = event.target.closest(".feature-card, .process-card");

      if (!card) {
        return;
      }

      var rect = card.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;

      card.style.transform =
        "perspective(900px) rotateX(" +
        (-y * 5).toFixed(2) +
        "deg) rotateY(" +
        (x * 6).toFixed(2) +
        "deg) translateY(-8px)";
    });

    document.addEventListener(
      "mouseout",
      function (event) {
        var card = event.target.closest(".feature-card, .process-card");

        if (card && !card.contains(event.relatedTarget)) {
          card.style.transform = "";
        }
      },
      true
    );
  }

  /* ---------- 4. Banner: tự chuyển slide + kéo chuột/vuốt để chuyển ---------- */
  function initCarousel() {
    var el = document.getElementById("mainCarousel");

    if (!el || !window.bootstrap) {
      return;
    }

    var carousel = window.bootstrap.Carousel.getOrCreateInstance(el, {
      interval: 5000,
      ride: reduceMotion ? false : "carousel",
      pause: false,
      touch: true,
      wrap: true,
    });

    var startX = 0;
    var startY = 0;
    var dragging = false;
    var moved = false;
    var THRESHOLD = 50;

    // Không cho trình duyệt kéo ảnh ra ngoài
    el.querySelectorAll("img").forEach(function (img) {
      img.setAttribute("draggable", "false");
    });

    el.addEventListener("pointerdown", function (event) {
      // Chỉ chuột trái / cảm ứng; bỏ qua khi bấm nút, link, chỉ báo
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (event.target.closest("a, button")) {
        return;
      }

      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      el.classList.add("is-dragging");
      carousel.pause();
    });

    el.addEventListener("pointermove", function (event) {
      if (!dragging) {
        return;
      }

      if (Math.abs(event.clientX - startX) > 8) {
        moved = true;
      }
    });

    function endDrag(event) {
      if (!dragging) {
        return;
      }

      dragging = false;
      el.classList.remove("is-dragging");

      var dx = event.clientX - startX;
      var dy = event.clientY - startY;

      if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          carousel.next();
        } else {
          carousel.prev();
        }
      }

      if (!reduceMotion) {
        carousel.cycle();
      }
    }

    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("pointerleave", function (event) {
      if (dragging && event.pointerType === "mouse") {
        endDrag(event);
      }
    });

    // Sau khi kéo thì không kích hoạt click vào nút bên dưới
    el.addEventListener(
      "click",
      function (event) {
        if (moved) {
          event.preventDefault();
          event.stopPropagation();
          moved = false;
        }
      },
      true
    );

    // Tạm dừng khi tab bị ẩn để không bị nhảy slide liên tục khi quay lại
    document.addEventListener("visibilitychange", function () {
      if (reduceMotion) {
        return;
      }

      if (document.hidden) {
        carousel.pause();
      } else {
        carousel.cycle();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initReveal();
    initScroll();
    initTilt();
    initCarousel();
  });
})();