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
        {
          predicates: [
            { equals: { method: "GET", path: "/api/b" } }
          ],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: {
                  service: "B",
                  status: "B_PASSED"
                }
              }
            }
          ]
        }
      ]
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
          predicates: [
            { equals: { method: "GET", path: "/api/c" } }
          ],
          responses: [
            {
              is: {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: {
                  service: "C",
                  status: "C_CALLED"
                }
              }
            }
          ]
        }
      ]
    },

    // ==================
    // Service A mock (calls B → C)
    // ------------------
    // Orchestrates calls to Service B and Service C
    // Only if Service B responds with "B_PASSED" does it call Service C
    // ==================
    {
      port: 3001,
      protocol: "http",
      name: "service-A-mock",
      stubs: [
        {
          predicates: [
            { equals: { method: "GET", path: "/api/a" } }
          ],
          responses: [
            {
              inject: function (req, state, logger, callback) {
                const http = require("http");

                // STEP 1: A → B
                http.get("http://localhost:3002/api/b", (resB) => {
                  let bodyB = "";

                  resB.on("data", (chunk) => (bodyB += chunk));
                  resB.on("end", () => {
                    let parsedB = JSON.parse(bodyB);

                    if (parsedB.status !== "B_PASSED") {
                      return callback({
                        statusCode: 500,
                        headers: { "Content-Type": "application/json" },
                        body: {
                          from: "A",
                          error: "B_FAILED",
                          b: parsedB
                        }
                      });
                    }

                    // STEP 2: A → C (only if B passed)
                    http.get("http://localhost:3003/api/c", (resC) => {
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
                            message: "A called B then C",
                            bResult: parsedB,
                            cResult: parsedC
                          }
                        });
                      });
                    }).on("error", (err) => {
                      callback({
                        statusCode: 500,
                        headers: { "Content-Type": "application/json" },
                        body: {
                          from: "A",
                          error: "C_FAILED",
                          details: err.message
                        }
                      });
                    });
                  });
                }).on("error", (err) => {
                  callback({
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: {
                      from: "A",
                      error: "B_FAILED",
                      details: err.message
                    }
                  });
                });
              }
            }
          ]
        }
      ]
    }
  ]
};
