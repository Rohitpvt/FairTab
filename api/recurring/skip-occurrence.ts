import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleSkipRecurringOccurrence } from "../../functions/src/recurringOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleSkipRecurringOccurrence(req.body, createHandlerContext(context.uid, context.token));
});
