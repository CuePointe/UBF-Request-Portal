/* =========================================
   UBF PROCUREMENT PORTAL - DATA LAYER
   Repository: CuePointe / UBF-Request-Portal
========================================= */

(function () {
    "use strict";

    /* ==============================
       CONFIG
    ============================== */

    const GITHUB_OWNER = "CuePointe";
    const GITHUB_REPO = "UBF-Request-Portal";
    const DATA_FILE_PATH = "data/requisitions.json";
    const GITHUB_BRANCH = "main";

    const GITHUB_API_BASE =
        "https://api.github.com/repos/" +
        GITHUB_OWNER +
        "/" +
        GITHUB_REPO +
        "/contents/" +
        DATA_FILE_PATH;

    /* ==============================
       ROLE MATRIX
    ============================== */

    const ROLE_MATRIX = {
        "s.abonyo@ugandabiodiversityfund.org": "Admin Officer",
        "w.nabatanzi@ugandabiodiversityfund.org": "FAM",
        "i.amani@ugandabiodiversityfund.org": "ED",
        "t.otieno@ugandabiodiversityfund.org": "Developer"
    };

    /* ==============================
       HELPERS
    ============================== */

    function normalizeEmail(email) {
        return String(email || "")
            .trim()
            .toLowerCase();
    }

    function getUserRole(email) {
        const cleanEmail = normalizeEmail(email);

        return ROLE_MATRIX[cleanEmail] || "Staff";
    }

    function generateRequestId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);

        return "REQ-" + timestamp + "-" + random;
    }

    function safeJSONStringify(data) {
        return JSON.stringify(data);
    }

    function safeToBase64(input) {
        try {
            const jsonString =
                typeof input === "string"
                    ? input
                    : safeJSONStringify(input);

            const cleanString = jsonString
                .replace(/\r/g, "")
                .replace(/\n/g, "")
                .trim();

            const utf8Bytes = new TextEncoder().encode(cleanString);

            let binary = "";

            utf8Bytes.forEach(function (byte) {
                binary += String.fromCharCode(byte);
            });

            return btoa(binary);
        } catch (error) {
            console.error("Base64 Encoding Error:", error);
            throw new Error("Failed to encode payload to Base64.");
        }
    }

    function safeFromBase64(base64) {
        try {
            const binary = atob(base64);

            const bytes = Uint8Array.from(binary, function (char) {
                return char.charCodeAt(0);
            });

            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.error("Base64 Decode Error:", error);
            throw new Error("Failed to decode Base64 payload.");
        }
    }

    /* ==============================
       GITHUB API
    ============================== */

    async function fetchLatestFileMeta(token) {
        try {
            const response = await fetch(GITHUB_API_BASE, {
                method: "GET",
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/vnd.github+json"
                }
            });

            if (!response.ok) {
                throw new Error(
                    "GitHub fetch meta failed: " + response.status
                );
            }

            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function fetchDatabase(token) {
        try {
            const fileMeta = await fetchLatestFileMeta(token);

            if (!fileMeta.content) {
                return [];
            }

            const decodedContent = safeFromBase64(
                fileMeta.content.replace(/\n/g, "")
            );

            const parsed = JSON.parse(decodedContent);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Database Fetch Error:", error);
            return [];
        }
    }

    async function updateDatabase(token, updatedArray, commitMessage) {
        try {
            /* ===================================
               ALWAYS FETCH LATEST SHA FIRST
            =================================== */

            const latestMeta = await fetchLatestFileMeta(token);

            const latestSHA = latestMeta.sha;

            if (!latestSHA) {
                throw new Error("Missing GitHub SHA fingerprint.");
            }

            const cleanJSONString = safeJSONStringify(updatedArray);

            const base64Payload = safeToBase64(cleanJSONString);

            const payload = {
                message: commitMessage,
                content: base64Payload,
                sha: latestSHA,
                branch: GITHUB_BRANCH
            };

            const response = await fetch(GITHUB_API_BASE, {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error("GitHub PUT Failure:", result);

                throw new Error(
                    "GitHub update failed (" +
                        response.status +
                        "): " +
                        (result.message || "Unknown Error")
                );
            }

            return result;
        } catch (error) {
            console.error("Database Update Error:", error);
            throw error;
        }
    }

    /* ==============================
       REQUISITION ACTIONS
    ============================== */

    async function createRequisition(token, requisitionData) {
        try {
            const database = await fetchDatabase(token);

            const newRecord = {
                id: generateRequestId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "Pending",
                ...requisitionData
            };

            database.push(newRecord);

            await updateDatabase(
                token,
                database,
                "Create requisition " + newRecord.id
            );

            return newRecord;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function updateRequisitionStatus(
        token,
        requisitionId,
        newStatus,
        actionedBy
    ) {
        try {
            const database = await fetchDatabase(token);

            const target = database.find(function (item) {
                return item.id === requisitionId;
            });

            if (!target) {
                throw new Error("Requisition not found.");
            }

            target.status = newStatus;
            target.updatedAt = new Date().toISOString();
            target.actionedBy = actionedBy;

            await updateDatabase(
                token,
                database,
                "Update requisition status: " + requisitionId
            );

            return target;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    /* ==============================
       GLOBAL EXPORTS
    ============================== */

    window.UBFData = {
        GITHUB_OWNER,
        GITHUB_REPO,
        DATA_FILE_PATH,
        GITHUB_API_BASE,

        normalizeEmail,
        getUserRole,
        safeToBase64,
        safeFromBase64,

        fetchLatestFileMeta,
        fetchDatabase,
        updateDatabase,

        createRequisition,
        updateRequisitionStatus
    };
})();




