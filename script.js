/* =========================================
   UBF PROCUREMENT PORTAL - FRONTEND LOGIC
========================================= */

(function () {
    "use strict";

    /* ==============================
       STATE
    ============================== */

    let currentUser = null;

    /* ==============================
       DOM READY
    ============================== */

    document.addEventListener("DOMContentLoaded", function () {
        initializeApplication();
    });

    /* ==============================
       APP INIT
    ============================== */

    async function initializeApplication() {
        bindGlobalEvents();

        const page =
            window.location.hash.replace("#", "") || "dashboard";

        await loadView(page);
    }

    /* ==============================
       ROUTER
    ============================== */

    async function loadView(viewName) {
        const container = document.getElementById(
            "mainContentContainer"
        );

        if (!container) {
            console.error("Missing #mainContentContainer");
            return;
        }

        const allowedViews = [
            "dashboard",
            "form",
            "history"
        ];

        if (!allowedViews.includes(viewName)) {
            viewName = "dashboard";
        }

        const fileName = viewName + ".html";

        try {
            const response = await fetch(fileName);

            if (!response.ok) {
                throw new Error(
                    "Failed to load view: " + fileName
                );
            }

            const html = await response.text();

            container.innerHTML = html;

            afterViewLoaded(viewName);
        } catch (error) {
            console.error(error);

            container.innerHTML =
                `
                <div style="padding:20px;">
                    <h2>View Load Error</h2>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    function afterViewLoaded(viewName) {
        if (viewName === "form") {
            bindRequisitionForm();
        }

        if (viewName === "history") {
            loadRequisitionHistory();
        }

        highlightActiveNav(viewName);
    }

    /* ==============================
       NAVIGATION
    ============================== */

    function bindGlobalEvents() {
        document.addEventListener("click", async function (event) {
            const navTarget = event.target.closest("[data-view]");

            if (navTarget) {
                event.preventDefault();

                const view = navTarget.dataset.view;

                window.location.hash = view;

                await loadView(view);
            }
        });

        window.addEventListener("hashchange", async function () {
            const page =
                window.location.hash.replace("#", "") ||
                "dashboard";

            await loadView(page);
        });
    }

    function highlightActiveNav(viewName) {
        document
            .querySelectorAll("[data-view]")
            .forEach(function (item) {
                item.classList.remove("active");

                if (item.dataset.view === viewName) {
                    item.classList.add("active");
                }
            });
    }

    /* ==============================
       AUTH
    ============================== */

    function getToken() {
        return localStorage.getItem("ubf_github_token") || "";
    }

    function getLoggedInEmail() {
        return (
            localStorage.getItem("ubf_user_email") || ""
        );
    }

    function getCurrentUser() {
        const email = getLoggedInEmail();

        return {
            email: email,
            role: window.UBFData.getUserRole(email)
        };
    }

    /* ==============================
       FORM SUBMISSION
    ============================== */

    function bindRequisitionForm() {
        const form = document.getElementById(
            "requisitionForm"
        );

        if (!form) {
            return;
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const submitButton =
                form.querySelector("button[type='submit']");

            try {
                submitButton.disabled = true;
                submitButton.innerText = "Submitting...";

                const token = getToken();

                if (!token) {
                    alert(
                        "GitHub token missing. Please login."
                    );

                    return;
                }

                currentUser = getCurrentUser();

                const formData = new FormData(form);

                const payload = {
                    requesterName:
                        formData.get("requesterName") || "",

                    requesterEmail:
                        currentUser.email || "",

                    department:
                        formData.get("department") || "",

                    procurementType:
                        formData.get("procurementType") || "",

                    itemDescription:
                        formData.get("itemDescription") || "",

                    quantity:
                        formData.get("quantity") || "",

                    estimatedCost:
                        formData.get("estimatedCost") || "",

                    justification:
                        formData.get("justification") || "",

                    role: currentUser.role
                };

                const createdRecord =
                    await window.UBFData.createRequisition(
                        token,
                        payload
                    );

                alert(
                    "Request submitted successfully.\n\nID: " +
                        createdRecord.id
                );

                form.reset();
            } catch (error) {
                console.error(error);

                alert(
                    "Submission failed.\n\n" +
                        error.message
                );
            } finally {
                submitButton.disabled = false;
                submitButton.innerText =
                    "Submit Request";
            }
        });
    }

    /* ==============================
       HISTORY TABLE
    ============================== */

    async function loadRequisitionHistory() {
        const tableBody = document.getElementById(
            "historyTableBody"
        );

        if (!tableBody) {
            return;
        }

        try {
            tableBody.innerHTML =
                `
                <tr>
                    <td colspan="7">Loading...</td>
                </tr>
            `;

            const token = getToken();

            if (!token) {
                tableBody.innerHTML =
                    `
                    <tr>
                        <td colspan="7">
                            Missing GitHub token.
                        </td>
                    </tr>
                `;

                return;
            }

            const database =
                await window.UBFData.fetchDatabase(
                    token
                );

            if (!database.length) {
                tableBody.innerHTML =
                    `
                    <tr>
                        <td colspan="7">
                            No requisitions found.
                        </td>
                    </tr>
                `;

                return;
            }

            tableBody.innerHTML = "";

            database
                .slice()
                .reverse()
                .forEach(function (item) {
                    const row =
                        document.createElement("tr");

                    row.innerHTML =
                        `
                        <td>${item.id || ""}</td>
                        <td>${item.requesterName || ""}</td>
                        <td>${item.department || ""}</td>
                        <td>${item.procurementType || ""}</td>
                        <td>${item.estimatedCost || ""}</td>
                        <td>${item.status || ""}</td>
                        <td>
                            <button 
                                class="approve-btn"
                                data-id="${item.id}"
                            >
                                Approve
                            </button>

                            <button 
                                class="reject-btn"
                                data-id="${item.id}"
                            >
                                Reject
                            </button>
                        </td>
                    `;

                    tableBody.appendChild(row);
                });

            bindHistoryActions();
        } catch (error) {
            console.error(error);

            tableBody.innerHTML =
                `
                <tr>
                    <td colspan="7">
                        Failed to load history.
                    </td>
                </tr>
            `;
        }
    }

    /* ==============================
       APPROVAL ACTIONS
    ============================== */

    function bindHistoryActions() {
        document
            .querySelectorAll(".approve-btn")
            .forEach(function (button) {
                button.addEventListener(
                    "click",
                    async function () {
                        const requisitionId =
                            button.dataset.id;

                        await handleStatusUpdate(
                            requisitionId,
                            "Approved"
                        );
                    }
                );
            });

        document
            .querySelectorAll(".reject-btn")
            .forEach(function (button) {
                button.addEventListener(
                    "click",
                    async function () {
                        const requisitionId =
                            button.dataset.id;

                        await handleStatusUpdate(
                            requisitionId,
                            "Rejected"
                        );
                    }
                );
            });
    }

    async function handleStatusUpdate(
        requisitionId,
        newStatus
    ) {
        try {
            const token = getToken();

            if (!token) {
                alert("Missing GitHub token.");
                return;
            }

            currentUser = getCurrentUser();

            await window.UBFData.updateRequisitionStatus(
                token,
                requisitionId,
                newStatus,
                currentUser.email
            );

            alert(
                "Requisition updated successfully."
            );

            await loadRequisitionHistory();
        } catch (error) {
            console.error(error);

            alert(
                "Status update failed.\n\n" +
                    error.message
            );
        }
    }

    /* ==============================
       GLOBAL EXPORTS
    ============================== */

    window.UBFApp = {
        loadView,
        loadRequisitionHistory
    };
})();
