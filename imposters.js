module.exports = {
  imposters: [
    // ==================
    // Service B mock
    // ==================
    {
      port: 3002,
      protocol: "http",
      name: "service-B-mock",
      stubs: [
        // Stub 1: Fail if X-Fail-B header is present
        {
          predicates: [
            { equals: { method: "GET", path: "/api/b" } },
            { exists: { headers: { "x-fail-b": true } } },
          ],
          responses: [
            {
              is: {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: {
                  service: "B",
                  status: "B_FAILED",
                  message: "Service B failed due to X-Fail-B header",
                },
              },
            },
          ],
        },
        // Stub 2: Success (default)
        {
          predicates: [{ equals: { method: "GET", path: "/api/b" } }],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: {
                  service: "B",
                  status: "B_PASSED",
                },
              },
            },
          ],
        },
      ],
    },

    // ==================
    // Service C mock
    // ==================
    {
      port: 3003,
      protocol: "http",
      name: "service-C-mock",
      stubs: [
        {
          predicates: [{ equals: { method: "GET", path: "/api/c" } }],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: {
                  service: "C",
                  status: "C_CALLED",
                },
              },
            },
          ],
        },
      ],
    },

    // ==================
    // Service A mock (calls B → C)
    // ------------------
    // Orchestrates calls to Service B and Service C
    // Only if Service B responds with "B_PASSED" does it call Service C
    // Pass X-Fail-B header from client to Service B to trigger failure
    // ==================
    {
      port: 3001,
      protocol: "http",
      name: "service-A-mock",
      stubs: [
        {
          predicates: [{ equals: { method: "GET", path: "/api/a" } }],
          responses: [
            {
              inject: function (req, state, logger, callback) {
                const http = require("http");

                // Forward X-Fail-B header from client to Service B
                // Note: Mountebank preserves original header casing in req.headers
                const headers = {};
                const failHeader =
                  req.headers["X-Fail-B"] || req.headers["x-fail-b"];
                if (failHeader) {
                  headers["x-fail-b"] = failHeader;
                }

                // STEP 1: A → B
                const requestB = http.request(
                  {
                    hostname: "localhost",
                    port: 3002,
                    path: "/api/b",
                    method: "GET",
                    headers: headers,
                  },
                  (resB) => {
                    let bodyB = "";

                    resB.on("data", (chunk) => (bodyB += chunk));
                    resB.on("end", () => {
                      let parsedB = JSON.parse(bodyB);

                      // Check if B failed (either status code or status field)
                      if (
                        resB.statusCode !== 200 ||
                        parsedB.status !== "B_PASSED"
                      ) {
                        return callback({
                          statusCode: 500,
                          headers: { "Content-Type": "application/json" },
                          body: {
                            from: "A",
                            error: "B_FAILED",
                            message:
                              "Service B did not pass, cannot proceed to C",
                            bResult: parsedB,
                          },
                        });
                      }

                      // STEP 2: A → C (only if B passed)
                      http
                        .get("http://localhost:3003/api/c", (resC) => {
                          let bodyC = "";

                          resC.on("data", (chunk) => (bodyC += chunk));
                          resC.on("end", () => {
                            let parsedC = JSON.parse(bodyC);

                            // STEP 3: A returns combined result
                            callback({
                              statusCode: 200,
                              headers: { "Content-Type": "application/json" },
                              body: {
                                from: "A",
                                message: "A called B then C successfully",
                                bResult: parsedB,
                                cResult: parsedC,
                              },
                            });
                          });
                        })
                        .on("error", (err) => {
                          callback({
                            statusCode: 500,
                            headers: { "Content-Type": "application/json" },
                            body: {
                              from: "A",
                              error: "C_FAILED",
                              details: err.message,
                            },
                          });
                        });
                    });
                  }
                );

                requestB.on("error", (err) => {
                  callback({
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: {
                      from: "A",
                      error: "B_FAILED",
                      details: err.message,
                    },
                  });
                });

                requestB.end();
              },
            },
          ],
        },
      ],
    },
  ],
};
