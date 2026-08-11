import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleApproveRecurringDraft } from "../../functions/src/recurringOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleApproveRecurringDraft(req.body, createHandlerContext(context.uid, context.token));
});
