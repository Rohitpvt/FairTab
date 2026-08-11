import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleGenerateRecurringDrafts } from "../../functions/src/recurringOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleGenerateRecurringDrafts(req.body, createHandlerContext(context.uid, context.token));
});
