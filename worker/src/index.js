import {
  getCachedRates,
  jsonResponse,
  makeAllItemsStale,
  refreshAllRates,
} from "../../functions/api/rateService.js";

export function isRefreshAuthorized(request, env) {
  const expectedToken = env.REFRESH_TOKEN;
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return false;
  return request.headers.get("x-refresh-token") === expectedToken;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/__scheduled" && env.ENVIRONMENT === "production") {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method === "GET" && url.pathname === "/api/rates") {
      const date = new Date();
      const cached = await getCachedRates(env, { date });
      if (!cached) return jsonResponse({ error: "金利キャッシュがまだありません。" }, 404);
      if (cached.cacheState === "fresh") return jsonResponse(cached);
      try {
        return jsonResponse(await refreshAllRates(env, { date }));
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "stale worker rate cache refresh failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return jsonResponse(makeAllItemsStale(cached));
      }
    }
    if (request.method === "POST" && url.pathname === "/api/rates/refresh") {
      if (!isRefreshAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      try {
        return jsonResponse(await refreshAllRates(env));
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "manual rate refresh failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return jsonResponse({ error: "金利再取得に失敗しました。" }, 502);
      }
    }
    return new Response("Not Found", { status: 404 });
  },

  async scheduled(controller, env) {
    const executionId = `${controller.cron}:${controller.scheduledTime}`;
    try {
      const result = await refreshAllRates(env, {
        date: new Date(controller.scheduledTime),
        executionId,
      });
      console.log(
        JSON.stringify({
          message: "scheduled rate refresh completed",
          executionId,
          locked: result.locked,
          itemCount: result.items.length,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "scheduled rate refresh failed",
          executionId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  },
};
