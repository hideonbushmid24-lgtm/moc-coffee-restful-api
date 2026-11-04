"use strict";

document.addEventListener("DOMContentLoaded", function () {
  /* =========================================================
     1. LẤY CÁC PHẦN TỬ
  ========================================================= */

  const bookingForm = document.querySelector("#booking-form");

  if (!bookingForm) {
    return;
  }

  const customerNameInput =
    document.querySelector("#customer-name");

  const customerPhoneInput =
    document.querySelector("#customer-phone");

  const customerEmailInput =
    document.querySelector("#customer-email");

  const bookingDateInput =
    document.querySelector("#booking-date");

  const bookingTimeSelect =
    document.querySelector("#booking-time");

  const guestCountSelect =
    document.querySelector("#guest-count");

  const areaRadios = document.querySelectorAll(
    ".area-radio"
  );

  const tableRadios = document.querySelectorAll(
    ".table-radio"
  );

  const bookingNoteInput =
    document.querySelector("#booking-note");

  const noteCountElement =
    document.querySelector("#note-count");

  const bookingPolicyInput =
    document.querySelector("#booking-policy");

  const tableErrorElement =
    document.querySelector("#table-error");

  const bookingCodeElement =
    document.querySelector("#booking-code");

  const bookingErrorElement =
    document.querySelector("#booking-error");

  const submitButton = bookingForm.querySelector(
    'button[type="submit"]'
  );

  /* =========================================================
     2. CÁC HÀM HỖ TRỢ
  ========================================================= */

  function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  }

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(
      2,
      "0"
    );

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "Chưa chọn";
    }

    const parts = dateString.split("-");

    if (parts.length !== 3) {
      return dateString;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function getSelectedArea() {
    return document.querySelector(
      'input[name="bookingArea"]:checked'
    );
  }

  function getSelectedTable() {
    return document.querySelector(
      'input[name="tableId"]:checked'
    );
  }

    // Hiện / ẩn thông báo lỗi trả về từ server (trùng giờ, sai dữ liệu...)
  function showBookingError(message) {
    bookingErrorElement.textContent = message;
    bookingErrorElement.classList.remove("d-none");
    bookingErrorElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function hideBookingError() {
    bookingErrorElement.classList.add("d-none");
    bookingErrorElement.textContent = "";
  }

  // Khóa nút gửi khi đang chờ server để khách không bấm 2 lần
  const submitButtonHtml = submitButton.innerHTML;

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.innerHTML = isSubmitting
      ? "Đang gửi..."
      : submitButtonHtml;
  }

  function getCart() {
    try {
      const storedCart = localStorage.getItem(
        "mocCoffeeCart"
      );

      const cart = storedCart
        ? JSON.parse(storedCart)
        : [];

      return Array.isArray(cart) ? cart : [];
    } catch (error) {
      return [];
    }
  }

  function updateCartCount() {
    const cartCountElement =
      document.querySelector("#cart-count");

    if (!cartCountElement) {
      return;
    }

    const cart = getCart();

    const totalQuantity = cart.reduce(
      (total, item) =>
        total + Number(item.quantity || 1),
      0
    );

    cartCountElement.textContent = totalQuantity;
    cartCountElement.classList.toggle(
      "d-none",
      totalQuantity === 0
    );
  }

  function scrollToInvalidElement() {
    const invalidElement = bookingForm.querySelector(
      ":invalid"
    );

    if (invalidElement) {
      invalidElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      invalidElement.focus({
        preventScroll: true,
      });
    }
  }

  /* =========================================================
     3. DỮ LIỆU KHU VỰC CỦA CÁC BÀN
  ========================================================= */

  const tableAreas = {
    T01: "Trong nhà",
    T02: "Trong nhà",
    T03: "Trong nhà",
    T04: "Trong nhà",
    T05: "Ngoài trời",
    T06: "Ngoài trời",
    T07: "Ngoài trời",
    T08: "Ban công",
  };

  /*
   * Ghi lại trạng thái ban đầu của từng bàn.
   * Các bàn bị disabled trong HTML được xem là đã đặt.
   */
  tableRadios.forEach(function (radio) {
    radio.dataset.originalDisabled = radio.disabled
      ? "true"
      : "false";

    const label = document.querySelector(
      `label[for="${radio.id}"]`
    );

    const smallElement = label?.querySelector("small");

    if (smallElement) {
      radio.dataset.originalLabel =
        smallElement.textContent.trim();
    }
  });

  /* =========================================================
     4. THIẾT LẬP NGÀY ĐẶT
  ========================================================= */

  const todayString = getLocalDateString();

  bookingDateInput.min = todayString;

  /*
   * Cho phép đặt trước tối đa 30 ngày.
   */
  const maximumDate = new Date();

  maximumDate.setDate(maximumDate.getDate() + 30);

  bookingDateInput.max =
    getLocalDateString(maximumDate);

  function validateBookingDate() {
    const selectedDate = bookingDateInput.value;

    bookingDateInput.setCustomValidity("");

    if (!selectedDate) {
      return;
    }

    if (selectedDate < todayString) {
      bookingDateInput.setCustomValidity(
        "Ngày đặt bàn không được nhỏ hơn ngày hiện tại."
      );
    }

    if (selectedDate > bookingDateInput.max) {
      bookingDateInput.setCustomValidity(
        "Chỉ có thể đặt bàn trước tối đa 30 ngày."
      );
    }
  }

  /*
   * Nếu khách chọn hôm nay, các giờ đã qua sẽ bị khóa.
   */
  function updateAvailableTimes() {
    const selectedDate = bookingDateInput.value;
    const options = Array.from(
      bookingTimeSelect.options
    );

    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 + now.getMinutes();

    /*
     * Khách cần đặt trước ít nhất 30 phút.
     */
    const minimumBookingMinutes =
      currentMinutes + 30;

    options.forEach(function (option) {
      if (!option.value) {
        return;
      }

      const [hour, minute] = option.value
        .split(":")
        .map(Number);

      const optionMinutes = hour * 60 + minute;

      option.disabled =
        selectedDate === todayString &&
        optionMinutes < minimumBookingMinutes;
    });

    const selectedOption =
      bookingTimeSelect.selectedOptions[0];

    if (
      selectedOption &&
      selectedOption.disabled
    ) {
      bookingTimeSelect.value = "";
    }
  }

  /* =========================================================
     5. CẬP NHẬT PHẦN TÓM TẮT
  ========================================================= */

  function updateBookingSummary() {
    const selectedArea = getSelectedArea();
    const selectedTable = getSelectedTable();

    const customerName =
      customerNameInput.value.trim();

    const customerPhone =
      customerPhoneInput.value.trim();

    const date = bookingDateInput.value;
    const time = bookingTimeSelect.value;
    const guests = guestCountSelect.value;

    setText(
      "#summary-name",
      customerName || "Chưa nhập"
    );

    setText(
      "#summary-phone",
      customerPhone || "Chưa nhập"
    );

    setText(
      "#summary-date",
      date ? formatDate(date) : "Chưa chọn"
    );

    setText(
      "#summary-time",
      time || "Chưa chọn"
    );

    setText(
      "#summary-guests",
      guests ? `${guests} khách` : "Chưa chọn"
    );

    setText(
      "#summary-area",
      selectedArea
        ? selectedArea.value
        : "Chưa chọn"
    );

    setText(
      "#summary-table",
      selectedTable
        ? selectedTable.dataset.name ||
            selectedTable.value
        : "Chưa chọn"
    );
  }

  /* =========================================================
     6. LỌC BÀN THEO KHU VỰC VÀ SỐ KHÁCH
  ========================================================= */

  function filterAvailableTables() {
    const selectedArea = getSelectedArea()?.value;
    const guestCount = Number(
      guestCountSelect.value || 0
    );

    let suitableTableCount = 0;

    tableRadios.forEach(function (radio) {
      const tableColumn = radio.closest(
        ".col-6, .col-md-4, .col-xl-3"
      );

      const label = document.querySelector(
        `label[for="${radio.id}"]`
      );

      const smallElement =
        label?.querySelector("small");

      const tableArea = tableAreas[radio.value];
      const capacity = Number(
        radio.dataset.capacity || 0
      );

      const originallyDisabled =
        radio.dataset.originalDisabled === "true";

      const matchesArea =
        !selectedArea ||
        tableArea === selectedArea;

      if (tableColumn) {
        tableColumn.classList.toggle(
          "d-none",
          !matchesArea
        );
      }

      if (!matchesArea) {
        if (radio.checked) {
          radio.checked = false;
        }

        return;
      }

      /*
       * Bàn đã được đặt từ đầu.
       */
      if (originallyDisabled) {
        radio.disabled = true;

        label?.classList.remove("available");
        label?.classList.add("unavailable");

        if (smallElement) {
          smallElement.textContent =
            radio.dataset.disabledLabel || "Đã đặt";
        }

        return;
      }

      /*
       * Bàn không đủ sức chứa.
       */
      if (guestCount > 0 && capacity < guestCount) {
        radio.disabled = true;

        label?.classList.remove("available");
        label?.classList.add("unavailable");

        if (smallElement) {
          smallElement.textContent =
            `Chỉ ${capacity} người`;
        }

        if (radio.checked) {
          radio.checked = false;
        }

        return;
      }

      /*
       * Bàn phù hợp.
       */
      radio.disabled = false;

      label?.classList.remove("unavailable");
      label?.classList.add("available");

      if (smallElement) {
        smallElement.textContent =
          radio.dataset.originalLabel ||
          `${capacity} người`;
      }

      suitableTableCount++;
    });

    if (
      selectedArea &&
      guestCount > 0 &&
      suitableTableCount === 0
    ) {
      tableErrorElement.textContent =
        "Không có bàn trống đủ sức chứa trong khu vực này. Vui lòng chọn khu vực khác.";

      tableErrorElement.classList.remove("d-none");
    } else {
      tableErrorElement.classList.add("d-none");

      tableErrorElement.textContent =
        "Vui lòng chọn một bàn còn trống.";
    }

    updateBookingSummary();
  }

  /* =========================================================
     7. KIỂM TRA SỨC CHỨA BÀN
  ========================================================= */

  function validateSelectedTable() {
    const selectedTable = getSelectedTable();
    const guestCount = Number(
      guestCountSelect.value || 0
    );

    if (!selectedTable) {
      tableErrorElement.textContent =
        "Vui lòng chọn một bàn còn trống.";

      tableErrorElement.classList.remove("d-none");

      return false;
    }

    const capacity = Number(
      selectedTable.dataset.capacity || 0
    );

    if (guestCount > capacity) {
      tableErrorElement.textContent =
        `Bàn đã chọn chỉ có sức chứa ${capacity} người.`;

      tableErrorElement.classList.remove("d-none");

      return false;
    }

    tableErrorElement.classList.add("d-none");

    return true;
  }

  /* =========================================================
     8. XỬ LÝ CÁC SỰ KIỆN NHẬP LIỆU
  ========================================================= */

  customerNameInput.addEventListener(
    "input",
    updateBookingSummary
  );

  customerPhoneInput.addEventListener(
    "input",
    function () {
      /*
       * Chỉ giữ lại chữ số và giới hạn 10 số.
       */
      this.value = this.value
        .replace(/\D/g, "")
        .slice(0, 10);

      updateBookingSummary();
    }
  );

  bookingDateInput.addEventListener(
    "change",
    function () {
      validateBookingDate();
      updateAvailableTimes();
      updateBookingSummary();
    }
  );

  bookingTimeSelect.addEventListener(
    "change",
    updateBookingSummary
  );

  guestCountSelect.addEventListener(
    "change",
    function () {
      filterAvailableTables();
      validateSelectedTable();
    }
  );

  areaRadios.forEach(function (radio) {
    radio.addEventListener(
      "change",
      filterAvailableTables
    );
  });

  tableRadios.forEach(function (radio) {
    radio.addEventListener("change", function () {
      tableErrorElement.classList.add("d-none");
      updateBookingSummary();
    });
  });

  bookingNoteInput.addEventListener(
    "input",
    function () {
      noteCountElement.textContent =
        this.value.length;
    }
  );

  /* =========================================================
     9. LƯU THÔNG TIN ĐẶT BÀN
  ========================================================= */

  function saveBooking(bookingData) {
    // Dữ liệu thật đã nằm trong database; chỉ nhớ booking gần nhất để trang success.html hiển thị
    localStorage.setItem(
      "mocCoffeeLastBooking",
      JSON.stringify(bookingData)
    );

    localStorage.setItem(
      "mocCoffeeLastResultType",
      "booking"
    );
  }

  /* =========================================================
     10. XỬ LÝ GỬI FORM
  ========================================================= */

  bookingForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      bookingForm.classList.add("was-validated");

      validateBookingDate();

      const validTable = validateSelectedTable();

      if (
        !bookingForm.checkValidity() ||
        !validTable
      ) {
        scrollToInvalidElement();

        if (!validTable) {
          document
            .querySelector("#table-list")
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }

        return;
      }

      const selectedArea = getSelectedArea();
      const selectedTable = getSelectedTable();

      // Gửi lên server: server kiểm tra trùng giờ và tự tạo mã đặt bàn
      hideBookingError();
      setSubmitting(true);

      let savedBooking;

      try {
        savedBooking = await window.MocCoffeeApi.createBooking({
          customer_name: customerNameInput.value.trim(),
          customer_phone: customerPhoneInput.value.trim(),
          customer_email: customerEmailInput.value.trim(),
          booking_date: bookingDateInput.value,
          booking_time: bookingTimeSelect.value,
          guest_count: Number(guestCountSelect.value),
          table_code: selectedTable.value,
          note: bookingNoteInput.value.trim(),
        });
      } catch (error) {
        // TypeError = không gọi được server (mất mạng, server chưa chạy)
        showBookingError(
          error.name === "TypeError"
            ? "Không kết nối được máy chủ. Vui lòng thử lại sau."
            : error.message
        );
        setSubmitting(false);
        return;
      }

      setSubmitting(false);

      const bookingCode = savedBooking.booking_code;

      const bookingData = {
        id: bookingCode,
        type: "booking",

        customer: {
          name: customerNameInput.value.trim(),
          phone: customerPhoneInput.value.trim(),
          email: customerEmailInput.value.trim(),
        },

        bookingDate: bookingDateInput.value,
        bookingTime: bookingTimeSelect.value,
        guestCount: Number(guestCountSelect.value),

        area: selectedArea.value,

        table: {
          id: selectedTable.value,
          name:
            selectedTable.dataset.name ||
            `Bàn ${selectedTable.value}`,
          capacity: Number(
            selectedTable.dataset.capacity
          ),
        },

        note:
          bookingNoteInput.value.trim() ||
          "Không có ghi chú",

        status: "pending",
        statusText: "Chờ xác nhận",

        createdAt: new Date().toISOString(),
      };

      saveBooking(bookingData);

      bookingCodeElement.textContent =
        bookingCode;

      const successLink = document.querySelector(
        "#booking-success-modal a[href='success.html']"
      );

      if (successLink) {
        successLink.href =
          "success.html?type=booking";
      }

      /*
       * Cập nhật thanh tiến trình.
       */
      const bookingSteps = document.querySelectorAll(
        ".booking-step"
      );

      const stepLines =
        document.querySelectorAll(".step-line");

      bookingSteps.forEach(function (step) {
        step.classList.add("active");
      });

      stepLines.forEach(function (line) {
        line.classList.add("active");
      });

      /*
       * Hiển thị modal thành công.
       */
      const modalElement = document.querySelector(
        "#booking-success-modal"
      );

      if (
        modalElement &&
        typeof bootstrap !== "undefined"
      ) {
        const modal =
          bootstrap.Modal.getOrCreateInstance(
            modalElement
          );

        modal.show();
      } else {
        window.location.href =
          "success.html?type=booking";
      }
    }
  );

  /* =========================================================
     10b. LẤY DANH SÁCH BÀN TỪ API
     Tên bàn, sức chứa và việc bàn có đang bảo trì hay không
     lấy từ GET /api/tables. Nếu gọi API lỗi thì giữ dữ liệu
     mặc định ghi sẵn trong HTML.
     Chỉ bàn "bảo trì" bị khóa; bàn "occupied" (đang có khách)
     vẫn đặt được cho giờ khác, giống quy tắc của server.
  ========================================================= */

  async function loadTablesFromApi() {
    try {
      const response = await fetch("/api/tables");

      if (!response.ok) {
        throw new Error("Không tải được danh sách bàn");
      }

      const tables = await response.json();

      if (!Array.isArray(tables)) {
        return;
      }

      tables.forEach(function (table) {
        const radio = Array.from(tableRadios).find(
          function (item) {
            return item.value === table.table_code;
          }
        );

        if (!radio) {
          return;
        }

        const label = document.querySelector(
          `label[for="${radio.id}"]`
        );

        const underMaintenance =
          table.status === "maintenance";

        radio.dataset.capacity = String(table.capacity);
        radio.dataset.name = table.table_name;
        radio.dataset.originalDisabled =
          underMaintenance ? "true" : "false";
        radio.dataset.disabledLabel = "Đang bảo trì";
        radio.dataset.originalLabel =
          `${table.capacity} người`;

        const nameElement = label?.querySelector("strong");

        if (nameElement) {
          nameElement.textContent = table.table_name;
        }

        if (underMaintenance && radio.checked) {
          radio.checked = false;
        }
      });

      filterAvailableTables();
    } catch (error) {
      console.warn(
        "Dùng danh sách bàn mặc định:",
        error.message
      );
    }
  }

  /* =========================================================
     11. KHỞI TẠO TRANG
  ========================================================= */

  updateCartCount();
  updateAvailableTimes();
  filterAvailableTables();
  updateBookingSummary();
  loadTablesFromApi();

  /*
   * Tự động chọn ngày hiện tại nếu quán vẫn còn giờ phục vụ.
   * Có thể xóa đoạn này nếu muốn người dùng tự chọn ngày.
   */
  if (!bookingDateInput.value) {
    bookingDateInput.value = todayString;
    updateAvailableTimes();
    updateBookingSummary();
  }
});