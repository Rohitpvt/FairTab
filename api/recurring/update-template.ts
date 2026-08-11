import { withAuth, createHandlerContext } from "../_lib/middleware.js";
import { handleUpdateRecurringTemplate } from "../../functions/src/recurringOperations.js";

export default withAuth(async (req, _res, context) => {
  return handleUpdateRecurringTemplate(req.body, createHandlerContext(context.uid, context.token));
});
